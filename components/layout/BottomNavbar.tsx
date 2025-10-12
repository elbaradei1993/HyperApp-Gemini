import React from 'react';
import { NavLink } from 'react-router-dom';
import { GlobeAltIcon, BellAlertIcon, LocationMarkerIcon, LightBulbIcon, UserIcon } from '../ui/Icons';

const navItems = [
    { to: '/', label: 'Map', icon: LocationMarkerIcon },
    { to: '/services', label: 'Pulse', icon: LightBulbIcon },
    { to: '/events', label: 'Events', icon: GlobeAltIcon },
    { to: '/activity', label: 'Activity', icon: BellAlertIcon },
    { to: '/profile', label: 'Profile', icon: UserIcon },
];

const BottomNavbar: React.FC = () => {
    const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
        `flex flex-col items-center justify-center w-full pt-2 pb-1 text-xs transition-colors duration-200 ease-in-out ${
            isActive ? 'text-brand-accent' : 'text-gray-400 hover:text-white'
        }`;

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-brand-secondary border-t border-gray-700 shadow-lg z-50">
            <div className="max-w-md mx-auto h-full flex justify-around">
                {navItems.map(({ to, label, icon: Icon }) => (
                    <NavLink to={to} key={to} className={navLinkClasses} end>
                        <Icon className="w-6 h-6 mb-1" />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default BottomNavbar;
