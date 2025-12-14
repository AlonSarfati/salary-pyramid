import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { User, Users } from 'lucide-react';
import { useTenant } from '../App';

export default function SimulateLayout() {
  const { tenantId } = useTenant();
  const location = useLocation();

  const tabs = [
    { path: `/simulate/single`, icon: User, label: 'Single Employee' },
    { path: `/simulate/bulk`, icon: Users, label: 'Bulk Simulation' },
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Inner Tabs Navigation */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || 
              (tab.path === '/simulate/single' && location.pathname === '/simulate');
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive: navIsActive }) =>
                  `flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    isActive || navIsActive
                      ? 'border-[#0052CC] text-[#0052CC] font-medium'
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

