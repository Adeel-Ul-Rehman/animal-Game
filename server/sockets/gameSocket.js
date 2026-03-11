const User = require('../models/User');
const RoundBet = require('../models/RoundBet');
const GameHistory = require('../models/GameHistory');
const { updateOnlinePlayers, gameState, MULTIPLIERS, PROBABILITIES, BOX_RESULT_MAP } = require('../utils/gameEngine');
const jwt = require('jsonwebtoken');

let onlineUsers = new Map(); // socketId -> { userId, username, coins, profilePicture }

// Global game-stopped flag — shared with adminRoutes via exports
let gameStopped = false;
const getGameStopped = () => gameStopped;
const setGameStopped = (val) => { gameStopped = val; };

// Helper to force-disconnect a banned user across all their sockets
const forceDisconnectUser = (userId) => {
  for (const [socketId, userData] of onlineUsers.entries()) {
    if (userData.userId.toString() === userId.toString()) {
      // We need access to io here — it's available via ioRef
      const { getIo } = require('../utils/ioRef');
      const io = getIo();
      if (io) {
        const userSocket = io.sockets.sockets.get(socketId);
        if (userSocket) {
          userSocket.emit('user-banned', { reason: '' });
          setTimeout(() => userSocket.disconnect(true), 800);
        }
      }
    }
  }
};

// Helper to get current online players list (for admin API)
const getOnlinePlayersList = async () => {
  const byUserId = new Map();
  for (const [, userData] of onlineUsers.entries()) {
    byUserId.set(userData.userId.toString(), userData);
  }
  const players = [];
  for (const [userId, userData] of byUserId.entries()) {
    try {
      const user = await User.findById(userId).select('username coins profilePicture isOnline createdAt').lean();
      if (user) players.push({ userId: user._id, username: user.username, coins: user.coins, profilePicture: user.profilePicture, isOnline: true });
    } catch (e) { /* skip */ }
  }
  return players;
};

// Helper function to remove old socket entries for a user
const removeOldUserSockets = (userId) => {
  for (const [socketId, userData] of onlineUsers.entries()) {
    if (userData.userId.toString() === userId.toString()) {
      onlineUsers.delete(socketId);
      console.log(`🧹 Removed old socket ${socketId} for user ${userData.username}`);
    }
  }
};

// Helper function to update user coins across all their sockets
const updateUserCoinsInMap = (userId, newCoins) => {
  for (const [socketId, userData] of onlineUsers.entries()) {
    if (userData.userId.toString() === userId.toString()) {
      userData.coins = newCoins;
      console.log(`💰 Updated coins for ${userData.username}: ${newCoins}`);
    }
  }
};

// Helper function to get count of unique users (not socket connections)
const getUniqueUserCount = () => {
  const uniqueUserIds = new Set();
  for (const [socketId, userData] of onlineUsers.entries()) {
    uniqueUserIds.add(userData.userId.toString());
  }
  return uniqueUserIds.size;
};

// Helper function to broadcast updated online players list
// Always reads fresh coins from DB for each user still in the Map.
const broadcastOnlinePlayers = async (io) => {
  if (!io) return;

  // Deduplicate by userId (keep latest socket entry)
  const byUserId = new Map();
  for (const [socketId, userData] of onlineUsers.entries()) {
    byUserId.set(userData.userId.toString(), userData);
  }

  // Fetch fresh coin balance from DB for each unique online user
  const playersList = [];
  for (const [userId, userData] of byUserId.entries()) {
    try {
      const user = await User.findById(userId).select('username coins profilePicture isOnline isAdmin').lean();
      if (user) {
        const freshCoins = user.coins;
        // Keep Map up-to-date too
        for (const [sid, ud] of onlineUsers.entries()) {
          if (ud.userId.toString() === userId) ud.coins = freshCoins;
        }
        playersList.push({
          userId: user._id,
          username: user.username,
          coins: freshCoins,
          profilePicture: user.profilePicture,
          isAdmin: user.isAdmin || false,
        });
      }
    } catch (err) {
      console.error(`broadcastOnlinePlayers error for ${userId}:`, err);
    }
  }

  console.log(`👥 Broadcasting ${playersList.length} online players (${onlineUsers.size} sockets)`);
  io.to('game-room').emit('online-players', {
    count: playersList.length,
    players: playersList,
  });
};

const initializeSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    
    // Handle user authentication via socket
    socket.on('authenticate', async (token) => {
      try {
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await User.findById(decoded.userId);
        
        if (user && user.status === 'active') {
          // Check if user is banned — emit ban event and block game-room access
          if (user.isBanned) {
            socket.emit('user-banned', { reason: user.banReason || 'Account banned by administrator' });
            return;
          }
          // Remove any old socket entries for this user (handles reconnections)
          removeOldUserSockets(user._id);
          
          // Update user online status
          user.socketId = socket.id;
          user.isOnline = true;
          await user.save();
          
          // Add user to online users map
          onlineUsers.set(socket.id, {
            userId: user._id,
            username: user.username,
            coins: user.coins,
            profilePicture: user.profilePicture
          });
          
          // Update online count
          updateOnlinePlayers(getUniqueUserCount());
          
          // Join user to game room
          socket.join('game-room');
          
          // Send current game state
          socket.emit('game-state', {
            roundId: gameState.roundId,
            status: gameState.status,
            timeLeft: gameState.timeLeft,
            currentResult: gameState.currentResult,
            onlinePlayers: getUniqueUserCount(),
            gameStopped: gameStopped
          });
          
          // Send last 25 results sorted by insertion time (oldest → newest for display)
          const lastResults = await GameHistory.find()
            .sort({ createdAt: -1 }) // Newest first from DB
            .limit(25)
            .lean();
          
          // Reverse so oldest is at top, newest at bottom of history column
          lastResults.reverse();
          
          console.log(`📜 Sending ${lastResults.length} history results to new client`);
          socket.emit('history-results', lastResults);
          
          // Broadcast updated online players list
          await broadcastOnlinePlayers(io);
          
          console.log(`✅ User ${user.username} authenticated`);
        }
      } catch (error) {
        console.error('Socket authentication error:', error);
        socket.emit('auth-error', { message: 'Authentication failed' });
      }
    });
    
    // Handle placing SINGLE bet (kept for backward compatibility)
    socket.on('place-bet', async (data) => {
      try {
        const userData = onlineUsers.get(socket.id);
        if (!userData) {
          socket.emit('bet-error', { message: 'Not authenticated' });
          return;
        }
        
        // Convert single bet to multiple bets format
        const bets = {};
        bets[data.betType] = data.amount;
        
        // Call the multiple bets handler
        await handlePlaceBets(socket, userData, bets);
        
      } catch (error) {
        console.error('Place bet error:', error);
        socket.emit('bet-error', { message: 'Server error' });
      }
    });
    
    // Handle placing MULTIPLE bets (main handler)
    socket.on('place-multiple-bets', async (data) => {
      try {
        const userData = onlineUsers.get(socket.id);
        if (!userData) {
          socket.emit('bet-error', { message: 'Not authenticated' });
          return;
        }
        
        await handlePlaceBets(socket, userData, data.bets);
        
      } catch (error) {
        console.error('Place multiple bets error:', error);
        socket.emit('bet-error', { message: 'Server error' });
      }
    });
    
    // Shared bet handling logic
    const handlePlaceBets = async (socket, userData, bets) => {
      const user = await User.findById(userData.userId);
      if (!user) {
        socket.emit('bet-error', { message: 'User not found' });
        return;
      }
      
      // Check if betting is allowed
      if (gameState.status !== 'betting') {
        socket.emit('bet-error', { message: 'Betting is closed' });
        return;
      }
      
      // Calculate total bet
      let totalBet = 0;
      const validatedBets = {};
      
      // Valid bet types
      const validBetTypes = [
        'monkey', 'rabbit', 'lion', 'panda',
        'swallow', 'pigeon', 'peacock', 'eagle',
        'beast2x', 'bird2x', 'shark24x', 'goldenShark'
      ];
      
      for (const [betType, amount] of Object.entries(bets)) {
        if (validBetTypes.includes(betType) && amount > 0) {
          validatedBets[betType] = amount;
          totalBet += amount;
        }
      }
      
      // Check minimum bet (at least 10 coins total)
      if (totalBet < 10) {
        socket.emit('bet-error', { message: 'Minimum bet is 10 coins' });
        return;
      }
      
      // Check if user has enough coins
      if (user.coins < totalBet) {
        socket.emit('bet-error', { message: 'Insufficient coins' });
        return;
      }
      
      // Deduct coins from user
      user.coins -= totalBet;
      await user.save();
      
      // Update coins in the map for all sockets of this user
      updateUserCoinsInMap(user._id, user.coins);
      
      // Save bet to database
      const roundBet = await RoundBet.findOneAndUpdate(
        { roundId: gameState.roundId, userId: user._id },
        {
          roundId: gameState.roundId,
          userId: user._id,
          username: user.username,
          bets: validatedBets,
          totalBet: totalBet
        },
        { upsert: true, new: true }
      );
      
      console.log(`💰 Bet placed by ${user.username}:`, validatedBets, `Total: ${totalBet}`);
      
      // Confirm bet to user
      socket.emit('bet-confirmed', {
        bets: validatedBets,
        totalBet: totalBet,
        newBalance: user.coins
      });

      // Broadcast bet animation to ALL other players in the room
      // One event per unique betType so each coin flies independently
      for (const [betType, amount] of Object.entries(validatedBets)) {
        socket.to('game-room').emit('bet-animation', {
          userId:   userData.userId,
          username: userData.username,
          betType,
          amount,
        });
      }

      // Broadcast updated online players list with new balances
      await broadcastOnlinePlayers(io);
    };
    
    // Handle ReBet
    socket.on('rebet', async (data) => {
      try {
        const userData = onlineUsers.get(socket.id);
        if (!userData) return;
        
        const user = await User.findById(userData.userId);
        if (!user) return;
        
        // Calculate total of previous bet
        let totalBet = 0;
        for (const [key, value] of Object.entries(data.bets)) {
          if (value > 0) totalBet += value;
        }
        
        // Check if user has enough coins
        if (user.coins < totalBet) {
          socket.emit('bet-error', { message: 'Insufficient coins for ReBet' });
          return;
        }
        
        // Place the same bet again using multiple bets handler
        await handlePlaceBets(socket, userData, data.bets);
        
      } catch (error) {
        console.error('ReBet error:', error);
      }
    });
    
    // ----------------------------------------------------------------
    // Handle client-side spin result (dev/manual spin mode)
    // Client emits after spin finishes; server saves to DB, writes
    // the correct coin balance, and broadcasts history to everyone.
    // ----------------------------------------------------------------
    socket.on('client-spin-result', async (data) => {
      try {
        const userData = onlineUsers.get(socket.id);
        if (!userData) {
          socket.emit('spin-save-error', { message: 'Not authenticated' });
          return;
        }

        const { result, resultDisplay, winningMultiplier, winAmount, finalCoins } = data;

        if (!result || resultDisplay === undefined || winningMultiplier === undefined) {
          socket.emit('spin-save-error', { message: 'Missing spin result fields' });
          return;
        }

        // 1. Save spin result to DB using current game round ID
        const roundId = gameState.roundId;
        await GameHistory.create({ roundId, result, resultDisplay, winningMultiplier });

        // 2. Enforce 25-record cap — delete oldest extras
        const totalCount = await GameHistory.countDocuments();
        if (totalCount > 25) {
          const oldest = await GameHistory.find()
            .sort({ createdAt: 1 })
            .limit(totalCount - 25)
            .select('_id');
          await GameHistory.deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
        }

        // 3. Write correct coin balance to DB
        // finalCoins already accounts for bet deductions + win (calculated client-side)
        const user = await User.findById(userData.userId);
        if (user) {
          const newBalance = (typeof finalCoins === 'number' && finalCoins >= 0)
            ? finalCoins
            : Math.max(0, user.coins + (typeof winAmount === 'number' && winAmount > 0 ? winAmount : 0));

          user.coins = newBalance;
          await user.save();
          // Update the Map with fresh coins
          updateUserCoinsInMap(userData.userId, newBalance);
          socket.emit('coins-updated', { coins: newBalance });
          console.log(`💰 Coins updated for ${userData.username}: ${newBalance}`);
        }

        // 4. Fetch authoritative last-25 in oldest-first order and broadcast to EVERYONE
        const lastResults = await GameHistory.find()
          .sort({ createdAt: -1 })
          .limit(25)
          .lean();
        // Reverse so oldest is first, newest is last (matches client render order)
        lastResults.reverse();

        io.to('game-room').emit('history-update', lastResults);

        // 5. Broadcast updated online players list with fresh coin balances
        await broadcastOnlinePlayers(io);

        console.log(`✅ Spin saved: ${result} x${winningMultiplier} | history ${lastResults.length} records`);
      } catch (error) {
        console.error('client-spin-result error:', error);
        socket.emit('spin-save-error', { message: 'Server error saving spin result' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log('🔌 Client disconnected:', socket.id);

      const userData = onlineUsers.get(socket.id);
      if (userData) {
        const userId = userData.userId.toString();

        // Remove THIS socket from the map first
        onlineUsers.delete(socket.id);

        // Check if the user still has another active socket (e.g. reconnected)
        const stillConnected = Array.from(onlineUsers.values())
          .some(u => u.userId.toString() === userId);

        if (!stillConnected) {
          // No other socket for this user — mark them truly offline
          await User.findByIdAndUpdate(userData.userId, {
            isOnline: false,
            socketId: null
          });
          console.log(`📴 User ${userData.username} marked offline`);
        } else {
          console.log(`↩️  User ${userData.username} still has active socket(s), keeping online`);
        }

        updateOnlinePlayers(getUniqueUserCount());
        await broadcastOnlinePlayers(io);
      }
    });
  });
};

module.exports = { initializeSocket, updateUserCoinsInMap, broadcastOnlinePlayers, forceDisconnectUser, getGameStopped, setGameStopped, getOnlinePlayersList };