import { useState } from 'react';
import { Plus, Save, CheckCircle, AlertCircle, Upload, List, Network } from 'lucide-react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import ComponentsGraph from './ComponentsGraph';

export default function RuleBuilder() {
  const [selectedComponent, setSelectedComponent] = useState<string | null>('base-salary');

  const components = [
    { id: 'base-salary', name: 'Base Salary', group: 'core', status: 'valid' },
    { id: 'bonus', name: 'Performance Bonus', group: 'bonus', status: 'valid' },
    { id: 'pension', name: 'Pension Contribution', group: 'pension', status: 'error' },
    { id: 'health', name: 'Health Insurance', group: 'benefits', status: 'valid' },
    { id: 'stock', name: 'Stock Options', group: 'equity', status: 'valid' },
    { id: 'overtime', name: 'Overtime Pay', group: 'core', status: 'valid' },
    { id: 'commission', name: 'Commission', group: 'bonus', status: 'warning' },
  ];

  const validationResults = [
    { type: 'error', message: 'Circular dependency detected: Pension → Bonus → Base' },
    { type: 'warning', message: 'Expression uses deprecated function "oldCalc()"' },
  ];

  const groupColors: Record<string, string> = {
    core: 'bg-blue-100 text-blue-800',
    bonus: 'bg-green-100 text-green-800',
    pension: 'bg-purple-100 text-purple-800',
    benefits: 'bg-orange-100 text-orange-800',
    equity: 'bg-pink-100 text-pink-800',
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <h1 className="text-[#1E1E1E] mb-6">Rules</h1>

      <Tabs defaultValue="builder" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="builder" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Rule Builder
          </TabsTrigger>
          <TabsTrigger value="graph" className="flex items-center gap-2">
            <Network className="w-4 h-4" />
            Components Graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[#1E1E1E]">Rule Builder</h2>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
            <Save className="w-5 h-5" />
            Save Draft
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-white text-[#0052CC] border border-[#0052CC] rounded-xl hover:bg-[#EEF2F8] transition-colors">
            <CheckCircle className="w-5 h-5" />
            Validate
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors">
            <Upload className="w-5 h-5" />
            Publish
          </button>
        </div>
      </div>

      {/* Ruleset Selector */}
      <Card className="p-4 bg-white rounded-xl shadow-sm border-0 mb-6">
        <div className="flex items-center gap-4">
          <Label htmlFor="ruleset" className="min-w-[100px]">Active Ruleset</Label>
          <Select defaultValue="2024">
            <SelectTrigger id="ruleset" className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024 Annual Rules (Active)</SelectItem>
              <SelectItem value="q4">Q4 2024 Bonus (Draft)</SelectItem>
              <SelectItem value="2025">2025 Preview (Draft)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Components List */}
        <div className="lg:col-span-1">
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#1E1E1E]">Components</h3>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Plus className="w-5 h-5 text-[#0052CC]" />
              </button>
            </div>
            <div className="space-y-2">
              {components.map((component) => (
                <div
                  key={component.id}
                  onClick={() => setSelectedComponent(component.id)}
                  className={`p-4 rounded-lg cursor-pointer transition-colors ${
                    selectedComponent === component.id
                      ? 'bg-[#0052CC] text-white'
                      : 'bg-[#EEF2F8] hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={selectedComponent === component.id ? 'text-white' : 'text-[#1E1E1E]'}>
                      {component.name}
                    </div>
                    {getStatusIcon(component.status)}
                  </div>
                  <Badge className={selectedComponent === component.id ? 'bg-white bg-opacity-20 text-white' : groupColors[component.group]}>
                    {component.group}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right - Rule Editor */}
        <div className="lg:col-span-2">
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <h3 className="text-[#1E1E1E] mb-6">Rule Editor</h3>

            <div className="space-y-6">
              {/* Target */}
              <div>
                <Label htmlFor="target">Target Component</Label>
                <Input
                  id="target"
                  placeholder="e.g., BaseSalary"
                  defaultValue="Base Salary"
                  className="mt-1"
                />
              </div>

              {/* Expression Editor */}
              <div>
                <Label htmlFor="expression">Expression</Label>
                <Textarea
                  id="expression"
                  placeholder="e.g., input.baseSalary * 1.05"
                  defaultValue="input.baseSalary"
                  className="mt-1 font-mono h-32"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Use syntax: input.field, otherComponent, functions like sum(), max()
                </p>
              </div>

              {/* Dependencies */}
              <div>
                <Label htmlFor="depends">Depends On</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-[#0052CC] text-white px-3 py-1">input.baseSalary</Badge>
                  <button className="px-3 py-1 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50">
                    + Add dependency
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="taxable">Taxable</Label>
                  <Switch id="taxable" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="group-switch">Include in Group</Label>
                  <Switch id="group-switch" />
                </div>
              </div>

              {/* Effective Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="effectiveFrom">Effective From</Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    defaultValue="2024-01-01"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="effectiveTo">Effective To</Label>
                  <Input
                    id="effectiveTo"
                    type="date"
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Validation Results */}
              <div>
                <h4 className="text-[#1E1E1E] mb-3">Validation Results</h4>
                <div className="space-y-2">
                  {validationResults.map((result, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        result.type === 'error'
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}
                    >
                      <AlertCircle
                        className={`w-5 h-5 mt-0.5 ${
                          result.type === 'error' ? 'text-red-600' : 'text-yellow-600'
                        }`}
                      />
                      <div className="flex-1 text-sm text-[#1E1E1E]">{result.message}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button className="flex-1 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button className="flex-1 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors">
                  Save Rule
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="graph">
          <ComponentsGraph />
        </TabsContent>
      </Tabs>
    </div>
  );
}
