
import React from 'react';
import { NavLink } from 'react-router-dom';
import { MapIcon, BellAlertIcon, ChartBarIcon, UserCircleIcon } from '../ui/Icons';

const BottomNavbar: React.FC = () => {
  const activeLink = 'text-brand-accent';
  const inactiveLink = 'text-gray-400 hover:text-white';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-secondary border-t border-gray-700 shadow-lg z-50">
      <div className="max-w-md mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          <NavLink to="/" className={({ isActive }) => isActive ? activeLink : inactiveLink}>
            <div className="flex flex-col items-center">
              <MapIcon className="w-6 h-6" />
              <span className="text-xs">Map</span>
            </div>
          </NavLink>
          <NavLink to="/services" className={({ isActive }) => isActive ? activeLink : inactiveLink}>
            <div className="flex flex-col items-center">
              <BellAlertIcon className="w-6 h-6" />
              <span className="text-xs">Pulse</span>
            </div>
          </NavLink>
          <NavLink to="/trending" className={({ isActive }) => isActive ? activeLink : inactiveLink}>
            <div className="flex flex-col items-center">
              <ChartBarIcon className="w-6 h-6" />
              <span className="text-xs">Trending</span>
            </div>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => isActive ? activeLink : inactiveLink}>
            <div className="flex flex-col items-center">
              <UserCircleIcon className="w-6 h-6" />
              <span className="text-xs">Profile</span>
            </div>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};

export default BottomNavbar;