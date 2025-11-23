import { useState, useEffect, useRef } from 'react';
import { Plus, Save, CheckCircle, AlertCircle, Upload, List, Network, Loader2, X, Trash2, Database } from 'lucide-react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import ComponentsGraph from './ComponentsGraph';
import RuleBuilderGuide from './RuleBuilderGuide';
import TableBuilder from './TableBuilder';
import { rulesetApi, ruleApi, tableApi, type RuleSet, type RuleDto, type ValidateIssue } from '../services/apiService';

export default function RuleBuilder({ tenantId = 'default' }: { tenantId?: string }) {
  // Load persisted state from localStorage
  const getStoredState = () => {
    try {
      const stored = localStorage.getItem(`ruleBuilder_${tenantId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load stored state:', e);
    }
    return { selectedRulesetId: null, selectedComponent: null };
  };

  const storedState = getStoredState();
  const [selectedComponent, setSelectedComponent] = useState<string | null>(storedState.selectedComponent || null);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(storedState.selectedRulesetId || null);
  
  // Data state
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; count: number }>>([]);
  const [ruleset, setRuleset] = useState<RuleSet | null>(null);
  const [components, setComponents] = useState<Array<{ id: string; name: string; group: string; status: string }>>([]);
  const [validationResults, setValidationResults] = useState<ValidateIssue[]>([]);
  
  // Form state
  const [target, setTarget] = useState('');
  const [expression, setExpression] = useState('');
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [taxable, setTaxable] = useState(true);
  const [group, setGroup] = useState('core');
  
  // Loading/Error state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Add component dialog state
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [newComponentGroup, setNewComponentGroup] = useState('core');
  
  // Autocomplete state
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [autocompletePosition, setAutocompletePosition] = useState<{ top: number; left: number } | null>(null);
  const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState(0);
  const expressionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Table names for autocomplete
  const [tableNames, setTableNames] = useState<string[]>([]);

  // Load rulesets on mount
  useEffect(() => {
    loadRulesets();
  }, [tenantId]);

  // Load ruleset when selected
  useEffect(() => {
    if (selectedRulesetId) {
      loadRuleset(selectedRulesetId);
    }
  }, [selectedRulesetId, tenantId]);

  // Update components when ruleset changes
  useEffect(() => {
    if (ruleset) {
      const comps = ruleset.rules.map(rule => ({
        id: rule.target,
        name: rule.target,
        group: rule.meta?.group || 'core',
        status: 'valid', // TODO: determine from validation
      }));
      setComponents(comps);
      
      // Select first component if none selected
      if (!selectedComponent && comps.length > 0) {
        setSelectedComponent(comps[0].id);
        loadRuleData(comps[0].id);
      }
    }
  }, [ruleset]);

  // Load rule data when component selected
  useEffect(() => {
    if (selectedComponent && ruleset) {
      loadRuleData(selectedComponent);
      loadTableNames(selectedComponent);
    }
  }, [selectedComponent, ruleset]);

  // Load table names for the selected component
  const loadTableNames = async (componentName: string) => {
    try {
      const response = await tableApi.listTables(tenantId, componentName);
      const tables = response.tables || [];
      setTableNames(tables.map((t: any) => t.tableName));
    } catch (err) {
      // If component doesn't have tables, that's fine - just set empty array
      setTableNames([]);
    }
  };

  const loadRulesets = async () => {
    try {
      setLoading(true);
      const data = await rulesetApi.getActive(tenantId);
      setRulesets(data.ruleSets || []);
      // Only set default if no ruleset is already selected (from stored state)
      if (!selectedRulesetId && data.ruleSets && data.ruleSets.length > 0) {
        setSelectedRulesetId(data.ruleSets[0].rulesetId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load rulesets');
    } finally {
      setLoading(false);
    }
  };

  const loadRuleset = async (rulesetId: string) => {
    try {
      setLoading(true);
      const data = await rulesetApi.getRuleset(tenantId, rulesetId);
      setRuleset(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load ruleset');
    } finally {
      setLoading(false);
    }
  };

  const loadRuleData = (targetName: string) => {
    if (!ruleset) return;
    
    const rule = ruleset.rules.find(r => r.target === targetName);
    if (rule) {
      setTarget(rule.target);
      setExpression(rule.expression);
      setDependsOn(rule.dependsOn || []);
      setEffectiveFrom(rule.effectiveFrom || '');
      setEffectiveTo(rule.effectiveTo || '');
      setTaxable(rule.meta?.taxable === 'true');
      setGroup(rule.meta?.group || 'core');
    }
  };

  const handleSave = async () => {
    if (!selectedRulesetId || !target || !expression) {
      setError('Target and expression are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await ruleApi.updateRule(tenantId, selectedRulesetId, target, {
        expression,
        dependsOn: dependsOn.length > 0 ? dependsOn : null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        taxable,
        group: group || null,
      });

      // Reload ruleset
      await loadRuleset(selectedRulesetId);
      alert('Rule saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedRulesetId) {
      setError('Please select a ruleset');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await ruleApi.validate(tenantId, selectedRulesetId);
      setValidationResults(result.issues || []);
      
      if (result.valid) {
        alert('Validation passed!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate ruleset');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedRulesetId) {
      setError('Please select a ruleset');
      return;
    }

    if (!confirm('Are you sure you want to publish this ruleset? This will make it active.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await rulesetApi.publish(tenantId, selectedRulesetId);
      alert('Ruleset published successfully!');
      
      // Reload rulesets
      await loadRulesets();
    } catch (err: any) {
      setError(err.message || 'Failed to publish ruleset');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComponent = async (componentName: string) => {
    if (!selectedRulesetId) {
      setError('Please select a ruleset');
      return;
    }

    if (!confirm(`Are you sure you want to delete the component "${componentName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await ruleApi.deleteRule(tenantId, selectedRulesetId, componentName);
      
      // Reload ruleset to refresh the components list
      await loadRuleset(selectedRulesetId);
      
      // Clear selection if the deleted component was selected
      if (selectedComponent === componentName) {
        setSelectedComponent(null);
        setTarget('');
        setExpression('');
        setDependsOn([]);
        setEffectiveFrom('');
        setEffectiveTo('');
        setTaxable(true);
        setGroup('core');
      }
      
      alert('Component deleted successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to delete component');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDependency = (dep: string) => {
    if (!dependsOn.includes(dep)) {
      setDependsOn([...dependsOn, dep]);
    }
  };

  const handleRemoveDependency = (dep: string) => {
    setDependsOn(dependsOn.filter(d => d !== dep));
  };

  const handleExpressionChange = (value: string, cursorPosition: number) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    
    // Check if we're inside a TBL function call - looking for the first parameter (table name)
    const tblMatch = textBeforeCursor.match(/TBL\s*\(\s*"([^"]*)$/);
    if (tblMatch) {
      // User is typing the table name inside TBL("...")
      const partialTableName = tblMatch[1];
      const suggestions = tableNames
        .filter(name => 
          name.toLowerCase().startsWith(partialTableName.toLowerCase()) && 
          name !== partialTableName
        )
        .slice(0, 10);
      
      if (suggestions.length > 0) {
        setAutocompleteSuggestions(suggestions);
        setAutocompleteSelectedIndex(0);
        
        if (expressionTextareaRef.current) {
          const textarea = expressionTextareaRef.current;
          const rect = textarea.getBoundingClientRect();
          const containerRect = textarea.offsetParent?.getBoundingClientRect() || { top: 0, left: 0 };
          const lines = textBeforeCursor.split('\n');
          const currentLine = lines.length - 1;
          const lineHeight = 20;
          setAutocompletePosition({
            top: rect.top - containerRect.top + (currentLine * lineHeight) + 25,
            left: rect.left - containerRect.left + 10,
          });
        }
      } else {
        setAutocompleteSuggestions([]);
        setAutocompletePosition(null);
      }
      return;
    }
    
    // Check if we're right after TBL( and need to suggest table names
    const tblStartMatch = textBeforeCursor.match(/TBL\s*\(\s*$/);
    if (tblStartMatch) {
      // User just typed TBL( - suggest all table names
      if (tableNames.length > 0) {
        setAutocompleteSuggestions(tableNames.slice(0, 10));
        setAutocompleteSelectedIndex(0);
        
        if (expressionTextareaRef.current) {
          const textarea = expressionTextareaRef.current;
          const rect = textarea.getBoundingClientRect();
          const containerRect = textarea.offsetParent?.getBoundingClientRect() || { top: 0, left: 0 };
          const lines = textBeforeCursor.split('\n');
          const currentLine = lines.length - 1;
          const lineHeight = 20;
          setAutocompletePosition({
            top: rect.top - containerRect.top + (currentLine * lineHeight) + 25,
            left: rect.left - containerRect.left + 10,
          });
        }
      } else {
        setAutocompleteSuggestions([]);
        setAutocompletePosition(null);
      }
      return;
    }
    
    // Regular autocomplete for components and functions
    const match = textBeforeCursor.match(/([A-Z][a-zA-Z0-9]*)$/);
    
    if (match) {
      const partialName = match[1];
      // Get all available component names
      const availableComponents = components.map(c => c.name);
      // Also include function names
      const functions = ['IF', 'MIN', 'MAX', 'ROUND', 'TBL'];
      
      // Filter suggestions
      const suggestions = [
        ...availableComponents.filter(name => 
          name.toLowerCase().startsWith(partialName.toLowerCase()) && 
          name !== partialName
        ),
        ...functions.filter(fn => 
          fn.toLowerCase().startsWith(partialName.toLowerCase()) && 
          fn !== partialName
        )
      ].slice(0, 10); // Limit to 10 suggestions
      
      if (suggestions.length > 0) {
        setAutocompleteSuggestions(suggestions);
        setAutocompleteSelectedIndex(0);
        
        // Calculate position for dropdown (below the textarea, relative to container)
        if (expressionTextareaRef.current) {
          const textarea = expressionTextareaRef.current;
          const rect = textarea.getBoundingClientRect();
          const containerRect = textarea.offsetParent?.getBoundingClientRect() || { top: 0, left: 0 };
          // Estimate cursor position (rough calculation)
          const lines = textBeforeCursor.split('\n');
          const currentLine = lines.length - 1;
          const lineHeight = 20; // Approximate line height
          setAutocompletePosition({
            top: rect.top - containerRect.top + (currentLine * lineHeight) + 25,
            left: rect.left - containerRect.left + 10,
          });
        }
      } else {
        setAutocompleteSuggestions([]);
        setAutocompletePosition(null);
      }
    } else {
      setAutocompleteSuggestions([]);
      setAutocompletePosition(null);
    }
  };

  const handleExpressionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocompleteSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteSelectedIndex(prev => 
          prev < autocompleteSuggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertAutocompleteSuggestion(autocompleteSuggestions[autocompleteSelectedIndex]);
      } else if (e.key === 'Escape') {
        setAutocompleteSuggestions([]);
        setAutocompletePosition(null);
      }
    }
  };

  const insertAutocompleteSuggestion = (suggestion: string) => {
    const textarea = expressionTextareaRef.current;
    if (!textarea) return;
    
    const value = textarea.value;
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    
    // Check if we're inside TBL("...") - need to insert with quotes
    const tblMatch = textBeforeCursor.match(/TBL\s*\(\s*"([^"]*)$/);
    if (tblMatch) {
      // Replace the partial table name with the full suggestion, keeping the quote
      const startPos = textBeforeCursor.lastIndexOf('"');
      const newValue = 
        value.substring(0, startPos + 1) + 
        suggestion + 
        value.substring(cursorPosition);
      setExpression(newValue);
      
      // Set cursor after the inserted table name and closing quote
      setTimeout(() => {
        if (textarea) {
          const newPos = startPos + 1 + suggestion.length + 1; // +1 for closing quote
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 0);
      return;
    }
    
    // Check if we're right after TBL( - insert with quotes
    const tblStartMatch = textBeforeCursor.match(/TBL\s*\(\s*$/);
    if (tblStartMatch) {
      // Insert table name with quotes: TBL("TableName"
      const newValue = 
        value.substring(0, cursorPosition) + 
        `"${suggestion}"` + 
        value.substring(cursorPosition);
      setExpression(newValue);
      
      // Set cursor after the closing quote
      setTimeout(() => {
        if (textarea) {
          const newPos = cursorPosition + suggestion.length + 2; // +2 for quotes
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 0);
      setAutocompleteSuggestions([]);
      setAutocompletePosition(null);
      return;
    }
    
    // Regular insertion for components and functions
    const match = textBeforeCursor.match(/([A-Z][a-zA-Z0-9]*)$/);
    
    if (match) {
      const partialName = match[1];
      const startPos = cursorPosition - partialName.length;
      const newValue = 
        value.substring(0, startPos) + 
        suggestion + 
        value.substring(cursorPosition);
      
      setExpression(newValue);
      setAutocompleteSuggestions([]);
      setAutocompletePosition(null);
      
      // Set cursor position after the inserted suggestion
      setTimeout(() => {
        if (textarea) {
          const newCursorPos = startPos + suggestion.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }
      }, 0);
    }
  };

  const handleAddComponent = async () => {
    if (!selectedRulesetId || !newComponentName.trim()) {
      setError('Component name is required');
      return;
    }

    // Check if component already exists
    if (components.some(c => c.name === newComponentName.trim())) {
      setError('Component with this name already exists');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      // Create a new rule with the new component name as target
      // Start with a simple default expression (e.g., 0 or BaseSalary)
      const defaultExpression = '0';
      
      await ruleApi.updateRule(tenantId, selectedRulesetId, newComponentName.trim(), {
        expression: defaultExpression,
        dependsOn: null,
        effectiveFrom: null,
        effectiveTo: null,
        taxable: false,
        group: newComponentGroup || null,
      });

      // Reload ruleset to get the new component
      await loadRuleset(selectedRulesetId);
      
      // Select the new component
      setSelectedComponent(newComponentName.trim());
      
      // Reset form and close dialog
      setNewComponentName('');
      setNewComponentGroup('core');
      setShowAddComponent(false);
      
      // Load the new rule data
      loadRuleData(newComponentName.trim());
    } catch (err: any) {
      setError(err.message || 'Failed to add component');
    } finally {
      setSaving(false);
    }
  };

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

  const availableDependencies = ruleset?.rules
    .map(r => r.target)
    .filter(t => t !== target) || [];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <h1 className="text-[#1E1E1E] mb-6">Rules</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <Tabs 
        defaultValue={localStorage.getItem(`ruleBuilder_tab_${tenantId}`) || 'guide'} 
        onValueChange={(value) => localStorage.setItem(`ruleBuilder_tab_${tenantId}`, value)}
        className="w-full"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="guide" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            How to Build Rules
          </TabsTrigger>
          <TabsTrigger value="builder" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Rule Builder
          </TabsTrigger>
          <TabsTrigger value="tables" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Tables
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
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Draft
              </button>
              <button
                onClick={handleValidate}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-white text-[#0052CC] border border-[#0052CC] rounded-xl hover:bg-[#EEF2F8] transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Validate
              </button>
              <button
                onClick={handlePublish}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                Publish
              </button>
            </div>
          </div>

          {/* Ruleset Selector */}
          <Card className="p-4 bg-white rounded-xl shadow-sm border-0 mb-6">
            <div className="flex items-center gap-4">
              <Label htmlFor="ruleset" className="min-w-[100px]">Active Ruleset</Label>
              <Select
                value={selectedRulesetId || ''}
                onValueChange={setSelectedRulesetId}
                disabled={loading}
              >
                <SelectTrigger id="ruleset" className="max-w-md">
                  <SelectValue placeholder="Select ruleset..." />
                </SelectTrigger>
                <SelectContent>
                  {rulesets.map((rs) => (
                    <SelectItem key={rs.rulesetId} value={rs.rulesetId}>
                      {rs.rulesetId} ({rs.count} rules)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left - Components List */}
            <div className="lg:col-span-1">
              <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#1E1E1E]">Components</h3>
                  <button 
                    onClick={() => setShowAddComponent(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Add Component"
                  >
                    <Plus className="w-5 h-5 text-[#0052CC]" />
                  </button>
                </div>
                <div className="space-y-2">
                  {components.map((component) => (
                    <div
                      key={component.id}
                      className={`p-4 rounded-lg transition-colors ${
                        selectedComponent === component.id
                          ? 'bg-[#0052CC] text-white'
                          : 'bg-[#EEF2F8] hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          onClick={() => setSelectedComponent(component.id)}
                          className={`flex-1 cursor-pointer ${selectedComponent === component.id ? 'text-white' : 'text-[#1E1E1E]'}`}
                        >
                          {component.name}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(component.status)}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteComponent(component.name);
                            }}
                            className={`p-1 rounded hover:bg-opacity-20 transition-colors ${
                              selectedComponent === component.id
                                ? 'hover:bg-white text-white'
                                : 'hover:bg-red-100 text-red-600'
                            }`}
                            title="Delete component"
                            disabled={saving}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="e.g., Base Salary"
                      className="mt-1"
                    />
                  </div>

                  {/* Expression Editor */}
                  <div className="relative">
                    <Label htmlFor="expression">Expression</Label>
                    <Textarea
                      ref={expressionTextareaRef}
                      id="expression"
                      value={expression}
                      onChange={(e) => {
                        setExpression(e.target.value);
                        handleExpressionChange(e.target.value, e.target.selectionStart);
                      }}
                      onKeyDown={(e) => handleExpressionKeyDown(e)}
                      onBlur={() => {
                        // Delay hiding autocomplete to allow click events
                        setTimeout(() => {
                          setAutocompleteSuggestions([]);
                          setAutocompletePosition(null);
                        }, 200);
                      }}
                      placeholder="e.g., BaseSalary * 1.05 or IF BaseSalary > 50000 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10"
                      className="mt-1 font-mono h-32"
                    />
                    {/* Autocomplete dropdown */}
                    {autocompleteSuggestions.length > 0 && autocompletePosition && (
                      <div
                        className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                        style={{
                          top: `${autocompletePosition.top}px`,
                          left: `${autocompletePosition.left}px`,
                          minWidth: '200px',
                        }}
                      >
                        {autocompleteSuggestions.map((suggestion, index) => (
                          <div
                            key={suggestion}
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent textarea blur
                              insertAutocompleteSuggestion(suggestion);
                            }}
                            className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                              index === autocompleteSelectedIndex ? 'bg-blue-50' : ''
                            }`}
                          >
                            <span className="font-mono text-sm">{suggestion}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 mt-2">
                      Supports: CamelCase components (e.g., BaseSalary, PerformanceBonus), IF-THEN-ELSE, MIN/MAX, ROUND, TBL, operators (+, -, *, /, =, !=, &gt;, &lt;, AND, OR, NOT)
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Tip: Start typing a component name (CamelCase) to see autocomplete suggestions
                    </p>
                  </div>

                  {/* Dependencies */}
                  <div>
                    <Label htmlFor="depends">Depends On</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {dependsOn.map((dep) => (
                        <Badge
                          key={dep}
                          className="bg-[#0052CC] text-white px-3 py-1 cursor-pointer"
                          onClick={() => handleRemoveDependency(dep)}
                        >
                          {dep} ×
                        </Badge>
                      ))}
                      <Select onValueChange={handleAddDependency}>
                        <SelectTrigger className="w-auto border-dashed">
                          <SelectValue placeholder="+ Add dependency" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDependencies.map((dep) => (
                            <SelectItem key={dep} value={dep}>
                              {dep}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="taxable">Taxable</Label>
                      <Switch id="taxable" checked={taxable} onCheckedChange={setTaxable} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="group">Group</Label>
                      <Select value={group} onValueChange={setGroup}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="core">core</SelectItem>
                          <SelectItem value="bonus">bonus</SelectItem>
                          <SelectItem value="pension">pension</SelectItem>
                          <SelectItem value="benefits">benefits</SelectItem>
                          <SelectItem value="equity">equity</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Effective Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="effectiveFrom">Effective From</Label>
                      <Input
                        id="effectiveFrom"
                        type="date"
                        value={effectiveFrom}
                        onChange={(e) => setEffectiveFrom(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="effectiveTo">Effective To</Label>
                      <Input
                        id="effectiveTo"
                        type="date"
                        value={effectiveTo}
                        onChange={(e) => setEffectiveTo(e.target.value)}
                        placeholder="Optional"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Validation Results */}
                  {validationResults.length > 0 && (
                    <div>
                      <h4 className="text-[#1E1E1E] mb-3">Validation Results</h4>
                      <div className="space-y-2">
                        {validationResults.map((result, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-3 p-3 rounded-lg ${
                              result.severity === 'error'
                                ? 'bg-red-50 border border-red-200'
                                : result.severity === 'warning'
                                ? 'bg-yellow-50 border border-yellow-200'
                                : 'bg-blue-50 border border-blue-200'
                            }`}
                          >
                            <AlertCircle
                              className={`w-5 h-5 mt-0.5 ${
                                result.severity === 'error'
                                  ? 'text-red-600'
                                  : result.severity === 'warning'
                                  ? 'text-yellow-600'
                                  : 'text-blue-600'
                              }`}
                            />
                            <div className="flex-1 text-sm text-[#1E1E1E]">
                              {result.component && <strong>{result.component}: </strong>}
                              {result.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="guide">
          <div className="p-6">
            <RuleBuilderGuide />
          </div>
        </TabsContent>

        <TabsContent value="tables">
          <TableBuilder tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="graph">
          <ComponentsGraph />
        </TabsContent>
      </Tabs>

      {/* Add Component Dialog */}
      <Sheet open={showAddComponent} onOpenChange={setShowAddComponent}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add New Component</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="newComponentName">Component Name</Label>
              <Input
                id="newComponentName"
                value={newComponentName}
                onChange={(e) => setNewComponentName(e.target.value)}
                placeholder="e.g., BaseSalary, Bonus, Commission"
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddComponent();
                  }
                }}
              />
              <p className="mt-1 text-sm text-gray-500">
                Use CamelCase (e.g., BaseSalary, PerformanceBonus)
              </p>
            </div>
            <div>
              <Label htmlFor="newComponentGroup">Group</Label>
              <Select value={newComponentGroup} onValueChange={setNewComponentGroup}>
                <SelectTrigger id="newComponentGroup" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">Core</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="pension">Pension</SelectItem>
                  <SelectItem value="benefits">Benefits</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleAddComponent}
                disabled={saving || !newComponentName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:bg-[#0047b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Component
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddComponent(false);
                  setNewComponentName('');
                  setError(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
