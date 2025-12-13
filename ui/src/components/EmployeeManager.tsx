import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Upload, Download, Users, Loader2, FileText, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { employeeApi, rulesetApi, type Employee } from '../services/apiService';
import { useToast } from "./ToastProvider";
import { StateScreen } from "./ui/StateScreen";

type InputMetadata = {
  name: string;
  label: string;
  type: string;
  defaultValue: any;
  options?: string[];
  min?: number;
};

export default function EmployeeManager({ tenantId = "default" }: { tenantId?: string }) {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ type: 'network' | 'system'; message?: string; supportRef?: string } | null>(null);
  
  // Required inputs state
  const [requiredInputs, setRequiredInputs] = useState<Record<string, InputMetadata>>({});
  const [inputsLoading, setInputsLoading] = useState(false);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; count: number }>>([]);
  
  // Global ruleset persistence key
  const GLOBAL_RULESET_KEY = `globalRuleset_${tenantId}`;
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<{ employeeId: string; name: string; data: Record<string, any> }>({
    employeeId: '',
    name: '',
    data: {},
  });
  const [formError, setFormError] = useState<string | null>(null);
  
  // CSV import & delete confirmation dialogs
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch rulesets
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await rulesetApi.getActive(tenantId);
        if (!cancelled) {
          setRulesets(data.ruleSets || []);
          if (data.ruleSets && data.ruleSets.length > 0) {
            let initialRulesetId = data.ruleSets[0].rulesetId;
            
            // Try to restore from global storage
            const storedGlobalRuleset = localStorage.getItem(GLOBAL_RULESET_KEY);
            if (storedGlobalRuleset) {
              try {
                const { rulesetId: storedId } = JSON.parse(storedGlobalRuleset);
                if (data.ruleSets.some(rs => rs.rulesetId === storedId)) {
                  initialRulesetId = storedId;
                }
              } catch (e) {
                console.warn('Failed to parse global ruleset from localStorage:', e);
              }
            }
            
            setSelectedRulesetId(initialRulesetId);
          }
        }
      } catch (e: any) {
        console.error('Failed to load rulesets:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  // Fetch required inputs when ruleset changes
  useEffect(() => {
    if (!selectedRulesetId) return;
    
    let cancelled = false;
    (async () => {
      try {
        setInputsLoading(true);
        const payDay = new Date().toISOString().slice(0, 10);
        const response = await fetch(
          `/api/simulate/required-inputs?tenantId=${tenantId}&rulesetId=${selectedRulesetId}&payDay=${payDay}`
        );
        if (!response.ok) throw new Error('Failed to fetch required inputs');
        const inputs = await response.json();
        if (!cancelled) {
          setRequiredInputs(inputs);
        }
      } catch (e: any) {
        console.error('Failed to load required inputs:', e);
      } finally {
        if (!cancelled) setInputsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedRulesetId, tenantId]);

  // Fetch employees
  useEffect(() => {
    loadEmployees();
  }, [tenantId]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await employeeApi.list(tenantId);
      setEmployees(data);
    } catch (e: any) {
      const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: e.message,
        supportRef: e.response?.status ? `HTTP-${e.response.status}` : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingEmployee(null);
    setFormData({ employeeId: '', name: '', data: {} });
    setFormError(null);
    setShowDialog(true);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      employeeId: employee.employeeId,
      name: employee.name || '',
      data: { ...employee.data },
    });
    setFormError(null);
    setShowDialog(true);
  };

  const handleDeleteRequest = (employee: Employee) => {
    setEmployeeToDelete(employee);
  };

  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;
    try {
      await employeeApi.delete(tenantId, employeeToDelete.employeeId);
      await loadEmployees();
      showToast("success", "Employee deleted", `Employee ${employeeToDelete.employeeId} was removed.`);
    } catch (e: any) {
      showToast("error", "Couldn't delete employee", "Please try again.");
    } finally {
      setEmployeeToDelete(null);
    }
  };

  const handleSave = async () => {
    try {
      if (editingEmployee) {
        await employeeApi.update(tenantId, formData.employeeId, {
          name: formData.name || undefined,
          data: formData.data,
        });
        showToast("success", "Employee updated", formData.employeeId);
      } else {
        await employeeApi.create({
          tenantId,
          employeeId: formData.employeeId,
          name: formData.name || undefined,
          data: formData.data,
        });
        showToast("success", "Employee created", formData.employeeId);
      }
      setFormError(null);
      setShowDialog(false);
      await loadEmployees();
    } catch (e: any) {
      const raw = e?.message || 'Failed to save employee';
      let friendly = raw;
      if (raw.toLowerCase().includes('already exists')) {
        friendly = 'An employee with this ID already exists for this tenant.';
      }
      setFormError(friendly);
      showToast("error", "Couldn't save employee", friendly || "Please try again.");
    }
  };

  const parseCSV = (text: string): Array<{ employeeId: string; name?: string; data: Record<string, any> }> => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error("File must have at least a header row and one data row.");
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const employeeIdIndex = headers.indexOf('employeeId');
    const nameIndex = headers.indexOf('name');

    if (employeeIdIndex === -1) {
      throw new Error('File must have an "employeeId" column.');
    }

    const employeesToCreate: Array<{ employeeId: string; name?: string; data: Record<string, any> }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const employeeId = values[employeeIdIndex];
      
      if (!employeeId) {
        console.warn(`Skipping row ${i + 1}: missing employeeId`);
        continue;
      }

      const data: Record<string, any> = {};
      const name = nameIndex >= 0 ? values[nameIndex] : '';

      // All other columns go into data
      headers.forEach((header, idx) => {
        if (header !== 'employeeId' && header !== 'name' && idx < values.length) {
          const value = values[idx];
          // Try to parse as number if possible
          if (value && !isNaN(Number(value)) && value !== '') {
            data[header] = Number(value);
          } else if (value.toLowerCase() === 'true' || value === '1') {
            data[header] = true;
          } else if (value.toLowerCase() === 'false' || value === '0') {
            data[header] = false;
          } else {
            data[header] = value;
          }
        }
      });

      employeesToCreate.push({
        employeeId,
        name: name || undefined,
        data,
      });
    }

    return employeesToCreate;
  };

  const parseXLSX = (file: File): Promise<Array<{ employeeId: string; name?: string; data: Record<string, any> }>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (jsonData.length < 2) {
            throw new Error("File must have at least a header row and one data row.");
          }

          const headers = jsonData[0].map(h => String(h).trim());
          const employeeIdIndex = headers.indexOf('employeeId');
          const nameIndex = headers.indexOf('name');

          if (employeeIdIndex === -1) {
            throw new Error('File must have an "employeeId" column.');
          }

          const employeesToCreate: Array<{ employeeId: string; name?: string; data: Record<string, any> }> = [];

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const values = row.map(v => v !== null && v !== undefined ? String(v).trim() : '');
            const employeeId = values[employeeIdIndex];
            
            if (!employeeId) {
              console.warn(`Skipping row ${i + 1}: missing employeeId`);
              continue;
            }

            const data: Record<string, any> = {};
            const name = nameIndex >= 0 ? values[nameIndex] : '';

            // All other columns go into data
            headers.forEach((header, idx) => {
              if (header !== 'employeeId' && header !== 'name' && idx < values.length) {
                const value = values[idx];
                // Try to parse as number if possible
                if (value && !isNaN(Number(value)) && value !== '') {
                  data[header] = Number(value);
                } else if (value.toLowerCase() === 'true' || value === '1') {
                  data[header] = true;
                } else if (value.toLowerCase() === 'false' || value === '0') {
                  data[header] = false;
                } else {
                  data[header] = value;
                }
              }
            });

            employeesToCreate.push({
              employeeId,
              name: name || undefined,
              data,
            });
          }

          resolve(employeesToCreate);
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let employeesToCreate: Array<{ employeeId: string; name?: string; data: Record<string, any> }> = [];

      // Determine file type and parse accordingly
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        employeesToCreate = await parseXLSX(file);
      } else if (fileName.endsWith('.csv')) {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsText(file);
        });
        employeesToCreate = parseCSV(text);
      } else {
        showToast("info", "Unsupported file type", "Please upload a CSV or XLSX file.");
        event.target.value = '';
        return;
      }

      // Create all employees
      let successCount = 0;
      let errorCount = 0;
      for (const emp of employeesToCreate) {
        try {
          await employeeApi.create({
            tenantId,
            ...emp,
          });
          successCount++;
        } catch (err: any) {
          console.error(`Failed to create employee ${emp.employeeId}:`, err);
          errorCount++;
        }
      }

      showToast("success", "Import complete", `${successCount} created, ${errorCount} failed.`);
      await loadEmployees();
    } catch (err: any) {
      showToast("error", "Couldn't parse file", "Please check the file format and try again.");
    }
    
    // Reset input
    event.target.value = '';
  };

  const handleExportCsv = () => {
    if (employees.length === 0) {
      showToast("error", "No employees to export", "There are no employees in this tenant.");
      return;
    }

    // Collect all unique data keys
    const allKeys = new Set<string>(['employeeId', 'name']);
    employees.forEach(emp => {
      Object.keys(emp.data || {}).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys);
    const rows = employees.map(emp => {
      const row: string[] = [];
      headers.forEach(header => {
        if (header === 'employeeId') {
          row.push(emp.employeeId);
        } else if (header === 'name') {
          row.push(emp.name || '');
        } else {
          row.push(String(emp.data[header] || ''));
        }
      });
      return row.join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${tenantId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    // Create CSV template with headers based on required inputs
    const headers = ['employeeId', 'name', ...Object.keys(requiredInputs)];

    // Empty example row
    const emptyRow: string[] = headers.map(() => '');

    const csv = [headers.join(','), emptyRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee_template_${tenantId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const deleteName = employeeToDelete?.name || employeeToDelete?.employeeId || "";


  return (
    <div className="max-w-[1600px] mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[#1E1E1E]">Employee Manager</h2>
        <div className="flex items-center gap-2">
          {rulesets.length > 0 && (
            <Select
              value={selectedRulesetId || ''}
              onValueChange={(value) => {
                setSelectedRulesetId(value || null);
                const selected = rulesets.find(rs => rs.rulesetId === value);
                const name = selected?.name || value;
                localStorage.setItem(GLOBAL_RULESET_KEY, JSON.stringify({ rulesetId: value, name }));
              }}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select ruleset..." />
              </SelectTrigger>
              <SelectContent>
                {rulesets.map((rs) => (
                  <SelectItem key={rs.rulesetId} value={rs.rulesetId}>
                    {rs.name} ({rs.count} rules)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            disabled={Object.keys(requiredInputs).length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>

          <Button variant="outline" onClick={handleExportCsv} disabled={employees.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleCsvUpload}
            style={{ display: 'none' }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV/XLSX
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <StateScreen
            type={error.type}
            supportRef={error.supportRef}
            onPrimaryAction={() => {
              setError(null);
              loadEmployees();
            }}
            inline
          />
        </div>
      )}

      {loading ? (
        <Card className="p-12 bg-white rounded-xl shadow-sm border-0">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#0052CC]" />
            <p className="text-gray-600">Loading employees...</p>
          </div>
        </Card>
      ) : employees.length === 0 ? (
        <StateScreen
          type="empty"
          title="No employees yet"
          description="Get started by adding an employee manually or importing a CSV or Excel file."
          primaryActionLabel="Add Employee"
          onPrimaryAction={handleAdd}
        />
      ) : (
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="overflow-x-auto -mx-6 px-6" style={{ width: '100%' }}>
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[120px]">Employee ID</TableHead>
                  <TableHead className="sticky left-[120px] bg-white z-10 min-w-[150px]">Name</TableHead>
                  {Object.keys(requiredInputs).map(key => (
                    <TableHead key={key} className="min-w-[120px] whitespace-nowrap">
                      {requiredInputs[key].label || requiredInputs[key].name}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[100px]">Created</TableHead>
                  <TableHead className="text-right min-w-[140px] sticky right-0 bg-white z-10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.employeeId}>
                    <TableCell className="font-medium sticky left-0 bg-white z-10">{emp.employeeId}</TableCell>
                    <TableCell className="sticky left-[120px] bg-white z-10">{emp.name || '-'}</TableCell>
                    {Object.keys(requiredInputs).map(key => (
                      <TableCell key={key} className="whitespace-nowrap">
                        {emp.data[key] !== undefined && emp.data[key] !== null && emp.data[key] !== ''
                          ? String(emp.data[key])
                          : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                      {new Date(emp.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right sticky right-0 bg-white z-10 min-w-[140px]">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(emp)}
                          className="flex-shrink-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRequest(emp)}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent 
          className="max-w-3xl flex flex-col p-0 overflow-hidden !top-[2rem] !translate-y-0"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            maxHeight: 'calc(100vh - 4rem)',
            height: 'auto',
            position: 'fixed',
            margin: 0
          } as React.CSSProperties}
        >
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200">
            <DialogTitle>
              {editingEmployee ? 'Edit Employee' : 'Add Employee'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employeeId">Employee ID *</Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  disabled={!!editingEmployee}
                  className="mt-1"
                />
                {formError && (
                  <p className="mt-1 text-sm text-red-600">{formError}</p>
                )}
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1"
                  placeholder="Optional"
                />
              </div>
            </div>
            
            {inputsLoading ? (
              <div className="text-center py-4">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0052CC]" />
                <p className="text-sm text-gray-600 mt-2">Loading fields...</p>
              </div>
            ) : Object.keys(requiredInputs).length > 0 ? (
              <div>
                <Label className="mb-3 block text-[#1E1E1E] font-semibold">Employee Information</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(requiredInputs).map(([key, meta]) => (
                    <div key={key}>
                      <Label htmlFor={`field-${key}`}>{meta.label || meta.name}</Label>
                      {meta.type === 'select' && meta.options ? (
                        <Select
                          value={String(formData.data[key] || '')}
                          onValueChange={(value) => {
                            setFormData({
                              ...formData,
                              data: { ...formData.data, [key]: value === '__empty__' ? '' : value }
                            });
                          }}
                        >
                          <SelectTrigger id={`field-${key}`} className="mt-1">
                            <SelectValue placeholder={`Select ${meta.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {meta.options.map((opt) => (
                              <SelectItem key={opt} value={opt === '' ? '__empty__' : opt}>
                                {opt === '' ? '(Empty)' : opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : meta.type === 'boolean' ? (
                        <Select
                          value={String(formData.data[key] ?? 'false')}
                          onValueChange={(value) => {
                            setFormData({
                              ...formData,
                              data: { ...formData.data, [key]: value === 'true' }
                            });
                          }}
                        >
                          <SelectTrigger id={`field-${key}`} className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`field-${key}`}
                          type={meta.type === 'number' ? 'number' : 'text'}
                          value={formData.data[key] ?? ''}
                          onChange={(e) => {
                            const value = meta.type === 'number' 
                              ? parseFloat(e.target.value) || 0 
                              : e.target.value;
                            setFormData({
                              ...formData,
                              data: { ...formData.data, [key]: value }
                            });
                          }}
                          onKeyDown={(e) => {
                            // Replace 0 when typing a new number
                            if (meta.type === 'number' && formData.data[key] === 0 && e.key >= '0' && e.key <= '9') {
                              setFormData({
                                ...formData,
                                data: { ...formData.data, [key]: parseInt(e.key) }
                              });
                              e.preventDefault();
                            }
                          }}
                          min={meta.min}
                          className="mt-1"
                          placeholder={meta.defaultValue !== undefined ? String(meta.defaultValue) : ''}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                <p className="mb-2">No input fields available.</p>
                <p>Please select a ruleset from the dropdown above to see the required fields.</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.employeeId}>
              {editingEmployee ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete{" "}
            <span className="font-semibold">
              {deleteName}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setEmployeeToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

