import { useState } from 'react';
import { Upload, Play, Download, Users } from 'lucide-react';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function SimulateBulk() {
  const [hasData, setHasData] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);

  const componentData = [
    { name: 'Base Salary', amount: 8500000 },
    { name: 'Bonuses', amount: 1275000 },
    { name: 'Pension', amount: 680000 },
    { name: 'Stock Options', amount: 1020000 },
    { name: 'Overtime', amount: 450000 },
    { name: 'Health Insurance', amount: 120000 },
    { name: 'Commission', amount: 360000 },
    { name: 'Training Allowance', amount: 85000 },
    { name: 'Transport', amount: 95000 },
    { name: 'Meal Vouchers', amount: 65000 },
  ];

  const employeeData = [
    { id: 'E001', name: 'John Doe', total: 124050, delta: 12050 },
    { id: 'E002', name: 'Jane Smith', total: 118200, delta: 8200 },
    { id: 'E003', name: 'Mike Johnson', total: 145800, delta: 15800 },
    { id: 'E004', name: 'Sarah Williams', total: 132500, delta: 9500 },
    { id: 'E005', name: 'David Brown', total: 127400, delta: 7400 },
    { id: 'E006', name: 'Emily Davis', total: 139600, delta: 11600 },
    { id: 'E007', name: 'Chris Wilson', total: 115300, delta: 5300 },
    { id: 'E008', name: 'Lisa Anderson', total: 141200, delta: 13200 },
  ];

  const handleLoadCSV = () => {
    setHasData(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[#1E1E1E]">Bulk / Segment Simulation</h2>
        <div className="flex items-center gap-3">
          <Label htmlFor="comparison" className="text-[#1E1E1E]">Comparison Mode</Label>
          <Switch
            id="comparison"
            checked={comparisonMode}
            onCheckedChange={setComparisonMode}
          />
        </div>
      </div>

      {/* Upload Section */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0 mb-6">
        <h3 className="text-[#1E1E1E] mb-4">Data Source</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="segment">Select Segment</Label>
            <Select>
              <SelectTrigger id="segment" className="mt-1">
                <SelectValue placeholder="Choose segment..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="ruleset">Ruleset</Label>
            <Select>
              <SelectTrigger id="ruleset" className="mt-1">
                <SelectValue placeholder="Select ruleset..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024 Annual Rules (Active)</SelectItem>
                <SelectItem value="q4">Q4 2024 Bonus (Draft)</SelectItem>
                <SelectItem value="2025">2025 Preview (Draft)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleLoadCSV}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Upload CSV
            </button>
            <button
              onClick={handleLoadCSV}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors"
            >
              <Play className="w-5 h-5" />
              Run
            </button>
          </div>
        </div>
      </Card>

      {hasData && (
        <>
          {/* Summary Card */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#0052CC] bg-opacity-10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#0052CC]" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Employees Loaded</div>
                  <div className="text-2xl text-[#1E1E1E]">1,247</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Total Payroll Cost</div>
                <div className="text-2xl text-[#0052CC]">$12,650,000</div>
              </div>
              <button className="flex items-center gap-2 px-6 py-3 bg-white text-[#0052CC] border border-[#0052CC] rounded-xl hover:bg-[#EEF2F8] transition-colors">
                <Download className="w-5 h-5" />
                Export Results
              </button>
            </div>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Aggregated Components Chart */}
            <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
              <h3 className="text-[#1E1E1E] mb-4">Aggregated Totals by Component</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={componentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={100} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#0052CC" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Top Components */}
            <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
              <h3 className="text-[#1E1E1E] mb-4">Top 10 Components by Cost</h3>
              <div className="space-y-3">
                {componentData.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 text-sm text-gray-500">{idx + 1}</div>
                    <div className="flex-1">
                      <div className="text-sm text-[#1E1E1E] mb-1">{item.name}</div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0052CC]"
                          style={{ width: `${(item.amount / componentData[0].amount) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-[#1E1E1E] min-w-[100px] text-right">
                      ${(item.amount / 1000).toFixed(0)}k
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Employee Table */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <h3 className="text-[#1E1E1E] mb-4">Employee Results</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Employee ID</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Name</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Total Compensation</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Delta vs Base</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeData.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-100 hover:bg-[#EEF2F8] transition-colors">
                      <td className="py-3 px-4 text-sm text-[#1E1E1E]">{emp.id}</td>
                      <td className="py-3 px-4 text-sm text-[#1E1E1E]">{emp.name}</td>
                      <td className="py-3 px-4 text-sm text-[#1E1E1E] text-right">
                        ${emp.total.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <span className="text-green-600">+${emp.delta.toLocaleString()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!hasData && (
        <Card className="p-12 bg-white rounded-xl shadow-sm border-0">
          <div className="text-center">
            <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-[#1E1E1E] mb-2">No Data Loaded</h3>
            <p className="text-gray-600 mb-6">
              Upload a CSV file or select a segment to run a bulk simulation
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
