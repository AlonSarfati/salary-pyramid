import { useState, useEffect } from 'react';
import { Save, Upload, Plus, Trash2, Loader2, Database, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { tableApi, rulesetApi } from '../services/apiService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { useToast } from './ToastProvider';
import { StateScreen } from './ui/StateScreen';
import * as XLSX from 'xlsx';

interface TableColumn {
  name: string;
  type: string;
  usesRanges?: boolean; // For number type: whether to use min/max ranges
}

interface TableRow {
  effectiveFrom: string;
  effectiveTo: string;
  keys: Record<string, any>;
  value: string;
}

interface TableDef {
  tableName: string;
  description: string;
  columns: TableColumn[];
  rows: TableRow[];
}

export default function TableBuilder({ tenantId = 'default' }: { tenantId?: string }) {
  const { showToast } = useToast();
  
  // Load persisted state from localStorage
  const getStoredState = () => {
    try {
      const stored = localStorage.getItem(`tableBuilder_${tenantId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load stored state:', e);
    }
    return { selectedComponent: '', selectedTable: null };
  };

  const storedState = getStoredState();
  const [selectedComponent, setSelectedComponent] = useState<string>(storedState.selectedComponent || '');
  const [tables, setTables] = useState<Array<{ tableName: string; description: string; columns: any[] }>>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(storedState.selectedTable || null);
  const [tableData, setTableData] = useState<TableDef | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ type: 'network' | 'system' | 'validation'; message?: string; supportRef?: string } | null>(null);
  const [showDeleteRowDialog, setShowDeleteRowDialog] = useState(false);
  const [rowIndexToDelete, setRowIndexToDelete] = useState<number | null>(null);
  const [showImportCSVDialog, setShowImportCSVDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showDeleteTableDialog, setShowDeleteTableDialog] = useState(false);
  const [showDeleteAllRowsDialog, setShowDeleteAllRowsDialog] = useState(false);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(`tableBuilder_${tenantId}`, JSON.stringify({
        selectedComponent,
        selectedTable,
      }));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }, [selectedComponent, selectedTable, tenantId]);

  // Form state for new/editing table
  const [tableName, setTableName] = useState('');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<TableColumn[]>([{ name: '', type: 'string' }]);
  const [rows, setRows] = useState<Array<{ effectiveFrom: string; effectiveTo: string; keys: Record<string, any>; value: string; _numberKeyStrings?: Record<string, string> }>>([]);

  // Load available components from rulesets
  const [availableComponents, setAvailableComponents] = useState<string[]>([]);

  useEffect(() => {
    // Fetch available components from active rulesets
    const fetchComponents = async () => {
      try {
        const response = await rulesetApi.getActive(tenantId);
        const componentSet = new Set<string>();
        // response.ruleSets is the array of rulesets
        for (const rs of response.ruleSets || []) {
          try {
            const ruleset = await rulesetApi.getRuleset(tenantId, rs.rulesetId);
            if (ruleset && ruleset.rules) {
              ruleset.rules.forEach(rule => {
                if (rule.target) {
                  componentSet.add(rule.target);
                }
              });
            }
          } catch (err) {
            // Skip rulesets that can't be loaded
            console.warn(`Failed to load ruleset ${rs.rulesetId}:`, err);
          }
        }
        setAvailableComponents(Array.from(componentSet).sort());
      } catch (err) {
        console.error('Failed to load components:', err);
        setAvailableComponents([]);
      }
    };
    fetchComponents();
  }, [tenantId]);

  // Load tables when component is selected
  useEffect(() => {
    if (selectedComponent) {
      loadTables();
    } else {
      setTables([]);
      setSelectedTable(null);
      setTableData(null);
    }
  }, [selectedComponent, tenantId]);

  // Restore selected table after tables are loaded
  useEffect(() => {
    if (tables.length > 0 && selectedTable && !tables.some(t => t.tableName === selectedTable)) {
      // If stored table doesn't exist, clear it
      setSelectedTable(null);
    } else if (tables.length > 0 && !selectedTable) {
      // If no table is selected but we have tables, try to restore from storage
      const stored = getStoredState();
      if (stored.selectedTable && stored.selectedComponent === selectedComponent) {
        if (tables.some(t => t.tableName === stored.selectedTable)) {
          setSelectedTable(stored.selectedTable);
        }
      }
    }
  }, [tables, selectedComponent]);

  // Load table data when table is selected
  useEffect(() => {
    if (selectedComponent && selectedTable) {
      loadTableData();
    } else {
      setTableData(null);
    }
  }, [selectedComponent, selectedTable, tenantId]);

  const loadTables = async () => {
    if (!selectedComponent) return;
    setLoading(true);
    setError(null);
    try {
      const response = await tableApi.listTables(tenantId, selectedComponent);
      setTables(response.tables || []);
    } catch (err: any) {
      const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: err.message,
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async () => {
    if (!selectedComponent || !selectedTable) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tableApi.getTable(tenantId, selectedComponent, selectedTable);
      // If table doesn't exist, data will be empty - that's fine, just show empty form
      setTableData({
        tableName: selectedTable,
        description: data.description || '',
        columns: data.columns || [],
        rows: data.rows || [],
      });
      // Populate form
      setTableName(selectedTable);
      setDescription(data.description || '');
      // Detect if columns use ranges by checking existing rows
      const columnsWithRanges = (data.columns || []).map((col: any) => {
        if (col.type === 'number' && data.rows && data.rows.length > 0) {
          // Check if any row has this column as a range object
          const usesRanges = data.rows.some((row: any) => {
            const keyValue = row.keys[col.name];
            return keyValue && typeof keyValue === 'object' && ('min' in keyValue || 'max' in keyValue);
          });
          return { ...col, usesRanges };
        }
        return col;
      });
      setColumns(columnsWithRanges.length > 0 ? columnsWithRanges : [{ name: '', type: 'string' }]);
      // Initialize _numberKeyStrings for number columns to preserve decimal values
      const rowsWithStrings = (data.rows || []).map((row: any) => {
        const newRow = { ...row, _numberKeyStrings: {} };
        // For each number column, store the string representation
        columnsWithRanges.forEach((col: any) => {
          if (col.type === 'number' && !col.usesRanges && row.keys[col.name] !== undefined) {
            newRow._numberKeyStrings[col.name] = String(row.keys[col.name]);
          }
        });
        return newRow;
      });
      setRows(rowsWithStrings);
    } catch (err: any) {
      // Only show error for actual failures, not for missing tables (which now return empty data)
      if (err.status !== 404) {
        const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch');
        setError({
          type: isNetworkError ? 'network' : 'system',
          message: err.message,
          supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
        });
      } else {
        // Table doesn't exist - show empty form
        setTableData({
          tableName: selectedTable,
          description: '',
          columns: [],
          rows: [],
        });
        setTableName(selectedTable);
        setDescription('');
        setColumns([{ name: '', type: 'string' }]);
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewTable = () => {
    setSelectedTable(null);
    setTableData(null);
    setTableName('');
    setDescription('');
    setColumns([{ name: '', type: 'string' }]);
    setRows([]);
  };

  const handleAddColumn = () => {
    setColumns([...columns, { name: '', type: 'string' }]);
  };

  const handleRemoveColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, field: 'name' | 'type' | 'usesRanges', value: string | boolean) => {
    const newColumns = [...columns];
    if (field === 'usesRanges') {
      newColumns[index] = { ...newColumns[index], usesRanges: value as boolean };
    } else {
      newColumns[index] = { ...newColumns[index], [field]: value };
      // If type changes to non-number, clear usesRanges
      if (field === 'type' && value !== 'number') {
        newColumns[index].usesRanges = false;
      }
    }
    setColumns(newColumns);
  };

  const handleAddRow = () => {
    const newRow: Record<string, any> = {
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '9999-12-31',
      keys: {},
      value: '0',
      _numberKeyStrings: {},
    };
    // Initialize keys for each column
    columns.forEach(col => {
      if (col.name) {
        if (col.type === 'number' && col.usesRanges) {
          // For range columns, initialize with min/max object
          newRow.keys[col.name] = { min: 0, max: null };
        } else if (col.type === 'number') {
          newRow.keys[col.name] = 0;
          newRow._numberKeyStrings[col.name] = '0';
        } else {
          newRow.keys[col.name] = '';
        }
      }
    });
    setRows([...rows, newRow as any]);
  };

  const handleRemoveRow = (index: number) => {
    setRowIndexToDelete(index);
    setShowDeleteRowDialog(true);
  };

  const handleRowChange = (rowIndex: number, field: string, value: any) => {
    const newRows = [...rows];
    if (field === 'effectiveFrom' || field === 'effectiveTo' || field === 'value') {
      newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
    } else {
      // It's a key field
      newRows[rowIndex] = {
        ...newRows[rowIndex],
        keys: { ...newRows[rowIndex].keys, [field]: value },
      };
    }
    setRows(newRows);
  };

  const handleRangeChange = (rowIndex: number, columnName: string, rangeField: 'min' | 'max', value: string) => {
    const newRows = [...rows];
    const currentRange = newRows[rowIndex].keys[columnName] || { min: null, max: null };
    const numValue = value === '' ? null : parseFloat(value);
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      keys: {
        ...newRows[rowIndex].keys,
        [columnName]: { ...currentRange, [rangeField]: numValue },
      },
    };
    setRows(newRows);
  };

  const getRangeValue = (row: any, columnName: string, rangeField: 'min' | 'max'): string => {
    const keyValue = row.keys[columnName];
    if (keyValue && typeof keyValue === 'object' && 'min' in keyValue && 'max' in keyValue) {
      const val = keyValue[rangeField];
      return val === null || val === undefined ? '' : String(val);
    }
    return '';
  };

  const confirmDeleteRow = () => {
    if (rowIndexToDelete === null) return;
    setRows(rows.filter((_, i) => i !== rowIndexToDelete));
    setRowIndexToDelete(null);
    setShowDeleteRowDialog(false);
  };

  const handleSaveTableDef = async () => {
    if (!selectedComponent || !tableName.trim()) {
      showToast("info", "Required fields", "Component and table name are required.");
      return;
    }

      const validColumns = columns.filter(col => col.name.trim()).map(col => ({
        name: col.name,
        type: col.type,
        // Don't save usesRanges - it's inferred from row data
      }));
      if (validColumns.length === 0) {
        showToast("info", "Add columns", "At least one column is required.");
        return;
      }

      setSaving(true);
      setError(null);
      try {
        await tableApi.saveTableDef(tenantId, selectedComponent, tableName, description, validColumns);
        showToast("success", "Table Definition Saved", "Table definition saved successfully!");
        await loadTables();
        setSelectedTable(tableName);
    } catch (err: any) {
      showToast("error", "Couldn't save table", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRows = async () => {
    if (!selectedComponent || !tableName.trim()) {
      showToast("info", "Required fields", "Component and table name are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const rowsToSave = rows.map(row => ({
        effectiveFrom: row.effectiveFrom || '1900-01-01',
        effectiveTo: row.effectiveTo || '9999-12-31',
        keys: row.keys,
        value: parseFloat(row.value) || 0,
      }));
      const result = await tableApi.saveTableRows(tenantId, selectedComponent, tableName, rowsToSave);
      showToast("success", "Rows Saved", `Successfully saved ${result.upserted} row(s)!`);
      await loadTableData();
    } catch (err: any) {
      showToast("error", "Couldn't save rows", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllRows = async () => {
    if (!selectedComponent || !tableName.trim()) {
      showToast("info", "Select table", "Please select a component and table.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Save empty rows array to delete all rows
      await tableApi.saveTableRows(tenantId, selectedComponent, tableName, []);
      showToast("success", "Rows Deleted", "All rows deleted successfully!");
      setRows([]);
      setShowDeleteAllRowsDialog(false);
    } catch (err: any) {
      showToast("error", "Couldn't delete rows", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!selectedComponent || !tableName.trim()) {
      showToast("info", "Select table", "Please select a component and table.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await tableApi.deleteTable(tenantId, selectedComponent, tableName);
      showToast("success", "Table Deleted", "Table deleted successfully!");
      setShowDeleteTableDialog(false);
      // Reset form and reload tables
      await loadTables();
      setSelectedTable(null);
      setTableName('');
      setDescription('');
      setColumns([{ name: '', type: 'string' }]);
      setRows([]);
      setTableData(null);
    } catch (err: any) {
      showToast("error", "Couldn't delete table", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadCSV = () => {
    if (!tableName || columns.filter(col => col.name.trim()).length === 0) {
      setError('Please define table name and columns before importing CSV');
      return;
    }
    setShowImportCSVDialog(true);
    setImportError(null);
    setImportFile(null);
  };

  const parseCSV = (csvText: string): string[][] => {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentLine += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        lines.push(currentLine);
        currentLine = '';
      } else if (char === '\n' && !inQuotes) {
        // End of line
        lines.push(currentLine);
        currentLine = '';
      } else {
        currentLine += char;
      }
    }
    // Add last line
    if (currentLine.length > 0 || csvText.endsWith('\n')) {
      lines.push(currentLine);
    }

    // Split each line by commas (now that quotes are handled)
    return lines.map(line => {
      const fields: string[] = [];
      let currentField = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            currentField += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());
      return fields;
    });
  };

  const parseXLSX = (file: File): Promise<string[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          
          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            reject(new Error('Excel file has no sheets'));
            return;
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' }) as any[][];

          if (rows.length === 0) {
            reject(new Error('Excel file is empty'));
            return;
          }

          // Convert to string array, handling dates properly
          const stringRows = rows.map(row => row.map(cell => {
            if (cell instanceof Date) {
              // Convert Date object to YYYY-MM-DD format
              const year = cell.getFullYear();
              const month = String(cell.getMonth() + 1).padStart(2, '0');
              const day = String(cell.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
            // Handle Excel serial date numbers (days since 1900-01-01)
            if (typeof cell === 'number' && cell > 1 && cell < 100000) {
              // Check if it might be an Excel date serial number
              const excelEpoch = new Date(1899, 11, 30); // Excel epoch is 1899-12-30
              const date = new Date(excelEpoch.getTime() + cell * 86400000);
              if (date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              }
            }
            return String(cell || '').trim();
          }));
          resolve(stringRows);
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleDownloadTemplate = () => {
    if (!tableName || columns.filter(col => col.name.trim()).length === 0) {
      showToast("info", "Define table first", "Please define table name and columns before downloading template.");
      return;
    }

    try {
      const keyColumns = columns.filter(col => col.name.trim());
      
      // Build header row: [key columns] + value + effective_from + effective_to
      const headerRow: string[] = [];
      keyColumns.forEach(col => {
        headerRow.push(col.name);
      });
      headerRow.push('Value');
      headerRow.push('Effective From');
      headerRow.push('Effective To');

      // Create example data row (optional, but helpful)
      const exampleRow: string[] = [];
      keyColumns.forEach(col => {
        if (col.type === 'number') {
          if (col.usesRanges) {
            exampleRow.push('1-10'); // Example range
          } else {
            exampleRow.push('1'); // Example number
          }
        } else {
          exampleRow.push('Example'); // Example string
        }
      });
      exampleRow.push('1000'); // Example value
      
      // Create dates as Date objects for Excel
      const effectiveFromDate = new Date('2024-01-01');
      const effectiveToDate = new Date('9999-12-31');
      exampleRow.push(effectiveFromDate); // Example effective from (as Date object)
      exampleRow.push(effectiveToDate); // Example effective to (as Date object)

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
      
      // Set column widths for better readability
      const colWidths = headerRow.map((_, idx) => ({ wch: Math.max(15, headerRow[idx].length + 2) }));
      ws['!cols'] = colWidths;
      
      // Helper function to convert column index to Excel column letter (A, B, C, ..., Z, AA, AB, etc.)
      const getColumnLetter = (colIndex: number): string => {
        let result = '';
        let num = colIndex;
        while (num >= 0) {
          result = String.fromCharCode(65 + (num % 26)) + result;
          num = Math.floor(num / 26) - 1;
        }
        return result;
      };
      
      // Set date format for the last two columns (Effective From and Effective To)
      const effectiveFromColIndex = headerRow.length - 2; // Second to last column
      const effectiveToColIndex = headerRow.length - 1; // Last column
      const effectiveFromCol = getColumnLetter(effectiveFromColIndex);
      const effectiveToCol = getColumnLetter(effectiveToColIndex);
      
      // Apply date format to the date columns in the example row (row 2, since row 1 is header)
      const effectiveFromCell = ws[`${effectiveFromCol}2`];
      const effectiveToCell = ws[`${effectiveToCol}2`];
      if (effectiveFromCell) {
        effectiveFromCell.z = 'yyyy-mm-dd';
        effectiveFromCell.t = 'd'; // Date type
      }
      if (effectiveToCell) {
        effectiveToCell.z = 'yyyy-mm-dd';
        effectiveToCell.t = 'd'; // Date type
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Template');

      // Generate filename
      const fileName = `${tableName || 'table'}_template.xlsx`;

      // Write and download
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      setError(err.message || 'Failed to generate template');
    }
  };

  const parseRowData = (row: string[], keyColumns: TableColumn[]): { keys: Record<string, any>; value: string; effectiveFrom: string; effectiveTo: string } => {
    // Expected columns: [key columns] + value + effective_from + effective_to
    const expectedColumnCount = keyColumns.length + 1 + 2;
    
    if (row.length !== expectedColumnCount) {
      throw new Error(`Row has ${row.length} columns, expected ${expectedColumnCount}. Format: [key columns] + value + effective_from + effective_to`);
    }

    // Parse row: [key1, key2, ..., value, effective_from, effective_to]
    const keys: Record<string, any> = {};
    keyColumns.forEach((col, idx) => {
      const value = row[idx]?.trim() || '';
      if (col.type === 'number') {
        if (col.usesRanges) {
          // For ranges, try to parse as "min-max" or just a number
          const rangeMatch = value.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
          if (rangeMatch) {
            keys[col.name] = { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
          } else {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              keys[col.name] = { min: num, max: num };
            } else {
              keys[col.name] = { min: null, max: null };
            }
          }
        } else {
          const num = parseFloat(value);
          keys[col.name] = isNaN(num) ? 0 : num;
        }
      } else {
        keys[col.name] = value;
      }
    });

    const valueIndex = keyColumns.length;
    const effectiveFromIndex = keyColumns.length + 1;
    const effectiveToIndex = keyColumns.length + 2;

    const value = row[valueIndex]?.trim() || '0';
    
    // Parse dates - handle various formats and convert to YYYY-MM-DD
    const parseDate = (dateStr: string): string => {
      if (!dateStr || dateStr.trim() === '') {
        return '';
      }
      
      // If already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      
      // Try to parse various date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      // Try DD/MM/YYYY or MM/DD/YYYY format
      const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        // Try both interpretations (DD/MM and MM/DD)
        const date1 = new Date(`${year}-${month}-${day}`);
        const date2 = new Date(`${year}-${day}-${month}`);
        if (!isNaN(date1.getTime()) && date1.getDate() == parseInt(day) && date1.getMonth() + 1 == parseInt(month)) {
          return `${year}-${month}-${day}`;
        }
        if (!isNaN(date2.getTime()) && date2.getDate() == parseInt(day) && date2.getMonth() + 1 == parseInt(month)) {
          return `${year}-${day}-${month}`;
        }
        // Default to DD/MM/YYYY
        return `${year}-${month}-${day}`;
      }
      
      return dateStr; // Return as-is if can't parse
    };
    
    const effectiveFrom = parseDate(row[effectiveFromIndex]?.trim() || '') || new Date().toISOString().split('T')[0];
    const effectiveTo = parseDate(row[effectiveToIndex]?.trim() || '') || '9999-12-31';

    return { keys, value, effectiveFrom, effectiveTo };
  };

  const handleImportCSV = async (file: File) => {
    if (!tableName || columns.filter(col => col.name.trim()).length === 0) {
      setImportError('Please define table name and columns before importing');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      let rows: string[][];
      
      // Check file extension
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse XLSX file
        rows = await parseXLSX(file);
      } else {
        // Parse CSV file
        const text = await file.text();
        rows = parseCSV(text);
      }
      
      if (rows.length === 0) {
        setImportError('File is empty');
        setImporting(false);
        return;
      }

      // Always skip first row (header)
      const dataRows = rows.slice(1);
      
      if (dataRows.length === 0) {
        setImportError('No data rows found (only header row)');
        setImporting(false);
        return;
      }

      // Expected columns: key columns (in order) + value + effective_from + effective_to
      const keyColumns = columns.filter(col => col.name.trim());
      const expectedColumnCount = keyColumns.length + 1 + 2; // keys + value + effective_from + effective_to

      const importedRows: Array<{ effectiveFrom: string; effectiveTo: string; keys: Record<string, any>; value: string }> = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        // Skip empty rows
        if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
          continue;
        }
        
        try {
          const parsed = parseRowData(row, keyColumns);
          importedRows.push(parsed);
        } catch (err: any) {
          setImportError(`Row ${i + 2}: ${err.message}`); // +2 because we skipped header and 1-indexed
          setImporting(false);
          return;
        }
      }

      if (importedRows.length === 0) {
        setImportError('No valid data rows found after skipping header');
        setImporting(false);
        return;
      }

      // Replace existing rows with imported rows
      setRows(importedRows);
      setShowImportCSVDialog(false);
      showToast("success", "Import Successful", `Successfully imported ${importedRows.length} row(s) from ${fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ? 'Excel' : 'CSV'}`);
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse file');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-[#0052CC]" />
          <h2 className="text-2xl font-bold text-[#1E1E1E]">Table Builder</h2>
        </div>

        {/* Component Selection */}
        <div className="mb-6">
          <Label htmlFor="component">Component</Label>
          <Select value={selectedComponent} onValueChange={setSelectedComponent}>
            <SelectTrigger id="component" className="mt-1">
              <SelectValue placeholder="Select a component" />
            </SelectTrigger>
            <SelectContent>
              {availableComponents.map(comp => (
                <SelectItem key={comp} value={comp}>
                  {comp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="mb-4">
            <StateScreen
              type={error.type}
              supportRef={error.supportRef}
              onPrimaryAction={() => {
                setError(null);
                if (error.type === 'network' || error.type === 'system') {
                  window.location.reload();
                }
              }}
              inline
            />
          </div>
        )}


        {selectedComponent && (
          <>
            {/* Table Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <Label>Active Tables</Label>
                <Button onClick={handleNewTable} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  New Table
                </Button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[#0052CC]" />
                </div>
              ) : (
                <div className="space-y-2">
                  {tables.map(table => (
                    <div
                      key={table.tableName}
                      onClick={() => setSelectedTable(table.tableName)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTable === table.tableName
                          ? 'bg-[#0052CC] text-white border-[#0052CC]'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold">{table.tableName}</div>
                      {table.description && (
                        <div className={`text-sm mt-1 ${selectedTable === table.tableName ? 'text-white opacity-90' : 'text-gray-600'}`}>
                          {table.description}
                        </div>
                      )}
                    </div>
                  ))}
                  {tables.length === 0 && !selectedTable && (
                    <div className="py-8">
                      <StateScreen
                        type="empty"
                        title="No tables"
                        description="Create a lookup table to use in your rules with the TBL() function."
                        inline
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Table Editor */}
            {(selectedTable || !selectedTable) && (
              <div className="space-y-6">
                {/* Table Definition */}
                <Card className="p-6 bg-gray-50">
                  <h3 className="text-lg font-semibold mb-4">Table Definition</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="tableName">Table Name</Label>
                      <Input
                        id="tableName"
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                        placeholder="e.g., RoleSeniority"
                        className="mt-1"
                        disabled={!!selectedTable}
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what this table is used for"
                        className="mt-1"
                        rows={2}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Columns</Label>
                        <Button onClick={handleAddColumn} size="sm" variant="outline">
                          <Plus className="w-4 h-4 mr-1" />
                          Add Column
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {columns.map((col, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <Input
                              value={col.name}
                              onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                              placeholder="Column name"
                              className="flex-1"
                            />
                            <Select
                              value={col.type}
                              onValueChange={(value) => handleColumnChange(index, 'type', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                              </SelectContent>
                            </Select>
                            {col.type === 'number' && (
                              <div className="flex items-center gap-2 px-2">
                                <Checkbox
                                  id={`range-${index}`}
                                  checked={col.usesRanges || false}
                                  onCheckedChange={(checked) => handleColumnChange(index, 'usesRanges', checked === true)}
                                />
                                <Label htmlFor={`range-${index}`} className="text-xs cursor-pointer">
                                  Use Ranges
                                </Label>
                              </div>
                            )}
                            <Button
                              onClick={() => handleRemoveColumn(index)}
                              size="sm"
                              variant="ghost"
                              disabled={columns.length === 1}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      {selectedTable && (
                        <Button
                          onClick={() => setShowDeleteTableDialog(true)}
                          disabled={saving}
                          variant="destructive"
                          className="flex-1"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Table
                        </Button>
                      )}
                      <Button
                        onClick={handleSaveTableDef}
                        disabled={saving || !tableName.trim()}
                        className="flex-1"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Table Definition
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Table Rows */}
                {tableName && columns.some(col => col.name.trim()) && (
                  <Card className="p-6 bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Table Rows</h3>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleDownloadTemplate} 
                          size="sm" 
                          variant="outline"
                          disabled={!tableName || columns.filter(col => col.name.trim()).length === 0}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download Template
                        </Button>
                        <Button onClick={handleUploadCSV} size="sm" variant="outline">
                          <Upload className="w-4 h-4 mr-1" />
                          Upload CSV
                        </Button>
                        <Button onClick={handleAddRow} size="sm" variant="outline">
                          <Plus className="w-4 h-4 mr-1" />
                          Add Row
                        </Button>
                      </div>
                    </div>

                    {rows.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        No rows yet. Click "Add Row" to create one.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border p-2 text-left">Effective From</th>
                              <th className="border p-2 text-left">Effective To</th>
                              {columns.filter(col => col.name.trim()).map((col, idx) => (
                                <th key={idx} className="border p-2 text-left">
                                  <div className="flex flex-col">
                                    <span>{col.name}</span>
                                    {col.type === 'number' && col.usesRanges && (
                                      <span className="text-xs text-gray-500 font-normal">(Range)</span>
                                    )}
                                  </div>
                                </th>
                              ))}
                              <th className="border p-2 text-left">Value</th>
                              <th className="border p-2 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                <td className="border p-2">
                                  <Input
                                    type="date"
                                    value={row.effectiveFrom}
                                    onChange={(e) => handleRowChange(rowIndex, 'effectiveFrom', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="border p-2">
                                  <Input
                                    type="date"
                                    value={row.effectiveTo}
                                    onChange={(e) => handleRowChange(rowIndex, 'effectiveTo', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                {columns.filter(col => col.name.trim()).map((col, colIndex) => (
                                  <td key={colIndex} className="border p-2">
                                    {col.type === 'number' && col.usesRanges ? (
                                      <div className="flex gap-1 items-center">
                                        <div className="flex flex-col">
                                          <Input
                                            type="number"
                                            placeholder="From"
                                            value={getRangeValue(row, col.name, 'min')}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                              const currentValue = getRangeValue(row, col.name, 'min');
                                              // If value is 0 and user presses a digit, clear the input first
                                              if (currentValue === '0' && /^[0-9]$/.test(e.key)) {
                                                e.currentTarget.value = '';
                                              }
                                            }}
                                            onChange={(e) => handleRangeChange(rowIndex, col.name, 'min', e.target.value)}
                                            className="w-24"
                                            min="0"
                                          />
                                          <Label className="text-xs text-gray-500 mt-0.5">Min</Label>
                                        </div>
                                        <span className="text-gray-500 mt-4">to</span>
                                        <div className="flex flex-col">
                                          <Input
                                            type="number"
                                            placeholder="To (or ∞)"
                                            value={getRangeValue(row, col.name, 'max')}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                              const currentValue = getRangeValue(row, col.name, 'max');
                                              // If value is 0 and user presses a digit, clear the input first
                                              if (currentValue === '0' && /^[0-9]$/.test(e.key)) {
                                                e.currentTarget.value = '';
                                              }
                                            }}
                                            onChange={(e) => handleRangeChange(rowIndex, col.name, 'max', e.target.value)}
                                            className="w-24"
                                            min="0"
                                          />
                                          <Label className="text-xs text-gray-500 mt-0.5">Max (empty = ∞)</Label>
                                        </div>
                                      </div>
                                    ) : (
                                      <Input
                                        type={col.type === 'number' ? 'number' : 'text'}
                                        value={typeof row.keys[col.name] === 'object' ? '' : (
                                          row._numberKeyStrings && row._numberKeyStrings[col.name] !== undefined
                                            ? row._numberKeyStrings[col.name]
                                            : (row.keys[col.name] !== undefined && row.keys[col.name] !== null ? String(row.keys[col.name]) : '')
                                        )}
                                        onFocus={(e) => {
                                          if (col.type === 'number') {
                                            e.target.select();
                                          }
                                        }}
                                        onChange={(e) => {
                                          if (col.type === 'number') {
                                            let val = e.target.value;
                                            const newRows = [...rows];
                                            // Store the string value for display (to preserve decimals like "0.0", "0.07")
                                            if (!newRows[rowIndex]._numberKeyStrings) {
                                              newRows[rowIndex] = { ...newRows[rowIndex], _numberKeyStrings: {} };
                                            }
                                            
                                            // Normalize leading zeros only for integers (not decimals)
                                            // This allows "0.1", "0.07", etc. to be preserved
                                            // But "0001" will become "1" immediately
                                            if (val && !val.includes('.') && val.match(/^0+[1-9]/)) {
                                              // Remove leading zeros for integers (e.g., "0001" -> "1")
                                              val = val.replace(/^0+/, '') || '0';
                                            }
                                            
                                            newRows[rowIndex]._numberKeyStrings![col.name] = val;
                                            
                                            // Also store the numeric value for calculations
                                            if (val === '' || val === '-') {
                                              newRows[rowIndex].keys[col.name] = 0;
                                            } else {
                                              const numVal = parseFloat(val);
                                              newRows[rowIndex].keys[col.name] = isNaN(numVal) ? 0 : numVal;
                                            }
                                            setRows(newRows);
                                          } else {
                                            handleRowChange(rowIndex, col.name, e.target.value);
                                          }
                                        }}
                                        onBlur={(e) => {
                                          if (col.type === 'number') {
                                            // On blur, normalize the value (remove leading zeros, but preserve decimals)
                                            const val = e.target.value;
                                            if (val && !val.includes('.')) {
                                              // Normalize integers: "0001" -> "1", but "0" stays "0"
                                              const normalized = val.replace(/^0+/, '') || '0';
                                              if (normalized !== val) {
                                                const newRows = [...rows];
                                                if (!newRows[rowIndex]._numberKeyStrings) {
                                                  newRows[rowIndex] = { ...newRows[rowIndex], _numberKeyStrings: {} };
                                                }
                                                newRows[rowIndex]._numberKeyStrings![col.name] = normalized;
                                                const numVal = parseFloat(normalized);
                                                newRows[rowIndex].keys[col.name] = isNaN(numVal) ? 0 : numVal;
                                                setRows(newRows);
                                              }
                                            }
                                          }
                                        }}
                                        className="w-full"
                                        min={col.type === 'number' ? 0 : undefined}
                                        step={col.type === 'number' ? 'any' : undefined}
                                      />
                                    )}
                                  </td>
                                ))}
                                <td className="border p-2">
                                  <Input
                                    type="number"
                                    step="any"
                                    value={row.value}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      let val = e.target.value;
                                      // Normalize leading zeros only for integers (not decimals)
                                      // This allows "0.1", "0.07", etc. to be preserved
                                      // But "0001" will become "1" immediately
                                      if (val && !val.includes('.') && val.match(/^0+[1-9]/)) {
                                        // Remove leading zeros for integers (e.g., "0001" -> "1")
                                        val = val.replace(/^0+/, '') || '0';
                                      }
                                      // Preserve the string value to allow decimal input like "0.0", "0.07", "0.073"
                                      // The value will be parsed to number when saving
                                      handleRowChange(rowIndex, 'value', val === '' ? '0' : val);
                                    }}
                                    onBlur={(e) => {
                                      // On blur, normalize the value (remove leading zeros, but preserve decimals)
                                      const val = e.target.value;
                                      if (val && !val.includes('.')) {
                                        // Normalize integers: "0001" -> "1", but "0" stays "0"
                                        const normalized = val.replace(/^0+/, '') || '0';
                                        if (normalized !== val) {
                                          handleRowChange(rowIndex, 'value', normalized);
                                        }
                                      }
                                    }}
                                    className="w-full"
                                  />
                                </td>
                                <td className="border p-2">
                                  <Button
                                    onClick={() => handleRemoveRow(rowIndex)}
                                    size="sm"
                                    variant="ghost"
                                    title="Delete row"
                                    className="hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {rows.length > 0 && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={() => setShowDeleteAllRowsDialog(true)}
                          disabled={saving}
                          variant="destructive"
                          className="flex-1"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete All Rows
                        </Button>
                        <Button
                          onClick={handleSaveRows}
                          disabled={saving}
                          className="flex-1"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save Rows
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}
          </>
        )}

        {!selectedComponent && (
          <div className="text-center text-gray-500 py-12">
            Please select a component to view and manage its tables.
          </div>
        )}
      </Card>

      {/* Delete Table Dialog */}
      <Dialog open={showDeleteTableDialog} onOpenChange={setShowDeleteTableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Table</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete the entire table "{tableName}"? This will permanently delete the table definition and all its rows. This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteTableDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTable}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Table
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Rows Dialog */}
      <Dialog open={showDeleteAllRowsDialog} onOpenChange={setShowDeleteAllRowsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Rows</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete all rows from the table "{tableName}"? The table definition will be kept, but all data will be permanently removed. This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteAllRowsDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllRows}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All Rows
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Row Dialog */}
      <Dialog open={showDeleteRowDialog} onOpenChange={setShowDeleteRowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Row</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete this row? You will need to save the table to apply the change.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteRowDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteRow}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportCSVDialog} onOpenChange={setShowImportCSVDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Table Rows</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <div className="flex items-center justify-between gap-4 mb-2">
                <Label htmlFor="csvFile">CSV or Excel File</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  disabled={!tableName || columns.filter(col => col.name.trim()).length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>
              <Input
                id="csvFile"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportFile(file);
                    setImportError(null);
                  }
                }}
                className="mt-1"
              />
            </div>
            
            <div className="text-sm text-gray-600 space-y-2">
              <p className="font-semibold">File Format:</p>
              <p>The file should have columns in this order (first row is header and will be skipped):</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                {columns.filter(col => col.name.trim()).map((col, idx) => (
                  <li key={idx}>{idx + 1}. {col.name} ({col.type})</li>
                ))}
                <li>{columns.filter(col => col.name.trim()).length + 1}. Value (number)</li>
                <li>{columns.filter(col => col.name.trim()).length + 2}. Effective From (date: YYYY-MM-DD)</li>
                <li>{columns.filter(col => col.name.trim()).length + 3}. Effective To (date: YYYY-MM-DD)</li>
              </ol>
              <p className="mt-2 text-xs text-gray-500">
                Supported formats: CSV (.csv), Excel (.xlsx, .xls). The first row is always treated as a header and will be skipped.
              </p>
            </div>

            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {importError}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportCSVDialog(false);
                  setImportFile(null);
                  setImportError(null);
                }}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (importFile) {
                    handleImportCSV(importFile);
                  } else {
                    setImportError('Please select a CSV or Excel file');
                  }
                }}
                disabled={importing || !importFile}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

