import { useEffect, useMemo, useState } from "react";
import { Play, Save, Info, User, Users } from "lucide-react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import SimulateBulk from "./SimulateBulk";
import { getActiveRuleset } from "../services/rulesetsService";

// טיפוס עזר: אנחנו לא מנחשים את הצורה — שומרים הכל ב־ruleset,
// אבל בשביל ה-Select ננרמל לשדות value/label בלבד.
type RuleOption = { value: string; label: string };

export default function SimulateSingle({ tenantId = "default" }: { tenantId?: string }) {
  // ---- states ----
  const [showTrace, setShowTrace] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string>("");
  const [hasRun, setHasRun] = useState(false);

  // פה נשמור את **כל** מה שה-API מחזיר (לפי הדרישה שלך)
  const [ruleset, setRuleset] = useState<any>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string>("");

  // ---- demo data (נשאר כמו שהיה) ----
  const employees = [
    { id: "E001", name: "John Doe" },
    { id: "E002", name: "Jane Smith" },
    { id: "E003", name: "Mike Johnson" },
  ];

  const results = [
    { component: "Base Salary", expression: "input.baseSalary", amount: 85000, contribution: 68.5 },
    { component: "Performance Bonus", expression: "baseSalary * 0.15", amount: 12750, contribution: 10.3 },
    { component: "Pension Contribution", expression: "baseSalary * 0.08", amount: 6800, contribution: 5.5 },
    { component: "Health Insurance", expression: "fixed(1200)", amount: 1200, contribution: 1.0 },
    { component: "Stock Options", expression: "baseSalary * 0.12", amount: 10200, contribution: 8.2 },
    { component: "Overtime Pay", expression: "input.hours * input.rate * 1.5", amount: 4500, contribution: 3.6 },
    { component: "Commission", expression: "input.sales * 0.03", amount: 3600, contribution: 2.9 },
  ];

  const totalAmount = results.reduce((sum, r) => sum + r.amount, 0);

  const traceData = [
    { step: 1, component: "Base Salary", value: 85000, calculation: "input.baseSalary = 85000" },
    { step: 2, component: "Performance Bonus", value: 12750, calculation: "85000 * 0.15 = 12750" },
    { step: 3, component: "Total Compensation", value: totalAmount, calculation: "sum(all components)" },
  ];

  // ---- fetch active ruleset from API ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setRulesLoading(true);
        setRulesError("");
        const data = await getActiveRuleset(tenantId);
        if (!cancelled) setRuleset(data);
        console.log("data",data) // ✅ שומר את כל התגובה בדיוק כפי שהיא
      } catch (e) {
        if (!cancelled) setRulesError("שגיאה בטעינת ה-ruleset הפעיל");
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // ---- normalize for the Select UI only ----
  // תומך בכל אחד מהמבנים:
  // 1) ["2024 Annual Rules", "Q4 2024 Bonus"]
  // 2) [{ id, name }, { id, title } ...]
  // 3) אובייקט שמכיל שדה כמו rules או items => נזהה אוטומטית מערך בפנים
  const rulesetOptions: RuleOption[] = useMemo(() => {
    if (!ruleset) return [];

    const toOptions = (arr: any[]): RuleOption[] =>
      arr
        .map((x) => {
          if (typeof x === "string") return { value: x, label: x };
          if (x && typeof x === "object") {
            const value = (x.id ?? x.value ?? x.key ?? x.name ?? x.title ?? JSON.stringify(x)).toString();
            const label = (x.name ?? x.title ?? x.label ?? value).toString();
            return { value, label };
          }
          return null;
        })
        .filter(Boolean) as RuleOption[];

    if (Array.isArray(ruleset)) return toOptions(ruleset);

    // חיפוש אוטומטי אחרי מערך ראשון משמעותי בתוך האובייקט
    const candidateArray =
      Object.values(ruleset).find((v) => Array.isArray(v) && (v as any[]).length > 0) ?? null;

    if (candidateArray) return toOptions(candidateArray as any[]);
    return [];
  }, [ruleset]);

  const handleRun = () => setHasRun(true);

  const handleShowTrace = (component: string) => {
    setSelectedComponent(component);
    setShowTrace(true);
    // אפשר כאן להוסיף בקשת GET ל-trace אם יש לך endpoint מתאים
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <h1 className="text-[#1E1E1E] mb-6">Simulate</h1>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Single Employee
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Bulk / Segment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[#1E1E1E]">Single Employee Simulation</h2>
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-[#0052CC] border border-[#0052CC] rounded-xl hover:bg-[#EEF2F8] transition-colors">
              <Save className="w-5 h-5" />
              Save Scenario
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Input Form */}
            <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
              <h3 className="text-[#1E1E1E] mb-6">Input Parameters</h3>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="employee">Employee ID</Label>
                  <Select>
                    <SelectTrigger id="employee" className="mt-1">
                      <SelectValue placeholder="Select employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.id} - {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="baseSalary">Base Salary</Label>
                  <Input id="baseSalary" type="number" placeholder="85000" defaultValue="85000" className="mt-1" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hours">Hours</Label>
                    <Input id="hours" type="number" placeholder="160" defaultValue="160" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="rate">Rate</Label>
                    <Input id="rate" type="number" placeholder="50" defaultValue="50" className="mt-1" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="extras">Extras</Label>
                  <Input id="extras" type="number" placeholder="0" defaultValue="0" className="mt-1" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="periodFrom">Period From</Label>
                    <Input id="periodFrom" type="date" defaultValue="2024-11-01" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="periodTo">Period To</Label>
                    <Input id="periodTo" type="date" defaultValue="2024-11-30" className="mt-1" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="ruleset">Ruleset</Label>
                  <div className="mt-1">
                    {rulesLoading ? (
                      <div className="text-sm text-gray-500">Loading ruleset…</div>
                    ) : rulesError ? (
                      <div className="text-sm text-red-600">{rulesError}</div>
                    ) : rulesetOptions.length === 0 ? (
                      <div className="text-sm text-gray-500">No rulesets</div>
                    ) : (
                      <Select>
                        <SelectTrigger id="ruleset">
                          <SelectValue placeholder="Select ruleset..." />
                        </SelectTrigger>
                        <SelectContent>
                          {rulesetOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleRun}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors mt-6"
                >
                  <Play className="w-5 h-5" />
                  Run Simulation
                </button>
              </div>
            </Card>

            {/* Right Panel - Results */}
            <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
              <h3 className="text-[#1E1E1E] mb-6">Results</h3>

              {!hasRun ? (
                <div className="flex items-center justify-center h-64 text-gray-500">Run a simulation to see results</div>
              ) : (
                <>
                  <div className="space-y-2 mb-6">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-[#EEF2F8] rounded-lg text-sm text-gray-600">
                      <div className="col-span-4">Component</div>
                      <div className="col-span-3">Expression</div>
                      <div className="col-span-2 text-right">Amount</div>
                      <div className="col-span-2 text-right">Contrib %</div>
                      <div className="col-span-1"></div>
                    </div>

                    {/* Table Rows */}
                    {results.map((result, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="col-span-4 text-[#1E1E1E]">{result.component}</div>
                        <div className="col-span-3 text-gray-600 text-sm font-mono">{result.expression}</div>
                        <div className="col-span-2 text-right text-[#1E1E1E]">${result.amount.toLocaleString()}</div>
                        <div className="col-span-2 text-right text-gray-600">{result.contribution}%</div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => handleShowTrace(result.component)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Info className="w-4 h-4 text-[#0052CC]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Card */}
                  <Card className="p-4 bg-[#0052CC] text-white rounded-xl border-0 shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm opacity-90">Total Compensation</div>
                        <div className="text-2xl mt-1">${totalAmount.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm opacity-90">Period</div>
                        <div className="mt-1">Nov 2024</div>
                      </div>
                    </div>
                  </Card>
                </>
              )}
            </Card>
          </div>

          {/* Trace Drawer */}
          <Sheet open={showTrace} onOpenChange={setShowTrace}>
            <SheetContent className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Calculation Trace: {selectedComponent}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {traceData.map((trace) => (
                  <Card key={trace.step} className="p-4 bg-[#EEF2F8] border-0">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-[#0052CC] text-white rounded-full flex items-center justify-center flex-shrink-0">
                        {trace.step}
                      </div>
                      <div className="flex-1">
                        <div className="text-[#1E1E1E]">{trace.component}</div>
                        <div className="text-sm text-gray-600 font-mono mt-1">{trace.calculation}</div>
                        <div className="text-[#0052CC] mt-2">${trace.value.toLocaleString()}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="bulk">
          <SimulateBulk />
        </TabsContent>
      </Tabs>
    </div>
  );
}
