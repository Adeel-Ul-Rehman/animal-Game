import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Game from './pages/Game';
import AdminDashboard from './pages/AdminDashboard';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import './App.css';

const AppContent = () => {
  const location = useLocation();

  useEffect(() => {
    // App is now fully responsive - portrait and landscape supported
  }, [location.pathname]);

  return (
    <AuthProvider>
      <SocketProvider>
        <div className="app">
            <Toaster 
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#333',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                },
                success: {
                  icon: '✅',
                  style: {
                    background: '#4CAF50',
                  },
                },
                error: {
                  icon: '❌',
                  style: {
                    background: '#f44336',
                  },
                },
              }}
            />
            
            {/* Mobile Portrait Support - Fully responsive layout */}
            
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/game" element={
              <PrivateRoute>
                <Game />
              </PrivateRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } />
            <Route path="/" element={<Navigate to="/game" />} />
          </Routes>
        </div>
      </SocketProvider>
    </AuthProvider>
  );
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </Router>
  );
}

export default App;