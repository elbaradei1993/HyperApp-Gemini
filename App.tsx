import React, { useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { NotificationProvider } from './contexts/NotificationContext';

import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Pulse from './pages/Pulse';
import Events from './pages/Events';
import CreateEvent from './pages/CreateEvent';
import EditEvent from './pages/EditEvent';
import Account from './pages/Account';
import Settings from './pages/Settings';
import Toast from './components/ui/Toast';

const PrivateRoutes: React.FC = () => {
  const auth = useContext(AuthContext);
  if (auth?.loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-brand-primary text-text-primary">Loading Session...</div>;
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
  return (
    <AuthProvider>
      <NotificationProvider>
        <DataProvider>
            <Toast />
            <AppRoutes />
        </DataProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
