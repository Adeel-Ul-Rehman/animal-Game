import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FaEnvelope, FaGamepad } from 'react-icons/fa';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/send-otp', { 
        email,
        purpose: 'reset-password'
      });
      
      if (res.data.success) {
        toast.success('OTP sent to your email! Check spam folder.');
        setSent(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <FaGamepad className="text-6xl text-yellow-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Forgot Password</h1>
          <p className="text-gray-300">Enter your email to reset password</p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white mb-2 font-medium">Email</label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-3 rounded-lg hover:from-yellow-500 hover:to-orange-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-6 mb-4">
            <p className="text-white text-center">
              OTP has been sent to <strong>{email}</strong>. 
              Please check your inbox (and spam folder).
            </p>
            <div className="text-center mt-4">
              <Link to={`/reset-password?email=${encodeURIComponent(email)}`} className="text-yellow-400 hover:text-yellow-300 font-medium">
                Enter OTP to Reset Password →
              </Link>
            </div>
          </div>
        )}

        <div className="mt-6 text-center space-y-2">
          <Link to="/login" className="block text-yellow-400 hover:text-yellow-300">
            Back to Login
          </Link>
          <Link to="/register" className="block text-gray-300 hover:text-white">
            Don't have an account? Register
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
