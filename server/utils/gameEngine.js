const GameHistory = require('../models/GameHistory');
const RoundBet = require('../models/RoundBet');
const User = require('../models/User');

// Game state
let gameState = {
  roundId: 1,
  status: 'betting', // 'betting', 'spinning', 'result'
  timeLeft: 10,
  currentResult: null,
  lastResults: [],
  onlinePlayers: 0
};

// PROBABILITY DISTRIBUTION — total = 92% (weighted, not required to sum to 100)
// 6 regular animals/birds: 12% each = 72%
// lion, eagle: 10% each = 20%
// shark_24x: 5%
// take_all, pay_all, golden_shark_100x: 1% each = 3%
// GRAND TOTAL = 100%
const PROBABILITIES = {
  rabbit:            12,
  swallow:           12,
  monkey:            12,
  panda:             12,
  pigeon:            12,
  peacock:           12,
  lion:              10,
  eagle:             10,
  shark_24x:          5,
  take_all:           1,
  pay_all:            1,
  golden_shark_100x:  1,
};

// Simulate N spins and print actual distribution to console (for verification only)
const simulateDistribution = (n = 10000) => {
  const counts = {};
  for (const key of Object.keys(PROBABILITIES)) counts[key] = 0;

  for (let i = 0; i < n; i++) {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const [result, prob] of Object.entries(PROBABILITIES)) {
      cumulative += prob;
      if (rand < cumulative) { counts[result]++; break; }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🎲 SPIN PROBABILITY SIMULATION — ${n.toLocaleString()} spins`);
  console.log('='.repeat(60));
  const tiers = [
    { label: 'Equal tier (13% each)',    keys: ['rabbit', 'swallow', 'monkey', 'panda', 'pigeon', 'peacock'] },
    { label: 'Slightly less (7% each)', keys: ['lion', 'eagle'] },
    { label: 'Rare (5%)',               keys: ['shark_24x'] },
    { label: 'Very Very Rare (1% each)',keys: ['take_all', 'pay_all', 'golden_shark_100x'] },
  ];
  for (const tier of tiers) {
    console.log(`\n  📌 ${tier.label}`);
    for (const key of tier.keys) {
      const actual  = ((counts[key] / n) * 100).toFixed(2);
      const expected = PROBABILITIES[key].toFixed(1);
      const bar = '█'.repeat(Math.round(counts[key] / n * 40));
      console.log(`     ${key.padEnd(20)} expected: ${String(expected+'%').padStart(6)}  actual: ${String(actual+'%').padStart(6)}  ${bar}`);
    }
  }
  console.log('\n' + '='.repeat(60) + '\n');
};

// Multipliers - CORRECTED
const MULTIPLIERS = {
  monkey: 8,
  rabbit: 6,           // Rabbit is 6x, not 8x
  lion: 12,
  panda: 8,
  swallow: 6,
  pigeon: 8,
  peacock: 8,
  eagle: 12,
  shark_24x: 24,
  golden_shark_100x: 100,
  take_all: 0,
  pay_all: 1,
  // 2x bets are handled separately in processing
  beast2x: 2,
  bird2x: 2
};

// COMPLETE BOX RESULT MAP - Verified against frontend layout
const BOX_RESULT_MAP = {
  // Top row (left to right) - indices 0-8
  0: "monkey", 
  1: "rabbit", 
  2: "rabbit", 
  3: "rabbit",
  4: "golden_shark_100x", 
  5: "swallow", 
  6: "swallow", 
  7: "swallow",
  8: "pigeon",
  
  // Right column (top to bottom) - indices 14-18
  14: "pigeon", 
  15: "pigeon", 
  16: "take_all",
  17: "peacock", 
  18: "peacock",
  
  // Bottom row (right to left) - indices 27-19
  27: "peacock", 
  26: "eagle",
  25: "eagle", 
  24: "eagle", 
  23: "shark_24x", 
  22: "lion",
  21: "lion", 
  20: "lion", 
  19: "panda",
  
  // Left column (bottom to top) - indices 13-9
  13: "panda",
  12: "panda", 
  11: "pay_all", 
  10: "monkey", 
  9: "monkey"
};

// Get random result based on corrected probabilities
const getRandomResult = () => {
  const rand = Math.random() * 100;
  let cumulative = 0;
  
  for (const [result, prob] of Object.entries(PROBABILITIES)) {
    cumulative += prob;
    if (rand < cumulative) {

      return result;
    }
  }
  
  return 'rabbit'; // fallback
};

// Get random box index based on result type
const getRandomBoxForResult = (resultType) => {
  // Find all box indices that match this result type
  const matchingBoxes = Object.entries(BOX_RESULT_MAP)
    .filter(([_, result]) => result === resultType)
    .map(([box]) => parseInt(box));
  
  // Return random matching box
  if (matchingBoxes.length > 0) {
    const selectedBox = matchingBoxes[Math.floor(Math.random() * matchingBoxes.length)];
    return selectedBox;
  }
  
  console.error(`❌ No matching boxes found for result: ${resultType}`);
  return 0; // fallback to monkey
};

// Process round results - CORRECTED Beast/Bird 2x logic
const processRoundResults = async (io, result, roundId, updateCoinsCallback, broadcastPlayersCallback) => {
  try {
    console.log(`💰 Processing results for round ${roundId}, result: ${result}`);
    
    const multiplier = MULTIPLIERS[result] || 1;
    
    // Determine if result is beast or bird for 2x bets
    const beasts = ['monkey', 'rabbit', 'lion', 'panda'];
    const birds = ['swallow', 'pigeon', 'peacock', 'eagle'];
    
    const isBeast = beasts.includes(result);
    const isBird = birds.includes(result);
    
    // Get all bets for this round
    const bets = await RoundBet.find({ roundId: roundId });
    
    console.log(`📊 Found ${bets.length} bets for round ${roundId}`);
    
    // Process each user's bets
    for (const bet of bets) {
      const user = await User.findById(bet.userId);
      if (!user) continue;
      
      let winAmount = 0;
      let winDetails = [];
      
      // Calculate winnings based on result
      switch (result) {
        case 'monkey':
        case 'rabbit':
        case 'lion':
        case 'panda':
          // Animal wins
          const animalBet = bet.bets[result] || 0;
          if (animalBet > 0) {
            winAmount += animalBet * MULTIPLIERS[result];
            winDetails.push(`${result}: ${animalBet}×${MULTIPLIERS[result]}=${animalBet * MULTIPLIERS[result]}`);
          }
          
          // Beast 2x pays separately (not a multiplier on other bets)
          const beast2xBet = bet.bets.beast2x || 0;
          if (beast2xBet > 0) {
            winAmount += beast2xBet * 2;
            winDetails.push(`beast2x: ${beast2xBet}×2=${beast2xBet * 2}`);
          }
          break;
          
        case 'swallow':
        case 'pigeon':
        case 'peacock':
        case 'eagle':
          // Bird wins
          const birdBet = bet.bets[result] || 0;
          if (birdBet > 0) {
            winAmount += birdBet * MULTIPLIERS[result];
            winDetails.push(`${result}: ${birdBet}×${MULTIPLIERS[result]}=${birdBet * MULTIPLIERS[result]}`);
          }
          
          // Bird 2x pays separately
          const bird2xBet = bet.bets.bird2x || 0;
          if (bird2xBet > 0) {
            winAmount += bird2xBet * 2;
            winDetails.push(`bird2x: ${bird2xBet}×2=${bird2xBet * 2}`);
          }
          break;
          
        case 'shark_24x':
          const sharkBet = bet.bets.shark24x || 0;
          if (sharkBet > 0) {
            winAmount += sharkBet * 24;
            winDetails.push(`shark24x: ${sharkBet}×24=${sharkBet * 24}`);
          }
          break;
          
        case 'golden_shark_100x':
          const goldenSharkBet = bet.bets.goldenShark || 0;
          if (goldenSharkBet > 0) {
            winAmount += goldenSharkBet * 100;
            winDetails.push(`goldenShark: ${goldenSharkBet}×100=${goldenSharkBet * 100}`);
          }
          break;
          
        case 'take_all':
          // House wins everything, no wins
          winDetails.push(`take_all: No wins`);
          break;
          
        case 'pay_all':
          // Return all bets
          winAmount = bet.totalBet;
          winDetails.push(`pay_all: Return all bets = ${bet.totalBet}`);
          break;
      }
      
      // Update user coins if they won anything
      if (winAmount > 0) {
        user.coins += winAmount;
        await user.save();
        
        // Update coins in the online users map if callback provided
        if (updateCoinsCallback) {
          updateCoinsCallback(user._id, user.coins);
        }
        
        console.log(`✅ User ${user.username} won ${winAmount} coins. Details: ${winDetails.join(', ')}`);
        
        // Emit win notification to specific user
        if (user.socketId) {
          io.to(user.socketId).emit('win-notification', {
            amount: winAmount,
            result: result,
            newBalance: user.coins,
            details: winDetails
          });
        }
      } else {
        console.log(`❌ User ${user.username} lost ${bet.totalBet} coins. Result: ${result}`);
      }
    }
    
    // Broadcast updated online players immediately after all wins are processed
    if (broadcastPlayersCallback) {
      await broadcastPlayersCallback(io);
    }
    
    // Save to history
    const displayName = result.replace(/_/g, ' ').toUpperCase();
    const history = new GameHistory({
      roundId: roundId,
      result: result,
      resultDisplay: displayName,
      winningMultiplier: multiplier
    });
    await history.save();
    
    // Keep only latest 25 results — delete older records (always by real insertion time)
    const totalCount = await GameHistory.countDocuments();
    if (totalCount > 25) {
      const oldest = await GameHistory.find()
        .sort({ createdAt: 1 })
        .limit(totalCount - 25)
        .select('_id');
      await GameHistory.deleteMany({ _id: { $in: oldest.map(r => r._id) } });
    }
    
    // Get last 25 results for history display sorted by actual insertion time
    const lastResults = await GameHistory.find()
      .sort({ createdAt: -1 }) // Descending by insertion time — newest first
      .limit(25)
      .lean();
    
    // Reverse to get oldest-to-newest order for display (oldest at top, newest at bottom)
    lastResults.reverse();
    
    // Update game state
    gameState.currentResult = {
      result: result,
      display: displayName,
      multiplier: multiplier
    };
    gameState.lastResults = lastResults; // Store in ascending order (oldest to newest)
    
    console.log(`📜 History updated. Total results: ${lastResults.length}`);
    
    // Emit result to all players with the box index included
    // Find a box index for this result (any matching box)
    const resultBoxes = Object.entries(BOX_RESULT_MAP)
      .filter(([_, r]) => r === result)
      .map(([box]) => parseInt(box));
    
    io.emit('round-result', {
      roundId: roundId,
      result: result,
      display: displayName,
      multiplier: multiplier,
      boxIndex: resultBoxes[0] || 0, // Include a sample box for the result display
      lastResults: lastResults
    });
    
    // Immediately broadcast history update to ensure all clients sync
    console.log(`📜 Broadcasting history-update with ${lastResults.length} results`);
    io.to('game-room').emit('history-update', lastResults);
    
    // Broadcast updated online players list (coins have been updated)
    if (broadcastPlayersCallback) {
      await broadcastPlayersCallback(io);
    }
    
    // Clear bets for this round
    await RoundBet.deleteMany({ roundId: roundId });
    
    console.log(`✅ Round ${roundId} completed. Result: ${result}`);
    
  } catch (error) {
    console.error('Error processing round:', error);
  }
};

// Start game loop
const startGameLoop = async (io, updateCoinsCallback = null, broadcastPlayersCallback = null) => {
  // One-time cleanup: remove old timestamp-based roundId records left from a previous bug
  try {
    const deleted = await GameHistory.deleteMany({ roundId: { $gt: 1_000_000_000_000 } });
    if (deleted.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deleted.deletedCount} old timestamp-based history records`);
    }
  } catch (e) { /* ignore cleanup errors */ }

  // Initialize roundId from the most recently inserted record
  try {
    const lastRound = await GameHistory.findOne().sort({ createdAt: -1 });
    if (lastRound) {
      gameState.roundId = lastRound.roundId + 1;
    } else {
      gameState.roundId = 1;
    }
  } catch (error) {
    console.error('Error initializing round ID:', error);
  }

  // Reset state cleanly
  gameState.status = 'betting';
  gameState.timeLeft = 10;
  gameState.currentResult = null;

  console.log(`🎮 Game loop started - running 24/7 (Starting from Round ${gameState.roundId})`);
  
  // Print configured probabilities
  console.log('\n📊 Configured Probability Table:');
  for (const [key, val] of Object.entries(PROBABILITIES)) {
    console.log(`   ${key.padEnd(22)} → ${val}%`);
  }

  // Run simulation to verify actual distribution matches expected
  simulateDistribution(10000);

  // Watchdog: if game gets stuck in spinning/result > 30s, force reset to betting
  let lastStatusChange = Date.now();
  let lastCheckedStatus = 'betting';

  const timer = setInterval(async () => {
    try {
      // Watchdog check — if stuck for >30s in non-betting state, force reset
      if (gameState.status !== lastCheckedStatus) {
        lastCheckedStatus = gameState.status;
        lastStatusChange = Date.now();
      } else if (gameState.status !== 'betting' && (Date.now() - lastStatusChange) > 30000) {
        console.warn(`⚠️ Game loop stuck in '${gameState.status}' for >30s. Force-resetting to betting.`);
        gameState.status = 'betting';
        gameState.timeLeft = 10;
        gameState.roundId++;
        io.emit('betting-started', { timeLeft: 10, roundId: gameState.roundId });
        lastStatusChange = Date.now();
        lastCheckedStatus = 'betting';
      }

    if (gameState.status === 'betting') {
      gameState.timeLeft--;
      
      // When 3 seconds left, show big countdown
      if (gameState.timeLeft <= 3 && gameState.timeLeft > 0) {
        io.emit('countdown', gameState.timeLeft);
      }
      
      // Betting ended
      if (gameState.timeLeft <= 0) {
        gameState.status = 'spinning';
        gameState.timeLeft = 0;
        
        // Stop betting
        io.emit('betting-stopped');
        
        // Small delay before spinning
        setTimeout(() => {
          // Calculate result BEFORE spinning starts
          const spinResult = getRandomResult();
          const spinMultiplier = MULTIPLIERS[spinResult];
          const spinBoxIndex = getRandomBoxForResult(spinResult);
          
          // Send spin-start with ONLY the box index — never expose result/multiplier to client before reveal
          io.emit('spin-start', {
            boxIndex: spinBoxIndex,
            roundId: gameState.roundId
          });
          
          // Simulate spinning for 7 seconds (matches frontend animation phases: 2s + 2.5s + 2.5s = 7s)
          setTimeout(async () => {
            await processRoundResults(io, spinResult, gameState.roundId, updateCoinsCallback, broadcastPlayersCallback);
            
            gameState.status = 'result';
            
            // Wait 3 seconds showing result before next round
            setTimeout(() => {
              gameState.status = 'betting';
              gameState.timeLeft = 10;
              gameState.roundId++; // Increment round ID for next round
              
              // Start new betting round
              io.emit('betting-started', {
                timeLeft: 10,
                roundId: gameState.roundId
              });
              
              console.log(`🔄 Round ${gameState.roundId} betting started`);
            }, 3000);
            
          }, 7000); // Spin duration: 7 seconds (matches frontend)
        }, 1000);
      }
    }
    
    // Emit game state every second
    io.emit('game-state', {
      roundId: gameState.roundId,
      status: gameState.status,
      timeLeft: gameState.timeLeft,
      currentResult: gameState.currentResult,
      onlinePlayers: gameState.onlinePlayers
    });

    } catch (loopErr) {
      console.error('⚠️ Game loop tick error:', loopErr.message);
    }
  }, 1000);
  
  return timer;
};

// Update online players count
const updateOnlinePlayers = (count) => {
  gameState.onlinePlayers = count;
};

module.exports = {
  startGameLoop,
  updateOnlinePlayers,
  gameState,
  MULTIPLIERS,
  PROBABILITIES,
  BOX_RESULT_MAP
};