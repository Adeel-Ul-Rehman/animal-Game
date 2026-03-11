import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

// Mobile orientation handler
const useOrientation = () => {
  useEffect(() => {
    const handleOrientationChange = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile && isPortrait) {
        document.body.classList.add('portrait-mode');
        // Show orientation message
        const orientationMsg = document.querySelector('.portrait\\:flex');
        if (orientationMsg) {
          orientationMsg.style.display = 'flex';
        }
      } else {
        document.body.classList.remove('portrait-mode');
        const orientationMsg = document.querySelector('.portrait\\:flex');
        if (orientationMsg) {
          orientationMsg.style.display = 'none';
        }
      }
    };
    
    // Initial check
    handleOrientationChange();
    
    // Add event listeners
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);
};

function App() {
  useOrientation();
  
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
            
            {/* Mobile Portrait Warning - Shown via CSS */}
            <div className="portrait:flex hidden fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 items-center justify-center z-50 text-white text-center px-8">
              <div>
                <div className="text-6xl mb-4 animate-bounce">📱</div>
                <div className="text-2xl font-bold mb-2">
                  Please Rotate Your Device
                </div>
                <div className="text-lg opacity-80">
                  This game is best played in landscape mode
                </div>
                <div className="mt-8 text-sm opacity-60">
                  Rotate your phone for the best experience
                </div>
              </div>
            </div>
            
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
    </Router>
  );
}

export default App;