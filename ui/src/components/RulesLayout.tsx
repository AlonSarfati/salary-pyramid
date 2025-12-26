import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { List, Database, Layers } from 'lucide-react';
import { useTenant } from '../App';

export default function RulesLayout() {
  const { tenantId } = useTenant();
  const location = useLocation();

  const tabs = [
    { path: `/rules/builder`, icon: List, label: 'Rule Builder' },
    { path: `/rules/tables`, icon: Database, label: 'Table Builder' },
    { path: `/rules/groups`, icon: Layers, label: 'Component Groups' },
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Inner Tabs Navigation */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || 
              (tab.path === '/rules/builder' && location.pathname === '/rules');
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive: navIsActive }) =>
                  `flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    isActive || navIsActive
                      ? 'border-black text-black font-medium'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Nested Route Content */}
      <Outlet />
    </div>
  );
}

