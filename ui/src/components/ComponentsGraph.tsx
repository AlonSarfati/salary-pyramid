import { useState } from 'react';
import { Plus, CheckCircle, Upload, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface Node {
  id: string;
  name: string;
  group: string;
  x: number;
  y: number;
  dependencies: string[];
}

export default function ComponentsGraph() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const nodes: Node[] = [
    { id: 'input', name: 'Input Data', group: 'input', x: 400, y: 50, dependencies: [] },
    { id: 'base', name: 'Base Salary', group: 'core', x: 200, y: 150, dependencies: ['input'] },
    { id: 'hours', name: 'Hours Worked', group: 'core', x: 600, y: 150, dependencies: ['input'] },
    { id: 'bonus', name: 'Performance Bonus', group: 'bonus', x: 200, y: 250, dependencies: ['base'] },
    { id: 'pension', name: 'Pension', group: 'pension', x: 400, y: 250, dependencies: ['base'] },
    { id: 'overtime', name: 'Overtime', group: 'core', x: 600, y: 250, dependencies: ['hours', 'base'] },
    { id: 'stock', name: 'Stock Options', group: 'equity', x: 100, y: 350, dependencies: ['base'] },
    { id: 'health', name: 'Health Insurance', group: 'benefits', x: 300, y: 350, dependencies: ['base'] },
    { id: 'commission', name: 'Commission', group: 'bonus', x: 500, y: 350, dependencies: ['bonus'] },
    { id: 'total', name: 'Total Compensation', group: 'output', x: 400, y: 450, dependencies: ['bonus', 'pension', 'overtime', 'stock', 'health', 'commission'] },
  ];

  const groupColors: Record<string, string> = {
    input: '#9CA3AF',
    core: '#0052CC',
    bonus: '#10B981',
    pension: '#8B5CF6',
    benefits: '#F59E0B',
    equity: '#EC4899',
    output: '#1E1E1E',
  };

  const getNodeColor = (group: string) => groupColors[group] || '#0052CC';

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
          <Select defaultValue="2024">
            <SelectTrigger id="ruleset" className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024 Annual Rules (Active)</SelectItem>
              <SelectItem value="q4">Q4 2024 Bonus (Draft)</SelectItem>
              <SelectItem value="2025">2025 Preview (Draft)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

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
          <svg
            width="800"
            height="550"
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
            {Object.entries(groupColors).map(([group, color]) => (
              <div key={group} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-600 capitalize">{group}</span>
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
                  placeholder="e.g., baseSalary * 0.15"
                  defaultValue="input.baseSalary"
                  className="mt-1 font-mono h-32"
                />
              </div>
              <div>
                <Label>Dependencies</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedNodeData?.dependencies.map(dep => {
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
                        {depNode?.name}
                      </div>
                    );
                  })}
                </div>
              </div>
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
                <Select defaultValue={selectedNodeData?.group}>
                  <SelectTrigger id="group-name" className="mt-1">
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
