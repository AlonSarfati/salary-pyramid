import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Upload, Download, Users, Loader2, FileText, X } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { employeeApi, rulesetApi, type Employee } from '../services/apiService';
import { useToast } from "./ToastProvider";

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
  const [error, setError] = useState<string | null>(null);
  
  // Required inputs state
  const [requiredInputs, setRequiredInputs] = useState<Record<string, InputMetadata>>({});
  const [inputsLoading, setInputsLoading] = useState(false);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; count: number }>>([]);
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<{ employeeId: string; name: string; data: Record<string, any> }>({
    employeeId: '',
    name: '',
    data: {},
  });
  
  // CSV import & delete confirmation dialogs
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [csvFormatInfo, setCsvFormatInfo] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  // Fetch rulesets
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await rulesetApi.getActive(tenantId);
        if (!cancelled) {
          setRulesets(data.ruleSets || []);
          if (data.ruleSets && data.ruleSets.length > 0) {
            setSelectedRulesetId(data.ruleSets[0].rulesetId);
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
      setError(e.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingEmployee(null);
    setFormData({ employeeId: '', name: '', data: {} });
    setShowDialog(true);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      employeeId: employee.employeeId,
      name: employee.name || '',
      data: { ...employee.data },
    });
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
      showToast("error", "Failed to delete employee", e.message || "Unknown error");
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
      setShowDialog(false);
      await loadEmployees();
    } catch (e: any) {
      showToast("error", "Failed to save employee", e.message || "Unknown error");
    }
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          showToast("error", "Invalid CSV", "File must have at least a header row and one data row.");
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const employeeIdIndex = headers.indexOf('employeeId');
        const nameIndex = headers.indexOf('name');

        if (employeeIdIndex === -1) {
          showToast("error", "Invalid CSV", 'CSV must have an "employeeId" column.');
          return;
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
        showToast("error", "Failed to parse CSV", err.message || "Unknown error");
      }
    };
    reader.readAsText(file);
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

  const deleteName = employeeToDelete?.name || employeeToDelete?.employeeId || "";

  const handleDownloadTemplate = () => {
    // Create CSV template with headers and example rows
    const headers = ['employeeId', 'name', ...Object.keys(requiredInputs)];
    
    // Create example rows with default values or placeholders
    const exampleRows: string[][] = [];
    
    // Row 1: Example with default values
    const row1: string[] = [];
    headers.forEach(header => {
      if (header === 'employeeId') {
        row1.push('E001');
      } else if (header === 'name') {
        row1.push('John Doe');
      } else {
        const meta = requiredInputs[header];
        if (meta) {
          if (meta.type === 'boolean') {
            row1.push('true');
          } else if (meta.type === 'number') {
            row1.push(String(meta.defaultValue || 0));
          } else if (meta.type === 'select' && meta.options && meta.options.length > 0) {
            row1.push(meta.options[0] === '' ? '(Empty)' : meta.options[0]);
          } else {
            row1.push(String(meta.defaultValue || ''));
          }
        } else {
          row1.push('');
        }
      }
    });
    exampleRows.push(row1);
    
    // Row 2: Another example
    const row2: string[] = [];
    headers.forEach(header => {
      if (header === 'employeeId') {
        row2.push('E002');
      } else if (header === 'name') {
        row2.push('Jane Smith');
      } else {
        const meta = requiredInputs[header];
        if (meta) {
          if (meta.type === 'boolean') {
            row2.push('false');
          } else if (meta.type === 'number') {
            row2.push(String(meta.defaultValue || 0));
          } else if (meta.type === 'select' && meta.options && meta.options.length > 1) {
            row2.push(meta.options[1] === '' ? '(Empty)' : meta.options[1]);
          } else if (meta.type === 'select' && meta.options && meta.options.length > 0) {
            row2.push(meta.options[0] === '' ? '(Empty)' : meta.options[0]);
          } else {
            row2.push(String(meta.defaultValue || ''));
          }
        } else {
          row2.push('');
        }
      }
    });
    exampleRows.push(row2);
    
    // Row 3: Empty template row
    const row3: string[] = [];
    headers.forEach(header => {
      if (header === 'employeeId') {
        row3.push('');
      } else if (header === 'name') {
        row3.push('');
      } else {
        row3.push('');
      }
    });
    exampleRows.push(row3);

    const csv = [headers.join(','), ...exampleRows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee_template_${tenantId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[#1E1E1E]">Employee Manager</h2>
        <div className="flex items-center gap-2">
          {rulesets.length > 0 && (
            <Select
              value={selectedRulesetId || ''}
              onValueChange={(value) => setSelectedRulesetId(value || null)}
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
          <Button variant="outline" onClick={handleDownloadTemplate} disabled={Object.keys(requiredInputs).length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>
          <Button variant="outline" onClick={() => setCsvFormatInfo(true)}>
            <FileText className="w-4 h-4 mr-2" />
            CSV Format
          </Button>
          <Button variant="outline" onClick={handleExportCsv} disabled={employees.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <label>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
              id="csv-upload"
            />
            <Button variant="outline" onClick={() => document.getElementById('csv-upload')?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </label>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </Card>
      )}

      {loading ? (
        <Card className="p-12 bg-white rounded-xl shadow-sm border-0">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#0052CC]" />
            <p className="text-gray-600">Loading employees...</p>
          </div>
        </Card>
      ) : employees.length === 0 ? (
        <Card className="p-12 bg-white rounded-xl shadow-sm border-0">
          <div className="text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-[#1E1E1E] mb-2">No Employees</h3>
            <p className="text-gray-600 mb-6">
              Get started by adding an employee manually or importing a CSV file
            </p>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </Card>
      ) : (
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  {Object.keys(requiredInputs).slice(0, 5).map(key => (
                    <TableHead key={key}>{requiredInputs[key].label || requiredInputs[key].name}</TableHead>
                  ))}
                  {Object.keys(requiredInputs).length > 5 && (
                    <TableHead>More...</TableHead>
                  )}
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.employeeId}>
                    <TableCell className="font-medium">{emp.employeeId}</TableCell>
                    <TableCell>{emp.name || '-'}</TableCell>
                    {Object.keys(requiredInputs).slice(0, 5).map(key => (
                      <TableCell key={key}>
                        {emp.data[key] !== undefined && emp.data[key] !== null && emp.data[key] !== ''
                          ? String(emp.data[key])
                          : '-'}
                      </TableCell>
                    ))}
                    {Object.keys(requiredInputs).length > 5 && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(requiredInputs).slice(5).map(key => {
                            const value = emp.data[key];
                            if (value === undefined || value === null || value === '') return null;
                            return (
                              <span key={key} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {requiredInputs[key].label || key}: {String(value)}
                              </span>
                            );
                          })}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-gray-600">
                      {new Date(emp.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(emp)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRequest(emp)}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Edit Employee' : 'Add Employee'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
          <DialogFooter>
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

      {/* CSV Format Info Dialog */}
      <Dialog open={csvFormatInfo} onOpenChange={setCsvFormatInfo}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CSV Import Format</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Required Columns:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><code className="bg-gray-100 px-1 rounded">employeeId</code> - Unique identifier for the employee (required)</li>
                <li><code className="bg-gray-100 px-1 rounded">name</code> - Employee name (optional)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Data Columns:</h3>
              <p className="text-sm text-gray-600 mb-2">
                Any other columns will be stored as employee data. Examples:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><code className="bg-gray-100 px-1 rounded">Role</code> - Employee role (e.g., "Engineer")</li>
                <li><code className="bg-gray-100 px-1 rounded">Year</code> - Years of experience (numeric)</li>
                <li><code className="bg-gray-100 px-1 rounded">Department</code> - Department name</li>
                <li>Any other field your rules require</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Example CSV:</h3>
              <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto">
{`employeeId,name,Role,Year,Department
E001,John Doe,Engineer,5,Engineering
E002,Jane Smith,Manager,10,Management
E003,Bob Johnson,Engineer,3,Engineering`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Notes:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Numeric values will be automatically parsed as numbers</li>
                <li>Boolean values: "true"/"1" = true, "false"/"0" = false</li>
                <li>All other values are stored as strings</li>
                <li>Empty cells are ignored</li>
                <li>Rows with missing employeeId will be skipped</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCsvFormatInfo(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

