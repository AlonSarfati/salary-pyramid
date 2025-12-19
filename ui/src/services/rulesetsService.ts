import axios from "axios";

const API_BASE = "/api";

export async function getActiveRuleset(tenantId: string) {
  const url = `${API_BASE}/rulesets/${tenantId}/active`;
  const res = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  });
  console.log("res",res);
  return res.data; // נשמור בדיוק כפי שמגיע מהשרת
}