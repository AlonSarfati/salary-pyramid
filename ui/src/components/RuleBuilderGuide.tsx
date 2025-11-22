import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CheckCircle, AlertCircle, Info, Code, Zap, Calculator, Table, Lightbulb } from 'lucide-react';

// No helper needed - components are now CamelCase identifiers

export default function RuleBuilderGuide() {
  return (
    <div className="w-full space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E1E1E] mb-2">How to Build Rules</h1>
        <p className="text-base text-gray-600">
          Learn how to create powerful salary calculation rules using our expression system.
        </p>
      </div>

      <Tabs defaultValue="basics" className="w-full">
        <div className="mb-6 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="basics" className="py-2 px-3 text-sm">Basics</TabsTrigger>
            <TabsTrigger value="expressions" className="py-2 px-3 text-sm">Expressions</TabsTrigger>
            <TabsTrigger value="functions" className="py-2 px-3 text-sm">Functions</TabsTrigger>
            <TabsTrigger value="examples" className="py-2 px-3 text-sm">Examples</TabsTrigger>
            <TabsTrigger value="best-practices" className="py-2 px-3 text-sm">Best Practices</TabsTrigger>
            <TabsTrigger value="troubleshooting" className="py-2 px-3 text-sm">Troubleshooting</TabsTrigger>
          </TabsList>
        </div>

        {/* Basics Tab */}
        <TabsContent value="basics" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
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

          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-6 h-6 text-[#0052CC]" />
              Quick Start
            </h2>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Choose a Target Component</h3>
                    <p className="text-gray-700 text-sm">
                      Enter the name of the component you want to calculate (e.g., "Performance Bonus", "Pension Contribution").
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Write Your Expression</h3>
                    <p className="text-gray-700 text-sm">
                      Use our expression syntax to define how the component is calculated. You can reference other components using CamelCase names (e.g., <code className="bg-gray-100 px-1 rounded">BaseSalary</code>, <code className="bg-gray-100 px-1 rounded">PerformanceBonus</code>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Set Dependencies</h3>
                    <p className="text-gray-700 text-sm">
                      Specify which other components this rule depends on. The system will calculate them in the correct order.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Validate & Save</h3>
                    <p className="text-gray-700 text-sm">
                      Click "Validate" to check for errors, then "Save Draft" to save your rule. When ready, "Publish" to make it active.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Expressions Tab */}
        <TabsContent value="expressions" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
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

        {/* Functions Tab */}
        <TabsContent value="functions" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
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
                    {'MIN(${Base}, ${Cap})'}
                  </div>
                  <div className="text-xs text-gray-600">Returns the smaller of Base or Cap</div>
                  <div className="font-mono text-sm mt-3 mb-2 text-gray-800">
                    {'MIN(MAX(${Base} * 0.20, 5000), 10000)'}
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

        {/* Examples Tab */}
        <TabsContent value="examples" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Real-World Examples</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-[#0052CC]">Performance Bonus with Cap</h3>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm mb-2">
                  MIN(MAX(BaseSalary * PerformanceRating / 100, 0), BaseSalary * 0.25)
                </div>
                <p className="text-sm text-gray-600">
                  Calculates bonus as percentage of base salary, ensures it's not negative, and caps it at 25% of base.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2 text-[#0052CC]">Pension with Minimum</h3>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm mb-2">
                  MAX(BaseSalary * 0.08, 2000)
                </div>
                <p className="text-sm text-gray-600">
                  Calculates 8% of base salary, but ensures minimum contribution of 2000.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2 text-[#0052CC]">Conditional Health Insurance</h3>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm mb-2">
                  IF HasFamily = 1 THEN 1500 ELSE 800
                </div>
                <p className="text-sm text-gray-600">
                  Different rates for employees with and without families.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2 text-[#0052CC]">Overtime Calculation</h3>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm mb-2">
                  IF Hours {'>'} 40 THEN (Hours - 40) * Rate * 1.5 ELSE 0
                </div>
                <p className="text-sm text-gray-600">
                  Calculates overtime pay at 1.5x rate for hours over 40.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2 text-[#0052CC]">Tiered Commission</h3>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm mb-2">
                  IF Sales {'>='} 100000 THEN Sales * 0.10 ELSE IF Sales {'>='} 50000 THEN Sales * 0.07 ELSE Sales * 0.05
                </div>
                <p className="text-sm text-gray-600">
                  Different commission rates based on sales tiers.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2 text-[#0052CC]">Complex Conditional</h3>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm mb-2">
                  IF (BaseSalary {'>'} 50000 AND PerformanceRating {'>'} 80) OR IsManager = 1 THEN MIN(MAX(BaseSalary * 0.20, 5000), 10000) ELSE BaseSalary * 0.10
                </div>
                <p className="text-sm text-gray-600">
                  Combines multiple conditions with logical operators and clamps the result.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Best Practices Tab */}
        <TabsContent value="best-practices" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Best Practices</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Use Clear Component Names</h3>
                  <p className="text-gray-700 text-sm">
                    Choose descriptive names like "Performance Bonus" instead of "PB". This makes your rules easier to understand and maintain.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Always Specify Dependencies</h3>
                  <p className="text-gray-700 text-sm">
                    Explicitly list all components your rule depends on. This helps the system calculate them in the correct order and prevents circular dependencies.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Use Groups to Organize</h3>
                  <p className="text-gray-700 text-sm">
                    Assign components to groups (core, bonus, pension, benefits, equity) to keep related rules together.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Validate Before Publishing</h3>
                  <p className="text-gray-700 text-sm">
                    Always click "Validate" to check for errors, circular dependencies, and unknown variables before publishing your ruleset.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Use Effective Dates</h3>
                  <p className="text-gray-700 text-sm">
                    Set effective dates to control when rules are active. This allows you to plan rule changes in advance.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Test with Sample Data</h3>
                  <p className="text-gray-700 text-sm">
                    Use the Simulation page to test your rules with sample employee data before publishing.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Keep Expressions Simple</h3>
                  <p className="text-gray-700 text-sm">
                    Break complex calculations into multiple rules when possible. This makes them easier to understand and debug.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Troubleshooting Tab */}
        <TabsContent value="troubleshooting" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Common Issues & Solutions</h2>
            <div className="space-y-6">
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Circular Dependency
                </h3>
                <p className="text-gray-700 text-sm mb-2">
                  <strong>Error:</strong> "Circular dependency detected: ComponentA → ComponentB → ComponentA"
                </p>
                <p className="text-gray-700 text-sm">
                  <strong>Solution:</strong> Review your dependencies. ComponentA depends on ComponentB, which depends on ComponentA. Break the cycle by removing one dependency or restructuring your rules.
                </p>
              </div>

              <div className="border-l-4 border-yellow-500 pl-4">
                <h3 className="font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Unknown Variable
                </h3>
                <p className="text-gray-700 text-sm mb-2">
                  <strong>Error:</strong> "Unknown component: ComponentName"
                </p>
                <p className="text-gray-700 text-sm">
                  <strong>Solution:</strong> Check the spelling of your component reference. Make sure the component exists and is spelled exactly as it appears in other rules (case-sensitive).
                </p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Parse Error
                </h3>
                <p className="text-gray-700 text-sm mb-2">
                  <strong>Error:</strong> "Parse error: Unexpected character at position X"
                </p>
                <p className="text-gray-700 text-sm">
                  <strong>Solution:</strong> Check your expression syntax. Common issues:
                </p>
                <ul className="list-disc list-inside mt-2 text-sm text-gray-700 space-y-1">
                  <li>Missing closing parentheses</li>
                  <li>Incorrect operator syntax (use = not ==)</li>
                  <li>Missing quotes around table names in TBL()</li>
                  <li>Spaces in component names (use underscores or quotes)</li>
                </ul>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Expression Returns Zero
                </h3>
                <p className="text-gray-700 text-sm mb-2">
                  <strong>Issue:</strong> Your rule always calculates to 0
                </p>
                <p className="text-gray-700 text-sm">
                  <strong>Solution:</strong> Check your conditions. Make sure:
                </p>
                <ul className="list-disc list-inside mt-2 text-sm text-gray-700 space-y-1">
                  <li>Comparison operators are correct (&gt; vs &gt;=)</li>
                  <li>Component values exist and are not null</li>
                  <li>IF conditions evaluate to true when expected</li>
                  <li>Division by zero is not occurring</li>
                </ul>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Need More Help?</h3>
                <p className="text-blue-800 text-sm">
                  If you're still having issues, try:
                </p>
                <ul className="list-disc list-inside mt-2 text-sm text-blue-800 space-y-1">
                  <li>Use the Validate button to see detailed error messages</li>
                  <li>Test your expression with simple values first</li>
                  <li>Break complex expressions into smaller parts</li>
                  <li>Check the Examples tab for similar use cases</li>
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

