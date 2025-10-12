import React, { useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';

// Layout and Pages
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

// A wrapper for routes that require authentication
const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const auth = useContext(AuthContext);

  if (auth?.loading) {
    // You can render a loading spinner here
    return <div className="h-screen w-screen flex items-center justify-center bg-brand-primary text-white">Loading...</div>;
  }

  return auth?.session ? children : <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/*"
                    element={
                        <PrivateRoute>
                            <Layout>
                                <Routes>
                                    <Route path="/" element={<Home />} />
                                    <Route path="/activity" element={<Activity />} />
                                    <Route path="/trending" element={<Trending />} />
                                    <Route path="/services" element={<Services />} />
                                    <Route path="/events" element={<Events />} />
                                    <Route path="/create-event" element={<CreateEvent />} />
                                    <Route path="/edit-event/:id" element={<EditEvent />} />
                                    <Route path="/profile" element={<Account />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Layout>
                        </PrivateRoute>
                    }
                />
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