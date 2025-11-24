import { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle, Upload, ZoomIn, ZoomOut, Maximize2, Loader2 } from 'lucide-react';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { rulesetApi, componentGroupsApi, type RuleSet, type RuleDto, type ComponentGroup } from '../services/apiService';

interface Node {
  id: string;
  name: string;
  group: string;
  x: number;
  y: number;
  dependencies: string[];
  expression?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export default function ComponentsGraph({ tenantId = 'default' }: { tenantId?: string }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Ruleset state
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; count: number }>>([]);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [ruleset, setRuleset] = useState<RuleSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Component groups state
  const [groups, setGroups] = useState<ComponentGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Fetch component groups on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setGroupsLoading(true);
        const data = await componentGroupsApi.getAll();
        if (!cancelled) {
          setGroups(data);
        }
      } catch (e: any) {
        console.error('Failed to load component groups:', e);
        // Use default groups if API fails
        if (!cancelled) {
          setGroups([
            { groupName: 'core', displayName: 'Core', color: '#0052CC', displayOrder: 1 },
            { groupName: 'bonus', displayName: 'Bonus', color: '#10B981', displayOrder: 2 },
            { groupName: 'extra hours', displayName: 'Extra Hours', color: '#F59E0B', displayOrder: 3 },
            { groupName: 'expenses', displayName: 'Expenses', color: '#8B5CF6', displayOrder: 4 },
          ]);
        }
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch rulesets on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await rulesetApi.getActive(tenantId);
        if (!cancelled) {
          setRulesets(data.ruleSets || []);
          if (data.ruleSets && data.ruleSets.length > 0) {
            setSelectedRulesetId(data.ruleSets[0].rulesetId);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to load rulesets');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  // Fetch selected ruleset
  useEffect(() => {
    if (!selectedRulesetId) {
      setRuleset(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await rulesetApi.getRuleset(tenantId, selectedRulesetId);
        if (!cancelled) {
          setRuleset(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to load ruleset');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, selectedRulesetId]);

  // Build nodes from ruleset data
  const nodes: Node[] = useMemo(() => {
    if (!ruleset || !ruleset.rules) return [];

    // Get all component names (targets)
    const componentNames = new Set(ruleset.rules.map(r => r.target));
    
    // Build nodes from rules
    const nodeMap = new Map<string, Node>();
    
    ruleset.rules.forEach((rule: RuleDto) => {
      // Extract dependencies from dependsOn field and expression
      const dependencies = new Set<string>();
      
      // Add explicit dependencies
      if (rule.dependsOn) {
        rule.dependsOn.forEach(dep => {
          if (componentNames.has(dep)) {
            dependencies.add(dep);
          }
        });
      }
      
      // Extract component references from expression (simple regex for now)
      // Match CamelCase identifiers that are not functions
      const expression = rule.expression || '';
      // Remove quoted strings (table names in TBL functions)
      const withoutQuotes = expression.replaceAll(/"([^"]*)"/g, '');
      // Match CamelCase: starts with uppercase, contains lowercase
      const camelCasePattern = /\b([A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*)\b/g;
      let match;
      while ((match = camelCasePattern.exec(withoutQuotes)) !== null) {
        const name = match[1];
        // Skip if it's a function (ALL_CAPS) or if it's the target itself
        if (name !== rule.target && componentNames.has(name)) {
          dependencies.add(name);
        }
      }
      
      // Normalize group name to match standard groups
      const rawGroup = rule.meta?.group || 'core';
      const normalizedGroup = rawGroup.toLowerCase();
      // Map to standard groups, default to 'core' if not recognized
      let group = 'core';
      if (normalizedGroup === 'core' || normalizedGroup === 'bonus' || 
          normalizedGroup === 'extra hours' || normalizedGroup === 'expenses') {
        group = normalizedGroup;
      } else if (normalizedGroup.includes('bonus')) {
        group = 'bonus';
      } else if (normalizedGroup.includes('hour') || normalizedGroup.includes('overtime')) {
        group = 'extra hours';
      } else if (normalizedGroup.includes('expense') || normalizedGroup.includes('cost')) {
        group = 'expenses';
      }
      nodeMap.set(rule.target, {
        id: rule.target,
        name: rule.target,
        group: group,
        x: 0, // Will be calculated by layout algorithm
        y: 0, // Will be calculated by layout algorithm
        dependencies: Array.from(dependencies),
        expression: rule.expression,
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo,
      });
    });

    // Calculate layout positions (simple layered layout)
    const nodesArray = Array.from(nodeMap.values());
    if (nodesArray.length === 0) return [];

    // Separate into layers based on dependencies
    const layers: Node[][] = [];
    const processed = new Set<string>();
    const remaining = new Set(nodesArray.map(n => n.id));

    while (remaining.size > 0) {
      const currentLayer: Node[] = [];
      
      for (const node of nodesArray) {
        if (!remaining.has(node.id)) continue;
        
        // Check if all dependencies are already processed
        const allDepsProcessed = node.dependencies.every(dep => processed.has(dep));
        if (allDepsProcessed) {
          currentLayer.push(node);
          remaining.delete(node.id);
          processed.add(node.id);
        }
      }
      
      if (currentLayer.length === 0) {
        // Circular dependency or no dependencies - add remaining nodes
        remaining.forEach(id => {
          const node = nodesArray.find(n => n.id === id);
          if (node) {
            currentLayer.push(node);
            processed.add(id);
          }
        });
        remaining.clear();
      }
      
      layers.push(currentLayer);
    }

    // Position nodes in layers
    const nodeWidth = 140;
    const nodeHeight = 50;
    const layerSpacing = 150;
    const nodeSpacing = 20;
    
    layers.forEach((layer, layerIndex) => {
      const layerY = 50 + layerIndex * layerSpacing;
      const totalWidth = layer.length * (nodeWidth + nodeSpacing) - nodeSpacing;
      const startX = 400 - totalWidth / 2; // Center the layer
      
      layer.forEach((node, nodeIndex) => {
        node.x = startX + nodeIndex * (nodeWidth + nodeSpacing) + nodeWidth / 2;
        node.y = layerY;
      });
    });

    return nodesArray;
  }, [ruleset]);

  // Build group colors map from fetched groups
  const groupColors: Record<string, string> = useMemo(() => {
    const colors: Record<string, string> = {};
    groups.forEach(group => {
      colors[group.groupName.toLowerCase()] = group.color;
    });
    return colors;
  }, [groups]);

  const getNodeColor = (group: string) => {
    const normalized = group.toLowerCase();
    return groupColors[normalized] || (groups.length > 0 ? groups[0].color : '#0052CC');
  };

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="max-w-[1600px] mx-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[#1E1E1E]">Components Graph</h2>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
            <Plus className="w-5 h-5" />
            Add Node
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-white text-[#0052CC] border border-[#0052CC] rounded-xl hover:bg-[#EEF2F8] transition-colors">
            <CheckCircle className="w-5 h-5" />
            Validate
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors">
            <Upload className="w-5 h-5" />
            Publish
          </button>
        </div>
      </div>

      {/* Ruleset Selector */}
      <Card className="p-4 bg-white rounded-xl shadow-sm border-0 mb-6">
        <div className="flex items-center gap-4">
          <Label htmlFor="ruleset" className="min-w-[100px]">Ruleset</Label>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : rulesets.length === 0 ? (
            <div className="text-sm text-gray-500">No rulesets available</div>
          ) : (
            <Select
              value={selectedRulesetId || ''}
              onValueChange={(value) => setSelectedRulesetId(value)}
            >
            <SelectTrigger id="ruleset" className="max-w-md">
                <SelectValue placeholder="Select ruleset..." />
            </SelectTrigger>
            <SelectContent>
                {rulesets.map((rs) => (
                  <SelectItem key={rs.rulesetId} value={rs.rulesetId}>
                    {rs.name || rs.rulesetId} ({rs.count} rules)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          )}
        </div>
      </Card>

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </Card>
      )}

      {/* Graph Canvas */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0 relative" style={{ height: 'calc(100vh - 320px)' }}>
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* SVG Canvas */}
        <div className="w-full h-full overflow-auto bg-[#F9FAFB] rounded-lg">
          {nodes.length === 0 && !loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="mb-2">No components found</p>
                <p className="text-sm">Select a ruleset to view the component graph</p>
              </div>
            </div>
          ) : (
            <svg
              width={Math.max(800, nodes.length > 0 ? Math.max(...nodes.map(n => n.x)) + 200 : 800)}
              height={Math.max(550, nodes.length > 0 ? Math.max(...nodes.map(n => n.y)) + 100 : 550)}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            className="mx-auto"
          >
            {/* Draw edges first */}
            {nodes.map(node =>
              node.dependencies.map(depId => {
                const depNode = nodes.find(n => n.id === depId);
                if (!depNode) return null;
                return (
                  <g key={`${node.id}-${depId}`}>
                    <line
                      x1={depNode.x}
                      y1={depNode.y + 25}
                      x2={node.x}
                      y2={node.y - 5}
                      stroke="#CBD5E1"
                      strokeWidth="2"
                      markerEnd="url(#arrowhead)"
                    />
                  </g>
                );
              })
            )}

            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#CBD5E1" />
              </marker>
            </defs>

            {/* Draw nodes */}
            {nodes.map(node => (
              <g
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                className="cursor-pointer"
                style={{ transition: 'all 0.2s' }}
              >
                <rect
                  x={node.x - 70}
                  y={node.y - 25}
                  width="140"
                  height="50"
                  rx="12"
                  fill={selectedNode === node.id ? getNodeColor(node.group) : 'white'}
                  stroke={getNodeColor(node.group)}
                  strokeWidth={selectedNode === node.id ? '3' : '2'}
                  className="transition-all"
                />
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={selectedNode === node.id ? 'white' : '#1E1E1E'}
                  fontSize="14"
                  fontWeight={selectedNode === node.id ? '600' : '400'}
                >
                  {node.name}
                </text>
              </g>
            ))}
          </svg>
          )}
        </div>

        {/* Mini-map */}
        <div className="absolute bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-2" style={{ width: '150px', height: '100px' }}>
          <svg width="150" height="100" viewBox="0 0 800 550">
            {nodes.map(node => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r="8"
                fill={getNodeColor(node.group)}
                opacity="0.6"
              />
            ))}
          </svg>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white border border-gray-300 rounded-lg p-3">
          <div className="text-sm text-[#1E1E1E] mb-2">Groups</div>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <div key={group.groupName} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: group.color }} />
                <span className="text-xs text-gray-600">{group.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Right Drawer */}
      <Sheet open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>{selectedNodeData?.name || 'Component Details'}</SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="rule" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="rule">Rule</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="test">Test</TabsTrigger>
            </TabsList>

            <TabsContent value="rule" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="expr">Expression</Label>
                <Textarea
                  id="expr"
                  placeholder="e.g., BaseSalary * 0.15"
                  value={selectedNodeData?.expression || ''}
                  readOnly
                  className="mt-1 font-mono h-32 bg-gray-50"
                />
              </div>
              <div>
                <Label>Dependencies</Label>
                {selectedNodeData && selectedNodeData.dependencies.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                    {selectedNodeData.dependencies.map(dep => {
                    const depNode = nodes.find(n => n.id === dep);
                    return (
                      <div
                        key={dep}
                        className="px-3 py-1 rounded-md text-sm"
                        style={{
                          backgroundColor: `${getNodeColor(depNode?.group || 'core')}20`,
                          color: getNodeColor(depNode?.group || 'core'),
                        }}
                      >
                          {depNode?.name || dep}
                      </div>
                    );
                  })}
                </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-2">No dependencies</p>
                )}
              </div>
              {(selectedNodeData?.effectiveFrom || selectedNodeData?.effectiveTo) && (
                <div>
                  <Label>Effective Period</Label>
                  <div className="text-sm text-gray-600 mt-1">
                    {selectedNodeData.effectiveFrom && (
                      <div>From: {new Date(selectedNodeData.effectiveFrom).toLocaleDateString()}</div>
                    )}
                    {selectedNodeData.effectiveTo && (
                      <div>To: {new Date(selectedNodeData.effectiveTo).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="properties" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="taxable-prop">Taxable</Label>
                <Switch id="taxable-prop" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="group-prop">Include in Group</Label>
                <Switch id="group-prop" />
              </div>
              <div>
                <Label htmlFor="group-name">Group</Label>
                <Select defaultValue={selectedNodeData?.group || (groups.length > 0 ? groups[0].groupName : 'core')}>
                  <SelectTrigger id="group-name" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.groupName} value={group.groupName}>
                        {group.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="test" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="test-input">Test Input</Label>
                <Textarea
                  id="test-input"
                  placeholder='{"baseSalary": 85000}'
                  className="mt-1 font-mono"
                />
              </div>
              <button className="w-full px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors">
                Test Component
              </button>
              <Card className="p-4 bg-[#EEF2F8] border-0">
                <div className="text-sm text-gray-600 mb-1">Preview Result</div>
                <div className="text-2xl text-[#1E1E1E]">$85,000</div>
              </Card>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
