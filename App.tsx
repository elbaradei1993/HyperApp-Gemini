import React, { useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';

import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Activity from './pages/Activity';
import Trending from './pages/Trending';
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
  return auth?.session ? <Outlet /> : <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route element={<PrivateRoutes />}>
                    {/* FIX: The Layout component already contains an <Outlet> for rendering child routes and does not accept children. */}
                    <Route element={<Layout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/activity" element={<Activity />} />
                        <Route path="/trending" element={<Trending />} />
                        <Route path="/services" element={<Services />} />
                        <Route path="/events" element={<Events />} />
                        <Route path="/create-event" element={<CreateEvent />} />
                        <Route path="/edit-event/:id" element={<EditEvent />} />
                        <Route path="/profile" element={<Account />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                   </Route>
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
