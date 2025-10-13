import React, { useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';

import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Activity from './pages/Activity';
import Services from './pages/Services';
import Events from './pages/Events';
import CreateEvent from './pages/CreateEvent';
import EditEvent from './pages/EditEvent';
import Account from './pages/Account';

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
                
                {/* 
                  The redundant nested Route has been removed. PrivateRoutes now acts as the single
                  layout component for all protected routes. It handles authentication and renders the 
                  main `Layout`, which in turn uses its `<Outlet>` to render the specific page component 
                  (e.g., Home, Trending). This simplifies the routing hierarchy and resolves the error.
                */}
                <Route element={<PrivateRoutes />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/trending" element={<Activity />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/create-event" element={<CreateEvent />} />
                    <Route path="/edit-event/:id" element={<EditEvent />} />
                    <Route path="/profile" element={<Account />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </Router>
    );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
        <DataProvider>
            <AppRoutes />
        </DataProvider>
    </AuthProvider>
  );
};

export default App;