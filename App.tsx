import React, { useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Services from './pages/Services';
import Events from './pages/Events';
import Account from './pages/Account';
import Login from './pages/Login';
import CreateEvent from './pages/CreateEvent';
import EditEvent from './pages/EditEvent';
import Activity from './pages/Activity';

const ProtectedRoute: React.FC = () => {
  const auth = useContext(AuthContext);
  if (auth?.loading) {
    // A simple loading indicator to prevent flicker during auth check
    return <div className="h-screen w-screen bg-brand-primary flex items-center justify-center text-white">Loading...</div>;
  }
  return auth?.session ? <Layout><Outlet /></Layout> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/events" element={<Events />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/create-event" element={<CreateEvent />} />
              <Route path="/edit-event/:id" element={<EditEvent />} />
              <Route path="/profile" element={<Account />} />
            </Route>
          </Routes>
        </HashRouter>
      </DataProvider>
    </AuthProvider>
  );
};

export default App;