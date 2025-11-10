const API = '/api'; // goes through the Vite proxy

export type Period = { from?: string; to?: string };
export type EmployeeInput = {
  id: string; base?: number; hours?: number; rate?: number;
  extra?: Record<string, number>;
};

export async function getActiveRuleset(tenantId='default'):
  Promise<{tenantId:string; rulesetId:string; count:number}> {
  const r = await fetch(`${API}/rulesets/${tenantId}/active`);
  if (!r.ok) throw new Error(`active ruleset failed ${r.status}`);
  return r.json();
}

export async function simulateEmployee(args: {
  tenantId?: string; rulesetId?: string|null; period?: Period; employee: EmployeeInput;
}): Promise<{components: Record<string, number>; total: number}> {
  const body = {
    tenantId: args.tenantId ?? 'default',
    rulesetId: args.rulesetId ?? null,              // null => use ACTIVE
    period: args.period ?? { from: '2025-01-01', to: '2025-01-31' },
    employee: args.employee
  };
  const r = await fetch(`${API}/simulate/employee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`simulate failed ${r.status}`);
  return r.json();
}
