import { useState, useEffect } from 'react';
import { Save, Upload, Plus, Trash2, Loader2, Database } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { tableApi, rulesetApi } from '../services/apiService';

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
  const [rows, setRows] = useState<Array<{ effectiveFrom: string; effectiveTo: string; keys: Record<string, any>; value: string }>>([]);

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
      setError(err.message || 'Failed to load tables');
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
      setRows(data.rows || []);
    } catch (err: any) {
      // Only show error for actual failures, not for missing tables (which now return empty data)
      if (err.status !== 404) {
        setError(err.message || 'Failed to load table data');
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
    };
    // Initialize keys for each column
    columns.forEach(col => {
      if (col.name) {
        if (col.type === 'number' && col.usesRanges) {
          // For range columns, initialize with min/max object
          newRow.keys[col.name] = { min: 0, max: null };
        } else if (col.type === 'number') {
          newRow.keys[col.name] = 0;
        } else {
          newRow.keys[col.name] = '';
        }
      }
    });
    setRows([...rows, newRow as any]);
  };

  const handleRemoveRow = (index: number) => {
    if (window.confirm('Are you sure you want to delete this row? You will need to save the table to apply the change.')) {
      setRows(rows.filter((_, i) => i !== index));
    }
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

  const handleSaveTableDef = async () => {
    if (!selectedComponent || !tableName.trim()) {
      setError('Component and table name are required');
      return;
    }

      const validColumns = columns.filter(col => col.name.trim()).map(col => ({
        name: col.name,
        type: col.type,
        // Don't save usesRanges - it's inferred from row data
      }));
      if (validColumns.length === 0) {
        setError('At least one column is required');
        return;
      }

      setSaving(true);
      setError(null);
      setSuccess(null);
      try {
        await tableApi.saveTableDef(tenantId, selectedComponent, tableName, description, validColumns);
      setSuccess('Table definition saved successfully!');
      await loadTables();
      setSelectedTable(tableName);
    } catch (err: any) {
      setError(err.message || 'Failed to save table definition');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRows = async () => {
    if (!selectedComponent || !tableName.trim()) {
      setError('Component and table name are required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const rowsToSave = rows.map(row => ({
        effectiveFrom: row.effectiveFrom || '1900-01-01',
        effectiveTo: row.effectiveTo || '9999-12-31',
        keys: row.keys,
        value: parseFloat(row.value) || 0,
      }));
      const result = await tableApi.saveTableRows(tenantId, selectedComponent, tableName, rowsToSave);
      setSuccess(`Successfully saved ${result.upserted} row(s)!`);
      await loadTableData();
    } catch (err: any) {
      setError(err.message || 'Failed to save rows');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadCSV = () => {
    // TODO: Implement CSV upload
    // Using toast would be more in line with the rest of the UI once implemented
    setError('CSV upload feature coming soon.');
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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
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
                    <div className="text-center text-gray-500 py-8">
                      No tables found. Create a new table to get started.
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

                    <Button
                      onClick={handleSaveTableDef}
                      disabled={saving || !tableName.trim()}
                      className="w-full"
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
                </Card>

                {/* Table Rows */}
                {tableName && columns.some(col => col.name.trim()) && (
                  <Card className="p-6 bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Table Rows</h3>
                      <div className="flex gap-2">
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
                                        value={typeof row.keys[col.name] === 'object' ? '' : (row.keys[col.name] || '')}
                                        onFocus={(e) => {
                                          if (col.type === 'number') {
                                            e.target.select();
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (col.type === 'number') {
                                            const currentValue = row.keys[col.name] || 0;
                                            // If value is 0 and user presses a digit, clear the input first
                                            if (currentValue === 0 && /^[0-9]$/.test(e.key)) {
                                              e.currentTarget.value = '';
                                            }
                                          }
                                        }}
                                        onChange={(e) => {
                                          if (col.type === 'number') {
                                            handleRowChange(rowIndex, col.name, parseFloat(e.target.value) || 0);
                                          } else {
                                            handleRowChange(rowIndex, col.name, e.target.value);
                                          }
                                        }}
                                        className="w-full"
                                        min={col.type === 'number' ? 0 : undefined}
                                      />
                                    )}
                                  </td>
                                ))}
                                <td className="border p-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={row.value}
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={(e) => {
                                      const currentValue = row.value || '0';
                                      // If value is 0 and user presses a digit, clear the input first
                                      if (currentValue === '0' && /^[0-9]$/.test(e.key)) {
                                        e.currentTarget.value = '';
                                      }
                                    }}
                                    onChange={(e) => handleRowChange(rowIndex, 'value', e.target.value)}
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
                      <Button
                        onClick={handleSaveRows}
                        disabled={saving}
                        className="w-full mt-4"
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
    </div>
  );
}

