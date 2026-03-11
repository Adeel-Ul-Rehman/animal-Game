const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Load env vars from file only in development — in production Fly injects them directly
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const gameRoutes = require('./routes/gameRoutes');

// Import socket handlers
const { initializeSocket, updateUserCoinsInMap, broadcastOnlinePlayers } = require('./sockets/gameSocket');

// Import ioRef for sharing socket instance with admin routes
const { setIo } = require('./utils/ioRef');

// Import game engine
const { startGameLoop } = require('./utils/gameEngine');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB with retry logic
const connectWithRetry = (attempt = 1) => {
  console.log(`🔌 MongoDB connection attempt ${attempt}...`);
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('✅ MongoDB Connected Successfully');

      // Create default admin if not exists
      require('./utils/createDefaultAdmin')();

      // Share io instance with admin routes (for game stop/resume socket emissions)
      setIo(io);

      // Initialize socket
      initializeSocket(io);

      // Start the 24/7 game loop
      startGameLoop(io, updateUserCoinsInMap, broadcastOnlinePlayers);
      console.log('🎮 Game loop started - 24/7 automatic rounds running');
    })
    .catch(err => {
      console.error(`❌ MongoDB Connection Error (attempt ${attempt}):`, err.message);
      const delay = Math.min(5000 * attempt, 30000); // back-off: 5s, 10s, 15s... max 30s
      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      setTimeout(() => connectWithRetry(attempt + 1), delay);
    });
};

connectWithRetry();
  
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/game', gameRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});