import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ruleAssistantApi, ruleApi, type ProposedRuleDto, type RuleAssistantResponse } from '../services/apiService';
import { useToast } from "./ToastProvider";

interface AIRuleAssistantProps {
  tenantId: string;
  rulesetId: string | null;
  onRuleAdded: () => void;
  onClose: () => void;
}

export default function AIRuleAssistant({ tenantId, rulesetId, onRuleAdded, onClose }: AIRuleAssistantProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RuleAssistantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingRule, setAddingRule] = useState(false);
  const { showToast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await ruleAssistantApi.generateRule(tenantId, {
        prompt: prompt.trim(),
        rulesetId: rulesetId || undefined,
      });
      setResponse(result);
    } catch (e: any) {
      setError(e.message || 'Failed to generate rule');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToRuleset = async () => {
    if (!response || !response.proposedRule || response.proposedRule.error || !rulesetId) {
      return;
    }

    const rule = response.proposedRule;
    if (!rule.target || !rule.expression) {
      setError('Invalid rule: missing target or expression');
      return;
    }

    setAddingRule(true);
    setError(null);

    try {
      // Convert ProposedRuleDto to RuleUpdateRequest format
      await ruleApi.updateRule(tenantId, rulesetId, rule.target, {
        expression: rule.expression,
        dependsOn: rule.dependsOn || [],
        effectiveFrom: rule.effectiveFrom || null,
        effectiveTo: null,
        group: null, // Could extract from filters or let user set later
        incomeTax: rule.taxable ?? true, // map legacy taxable -> incomeTax
      });

      // Success - notify parent and reset
      onRuleAdded();
      setResponse(null);
      setPrompt('');
      showToast("success", "Rule added", `Component "${rule.target}" was updated.`);
    } catch (e: any) {
      setError('Failed to add rule: ' + (e.message || 'Unknown error'));
    } finally {
      setAddingRule(false);
    }
  };

  const formatJson = (obj: any): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <Card className="p-6 bg-white rounded-xl shadow-sm border-0 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#0052CC]" />
          <h2 className="text-[#1E1E1E] text-lg font-semibold">AI Rule Assistant</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Describe the rule you want in natural language. The assistant will propose a rule in the internal DSL.
      </p>

      <div className="flex-1 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Natural Language Prompt</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: From Jan 2027, give all managers 7% raise on Base capped at 2000₪."
            className="min-h-[100px]"
            disabled={loading}
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full bg-[#0052CC] hover:bg-[#0047b3]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Rule
            </>
          )}
        </Button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          </div>
        )}

        {response && (
          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* Proposed Rule */}
            <div>
              <h3 className="text-sm font-semibold text-[#1E1E1E] mb-2 flex items-center gap-2">
                Proposed Rule
                {response.proposedRule.error ? (
                  <Badge variant="destructive" className="text-xs">Invalid</Badge>
                ) : (
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800">Valid</Badge>
                )}
              </h3>

              {response.proposedRule.error ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Error:</strong> {response.proposedRule.error}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <pre className="text-xs overflow-x-auto font-mono">
                    {formatJson(response.proposedRule)}
                  </pre>
                </div>
              )}
            </div>

            {/* Explanation */}
            {response.explanation && (
              <div>
                <h3 className="text-sm font-semibold text-[#1E1E1E] mb-2">Explanation</h3>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
                  {response.explanation}
                </div>
              </div>
            )}

            {/* Warnings */}
            {response.warnings && response.warnings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#1E1E1E] mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  Warnings
                </h3>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                    {response.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Add to Ruleset Button */}
            {!response.proposedRule.error && response.proposedRule.target && response.proposedRule.expression && rulesetId && (
              <Button
                onClick={handleAddToRuleset}
                disabled={addingRule}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {addingRule ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Add to Ruleset
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

