import React from 'react';
import { NavLink } from 'react-router-dom';
import { LocationMarkerIcon, LightBulbIcon, GlobeAltIcon, PlusIcon, Cog6ToothIcon } from '../ui/Icons';

interface BottomNavbarProps {
  onReportVibeClick: () => void;
}

const leftNavItems = [
  { path: '/', label: 'Map', icon: LocationMarkerIcon },
  { path: '/events', label: 'Events', icon: GlobeAltIcon },
];

const rightNavItems = [
  { path: '/pulse', label: 'Pulse', icon: LightBulbIcon },
  { path: '/settings', label: 'Settings', icon: Cog6ToothIcon },
];

const NavItem: React.FC<{ path: string; label: string; icon: React.FC<any> }> = ({ path, label, icon: Icon }) => (
  <NavLink
    to={path}
    end
    className={({ isActive }) =>
      `flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
        isActive ? 'text-brand-accent' : 'text-gray-400 hover:text-white'
      }`
    }
  >
    <Icon className="w-6 h-6 mb-1" />
    <span className="text-xs font-medium">{label}</span>
  </NavLink>
);

const BottomNavbar: React.FC<BottomNavbarProps> = ({ onReportVibeClick }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-secondary border-t border-gray-700 shadow-lg z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {leftNavItems.map(item => <NavItem key={item.path} {...item} />)}
        
        <div className="w-1/5 flex justify-center">
          <button
            onClick={onReportVibeClick}
            className="bg-brand-accent text-white rounded-full w-14 h-14 flex items-center justify-center -mt-8 shadow-lg border-4 border-brand-secondary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary focus:ring-brand-accent transform transition-transform hover:scale-110"
            aria-label="Report a Vibe"
          >
            <PlusIcon className="w-8 h-8" />
          </button>
        </div>

        {rightNavItems.map(item => <NavItem key={item.path} {...item} />)}
      </div>
    </nav>
  );
};

export default BottomNavbar;