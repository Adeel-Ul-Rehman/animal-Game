import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FaEnvelope, FaLock, FaUser, FaGamepad, FaKey } from 'react-icons/fa';

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    otp: ''
  });
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.username || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/send-otp', {
        email: formData.email,
        purpose: 'verification'
      });
      
      if (res.data.success) {
        toast.success('OTP sent to your email! Check spam folder if not found.');
        setStep(2);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.otp) {
      toast.error('Please enter OTP');
      return;
    }

    if (formData.otp.length !== 6) {
      toast.error('OTP must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/register', {
        email: formData.email,
        username: formData.username,
        password: formData.password,
        otp: formData.otp
      });
      
      if (res.data.success) {
        toast.success('Registration successful! You received 500 welcome coins!');
        navigate('/login');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <FaGamepad className="text-6xl text-yellow-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Animal Battle</h1>
          <p className="text-gray-300">Create your account</p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOTP} className="space-y-6">
            <div>
              <label className="block text-white mb-2 font-medium">Email</label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label className="block text-white mb-2 font-medium">Username</label>
              <div className="relative">
                <FaUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Choose a username"
                />
              </div>
            </div>

            <div>
              <label className="block text-white mb-2 font-medium">Password</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Create a password"
                />
              </div>
            </div>

            <div>
              <label className="block text-white mb-2 font-medium">Confirm Password</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-3 rounded-lg hover:from-yellow-500 hover:to-orange-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-4">
              <p className="text-white text-sm">
                OTP has been sent to <strong>{formData.email}</strong>. 
                Please check your inbox (and spam folder).
              </p>
            </div>

            <div>
              <label className="block text-white mb-2 font-medium">Enter OTP</label>
              <div className="relative">
                <FaKey className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="otp"
                  value={formData.otp}
                  onChange={handleChange}
                  maxLength="6"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center text-2xl tracking-widest"
                  placeholder="000000"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-3 rounded-lg hover:from-yellow-500 hover:to-orange-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Complete Registration'}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-700 transition duration-300"
            >
              Back
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-gray-300">
            Already have an account?{' '}
            <Link to="/login" className="text-yellow-400 hover:text-yellow-300 font-medium">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
