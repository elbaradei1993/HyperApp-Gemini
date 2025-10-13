import React from 'react';
import { NavLink } from 'react-router-dom';
import { LocationMarkerIcon, UserIcon, FireIcon, LightBulbIcon, GlobeAltIcon } from '../ui/Icons';

const navItems = [
  { path: '/', label: 'Map', icon: LocationMarkerIcon },
  { path: '/events', label: 'Events', icon: GlobeAltIcon },
  { path: '/trending', label: 'Trending', icon: FireIcon },
  { path: '/services', label: 'Pulse', icon: LightBulbIcon },
  { path: '/profile', label: 'Profile', icon: UserIcon },
];

const BottomNavbar: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-secondary border-t border-gray-700 shadow-lg z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
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
        ))}
      </div>
    </nav>
  );
};

export default BottomNavbar;