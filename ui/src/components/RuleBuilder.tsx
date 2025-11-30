import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Save, CheckCircle, AlertCircle, Upload, List, Network, Loader2, X, Trash2, Database, HelpCircle, Sparkles, Layers, Edit } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import RuleBuilderGuide from './RuleBuilderGuide';
import TableBuilder from './TableBuilder';
import AIRuleAssistant from './AIRuleAssistant';
import { rulesetApi, ruleApi, tableApi, componentGroupsApi, type RuleSet, type RuleDto, type ValidateIssue, type ComponentGroup } from '../services/apiService';
import { useToast } from './ToastProvider';

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
    return { selectedComponent: null };
  };

  const storedState = getStoredState();
  const [selectedComponent, setSelectedComponent] = useState<string | null>(storedState.selectedComponent || null);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  
  // Data state
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; status: string }>>([]);
  const [ruleset, setRuleset] = useState<RuleSet | null>(null);
  const [components, setComponents] = useState<Array<{ id: string; name: string; group: string; status: string }>>([]);
  const [draftComponents, setDraftComponents] = useState<Record<string, boolean>>({});
  const [validationResults, setValidationResults] = useState<ValidateIssue[]>([]);
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  
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
  const [incomeTax, setIncomeTax] = useState(false);
  const [socialSecurity, setSocialSecurity] = useState(false);
  const [pensionFlag, setPensionFlag] = useState(false);
  const [workPension, setWorkPension] = useState(false);
  const [expensesPension, setExpensesPension] = useState(false);
  const [educationFund, setEducationFund] = useState(false);
  const [workPercentFlag, setWorkPercentFlag] = useState(false);
  
  // Loading/Error state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastValidationStatus, setLastValidationStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastValidationTime, setLastValidationTime] = useState<string | null>(null);
  
  // Add component dialog state
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [newComponentGroup, setNewComponentGroup] = useState('group1');
  const [showDeleteRulesetDialog, setShowDeleteRulesetDialog] = useState(false);
  const [showRenameRulesetDialog, setShowRenameRulesetDialog] = useState(false);
  const [showCopyRulesetDialog, setShowCopyRulesetDialog] = useState(false);
  const [showDeleteComponentDialog, setShowDeleteComponentDialog] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<string | null>(null);
  const [newRulesetName, setNewRulesetName] = useState('');
  
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
    color: '#0052CC', 
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

  // Load ruleset when selected
  useEffect(() => {
    if (selectedRulesetId) {
      loadRuleset(selectedRulesetId);
    }
  }, [selectedRulesetId, tenantId]);

  // Update components when ruleset changes
  useEffect(() => {
    if (ruleset) {
      const comps = ruleset.rules.map(rule => {
        const actualGroupName = rule.meta?.group || 'core';
        const groupNumber = groupNameToNumber[actualGroupName] || 'group1';
        return {
          id: rule.target,
          name: rule.target,
          group: groupNumber, // Display group number
          status: 'valid', // TODO: determine from validation
        };
      });
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

  const loadRulesets = async () => {
    try {
      setLoading(true);
      const all = await rulesetApi.getAllRulesets(tenantId);
      setRulesets(all);
      if (!selectedRulesetId && all.length > 0) {
        // Try to restore global ruleset selection
        let initialId: string | null = null;
        try {
          const stored = localStorage.getItem(GLOBAL_RULESET_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.rulesetId && all.some(rs => rs.rulesetId === parsed.rulesetId)) {
              initialId = parsed.rulesetId;
            }
          }
        } catch {
          // ignore
        }
        setSelectedRulesetId(initialId || all[0].rulesetId);
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
      // Convert group name to group number for display
      const actualGroupName = rule.meta?.group || 'core';
      const groupNumber = groupNameToNumber[actualGroupName] || 'group1';
      setGroup(groupNumber);
      // Backwards compatibility: map legacy flags to incomeTax
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
  };

  const handleSave = async () => {
    if (!selectedRulesetId || !target || !expression) {
      setError('Target and expression are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      // Convert group number back to group name for saving
      let actualGroupName: string | null = null;
      if (group) {
        actualGroupName = groupNumberToName[group];
        // If mapping doesn't exist (groups not loaded yet), default to first group or 'core'
        if (!actualGroupName && componentGroups.length > 0) {
          const sorted = [...componentGroups].sort((a, b) => a.displayOrder - b.displayOrder);
          actualGroupName = sorted[0]?.groupName || 'core';
        } else if (!actualGroupName) {
          actualGroupName = 'core'; // Fallback if no groups loaded
        }
      }
      
      await ruleApi.updateRule(tenantId, selectedRulesetId, target, {
        expression,
        dependsOn: dependsOn.length > 0 ? dependsOn : null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        group: actualGroupName,
        incomeTax,
        socialSecurity,
        pension: pensionFlag,
        workPension,
        expensesPension,
        educationFund,
        workPercent: workPercentFlag,
      });

      // Reload ruleset
      await loadRuleset(selectedRulesetId);
      // Mark this component as draft (has unpublished changes)
      setDraftComponents(prev => ({ ...prev, [target]: true }));
      showToast('success', 'Rule saved', `Component "${target}" was updated.`);
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
      setError(err.message || 'Failed to validate ruleset');
      setLastValidationStatus("error");
      setLastValidationTime(new Date().toLocaleString());
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedRulesetId) {
      setError('Please select a ruleset');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await rulesetApi.publish(tenantId, selectedRulesetId);
      showToast('success', 'Ruleset published', 'The active ruleset is now updated.');
      
      // Reload rulesets
      await loadRulesets();
      // Clear all draft markers after publish
      setDraftComponents({});
    } catch (err: any) {
      setError(err.message || 'Failed to publish ruleset');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameRuleset = async () => {
    if (!selectedRulesetId || !newRulesetName.trim()) {
      setError('Ruleset name is required');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await rulesetApi.rename(tenantId, selectedRulesetId, newRulesetName.trim());
      showToast('success', 'Ruleset renamed', `Ruleset is now called "${newRulesetName.trim()}".`);
      setShowRenameRulesetDialog(false);
      setNewRulesetName('');
      await loadRulesets();
    } catch (err: any) {
      setError(err.message || 'Failed to rename ruleset');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyRuleset = async () => {
    if (!selectedRulesetId || !newRulesetName.trim()) {
      setError('Ruleset name is required');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await rulesetApi.copy(tenantId, selectedRulesetId, newRulesetName.trim());
      showToast('success', 'Ruleset copied', `New ruleset "${res.name}" was created.`);
      setShowCopyRulesetDialog(false);
      setNewRulesetName('');
      // Reload list and select the new ruleset
      await loadRulesets();
      setSelectedRulesetId(res.rulesetId);
    } catch (err: any) {
      setError(err.message || 'Failed to copy ruleset');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRuleset = async () => {
    if (!selectedRulesetId) {
      setError('Please select a ruleset to delete');
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
      setError(err.message || 'Failed to delete ruleset');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComponent = async (componentName: string) => {
    if (!selectedRulesetId) {
      setError('Please select a ruleset');
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
      showToast('error', 'Validation Error', 'Group name and display name are required.');
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
      
      // Reload groups
      const groups = await componentGroupsApi.getAll();
      setComponentGroups(groups);
      
      // Update mappings
      const nameToNumber: Record<string, string> = {};
      const numberToName: Record<string, string> = {};
      groups.forEach((g, idx) => {
        const num = `group${idx + 1}`;
        nameToNumber[g.groupName.toLowerCase()] = num;
        numberToName[num] = g.groupName.toLowerCase();
      });
      setGroupNameToNumber(nameToNumber);
      setGroupNumberToName(numberToName);
      
      setShowGroupDialog(false);
      setEditingGroup(null);
      setGroupFormData({ groupName: '', displayName: '', color: '#0052CC', displayOrder: 1 });
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Failed to save group.');
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
      
      // Reload groups
      const groups = await componentGroupsApi.getAll();
      setComponentGroups(groups);
      
      // Update mappings
      const nameToNumber: Record<string, string> = {};
      const numberToName: Record<string, string> = {};
      groups.forEach((g, idx) => {
        const num = `group${idx + 1}`;
        nameToNumber[g.groupName.toLowerCase()] = num;
        numberToName[num] = g.groupName.toLowerCase();
      });
      setGroupNameToNumber(nameToNumber);
      setGroupNumberToName(numberToName);
      
      setShowDeleteGroupDialog(false);
      setGroupNameToDelete(null);
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Failed to delete group.');
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
      
      // Convert group number back to group name for saving
      let actualGroupName: string | null = null;
      if (newComponentGroup) {
        actualGroupName = groupNumberToName[newComponentGroup];
        // If mapping doesn't exist (groups not loaded yet), default to first group or 'core'
        if (!actualGroupName && componentGroups.length > 0) {
          const sorted = [...componentGroups].sort((a, b) => a.displayOrder - b.displayOrder);
          actualGroupName = sorted[0]?.groupName || 'core';
        } else if (!actualGroupName) {
          actualGroupName = 'core'; // Fallback if no groups loaded
        }
      }
      
      await ruleApi.updateRule(tenantId, selectedRulesetId, newComponentName.trim(), {
        expression: defaultExpression,
        dependsOn: null,
        effectiveFrom: null,
        effectiveTo: null,
        group: actualGroupName,
        incomeTax: false,
      });

      // Reload ruleset to get the new component
      await loadRuleset(selectedRulesetId);
      
      // Select the new component
      setSelectedComponent(newComponentName.trim());
      
      // Reset form and close dialog
      setNewComponentName('');
      setNewComponentGroup('group1');
      setShowAddComponent(false);
      
      // Load the new rule data
      loadRuleData(newComponentName.trim());
    } catch (err: any) {
      setError(err.message || 'Failed to add component');
    } finally {
      setSaving(false);
    }
  };

  // Map group numbers to colors from componentGroups
  const groupColors: Record<string, string> = React.useMemo(() => {
    const colors: Record<string, string> = {};
    componentGroups
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach((group, index) => {
        const groupNumber = `group${index + 1}`;
        // Convert hex color to Tailwind classes (simplified mapping)
        // For now, use a default set of colors based on index
        const colorClasses = [
          'bg-blue-100 text-blue-800',
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

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <h1 className="text-[#1E1E1E] mb-6">Rules</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Main Content Area - Full Width */}
      <div>
        <Tabs 
          defaultValue={localStorage.getItem(`ruleBuilder_tab_${tenantId}`) || 'builder'} 
          onValueChange={(value) => localStorage.setItem(`ruleBuilder_tab_${tenantId}`, value)}
          className="w-full"
        >
          <TabsList className="mb-6">
            <TabsTrigger value="builder" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              Rule Builder
            </TabsTrigger>
            <TabsTrigger value="tables" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Table Builder
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Component Groups
            </TabsTrigger>
          </TabsList>

        <TabsContent value="builder">
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
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="ruleset" className="min-w-[100px]">Ruleset</Label>
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

                  {/* Group */}
                  <div className="mt-4">
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

            <TabsContent value="tables">
              <TableBuilder tenantId={tenantId} />
            </TabsContent>

            <TabsContent value="groups">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-[#1E1E1E]">Component Groups</h2>
                  <Button
                    onClick={() => {
                      setEditingGroup(null);
                      setGroupFormData({ groupName: '', displayName: '', color: '#0052CC', displayOrder: componentGroups.length + 1 });
                      setShowGroupDialog(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Group
                  </Button>
                </div>

                <Card className="p-6">
                  <div className="space-y-4">
                    {componentGroups.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No component groups found. Create your first group to get started.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Group Name</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Display Name</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Color</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Display Order</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {componentGroups.map((group) => (
                              <tr key={group.groupName} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-4 text-sm text-[#1E1E1E] font-mono">{group.groupName}</td>
                                <td className="py-3 px-4 text-sm text-[#1E1E1E]">{group.displayName}</td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-6 h-6 rounded border border-gray-300"
                                      style={{ backgroundColor: group.color }}
                                    />
                                    <span className="text-sm text-gray-600">{group.color}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-sm text-[#1E1E1E]">{group.displayOrder}</td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingGroup(group);
                                        setGroupFormData({
                                          groupName: group.groupName,
                                          displayName: group.displayName,
                                          color: group.color,
                                          displayOrder: group.displayOrder,
                                        });
                                        setShowGroupDialog(true);
                                      }}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setGroupNameToDelete(group.groupName);
                                        setShowDeleteGroupDialog(true);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
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

      {/* Rename Ruleset Dialog */}
      <Dialog open={showRenameRulesetDialog} onOpenChange={setShowRenameRulesetDialog}>
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
                onChange={(e) => setNewRulesetName(e.target.value)}
                placeholder="Enter ruleset name"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowRenameRulesetDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameRuleset}
              disabled={!newRulesetName.trim() || saving}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy & Rename Ruleset Dialog */}
      <Dialog open={showCopyRulesetDialog} onOpenChange={setShowCopyRulesetDialog}>
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
                onChange={(e) => setNewRulesetName(e.target.value)}
                placeholder="Enter name for the new ruleset"
                className="mt-1"
              />
            </div>
            <p className="text-xs text-gray-500">
              A new draft ruleset will be created with all components copied from the current one.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowCopyRulesetDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCopyRuleset}
              disabled={!newRulesetName.trim() || saving}
            >
              Create Copy
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
                  placeholder="#0052CC"
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
                setGroupFormData({ groupName: '', displayName: '', color: '#0052CC', displayOrder: 1 });
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
    </div>
  );
}
