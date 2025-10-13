import React, { useContext, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';

import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Pulse from './pages/Pulse';
import Events from './pages/Events';
import CreateEvent from './pages/CreateEvent';
import EditEvent from './pages/EditEvent';
import Account from './pages/Account';
import Settings from './pages/Settings'; // Import the new Settings page

const PrivateRoutes: React.FC = () => {
  const auth = useContext(AuthContext);
  if (auth?.loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-brand-primary text-white">Loading Session...</div>;
  }
  // If authenticated, render the Layout which contains an <Outlet> for the nested page routes.
  // Otherwise, redirect to the login page.
  return auth?.session ? <Layout /> : <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route element={<PrivateRoutes />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/pulse" element={<Pulse />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/create-event" element={<CreateEvent />} />
                    <Route path="/edit-event/:id" element={<EditEvent />} />
                    <Route path="/profile" element={<Account />} />
                    <Route path="/settings" element={<Settings />} /> 
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </Router>
    );
};

const App: React.FC = () => {
  // Effect to apply the saved theme on initial load
  useEffect(() => {
    const applyTheme = () => {
      const theme = localStorage.getItem('hyperapp-theme') || 'system';
      const body = document.body;
      const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      body.classList.remove('bg-brand-primary', 'text-white', 'bg-gray-100', 'text-black');

      if (theme === 'dark' || (theme === 'system' && darkQuery.matches)) {
        body.classList.add('bg-brand-primary', 'text-white');
      } else {
        body.classList.add('bg-gray-100', 'text-black');
      }
    };
    
    applyTheme();

    // Listen for system theme changes if the user has selected 'system'
    const systemThemeListener = (e: MediaQueryListEvent) => {
        if (localStorage.getItem('hyperapp-theme') === 'system') {
            applyTheme();
        }
    };
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkQuery.addEventListener('change', systemThemeListener);

    return () => {
        darkQuery.removeEventListener('change', systemThemeListener);
    };
  }, []);


  return (
    <AuthProvider>
        <DataProvider>
            <AppRoutes />
        </DataProvider>
    </AuthProvider>
  );
};

export default App;