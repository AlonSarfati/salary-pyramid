import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Plus, Save, CheckCircle, AlertCircle, Upload, List, Network, Loader2, X, Trash2, Database, HelpCircle, Sparkles, Layers, Edit, Search, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import RuleBuilderGuide from './RuleBuilderGuide';
import TableBuilder from './TableBuilder';
import AIRuleAssistant from './AIRuleAssistant';
import { rulesetApi, ruleApi, tableApi, componentGroupsApi, employeeApi, type RuleSet, type RuleDto, type ValidateIssue, type ComponentGroup, type Employee } from '../services/apiService';
import { useToast } from './ToastProvider';
import { StateScreen } from './ui/StateScreen';

export default function RuleBuilder({ tenantId = 'default' }: { tenantId?: string }) {
  const navigate = useNavigate();
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
    return { selectedComponent: null };
  };

  const storedState = getStoredState();
  const [selectedComponent, setSelectedComponent] = useState<string | null>(storedState.selectedComponent || null);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  
  // Data state
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; status: string }>>([]);
  const [ruleset, setRuleset] = useState<RuleSet | null>(null);
  const [components, setComponents] = useState<Array<{ id: string; name: string; group: string; status: string; order?: number }>>([]);
  const [draftComponents, setDraftComponents] = useState<Record<string, boolean>>({});
  const [validationResults, setValidationResults] = useState<ValidateIssue[]>([]);
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [componentSearchQuery, setComponentSearchQuery] = useState<string>('');
  
  // Group mapping: group name -> group number (group1, group2, etc.)
  const groupNameToNumber = React.useMemo(() => {
    const sorted = [...componentGroups].sort((a, b) => a.displayOrder - b.displayOrder);
    const mapping: Record<string, string> = {};
    sorted.forEach((group, index) => {
      mapping[group.groupName] = `group${index + 1}`;
    });
    return mapping;
  }, [componentGroups]);
  
  // Reverse mapping: group number -> group name
  const groupNumberToName = React.useMemo(() => {
    const mapping: Record<string, string> = {};
    Object.entries(groupNameToNumber).forEach(([name, number]) => {
      mapping[number] = name;
    });
    return mapping;
  }, [groupNameToNumber]);
  
  // Form state
  const [target, setTarget] = useState('');
  const [expression, setExpression] = useState('');
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [group, setGroup] = useState('group1');
  // Logical layer for the component: base vs employer cost
  const [layer, setLayer] = useState<'base' | 'employer' | null>(null);
  const [incomeTax, setIncomeTax] = useState(false);
  const [socialSecurity, setSocialSecurity] = useState(false);
  const [pensionFlag, setPensionFlag] = useState(false);
  const [workPension, setWorkPension] = useState(false);
  const [expensesPension, setExpensesPension] = useState(false);
  const [educationFund, setEducationFund] = useState(false);
  const [workPercentFlag, setWorkPercentFlag] = useState(false);
  
  // Structured Rule Builder state
  const [expertMode, setExpertMode] = useState(false);
  const [ruleType, setRuleType] = useState<'fixed' | 'table' | 'percentage' | 'capfloor' | null>(null);
  
  // Rule type parameters
  const [fixedValue, setFixedValue] = useState<string>('');
  const [tableComponent, setTableComponent] = useState<string>('');
  const [tableName, setTableName] = useState<string>('');
  const [tableLookupField, setTableLookupField] = useState<string>('');
  const [percentageBase, setPercentageBase] = useState<string>('');
  const [percentageAmount, setPercentageAmount] = useState<string>('');
  const [capFloorType, setCapFloorType] = useState<'cap' | 'floor'>('cap');
  const [capFloorComponent, setCapFloorComponent] = useState<string>('');
  const [capFloorValue, setCapFloorValue] = useState<string>('');
  
  // Population filters - now supports multiple groups with AND/OR logic
  type FilterCondition = {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in_range';
    value: string;
    value2?: string;
    logic?: 'AND' | 'OR'; // Logic to join with next condition
  };
  
  type FilterGroup = {
    id: string;
    filters: FilterCondition[];
    // Rule type and parameters (HOW)
    ruleType: 'fixed' | 'table' | 'percentage' | 'capfloor' | null;
    fixedValue: string;
    tableComponent: string;
    tableName: string;
    tableLookupField: string;
    percentageBase: string;
    percentageAmount: string;
    capFloorType: 'cap' | 'floor';
    capFloorComponent: string;
    capFloorValue: string;
  };
  
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([
    { 
      id: 'group-1', 
      filters: [], 
      ruleType: null,
      fixedValue: '',
      tableComponent: '',
      tableName: '',
      tableLookupField: '',
      percentageBase: '',
      percentageAmount: '',
      capFloorType: 'cap',
      capFloorComponent: '',
      capFloorValue: ''
    }
  ]);
  const [availableEmployeeFields, setAvailableEmployeeFields] = useState<Array<{name: string; type: 'string' | 'number'; values?: string[]; min?: number; max?: number}>>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployeeCounts, setFilteredEmployeeCounts] = useState<Record<string, number>>({});
  
  // Advanced options
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Loading/Error state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ type: 'network' | 'system' | 'validation'; message?: string; supportRef?: string } | null>(null);
  const isSavingRef = useRef(false); // Track if we're currently saving to prevent reload
  const [lastValidationStatus, setLastValidationStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastValidationTime, setLastValidationTime] = useState<string | null>(null);
  
  // Add component dialog state
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [newComponentGroup, setNewComponentGroup] = useState('group1');
  const [newComponentLayer, setNewComponentLayer] = useState<'base' | 'employer'>('base');
  const [showDeleteRulesetDialog, setShowDeleteRulesetDialog] = useState(false);
  const [showRenameRulesetDialog, setShowRenameRulesetDialog] = useState(false);
  const [showCopyRulesetDialog, setShowCopyRulesetDialog] = useState(false);
  const [showCreateRulesetDialog, setShowCreateRulesetDialog] = useState(false);
  const [showDeleteComponentDialog, setShowDeleteComponentDialog] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<string | null>(null);
  const [newRulesetName, setNewRulesetName] = useState('');
  const [showPublishConfirmDialog, setShowPublishConfirmDialog] = useState(false);
  const [rulesetNameError, setRulesetNameError] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  
  // Help guide drawer state
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  
  // AI Assistant panel state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  // Autocomplete state
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [autocompletePosition, setAutocompletePosition] = useState<{ top: number; left: number } | null>(null);
  const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState(0);
  const expressionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Table names for autocomplete
  const [tableNames, setTableNames] = useState<string[]>([]);
  
  // Component Groups management state
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false);
  const [groupNameToDelete, setGroupNameToDelete] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<ComponentGroup | null>(null);
  const [groupFormData, setGroupFormData] = useState({ 
    groupName: '', 
    displayName: '', 
    color: '#1FB5B8', 
    displayOrder: 1 
  });

  const { showToast } = useToast();

  // Load component groups on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const groups = await componentGroupsApi.getAll();
        if (!cancelled) {
          setComponentGroups(groups);
        }
      } catch (e: any) {
        console.error('Failed to load component groups:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load rulesets on mount
  useEffect(() => {
    loadRulesets();
  }, [tenantId]);

  // Clear selected ruleset when tenant changes
  useEffect(() => {
    setSelectedRulesetId(null);
    setRuleset(null);
    setComponents([]);
    setError(null);
  }, [tenantId]);

  // Load ruleset when selected
  useEffect(() => {
    if (selectedRulesetId) {
      loadRuleset(selectedRulesetId);
    }
  }, [selectedRulesetId, tenantId]);

  // Save ruleset selection to global storage when it changes
  useEffect(() => {
    if (selectedRulesetId && rulesets.length > 0) {
      const selected = rulesets.find(rs => rs.rulesetId === selectedRulesetId);
      if (selected) {
        try {
          localStorage.setItem(GLOBAL_RULESET_KEY, JSON.stringify({
            rulesetId: selected.rulesetId,
            name: selected.name || selected.rulesetId,
          }));
        } catch (e) {
          console.warn('Failed to save ruleset to localStorage:', e);
        }
      }
    }
  }, [selectedRulesetId, rulesets, tenantId]);

  // Calculate component order based on dependencies (topological sort)
  const calculateComponentOrder = (rules: RuleDto[]): string[] => {
    // Build dependency graph
    const graph = new Map<string, Set<string>>();
    const allComponents = new Set<string>();
    
    rules.forEach(rule => {
      allComponents.add(rule.target);
      if (!graph.has(rule.target)) {
        graph.set(rule.target, new Set<string>());
      }
      
      // Extract dependencies from expression
      const expression = rule.expression || '';
      // Remove quoted strings (table names in TBL functions)
      const withoutQuotes = expression.replaceAll(/"([^"]*)"/g, '');
      // Match CamelCase identifiers
      const camelCasePattern = /\b([A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*)\b/g;
      let match;
      const deps = new Set<string>();
      
      // Add explicit dependencies
      if (rule.dependsOn) {
        rule.dependsOn.forEach(dep => {
          if (allComponents.has(dep)) {
            deps.add(dep);
          }
        });
      }
      
      // Extract from expression
      while ((match = camelCasePattern.exec(withoutQuotes)) !== null) {
        const name = match[1];
        // Skip if it's a function (ALL_CAPS) or if it's the target itself
        if (name !== rule.target && allComponents.has(name)) {
          deps.add(name);
        }
      }
      
      const depsArray = Array.from(deps) as string[];
      depsArray.forEach(dep => {
        graph.get(rule.target)!.add(dep);
      });
    });
    
    // Topological sort (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    allComponents.forEach(comp => {
      inDegree.set(comp, 0);
    });
    
    // Calculate in-degree: how many dependencies each component has
    graph.forEach((deps, comp) => {
      inDegree.set(comp, deps.size);
    });
    
    const queue: string[] = [];
    inDegree.forEach((degree, comp) => {
      if (degree === 0) {
        queue.push(comp);
      }
    });
    
    queue.sort(); // Sort for determinism
    
    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      
      graph.forEach((deps, comp) => {
        if (deps.has(node)) {
          const newDegree = (inDegree.get(comp) || 0) - 1;
          inDegree.set(comp, newDegree);
          if (newDegree === 0) {
            queue.push(comp);
          }
        }
      });
      
      // Re-sort queue for determinism
      queue.sort();
    }
    
    return result;
  };

  // Update components when ruleset changes
  useEffect(() => {
    if (ruleset) {
      // Calculate component order
      const componentOrder = calculateComponentOrder(ruleset.rules);
      const orderMap = new Map<string, number>();
      componentOrder.forEach((comp, index) => {
        orderMap.set(comp, index);
      });
      
      const comps = ruleset.rules.map(rule => {
        // Check if this is an employer cost component
        const metaLayer = rule.meta?.layer;
        const isEmployer = metaLayer && metaLayer.toLowerCase() === 'employer';
        
        // For employer cost components, display "Employer Cost" instead of group number
        let displayGroup: string;
        if (isEmployer) {
          displayGroup = 'Employer Cost';
        } else {
          const actualGroupName = rule.meta?.group || 'core';
          displayGroup = groupNameToNumber[actualGroupName] || 'group1';
        }
        
        return {
          id: rule.target,
          name: rule.target,
          group: displayGroup, // Display group number or "Employer Cost"
          status: 'valid', // TODO: determine from validation
          order: orderMap.get(rule.target) ?? 9999, // Use calculation order
        };
      });
      
      // Sort by calculation order
      comps.sort((a, b) => a.order - b.order);
      setComponents(comps);
      
      // Select first component if none selected
      if (!selectedComponent && comps.length > 0) {
        setSelectedComponent(comps[0].id);
        loadRuleData(comps[0].id);
      }
    }
  }, [ruleset, groupNameToNumber]);

  // Load rule data when component selected
  useEffect(() => {
    // Don't reload if we're currently saving - this prevents state from being reset after save
    if (isSavingRef.current) {
      return;
    }
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

  const GLOBAL_RULESET_KEY = `globalRuleset_${tenantId}`;

  // Clear selected ruleset when tenant changes
  useEffect(() => {
    setSelectedRulesetId(null);
    setRuleset(null);
    setComponents([]);
  }, [tenantId]);

  const loadRulesets = async () => {
    try {
      setLoading(true);
      const all = await rulesetApi.getAllRulesets(tenantId);
      setRulesets(all);
      
      // Always validate and clear if ruleset doesn't exist in current tenant
      if (selectedRulesetId && !all.some(rs => rs.rulesetId === selectedRulesetId)) {
        setSelectedRulesetId(null);
        setRuleset(null);
        setComponents([]);
      }
      
      if (!selectedRulesetId && all.length > 0) {
        // Try to restore global ruleset selection
        let initialId: string | null = null;
        try {
          const stored = localStorage.getItem(GLOBAL_RULESET_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.rulesetId && all.some(rs => rs.rulesetId === parsed.rulesetId)) {
              initialId = parsed.rulesetId;
            } else {
              // Stored ruleset doesn't exist in current tenant, clear it
              localStorage.removeItem(GLOBAL_RULESET_KEY);
            }
          }
        } catch {
          // ignore
        }
        setSelectedRulesetId(initialId || all[0].rulesetId);
      }
      // Note: Empty state is handled in render, not here
    } catch (err: any) {
      const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: err.message,
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRuleset = async (rulesetId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await rulesetApi.getRuleset(tenantId, rulesetId);
      setRuleset(data);
    } catch (err: any) {
      // Check if this is a "Ruleset not found" error (happens when switching tenants)
      // Error can be wrapped as "API call failed: 404 - Ruleset not found: ..." or direct
      const errorMsg = err.message || '';
      const isRulesetNotFound = errorMsg.includes('Ruleset not found') || 
                                errorMsg.includes('NoSuchElementException') ||
                                (err.response?.status === 404) ||
                                (errorMsg.includes('404') && errorMsg.includes('Ruleset'));
      
      if (isRulesetNotFound) {
        // Clear the selected ruleset and reload rulesets list instead of showing error
        setError(null); // Clear any error state
        setSelectedRulesetId(null);
        setRuleset(null);
        setComponents([]);
        // Reload rulesets to get the correct list for this tenant
        await loadRulesets();
        return;
      }
      
      const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: err.message,
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper: Try to detect rule type from expression
  const detectRuleTypeFromExpression = (expr: string): 'fixed' | 'table' | 'percentage' | 'capfloor' | null => {
    if (!expr) return null;
    
    // Check for TBL function (table lookup)
    if (expr.includes('TBL(') || expr.includes('TBL("')) {
      return 'table';
    }
    
    // Check for MIN/MAX (cap/floor)
    if (expr.includes('MIN(') || expr.includes('MAX(')) {
      return 'capfloor';
    }
    
    // Check for percentage pattern (Component * 0.XX or Component * XX/100)
    const percentagePattern = /^([A-Z][a-zA-Z0-9]*)\s*\*\s*([0-9.]+)$/;
    if (percentagePattern.test(expr.trim())) {
      return 'percentage';
    }
    
    // Check for simple number (fixed value)
    const fixedPattern = /^-?\d+(\.\d+)?$/;
    if (fixedPattern.test(expr.trim())) {
      return 'fixed';
    }
    
    return null;
  };

  // Helper: Parse condition string to extract filter conditions with AND/OR logic
  const parseConditionToFilters = (condition: string): FilterCondition[] => {
    const filters: FilterCondition[] = [];
    
    // Split by AND/OR, preserving the operators
    // This is a simplified parser - for complex nested conditions, this might need improvement
    const parts = condition.split(/\s+(AND|OR)\s+/i);
    
    for (let i = 0; i < parts.length; i += 2) {
      const cond = parts[i].trim();
      const logic = i > 0 ? (parts[i - 1].toUpperCase() as 'AND' | 'OR') : undefined;
      
      // Remove parentheses if present
      const trimmed = cond.replace(/^\(+|\)+$/g, '').trim();
      
      // Try to match different operators
      // Equals: field = value or field = "value"
      const equalsMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (equalsMatch) {
        const field = equalsMatch[1];
        let value = equalsMatch[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        filters.push({ field, operator: 'equals', value, logic });
        continue;
      }
      
      // Not equals
      const notEqualsMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)\s*!=\s*(.+)$/);
      if (notEqualsMatch) {
        const field = notEqualsMatch[1];
        let value = notEqualsMatch[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        filters.push({ field, operator: 'not_equals', value, logic });
        continue;
      }
      
      // Greater than
      const gtMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)\s*>\s*(.+)$/);
      if (gtMatch) {
        filters.push({ field: gtMatch[1], operator: 'greater_than', value: gtMatch[2].trim(), logic });
        continue;
      }
      
      // Less than
      const ltMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)\s*<\s*(.+)$/);
      if (ltMatch) {
        filters.push({ field: ltMatch[1], operator: 'less_than', value: ltMatch[2].trim(), logic });
        continue;
      }
      
      // Range: field >= value1 AND field <= value2
      const rangeMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)\s*>=\s*(.+?)\s+AND\s+\1\s*<=\s*(.+)$/);
      if (rangeMatch) {
        filters.push({ 
          field: rangeMatch[1], 
          operator: 'in_range', 
          value: rangeMatch[2].trim(), 
          value2: rangeMatch[3].trim(),
          logic 
        });
        continue;
      }
    }
    
    return filters;
  };

  // Helper: Extract base expression from IF condition
  const extractBaseExpression = (expr: string): string => {
    // Check if expression has IF condition: IF condition THEN expression ELSE 0
    const ifMatch = expr.match(/^IF\s+.+?\s+THEN\s+(.+?)\s+ELSE\s+0$/);
    if (ifMatch) {
      return ifMatch[1].trim();
    }
    return expr;
  };

  // Helper: Parse nested IF-THEN-ELSE to extract filter groups
  const parseFilterGroupsFromExpression = (expr: string): FilterGroup[] => {
    const groups: FilterGroup[] = [];
    let remaining = expr.trim();
    let groupId = 1;
    
    // Parse nested IF conditions: IF condition THEN value ELSE ...
    // Use a more robust parser that handles nested parentheses
    while (remaining) {
      // Match: IF <condition> THEN <value> ELSE <rest>
      // We need to properly handle nested parentheses in the condition
      if (!remaining.startsWith('IF ')) break;
      
      // Find the THEN keyword (after the condition)
      let thenPos = -1;
      let parenDepth = 0;
      let inQuotes = false;
      for (let i = 3; i < remaining.length - 4; i++) {
        const char = remaining[i];
        if (char === '"' && (i === 0 || remaining[i-1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (!inQuotes) {
          if (char === '(') parenDepth++;
          else if (char === ')') parenDepth--;
          else if (parenDepth === 0 && remaining.substring(i, i + 5) === ' THEN') {
            thenPos = i;
            break;
          }
        }
      }
      
      if (thenPos === -1) break;
      
      const condition = remaining.substring(3, thenPos).trim();
      
      // Find the ELSE keyword (after the THEN value)
      let elsePos = -1;
      parenDepth = 0;
      inQuotes = false;
      for (let i = thenPos + 5; i < remaining.length - 4; i++) {
        const char = remaining[i];
        if (char === '"' && (i === 0 || remaining[i-1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (!inQuotes) {
          if (char === '(') parenDepth++;
          else if (char === ')') parenDepth--;
          else if (parenDepth === 0 && remaining.substring(i, i + 5) === ' ELSE') {
            elsePos = i;
            break;
          }
        }
      }
      
      if (elsePos === -1) break;
      
      const thenValue = remaining.substring(thenPos + 5, elsePos).trim();
      const elseValue = remaining.substring(elsePos + 5).trim();
      
      // Parse filters from condition
      const filters = parseConditionToFilters(condition);
      
      // Determine rule type and parse parameters
      let ruleType: 'fixed' | 'table' | 'percentage' | 'capfloor' | null = null;
      let fixedValue = '';
      let tableComponent = '';
      let tableName = '';
      let tableLookupField = '';
      let percentageBase = '';
      let percentageAmount = '';
      let capFloorType: 'cap' | 'floor' = 'cap';
      let capFloorComponent = '';
      let capFloorValue = '';
      
      // Check if it's a percentage: Component * 0.XX
      const percMatch = thenValue.match(/^([A-Z][a-zA-Z0-9]*)\s*\*\s*([0-9.]+)$/);
      if (percMatch) {
        ruleType = 'percentage';
        percentageBase = percMatch[1];
        const multiplier = parseFloat(percMatch[2]);
        percentageAmount = (multiplier * 100).toString();
      }
      // Check if it's a table lookup: TBL("tableName", field)
      else if (thenValue.includes('TBL(')) {
        const tblMatch = thenValue.match(/TBL\("([^"]+)",\s*([^)]+)\)/);
        if (tblMatch) {
          ruleType = 'table';
          tableName = tblMatch[1];
          tableLookupField = tblMatch[2].trim();
        }
      }
      // Check if it's a cap/floor: MIN(...) or MAX(...)
      else if (thenValue.includes('MIN(') || thenValue.includes('MAX(')) {
        const minMatch = thenValue.match(/MIN\(([^,]+),\s*([^)]+)\)/);
        const maxMatch = thenValue.match(/MAX\(([^,]+),\s*([^)]+)\)/);
        if (minMatch) {
          ruleType = 'capfloor';
          capFloorType = 'floor';
          capFloorComponent = minMatch[1].trim();
          capFloorValue = minMatch[2].trim();
        } else if (maxMatch) {
          ruleType = 'capfloor';
          capFloorType = 'cap';
          capFloorComponent = maxMatch[1].trim();
          capFloorValue = maxMatch[2].trim();
        }
      }
      // Check if it's a fixed value (simple number)
      else if (/^-?\d+(\.\d+)?$/.test(thenValue)) {
        ruleType = 'fixed';
        fixedValue = thenValue;
      }
      
      groups.push({
        id: `group-${groupId++}`,
        filters,
        ruleType,
        fixedValue,
        tableComponent,
        tableName,
        tableLookupField,
        percentageBase,
        percentageAmount,
        capFloorType,
        capFloorComponent,
        capFloorValue
      });
      
      // Continue parsing the ELSE part
      remaining = elseValue;
    }
    
    return groups;
  };

  // Helper: Parse expression into structured inputs
  const parseExpressionToStructured = (expr: string) => {
    // Try to parse filter groups from nested IF conditions
    const parsedGroups = parseFilterGroupsFromExpression(expr);
    if (parsedGroups.length > 0) {
      setFilterGroups(parsedGroups);
      // Set main rule type based on last group (default/else value)
      const lastGroup = parsedGroups[parsedGroups.length - 1];
      if (lastGroup.ruleType) {
        setRuleType(lastGroup.ruleType);
        if (lastGroup.ruleType === 'fixed') {
          setFixedValue(lastGroup.fixedValue);
        } else if (lastGroup.ruleType === 'percentage') {
          setPercentageBase(lastGroup.percentageBase);
          setPercentageAmount(lastGroup.percentageAmount);
        } else if (lastGroup.ruleType === 'table') {
          setTableName(lastGroup.tableName);
          setTableLookupField(lastGroup.tableLookupField);
        } else if (lastGroup.ruleType === 'capfloor') {
          setCapFloorType(lastGroup.capFloorType);
          setCapFloorComponent(lastGroup.capFloorComponent);
          setCapFloorValue(lastGroup.capFloorValue);
        }
      }
      return;
    }
    
    // Fallback: try to parse as single IF condition or simple expression
    const baseExpr = extractBaseExpression(expr);
    const detectedType = detectRuleTypeFromExpression(baseExpr);
    if (!detectedType) return;
    
    setRuleType(detectedType);
    
    switch (detectedType) {
      case 'fixed':
        setFixedValue(baseExpr.trim());
        break;
      case 'table':
        const tblMatch = baseExpr.match(/TBL\("([^"]+)",\s*([^)]+)\)/);
        if (tblMatch) {
          setTableName(tblMatch[1]);
          setTableLookupField(tblMatch[2].trim());
        }
        break;
      case 'percentage':
        const percMatch = baseExpr.match(/^([A-Z][a-zA-Z0-9]*)\s*\*\s*([0-9.]+)$/);
        if (percMatch) {
          setPercentageBase(percMatch[1]);
          const multiplier = parseFloat(percMatch[2]);
          setPercentageAmount((multiplier * 100).toString());
        }
        break;
      case 'capfloor':
        const minMatch = baseExpr.match(/MIN\(([^,]+),\s*([^)]+)\)/);
        const maxMatch = baseExpr.match(/MAX\(([^,]+),\s*([^)]+)\)/);
        if (minMatch) {
          setCapFloorType('floor');
          setCapFloorComponent(minMatch[1].trim());
          setCapFloorValue(minMatch[2].trim());
        } else if (maxMatch) {
          setCapFloorType('cap');
          setCapFloorComponent(maxMatch[1].trim());
          setCapFloorValue(maxMatch[2].trim());
        }
        break;
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
      
      // Determine logical layer (base vs employer) from metadata only
      const metaLayer = rule.meta?.layer;
      const isEmployer = metaLayer && metaLayer.toLowerCase() === 'employer';
      
      if (isEmployer) {
        setLayer('employer');
        // Employer cost components don't have groups - clear it
        setGroup('group1'); // Reset to default, but it won't be saved
        // Employer cost components don't have tax/pension flags - reset all to false
        setIncomeTax(false);
        setSocialSecurity(false);
        setPensionFlag(false);
        setWorkPension(false);
        setExpensesPension(false);
        setEducationFund(false);
        setWorkPercentFlag(false);
      } else {
        setLayer('base');
        // Convert group name to group number for display (only for base layer)
        const actualGroupName = rule.meta?.group || 'core';
        const groupNumber = groupNameToNumber[actualGroupName] || 'group1';
        setGroup(groupNumber);
        // Load tax/pension flags from metadata for base layer components
        const legacyTaxable = rule.meta?.taxable === 'true';
        const legacyTax = rule.meta?.tax === 'true';
        const incomeTaxMeta = rule.meta?.incomeTax === 'true';
        setIncomeTax(incomeTaxMeta || legacyTax || legacyTaxable);
        setSocialSecurity(rule.meta?.socialSecurity === 'true');
        setPensionFlag(rule.meta?.pensionFlag === 'true');
        setWorkPension(rule.meta?.workPension === 'true');
        setExpensesPension(rule.meta?.expensesPension === 'true');
        setEducationFund(rule.meta?.educationFund === 'true');
        setWorkPercentFlag(rule.meta?.workPercent === 'true');
      }
      
      // Reset structured state
      setRuleType(null);
      setFixedValue('');
      setTableComponent('');
      setTableName('');
      setTableLookupField('');
      setPercentageBase('');
      setPercentageAmount('');
      setCapFloorComponent('');
      setCapFloorValue('');
      // Reset filter groups - let parseExpressionToStructured handle restoration
      setFilterGroups([{ 
        id: 'group-1', 
        filters: [], 
        ruleType: null,
        fixedValue: '',
        tableComponent: '',
        tableName: '',
        tableLookupField: '',
        percentageBase: '',
        percentageAmount: '',
        capFloorType: 'cap',
        capFloorComponent: '',
        capFloorValue: ''
      }]);
      
      // Try to detect and parse structured format from expression
      if (!expertMode && rule.expression) {
        parseExpressionToStructured(rule.expression);
      }
    }
  };

  // Helper: Convert filter operator to expression operator
  const filterOperatorToExpression = (operator: string, field: string, value: string, value2?: string): string => {
    const fieldMeta = availableEmployeeFields.find(f => f.name === field);
    const isNumeric = fieldMeta?.type === 'number';
    
    switch (operator) {
      case 'equals':
        return isNumeric ? `${field} = ${value}` : `${field} = "${value}"`;
      case 'not_equals':
        return isNumeric ? `${field} != ${value}` : `${field} != "${value}"`;
      case 'greater_than':
        return `${field} > ${value}`;
      case 'less_than':
        return `${field} < ${value}`;
      case 'in_range':
        return value2 ? `${field} >= ${value} AND ${field} <= ${value2}` : '';
      default:
        return '';
    }
  };

  // Helper: Generate base expression (default/else case when there are filter groups)
  // Since rule types are now per-group, this returns '0' as the default fallback
  const generateBaseExpression = (): string => {
    if (!target) return '';
    
    // Since we removed global rule type, the base expression is just '0' (unchanged for employees not matching any group)
    // If there are no filter groups, we'll require at least one group to be configured
    return '0';
  };

  // Helper: Generate expression for a filter group value (based on rule type)
  const generateGroupValueExpression = (group: FilterGroup): string => {
    if (!group.ruleType) return '0';
    
    switch (group.ruleType) {
      case 'fixed':
        return group.fixedValue || '0';
      case 'table':
        if (group.tableComponent && group.tableName && group.tableLookupField) {
          return `TBL("${group.tableName}", ${group.tableLookupField})`;
        }
        return '0';
      case 'percentage':
        if (group.percentageBase && group.percentageAmount) {
          return `${group.percentageBase} * ${parseFloat(group.percentageAmount) / 100}`;
        }
        return '0';
      case 'capfloor':
        if (group.capFloorComponent && group.capFloorValue) {
          const func = group.capFloorType === 'cap' ? 'MIN' : 'MAX';
          return `${func}(${group.capFloorComponent}, ${group.capFloorValue})`;
        }
        return '0';
      default:
        return '0';
    }
  };

  // Helper: Generate condition expression from filter group
  const generateGroupCondition = (group: FilterGroup): string => {
    if (group.filters.length === 0) return '';
    
    const conditions = group.filters
      .filter(f => f.field && f.value)
      .map(f => filterOperatorToExpression(f.operator, f.field, f.value, f.value2))
      .filter(c => c !== '');
    
    if (conditions.length === 0) return '';
    if (conditions.length === 1) return conditions[0];
    
    // Join conditions with AND/OR logic
    // Wrap each condition in parentheses and join with the appropriate operator
    const parts: string[] = [];
    parts.push(`(${conditions[0]})`);
    
    for (let i = 1; i < conditions.length; i++) {
      const logic = group.filters[i - 1].logic || 'AND';
      parts.push(logic);
      parts.push(`(${conditions[i]})`);
    }
    
    // Return all conditions joined together, wrapped in parentheses for proper grouping
    return `(${parts.join(' ')})`;
  };

  // Helper: Generate expression from structured inputs (with filter groups applied)
  const generateExpressionFromStructured = (): string => {
    if (!target) return '';
    
    // Find groups with rule types configured (filters are optional - if no filters, applies to all employees)
    const groupsWithRuleTypes = filterGroups.filter(g => g.ruleType !== null);
    
    // Require at least one group with a rule type
    if (groupsWithRuleTypes.length === 0) {
      return '';
    }
    
    // Separate groups with filters vs groups without filters
    const groupsWithFilters = groupsWithRuleTypes.filter(g => 
      g.filters.length > 0 && 
      g.filters.some(f => f.field && f.value)
    );
    
    const groupsWithoutFilters = groupsWithRuleTypes.filter(g => 
      g.filters.length === 0 || 
      !g.filters.some(f => f.field && f.value)
    );
    
    // If there are groups without filters, use the first one's value as the base expression
    // (applies to all employees not matching any filtered group)
    let baseExpression = '0'; // Default fallback
    if (groupsWithoutFilters.length > 0) {
      const firstUnfilteredGroup = groupsWithoutFilters[0];
      baseExpression = generateGroupValueExpression(firstUnfilteredGroup);
    }
    
    // If no groups with filters, just return the base expression (applies to all)
    if (groupsWithFilters.length === 0) {
      return baseExpression;
    }
    
    // Build nested IF-THEN-ELSE structure for groups with filters
    let expression = baseExpression; // Default value (from unfiltered group or '0')
    
    // Build from last to first (nested ELSE IF)
    for (let i = groupsWithFilters.length - 1; i >= 0; i--) {
      const group = groupsWithFilters[i];
      const condition = generateGroupCondition(group);
      const value = generateGroupValueExpression(group);
      
      if (condition) {
        expression = `IF ${condition} THEN ${value} ELSE ${expression}`;
      }
    }
    
    return expression;
  };

  // Helper: Humanize field names (snake_case to readable)
  const humanizeFieldName = (fieldName: string): string => {
    if (!fieldName) return fieldName;
    // Replace underscores with spaces and capitalize words
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Helper: Humanize condition descriptions
  const humanizeCondition = (field: string, operator: string, value: string, value2?: string): string => {
    const humanField = humanizeFieldName(field);
    const fieldMeta = availableEmployeeFields.find(af => af.name === field);
    const isNumeric = fieldMeta?.type === 'number';
    
    switch (operator) {
      case 'equals':
        return `${humanField} is ${isNumeric ? value : `"${value}"`}`;
      case 'not_equals':
        return `${humanField} is not ${isNumeric ? value : `"${value}"`}`;
      case 'greater_than':
        return `${humanField} above ${value}`;
      case 'less_than':
        return `${humanField} below ${value}`;
      case 'in_range':
        return `${humanField} between ${value} and ${value2 || ''}`;
      default:
        return `${humanField} ${operator} ${value}`;
    }
  };

  // Helper: Format number with thousand separators
  const formatNumber = (num: number | string): string => {
    const numValue = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(numValue)) return String(num);
    return new Intl.NumberFormat('en-US').format(numValue);
  };

  // Helper: Format percentage
  const formatPercentage = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return String(value);
    return `${formatNumber(numValue)}%`;
  };

  // Helper: Format currency (assuming ILS for now, can be made configurable)
  const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return String(value);
    return `₪${formatNumber(numValue)}`;
  };

  // Helper: Check if component name suggests it's monetary
  const isMonetaryComponent = (componentName: string): boolean => {
    const lower = componentName.toLowerCase();
    return lower.includes('salary') || lower.includes('pay') || lower.includes('wage') || 
           lower.includes('bonus') || lower.includes('compensation') || lower.includes('amount') ||
           lower.includes('meshulav') || lower.includes('haslamat') || lower.includes('tax') ||
           lower.includes('pension') || lower.includes('fund');
  };

  // Helper: Generate structured rule summary data for all groups
  const generateStructuredRuleSummary = () => {
    if (!target) return [];
    
    let componentName = humanizeFieldName(target);
    // Make employer layer explicit in the summary label
    if (layer === 'employer') {
      componentName = `${componentName} (Employer Cost)`;
    }
    const activeGroups = filterGroups.filter(g => 
      g.filters.length > 0 && 
      g.filters.some(f => f.field && f.value) && 
      g.ruleType !== null
    );

    if (activeGroups.length === 0) {
      return [{
        component: componentName,
        appliesTo: 'No filter groups configured',
        calculationMethod: 'Not configured',
        result: 'Rule not yet configured',
        employeesAffected: 0
      }];
    }

    // Generate summary for each active group
    return activeGroups.map((group, groupIdx) => {
      const filterDescriptions = group.filters
        .filter(f => f.field && f.value)
        .map((f, i) => {
          const desc = humanizeCondition(f.field, f.operator, f.value, f.value2);
          if (i < group.filters.length - 1 && f.logic) {
            return desc + ` ${f.logic === 'AND' ? 'and' : 'or'}`;
          }
          return desc;
        })
        .filter(d => d !== '');

      let calculationMethod = '';
      let result = '';
      
      switch (group.ruleType) {
        case 'fixed':
          calculationMethod = 'Fixed Value';
          const fixedVal = group.fixedValue || '0';
          result = isMonetaryComponent(target) 
            ? formatCurrency(fixedVal)
            : formatNumber(fixedVal);
          break;
        case 'table':
          calculationMethod = 'Table Lookup';
          if (group.tableName && group.tableLookupField) {
            result = `From table "${group.tableName}" using ${humanizeFieldName(group.tableLookupField)}`;
          } else {
            result = 'Table lookup (incomplete)';
          }
          break;
        case 'percentage':
          calculationMethod = 'Percentage Adjustment';
          if (group.percentageBase && group.percentageAmount) {
            result = `${formatPercentage(group.percentageAmount)} of ${humanizeFieldName(group.percentageBase)}`;
          } else {
            result = 'Percentage (incomplete)';
          }
          break;
        case 'capfloor':
          calculationMethod = group.capFloorType === 'cap' ? 'Cap (Maximum)' : 'Floor (Minimum)';
          if (group.capFloorComponent && group.capFloorValue) {
            const limitType = group.capFloorType === 'cap' ? 'maximum' : 'minimum';
            const limitVal = isMonetaryComponent(group.capFloorComponent)
              ? formatCurrency(group.capFloorValue)
              : formatNumber(group.capFloorValue);
            result = `${limitType} of ${limitVal} for ${humanizeFieldName(group.capFloorComponent)}`;
          } else {
            result = `${group.capFloorType === 'cap' ? 'Maximum' : 'Minimum'} (incomplete)`;
          }
          break;
      }

      const employeesAffected = filteredEmployeeCounts[group.id] || 0;
      const appliesTo = filterDescriptions.length > 0 
        ? `Employees where ${filterDescriptions.join(' ')}`
        : 'All employees';

      return {
        component: componentName,
        groupNumber: groupIdx + 1,
        appliesTo,
        calculationMethod,
        result,
        employeesAffected
      };
    });
  };

  // Helper: Generate plain-language explanation in full sentences (kept for backward compatibility)
  const generateRuleExplanation = (): string => {
    if (!target) return '';
    
    const componentName = humanizeFieldName(target) || 'the component';
    let explanation = '';
    
    // Get active filter groups
    const activeGroups = filterGroups.filter(g => 
      g.filters.length > 0 && 
      g.filters.some(f => f.field && f.value) && 
      g.ruleType !== null
    );
    
    // Build natural language description
    if (activeGroups.length > 0) {
      // Start with the main action
      explanation = `${componentName} will be calculated differently based on employee groups. `;
      
      // Describe each group
      const groupDescriptions: string[] = [];
      activeGroups.forEach((group, idx) => {
        const filterDescriptions = group.filters
          .filter(f => f.field && f.value)
          .map((f, i) => {
            const desc = humanizeCondition(f.field, f.operator, f.value, f.value2);
            if (i < group.filters.length - 1 && f.logic) {
              return desc + ` ${f.logic === 'AND' ? 'and' : 'or'}`;
            }
            return desc;
          })
          .filter(d => d !== '');
        
        if (filterDescriptions.length > 0) {
          // Generate natural language value description
          let valueDesc = '';
          switch (group.ruleType) {
            case 'fixed':
              const fixedVal = group.fixedValue || '0';
              valueDesc = isMonetaryComponent(target) 
                ? `set to ${formatCurrency(fixedVal)}`
                : `set to ${formatNumber(fixedVal)}`;
              break;
            case 'table':
              if (group.tableName && group.tableLookupField) {
                valueDesc = `looked up from table "${group.tableName}" using ${humanizeFieldName(group.tableLookupField)}`;
              } else {
                valueDesc = 'looked up from table';
              }
              break;
            case 'percentage':
              if (group.percentageBase && group.percentageAmount) {
                valueDesc = `calculated as ${formatPercentage(group.percentageAmount)} of ${humanizeFieldName(group.percentageBase)}`;
              } else {
                valueDesc = 'calculated as a percentage';
              }
              break;
            case 'capfloor':
              const capFloorText = group.capFloorType === 'cap' ? 'maximum' : 'minimum';
              if (group.capFloorComponent && group.capFloorValue) {
                const limitVal = isMonetaryComponent(group.capFloorComponent)
                  ? formatCurrency(group.capFloorValue)
                  : formatNumber(group.capFloorValue);
                valueDesc = `limited to a ${capFloorText} of ${limitVal} for ${humanizeFieldName(group.capFloorComponent)}`;
              } else {
                valueDesc = `limited to a ${capFloorText}`;
              }
              break;
          }
          
          const employeeCount = filteredEmployeeCounts[group.id] || 0;
          let groupDesc = `For employees where ${filterDescriptions.join(' ')}, ${componentName} will be ${valueDesc}`;
          if (employeeCount > 0) {
            groupDesc += `, affecting ${formatNumber(employeeCount)} employee${employeeCount !== 1 ? 's' : ''}`;
          }
          groupDesc += '.';
          groupDescriptions.push(groupDesc);
        }
      });
      
      if (groupDescriptions.length > 0) {
        explanation += groupDescriptions.join(' ');
      }
      
      // Add default/else case
      const baseExpr = generateBaseExpression();
      if (baseExpr && baseExpr !== '0') {
        let defaultDesc = '';
        switch (ruleType) {
          case 'fixed':
            defaultDesc = `set to ${fixedValue || '0'}`;
            break;
          case 'table':
            if (tableName && tableLookupField) {
              defaultDesc = `looked up from table "${tableName}" using ${tableLookupField}`;
            } else {
              defaultDesc = 'looked up from table';
            }
            break;
          case 'percentage':
            if (percentageBase && percentageAmount) {
              defaultDesc = `calculated as ${percentageAmount}% of ${percentageBase}`;
            } else {
              defaultDesc = 'calculated as a percentage';
            }
            break;
          case 'capfloor':
            const capFloorText = capFloorType === 'cap' ? 'maximum' : 'minimum';
            if (capFloorComponent && capFloorValue) {
              defaultDesc = `limited to a ${capFloorText} of ${capFloorValue} for ${capFloorComponent}`;
            } else {
              defaultDesc = `limited to a ${capFloorText}`;
            }
            break;
        }
        explanation += ` For all other employees, ${componentName} will be ${defaultDesc}.`;
      }
    } else {
      // No filter groups - single rule for all employees
      const totalEmployees = employees.length;
      let actionDesc = '';
      
      switch (ruleType) {
        case 'fixed':
          actionDesc = `${componentName} will be set to a fixed value of ${fixedValue || '0'}`;
          break;
        case 'table':
          if (tableName && tableLookupField) {
            actionDesc = `${componentName} will be looked up from table "${tableName}" using field ${tableLookupField}`;
          } else {
            actionDesc = `${componentName} will be looked up from a table`;
          }
          break;
        case 'percentage':
          if (percentageBase && percentageAmount) {
            actionDesc = `${componentName} will be calculated as ${percentageAmount}% of ${percentageBase}`;
          } else {
            actionDesc = `${componentName} will be calculated as a percentage`;
          }
          break;
        case 'capfloor':
          const capFloorText = capFloorType === 'cap' ? 'maximum' : 'minimum';
          if (capFloorComponent && capFloorValue) {
            actionDesc = `A ${capFloorText} of ${capFloorValue} will be applied to ${capFloorComponent}`;
          } else {
            actionDesc = `A ${capFloorText} will be applied`;
          }
          break;
      }
      
      explanation = `${actionDesc}.`;
      if (totalEmployees > 0) {
        explanation += ` This applies to all ${totalEmployees} employee${totalEmployees !== 1 ? 's' : ''}.`;
      }
    }
    
    // Add effective dates if specified
    if (effectiveFrom || effectiveTo) {
      explanation += ' ';
      if (effectiveFrom) {
        explanation += `Effective from ${effectiveFrom}`;
        if (effectiveTo) {
          explanation += ` until ${effectiveTo}`;
        }
        explanation += '.';
      } else if (effectiveTo) {
        explanation += `Effective until ${effectiveTo}.`;
      }
    }
    
    return explanation;
  };

  // Load employees and calculate available fields
  useEffect(() => {
    if (!selectedRulesetId) return;
    
    let cancelled = false;
    (async () => {
      try {
        const empList = await employeeApi.list(tenantId);
        if (cancelled) return;
        
        setEmployees(empList);
        
        // Extract field metadata
        const fieldMeta = new Map<string, {type: 'string' | 'number'; values: Set<string>; min?: number; max?: number}>();
        
        for (const emp of empList) {
          const data = emp.data || {};
          for (const [key, rawVal] of Object.entries<any>(data)) {
            if (rawVal === null || rawVal === undefined) continue;
            const meta = fieldMeta.get(key) || {type: 'string', values: new Set<string>(), min: undefined, max: undefined};
            
            const str = String(rawVal).trim();
            const isNumeric = str !== '' && !Number.isNaN(Number(str));
            
            if (isNumeric) {
              const num = Number(str);
              if (meta.values.size === 0 || meta.type === 'number') {
                meta.type = 'number';
                meta.min = meta.min !== undefined ? Math.min(meta.min, num) : num;
                meta.max = meta.max !== undefined ? Math.max(meta.max, num) : num;
              }
            } else if (str !== '') {
              meta.type = 'string';
              meta.values.add(str);
            }
            fieldMeta.set(key, meta);
          }
        }
        
        const fields: Array<{name: string; type: 'string' | 'number'; values?: string[]; min?: number; max?: number}> = [];
        for (const [name, meta] of fieldMeta.entries()) {
          if (!name) continue;
          if (meta.type === 'number') {
            fields.push({name, type: 'number', values: [], min: meta.min, max: meta.max});
          } else {
            const values = Array.from(meta.values).filter(v => v !== '').sort();
            if (values.length > 0) {
              fields.push({name, type: 'string', values});
            }
          }
        }
        
        fields.sort((a, b) => a.name.localeCompare(b.name));
        setAvailableEmployeeFields(fields);
      } catch (e) {
        console.error('Failed to load employees:', e);
      }
    })();
    
    return () => { cancelled = true; };
  }, [tenantId, selectedRulesetId]);

  // Helper: Check if employee matches a filter condition
  const matchesFilter = (emp: Employee, filter: FilterCondition): boolean => {
    const data = emp.data || {};
    const fieldValue = data[filter.field];
    if (fieldValue === null || fieldValue === undefined) {
      return false;
    }
    
    const fieldMeta = availableEmployeeFields.find(f => f.name === filter.field);
    const isNumeric = fieldMeta?.type === 'number';
    const numValue = isNumeric ? Number(fieldValue) : null;
    const strValue = String(fieldValue).trim();
    
    switch (filter.operator) {
      case 'equals':
        return isNumeric ? numValue === Number(filter.value) : strValue === filter.value;
      case 'not_equals':
        return isNumeric ? numValue !== Number(filter.value) : strValue !== filter.value;
      case 'greater_than':
        return isNumeric && numValue !== null ? numValue > Number(filter.value) : false;
      case 'less_than':
        return isNumeric && numValue !== null ? numValue < Number(filter.value) : false;
      case 'in_range':
        return isNumeric && numValue !== null && filter.value2
          ? numValue >= Number(filter.value) && numValue <= Number(filter.value2)
          : false;
      default:
        return false;
    }
  };

  // Helper: Check if employee matches a filter group
  const matchesFilterGroup = (emp: Employee, group: FilterGroup): boolean => {
    if (group.filters.length === 0) return true;
    
    // Evaluate filters with AND/OR logic
    let result = matchesFilter(emp, group.filters[0]);
    
    for (let i = 1; i < group.filters.length; i++) {
      const filter = group.filters[i];
      const filterResult = matchesFilter(emp, filter);
      const logic = group.filters[i - 1].logic || 'AND';
      
      if (logic === 'AND') {
        result = result && filterResult;
      } else {
        result = result || filterResult;
      }
    }
    
    return result;
  };

  // Calculate filtered employee count for each group
  useEffect(() => {
    const counts: Record<string, number> = {};
    
    for (const group of filterGroups) {
      let count = 0;
      for (const emp of employees) {
        if (matchesFilterGroup(emp, group)) {
          count++;
        }
      }
      counts[group.id] = count;
    }
    
    setFilteredEmployeeCounts(counts);
  }, [filterGroups, employees, availableEmployeeFields]);

  // Auto-generate expression when structured inputs change
  useEffect(() => {
    if (!expertMode && ruleType) {
      const generated = generateExpressionFromStructured();
      if (generated) {
        setExpression(generated);
      }
    }
  }, [ruleType, fixedValue, tableComponent, tableName, tableLookupField, percentageBase, percentageAmount, capFloorType, capFloorComponent, capFloorValue, filterGroups, expertMode]);

  // When expert mode is turned off, try to parse existing expression
  useEffect(() => {
    if (!expertMode && expression && !ruleType) {
      parseExpressionToStructured(expression);
    }
  }, [expertMode]);

  const handleSave = async () => {
    if (!selectedRulesetId || !target) {
      showToast("info", "Required fields", "Target component is required.");
      return;
    }
    
    // If using structured builder, generate expression from filter groups
    if (!expertMode) {
      // Check if there are any groups with rule types configured (filters are optional)
      const hasGroupsWithRuleTypes = filterGroups.some(g => g.ruleType !== null);
      
      if (hasGroupsWithRuleTypes) {
        const generated = generateExpressionFromStructured();
        if (!generated) {
          showToast("info", "Incomplete rule", "Please complete all required fields for the calculation method.");
          return;
        }
        setExpression(generated);
      } else {
        // No groups with rule types configured
        showToast("info", "Incomplete rule", "Please select a calculation method for at least one filter group.");
        return;
      }
    }
    
    if (!expression) {
      showToast("info", "Required fields", "Expression is required.");
      return;
    }

    try {
      setSaving(true);
      isSavingRef.current = true; // Set flag to prevent reload
      setError(null);
      
      // Convert group number back to group name for saving.
      // For Employer Cost layer we intentionally do NOT assign a component group
      // so employer components live in their own logical layer, independent of tenant groups.
      let actualGroupName: string | null = null;
      if (layer !== 'employer' && group) {
        actualGroupName = groupNumberToName[group];
        // If mapping doesn't exist (groups not loaded yet), default to first group or 'core'
        if (!actualGroupName && componentGroups.length > 0) {
          const sorted = [...componentGroups].sort((a, b) => a.displayOrder - b.displayOrder);
          actualGroupName = sorted[0]?.groupName || 'core';
        } else if (!actualGroupName) {
          actualGroupName = 'core'; // Fallback if no groups loaded
        }
      }
      
      // For employer cost components, all tax/pension flags should be false
      const isEmployer = layer === 'employer';
      
      await ruleApi.updateRule(tenantId, selectedRulesetId, target, {
        expression,
        dependsOn: dependsOn.length > 0 ? dependsOn : null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        group: actualGroupName,
        layer: layer || 'base',
        incomeTax: isEmployer ? false : incomeTax,
        socialSecurity: isEmployer ? false : socialSecurity,
        pension: isEmployer ? false : pensionFlag,
        workPension: isEmployer ? false : workPension,
        expensesPension: isEmployer ? false : expensesPension,
        educationFund: isEmployer ? false : educationFund,
        workPercent: isEmployer ? false : workPercentFlag,
      });

      // Reload ruleset to get updated data
      const updatedRuleset = await rulesetApi.getRuleset(tenantId, selectedRulesetId);
      
      // Mark this component as draft (has unpublished changes)
      setDraftComponents(prev => ({ ...prev, [target]: true }));
      
      // Update ruleset state, but delay it slightly to ensure isSavingRef is still set
      // This prevents the useEffect from triggering loadRuleData
      setRuleset(updatedRuleset);
      
      // Clear the saving flag after a brief delay to allow state to settle
      setTimeout(() => {
        isSavingRef.current = false;
      }, 200);
      
      showToast('success', 'Rule saved', `Component "${target}" was updated.`);
    } catch (err: any) {
      const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: err.message,
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
      showToast("error", "Couldn't save rule", "Please try again.");
    } finally {
      setSaving(false);
      // Clear the saving flag even on error
      setTimeout(() => {
        isSavingRef.current = false;
      }, 100);
    }
  };

  const handleValidate = async () => {
    if (!selectedRulesetId) {
      showToast("info", "Select a ruleset", "Please select a ruleset before validating.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setLastValidationStatus("idle");

      const result = await ruleApi.validate(tenantId, selectedRulesetId);
      const issues = result.issues || [];
      setValidationResults(issues);

      // Treat as success when there are no issues with severity 'error'
      const hasErrors = issues.some((i) => i.severity.toLowerCase() === 'error');

      if (!hasErrors) {
        setLastValidationStatus("success");
        setLastValidationTime(new Date().toLocaleString());
      } else {
        setLastValidationStatus("error");
        setLastValidationTime(new Date().toLocaleString());
      }
    } catch (err: any) {
      const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: err.message,
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
      setLastValidationStatus("error");
      setLastValidationTime(new Date().toLocaleString());
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedRulesetId) {
      showToast("info", "Select a ruleset", "Please select a ruleset before publishing.");
      return;
    }

    // Show confirmation dialog with impact summary
    setShowPublishConfirmDialog(true);
  };

  const confirmPublish = async () => {
    if (!selectedRulesetId) return;

    try {
      setSaving(true);
      setError(null);
      setShowPublishConfirmDialog(false);
      
      await rulesetApi.publish(tenantId, selectedRulesetId);
      showToast('success', 'Ruleset published', 'The active ruleset is now updated.');
      
      // Reload rulesets
      await loadRulesets();
      // Clear all draft markers after publish
      setDraftComponents({});
    } catch (err: any) {
      const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: err.message,
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
      showToast("error", "Couldn't publish ruleset", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRenameRuleset = async () => {
    if (!selectedRulesetId || !newRulesetName.trim()) {
      setRulesetNameError("Ruleset name is required");
      showToast("info", "Ruleset name required", "Please enter a ruleset name.");
      return;
    }
    // Validate no slashes in name
    if (newRulesetName.includes('/') || newRulesetName.includes('\\')) {
      setRulesetNameError("Ruleset name cannot contain slashes (/) or backslashes (\\)");
      return;
    }
    setRulesetNameError(null);
    try {
      setSaving(true);
      setError(null);
      await rulesetApi.rename(tenantId, selectedRulesetId, newRulesetName.trim());
      showToast('success', 'Ruleset renamed', `Ruleset is now called "${newRulesetName.trim()}".`);
      setShowRenameRulesetDialog(false);
      setNewRulesetName('');
      setRulesetNameError(null);
      await loadRulesets();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to rename ruleset';
      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch');
      const isValidationError = errorMessage.includes('cannot contain slashes') || errorMessage.includes('slashes');
      setError({
        type: isValidationError ? 'validation' : (isNetworkError ? 'network' : 'system'),
        message: errorMessage,
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
      showToast("error", "Couldn't rename ruleset", errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyRuleset = async () => {
    if (!selectedRulesetId || !newRulesetName.trim()) {
      setRulesetNameError("Ruleset name is required");
      showToast("info", "Ruleset name required", "Please enter a ruleset name.");
      return;
    }
    // Validate no slashes in name
    if (newRulesetName.includes('/') || newRulesetName.includes('\\')) {
      setRulesetNameError("Ruleset name cannot contain slashes (/) or backslashes (\\)");
      return;
    }
    setRulesetNameError(null);
    try {
      setSaving(true);
      setError(null);
      const res = await rulesetApi.copy(tenantId, selectedRulesetId, newRulesetName.trim());
      showToast('success', 'Ruleset copied', `New ruleset "${res.name}" was created.`);
      setShowCopyRulesetDialog(false);
      setNewRulesetName('');
      setRulesetNameError(null);
      // Reload list and select the new ruleset
      await loadRulesets();
      setSelectedRulesetId(res.rulesetId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to copy ruleset';
      const isValidationError = errorMessage.includes('cannot contain slashes') || errorMessage.includes('slashes');
      if (isValidationError) {
        setError({
          type: 'validation',
          message: errorMessage,
        });
      }
      showToast("error", "Couldn't copy ruleset", errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRuleset = async () => {
    if (!selectedRulesetId) {
      setError({
        type: 'validation',
        message: 'Please select a ruleset to delete',
      });
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await rulesetApi.delete(tenantId, selectedRulesetId);
      showToast('success', 'Ruleset deleted', 'The ruleset and its rules were removed.');
      setShowDeleteRulesetDialog(false);
      // Clear current selection and reload list
      setSelectedRulesetId(null);
      setRuleset(null);
      setComponents([]);
      await loadRulesets();
    } catch (err: any) {
      const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch');
      const errorMessage = err.message || 'Failed to delete ruleset';
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: errorMessage,
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
      showToast('error', 'Failed to delete ruleset', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRuleset = async () => {
    if (!newRulesetName.trim()) {
      setRulesetNameError("Ruleset name is required");
      showToast("info", "Ruleset name required", "Please enter a ruleset name.");
      return;
    }
    // Validate no slashes in name
    if (newRulesetName.includes('/') || newRulesetName.includes('\\')) {
      setRulesetNameError("Ruleset name cannot contain slashes (/) or backslashes (\\)");
      return;
    }
    setRulesetNameError(null);
    try {
      setSaving(true);
      setError(null);
      const response = await rulesetApi.create({
        name: newRulesetName.trim(),
        tenantId,
        rules: [],
      });
      showToast('success', 'Ruleset created', `New ruleset "${newRulesetName.trim()}" was created.`);
      setShowCreateRulesetDialog(false);
      setNewRulesetName('');
      setRulesetNameError(null);
      // Reload list and select the new ruleset
      await loadRulesets();
      setSelectedRulesetId(response.rulesetId);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create ruleset';
      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch');
      const isValidationError = errorMessage.includes('cannot contain slashes') || errorMessage.includes('slashes');
      setError({
        type: isValidationError ? 'validation' : (isNetworkError ? 'network' : 'system'),
        message: errorMessage,
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
      showToast("error", "Couldn't create ruleset", errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComponent = async (componentName: string) => {
    if (!selectedRulesetId) {
      setError({
        type: 'validation',
        message: 'Please select a ruleset',
      });
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
        setGroup('group1');
        setIncomeTax(false);
        setSocialSecurity(false);
        setPensionFlag(false);
        setWorkPension(false);
        setExpensesPension(false);
        setEducationFund(false);
        setWorkPercentFlag(false);
      }
      
      showToast('success', 'Component deleted', `"${componentName}" was removed from the ruleset.`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete component');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!groupFormData.groupName.trim() || !groupFormData.displayName.trim()) {
      showToast('info', 'Required fields', 'Group name and display name are required.');
      return;
    }

    try {
      setSaving(true);
      if (editingGroup) {
        await componentGroupsApi.update(
          editingGroup.groupName,
          groupFormData.displayName,
          groupFormData.color,
          groupFormData.displayOrder
        );
        showToast('success', 'Group Updated', `"${groupFormData.displayName}" was updated successfully.`);
      } else {
        await componentGroupsApi.create(
          groupFormData.groupName,
          groupFormData.displayName,
          groupFormData.color,
          groupFormData.displayOrder
        );
        showToast('success', 'Group Created', `"${groupFormData.displayName}" was created successfully.`);
      }
      
      // Reload groups (mappings will be automatically recomputed by useMemo)
      const groups = await componentGroupsApi.getAll();
      setComponentGroups(groups);
      
      setShowGroupDialog(false);
      setEditingGroup(null);
      setGroupFormData({ groupName: '', displayName: '', color: '#1FB5B8', displayOrder: 1 });
    } catch (err: any) {
      showToast('error', "Couldn't save group", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupNameToDelete) return;

    try {
      setSaving(true);
      await componentGroupsApi.delete(groupNameToDelete);
      showToast('success', 'Group Deleted', `Group was deleted successfully.`);
      
      // Reload groups (mappings will be automatically recomputed by useMemo)
      const groups = await componentGroupsApi.getAll();
      setComponentGroups(groups);
      
      setShowDeleteGroupDialog(false);
      setGroupNameToDelete(null);
    } catch (err: any) {
      showToast('error', "Couldn't delete group", "Please try again.");
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

  // Helper function to parse boolean values from strings
  const parseBoolean = (value: string | null | undefined): boolean => {
    if (!value) return false;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
  };

  const parseCSV = (csvText: string): Array<{ 
    componentName: string; 
    expression: string; 
    group: string;
    incomeTax?: boolean;
    socialSecurity?: boolean;
    pension?: boolean;
    workPension?: boolean;
    expensesPension?: boolean;
    educationFund?: boolean;
    workPercent?: boolean;
  }> => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Always skip first row (header)
    const dataLines = lines.slice(1);

    const results: Array<{ 
      componentName: string; 
      expression: string; 
      group: string;
      incomeTax?: boolean;
      socialSecurity?: boolean;
      pension?: boolean;
      workPension?: boolean;
      expensesPension?: boolean;
      educationFund?: boolean;
      workPercent?: boolean;
    }> = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      // Improved CSV parsing (handles quoted fields and escaped quotes)
      const fields: string[] = [];
      let currentField = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            currentField += '"';
            j++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // End of field
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      // Add last field
      fields.push(currentField.trim());

      // Map by position: column 0 = name, column 1 = expression, column 2 = group
      // Optional columns 3-9 = flags (incomeTax, socialSecurity, pension, workPension, expensesPension, educationFund, workPercent)
      if (fields.length < 3) {
        throw new Error(`Row ${i + 2}: Expected at least 3 columns (component name, rule expression, group), found ${fields.length}`);
      }

      const componentName = fields[0]?.replace(/^"|"$/g, '').trim() || '';
      const expression = fields[1]?.replace(/^"|"$/g, '').trim() || '';
      const group = fields[2]?.replace(/^"|"$/g, '').trim() || '';

      if (!componentName) {
        throw new Error(`Row ${i + 2}: Component name (column 1) is required`);
      }
      if (!expression) {
        throw new Error(`Row ${i + 2}: Rule expression (column 2) is required`);
      }
      if (!group) {
        throw new Error(`Row ${i + 2}: Group (column 3) is required`);
      }

      // Parse optional flag columns (default to false if not provided)
      const result: {
        componentName: string;
        expression: string;
        group: string;
        incomeTax?: boolean;
        socialSecurity?: boolean;
        pension?: boolean;
        workPension?: boolean;
        expensesPension?: boolean;
        educationFund?: boolean;
        workPercent?: boolean;
      } = { componentName, expression, group };

      // Column 3: incomeTax
      if (fields.length > 3) {
        result.incomeTax = parseBoolean(fields[3]);
      }
      // Column 4: socialSecurity
      if (fields.length > 4) {
        result.socialSecurity = parseBoolean(fields[4]);
      }
      // Column 5: pension
      if (fields.length > 5) {
        result.pension = parseBoolean(fields[5]);
      }
      // Column 6: workPension
      if (fields.length > 6) {
        result.workPension = parseBoolean(fields[6]);
      }
      // Column 7: expensesPension
      if (fields.length > 7) {
        result.expensesPension = parseBoolean(fields[7]);
      }
      // Column 8: educationFund
      if (fields.length > 8) {
        result.educationFund = parseBoolean(fields[8]);
      }
      // Column 9: workPercent
      if (fields.length > 9) {
        result.workPercent = parseBoolean(fields[9]);
      }

      results.push(result);
    }

    return results;
  };

  const parseXLSX = (file: File): Promise<Array<{ 
    componentName: string; 
    expression: string; 
    group: string;
    incomeTax?: boolean;
    socialSecurity?: boolean;
    pension?: boolean;
    workPension?: boolean;
    expensesPension?: boolean;
    educationFund?: boolean;
    workPercent?: boolean;
  }>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          
          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            reject(new Error('Excel file has no sheets'));
            return;
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

          if (rows.length === 0) {
            reject(new Error('Excel file is empty'));
            return;
          }

          // Always skip first row (header)
          const dataRows = rows.slice(1);

          const results: Array<{ 
            componentName: string; 
            expression: string; 
            group: string;
            incomeTax?: boolean;
            socialSecurity?: boolean;
            pension?: boolean;
            workPension?: boolean;
            expensesPension?: boolean;
            educationFund?: boolean;
            workPercent?: boolean;
          }> = [];

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            
            // Skip empty rows
            if (!row || row.length === 0 || (row[0] === '' && row[1] === '' && row[2] === '')) {
              continue;
            }

            // Map by position: column 0 = name, column 1 = expression, column 2 = group
            // Optional columns 3-9 = flags (incomeTax, socialSecurity, pension, workPension, expensesPension, educationFund, workPercent)
            if (row.length < 3) {
              reject(new Error(`Row ${i + 2}: Expected at least 3 columns (component name, rule expression, group), found ${row.length}`));
              return;
            }

            const componentName = String(row[0] || '').trim();
            const expression = String(row[1] || '').trim();
            const group = String(row[2] || '').trim();

            if (!componentName) {
              reject(new Error(`Row ${i + 2}: Component name (column 1) is required`));
              return;
            }
            if (!expression) {
              reject(new Error(`Row ${i + 2}: Rule expression (column 2) is required`));
              return;
            }
            if (!group) {
              reject(new Error(`Row ${i + 2}: Group (column 3) is required`));
              return;
            }

            // Parse optional flag columns (default to false if not provided)
            const result: {
              componentName: string;
              expression: string;
              group: string;
              incomeTax?: boolean;
              socialSecurity?: boolean;
              pension?: boolean;
              workPension?: boolean;
              expensesPension?: boolean;
              educationFund?: boolean;
              workPercent?: boolean;
            } = { componentName, expression, group };

            // Column 3: incomeTax
            if (row.length > 3) {
              result.incomeTax = parseBoolean(row[3]);
            }
            // Column 4: socialSecurity
            if (row.length > 4) {
              result.socialSecurity = parseBoolean(row[4]);
            }
            // Column 5: pension
            if (row.length > 5) {
              result.pension = parseBoolean(row[5]);
            }
            // Column 6: workPension
            if (row.length > 6) {
              result.workPension = parseBoolean(row[6]);
            }
            // Column 7: expensesPension
            if (row.length > 7) {
              result.expensesPension = parseBoolean(row[7]);
            }
            // Column 8: educationFund
            if (row.length > 8) {
              result.educationFund = parseBoolean(row[8]);
            }
            // Column 9: workPercent
            if (row.length > 9) {
              result.workPercent = parseBoolean(row[9]);
            }

            results.push(result);
          }

          resolve(results);
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleImportCSV = async (file: File) => {
    if (!selectedRulesetId) {
      setImportError('Please select a ruleset first');
      return;
    }

    try {
      setImporting(true);
      setImportError(null);

      let rows: Array<{ 
        componentName: string; 
        expression: string; 
        group: string;
        incomeTax?: boolean;
        socialSecurity?: boolean;
        pension?: boolean;
        workPension?: boolean;
        expensesPension?: boolean;
        educationFund?: boolean;
        workPercent?: boolean;
      }>;
      
      // Check file extension
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse XLSX file
        rows = await parseXLSX(file);
      } else {
        // Parse CSV file
        const text = await file.text();
        rows = parseCSV(text);
      }

      if (rows.length === 0) {
        setImportError('No valid rows found in CSV file');
        return;
      }

      // Convert group numbers/names to actual group names
      const getActualGroupName = (groupInput: string): string => {
        // First, normalize the input
        let normalizedInput = groupInput.trim();
        
        // If it's just a number (1, 2, 3, etc.), convert to "group1", "group2", etc.
        const numericMatch = normalizedInput.match(/^\d+$/);
        if (numericMatch) {
          normalizedInput = `group${normalizedInput}`;
        }
        
        // Check if it's a group number (group1, group2, etc.)
        if (groupNumberToName[normalizedInput]) {
          return groupNumberToName[normalizedInput];
        }
        // Check if it's already a group name
        if (componentGroups.some(g => g.groupName.toLowerCase() === normalizedInput.toLowerCase())) {
          return normalizedInput;
        }
        // Default to 'core' if not found
        return 'core';
      };

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Import each rule
      for (const row of rows) {
        try {
          const actualGroupName = getActualGroupName(row.group);
          
          await ruleApi.updateRule(tenantId, selectedRulesetId, row.componentName, {
            expression: row.expression,
            dependsOn: null,
            effectiveFrom: null,
            effectiveTo: null,
            group: actualGroupName,
            layer: 'base',
            incomeTax: row.incomeTax ?? false,
            socialSecurity: row.socialSecurity ?? false,
            pension: row.pension ?? false,
            workPension: row.workPension ?? false,
            expensesPension: row.expensesPension ?? false,
            educationFund: row.educationFund ?? false,
            workPercent: row.workPercent ?? false,
          });
          successCount++;
        } catch (err: any) {
          errorCount++;
          errors.push(`${row.componentName}: ${err.message || 'Failed to import'}`);
        }
      }

      // Reload ruleset to show imported rules
      await loadRuleset(selectedRulesetId);

      if (errorCount === 0) {
        showToast('success', 'Import successful', `Successfully imported ${successCount} rule(s).`);
        setShowImportDialog(false);
      } else if (successCount > 0) {
        showToast('info', 'Partial import', `Imported ${successCount} rule(s), ${errorCount} failed. Check console for details.`);
        console.error('Import errors:', errors);
        setImportError(`Imported ${successCount} rule(s), ${errorCount} failed:\n${errors.join('\n')}`);
      } else {
        setImportError(`Failed to import all rules:\n${errors.join('\n')}`);
      }
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse CSV file');
    } finally {
      setImporting(false);
    }
  };

  const handleAddComponent = async () => {
    if (!selectedRulesetId || !newComponentName.trim()) {
      setError({
        type: 'validation',
        message: 'Component name is required',
      });
      return;
    }

    // Check if component already exists
    if (components.some(c => c.name === newComponentName.trim())) {
      setError({
        type: 'validation',
        message: 'Component with this name already exists',
      });
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      // Create a new rule with the new component name as target
      // Start with a simple default expression (e.g., 0 or BaseSalary)
      const defaultExpression = '0';
      
      // Convert group number back to group name for saving
      // For Employer Cost layer we intentionally do NOT assign a component group
      let actualGroupName: string | null = null;
      if (newComponentLayer === 'base' && newComponentGroup) {
        actualGroupName = groupNumberToName[newComponentGroup];
        // If mapping doesn't exist (groups not loaded yet), default to first group or 'core'
        if (!actualGroupName && componentGroups.length > 0) {
          const sorted = [...componentGroups].sort((a, b) => a.displayOrder - b.displayOrder);
          actualGroupName = sorted[0]?.groupName || 'core';
        } else if (!actualGroupName) {
          actualGroupName = 'core'; // Fallback if no groups loaded
        }
      }
      // For employer cost layer, actualGroupName remains null
      
      await ruleApi.updateRule(tenantId, selectedRulesetId, newComponentName.trim(), {
        expression: defaultExpression,
        dependsOn: null,
        effectiveFrom: null,
        effectiveTo: null,
        group: actualGroupName,
        layer: newComponentLayer,
        incomeTax: false,
      });

      // Reload ruleset to get the new component
      await loadRuleset(selectedRulesetId);
      
      // Select the new component
      setSelectedComponent(newComponentName.trim());
      
      // Reset form and close dialog
      setNewComponentName('');
      setNewComponentGroup('group1');
      setNewComponentLayer('base');
      setShowAddComponent(false);
      
      // Load the new rule data
      loadRuleData(newComponentName.trim());
    } catch (err: any) {
      const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: err.message || 'Failed to add component',
        supportRef: err.response?.status ? `HTTP-${err.response.status}` : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  // Map group numbers to colors from componentGroups
  const groupColors: Record<string, string> = React.useMemo(() => {
    const colors: Record<string, string> = {};
    // Add special color for Employer Cost layer
    colors['Employer Cost'] = 'bg-red-100 text-red-800';
    
    componentGroups
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach((group, index) => {
        const groupNumber = `group${index + 1}`;
        // Convert hex color to Tailwind classes (simplified mapping)
        // For now, use a default set of colors based on index
        const colorClasses = [
          'bg-cyan-100 text-cyan-800',
          'bg-green-100 text-green-800',
          'bg-yellow-100 text-yellow-800',
          'bg-purple-100 text-purple-800',
          'bg-orange-100 text-orange-800',
          'bg-pink-100 text-pink-800',
        ];
        colors[groupNumber] = colorClasses[index % colorClasses.length];
      });
    return colors;
  }, [componentGroups]);

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
  
  const availableComponents = components.map(c => c.name);

  // Show empty state if no rulesets (but not an error - API call succeeded)
  if (!loading && !error && rulesets.length === 0) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <h1 className="text-[#1E1E1E] mb-6">Rules</h1>
        <StateScreen
          type="empty"
          title="No rulesets yet"
          description="Build your first ruleset now to start creating salary calculation rules."
          primaryActionLabel="Create Ruleset"
          onPrimaryAction={() => {
            setNewRulesetName('');
            setRulesetNameError(null);
            setShowCreateRulesetDialog(true);
          }}
        />
        
        {/* Create New Ruleset Dialog - needed even in empty state */}
        <Dialog open={showCreateRulesetDialog} onOpenChange={(open) => {
          if (!open) {
            setRulesetNameError(null);
          }
          setShowCreateRulesetDialog(open);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Ruleset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label htmlFor="create-ruleset-name">Ruleset Name</Label>
                <Input
                  id="create-ruleset-name"
                  value={newRulesetName}
                  onChange={(e) => {
                    setNewRulesetName(e.target.value);
                    // Clear error when user starts typing
                    if (rulesetNameError) {
                      setRulesetNameError(null);
                    }
                    // Real-time validation
                    if (e.target.value.includes('/') || e.target.value.includes('\\')) {
                      setRulesetNameError("Ruleset name cannot contain slashes (/) or backslashes (\\)");
                    }
                  }}
                  placeholder="Enter name for the new ruleset"
                  className={`mt-1 ${rulesetNameError ? 'border-red-500' : ''}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newRulesetName.trim() && !saving && !rulesetNameError) {
                      handleCreateRuleset();
                    }
                  }}
                  autoFocus
                />
                {rulesetNameError ? (
                  <p className="text-xs text-red-600 mt-1">{rulesetNameError}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Ruleset name cannot contain slashes (/) or backslashes (\). A new empty ruleset will be created. You can add components to it after creation.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateRulesetDialog(false);
                  setNewRulesetName('');
                  setRulesetNameError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRuleset}
                disabled={!newRulesetName.trim() || saving || !!rulesetNameError}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Ruleset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <h1 className="text-[#1E1E1E] mb-6">Rules</h1>

      {error && (
        <div className="mb-4">
          <StateScreen
            type={error.type || 'system'}
            supportRef={error.supportRef}
            onPrimaryAction={() => {
              setError(null);
              if (error.type === 'network' || error.type === 'system') {
                window.location.reload();
              }
            }}
            inline
          />
        </div>
      )}

      {/* Main Content Area - Full Width */}
      <div>
        {/* Rule Builder Content */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[#1E1E1E]">Rule Builder</h2>
              <button
                onClick={() => setShowHelpGuide(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                title="How to Build Rules"
              >
                <HelpCircle className="w-4 h-4 text-gray-600" />
              </button>
              {/* AI Assistant button - temporarily disabled */}
              <button
                onClick={() => {}}
                disabled={true}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed opacity-60"
                title="AI Rule Assistant (Temporarily disabled - billing setup in progress)"
              >
                <Sparkles className="w-4 h-4" />
                AI Assistant
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowImportDialog(true)}
                disabled={!selectedRulesetId || importing}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl hover:bg-gray-100"
                title="Import rules from CSV"
              >
                <Upload className="w-5 h-5" />
                Import CSV
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl hover:bg-gray-100"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Draft
              </Button>
              <Button
                onClick={handleValidate}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl hover:bg-gray-100"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : lastValidationStatus === "success" ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : lastValidationStatus === "error" ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                {lastValidationStatus === "success" ? "Validated" : "Validate"}
              </Button>
              <Button
                onClick={handlePublish}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                Publish
              </Button>
            </div>
          </div>

          {/* Ruleset Selector */}
          <Card className="p-4 bg-white rounded-xl shadow-sm border-0 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="ruleset" className="min-w-[100px]">Ruleset</Label>
                {!loading && rulesets.length === 0 ? (
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-500">No rulesets available</div>
                    <Button
                      onClick={() => {
                        setNewRulesetName(`Ruleset ${new Date().toLocaleDateString()}`);
                        setRulesetNameError(null);
                        setShowCreateRulesetDialog(true);
                      }}
                      className="flex items-center gap-2"
                      size="sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create First Ruleset
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={selectedRulesetId || ''}
                    onValueChange={(value) => {
                      setSelectedRulesetId(value);
                      try {
                        const found = rulesets.find(rs => rs.rulesetId === value);
                        localStorage.setItem(GLOBAL_RULESET_KEY, JSON.stringify({
                          rulesetId: value,
                          name: found?.name || value,
                        }));
                      } catch {
                        // ignore storage errors
                      }
                    }}
                    disabled={loading || rulesets.length === 0}
                  >
                    <SelectTrigger id="ruleset" className="max-w-md">
                      <SelectValue placeholder="Select ruleset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rulesets.map((rs) => (
                        <SelectItem key={rs.rulesetId} value={rs.rulesetId}>
                          {rs.name || rs.rulesetId} {rs.status === 'ACTIVE' ? '(Active)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {lastValidationStatus === "success" && lastValidationTime && (
                  <div className="ml-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Ruleset is valid</span>
                    <span className="text-[10px] text-green-800/70">({lastValidationTime})</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedRulesetId}
                  onClick={() => {
                    const current = rulesets.find(r => r.rulesetId === selectedRulesetId);
                    setNewRulesetName(current?.name || '');
                    setRulesetNameError(null);
                    setShowRenameRulesetDialog(true);
                  }}
                >
                  Rename
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedRulesetId}
                  onClick={() => {
                    const current = rulesets.find(r => r.rulesetId === selectedRulesetId);
                    setNewRulesetName(current?.name ? `${current.name} Copy` : '');
                    setRulesetNameError(null);
                    setShowCopyRulesetDialog(true);
                  }}
                >
                  Copy &amp; Rename
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedRulesetId}
                  onClick={() => setShowDeleteRulesetDialog(true)}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left - Components List */}
            <div className="lg:col-span-1">
              <Card className="p-6 bg-white rounded-xl shadow-sm border-0 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <h3 className="text-[#1E1E1E]">Components</h3>
                  <button 
                    onClick={() => setShowAddComponent(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Add Component"
                  >
                    <Plus className="w-5 h-5 text-[#1FB5B8]" />
                  </button>
                </div>
                
                {/* Search Bar */}
                <div className="mb-4 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search components..."
                      value={componentSearchQuery}
                      onChange={(e) => setComponentSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                {/* Scrollable Component List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-2" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                  {components
                    .filter(component => 
                      componentSearchQuery === '' || 
                      component.name.toLowerCase().includes(componentSearchQuery.toLowerCase())
                    )
                    .map((component) => (
                    <div
                      key={component.id}
                      className={`p-4 rounded-lg transition-colors ${
                        selectedComponent === component.id
                          ? 'bg-black text-white'
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
                          {draftComponents[component.id] && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              selectedComponent === component.id
                                ? 'bg-yellow-300 text-[#1E1E1E]'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              Draft
                            </span>
                          )}
                          {getStatusIcon(component.status)}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Only safe to save when this component is the current target
                              if (component.name === target) {
                                handleSave();
                              } else {
                                setSelectedComponent(component.id);
                                loadRuleData(component.id);
                              }
                            }}
                            className={`p-1 rounded hover:bg-opacity-20 transition-colors ${
                              selectedComponent === component.id
                                ? 'hover:bg-white text-white'
                                : 'hover:bg-green-100 text-green-600'
                            }`}
                            title="Save component as draft"
                            disabled={saving}
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setComponentToDelete(component.name);
                              setShowDeleteComponentDialog(true);
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
                      <Badge className={selectedComponent === component.id ? 'bg-white bg-opacity-20 text-white' : (groupColors[component.group] || 'bg-gray-100 text-gray-800')}>
                        {component.group}
                      </Badge>
                    </div>
                  ))}
                  {components.filter(component => 
                    componentSearchQuery === '' || 
                    component.name.toLowerCase().includes(componentSearchQuery.toLowerCase())
                  ).length === 0 && componentSearchQuery && (
                    <div className="py-8">
                      <StateScreen
                        type="empty"
                        title="No components found"
                        description={`No components match "${componentSearchQuery}". Try a different search term.`}
                        inline
                      />
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right - Rule Editor */}
            <div className="lg:col-span-2">
              <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[#1E1E1E]">Rule Editor</h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="expert-mode" className="text-sm text-gray-600 cursor-pointer">Expert Mode</Label>
                    <Switch
                      id="expert-mode"
                      checked={expertMode}
                      onCheckedChange={setExpertMode}
                    />
                  </div>
                </div>

                {expertMode ? (
                  /* Expert Mode - Original Expression Editor */
                  <div className="space-y-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-900">Expert Mode Active</p>
                          <p className="text-xs text-yellow-800 mt-1">
                            You are bypassing the structured rule builder. Changes here may affect rule behavior. Use with caution.
                          </p>
                        </div>
                      </div>
                    </div>
                    
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
                          setTimeout(() => {
                            setAutocompleteSuggestions([]);
                            setAutocompletePosition(null);
                          }, 200);
                        }}
                        placeholder="e.g., BaseSalary * 1.05 or IF BaseSalary > 50000 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10"
                        className="mt-1 font-mono h-32"
                      />
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
                                e.preventDefault();
                                insertAutocompleteSuggestion(suggestion);
                              }}
                              className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                                index === autocompleteSelectedIndex ? 'bg-cyan-50' : ''
                              }`}
                            >
                              <span className="font-mono text-sm">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-gray-600 mt-2">
                        Supports: CamelCase components, IF-THEN-ELSE, MIN/MAX, ROUND, TBL, operators (+, -, *, /, =, !=, &gt;, &lt;, AND, OR, NOT)
                      </p>
                    </div>
                    
                    {/* Dependencies, Toggles, Group, Dates - shown in expert mode */}
                    <div>
                      <Label htmlFor="depends">Depends On</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {dependsOn.map((dep) => (
                          <Badge
                            key={dep}
                            className="bg-[#1FB5B8] text-white px-3 py-1 cursor-pointer"
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

                    <div className="grid grid-cols-3 gap-6">
                      {/* Tax & flags - only show for base layer */}
                      {layer !== 'employer' && (
                        <>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="incomeTax">Income Tax</Label>
                              <Switch id="incomeTax" checked={incomeTax} onCheckedChange={setIncomeTax} />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="socialSecurity">Social Security</Label>
                              <Switch
                                id="socialSecurity"
                                checked={socialSecurity}
                                onCheckedChange={setSocialSecurity}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="workPercentFlag">Apply Work %</Label>
                              <Switch
                                id="workPercentFlag"
                                checked={workPercentFlag}
                                onCheckedChange={setWorkPercentFlag}
                              />
                            </div>
                          </div>

                          {/* Pension flags */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="pensionFlag">Pension</Label>
                              <Switch
                                id="pensionFlag"
                                checked={pensionFlag}
                                onCheckedChange={setPensionFlag}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="workPension">Work Pension</Label>
                              <Switch
                                id="workPension"
                                checked={workPension}
                                onCheckedChange={setWorkPension}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="expensesPension">Expenses Pension</Label>
                              <Switch
                                id="expensesPension"
                                checked={expensesPension}
                                onCheckedChange={setExpensesPension}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="educationFund">Education Fund</Label>
                              <Switch
                                id="educationFund"
                                checked={educationFund}
                                onCheckedChange={setEducationFund}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Layer selector */}
                      <div className="space-y-3">
                        <Label>Layer</Label>
                        <div className="flex flex-col gap-2 text-sm">
                          <button
                            type="button"
                            onClick={() => {
                              setLayer('base');
                              // When switching to base, set default group if not already set
                              if (!group) {
                                setGroup('group1');
                              }
                            }}
                            className={`flex items-center justify-between px-3 py-2 border rounded-[6px] text-left ${
                              layer === 'base'
                                ? 'border-black bg-[#EEF2F8] text-[#0A0A0A]'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>Employee (Base)</span>
                            {layer === 'base' && <CheckCircle className="w-4 h-4 text-black" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLayer('employer');
                              setGroup('group1'); // Clear group by resetting to default
                              // Reset all tax/pension flags for employer cost components
                              setIncomeTax(false);
                              setSocialSecurity(false);
                              setPensionFlag(false);
                              setWorkPension(false);
                              setExpensesPension(false);
                              setEducationFund(false);
                              setWorkPercentFlag(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2 border rounded-[6px] text-left ${
                              layer === 'employer'
                                ? 'border-red-500 bg-red-50 text-[#0A0A0A]'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>Employer Cost</span>
                            {layer === 'employer' && <CheckCircle className="w-4 h-4 text-red-500" />}
                          </button>
                          <p className="text-xs text-gray-500 mt-1">
                            Employer Cost components are calculated on top of employee compensation and are
                            reported separately in simulations.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="group">Group</Label>
                          <span className="text-xs text-gray-500">
                            Groups apply to employee components. Employer Cost components don&apos;t need a group.
                          </span>
                        </div>
                        <Select
                          value={group}
                          onValueChange={setGroup}
                          disabled={layer === 'employer'}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {componentGroups
                              .sort((a, b) => a.displayOrder - b.displayOrder)
                              .map((group, index) => {
                                const groupNumber = `group${index + 1}`;
                                return (
                                  <SelectItem key={group.groupName} value={groupNumber}>
                                    {groupNumber}
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

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
                                  : 'bg-cyan-50 border border-cyan-200'
                              }`}
                            >
                              <AlertCircle
                                className={`w-5 h-5 mt-0.5 ${
                                  result.severity === 'error'
                                    ? 'text-red-600'
                                    : result.severity === 'warning'
                                    ? 'text-yellow-600'
                                    : 'text-cyan-600'
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
                ) : (
                  /* Structured Rule Builder */
                  <div className="space-y-6">
                    {/* Section 1: Rule Target (WHAT) */}
                    <div className="border-b border-gray-200 pb-6">
                      <h4 className="text-[#1E1E1E] font-semibold mb-4">1. Rule Target (WHAT)</h4>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="target">Target Component</Label>
                          <p className="text-sm text-gray-600 mt-1 mb-3">
                            This rule will calculate values for the selected component. Each filter group below can apply different calculation methods.
                          </p>
                          {availableComponents.length > 0 ? (
                            <Select
                              value={target}
                              onValueChange={setTarget}
                            >
                              <SelectTrigger id="target" className="mt-1">
                                <SelectValue placeholder="Select component..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableComponents.map((comp) => (
                                  <SelectItem key={comp} value={comp}>
                                    {comp}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id="target"
                              value={target}
                              onChange={(e) => setTarget(e.target.value)}
                              placeholder="e.g., Base Salary"
                              className="mt-1"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Filter Groups - Each group defines WHO and HOW */}
                    <div className="border-b border-gray-200 pb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[#1E1E1E] font-semibold">2. Filter Groups</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newGroup: FilterGroup = {
                              id: `group-${Date.now()}`,
                              filters: [],
                              ruleType: null,
                              fixedValue: '',
                              tableComponent: '',
                              tableName: '',
                              tableLookupField: '',
                              percentageBase: '',
                              percentageAmount: '',
                              capFloorType: 'cap',
                              capFloorComponent: '',
                              capFloorValue: '',
                            };
                            setFilterGroups([...filterGroups, newGroup]);
                          }}
                        >
                          + Add Group
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Each group defines which employees it applies to (WHO) and how the value is calculated (HOW). Groups are evaluated in order.
                      </p>
                      
                      <div className="space-y-4">
                        {filterGroups.length === 0 ? (
                          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-[10px]">
                            <p className="text-sm text-gray-600 mb-3">No filter groups defined</p>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const newGroup: FilterGroup = {
                                  id: `group-${Date.now()}`,
                                  filters: [],
                                  ruleType: null,
                                  fixedValue: '',
                                  tableComponent: '',
                                  tableName: '',
                                  tableLookupField: '',
                                  percentageBase: '',
                                  percentageAmount: '',
                                  capFloorType: 'cap',
                                  capFloorComponent: '',
                                  capFloorValue: '',
                                };
                                setFilterGroups([newGroup]);
                              }}
                            >
                              Create First Group
                            </Button>
                          </div>
                        ) : (
                          filterGroups.map((group, groupIdx) => (
                            <div key={group.id} className="bg-white border-2 border-gray-300 rounded-[10px] p-6 shadow-sm">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h5 className="text-lg font-semibold text-[#0A0A0A]">Group {groupIdx + 1}</h5>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {group.ruleType 
                                      ? `${group.ruleType === 'fixed' ? 'Fixed Value' : group.ruleType === 'percentage' ? 'Percentage' : group.ruleType === 'table' ? 'Table Lookup' : 'Cap/Floor'} • ${filteredEmployeeCounts[group.id] || 0} employees`
                                      : 'Configure filters and calculation method'}
                                  </p>
                                </div>
                                {filterGroups.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setFilterGroups(filterGroups.filter((_, i) => i !== groupIdx));
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            
                            {/* Filters for this group */}
                            <div className="space-y-2 mb-4">
                              {group.filters.map((filter, filterIdx) => (
                                <div key={filterIdx} className="flex items-center gap-2">
                                  {filterIdx > 0 && (
                                    <Select
                                      value={group.filters[filterIdx - 1].logic || 'AND'}
                                      onValueChange={(value) => {
                                        const updated = [...filterGroups];
                                        updated[groupIdx].filters[filterIdx - 1].logic = value as 'AND' | 'OR';
                                        setFilterGroups(updated);
                                      }}
                                    >
                                      <SelectTrigger className="w-20 min-w-[80px] font-medium">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="AND" className="font-medium">AND</SelectItem>
                                        <SelectItem value="OR" className="font-medium">OR</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                  
                                  <Select
                                    value={filter.field}
                                    onValueChange={(value) => {
                                      const updated = [...filterGroups];
                                      updated[groupIdx].filters[filterIdx].field = value;
                                      const fieldMeta = availableEmployeeFields.find(f => f.name === value);
                                      if (fieldMeta) {
                                        updated[groupIdx].filters[filterIdx].operator = fieldMeta.type === 'number' ? 'greater_than' : 'equals';
                                      }
                                      setFilterGroups(updated);
                                    }}
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue placeholder="Field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableEmployeeFields.map((f) => (
                                        <SelectItem key={f.name} value={f.name}>
                                          {f.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  <Select
                                    value={filter.operator}
                                    onValueChange={(value) => {
                                      const updated = [...filterGroups];
                                      updated[groupIdx].filters[filterIdx].operator = value as typeof filter.operator;
                                      setFilterGroups(updated);
                                    }}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="equals">Equals</SelectItem>
                                      <SelectItem value="not_equals">Not Equals</SelectItem>
                                      <SelectItem value="greater_than">Greater Than</SelectItem>
                                      <SelectItem value="less_than">Less Than</SelectItem>
                                      <SelectItem value="in_range">In Range</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  
                                  {filter.operator === 'in_range' ? (
                                    <>
                                      <Input
                                        type={availableEmployeeFields.find(f => f.name === filter.field)?.type === 'number' ? 'number' : 'text'}
                                        value={filter.value}
                                        onChange={(e) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].filters[filterIdx].value = e.target.value;
                                          setFilterGroups(updated);
                                        }}
                                        placeholder="Min"
                                        className="w-24"
                                      />
                                      <span className="text-gray-500 text-sm">to</span>
                                      <Input
                                        type={availableEmployeeFields.find(f => f.name === filter.field)?.type === 'number' ? 'number' : 'text'}
                                        value={filter.value2 || ''}
                                        onChange={(e) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].filters[filterIdx].value2 = e.target.value;
                                          setFilterGroups(updated);
                                        }}
                                        placeholder="Max"
                                        className="w-24"
                                      />
                                    </>
                                  ) : (
                                    <Input
                                      type={availableEmployeeFields.find(f => f.name === filter.field)?.type === 'number' ? 'number' : 'text'}
                                      value={filter.value}
                                      onChange={(e) => {
                                        const updated = [...filterGroups];
                                        updated[groupIdx].filters[filterIdx].value = e.target.value;
                                        setFilterGroups(updated);
                                      }}
                                      placeholder="Value"
                                      className="w-32"
                                    />
                                  )}
                                  
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = [...filterGroups];
                                      updated[groupIdx].filters = updated[groupIdx].filters.filter((_, i) => i !== filterIdx);
                                      setFilterGroups(updated);
                                    }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (availableEmployeeFields.length > 0) {
                                    const updated = [...filterGroups];
                                    updated[groupIdx].filters.push({
                                      field: availableEmployeeFields[0].name,
                                      operator: availableEmployeeFields[0].type === 'number' ? 'greater_than' : 'equals',
                                      value: '',
                                      logic: 'AND'
                                    });
                                    setFilterGroups(updated);
                                  }
                                }}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Condition
                              </Button>
                            </div>
                            
                            {/* HOW: Rule type and parameters for this group */}
                            <div className="border-t border-gray-300 pt-4 mt-4">
                              <Label className="text-base font-semibold text-[#0A0A0A] mb-3 block">Calculation Method (HOW)</Label>
                              <div className="mb-4">
                                <Label className="mb-3 block text-sm">Select how to calculate the value for this group:</Label>
                                <div className="grid grid-cols-2 gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...filterGroups];
                                      updated[groupIdx].ruleType = 'fixed';
                                      setFilterGroups(updated);
                                    }}
                                    className={`p-4 rounded-[10px] border-2 text-left transition-all ${
                                      group.ruleType === 'fixed'
                                        ? 'border-[#1FB5B8] bg-cyan-50'
                                        : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="font-semibold text-[#0A0A0A] mb-1">Fixed Value</div>
                                    <div className="text-xs text-gray-600">Set a constant amount</div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...filterGroups];
                                      updated[groupIdx].ruleType = 'percentage';
                                      setFilterGroups(updated);
                                    }}
                                    className={`p-4 rounded-[10px] border-2 text-left transition-all ${
                                      group.ruleType === 'percentage'
                                        ? 'border-[#1FB5B8] bg-cyan-50'
                                        : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="font-semibold text-[#0A0A0A] mb-1">Percentage Adjustment</div>
                                    <div className="text-xs text-gray-600">Calculate as % of base</div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...filterGroups];
                                      updated[groupIdx].ruleType = 'table';
                                      setFilterGroups(updated);
                                    }}
                                    className={`p-4 rounded-[10px] border-2 text-left transition-all ${
                                      group.ruleType === 'table'
                                        ? 'border-[#1FB5B8] bg-cyan-50'
                                        : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="font-semibold text-[#0A0A0A] mb-1">Table Lookup</div>
                                    <div className="text-xs text-gray-600">Look up value from table</div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...filterGroups];
                                      updated[groupIdx].ruleType = 'capfloor';
                                      setFilterGroups(updated);
                                    }}
                                    className={`p-4 rounded-[10px] border-2 text-left transition-all ${
                                      group.ruleType === 'capfloor'
                                        ? 'border-[#1FB5B8] bg-cyan-50'
                                        : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="font-semibold text-[#0A0A0A] mb-1">Cap / Floor</div>
                                    <div className="text-xs text-gray-600">Apply min/max limits</div>
                                  </button>
                                </div>
                                {group.ruleType && (
                                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                                    <span className="font-medium">Selected:</span>
                                    <span className="text-[#1FB5B8] font-semibold">
                                      {group.ruleType === 'fixed' && 'Fixed Value'}
                                      {group.ruleType === 'percentage' && 'Percentage Adjustment'}
                                      {group.ruleType === 'table' && 'Table Lookup'}
                                      {group.ruleType === 'capfloor' && 'Cap / Floor'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...filterGroups];
                                        updated[groupIdx].ruleType = null;
                                        setFilterGroups(updated);
                                      }}
                                      className="text-gray-400 hover:text-gray-600 underline text-xs ml-2"
                                    >
                                      Change
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-4 mt-4">
                                
                                {group.ruleType === 'fixed' && (
                                  <div>
                                    <Label htmlFor={`group-fixed-${groupIdx}`}>Fixed Value</Label>
                                    <Input
                                      id={`group-fixed-${groupIdx}`}
                                      type="number"
                                      value={group.fixedValue}
                                      onChange={(e) => {
                                        const updated = [...filterGroups];
                                        updated[groupIdx].fixedValue = e.target.value;
                                        setFilterGroups(updated);
                                      }}
                                      placeholder="Enter value"
                                      className="mt-1"
                                    />
                                  </div>
                                )}
                                
                                {group.ruleType === 'table' && (
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor={`group-table-component-${groupIdx}`}>Table Component</Label>
                                      <Select
                                        value={group.tableComponent}
                                        onValueChange={(value) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].tableComponent = value;
                                          setFilterGroups(updated);
                                        }}
                                      >
                                        <SelectTrigger id={`group-table-component-${groupIdx}`} className="mt-1">
                                          <SelectValue placeholder="Select component..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableDependencies.map((comp) => (
                                            <SelectItem key={comp} value={comp}>
                                              {comp}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor={`group-table-name-${groupIdx}`}>Table Name</Label>
                                      <Input
                                        id={`group-table-name-${groupIdx}`}
                                        value={group.tableName}
                                        onChange={(e) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].tableName = e.target.value;
                                          setFilterGroups(updated);
                                        }}
                                        placeholder="Enter table name"
                                        className="mt-1"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor={`group-table-lookup-${groupIdx}`}>Lookup Field</Label>
                                      <Input
                                        id={`group-table-lookup-${groupIdx}`}
                                        value={group.tableLookupField}
                                        onChange={(e) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].tableLookupField = e.target.value;
                                          setFilterGroups(updated);
                                        }}
                                        placeholder="Enter lookup field"
                                        className="mt-1"
                                      />
                                    </div>
                                  </div>
                                )}
                                
                                {group.ruleType === 'percentage' && (
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor={`group-percentage-base-${groupIdx}`}>Base Component</Label>
                                      <Select
                                        value={group.percentageBase}
                                        onValueChange={(value) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].percentageBase = value;
                                          setFilterGroups(updated);
                                        }}
                                      >
                                        <SelectTrigger id={`group-percentage-base-${groupIdx}`} className="mt-1">
                                          <SelectValue placeholder="Select base component..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableDependencies.map((comp) => (
                                            <SelectItem key={comp} value={comp}>
                                              {comp}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor={`group-percentage-amount-${groupIdx}`}>Percentage</Label>
                                      <Input
                                        id={`group-percentage-amount-${groupIdx}`}
                                        type="number"
                                        value={group.percentageAmount}
                                        onChange={(e) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].percentageAmount = e.target.value;
                                          setFilterGroups(updated);
                                        }}
                                        placeholder="e.g., 15 for 15%"
                                        className="mt-1"
                                      />
                                    </div>
                                  </div>
                                )}
                                
                                {group.ruleType === 'capfloor' && (
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor={`group-capfloor-type-${groupIdx}`}>Type</Label>
                                      <Select
                                        value={group.capFloorType}
                                        onValueChange={(value) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].capFloorType = value as 'cap' | 'floor';
                                          setFilterGroups(updated);
                                        }}
                                      >
                                        <SelectTrigger id={`group-capfloor-type-${groupIdx}`} className="mt-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="cap">Cap (Maximum)</SelectItem>
                                          <SelectItem value="floor">Floor (Minimum)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor={`group-capfloor-component-${groupIdx}`}>Component</Label>
                                      <Select
                                        value={group.capFloorComponent}
                                        onValueChange={(value) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].capFloorComponent = value;
                                          setFilterGroups(updated);
                                        }}
                                      >
                                        <SelectTrigger id={`group-capfloor-component-${groupIdx}`} className="mt-1">
                                          <SelectValue placeholder="Select component..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableDependencies.map((comp) => (
                                            <SelectItem key={comp} value={comp}>
                                              {comp}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor={`group-capfloor-value-${groupIdx}`}>Value</Label>
                                      <Input
                                        id={`group-capfloor-value-${groupIdx}`}
                                        type="number"
                                        value={group.capFloorValue}
                                        onChange={(e) => {
                                          const updated = [...filterGroups];
                                          updated[groupIdx].capFloorValue = e.target.value;
                                          setFilterGroups(updated);
                                        }}
                                        placeholder="Enter cap/floor value"
                                        className="mt-1"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="text-xs text-gray-600 mt-2">
                                Applies to {filteredEmployeeCounts[group.id] || 0} employee{filteredEmployeeCounts[group.id] !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        ))
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFilterGroups([...filterGroups, {
                              id: `group-${Date.now()}`,
                              filters: [],
                              ruleType: null,
                              fixedValue: '',
                              tableComponent: '',
                              tableName: '',
                              tableLookupField: '',
                              percentageBase: '',
                              percentageAmount: '',
                              capFloorType: 'cap',
                              capFloorComponent: '',
                              capFloorValue: ''
                            }]);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Filter Group
                        </Button>
                      </div>
                    </div>


                    {/* Section 3: Preview & Explanation - Dominant and Live */}
                    <div className="border-b border-gray-200 pb-6">
                      <h4 className="text-[#1E1E1E] font-semibold mb-4">3. Preview & Explanation</h4>
                      <div className="bg-white border-2 border-[#1FB5B8] rounded-[10px] p-6 shadow-sm">
                        {target && filterGroups.length > 0 ? (
                          <>
                            {/* Rule Summary - Structured Format */}
                            <div className="mb-6 pb-6 border-b border-gray-200">
                              <h5 className="text-base font-semibold text-[#0A0A0A] mb-4">Rule Summary</h5>
                              {(() => {
                                const summaries = generateStructuredRuleSummary();
                                if (!summaries || summaries.length === 0) return null;
                                
                                return (
                                  <div className="space-y-4">
                                    {summaries.map((summary, idx) => (
                                      <div key={idx} className={`${idx > 0 ? 'pt-4 border-t border-gray-200' : ''}`}>
                                        {summaries.length > 1 && (
                                          <div className="text-xs font-medium text-gray-600 mb-3">Group {summary.groupNumber}</div>
                                        )}
                                        <div className="space-y-3">
                                          <div className="flex items-start">
                                            <span className="text-sm font-medium text-gray-700 min-w-[140px]">Component:</span>
                                            <span className="text-sm text-[#0A0A0A] font-semibold">{summary.component}</span>
                                          </div>
                                          <div className="flex items-start">
                                            <span className="text-sm font-medium text-gray-700 min-w-[140px]">Applies to:</span>
                                            <span className="text-sm text-[#0A0A0A]">{summary.appliesTo}</span>
                                          </div>
                                          <div className="flex items-start">
                                            <span className="text-sm font-medium text-gray-700 min-w-[140px]">Calculation method:</span>
                                            <span className="text-sm text-[#0A0A0A]">{summary.calculationMethod}</span>
                                          </div>
                                          <div className="flex items-start">
                                            <span className="text-sm font-medium text-gray-700 min-w-[140px]">Result:</span>
                                            <span className="text-sm text-[#0A0A0A] font-medium">{summary.result}</span>
                                          </div>
                                          <div className="flex items-start">
                                            <span className="text-sm font-medium text-gray-700 min-w-[140px]">Employees affected:</span>
                                            <span className="text-sm text-[#0A0A0A] font-semibold">{formatNumber(summary.employeesAffected)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {/* Impact Summary */}
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-[#0A0A0A] mb-4">Impact Summary</h5>
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-gray-50 p-3 rounded-[6px] border border-gray-200">
                                    <div className="text-xs text-gray-600 mb-1">Total Employees Affected</div>
                                    <div className="text-xl font-semibold text-[#0A0A0A]">
                                      {(() => {
                                        const totalAffected = Object.values(filteredEmployeeCounts).reduce((sum, count) => sum + count, 0);
                                        return formatNumber(totalAffected > 0 ? totalAffected : 0);
                                      })()}
                                    </div>
                                  </div>
                                  <div className="bg-gray-50 p-3 rounded-[6px] border border-gray-200">
                                    <div className="text-xs text-gray-600 mb-1">Number of Groups</div>
                                    <div className="text-xl font-semibold text-[#0A0A0A]">
                                      {formatNumber(filterGroups.filter(g => g.ruleType !== null && g.filters.length > 0).length)}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Per-group breakdown */}
                                {filterGroups.filter(g => g.ruleType !== null && g.filters.length > 0).length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="text-xs text-gray-600 mb-3 font-medium">Breakdown by Group:</div>
                                    <div className="space-y-2">
                                      {filterGroups.map((group, idx) => {
                                        if (!group.ruleType || group.filters.length === 0) return null;
                                        const count = filteredEmployeeCounts[group.id] || 0;
                                        const groupType = group.ruleType === 'fixed' ? 'Fixed' : 
                                                         group.ruleType === 'percentage' ? 'Percentage' : 
                                                         group.ruleType === 'table' ? 'Table' : 'Cap/Floor';
                                        return (
                                          <div key={group.id} className="flex items-center justify-between text-sm py-1.5 px-2 bg-gray-50 rounded-[6px]">
                                            <span className="text-gray-700">Group {idx + 1} ({groupType})</span>
                                            <span className="font-semibold text-[#0A0A0A]">{formatNumber(count)} employees</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Expression (technical) */}
                            {generateExpressionFromStructured() && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="text-xs text-gray-500 mb-1">Technical Expression</div>
                                <p className="text-xs font-mono text-gray-700 bg-gray-50 p-2 rounded border border-gray-200">
                                  {generateExpressionFromStructured()}
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-sm text-gray-600">
                              Complete the rule configuration to see the impact preview.
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              {!target ? 'Select a target component' : 'Create at least one filter group with filters and a calculation method'} to begin.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Advanced Options */}
                    <div className="border-b border-gray-200 pb-6">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
                      >
                        {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
                        {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      
                      {showAdvancedOptions && (
                        <div className="space-y-4">
                          {/* Dependencies */}
                          <div>
                            <Label htmlFor="depends">Depends On</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {dependsOn.map((dep) => (
                                <Badge
                                  key={dep}
                                  className="bg-[#1FB5B8] text-white px-3 py-1 cursor-pointer"
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

                          {/* Toggles - only show for base layer */}
                          {layer !== 'employer' && (
                            <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="incomeTax">Income Tax</Label>
                                  <Switch id="incomeTax" checked={incomeTax} onCheckedChange={setIncomeTax} />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="socialSecurity">Social Security</Label>
                                  <Switch
                                    id="socialSecurity"
                                    checked={socialSecurity}
                                    onCheckedChange={setSocialSecurity}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="workPercentFlag">Apply Work %</Label>
                                  <Switch
                                    id="workPercentFlag"
                                    checked={workPercentFlag}
                                    onCheckedChange={setWorkPercentFlag}
                                  />
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="pensionFlag">Pension</Label>
                                  <Switch
                                    id="pensionFlag"
                                    checked={pensionFlag}
                                    onCheckedChange={setPensionFlag}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="workPension">Work Pension</Label>
                                  <Switch
                                    id="workPension"
                                    checked={workPension}
                                    onCheckedChange={setWorkPension}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="expensesPension">Expenses Pension</Label>
                                  <Switch
                                    id="expensesPension"
                                    checked={expensesPension}
                                    onCheckedChange={setExpensesPension}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="educationFund">Education Fund</Label>
                                  <Switch
                                    id="educationFund"
                                    checked={educationFund}
                                    onCheckedChange={setEducationFund}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Group */}
                          <div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="group">Group</Label>
                              <Select value={group} onValueChange={setGroup}>
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {componentGroups
                                    .sort((a, b) => a.displayOrder - b.displayOrder)
                                    .map((group, index) => {
                                      const groupNumber = `group${index + 1}`;
                                      return (
                                        <SelectItem key={group.groupName} value={groupNumber}>
                                          {groupNumber}
                                        </SelectItem>
                                      );
                                    })}
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
                        </div>
                      )}
                    </div>

                    {/* Section 5: Actions */}
                    <div className="pt-4">
                      <h4 className="text-[#1E1E1E] font-semibold mb-4">5. Actions</h4>
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleSave}
                          disabled={saving || !target || (!expertMode && !filterGroups.some(g => g.ruleType !== null)) || (expertMode && !expression)}
                          variant="outline"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                          Save Draft
                        </Button>
                        <Button
                          onClick={handleValidate}
                          disabled={loading || !target || (!expertMode && !filterGroups.some(g => g.ruleType !== null)) || (expertMode && !expression)}
                          variant="outline"
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : lastValidationStatus === "success" ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          {lastValidationStatus === "success" ? "Validated" : "Validate"}
                        </Button>
                        <Button
                          onClick={handlePublish}
                          disabled={saving || !target || (!expertMode && !filterGroups.some(g => g.ruleType !== null)) || (expertMode && !expression)}
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                          Publish
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation Results - shown for both modes */}
                {validationResults.length > 0 && (
                  <div className="mt-6">
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
                              : 'bg-cyan-50 border border-cyan-200'
                          }`}
                        >
                          <AlertCircle
                            className={`w-5 h-5 mt-0.5 ${
                              result.severity === 'error'
                                ? 'text-red-600'
                                : result.severity === 'warning'
                                ? 'text-yellow-600'
                                : 'text-cyan-600'
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
                                : 'bg-cyan-50 border border-cyan-200'
                            }`}
                          >
                            <AlertCircle
                              className={`w-5 h-5 mt-0.5 ${
                                result.severity === 'error'
                                  ? 'text-red-600'
                                  : result.severity === 'warning'
                                  ? 'text-yellow-600'
                                  : 'text-cyan-600'
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
              </Card>
            </div>
          </div>
      </div>

      {/* Help Guide Drawer */}
      <Sheet open={showHelpGuide} onOpenChange={setShowHelpGuide}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>How to Build Rules</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <RuleBuilderGuide />
          </div>
        </SheetContent>
      </Sheet>

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
              <Label>Layer</Label>
              <div className="flex flex-col gap-2 text-sm mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setNewComponentLayer('base');
                    // When switching to base, set default group if not already set
                    if (!newComponentGroup) {
                      setNewComponentGroup('group1');
                    }
                  }}
                  className={`flex items-center justify-between px-3 py-2 border rounded-[6px] text-left ${
                    newComponentLayer === 'base'
                      ? 'border-black bg-[#EEF2F8] text-[#0A0A0A]'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>Employee (Base)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewComponentLayer('employer');
                    setNewComponentGroup('group1'); // Clear group by resetting to default
                  }}
                  className={`flex items-center justify-between px-3 py-2 border rounded-[6px] text-left ${
                    newComponentLayer === 'employer'
                      ? 'border-red-500 bg-red-50 text-[#0A0A0A]'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>Employer Cost</span>
                </button>
              </div>
            </div>
            {newComponentLayer === 'base' && (
              <div>
                <Label htmlFor="newComponentGroup">Group</Label>
                <Select value={newComponentGroup} onValueChange={setNewComponentGroup}>
                  <SelectTrigger id="newComponentGroup" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {componentGroups
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((group, index) => {
                        const groupNumber = `group${index + 1}`;
                        return (
                          <SelectItem key={group.groupName} value={groupNumber}>
                            {groupNumber}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            )}
            {error && error.type === 'validation' && (
              <div className="mb-3">
                <StateScreen
                  type="validation"
                  title="Validation error"
                  description={error.message || "Please check the form and correct any errors."}
                  inline
                />
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleAddComponent}
                disabled={saving || !newComponentName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg"
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
              </Button>
              <button
                onClick={() => {
                  setShowAddComponent(false);
                  setNewComponentName('');
                  setNewComponentGroup('group1');
                  setNewComponentLayer('base');
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

      {/* Rename Ruleset Dialog */}
      <Dialog open={showRenameRulesetDialog} onOpenChange={(open) => {
        if (!open) {
          setRulesetNameError(null);
        }
        setShowRenameRulesetDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Ruleset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="ruleset-name">New Name</Label>
              <Input
                id="ruleset-name"
                value={newRulesetName}
                onChange={(e) => {
                  setNewRulesetName(e.target.value);
                  // Clear error when user starts typing
                  if (rulesetNameError) {
                    setRulesetNameError(null);
                  }
                  // Real-time validation
                  if (e.target.value.includes('/') || e.target.value.includes('\\')) {
                    setRulesetNameError("Ruleset name cannot contain slashes (/) or backslashes (\\)");
                  }
                }}
                placeholder="Enter ruleset name"
                className={`mt-1 ${rulesetNameError ? 'border-red-500' : ''}`}
              />
              {rulesetNameError ? (
                <p className="text-xs text-red-600 mt-1">{rulesetNameError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Ruleset name cannot contain slashes (/) or backslashes (\)
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRenameRulesetDialog(false);
                setRulesetNameError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameRuleset}
              disabled={!newRulesetName.trim() || saving || !!rulesetNameError}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy & Rename Ruleset Dialog */}
      <Dialog open={showCopyRulesetDialog} onOpenChange={(open) => {
        if (!open) {
          setRulesetNameError(null);
        }
        setShowCopyRulesetDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy &amp; Rename Ruleset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="copy-ruleset-name">New Ruleset Name</Label>
              <Input
                id="copy-ruleset-name"
                value={newRulesetName}
                onChange={(e) => {
                  setNewRulesetName(e.target.value);
                  // Clear error when user starts typing
                  if (rulesetNameError) {
                    setRulesetNameError(null);
                  }
                  // Real-time validation
                  if (e.target.value.includes('/') || e.target.value.includes('\\')) {
                    setRulesetNameError("Ruleset name cannot contain slashes (/) or backslashes (\\)");
                  }
                }}
                placeholder="Enter name for the new ruleset"
                className={`mt-1 ${rulesetNameError ? 'border-red-500' : ''}`}
              />
              {rulesetNameError ? (
                <p className="text-xs text-red-600 mt-1">{rulesetNameError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Ruleset name cannot contain slashes (/) or backslashes (\)
                </p>
              )}
            </div>
            <p className="text-xs text-gray-500">
              A new draft ruleset will be created with all components copied from the current one.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCopyRulesetDialog(false);
                setRulesetNameError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCopyRuleset}
              disabled={!newRulesetName.trim() || saving || !!rulesetNameError}
            >
              Create Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Ruleset Dialog */}
      <Dialog open={showCreateRulesetDialog} onOpenChange={(open) => {
        if (!open) {
          setRulesetNameError(null);
        }
        setShowCreateRulesetDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Ruleset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="create-ruleset-name">Ruleset Name</Label>
              <Input
                id="create-ruleset-name"
                value={newRulesetName}
                onChange={(e) => {
                  setNewRulesetName(e.target.value);
                  // Clear error when user starts typing
                  if (rulesetNameError) {
                    setRulesetNameError(null);
                  }
                  // Real-time validation
                  if (e.target.value.includes('/') || e.target.value.includes('\\')) {
                    setRulesetNameError("Ruleset name cannot contain slashes (/) or backslashes (\\)");
                  }
                }}
                placeholder="Enter name for the new ruleset"
                className={`mt-1 ${rulesetNameError ? 'border-red-500' : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newRulesetName.trim() && !saving && !rulesetNameError) {
                    handleCreateRuleset();
                  }
                }}
                autoFocus
              />
              {rulesetNameError ? (
                <p className="text-xs text-red-600 mt-1">{rulesetNameError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Ruleset name cannot contain slashes (/) or backslashes (\). A new empty ruleset will be created. You can add components to it after creation.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateRulesetDialog(false);
                setNewRulesetName('');
                setRulesetNameError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRuleset}
              disabled={!newRulesetName.trim() || saving || !!rulesetNameError}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Ruleset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Ruleset Dialog */}
      <Dialog open={showDeleteRulesetDialog} onOpenChange={setShowDeleteRulesetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ruleset</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete this ruleset and all its rules? This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteRulesetDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRuleset}
              disabled={saving}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Component Dialog */}
      <Dialog open={showDeleteComponentDialog} onOpenChange={setShowDeleteComponentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Component</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete component "{componentToDelete}"? This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteComponentDialog(false);
                setComponentToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!componentToDelete) return;
                await handleDeleteComponent(componentToDelete);
                setShowDeleteComponentDialog(false);
                setComponentToDelete(null);
              }}
              disabled={saving}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'Add Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="groupName">Group Name (internal identifier)</Label>
              <Input
                id="groupName"
                value={groupFormData.groupName}
                onChange={(e) => setGroupFormData({ ...groupFormData, groupName: e.target.value })}
                placeholder="e.g., core, bonus"
                disabled={!!editingGroup}
                className="mt-1"
              />
              {editingGroup && (
                <p className="text-xs text-gray-500 mt-1">Group name cannot be changed after creation.</p>
              )}
            </div>
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={groupFormData.displayName}
                onChange={(e) => setGroupFormData({ ...groupFormData, displayName: e.target.value })}
                placeholder="e.g., Core, Bonus"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  id="color"
                  value={groupFormData.color}
                  onChange={(e) => setGroupFormData({ ...groupFormData, color: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <Input
                  value={groupFormData.color}
                  onChange={(e) => setGroupFormData({ ...groupFormData, color: e.target.value })}
                  placeholder="#1FB5B8"
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                min="1"
                value={groupFormData.displayOrder}
                onChange={(e) => setGroupFormData({ ...groupFormData, displayOrder: parseInt(e.target.value) || 1 })}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Lower numbers appear first (group1, group2, etc.)</p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowGroupDialog(false);
                setEditingGroup(null);
                setGroupFormData({ groupName: '', displayName: '', color: '#1FB5B8', displayOrder: 1 });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveGroup} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingGroup ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={showDeleteGroupDialog} onOpenChange={setShowDeleteGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete group "{groupNameToDelete}"? This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteGroupDialog(false);
                setGroupNameToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Assistant Side Panel - temporarily disabled */}
      {false && showAIAssistant && (
        <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 border-l border-gray-200">
          <AIRuleAssistant
            tenantId={tenantId}
            rulesetId={selectedRulesetId}
            onRuleAdded={() => {
              if (selectedRulesetId) {
                loadRuleset(selectedRulesetId);
              }
            }}
            onClose={() => setShowAIAssistant(false)}
          />
        </div>
      )}

      {/* CSV Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
            <DialogTitle>Import Rules from CSV/Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="mb-2">File format should have at least 3 columns (first row is header and will be skipped):</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Column 1: Component name (required)</li>
                <li>Column 2: Rule expression (required)</li>
                <li>Column 3: Group (required) - group1, group2, etc. or group name</li>
                <li className="mt-2 font-semibold">Optional flag columns (true/false, 1/0, yes/no):</li>
                <li className="ml-4">Column 4: Income Tax</li>
                <li className="ml-4">Column 5: Social Security</li>
                <li className="ml-4">Column 6: Pension</li>
                <li className="ml-4">Column 7: Work Pension</li>
                <li className="ml-4">Column 8: Expenses Pension</li>
                <li className="ml-4">Column 9: Education Fund</li>
                <li className="ml-4">Column 10: Work Percent</li>
              </ol>
              <p className="mt-3 text-xs text-gray-500">
                Example:<br />
                <code className="bg-gray-100 px-2 py-1 rounded block mt-1">
                  Component Name,Expression,Group,Income Tax,Social Security,Pension<br />
                  BaseSalary,10000,group1,true,true,false<br />
                  Bonus,BaseSalary * 0.1,group2,true,false,false
                </code>
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Supported formats: CSV (.csv), Excel (.xlsx, .xls). Flag columns are optional and default to false if not provided.
              </p>
            </div>
            
            <div>
              <Label htmlFor="csv-file">Select CSV or Excel File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImportCSV(file);
                  }
                }}
                disabled={importing || !selectedRulesetId}
                className="mt-1"
              />
            </div>

            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm whitespace-pre-wrap">
                {importError}
              </div>
            )}

            {importing && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing rules...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportError(null);
              }}
              disabled={importing}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Confirmation Dialog */}
      <Dialog open={showPublishConfirmDialog} onOpenChange={setShowPublishConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Publish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-600">
              Publishing this ruleset will make it active and affect all calculations. Are you sure you want to continue?
            </p>
            {target && ruleType && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-2">Rule Summary:</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{generateRuleExplanation()}</p>
                {filterGroups.length > 0 && filterGroups.some(g => g.filters.length > 0) && (
                  <div className="text-sm text-gray-700 mt-3">
                    <strong>Affected employees by group:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {filterGroups.map((group, idx) => {
                        const count = filteredEmployeeCounts[group.id] || 0;
                        if (count > 0 || group.filters.length > 0) {
                          return (
                            <li key={group.id}>
                              Group {idx + 1}: {count} employee{count !== 1 ? 's' : ''}
                            </li>
                          );
                        }
                        return null;
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowPublishConfirmDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmPublish}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Publishing...
                </>
              ) : (
                'Publish'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
