import React, { useEffect, useState } from 'react';
import { getActiveRuleset, simulateEmployee } from '../apiClient';

export default function SimulateHookup() {
  const [rulesetId, setRulesetId] = useState<string|null>(null);
  const [base, setBase] = useState(10000);
  const [hours, setHours] = useState(0);
  const [result, setResult] = useState<{components:Record<string,number>, total:number} | null>(null);
  const [err, setErr] = useState<string|null>(null);

  useEffect(() => {
    getActiveRuleset('default').then(x => setRulesetId(x.rulesetId)).catch(e => setErr(String(e)));
  }, []);

  async function onRun(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const out = await simulateEmployee({ rulesetId, employee: { id:'E1', base, hours } });
      setResult(out);
    } catch (e:any) {
      setErr(e.message ?? String(e));
    }
  }

  return (
    <div style={{padding:16, maxWidth:520}}>
      <h3>Single Employee Simulation</h3>
      <form onSubmit={onRun} style={{display:'grid', gap:8}}>
        <label>Base <input type="number" value={base} onChange={e=>setBase(Number(e.target.value))} /></label>
        <label>Hours <input type="number" value={hours} onChange={e=>setHours(Number(e.target.value))} /></label>
        <button type="submit">Run</button>
      </form>

      {err && <div style={{color:'red', marginTop:8}}>Error: {err}</div>}

      {result && (
        <div style={{marginTop:12}}>
          <div><b>Total:</b> {result.total}</div>
          <table border={1} cellPadding={6} style={{marginTop:8, width:'100%'}}>
            <thead><tr><th>Component</th><th>Amount</th></tr></thead>
            <tbody>
              {Object.entries(result.components).map(([k,v]) => (
                <tr key={k}><td>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
