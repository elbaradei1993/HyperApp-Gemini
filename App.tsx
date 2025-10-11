
import React, { useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import Home from './pages/Home';
import Services from './pages/Services';
import Trending from './pages/Trending';
import Profile from './pages/Account';
import Login from './pages/Login';
import Layout from './components/layout/Layout';
import Activity from './pages/Activity';

const ProtectedRoute: React.FC = () => {
  const auth = useContext(AuthContext);

  if (auth?.loading) {
    return <div className="flex items-center justify-center h-screen bg-brand-primary">Loading...</div>;
  }

  return auth?.session ? <Layout><Outlet /></Layout> : <Navigate to="/login" replace />;
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

const AppRoutes: React.FC = () => {
    const auth = useContext(AuthContext);

    return (
        <HashRouter>
            <Routes>
                <Route path="/login" element={auth?.session ? <Navigate to="/" /> : <Login />} />
                <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/trending" element={<Trending />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/activity" element={<Activity />} />
                </Route>
            </Routes>
        </HashRouter>
    )
}


export default App;