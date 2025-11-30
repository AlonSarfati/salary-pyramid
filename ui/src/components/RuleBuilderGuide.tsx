import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CheckCircle, AlertCircle, Info, Code, Zap, Calculator, Table, Lightbulb } from 'lucide-react';

// No helper needed - components are now CamelCase identifiers

export default function RuleBuilderGuide() {
  return (
    <div className="w-full space-y-4">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Learn how to create powerful salary calculation rules using our expression system.
        </p>
      </div>

      <Tabs defaultValue="basics" className="w-full">
        <div className="mb-4 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="basics" className="py-1.5 px-2 text-xs">Basics</TabsTrigger>
            <TabsTrigger value="expressions" className="py-1.5 px-2 text-xs">Expressions</TabsTrigger>
            <TabsTrigger value="groups" className="py-1.5 px-2 text-xs">Groups</TabsTrigger>
            <TabsTrigger value="functions" className="py-1.5 px-2 text-xs">Functions</TabsTrigger>
          </TabsList>
        </div>

        {/* Basics Tab */}
        <TabsContent value="basics" className="space-y-3">
          <Card className="p-3">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-[#0052CC]" />
              Understanding Rules
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">What is a Rule?</h3>
                <p className="text-gray-700">
                  A rule defines how to calculate a salary component (like "Performance Bonus" or "Pension Contribution"). 
                  Each rule has:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
                  <li><strong>Target:</strong> The name of the component being calculated</li>
                  <li><strong>Expression:</strong> The formula that calculates the value</li>
                  <li><strong>Dependencies:</strong> Other components or inputs this rule depends on</li>
                </ul>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900 mb-1">Example Rule</p>
                    <p className="text-blue-800 text-sm">
                      <strong>Target:</strong> "Performance Bonus"<br />
                      <strong>Expression:</strong> BaseSalary * 0.15<br />
                      <strong>Dependencies:</strong> BaseSalary
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#0052CC]" />
              Quick Start
            </h2>
            <div className="space-y-2">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-xs">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">Choose a Target Component</h3>
                    <p className="text-gray-700 text-xs">
                      Enter the name of the component you want to calculate (e.g., "Performance Bonus", "Pension Contribution").
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-xs">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">Write Your Expression</h3>
                    <p className="text-gray-700 text-xs">
                      Use our expression syntax to define how the component is calculated. You can reference other components using CamelCase names (e.g., <code className="bg-gray-100 px-1 rounded">BaseSalary</code>, <code className="bg-gray-100 px-1 rounded">PerformanceBonus</code>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-xs">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">Set Dependencies</h3>
                    <p className="text-gray-700 text-xs">
                      Specify which other components this rule depends on. The system will calculate them in the correct order.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-xs">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">Save as Draft</h3>
                    <p className="text-gray-700 text-xs">
                      Click the save icon next to the component to save it as a draft. Drafts are marked with a "Draft" badge and persist until you publish.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-xs">
                    5
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">Validate & Publish</h3>
                    <p className="text-gray-700 text-xs">
                      Click "Validate" to check for errors. When ready, "Publish" to make all drafts active and remove draft markers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#0052CC]" />
              Helpful Features
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">Calculation Tracing</h3>
                <p className="text-gray-700 text-xs mb-2">
                  When running a simulation, click the <code className="bg-gray-100 px-1 rounded">ℹ️</code> icon next to any component 
                  to see a detailed step-by-step breakdown of how it was calculated.
                </p>
                <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
                  The trace shows: the expression, all dependencies, and each calculation step with intermediate results.
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Draft System</h3>
                <p className="text-gray-700 text-xs mb-2">
                  Save components as drafts to test changes without affecting the live ruleset. Drafts are clearly marked 
                  and persist until you publish.
                </p>
                <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
                  Use drafts to experiment safely. When ready, publish all changes at once to make them active.
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Expressions Tab */}
        <TabsContent value="expressions" className="space-y-3">
          <Card className="p-3">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Code className="w-6 h-6 text-[#0052CC]" />
              Expression Syntax
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Component References</h3>
                <p className="text-gray-700 mb-3">
                  Reference other components using <strong>CamelCase</strong> names:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
                  <div className="mb-2"><span className="text-green-600">✓</span> <span className="text-gray-600">BaseSalary</span> - References the "BaseSalary" component</div>
                  <div className="mb-2"><span className="text-green-600">✓</span> <span className="text-gray-600">PerformanceBonus</span> - References "PerformanceBonus" component</div>
                  <div className="mb-2"><span className="text-green-600">✓</span> <span className="text-gray-600">YearsOfService</span> - References "YearsOfService" component</div>
                  <div className="mt-3 pt-3 border-t border-gray-300"><span className="text-red-600">✗</span> <span className="text-gray-400">base_salary</span> - Must be CamelCase (not snake_case)</div>
                  <div><span className="text-red-600">✗</span> <span className="text-gray-400">BASESALARY</span> - Must be CamelCase (not ALL_CAPS, which are functions)</div>
                </div>
                <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-blue-900 mb-1">Group References</p>
                      <p className="text-blue-800 text-sm">
                        You can also reference entire groups using <code className="bg-blue-100 px-1 rounded">group1</code>, <code className="bg-blue-100 px-1 rounded">group2</code>, etc. 
                        Groups automatically sum all components within them. See the <strong>Groups</strong> tab for details.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Arithmetic Operators</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2">BaseSalary + Bonus</div>
                    <div className="text-xs text-gray-600">Addition</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2">BaseSalary - Deduction</div>
                    <div className="text-xs text-gray-600">Subtraction</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2">BaseSalary * 0.15</div>
                    <div className="text-xs text-gray-600">Multiplication</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2">TotalCompensation / 12</div>
                    <div className="text-xs text-gray-600">Division</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Comparison Operators</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-mono text-xs mb-1">BaseSalary {'>'} 50000</div>
                    <div className="text-xs text-gray-600">Greater than</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-mono text-xs mb-1">BaseSalary {'>='} 50000</div>
                    <div className="text-xs text-gray-600">Greater or equal</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-mono text-xs mb-1">BaseSalary {'<'} 100000</div>
                    <div className="text-xs text-gray-600">Less than</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-mono text-xs mb-1">BaseSalary {'<='} 100000</div>
                    <div className="text-xs text-gray-600">Less or equal</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-mono text-xs mb-1">BaseSalary = 50000</div>
                    <div className="text-xs text-gray-600">Equals</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-mono text-xs mb-1">BaseSalary != 0</div>
                    <div className="text-xs text-gray-600">Not equals</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Logical Operators</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="font-mono text-sm">
                    <span className="text-gray-600">BaseSalary {'>'} 50000</span> <span className="text-[#0052CC] font-semibold"> AND </span> <span className="text-gray-600">PerformanceRating {'>'} 80</span>
                  </div>
                  <div className="text-xs text-gray-600">Both conditions must be true</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 mt-2">
                  <div className="font-mono text-sm">
                    <span className="text-gray-600">BaseSalary {'>'} 100000</span> <span className="text-[#0052CC] font-semibold"> OR </span> <span className="text-gray-600">YearsOfService {'>='} 10</span>
                  </div>
                  <div className="text-xs text-gray-600">Either condition can be true</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 mt-2">
                  <div className="font-mono text-sm">
                    <span className="text-[#0052CC] font-semibold">NOT </span> <span className="text-gray-600">IsExempt</span>
                  </div>
                  <div className="text-xs text-gray-600">Negates the condition</div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-3">
          <Card className="p-3">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Table className="w-6 h-6 text-[#0052CC]" />
              Component Groups
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">What are Groups?</h3>
                <p className="text-gray-700 mb-3">
                  Groups organize components into logical categories (e.g., "core", "bonus", "extra hours", "expenses"). 
                  Each group is automatically assigned a number (<code className="bg-gray-100 px-1 rounded">group1</code>, <code className="bg-gray-100 px-1 rounded">group2</code>, etc.) 
                  based on alphabetical order.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-blue-900 mb-1">Example</p>
                      <p className="text-blue-800 text-sm">
                        If you have groups: "bonus", "core", "expenses"<br />
                        They become: <code className="bg-blue-100 px-1 rounded">group1</code> (bonus), <code className="bg-blue-100 px-1 rounded">group2</code> (core), <code className="bg-blue-100 px-1 rounded">group3</code> (expenses)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Using Groups in Expressions</h3>
                <p className="text-gray-700 mb-3">
                  You can reference a group name in your expressions, and it will automatically sum all components in that group:
                </p>
                <div className="space-y-3">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      group1
                    </div>
                    <div className="text-xs text-gray-600">Sums all components in group1</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      group1 + group2
                    </div>
                    <div className="text-xs text-gray-600">Sums components from both groups</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      BaseSalary + group1
                    </div>
                    <div className="text-xs text-gray-600">Adds BaseSalary to the sum of group1</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Group Hierarchy & Restrictions</h3>
                <p className="text-gray-700 mb-3">
                  Groups are numbered sequentially to prevent circular dependencies. Components in a group can only reference:
                </p>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-yellow-900 mb-2">Important Rules:</p>
                      <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm">
                        <li>Components in <code className="bg-yellow-100 px-1 rounded">group1</code> can only reference <code className="bg-yellow-100 px-1 rounded">group1</code></li>
                        <li>Components in <code className="bg-yellow-100 px-1 rounded">group2</code> can reference <code className="bg-yellow-100 px-1 rounded">group1</code> and <code className="bg-yellow-100 px-1 rounded">group2</code></li>
                        <li>Components in <code className="bg-yellow-100 px-1 rounded">group3</code> can reference <code className="bg-yellow-100 px-1 rounded">group1</code>, <code className="bg-yellow-100 px-1 rounded">group2</code>, and <code className="bg-yellow-100 px-1 rounded">group3</code></li>
                        <li>Components cannot reference groups with higher numbers (prevents circular dependencies)</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      <span className="text-green-600">✓</span> Component in group2: <code>BaseSalary + group1</code>
                    </div>
                    <div className="text-xs text-gray-600">Allowed: group2 can reference group1</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      <span className="text-red-600">✗</span> Component in group1: <code>BaseSalary + group2</code>
                    </div>
                    <div className="text-xs text-gray-600">Not allowed: group1 cannot reference group2</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Setting Component Groups</h3>
                <p className="text-gray-700 mb-3">
                  When creating or editing a component, select its group from the dropdown. The group determines:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 mb-3">
                  <li>Which other groups the component can reference</li>
                  <li>How the component is organized in the component graph</li>
                  <li>How the component appears in breakdowns and reports</li>
                </ul>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Tip:</strong> Organize your components logically. Put foundational components (like BaseSalary) 
                    in earlier groups (group1, group2) and derived components (like bonuses based on totals) in later groups.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Functions Tab */}
        <TabsContent value="functions" className="space-y-3">
          <Card className="p-3">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-[#0052CC]" />
              Built-in Functions
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">IF</Badge>
                  Conditional Logic
                </h3>
                <p className="text-gray-700 mb-3">
                  Use IF to create conditional calculations. Two syntaxes are supported:
                </p>
                <div className="space-y-3">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      IF(BaseSalary {'>'} 50000, BaseSalary * 0.15, BaseSalary * 0.10)
                    </div>
                    <div className="text-xs text-gray-600">Function syntax: IF(condition, trueValue, falseValue)</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      IF BaseSalary {'>'} 50000 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10
                    </div>
                    <div className="text-xs text-gray-600">Natural language syntax (converted to IF function)</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800">MIN</Badge>
                  Minimum Value
                </h3>
                <p className="text-gray-700 mb-3">
                  Returns the smallest value from the arguments:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="font-mono text-sm mb-2 text-gray-800">
                    MIN(BaseSalary, 100000)
                  </div>
                  <div className="text-xs text-gray-600">Returns the smaller of BaseSalary or 100000</div>
                  <div className="font-mono text-sm mt-3 mb-2 text-gray-800">
                    MIN(MAX(BaseSalary * 0.20, 5000), 10000)
                  </div>
                  <div className="text-xs text-gray-600">Clamps value between 5000 and 10000</div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-800">MAX</Badge>
                  Maximum Value
                </h3>
                <p className="text-gray-700 mb-3">
                  Returns the largest value from the arguments:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="font-mono text-sm mb-2 text-gray-800">
                    MAX(BaseSalary * 0.08, 2000)
                  </div>
                  <div className="text-xs text-gray-600">Ensures minimum of 2000 (pension example)</div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge className="bg-orange-100 text-orange-800">ROUND</Badge>
                  Rounding
                </h3>
                <p className="text-gray-700 mb-3">
                  Rounds numbers to specified precision:
                </p>
                <div className="space-y-2">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      ROUND(Amount)
                    </div>
                    <div className="text-xs text-gray-600">Rounds to nearest integer</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      ROUND(Amount, 2)
                    </div>
                    <div className="text-xs text-gray-600">Rounds to 2 decimal places</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge className="bg-pink-100 text-pink-800">TBL</Badge>
                  Table Lookup
                </h3>
                <p className="text-gray-700 mb-3">
                  Look up values from predefined tables:
                </p>
                <div className="space-y-2">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      TBL("bonus_table", YearsOfService)
                    </div>
                    <div className="text-xs text-gray-600">Simple lookup with one key</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-mono text-sm mb-2 text-gray-800">
                      TBL("salary_bands", Grade, Level)
                    </div>
                    <div className="text-xs text-gray-600">Lookup with multiple keys</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

