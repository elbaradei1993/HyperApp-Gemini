import React from 'react';
import GlobalSearch from '../search/GlobalSearch';

const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-brand-secondary border-b border-gray-700 shadow-lg z-50 h-16">
      <div className="max-w-md mx-auto px-4 h-full flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">HyperAPP</h1>
        <GlobalSearch />
      </div>
    </header>
  );
};

export default Header;
