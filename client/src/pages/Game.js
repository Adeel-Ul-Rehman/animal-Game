import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import axios from "axios";
import toast from "react-hot-toast";
import { FaUsers, FaSignOutAlt, FaCamera, FaKey, FaEdit, FaTimes, FaTrash, FaEye, FaEyeSlash, FaCheck, FaBell, FaCoins, FaVolumeUp, FaVolumeMute, FaHistory, FaExpand } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import soundManager from "../utils/soundManager";

// Animal images
import monkeyImg from "../assets/images/monkey.png";
import rabbitImg from "../assets/images/rabbit.png";
import lionImg from "../assets/images/lion.png";
import pandaImg from "../assets/images/panda.png";

// Bird images
import swallowImg from "../assets/images/swallow.png";
import doveImg from "../assets/images/dove.png";
import peacockImg from "../assets/images/peacock.png";
import eagleImg from "../assets/images/eagle.png";

// Shark images
import sharkImg from "../assets/images/shark.png";
import goldenSharkImg from "../assets/images/goldenShark.png";
// Take All / Pay All dedicated images
import takeAllImg from "../assets/images/takeAll.png";
import payAllImg from "../assets/images/payAll.png";

// Result image mapping (matches backend result names)
const resultImages = {
  monkey: monkeyImg,
  rabbit: rabbitImg,
  lion: lionImg,
  panda: pandaImg,
  swallow: swallowImg,
  pigeon: doveImg, // Backend sends "pigeon", use dove image
  peacock: peacockImg,
  eagle: eagleImg,
  shark_24x: sharkImg,
  golden_shark_100x: goldenSharkImg,
  takeAll: takeAllImg,
  payAll: payAllImg,
  // Also support frontend names for compatibility
  shark24x: sharkImg,
  goldenShark: goldenSharkImg,
  take_all: takeAllImg,
  pay_all: payAllImg,
};

// Result display names
const resultDisplayNames = {
  monkey: "MONKEY",
  rabbit: "RABBIT",
  lion: "LION",
  panda: "PANDA",
  swallow: "SWALLOW",
  pigeon: "PIGEON",
  peacock: "PEACOCK",
  eagle: "EAGLE",
  shark_24x: "SHARK 24X",
  golden_shark_100x: "GOLDEN SHARK",
  take_all: "TAKE ALL",
  pay_all: "PAY ALL",
  // Frontend compatibility
  shark24x: "SHARK 24X",
  goldenShark: "GOLDEN SHARK",
  takeAll: "TAKE ALL",
  payAll: "PAY ALL",
};

const Game = () => {
  const navigate = useNavigate();
  const { user, token, updateUserCoins, updateUser, logout } = useAuth();
  const { socket } = useSocket();

  // Game state
  const [selectedCoin, setSelectedCoin] = useState(10);
  const [bets, setBets] = useState({});
  const [totalBet, setTotalBet] = useState(0);
  const [gameStatus, setGameStatus] = useState("betting");
  const [timeLeft, setTimeLeft] = useState(10);
  const [currentResult, setCurrentResult] = useState(null);
  const [historyResults, setHistoryResults] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showOnlinePlayers, setShowOnlinePlayers] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  // Coin request modal state
  const [showCoinRequest, setShowCoinRequest] = useState(false);
  const [coinRequestAmount, setCoinRequestAmount] = useState(100);
  const [coinRequestLoading, setCoinRequestLoading] = useState(false);
  const [latestCoinRequest, setLatestCoinRequest] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(
    () => window.visualViewport?.height || window.innerHeight
  );
  const [spinSnake, setSpinSnake] = useState([]); // Array of boxes in the snake
  const [spinIntensity, setSpinIntensity] = useState(0); // 0-1 for overall spin intensity
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [winCoins, setWinCoins] = useState(null); // null = no win, number = coins won this round
  const [betPhaseMsg, setBetPhaseMsg] = useState(null); // 'start' | 'stop' | null
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true); // Fullscreen prompt on first load
  // Game-stopped and ban state
  const [gameStopped, setGameStopped] = useState(false);
  const [userBanned, setUserBanned] = useState(user?.isBanned || false);
  const [userBanReason, setUserBanReason] = useState(user?.banReason || '');
  const gameStoppedRef = useRef(false); // used inside spin closures (avoids stale state)

  const previousBetsRef = useRef({});
  const betsRef = useRef({}); // mirrors bets state for safe use inside spin closures
  const coinsRef = useRef(user?.coins ?? 0); // always-current coins — avoids stale closure bugs
  const historyScrollRef = useRef(null);
  const spinIntervalRef = useRef(null);
  const spinTimeoutRef = useRef(null);
  const profilePicInputRef = useRef(null);
  const coinChipRefs   = useRef({});       // neon chip DOM elements: { [coinValue]: el }
  const playerRowRefs  = useRef({});       // online-panel row elements: { [userId]: el }
  const flyingCoinIdRef = useRef(0);        // monotonic ID for flying-coin instances
  const [flyingCoins, setFlyingCoins] = useState([]); // { id, fromX, fromY, toX, toY, color }

  // Sound toggle — initialize from soundManager.muted so React state stays in sync
  // with the module-level singleton even after React hot reloads
  const [isMuted, setIsMuted] = useState(() => soundManager.muted);
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (next) {
      soundManager.mute();
    } else {
      soundManager.unmute();
      // Resume bg music if it stopped while muted
      const bg = soundManager.sounds['bgMusic'];
      if (bg && !bg.playing()) bg.play();
    }
  };

  // App now supports both portrait and landscape - removed landscape-only enforcement

  useEffect(() => {
    const updateViewportHeight = () => {
      const nextHeight = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight);
      setViewportHeight(nextHeight);
      document.documentElement.style.setProperty('--app-vh', `${nextHeight}px`);
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
    };
  }, []);

  // Show history by default in portrait mode
  useEffect(() => {
    setShowHistory(true);
  }, []);

  // Responsive layout values for portrait mode
  const appVh      = `${viewportHeight}px`;
  const navH       = "clamp(50px, 9vh, 70px)";
  const footerH    = "clamp(68px, 12vh, 100px)";
  const boardOff   = "clamp(140px, 22vh, 180px)";
  const chipSize   = "clamp(36px, 5vw, 45px)";
  const chipFont   = "clamp(8px, 0.95vw, 10px)";
  const btnSz      = "clamp(32px, 4.5vw, 42px)";
  const btnFsz     = "clamp(14px, 1.9vw, 18px)";

  const requestFullscreen = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch (error) {
      toast('Use Add to Home Screen for true full-screen on this browser');
    }
  };

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab]             = useState("picture");
  const [profileUsername, setProfileUsername]   = useState("");
  const [profilePicPreview, setProfilePicPreview] = useState(null); // base64 preview
  const [currentPassword, setCurrentPassword]  = useState("");
  const [newPassword, setNewPassword]           = useState("");
  const [confirmPassword, setConfirmPassword]   = useState("");
  const [showCurrentPw, setShowCurrentPw]       = useState(false);
  const [showNewPw, setShowNewPw]               = useState(false);
  const [showConfirmPw, setShowConfirmPw]       = useState(false);
  const [profileSaving, setProfileSaving]       = useState(false);

  // Clockwise order of boxes around the rectangle border
  const clockwiseOrder = [
    // Top row (left to right) - 9 boxes
    0, 1, 2, 3, 4, 5, 6, 7, 8,
    // Right column (top to bottom) - 5 boxes
    14, 15, 16, 17, 18,
    // Bottom row (right to left) - 9 boxes
    27, 26, 25, 24, 23, 22, 21, 20, 19,
    // Left column (bottom to top) - 5 boxes
    13, 12, 11, 10, 9,
  ];

  // Map of box indices to their result types
  // Map of box indices to their result types (MUST match backend exactly)
  const boxResultMap = {
    0: "monkey",
    1: "rabbit",
    2: "rabbit",
    3: "rabbit",
    4: "golden_shark_100x",
    5: "swallow",
    6: "swallow",
    7: "swallow",
    8: "pigeon",
    14: "pigeon",
    15: "pigeon",
    16: "take_all",
    17: "peacock",
    18: "peacock",
    27: "peacock",
    26: "eagle",
    25: "eagle",
    24: "eagle",
    23: "shark_24x",
    22: "lion",
    21: "lion",
    20: "lion",
    19: "panda",
    13: "panda",
    12: "panda",
    11: "pay_all",
    10: "monkey",
    9: "monkey",
  };

  // Multipliers for each result type (MUST match backend exactly)
  const resultMultipliers = {
    monkey: 8,
    rabbit: 6,
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
  };

  // Box names for display
  const boxNames = {
    0: "Monkey",
    1: "Rabbit",
    2: "Rabbit",
    3: "Rabbit",
    4: "Golden Shark",
    5: "Swallow",
    6: "Swallow",
    7: "Swallow",
    8: "Pigeon",
    14: "Pigeon",
    15: "Pigeon",
    16: "Take All",
    17: "Peacock",
    18: "Peacock",
    27: "Peacock",
    26: "Eagle",
    25: "Eagle",
    24: "Eagle",
    23: "Shark 24x",
    22: "Lion",
    21: "Lion",
    20: "Lion",
    19: "Panda",
    13: "Panda",
    12: "Panda",
    11: "Pay All",
    10: "Monkey",
    9: "Monkey",
  };

  // Probability weights — kept in sync with backend
  // 6 regular (12% each) | lion/eagle (10% each) | shark_24x (5%) | rare events (1% each)
  const probabilityWeights = {
    rabbit:            12,
    swallow:           12,
    monkey:            12,
    panda:             12,
    pigeon:            12,
    peacock:           12,
    lion:               10,
    eagle:              10,
    shark_24x:          5,
    take_all:           1,
    pay_all:            1,
    golden_shark_100x:  1,
  };

  // Calculate total weight
  const totalWeight = Object.values(probabilityWeights).reduce(
    (a, b) => a + b,
    0,
  );

  // Get random result based on probability weights (only for manual testing)
  const getRandomResult = () => {
    const rand = Math.random() * totalWeight;
    let cumulative = 0;

    for (const [result, weight] of Object.entries(probabilityWeights)) {
      cumulative += weight;
      if (rand < cumulative) {
        return result;
      }
    }
    return "rabbit"; // fallback
  };

  // Get random box index based on result type (only for manual testing)
  const getRandomBoxForResult = (resultType) => {
    // Find all box indices that match this result type
    const matchingBoxes = Object.entries(boxResultMap)
      .filter(([_, result]) => result === resultType)
      .map(([box]) => parseInt(box));

    // Return random matching box
    return matchingBoxes[Math.floor(Math.random() * matchingBoxes.length)];
  };

  // Coin options with EXACT colors from specification
  const coinOptions = [
    { value: 10, color: "#9C27B0", label: "10", name: "Purple" },
    { value: 50, color: "#2196F3", label: "50", name: "Blue" },
    { value: 100, color: "#4CAF50", label: "100", name: "Green" },
    { value: 500, color: "#FF9800", label: "500", name: "Orange" },
    { value: 1000, color: "#F44336", label: "1000", name: "Red" },
    { value: 5000, color: "#FFD700", label: "5000", name: "Gold" },
  ];

  // Return the neon colour for a given coin denomination
  const getCoinColor = (amount) => {
    const coin = coinOptions.find(c => c.value === amount);
    return coin ? coin.color : '#9C27B0';
  };

  // Spawn a flying coin that glides from (fromX,fromY) straight to the bet-target element
  const launchCoin = (fromX, fromY, betType, color, delay = 0) => {
    const targetEl = document.querySelector(`[data-bet-type="${betType}"]`);
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const toX = rect.left + rect.width  / 2;
    const toY = rect.top  + rect.height / 2;
    const id = ++flyingCoinIdRef.current;
    const spawn = () => {
      setFlyingCoins(prev => [...prev, { id, fromX, fromY, toX, toY, color }]);
      setTimeout(() => setFlyingCoins(prev => prev.filter(c => c.id !== id)), 1050);
    };
    if (delay > 0) setTimeout(spawn, delay);
    else spawn();
  };

  // Update total bet
  useEffect(() => {
    const total = Object.values(bets).reduce((sum, val) => sum + val, 0);
    setTotalBet(total);
  }, [bets]);

  // Keep coinsRef in sync whenever user.coins updates (page load, profile fetch, etc.)
  useEffect(() => {
    if (user?.coins !== undefined) {
      coinsRef.current = user.coins;
    }
  }, [user?.coins]);

  // Force landscape orientation on mount — unlocks when leaving the game page
  useEffect(() => {
    const tryLock = async () => {
      try {
        // Works on Android Chrome / Firefox; silently fails on iOS (CSS overlay handles that)
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (e) {
        // Orientation lock not supported or not in fullscreen — ignore
      }
    };
    tryLock();
    return () => {
      try {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      } catch (e) {}
    };
  }, []);

  // Initialize sound system on mount and start background music
  useEffect(() => {
    soundManager.init();

    const startBgMusic = () => {
      const bg = soundManager.sounds['bgMusic'];
      if (bg && !bg.playing() && !soundManager.muted) {
        bg.play();
      }
    };

    // Try immediately after a short delay (works when autoplay is permitted)
    const bgTimer = setTimeout(startBgMusic, 800);

    // Fallback: start music on first user interaction (required by Chrome/Safari
    // autoplay policy — without a prior gesture the play() call is silently ignored)
    const onFirstInteraction = () => {
      startBgMusic();
      document.removeEventListener('click',      onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
    };
    document.addEventListener('click',      onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);

    return () => {
      clearTimeout(bgTimer);
      document.removeEventListener('click',      onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
      soundManager.stop('bgMusic');
    };
  }, []);

  // Fetch latest coin request status on mount and after submitting
  const fetchCoinRequestStatus = () => {
    if (!token) return;
    axios.get('/api/users/coin-request/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { if (data.success) setLatestCoinRequest(data.request); })
      .catch(() => {});
  };
  useEffect(() => { fetchCoinRequestStatus(); }, [token]);

  // Handle submit coin request
  const handleCoinRequest = async () => {
    const amount = parseInt(coinRequestAmount);
    if (!amount || amount < 10 || amount > 1000) {
      toast.error('Amount must be between 10 and 1000 coins');
      return;
    }
    setCoinRequestLoading(true);
    try {
      await axios.post('/api/users/coin-request', { amount }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Request sent to admin!');
      setShowCoinRequest(false);
      fetchCoinRequestStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setCoinRequestLoading(false);
    }
  };

  // Load last 25 spin results from DB on mount — store oldest-first so newest renders at bottom
  useEffect(() => {
    if (!token) return;
    axios
      .get('/api/game/results', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        if (data.success && data.results && data.results.length > 0) {
          // DB returns newest-first; reverse so index 0 = oldest, last = newest
          const normalized = [...data.results].reverse().map((r) => ({
            ...r,
            display: r.resultDisplay || r.result?.replace(/_/g, ' ').toUpperCase() || '',
            multiplier: r.winningMultiplier ?? 0,
          }));
          setHistoryResults(normalized);
        }
      })
      .catch((err) => console.warn('Failed to load history from DB:', err));
  }, [token]);

  // Auto-scroll history column to show latest result
  useEffect(() => {
    if (historyScrollRef.current && historyResults.length > 0) {
      // Scroll to bottom to show latest result
      setTimeout(() => {
        if (historyScrollRef.current) {
          historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [historyResults]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on("game-state", (state) => {
      setGameStatus(state.status);
      setTimeLeft(state.timeLeft);
      if (state.gameStopped !== undefined) {
        setGameStopped(state.gameStopped);
        gameStoppedRef.current = state.gameStopped;
      }
    });

    socket.on("betting-started", () => {
      setGameStatus("betting");
      soundManager.play('result');
      setBetPhaseMsg('start');
      setTimeout(() => setBetPhaseMsg(null), 2000);
    });

    socket.on("countdown", (seconds) => {
      setCountdown(seconds);
      // Play countdown sound only ONCE when it starts at 3 — let it run its 3s naturally
      if (seconds === 3) {
        soundManager.play('countdown');
      }
    });

    socket.on("betting-stopped", () => {
      setCountdown(null);           // Clear the countdown number immediately
      soundManager.stop('countdown'); // Stop the sound precisely when betting closes
      soundManager.play('result');
      setBetPhaseMsg('stop');
      setTimeout(() => setBetPhaseMsg(null), 2000);
      setGameStatus("spinning");
    });

    socket.on("spin-start", (data) => {
      setCurrentResult(null);
      // Use the exact box index from backend
      startSpinAnimation(data.boxIndex);
    });

    socket.on("round-result", (data) => {

      // Normalise: round-result uses {display, multiplier};
      // ensure we always have both field aliases so overlay + header work
      const normalised = {
        roundId:    data.roundId,
        result:     data.result,
        display:    data.display     || data.resultDisplay || "",
        multiplier: data.multiplier  ?? data.winningMultiplier ?? 0,
        boxIndex:   data.boxIndex,
      };

      setCurrentResult(normalised);
      setGameStatus("result");

      // Don't update history here - let history-update event handle it
      // This prevents race conditions and ensures instant updates

      // Show the cinematic result overlay for exactly 3 seconds
      setShowResultOverlay(true);
      setTimeout(() => setShowResultOverlay(false), 3000);
    });

    socket.on("win-notification", (data) => {
      updateUserCoins(data.newBalance);
      // win sound is already played by finishSpin — no duplicate here
    });

    socket.on("history-results", (results) => {
      const normalised = results.map((r) => ({
        ...r,
        display:    r.display    || r.resultDisplay || r.result?.replace(/_/g, " ").toUpperCase() || "",
        multiplier: r.multiplier ?? r.winningMultiplier ?? 0,
      }));
      setHistoryResults(normalised);
    });

    // Real-time broadcast after every spin — all users see the same column
    socket.on("history-update", (results) => {
      console.log(`📜 History updated: ${results.length} results`);
      const normalised = results.map((r) => ({
        roundId: r._id || r.id,
        result: r.result,
        resultDisplay: r.resultDisplay || r.result?.replace(/_/g, " ").toUpperCase() || "",
        display:    r.resultDisplay || r.result?.replace(/_/g, " ").toUpperCase() || "",
        multiplier: r.winningMultiplier ?? 0,
        winningMultiplier: r.winningMultiplier ?? 0,
      }));
      setHistoryResults(normalised);
    });

    // Server confirms correct coin balance after persisting to DB
    socket.on("coins-updated", ({ coins }) => {
      updateUserCoins(coins);
      coinsRef.current = coins;
    });

    socket.on("online-players", (data) => {
      // server sends { count, players: [...] }
      const list = Array.isArray(data) ? data : (Array.isArray(data?.players) ? data.players : []);
      // Filter out admin accounts — they should not appear in the player list
      const nonAdmins = list.filter(p => !p.isAdmin);
      console.log(`👥 Online players updated: ${nonAdmins.length} players`);
      setOnlinePlayers(nonAdmins);
    });

    // Game control events
    socket.on('game-stopped', () => {
      setGameStopped(true);
      gameStoppedRef.current = true;
    });
    socket.on('game-resumed', () => {
      setGameStopped(false);
      gameStoppedRef.current = false;
    });
    // Ban event — show ban overlay immediately
    socket.on('user-banned', (data) => {
      setUserBanned(true);
      setUserBanReason(data?.reason || 'Account banned by administrator');
    });

    // Other players' bet animations — coin flies from their row in the online panel
    socket.on("bet-animation", ({ userId, betType, amount }) => {      const myId = (user?._id || user?.id)?.toString();
      if (userId?.toString() === myId) return; // skip own — already animated locally
      const coinColor = getCoinColor(amount);
      const playerRowEl = playerRowRefs.current[userId?.toString()];
      if (playerRowEl) {
        const r = playerRowEl.getBoundingClientRect();
        launchCoin(r.left + r.width / 2, r.top + r.height / 2, betType, coinColor);
      } else {
        // Fallback: fly from the online-panel corner (top-right)
        launchCoin(window.innerWidth - 45, 80, betType, coinColor);
      }
    });

    return () => {
      socket.off("game-state");
      socket.off("betting-started");
      socket.off("countdown");
      socket.off("betting-stopped");
      socket.off("spin-start");
      socket.off("round-result");
      socket.off("history-results");
      socket.off("history-update");
      socket.off("coins-updated");
      socket.off("online-players");
      socket.off("bet-animation");
      socket.off('game-stopped');
      socket.off('game-resumed');
      socket.off('user-banned');
    };
  }, [socket, updateUserCoins]);

  // Cleanup intervals and timeouts on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
      }
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }
    };
  }, []);

  // Handle bet placement — coins deducted immediately, no reversal possible
  const handleBet = (betType) => {
    if (gameStatus !== "betting") {
      toast.error("Betting is closed");
      return;
    }
    if (!user || coinsRef.current < selectedCoin) {
      toast.error("Insufficient coins");
      return;
    }

    // Play bet sound using sound manager
    soundManager.play('bet');

    // Fly a neon coin chip from the selector to the target bet card
    const chipEl = coinChipRefs.current[selectedCoin];
    if (chipEl) {
      const r = chipEl.getBoundingClientRect();
      launchCoin(r.left + r.width / 2, r.top + r.height / 2, betType, getCoinColor(selectedCoin));
    }

    // Deduct coins on the spot
    const afterDeduct = coinsRef.current - selectedCoin;
    updateUserCoins(afterDeduct);
    coinsRef.current = afterDeduct; // keep ref in sync immediately

    const newBets = {
      ...bets,
      [betType]: (bets[betType] || 0) + selectedCoin,
    };
    setBets(newBets);
    betsRef.current = newBets; // keep ref in sync for spin closure

    // Emit to server for future 24/7 mode
    if (socket) {
      socket.emit("place-bet", { betType, amount: selectedCoin, token });
    }
  };

  // Professional snake spin animation - 8 seconds total (3s + 3s + 2s)
  const startSpinAnimation = (finalBox) => {
    // Clear any existing intervals/timeouts
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
    }
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current);
    }
    setGameStatus("spinning");
    setSpinIntensity(1);

    // Start spin sound — will be stopped exactly when animation ends in finishSpin
    soundManager.play('spin');

    // Use the exact box from backend
    const finalPosition = clockwiseOrder.indexOf(finalBox);

    if (finalPosition === -1) {
      console.error("❌ Invalid box index from backend:", finalBox);
      console.error("Available boxes in clockwiseOrder:", clockwiseOrder);
      return;
    }

    // Calculate total steps - must complete at least 3 full rotations before landing
    const minRotations = 3;
    const targetStep = clockwiseOrder.length * minRotations + finalPosition;

    // Animation phases with exact timing
    const PHASE_1_DURATION = 2000; // 2 seconds - fast
    const PHASE_2_DURATION = 2000; // 2 seconds - medium
    const PHASE_3_DURATION = 1500; // 1.5 seconds - slow
    const TOTAL_DURATION = 5500; // 5.5 seconds total (+ 3s result hold = ~8.5s shown)

    // Steps per phase (distributed to reach target)
    const phase1Steps = Math.floor(clockwiseOrder.length * 2); // 2 full rotations
    const phase2Steps = Math.floor(clockwiseOrder.length * 0.8); // 0.8 rotation
    const phase3Steps = targetStep - phase1Steps - phase2Steps; // Remaining to target

    // Intervals per step for each phase
    const phase1Interval = PHASE_1_DURATION / phase1Steps; // ~27ms per step
    const phase2Interval = PHASE_2_DURATION / phase2Steps; // ~66ms per step

    let currentStep = 0;
    const maxSnakeLength = 8;

    // Helper to update snake trail
    const updateSnake = (step, snakeLength) => {
      const snake = [];
      for (let i = 0; i < snakeLength; i++) {
        const trailStep = step - i;
        if (trailStep >= 0) {
          const trailBox = clockwiseOrder[trailStep % clockwiseOrder.length];
          snake.push(trailBox);
        }
      }
      setSpinSnake(snake);
    };

    // Phase 1: Fast spin (3 seconds)
    const phase1 = () => {
      const endStep = phase1Steps;

      const animate = () => {
        if (currentStep < endStep) {
          updateSnake(currentStep, maxSnakeLength);
          setSpinIntensity(1);
          currentStep++;
          spinTimeoutRef.current = setTimeout(animate, phase1Interval);
        } else {
          phase2(); // Move to phase 2
        }
      };

      animate();
    };

    // Phase 2: Medium spin (3 seconds)
    const phase2 = () => {
      const startStep = currentStep;
      const endStep = phase1Steps + phase2Steps;

      const animate = () => {
        if (currentStep < endStep) {
          const progress = (currentStep - startStep) / phase2Steps;
          const snakeLength = Math.max(
            4,
            Math.floor(maxSnakeLength * (1 - progress * 0.3)),
          );
          updateSnake(currentStep, snakeLength);
          setSpinIntensity(1 - progress * 0.2);
          currentStep++;
          spinTimeoutRef.current = setTimeout(animate, phase2Interval);
        } else {
          phase3(); // Move to phase 3
        }
      };

      animate();
    };

    // Phase 3: Slow spin with deceleration (2 seconds)
    const phase3 = () => {
      const startStep = currentStep;
      const endStep = targetStep;
      const steps = phase3Steps;

      if (steps <= 0) {
        finishSpin(finalBox);
        return;
      }

      const animate = () => {
        if (currentStep < endStep) {
          const progress = (currentStep - startStep) / steps;
          // Exponential slowdown
          const snakeLength = Math.max(1, Math.floor(4 * (1 - progress)));
          updateSnake(currentStep, snakeLength);
          setSpinIntensity(0.8 - progress * 0.5);
          currentStep++;

          // Progressive delay (gets slower near the end)
          const delay = (PHASE_3_DURATION / steps) * (1 + progress * 3);
          spinTimeoutRef.current = setTimeout(animate, delay);
        } else {
          // Ensure we land exactly on the target box
          finishSpin(finalBox);
        }
      };

      animate();
    };

    // Start the animation
    phase1();
  };

  // Helper function to finish the spin — fully self-contained (no backend needed)
  const finishSpin = (finalBox) => {
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    if (spinTimeoutRef.current)  clearTimeout(spinTimeoutRef.current);

    // Stop spin sound exactly when animation ends
    soundManager.stop('spin');

    const boxType    = boxResultMap[finalBox];
    const multiplier = resultMultipliers[boxType] ?? 0;
    const display    = resultDisplayNames[boxType]
      || boxType?.replace(/_/g, " ").toUpperCase()
      || "UNKNOWN";



    // --- Calculate winnings from bets placed this round ---
    const currentBets = betsRef.current;
    const beasts = ["monkey", "rabbit", "lion", "panda"];
    const birds   = ["swallow", "pigeon", "peacock", "eagle"];
    let winAmount = 0;

    if (boxType === "take_all") {
      winAmount = 0; // house wins, bets already deducted
    } else if (boxType === "pay_all") {
      winAmount = Object.values(currentBets).reduce((s, v) => s + v, 0); // return all bets
    } else if (boxType === "shark_24x") {
      winAmount = (currentBets["shark24x"] || 0) * 24;
    } else if (boxType === "golden_shark_100x") {
      winAmount = (currentBets["goldenShark"] || 0) * 100;
    } else if (beasts.includes(boxType)) {
      winAmount += (currentBets[boxType] || 0) * multiplier;
      winAmount += (currentBets["beast2x"] || 0) * 2;
    } else if (birds.includes(boxType)) {
      winAmount += (currentBets[boxType] || 0) * multiplier;
      winAmount += (currentBets["bird2x"] || 0) * 2;
    }

    // Award winnings optimistically in UI using coinsRef (avoids stale closure)
    const coinsBeforeWin = coinsRef.current;
    const expectedBalance = winAmount > 0 ? coinsBeforeWin + winAmount : coinsBeforeWin;
    if (winAmount > 0) {
      updateUserCoins(expectedBalance);
      coinsRef.current = expectedBalance;
    }

    const result = {
      roundId:    Date.now(),
      result:     boxType,
      display,
      multiplier,
      boxIndex:   finalBox,
    };

    // Optimistic update — append to END so newest is always at bottom of column
    setHistoryResults((prev) => [...prev, result].slice(-25));

    // Single socket emit — server handles DB save, coin update, and broadcasts
    // history-update back to ALL clients; coins-updated corrects this client's balance
    if (socket) {
      socket.emit('client-spin-result', {
        result: boxType,
        resultDisplay: display,
        winningMultiplier: multiplier,
        winAmount,
        finalCoins: expectedBalance, // post-deductions + win; server writes this to DB
      });
    }

    setSpinSnake([finalBox]);
    setSpinIntensity(1);
    setGameStatus("result");
    setCurrentResult(result);
    setWinCoins(winAmount > 0 ? winAmount : null);
    setShowResultOverlay(true);
    
    // Play result sound, then win sting 500ms later on a win
    soundManager.play('result');
    if (winAmount > 0) {
      setTimeout(() => soundManager.play('win'), 500);
    }

    // After 3 s: hide overlay, clear bets, ready for next spin (unless game stopped)
    spinTimeoutRef.current = setTimeout(() => {
      setShowResultOverlay(false);
      setWinCoins(null);
      setSpinSnake([]);
      setSpinIntensity(0);
      if (!gameStoppedRef.current) {
        setGameStatus("betting");
      } else {
        setGameStatus("stopped");
      }
      setBets({});
      betsRef.current = {};
    }, 3000);
  };

  // ── Profile modal helpers ────────────────────────────────────────
  const openProfileModal = () => {
    setProfileUsername(user?.username || "");
    setProfilePicPreview(user?.profilePicture || null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setProfileTab("picture");
    setShowProfileModal(true);
  };

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setProfilePicPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSavePicture = async () => {
    setProfileSaving(true);
    try {
      const { data } = await axios.patch(
        "/api/users/profile",
        { profilePicture: profilePicPreview },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateUser({ profilePicture: data.user.profilePicture });
      toast.success("Profile picture updated!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update picture");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRemovePicture = async () => {
    setProfileSaving(true);
    try {
      const { data } = await axios.patch(
        "/api/users/profile",
        { profilePicture: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateUser({ profilePicture: null });
      setProfilePicPreview(null);
      toast.success("Profile picture removed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove picture");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!profileUsername.trim()) { toast.error("Username cannot be empty"); return; }
    setProfileSaving(true);
    try {
      const { data } = await axios.patch(
        "/api/users/profile",
        { username: profileUsername.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateUser({ username: data.user.username });
      toast.success("Username updated!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update username");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) { toast.error("Fill all password fields"); return; }
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match"); return; }
    if (newPassword.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    setProfileSaving(true);
    try {
      await axios.patch(
        "/api/users/password",
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Password changed successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  // ────────────────────────────────────────────────────────────────

  // Manual spin trigger
  const handleManualSpin = () => {
    if (gameStatus !== "betting") return; // block during spinning or result
    const testResult = getRandomResult();
    const testBox    = getRandomBoxForResult(testResult);
    startSpinAnimation(testBox);
  };

  // Helper function to check if a box is in the spin snake and get its intensity
  const getBoxSpinState = (boxIndex) => {
    const snakeIndex = spinSnake.indexOf(boxIndex);

    if (snakeIndex === -1) {
      return { isSpinning: false, intensity: 0 };
    }

    // Calculate intensity based on position in snake (head is brightest)
    // Head is at index 0, tail at the end
    const position = snakeIndex;
    const snakeLength = spinSnake.length;

    // Head gets full intensity, tail gets dimmer
    const positionIntensity = 1 - (position / snakeLength) * 0.7;

    // Multiply by global spin intensity
    const finalIntensity = positionIntensity * spinIntensity;

    return {
      isSpinning: true,
      intensity: finalIntensity,
      isHead: position === 0,
      isTail: position === snakeLength - 1,
    };
  };

  // Helper function to get emoji from result
  const getResultEmoji = (resultName) => {
    const emojiMap = {
      // Backend naming (with underscores)
      lion: "🦁",
      eagle: "🦅",
      shark_24x: "🦈",
      golden_shark_100x: "✨",
      take_all: "💣",
      pay_all: "💰",
      monkey: "🐵",
      rabbit: "🐰",
      panda: "🐼",
      swallow: "🐦",
      pigeon: "🕊️",
      peacock: "🦚",
      // Legacy frontend naming (camelCase) for compatibility
      shark24x: "🦈",
      goldenShark: "✨",
      takeAll: "💣",
      payAll: "💰",
    };
    return emojiMap[resultName] || "❓";
  };

  // Bet Box Component with snake spin effects
  const BetBox = ({
    animal,
    multiplier,
    betType,
    count,
    isSpecial,
    isGolden,
    gridArea,
    boxIndex,
  }) => {
    const { isSpinning, intensity, isHead, isTail } = getBoxSpinState(boxIndex);

    let bgColor = "#1a4d2e";
    let borderColor = "#ffd700";

    if (isGolden) {
      bgColor = "linear-gradient(135deg, #ffd700 0%, #ffa500 100%)";
      borderColor = "#fff";
    } else if (isSpecial === "take") {
      bgColor = "#8b0000";
    } else if (isSpecial === "pay") {
      bgColor = "#006400";
    } else if (isSpecial === "shark24") {
      bgColor = "#333333";
    }

    // Snake spin effect
    if (isSpinning) {
      // Head gets brighter and larger
      const headScale = isHead ? 1.08 : 1.02;
      const headGlow = isHead ? 1.2 : 0.8;

      // Calculate opacity and glow based on intensity
      const opacity = 0.5 + intensity * 0.5;
      const glowSize = 20 + intensity * 40 * (isHead ? 1.5 : 1);

      return (
        <div
          style={{
            gridArea,
            background: `linear-gradient(135deg, 
              rgba(255, 215, 0, ${opacity}) 0%, 
              rgba(255, 165, 0, ${opacity}) 100%)`,
            border: `clamp(2px, 0.3vw, 4px) solid #fff`,
            cursor: "default",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(8px, 1.2vw, 16px)",
            transition: "all 0.05s linear",
            minHeight: "100%",
            minWidth: "100%",
            borderRadius: "0px",
            boxShadow: `0 0 ${glowSize}px rgba(255, 215, 0, ${0.6 + intensity * 0.4}), 
                       inset 0 0 ${glowSize / 2}px rgba(255, 215, 0, ${0.4 + intensity * 0.4})`,
            transform: `scale(${headScale})`,
            zIndex: isHead ? 10 : 5,
            filter: `brightness(${1 + intensity * 0.3 * headGlow})`,
            animation: isHead
              ? "headPulse 0.2s ease-in-out infinite"
              : "snakePulse 0.3s ease-in-out infinite",
          }}
        >
          <div
            style={{
              fontSize: count
                ? "clamp(24px, 3.5vw, 40px)"
                : "clamp(28px, 4.5vw, 48px)",
              marginBottom: "1px",
              lineHeight: 1,
            }}
          >
            {animal}
          </div>
          {count && (
            <div
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                fontSize: "10px",
                color: "#888",
              }}
            >
              #{count}
            </div>
          )}
        </div>
      );
    }

    // Non-spinning version
    return (
      <div
        style={{
          gridArea,
          background: bgColor,
          border: `clamp(1px, 0.2vw, 2px) solid ${borderColor}`,
          cursor: "default",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(8px, 1.2vw, 16px)",
          transition: "all 0.2s",
          minHeight: "100%",
          minWidth: "100%",
          borderRadius: "0px",
        }}
      >
        <div
          style={{
            fontSize: count
              ? "clamp(24px, 3.5vw, 40px)"
              : "clamp(28px, 4.5vw, 48px)",
            marginBottom: "1px",
            lineHeight: 1,
          }}
        >
          {animal}
        </div>
        {count && (
          <div
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              fontSize: "10px",
              color: "#888",
            }}
          >
            #{count}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #ffd700;
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #ffed4e;
          }
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #ffd700 rgba(0, 0, 0, 0.3);
          }
          
          @keyframes headPulse {
            0%, 100% {
              transform: scale(1.08);
              filter: brightness(1.4);
            }
            50% {
              transform: scale(1.12);
              filter: brightness(1.8);
            }
          }
          
          @keyframes snakePulse {
            0%, 100% {
              transform: scale(1.02);
              filter: brightness(1.1);
            }
            50% {
              transform: scale(1.04);
              filter: brightness(1.3);
            }
          }
          
          @keyframes singleBoxPulse {
            0%, 100% {
              transform: scale(1);
              filter: brightness(1.2);
              box-shadow: 0 0 60px rgba(255, 215, 0, 0.9);
            }
            50% {
              transform: scale(1.08);
              filter: brightness(1.6);
              box-shadow: 0 0 100px rgba(255, 215, 0, 1), 0 0 150px rgba(255, 165, 0, 0.8);
            }
          }

          @keyframes gemShimmer {
            0%   { filter: brightness(1)    saturate(1); }
            45%  { filter: brightness(1.28) saturate(1.35); }
            100% { filter: brightness(1)    saturate(1); }
          }
          @keyframes gemRingPulse {
            0%, 100% { box-shadow: var(--gem-shadow-base), 0 0 0 2.5px rgba(255,255,255,0.9); }
            50%      { box-shadow: var(--gem-shadow-base), 0 0 0 3px   rgba(255,255,255,1),
                         0 0 22px var(--gem-color), 0 0 44px var(--gem-color-half); }
          }

          /* ── Mobile landscape tweaks ── */
          @media (orientation: landscape) and (max-height: 500px) {
            .coin-req-label { display: none !important; }
            .game-online-panel { top: 40px !important; max-height: calc(${appVh} - 52px) !important; }
          }
        `}
      </style>

      {/* Mobile Portrait Warning - REMOVED FOR PORTRAIT SUPPORT */}
      {/* Game now supports both portrait and landscape modes */}

      {/* Fullscreen Prompt Modal */}
      <AnimatePresence>
        {showFullscreenPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.85)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999,
              padding: "20px",
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                background: "linear-gradient(135deg, #0a2f1f 0%, #1a4d2e 100%)",
                border: "3px solid #ffd700",
                borderRadius: "20px",
                padding: "40px 32px",
                textAlign: "center",
                maxWidth: "420px",
                width: "100%",
                boxShadow: "0 0 60px rgba(255, 215, 0, 0.3), 0 0 20px rgba(255, 165, 0, 0.2)",
              }}
            >
              <div style={{ fontSize: "64px", marginBottom: "18px" }}>📺</div>
              <h2 style={{ fontSize: "24px", fontWeight: "900", color: "#ffd700", marginBottom: "14px", margin: "0 0 14px 0" }}>
                Best Experience
              </h2>
              <p style={{ fontSize: "15px", color: "#fff", lineHeight: 1.6, marginBottom: "24px", margin: "0 0 24px 0" }}>
                Portrait mode optimized! You can enjoy the game in portrait or landscape. Click Fullscreen for immersive experience!
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button
                  onClick={async () => {
                    try {
                      await requestFullscreen();
                      setShowFullscreenPrompt(false);
                    } catch (e) {
                      setShowFullscreenPrompt(false);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: "48px",
                    background: "linear-gradient(135deg, #ffd700 0%, #ff9500 100%)",
                    border: "none",
                    borderRadius: "12px",
                    color: "#1a0a00",
                    fontSize: "16px",
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 15px rgba(255, 215, 0, 0.4)",
                    transition: "all 0.2s",
                    letterSpacing: "0.5px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 215, 0, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "0 4px 15px rgba(255, 215, 0, 0.4)";
                  }}
                >
                  <FaExpand /> Try Full Screen
                </button>
                <button
                  onClick={() => setShowFullscreenPrompt(false)}
                  style={{
                    width: "100%",
                    height: "44px",
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "2px solid rgba(255, 215, 0, 0.4)",
                    borderRadius: "12px",
                    color: "#ffd700",
                    fontSize: "15px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                    e.currentTarget.style.borderColor = "rgba(255, 215, 0, 0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                    e.currentTarget.style.borderColor = "rgba(255, 215, 0, 0.4)";
                  }}
                >
                  Close & Play
                </button>
              </div>
              <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)", marginTop: "16px", margin: "16px 0 0 0" }}>
                You can always access fullscreen from the header button
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Container - Now supports portrait and landscape */}
      <div
        className="w-full overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(135deg, #0a2f1f 0%, #1a4d2e 100%)",
          color: "#ffffff",
          height: appVh,
        }}
      >

        {/* ── PROFILE MODAL ───────────────────────────────────────── */}
        {/* Hidden file input for profile picture */}
        <input
          ref={profilePicInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleProfilePicChange}
        />
        <AnimatePresence>
          {showProfileModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed", inset: 0, zIndex: 200,
                background: "rgba(0,0,0,0.75)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowProfileModal(false); }}
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                style={{
                  background: "linear-gradient(135deg, #0a2f1f, #1a4d2e)",
                  border: "2px solid #ffd700",
                  borderRadius: "16px",
                  width: "min(460px, 94vw)",
                  padding: "24px",
                  boxShadow: "0 0 40px rgba(255,215,0,0.3)",
                  color: "#fff",
                  position: "relative",
                }}
              >
                {/* Close */}
                <button
                  onClick={() => setShowProfileModal(false)}
                  style={{
                    position: "absolute", top: "14px", right: "14px",
                    background: "none", border: "none", color: "#ffd700",
                    fontSize: "20px", cursor: "pointer",
                  }}
                ><FaTimes /></button>

                {/* Title */}
                <h2 style={{ margin: "0 0 18px", color: "#ffd700", fontSize: "18px", fontWeight: "bold" }}>
                  My Profile
                </h2>

                {/* Tabs */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                  {[
                    { key: "picture",  icon: <FaCamera />,  label: "Picture"  },
                    { key: "details",  icon: <FaEdit />,    label: "Details"  },
                    { key: "password", icon: <FaKey />,     label: "Password" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setProfileTab(t.key)}
                      style={{
                        flex: 1, padding: "8px 4px",
                        borderRadius: "8px", cursor: "pointer",
                        border: profileTab === t.key ? "2px solid #ffd700" : "2px solid #2a5c3e",
                        background: profileTab === t.key ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
                        color: profileTab === t.key ? "#ffd700" : "#aaa",
                        fontWeight: "bold", fontSize: "12px",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                      }}
                    >{t.icon} {t.label}</button>
                  ))}
                </div>

                {/* ── Tab: Picture ── */}
                {profileTab === "picture" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                    {/* Avatar preview */}
                    <div
                      style={{
                        width: "100px", height: "100px", borderRadius: "50%",
                        border: "3px solid #ffd700", overflow: "hidden",
                        background: "linear-gradient(135deg,#2196F3,#9C27B0)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", position: "relative",
                      }}
                      onClick={() => profilePicInputRef.current?.click()}
                      title="Click to change photo"
                    >
                      {profilePicPreview
                        ? <img src={profilePicPreview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: "40px", fontWeight: "bold" }}>{user?.username?.charAt(0).toUpperCase()}</span>
                      }
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "rgba(0,0,0,0.5)", textAlign: "center",
                        fontSize: "11px", padding: "3px", color: "#ffd700",
                      }}>CHANGE</div>
                    </div>
                    <p style={{ color: "#aaa", fontSize: "12px", textAlign: "center", margin: 0 }}>
                      Click the avatar to upload · Max 2 MB
                    </p>
                    <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                      <button
                        onClick={() => profilePicInputRef.current?.click()}
                        disabled={profileSaving}
                        style={{
                          flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer",
                          background: "rgba(255,215,0,0.15)", border: "2px solid #ffd700",
                          color: "#ffd700", fontWeight: "bold", fontSize: "13px",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                        }}
                      ><FaCamera /> Upload Photo</button>
                      {profilePicPreview && (
                        <button
                          onClick={handleRemovePicture}
                          disabled={profileSaving}
                          style={{
                            flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer",
                            background: "rgba(244,67,54,0.15)", border: "2px solid #f44336",
                            color: "#f44336", fontWeight: "bold", fontSize: "13px",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          }}
                        ><FaTrash /> Remove</button>
                      )}
                    </div>
                    {profilePicPreview !== (user?.profilePicture || null) && (
                      <button
                        onClick={handleSavePicture}
                        disabled={profileSaving}
                        style={{
                          width: "100%", padding: "11px", borderRadius: "8px", cursor: "pointer",
                          background: "linear-gradient(135deg,#4CAF50,#2e7d32)", border: "none",
                          color: "#fff", fontWeight: "bold", fontSize: "14px",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          opacity: profileSaving ? 0.6 : 1,
                        }}
                      ><FaCheck /> {profileSaving ? "Saving…" : "Save Picture"}</button>
                    )}
                  </div>
                )}

                {/* ── Tab: Details ── */}
                {profileTab === "details" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "12px", color: "#ffd700", display: "block", marginBottom: "5px" }}>Email (read-only)</label>
                      <input
                        value={user?.email || ""}
                        readOnly
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: "8px",
                          background: "rgba(255,255,255,0.05)", border: "1px solid #2a5c3e",
                          color: "#888", fontSize: "14px", boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", color: "#ffd700", display: "block", marginBottom: "5px" }}>Username</label>
                      <input
                        value={profileUsername}
                        onChange={(e) => setProfileUsername(e.target.value)}
                        placeholder="New username"
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: "8px",
                          background: "rgba(255,255,255,0.08)", border: "2px solid #2a5c3e",
                          color: "#fff", fontSize: "14px", boxSizing: "border-box", outline: "none",
                        }}
                      />
                    </div>
                    <button
                      onClick={handleSaveDetails}
                      disabled={profileSaving || profileUsername.trim() === user?.username}
                      style={{
                        padding: "11px", borderRadius: "8px", cursor: "pointer",
                        background: "linear-gradient(135deg,#4CAF50,#2e7d32)", border: "none",
                        color: "#fff", fontWeight: "bold", fontSize: "14px",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                        opacity: (profileSaving || profileUsername.trim() === user?.username) ? 0.5 : 1,
                      }}
                    ><FaCheck /> {profileSaving ? "Saving…" : "Save Username"}</button>
                  </div>
                )}

                {/* ── Tab: Password ── */}
                {profileTab === "password" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {[
                      { label: "Current Password",   val: currentPassword,  set: setCurrentPassword,  show: showCurrentPw, toggle: () => setShowCurrentPw(p => !p) },
                      { label: "New Password",        val: newPassword,      set: setNewPassword,      show: showNewPw,     toggle: () => setShowNewPw(p => !p) },
                      { label: "Confirm New Password",val: confirmPassword,  set: setConfirmPassword,  show: showConfirmPw, toggle: () => setShowConfirmPw(p => !p) },
                    ].map((f) => (
                      <div key={f.label}>
                        <label style={{ fontSize: "12px", color: "#ffd700", display: "block", marginBottom: "5px" }}>{f.label}</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type={f.show ? "text" : "password"}
                            value={f.val}
                            onChange={(e) => f.set(e.target.value)}
                            placeholder="••••••••"
                            style={{
                              width: "100%", padding: "10px 40px 10px 12px", borderRadius: "8px",
                              background: "rgba(255,255,255,0.08)", border: "2px solid #2a5c3e",
                              color: "#fff", fontSize: "14px", boxSizing: "border-box", outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            onClick={f.toggle}
                            style={{
                              position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                              background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "16px",
                            }}
                          >{f.show ? <FaEyeSlash /> : <FaEye />}</button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={handleChangePassword}
                      disabled={profileSaving}
                      style={{
                        padding: "11px", borderRadius: "8px", cursor: "pointer",
                        background: "linear-gradient(135deg,#4CAF50,#2e7d32)", border: "none",
                        color: "#fff", fontWeight: "bold", fontSize: "14px",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                        opacity: profileSaving ? 0.5 : 1,
                      }}
                    ><FaKey /> {profileSaving ? "Saving…" : "Change Password"}</button>
                  </div>
                )}

                {/* Logout row at bottom */}
                <div style={{ marginTop: "22px", borderTop: "1px solid #2a5c3e", paddingTop: "16px" }}>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%", padding: "10px", borderRadius: "8px", cursor: "pointer",
                      background: "rgba(244,67,54,0.12)", border: "2px solid #f44336",
                      color: "#f44336", fontWeight: "bold", fontSize: "14px",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    }}
                  ><FaSignOutAlt /> Logout</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* ── END PROFILE MODAL ─────────────────────────────────────── */}
        {/* Countdown Overlay */}
        <AnimatePresence>
          {countdown && countdown <= 3 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
            >
              <div
                style={{
                  fontSize: "150px",
                  fontWeight: "bold",
                  color: "#f44336",
                  textShadow: "0 0 30px rgba(244, 67, 54, 0.8)",
                  animation: "pulse 0.5s ease-in-out",
                }}
              >
                {countdown}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Phase Message — "Start Betting" / "Stop Betting" */}
        <AnimatePresence>
          {betPhaseMsg && (
            <motion.div
              key={betPhaseMsg}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
            >
              <div
                style={{
                  padding: "18px 44px",
                  borderRadius: "16px",
                  background: betPhaseMsg === 'start'
                    ? "linear-gradient(135deg, rgba(0,200,80,0.92), rgba(0,140,50,0.92))"
                    : "linear-gradient(135deg, rgba(220,40,40,0.92), rgba(160,20,20,0.92))",
                  boxShadow: betPhaseMsg === 'start'
                    ? "0 0 40px rgba(0,255,100,0.5), 0 4px 20px rgba(0,0,0,0.5)"
                    : "0 0 40px rgba(255,60,60,0.5), 0 4px 20px rgba(0,0,0,0.5)",
                  border: `2px solid ${ betPhaseMsg === 'start' ? 'rgba(100,255,150,0.6)' : 'rgba(255,120,120,0.6)'}`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "clamp(22px, 4vw, 36px)",
                    fontWeight: 900,
                    color: "#fff",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    textShadow: betPhaseMsg === 'start'
                      ? "0 0 20px rgba(100,255,150,0.9)"
                      : "0 0 20px rgba(255,100,100,0.9)",
                  }}
                >
                  {betPhaseMsg === 'start' ? '🎲 Start Betting!' : '🛑 Stop Betting!'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Win Overlay — cinematic animal reveal, transparent so game shows behind */}
        <AnimatePresence>
          {showResultOverlay && currentResult && (
            <motion.div
              key={currentResult.roundId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 z-30 flex items-center justify-center"
              style={{ pointerEvents: "none" }}
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Outer golden light burst — full screen glow */}
                <div style={{
                  position: "absolute",
                  width: "520px",
                  height: "520px",
                  background: "radial-gradient(circle, rgba(255,230,0,0.55) 0%, rgba(255,165,0,0.25) 35%, transparent 70%)",
                  borderRadius: "50%",
                  filter: "blur(18px)",
                  animation: "resultGlow 1.5s ease-in-out infinite alternate",
                  zIndex: 0,
                }} />

                {/* Spinning rays SVG behind the image */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  style={{
                    position: "absolute",
                    width: "440px",
                    height: "440px",
                    zIndex: 1,
                    opacity: 0.5,
                  }}
                >
                  <svg viewBox="0 0 440 440" width="440" height="440">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <polygon
                        key={i}
                        points="220,220 200,10 240,10"
                        fill="#ffd700"
                        opacity="0.55"
                        transform={`rotate(${i * 22.5} 220 220)`}
                      />
                    ))}
                  </svg>
                </motion.div>

                {/* Animal image */}
                <motion.img
                  key={currentResult.result + "-img"}
                  initial={{ scale: 0.5, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  src={resultImages[currentResult.result] || monkeyImg}
                  alt={currentResult.result}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    width: "clamp(160px, 22vw, 280px)",
                    height: "clamp(160px, 22vw, 280px)",
                    objectFit: "contain",
                    filter:
                      "drop-shadow(0 0 40px rgba(255,215,0,0.95)) drop-shadow(0 0 15px rgba(255,165,0,0.7))",
                    marginBottom: "0px",
                  }}
                />

                {/* Purple ribbon banner */}
                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ delay: 0.25, duration: 0.4, ease: "easeOut" }}
                  style={{
                    position: "relative",
                    zIndex: 3,
                    marginTop: "-12px",
                    background: "linear-gradient(135deg, #6a1bd1 0%, #9c3ff0 40%, #7b22c2 100%)",
                    border: "3px solid rgba(255,215,0,0.7)",
                    boxShadow:
                      "0 0 24px rgba(155,63,240,0.9), inset 0 1px 0 rgba(255,255,255,0.25)",
                    padding: "clamp(8px,1.2vh,14px) clamp(28px,5vw,64px)",
                    display: "flex",
                    alignItems: "center",
                    gap: "clamp(6px,1vw,12px)",
                    // Ribbon pennant shape via clip-path
                    clipPath: "polygon(12px 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0% 50%)",
                  }}
                >
                  <span style={{
                    fontSize: "clamp(22px, 3.5vw, 44px)",
                    fontWeight: "900",
                    color: "#ffffff",
                    letterSpacing: "1px",
                    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    textTransform: "uppercase",
                  }}>
                    {resultDisplayNames[currentResult.result] || currentResult.display}
                  </span>
                  {currentResult.multiplier > 0 && (
                    <span style={{
                      fontSize: "clamp(22px, 3.5vw, 44px)",
                      fontWeight: "900",
                      color: "#ffd700",
                      textShadow: "0 0 16px rgba(255,215,0,0.9), 0 2px 8px rgba(0,0,0,0.5)",
                    }}>
                      x{currentResult.multiplier}
                    </span>
                  )}
                  {currentResult.result === "take_all" && (
                    <span style={{ fontSize: "clamp(22px, 3.5vw, 44px)", fontWeight: "900", color: "#ff4444" }}>
                      💣
                    </span>
                  )}
                  {currentResult.result === "pay_all" && (
                    <span style={{ fontSize: "clamp(22px, 3.5vw, 44px)", fontWeight: "900", color: "#00e676" }}>
                      🎁
                    </span>
                  )}
                </motion.div>

                {/* +COINS win amount — golden pill, springs in 0.5s after ribbon */}
                <AnimatePresence>
                  {winCoins !== null && (
                    <motion.div
                      key="win-coins"
                      initial={{ scale: 0.3, opacity: 0, y: 24 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ delay: 0.5, duration: 0.5, type: "spring", bounce: 0.45 }}
                      style={{
                        position: "relative",
                        zIndex: 4,
                        marginTop: "clamp(8px, 1.2vh, 16px)",
                        display: "flex",
                        alignItems: "center",
                        gap: "clamp(6px, 0.8vw, 10px)",
                        background: "linear-gradient(135deg, rgba(0,0,0,0.6), rgba(30,20,0,0.6))",
                        border: "2.5px solid #ffd700",
                        borderRadius: "100px",
                        padding: "clamp(6px,1vh,12px) clamp(20px,3.5vw,48px)",
                        boxShadow: "0 0 32px rgba(255,215,0,0.65), inset 0 0 18px rgba(255,215,0,0.08)",
                      }}
                    >
                      <span style={{ fontSize: "clamp(18px, 2.8vw, 34px)" }}>💰</span>
                      <span style={{
                        fontSize: "clamp(28px, 4.5vw, 58px)",
                        fontWeight: "900",
                        background: "linear-gradient(180deg, #fff9c4 0%, #ffd700 45%, #ff8f00 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        filter: "drop-shadow(0 0 10px rgba(255,215,0,0.95))",
                        letterSpacing: "1px",
                        lineHeight: 1,
                      }}>
                        +{winCoins.toLocaleString()}
                      </span>
                      <span style={{
                        fontSize: "clamp(12px, 1.6vw, 20px)",
                        fontWeight: "800",
                        color: "#ffd700",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                      }}>COINS</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CSS Animations */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          @keyframes resultGlow {
            0%   { opacity: 0.7; transform: scale(0.92); }
            100% { opacity: 1;   transform: scale(1.08); }
          }
        `}</style>

        {/* HEADER BAR */}
        <header
          style={{
            height: navH,
            borderBottom: "2px solid #ffd700",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 clamp(8px, 1.5vw, 15px)",
            background: "rgba(10, 47, 31, 0.8)",
            flexShrink: 0,
          }}
        >
          {/* Left - User Info (click avatar to open profile) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "clamp(4px, 0.8vw, 12px)",
            }}
          >
            <div
              onClick={openProfileModal}
              title="Edit profile"
              style={{
                width: "clamp(30px, 4.5vw, 40px)",
                height: "clamp(30px, 4.5vw, 40px)",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2196F3, #9C27B0)",
                border: "2px solid #ffd700",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "clamp(12px, 1.8vw, 18px)",
                fontWeight: "bold",
                cursor: "pointer",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {user?.profilePicture
                ? <img src={user.profilePicture} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : user?.username?.charAt(0).toUpperCase()
              }
            </div>
            <div>
              <div
                style={{
                  fontSize: "clamp(10px, 1.3vw, 13px)",
                  fontWeight: "bold",
                }}
              >
                {user?.username}
              </div>
              <div
                style={{
                  fontSize: "clamp(11px, 1.5vw, 14px)",
                  color: "#ffd700",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <span>💰</span>
                {user?.coins?.toLocaleString() || 0}
              </div>
            </div>
          </div>

          {/* Center - Game Status */}
          <div
            style={{
              background:
                gameStatus === "betting"
                  ? "#4CAF50"
                  : gameStatus === "spinning"
                    ? "#FF9800"
                    : "#2196F3",
              padding: "clamp(3px, 0.7vh, 6px) clamp(10px, 1.5vw, 20px)",
              borderRadius: "6px",
              border: "2px solid #ffd700",
              fontSize: "clamp(10px, 1.4vw, 14px)",
              fontWeight: "bold",
              textAlign: "center",
              whiteSpace: "nowrap",
              flexShrink: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {gameStatus === "betting"
              ? `BETTING OPEN [${timeLeft}s]`
              : gameStatus === "spinning"
                ? "SPINNING..."
                : currentResult?.result
                    ? `${resultDisplayNames[currentResult.result] || currentResult.result.toUpperCase()}${currentResult.multiplier > 0 ? ` x${currentResult.multiplier}!` : ""}`
                    : "RESULT"}
          </div>

          {/* Right - Controls */}
          <div
            style={{
              display: "flex",
              gap: "clamp(3px, 0.6vw, 6px)",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {/* Request Coins Button */}
            <button
              onClick={() => setShowCoinRequest(true)}
              style={{
                height: btnSz,
                padding: "0 clamp(6px, 1vw, 11px)",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #1565C0, #0D47A1)",
                border: "2px solid rgba(100,180,255,0.6)",
                color: "#e8f4ff",
                fontSize: "clamp(8px, 1vw, 11px)",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              title="Request Coins"
            >
              <FaCoins style={{ fontSize: btnFsz }} />
              <span>Coins</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => latestCoinRequest && setShowCoinRequest(true)}
              style={{
                width: btnSz,
                height: btnSz,
                borderRadius: "6px",
                background: "#1a4d2e",
                border: `2px solid ${!latestCoinRequest ? '#ffd700' : latestCoinRequest.status === 'pending' ? '#ff9800' : latestCoinRequest.status === 'approved' ? '#4caf50' : '#f44336'}`,
                color: !latestCoinRequest ? '#ffd700' : latestCoinRequest.status === 'pending' ? '#ff9800' : latestCoinRequest.status === 'approved' ? '#4caf50' : '#f44336',
                fontSize: btnFsz,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
              title={latestCoinRequest ? `Request ${latestCoinRequest.status}` : 'No requests'}
            >
              <FaBell />
              {latestCoinRequest?.status === 'pending' && (
                <span style={{
                  position: "absolute", top: "-5px", right: "-5px",
                  background: "#ff9800", color: "#fff", borderRadius: "50%",
                  width: "14px", height: "14px", fontSize: "9px",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold",
                }}>!</span>
              )}
              {latestCoinRequest?.status === 'approved' && (
                <span style={{
                  position: "absolute", top: "-5px", right: "-5px",
                  background: "#4caf50", color: "#fff", borderRadius: "50%",
                  width: "14px", height: "14px", fontSize: "9px",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold",
                }}>✓</span>
              )}
              {latestCoinRequest?.status === 'rejected' && (
                <span style={{
                  position: "absolute", top: "-5px", right: "-5px",
                  background: "#f44336", color: "#fff", borderRadius: "50%",
                  width: "14px", height: "14px", fontSize: "9px",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold",
                }}>✕</span>
              )}
            </button>

            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                width: btnSz,
                height: btnSz,
                borderRadius: "6px",
                background: showHistory ? "#2f6f42" : "#1a4d2e",
                border: "2px solid #ffd700",
                color: "#ffd700",
                fontSize: btnFsz,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="History"
            >
              <FaHistory />
            </button>

            <button
              onClick={requestFullscreen}
              style={{
                width: btnSz,
                height: btnSz,
                borderRadius: "6px",
                background: "#1a4d2e",
                border: "2px solid #ffd700",
                color: "#ffd700",
                fontSize: btnFsz,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Fullscreen"
            >
              <FaExpand />
            </button>

            <button
              onClick={() => setShowOnlinePlayers(!showOnlinePlayers)}
              style={{
                width: btnSz,
                height: btnSz,
                borderRadius: "6px",
                background: "#1a4d2e",
                border: "2px solid #ffd700",
                color: "#ffd700",
                fontSize: btnFsz,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <FaUsers />
              {onlinePlayers.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-5px",
                    right: "-5px",
                    background: "#f44336",
                    color: "#fff",
                    borderRadius: "50%",
                    width: "16px",
                    height: "16px",
                    fontSize: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                  }}
                >
                  {onlinePlayers.length}
                </span>
              )}
            </button>

            <button
              onClick={openProfileModal}
              title="Profile"
              style={{
                width: btnSz,
                height: btnSz,
                borderRadius: "6px",
                background: "#1a4d2e",
                border: "2px solid #ffd700",
                color: "#ffd700",
                fontSize: btnFsz,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {user?.profilePicture
                ? <img src={user.profilePicture} alt="p" style={{ width: "22px", height: "22px", borderRadius: "50%", objectFit: "cover" }} />
                : <FaEdit />
              }
            </button>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              title={isMuted ? 'Unmute' : 'Mute'}
              style={{
                width: btnSz,
                height: btnSz,
                borderRadius: "6px",
                background: isMuted ? "rgba(244,67,54,0.15)" : "rgba(26,77,46,1)",
                border: `2px solid ${isMuted ? '#f44336' : '#ffd700'}`,
                color: isMuted ? "#f44336" : "#ffd700",
                fontSize: btnFsz,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                flexShrink: 0,
              }}
            >
              {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>

            <button
              onClick={handleLogout}
              title="Logout"
              style={{
                width: btnSz,
                height: btnSz,
                borderRadius: "6px",
                background: "rgba(244,67,54,0.15)",
                border: "2px solid #f44336",
                color: "#f44336",
                fontSize: btnFsz,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FaSignOutAlt />
            </button>
          </div>
        </header>

        {/* MAIN GAME AREA */}
        <main
          style={{
            flex: 1,
            padding: "clamp(3px, 0.4vh, 5px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
            minHeight: 0,
          }}
        >
          {/* Complete Rectangle Border - Hollow Rectangle */}
          <div
            style={{
              position: "relative",
              width: `min(95vw, calc((${appVh} - ${boardOff}) * 1.6))`,
              height: `min(calc(${appVh} - ${boardOff}), calc(95vw / 1.6))`,
              maxWidth: "1800px",
              maxHeight: "1000px",
            }}
          >
            {/* Grid with betting boxes */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(9, 1fr)",
                gridTemplateRows: "repeat(7, 1fr)",
                gap: "0px",
                width: "100%",
                height: "100%",
                border: "2px solid #ffd700",
              }}
            >
              {/* TOP ROW - Complete horizontal line */}
              {/* 1. Monkey (8x) - TOP LEFT CORNER */}
              <BetBox
                animal="🐵"
                multiplier={8}
                betType="monkey"
                gridArea="1 / 1 / 2 / 2"
                boxIndex={0}
              />

              {/* 2-4. Rabbits (6x) */}
              <BetBox
                animal="🐰"
                multiplier={6}
                betType="rabbit"
                gridArea="1 / 2 / 2 / 3"
                boxIndex={1}
              />
              <BetBox
                animal="🐰"
                multiplier={6}
                betType="rabbit"
                gridArea="1 / 3 / 2 / 4"
                boxIndex={2}
              />
              <BetBox
                animal="🐰"
                multiplier={6}
                betType="rabbit"
                gridArea="1 / 4 / 2 / 5"
                boxIndex={3}
              />

              {/* 5. Golden Shark (100x) - TOP CENTER */}
              <BetBox
                animal="🦈"
                multiplier={100}
                betType="goldenShark"
                isGolden
                gridArea="1 / 5 / 2 / 6"
                boxIndex={4}
              />

              {/* 6-8. Swallows (6x) */}
              <BetBox
                animal="🐦"
                multiplier={6}
                betType="swallow"
                gridArea="1 / 6 / 2 / 7"
                boxIndex={5}
              />
              <BetBox
                animal="🐦"
                multiplier={6}
                betType="swallow"
                gridArea="1 / 7 / 2 / 8"
                boxIndex={6}
              />
              <BetBox
                animal="🐦"
                multiplier={6}
                betType="swallow"
                gridArea="1 / 8 / 2 / 9"
                boxIndex={7}
              />

              {/* 9. Pigeon (8x) - TOP RIGHT CORNER */}
              <BetBox
                animal="🕊️"
                multiplier={8}
                betType="pigeon"
                gridArea="1 / 9 / 2 / 10"
                boxIndex={8}
              />

              {/* === LEFT VERTICAL LINE (Column 1, Rows 2-6) === */}
              <BetBox
                animal="🐵"
                multiplier={8}
                betType="monkey"
                gridArea="2 / 1 / 3 / 2"
                boxIndex={9}
              />
              <BetBox
                animal="🐵"
                multiplier={8}
                betType="monkey"
                gridArea="3 / 1 / 4 / 2"
                boxIndex={10}
              />
              <BetBox
                animal="💰"
                betType="payAll"
                isSpecial="pay"
                gridArea="4 / 1 / 5 / 2"
                boxIndex={11}
              />
              <BetBox
                animal="🐼"
                multiplier={8}
                betType="panda"
                gridArea="5 / 1 / 6 / 2"
                boxIndex={12}
              />
              <BetBox
                animal="🐼"
                multiplier={8}
                betType="panda"
                gridArea="6 / 1 / 7 / 2"
                boxIndex={13}
              />

              {/* === RIGHT VERTICAL LINE (Column 9, Rows 2-6) === */}
              <BetBox
                animal="🕊️"
                multiplier={8}
                betType="pigeon"
                gridArea="2 / 9 / 3 / 10"
                boxIndex={14}
              />
              <BetBox
                animal="🕊️"
                multiplier={8}
                betType="pigeon"
                gridArea="3 / 9 / 4 / 10"
                boxIndex={15}
              />
              <BetBox
                animal="💣"
                betType="takeAll"
                isSpecial="take"
                gridArea="4 / 9 / 5 / 10"
                boxIndex={16}
              />
              <BetBox
                animal="🦚"
                multiplier={8}
                betType="peacock"
                gridArea="5 / 9 / 6 / 10"
                boxIndex={17}
              />
              <BetBox
                animal="🦚"
                multiplier={8}
                betType="peacock"
                gridArea="6 / 9 / 7 / 10"
                boxIndex={18}
              />

              {/* === BOTTOM HORIZONTAL LINE (Row 7) === */}
              {/* 1. Panda (8x) - BOTTOM LEFT CORNER */}
              <BetBox
                animal="🐼"
                multiplier={8}
                betType="panda"
                gridArea="7 / 1 / 8 / 2"
                boxIndex={19}
              />

              {/* 2-4. Lions (12x) */}
              <BetBox
                animal="🦁"
                multiplier={12}
                betType="lion"
                gridArea="7 / 2 / 8 / 3"
                boxIndex={20}
              />
              <BetBox
                animal="🦁"
                multiplier={12}
                betType="lion"
                gridArea="7 / 3 / 8 / 4"
                boxIndex={21}
              />
              <BetBox
                animal="🦁"
                multiplier={12}
                betType="lion"
                gridArea="7 / 4 / 8 / 5"
                boxIndex={22}
              />

              {/* 5. Shark (24x) - BOTTOM CENTER */}
              <BetBox
                animal="🦈"
                multiplier={24}
                betType="shark24x"
                isSpecial="shark24"
                gridArea="7 / 5 / 8 / 6"
                boxIndex={23}
              />

              {/* 6-8. Eagles (12x) */}
              <BetBox
                animal="🦅"
                multiplier={12}
                betType="eagle"
                gridArea="7 / 6 / 8 / 7"
                boxIndex={24}
              />
              <BetBox
                animal="🦅"
                multiplier={12}
                betType="eagle"
                gridArea="7 / 7 / 8 / 8"
                boxIndex={25}
              />
              <BetBox
                animal="🦅"
                multiplier={12}
                betType="eagle"
                gridArea="7 / 8 / 8 / 9"
                boxIndex={26}
              />

              {/* 9. Peacock (8x) - BOTTOM RIGHT CORNER */}
              <BetBox
                animal="🦚"
                multiplier={8}
                betType="peacock"
                gridArea="7 / 9 / 8 / 10"
                boxIndex={27}
              />
            </div>

            {/* Center Images - Left Side Only */}
            <div
              style={{
                position: "absolute",
                top: "47%",
                left: "26%",
                transform: "translate(-50%, -50%) scale(0.85)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "clamp(5px, 0.8vw, 8px)",
                zIndex: 1,
              }}
            >
              {/* 2x2 Image Grid with Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gridTemplateRows: "repeat(2, 1fr)",
                  gap: "clamp(4px, 0.9vw, 9px)",
                  transform: "translate(0px, 0px)",
                  width: "clamp(190px, 19%, 280px)",
                  height: "clamp(190px, 19%, 280px)",
                }}
              >
                {/* Top Left - Monkey Card */}
                <div
                  data-bet-type="monkey"
                  onClick={() => handleBet("monkey")}
                  style={{
                    position: "relative",
                    border:
                      bets["monkey"] > 0
                        ? "3px solid #4CAF50"
                        : "3px solid #ffd700",
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow:
                      bets["monkey"] > 0
                        ? "0 0 15px rgba(76, 175, 80, 0.8)"
                        : "0 4px 10px rgba(0, 0, 0, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                  className="hover:scale-105"
                >
                  <img
                    src={monkeyImg}
                    alt="Monkey"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      padding: "0px",
                      background: "rgba(0,0,0,0.08)",
                    }}
                  />
                  {bets["monkey"] > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        background: "rgba(76, 175, 80, 0.95)",
                        color: "#ffffff",
                        padding:
                          "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                        borderRadius: "4px",
                        fontSize: "clamp(10px, 1.2vw, 13px)",
                        fontWeight: "bold",
                        border: "1px solid #ffffff",
                      }}
                    >
                      {bets["monkey"]}
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(0, 0, 0, 0.75)",
                      padding: isMobileLandscape ? "3px" : "clamp(4px, 0.6vh, 6px)",
                      borderTop: "2px solid #ffd700",
                    }}
                  >
                    <div
                      style={{
                        color: "#ffffff",
                        fontSize: isMobileLandscape ? "9px" : "clamp(11px, 1.4vw, 15px)",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Monkey <span style={{ color: "#ffd700" }}>x8</span>
                    </div>
                  </div>
                </div>

                {/* Top Right - Rabbit Card */}
                <div
                  data-bet-type="rabbit"
                  onClick={() => handleBet("rabbit")}
                  style={{
                    position: "relative",
                    border:
                      bets["rabbit"] > 0
                        ? "3px solid #4CAF50"
                        : "3px solid #ffd700",
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow:
                      bets["rabbit"] > 0
                        ? "0 0 15px rgba(76, 175, 80, 0.8)"
                        : "0 4px 10px rgba(0, 0, 0, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                  className="hover:scale-105"
                >
                  <img
                    src={rabbitImg}
                    alt="Rabbit"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      padding: "0px",
                      background: "rgba(0,0,0,0.08)",
                    }}
                  />
                  {bets["rabbit"] > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        background: "rgba(76, 175, 80, 0.95)",
                        color: "#ffffff",
                        padding:
                          "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                        borderRadius: "4px",
                        fontSize: "clamp(10px, 1.2vw, 13px)",
                        fontWeight: "bold",
                        border: "1px solid #ffffff",
                      }}
                    >
                      {bets["rabbit"]}
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(0, 0, 0, 0.75)",
                      padding: isMobileLandscape ? "3px" : "clamp(4px, 0.6vh, 6px)",
                      borderTop: "2px solid #ffd700",
                    }}
                  >
                    <div
                      style={{
                        color: "#ffffff",
                        fontSize: isMobileLandscape ? "9px" : "clamp(11px, 1.4vw, 15px)",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Rabbit <span style={{ color: "#ffd700" }}>x6</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Left - Lion Card */}
                <div
                  data-bet-type="lion"
                  onClick={() => handleBet("lion")}
                  style={{
                    position: "relative",
                    border:
                      bets["lion"] > 0
                        ? "3px solid #4CAF50"
                        : "3px solid #ffd700",
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow:
                      bets["lion"] > 0
                        ? "0 0 15px rgba(76, 175, 80, 0.8)"
                        : "0 4px 10px rgba(0, 0, 0, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                  className="hover:scale-105"
                >
                  <img
                    src={lionImg}
                    alt="Lion"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      padding: "0px",
                      background: "rgba(0,0,0,0.08)",
                    }}
                  />
                  {bets["lion"] > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        background: "rgba(76, 175, 80, 0.95)",
                        color: "#ffffff",
                        padding:
                          "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                        borderRadius: "4px",
                        fontSize: "clamp(10px, 1.2vw, 13px)",
                        fontWeight: "bold",
                        border: "1px solid #ffffff",
                      }}
                    >
                      {bets["lion"]}
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(0, 0, 0, 0.75)",
                      padding: isMobileLandscape ? "3px" : "clamp(4px, 0.6vh, 6px)",
                      borderTop: "2px solid #ffd700",
                    }}
                  >
                    <div
                      style={{
                        color: "#ffffff",
                        fontSize: isMobileLandscape ? "9px" : "clamp(11px, 1.4vw, 15px)",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Lion <span style={{ color: "#ffd700" }}>x12</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Right - Panda Card */}
                <div
                  data-bet-type="panda"
                  onClick={() => handleBet("panda")}
                  style={{
                    position: "relative",
                    border:
                      bets["panda"] > 0
                        ? "3px solid #4CAF50"
                        : "3px solid #ffd700",
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow:
                      bets["panda"] > 0
                        ? "0 0 15px rgba(76, 175, 80, 0.8)"
                        : "0 4px 10px rgba(0, 0, 0, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                  className="hover:scale-105"
                >
                  <img
                    src={pandaImg}
                    alt="Panda"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      padding: "0px",
                      background: "rgba(0,0,0,0.08)",
                    }}
                  />
                  {bets["panda"] > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        background: "rgba(76, 175, 80, 0.95)",
                        color: "#ffffff",
                        padding:
                          "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                        borderRadius: "4px",
                        fontSize: "clamp(10px, 1.2vw, 13px)",
                        fontWeight: "bold",
                        border: "1px solid #ffffff",
                      }}
                    >
                      {bets["panda"]}
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(0, 0, 0, 0.75)",
                      padding: isMobileLandscape ? "3px" : "clamp(4px, 0.6vh, 6px)",
                      borderTop: "2px solid #ffd700",
                    }}
                  >
                    <div
                      style={{
                        color: "#ffffff",
                        fontSize: isMobileLandscape ? "9px" : "clamp(11px, 1.4vw, 15px)",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Panda <span style={{ color: "#ffd700" }}>x8</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Beast 2x Button */}
              <button
                data-bet-type="beast2x"
                onClick={() => handleBet("beast2x")}
                style={{
                  pointerEvents: "auto",
                  padding: "clamp(5px, 0.8vh, 8px) clamp(12px, 2vw, 24px)", // SAME
                  background:
                    bets["beast2x"] > 0
                      ? "linear-gradient(135deg, #66BB6A 0%, #4CAF50 100%)"
                      : "linear-gradient(135deg, #4CAF50 0%, #45a049 100%)",
                  border:
                    bets["beast2x"] > 0
                      ? "2px solid #66BB6A"
                      : "2px solid #ffd700",
                  borderRadius: "6px", // SAME
                  color: "#ffffff",
                  transform: "translateY(6px)", // SAME as Bird
                  fontSize: "clamp(12px, 1.6vw, 16px)", // SAME
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow:
                    bets["beast2x"] > 0
                      ? "0 0 14px rgba(76, 175, 80, 0.8)"
                      : "0 2px 8px rgba(76, 175, 80, 0.45)",
                  transition: "all 0.25s ease",
                  textTransform: "uppercase",
                  letterSpacing: "1.2px", // SAME
                  width: "clamp(105px, 14vw, 170px)", // SAME
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px", // SAME
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.target.style.boxShadow =
                    "0 4px 12px rgba(76, 175, 80, 0.65)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.boxShadow =
                    bets["beast2x"] > 0
                      ? "0 0 14px rgba(76, 175, 80, 0.8)"
                      : "0 2px 8px rgba(76, 175, 80, 0.45)";
                }}
              >
                <span>Beast</span>
                <span
                  style={{
                    color: "#ffd700",
                    fontSize: "clamp(14px, 1.8vw, 19px)", // SAME
                  }}
                >
                  x2
                </span>

                {bets["beast2x"] > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-6px", // SAME
                      right: "-6px", // SAME
                      background: "#ffffff",
                      color: "#4CAF50",
                      padding: "2px 5px", // SAME
                      borderRadius: "50%",
                      fontSize: "clamp(9px, 1vw, 11px)", // SAME
                      fontWeight: "bold",
                      border: "1.5px solid #4CAF50",
                      minWidth: "clamp(18px, 2vw, 24px)", // SAME
                      minHeight: "clamp(18px, 2vw, 24px)", // SAME
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {bets["beast2x"]}
                  </div>
                )}
              </button>
            </div>

            {/* Center Images - Right Side (Birds) */}
            <div
              style={{
                position: "absolute",
                top: "47%",
                right: "26%",
                transform: "translate(50%, -50%) scale(0.85)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "clamp(4px, 0.6vw, 6px)",
                zIndex: 1,
              }}
            >
              {/* 2x2 Bird Grid with Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gridTemplateRows: "repeat(2, 1fr)",
                  gap: "clamp(4px, 0.9vw, 9px)",
                  width: "clamp(190px, 19%, 280px)",
                  height: "clamp(190px, 19%, 280px)",
                }}
              >
                {/* Top Left - Swallow Card */}
                <div
                  data-bet-type="swallow"
                  onClick={() => handleBet("swallow")}
                  style={{
                    position: "relative",
                    border:
                      bets["swallow"] > 0
                        ? "3px solid #2196F3"
                        : "3px solid #ffd700",
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow:
                      bets["swallow"] > 0
                        ? "0 0 15px rgba(33, 150, 243, 0.8)"
                        : "0 4px 10px rgba(0, 0, 0, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                  className="hover:scale-105"
                >
                  <img
                    src={swallowImg}
                    alt="Swallow"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      padding: "0px",
                      background: "rgba(0,0,0,0.08)",
                    }}
                  />
                  {bets["swallow"] > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        background: "rgba(33, 150, 243, 0.95)",
                        color: "#ffffff",
                        padding:
                          "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                        borderRadius: "4px",
                        fontSize: "clamp(10px, 1.2vw, 13px)",
                        fontWeight: "bold",
                        border: "1px solid #ffffff",
                      }}
                    >
                      {bets["swallow"]}
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(0, 0, 0, 0.75)",
                      padding: isMobileLandscape ? "3px" : "clamp(4px, 0.6vh, 6px)",
                      borderTop: "2px solid #ffd700",
                    }}
                  >
                    <div
                      style={{
                        color: "#ffffff",
                        fontSize: isMobileLandscape ? "9px" : "clamp(11px, 1.4vw, 15px)",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Swallow <span style={{ color: "#ffd700" }}>x6</span>
                    </div>
                  </div>
                </div>

                {/* Top Right - Pigeon Card */}
                <div
                  data-bet-type="pigeon"
                  onClick={() => handleBet("pigeon")}
                  style={{
                    position: "relative",
                    border:
                      bets["pigeon"] > 0
                        ? "3px solid #2196F3"
                        : "3px solid #ffd700",
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow:
                      bets["pigeon"] > 0
                        ? "0 0 15px rgba(33, 150, 243, 0.8)"
                        : "0 4px 10px rgba(0, 0, 0, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                  className="hover:scale-105"
                >
                  <img
                    src={doveImg}
                    alt="Pigeon"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      padding: "0px",
                      background: "rgba(0,0,0,0.08)",
                    }}
                  />
                  {bets["pigeon"] > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        background: "rgba(33, 150, 243, 0.95)",
                        color: "#ffffff",
                        padding:
                          "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                        borderRadius: "4px",
                        fontSize: "clamp(10px, 1.2vw, 13px)",
                        fontWeight: "bold",
                        border: "1px solid #ffffff",
                      }}
                    >
                      {bets["pigeon"]}
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(0, 0, 0, 0.75)",
                      padding: isMobileLandscape ? "3px" : "clamp(4px, 0.6vh, 6px)",
                      borderTop: "2px solid #ffd700",
                    }}
                  >
                    <div
                      style={{
                        color: "#ffffff",
                        fontSize: isMobileLandscape ? "9px" : "clamp(11px, 1.4vw, 15px)",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Pigeon <span style={{ color: "#ffd700" }}>x8</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Left - Peacock Card */}
                <div
                  data-bet-type="peacock"
                  onClick={() => handleBet("peacock")}
                  style={{
                    position: "relative",
                    border:
                      bets["peacock"] > 0
                        ? "3px solid #2196F3"
                        : "3px solid #ffd700",
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow:
                      bets["peacock"] > 0
                        ? "0 0 15px rgba(33, 150, 243, 0.8)"
                        : "0 4px 10px rgba(0, 0, 0, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                  className="hover:scale-105"
                >
                  <img
                    src={peacockImg}
                    alt="Peacock"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      padding: "0px",
                      background: "rgba(0,0,0,0.08)",
                    }}
                  />
                  {bets["peacock"] > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        background: "rgba(33, 150, 243, 0.95)",
                        color: "#ffffff",
                        padding:
                          "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                        borderRadius: "4px",
                        fontSize: "clamp(10px, 1.2vw, 13px)",
                        fontWeight: "bold",
                        border: "1px solid #ffffff",
                      }}
                    >
                      {bets["peacock"]}
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(0, 0, 0, 0.75)",
                      padding: isMobileLandscape ? "3px" : "clamp(4px, 0.6vh, 6px)",
                      borderTop: "2px solid #ffd700",
                    }}
                  >
                    <div
                      style={{
                        color: "#ffffff",
                        fontSize: isMobileLandscape ? "9px" : "clamp(11px, 1.4vw, 15px)",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Peacock <span style={{ color: "#ffd700" }}>x8</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Right - Eagle Card */}
                <div
                  data-bet-type="eagle"
                  onClick={() => handleBet("eagle")}
                  style={{
                    position: "relative",
                    border:
                      bets["eagle"] > 0
                        ? "3px solid #2196F3"
                        : "3px solid #ffd700",
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow:
                      bets["eagle"] > 0
                        ? "0 0 15px rgba(33, 150, 243, 0.8)"
                        : "0 4px 10px rgba(0, 0, 0, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                  className="hover:scale-105"
                >
                  <img
                    src={eagleImg}
                    alt="Eagle"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      padding: "0px",
                      background: "rgba(0,0,0,0.08)",
                    }}
                  />
                  {bets["eagle"] > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        background: "rgba(33, 150, 243, 0.95)",
                        color: "#ffffff",
                        padding:
                          "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                        borderRadius: "4px",
                        fontSize: "clamp(10px, 1.2vw, 13px)",
                        fontWeight: "bold",
                        border: "1px solid #ffffff",
                      }}
                    >
                      {bets["eagle"]}
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(0, 0, 0, 0.75)",
                      padding: isMobileLandscape ? "3px" : "clamp(4px, 0.6vh, 6px)",
                      borderTop: "2px solid #ffd700",
                    }}
                  >
                    <div
                      style={{
                        color: "#ffffff",
                        fontSize: isMobileLandscape ? "9px" : "clamp(11px, 1.4vw, 15px)",
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Eagle <span style={{ color: "#ffd700" }}>x12</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bird 2x Button */}
              <button
                data-bet-type="bird2x"
                onClick={() => handleBet("bird2x")}
                style={{
                  pointerEvents: "auto",
                  padding: "clamp(5px, 0.8vh, 8px) clamp(12px, 2vw, 24px)", // ⬅ reduced
                  background:
                    bets["bird2x"] > 0
                      ? "linear-gradient(135deg, #42A5F5 0%, #2196F3 100%)"
                      : "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)",
                  border:
                    bets["bird2x"] > 0
                      ? "2px solid #42A5F5" // ⬅ thinner
                      : "2px solid #ffd700",
                  borderRadius: "6px", // ⬅ smaller radius
                  color: "#ffffff",
                  transform: "translateY(6px)", // ⬅ reduced offset
                  fontSize: "clamp(12px, 1.6vw, 16px)", // ⬅ smaller text
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow:
                    bets["bird2x"] > 0
                      ? "0 0 14px rgba(33, 150, 243, 0.8)" // ⬅ lighter glow
                      : "0 2px 8px rgba(33, 150, 243, 0.45)",
                  transition: "all 0.25s ease",
                  textTransform: "uppercase",
                  letterSpacing: "1.2px", // ⬅ tighter
                  width: "clamp(105px, 14vw, 170px)", // ⬅ reduced width
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px", // ⬅ reduced gap
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.target.style.boxShadow =
                    "0 4px 12px rgba(33, 150, 243, 0.65)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.boxShadow =
                    bets["bird2x"] > 0
                      ? "0 0 14px rgba(33, 150, 243, 0.8)"
                      : "0 2px 8px rgba(33, 150, 243, 0.45)";
                }}
              >
                <span>Bird</span>
                <span
                  style={{
                    color: "#ffd700",
                    fontSize: "clamp(14px, 1.8vw, 19px)", // ⬅ smaller x2
                  }}
                >
                  x2
                </span>

                {bets["bird2x"] > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-6px",
                      right: "-6px",
                      background: "#ffffff",
                      color: "#2196F3",
                      padding: "2px 5px", // ⬅ smaller badge
                      borderRadius: "50%",
                      fontSize: "clamp(9px, 1vw, 11px)",
                      fontWeight: "bold",
                      border: "1.5px solid #2196F3",
                      minWidth: "clamp(18px, 2vw, 24px)",
                      minHeight: "clamp(18px, 2vw, 24px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {bets["bird2x"]}
                  </div>
                )}
              </button>
            </div>

            {/* Center Column - Total Bet & Sharks */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: isMobileLandscape ? "translate(-50%, -50%) scale(0.9)" : "translate(-50%, -50%) scale(0.85)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: isMobileLandscape ? "clamp(3px, 0.5vw, 5px)" : "clamp(3px, 0.5vw, 5px)",
                zIndex: 1,
              }}
            >
              {/* Total Bet Counter Box */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #1a4d2e 0%, #0a2f1f 100%)",
                  border: "2px solid #ffd700",
                  borderRadius: "6px",
                  padding: isMobileLandscape ? "clamp(5px, 0.6vh, 7px) clamp(10px, 1.5vw, 16px)" : "clamp(4px, 0.5vh, 6px) clamp(8px, 1.2vw, 14px)",
                  boxShadow: "0 3px 8px rgba(255, 215, 0, 0.4)",
                  minWidth: isMobileLandscape ? "clamp(80px, 10vw, 140px)" : "clamp(70px, 9vw, 120px)",
                  textAlign: "center",
                  marginTop: isMobileLandscape ? "clamp(8px, 1.2vh, 12px)" : "clamp(4px, 0.8vh, 8px)",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    color: "#ffd700",
                    fontSize: isMobileLandscape ? "clamp(7px, 0.9vw, 10px)" : "clamp(6px, 0.8vw, 8px)",
                    fontWeight: "bold",
                    marginBottom: "clamp(2px, 0.3vh, 3px)",
                    letterSpacing: "0.5px",
                  }}
                >
                  TOTAL BET
                </div>

                <div
                  style={{
                    color: "#ffffff",
                    fontSize: "clamp(11px, 1.6vw, 16px)",
                    fontWeight: "bold",
                  }}
                >
                  {totalBet.toLocaleString()}
                </div>
              </div>

              {/* Golden Shark Card - 100x */}
              <div
                data-bet-type="goldenShark"
                onClick={() => handleBet("goldenShark")}
                style={{
                  position: "relative",
                  border:
                    bets["goldenShark"] > 0
                      ? "3px solid #FFD700"
                      : "3px solid #ffd700",
                  borderRadius: "6px",
                  overflow: "hidden",
                  boxShadow:
                    bets["goldenShark"] > 0
                      ? "0 0 20px rgba(255, 215, 0, 0.95)"
                      : "0 4px 12px rgba(255, 215, 0, 0.6)",
                  width: "clamp(75px, 10vw, 120px)",
                  height: "clamp(75px, 10vw, 120px)",
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
                className="hover:scale-105"
              >
                <img
                  src={goldenSharkImg}
                  alt="Golden Shark"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                {bets["goldenShark"] > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "5px",
                      right: "5px",
                      background: "rgba(255, 215, 0, 0.95)",
                      color: "#000",
                      padding: "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                      borderRadius: "4px",
                      fontSize: "clamp(10px, 1.2vw, 13px)",
                      fontWeight: "bold",
                      border: "1px solid #000",
                    }}
                  >
                    {bets["goldenShark"]}
                  </div>
                )}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(255, 215, 0, 0.9)",
                    padding: "clamp(3px, 0.5vh, 5px)",
                    borderTop: "2px solid #000",
                  }}
                >
                  <div
                    style={{
                      color: "#000",
                      fontSize: "clamp(9px, 1.1vw, 13px)",
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    Golden Shark <span style={{ color: "#ff0000" }}>x100</span>
                  </div>
                </div>
              </div>

              {/* Regular Shark Card - 24x */}
              <div
                data-bet-type="shark24x"
                onClick={() => handleBet("shark24x")}
                style={{
                  position: "relative",
                  border:
                    bets["shark24x"] > 0
                      ? "3px solid #66BB6A"
                      : "2px solid #ffd700",
                  borderRadius: "6px",
                  overflow: "hidden",
                  boxShadow:
                    bets["shark24x"] > 0
                      ? "0 0 15px rgba(76, 175, 80, 0.8)"
                      : "0 3px 8px rgba(0, 0, 0, 0.3)",
                  width: "clamp(65px, 8vw, 110px)",
                  height: "clamp(65px, 8vw, 110px)",
                  marginTop: "clamp(-4px, -0.6vh, -2px)",
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
                className="hover:scale-105"
              >
                <img
                  src={sharkImg}
                  alt="Shark"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                {bets["shark24x"] > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "5px",
                      right: "5px",
                      background: "rgba(76, 175, 80, 0.95)",
                      color: "#ffffff",
                      padding: "clamp(3px, 0.5vh, 5px) clamp(6px, 0.8vw, 8px)",
                      borderRadius: "4px",
                      fontSize: "clamp(10px, 1.2vw, 13px)",
                      fontWeight: "bold",
                      border: "1px solid #ffffff",
                    }}
                  >
                    {bets["shark24x"]}
                  </div>
                )}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(0, 0, 0, 0.75)",
                    padding: "clamp(3px, 0.4vh, 4px)",
                    borderTop: "2px solid #ffd700",
                  }}
                >
                  <div
                    style={{
                      color: "#ffffff",
                      fontSize: "clamp(9px, 1.1vw, 12px)",
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    Shark <span style={{ color: "#ffd700" }}>x24</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results History Column - Right Side */}
          <div
            ref={historyScrollRef}
            style={{
              position: "absolute",
              right:
                `calc((100% - min(98vw, calc((${appVh} - 140px) * 1.7))) / 2 - clamp(70px, 9vw, 110px))`,
              top: "50%",
              transform: "translateY(-50%)",
              width: "clamp(60px, 8vw, 100px)",
              height:
                `min(calc((${appVh} - 140px) - 20px), calc(98vw / 1.7 - 20px))`,
              maxHeight: "980px",
              background: "rgba(26, 77, 46, 0.95)",
              border: "3px solid #ffd700",
              borderRadius: "10px",
              overflowY: "auto",
              overflowX: "hidden",
              padding:
                "clamp(6px, 0.8vw, 12px) clamp(6px, 0.8vw, 12px) clamp(10px, 1.2vw, 16px)",
              display: isMobileLandscape ? "none" : "flex",
              flexDirection: "column",
              gap: "clamp(5px, 0.6vw, 8px)",
              zIndex: 2,
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.6)",
            }}
            className="custom-scrollbar"
          >
            {/* oldest at index 0 (top), newest at last index (bottom) — no reverse needed */}
            {historyResults.map((result, index) => {
                const isLatest = index === historyResults.length - 1;
                return (
                  <div
                    key={result.roundId ?? index}
                    style={{ position: "relative" }}
                  >
                    {isLatest && (
                      <div
                        style={{
                          position: "absolute",
                          top: "-10px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "linear-gradient(135deg, #ffd700 0%, #ffa500 100%)",
                          color: "#000",
                          fontSize: "clamp(7px, 0.9vw, 10px)",
                          fontWeight: "bold",
                          padding: "clamp(1px, 0.2vw, 2px) clamp(4px, 0.6vw, 6px)",
                          borderRadius: "4px",
                          border: "2px solid #fff",
                          zIndex: 10,
                          letterSpacing: "0.5px",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.5)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        LATEST
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: "clamp(28px, 4vw, 42px)",
                        textAlign: "center",
                        padding: "clamp(4px, 0.5vw, 8px)",
                        background: isLatest
                          ? "linear-gradient(135deg, rgba(255,215,0,0.4) 0%, rgba(255,165,0,0.3) 100%)"
                          : "transparent",
                        borderRadius: "6px",
                        border: isLatest ? "3px solid #ffd700" : "1px solid transparent",
                        transition: "all 0.3s",
                        boxShadow: isLatest
                          ? "0 0 15px rgba(255,215,0,0.8), inset 0 0 10px rgba(255,215,0,0.4)"
                          : "none",
                        minHeight: "clamp(35px, 4.5vw, 50px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {getResultEmoji(result.result)}
                    </div>
                  </div>
                );
              })}
            {historyResults.length === 0 && (
              <div
                style={{
                  fontSize: "clamp(10px, 1.2vw, 12px)",
                  color: "#888",
                  textAlign: "center",
                  padding: "10px 5px",
                }}
              >
                No results yet
              </div>
            )}
          </div>

        </main>

        <AnimatePresence>
          {isMobileLandscape && showHistory && (
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              style={{
                position: "fixed",
                top: `calc(${navH} + 6px)`,
                left: "6px",
                width: "44px",
                maxHeight: `calc(${appVh} - ${navH} - ${footerH} - 18px)`,
                background: "rgba(26, 77, 46, 0.97)",
                border: "2px solid #ffd700",
                borderRadius: "10px",
                overflowY: "auto",
                overflowX: "hidden",
                padding: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                zIndex: 140,
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.6)",
              }}
              className="custom-scrollbar"
            >
              {historyResults.map((result, index) => (
                <div
                  key={result.roundId ?? index}
                  style={{
                    fontSize: "28px",
                    textAlign: "center",
                    padding: "4px",
                    background: index === historyResults.length - 1 ? "rgba(255,215,0,0.18)" : "transparent",
                    borderRadius: "6px",
                    border: index === historyResults.length - 1 ? "2px solid #ffd700" : "1px solid transparent",
                    minHeight: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {getResultEmoji(result.result)}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM BAR — coin chips centered + total bet */}
        <footer
          style={{
            height: footerH,
            borderTop: "2px solid rgba(255,215,0,0.6)",
            background: "linear-gradient(180deg, rgba(10,47,31,0.95) 0%, rgba(6,28,18,0.98) 100%)",
            backdropFilter: "blur(6px)",
            padding: isMobileLandscape ? "0 clamp(10px, 1.8vw, 22px)" : "0 clamp(8px, 1.2vw, 14px)",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            gap: isMobileLandscape ? "clamp(5px, 0.8vw, 11px)" : "clamp(6px, 1vw, 10px)",
            flexShrink: 0,
            boxShadow: "0 -4px 18px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
        >
          {/* ── Total Bet box — left side ── */}
          <div
            style={{
              position: "absolute",
              left: isMobileLandscape ? "clamp(10px, 1.8vw, 22px)" : "clamp(8px, 1.5vw, 16px)",
              background: "rgba(255,215,0,0.07)",
              border: "1.5px solid rgba(255,215,0,0.5)",
              borderRadius: "10px",
              padding: isMobileLandscape ? "3px 8px" : "clamp(3px, 0.5vh, 5px) clamp(8px, 1vw, 12px)",
              flexShrink: 0,
              textAlign: "center",
              minWidth: isMobileLandscape ? "60px" : "clamp(62px, 8vw, 90px)",
            }}
          >
            <div style={{ fontSize: isMobileLandscape ? "7px" : "clamp(6px, 0.7vw, 8px)", color: "rgba(255,215,0,0.7)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "2px" }}>
              Bet
            </div>
            <div style={{ fontSize: isMobileLandscape ? "12px" : "clamp(11px, 1.5vw, 16px)", fontWeight: "bold", color: "#ffd700", lineHeight: 1 }}>
              {totalBet.toLocaleString()}
            </div>
          </div>

          {/* ── Jewel Gem Coin Chips — Centered ── */}
          <div
            style={{
              display: "flex",
              gap: isMobileLandscape ? "clamp(5px, 0.8vw, 11px)" : "clamp(5px, 0.9vw, 9px)",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {coinOptions.map((coin) => {
              const isSel = selectedCoin === coin.value;
              // Build layered facet background simulating a cut gemstone
              const facetBg = [
                // Primary specular highlight (top-left glint)
                "radial-gradient(ellipse at 26% 20%, rgba(255,255,255,0.72) 0%, transparent 28%)",
                // Diagonal bright facet edge
                "linear-gradient(132deg, rgba(255,255,255,0.38) 0%, transparent 36%)",
                // Bottom-right shadow facet for depth
                "linear-gradient(312deg, rgba(0,0,0,0.28) 0%, transparent 42%)",
                // Left-side reflected light
                "linear-gradient(202deg, rgba(255,255,255,0.16) 0%, transparent 30%)",
                // Secondary small glint at lower-right
                "radial-gradient(ellipse at 74% 76%, rgba(255,255,255,0.18) 0%, transparent 22%)",
                // Base gem color
                coin.color,
              ].join(", ");

              return (
                <button
                  key={coin.value}
                  ref={(el) => { coinChipRefs.current[coin.value] = el; }}
                  onClick={() => setSelectedCoin(coin.value)}
                  title={`${coin.name} — ${coin.label} coins`}
                  style={{
                    // ── Shape ──────────────────────────────────
                    width:        chipSize,
                    height:       chipSize,
                    borderRadius: "50%",
                    flexShrink:   0,
                    padding:      0,
                    position:     "relative",
                    cursor:       "pointer",
                    overflow:     "hidden",
                    // ── Gem background ─────────────────────────
                    background: facetBg,
                    // ── Border / rim ───────────────────────────
                    border: isSel
                      ? "2.5px solid rgba(255,255,255,0.95)"
                      : "1.5px solid rgba(255,255,255,0.22)",
                    // ── Glow & lift ────────────────────────────
                    boxShadow: isSel
                      ? `0 0 0 3px ${coin.color},
                         0 0 18px ${coin.color},
                         0 0 36px ${coin.color}80,
                         0 6px 20px rgba(0,0,0,0.6),
                         inset 0 1px 0 rgba(255,255,255,0.4)`
                      : `0 3px 10px rgba(0,0,0,0.55),
                         0 0 8px  ${coin.color}55,
                         inset 0 1px 0 rgba(255,255,255,0.25)`,
                    transform:   isSel ? "scale(1.22) translateY(-3px)" : "scale(1)",
                    filter:      isSel ? "brightness(1.12)" : "brightness(1)",
                    // ── Motion ─────────────────────────────────
                    transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s, border-color 0.22s, filter 0.22s",
                    animation:   isSel ? "gemShimmer 2s ease-in-out infinite" : "none",
                    // ── Text ───────────────────────────────────
                    color:      "#fff",
                    fontSize:   chipFont,
                    fontWeight: "900",
                    letterSpacing: "0px",
                    display:    "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Thin cut-line refraction — main diagonal */}
                  <div style={{
                    position: "absolute",
                    top: "8%", left: "40%",
                    width: "1.5px", height: "55%",
                    background: "linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0.08))",
                    transform: "rotate(-32deg)",
                    borderRadius: "2px",
                    pointerEvents: "none",
                  }} />
                  {/* Shorter refraction — secondary sparkle */}
                  <div style={{
                    position: "absolute",
                    bottom: "16%", right: "25%",
                    width: "1px", height: "26%",
                    background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)",
                    transform: "rotate(-32deg)",
                    borderRadius: "2px",
                    pointerEvents: "none",
                  }} />
                  {/* Inner gem edge ring for depth */}
                  <div style={{
                    position: "absolute",
                    inset: "4px",
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.14)",
                    pointerEvents: "none",
                  }} />
                  {/* Label */}
                  <span style={{
                    position: "relative", zIndex: 2,
                    textShadow: "0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.6)",
                    lineHeight: 1,
                  }}>
                    {coin.label}
                  </span>
                </button>
              );
            })}
          </div>

        </footer>

        {/* ── Coin Request Modal ── */}
        {showCoinRequest && (
          <div
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 400, padding: "16px",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowCoinRequest(false); }}
          >
            <div
              style={{
                width: "min(460px, 95vw)",
                background: "linear-gradient(160deg, #0a2f1f 0%, #0d1f3c 100%)",
                border: "2px solid rgba(255,215,0,0.5)",
                borderRadius: "18px",
                padding: "clamp(18px, 4vw, 32px)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(255,215,0,0.1)",
                position: "relative",
              }}
            >
              {/* Close */}
              <button
                onClick={() => setShowCoinRequest(false)}
                style={{
                  position: "absolute", top: "14px", right: "14px",
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "50%", width: "32px", height: "32px",
                  color: "#ccc", fontSize: "16px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
              >✕</button>

              {/* Title */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <FaCoins style={{ color: "#ffd700", fontSize: "22px" }} />
                <h2 style={{ margin: 0, fontSize: "clamp(16px,2.5vw,22px)", fontWeight: "800", color: "#ffd700" }}>
                  Request Coins
                </h2>
              </div>

              {/* Current request status */}
              {latestCoinRequest && (
                <div
                  style={{
                    marginBottom: "18px",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: latestCoinRequest.status === "approved"
                      ? "rgba(76,175,80,0.12)"
                      : latestCoinRequest.status === "rejected"
                        ? "rgba(244,67,54,0.12)"
                        : "rgba(255,152,0,0.12)",
                    border: `1px solid ${latestCoinRequest.status === "approved" ? "rgba(76,175,80,0.4)" : latestCoinRequest.status === "rejected" ? "rgba(244,67,54,0.4)" : "rgba(255,152,0,0.4)"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>Last Request</span>
                    <span
                      style={{
                        fontSize: "12px", fontWeight: "bold", padding: "3px 10px",
                        borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.5px",
                        background: latestCoinRequest.status === "approved"
                          ? "#4CAF50" : latestCoinRequest.status === "rejected" ? "#f44336" : "#FF9800",
                        color: "#fff",
                      }}
                    >{latestCoinRequest.status}</span>
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "15px", fontWeight: "bold", color: "#ffd700" }}>
                    {latestCoinRequest.requestedAmount} coins
                  </div>
                  {latestCoinRequest.adminNote && (
                    <div style={{ marginTop: "4px", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                      Note: {latestCoinRequest.adminNote}
                    </div>
                  )}
                </div>
              )}

              {/* Block message when pending */}
              {latestCoinRequest?.status === "pending" ? (
                <div style={{
                  textAlign: "center", padding: "18px 0",
                  color: "rgba(255,255,255,0.65)", fontSize: "14px", lineHeight: 1.6,
                }}>
                  Your request is currently <strong style={{ color: "#FF9800" }}>pending review</strong>.<br />
                  You can submit a new request once this one is processed.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.7)", marginBottom: "10px" }}>
                      Select Amount: <strong style={{ color: "#ffd700", fontSize: "15px" }}>{coinRequestAmount} coins</strong>
                    </label>

                    {/* Quick-select buttons */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                      {[10, 50, 100, 250, 500, 1000].map(amt => (
                        <button
                          key={amt}
                          onClick={() => setCoinRequestAmount(amt)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "8px",
                            border: coinRequestAmount === amt ? "2px solid #ffd700" : "1.5px solid rgba(255,255,255,0.2)",
                            background: coinRequestAmount === amt ? "rgba(255,215,0,0.18)" : "rgba(255,255,255,0.06)",
                            color: coinRequestAmount === amt ? "#ffd700" : "rgba(255,255,255,0.75)",
                            fontSize: "13px", fontWeight: "600", cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >{amt}</button>
                      ))}
                    </div>

                    {/* Slider */}
                    <input
                      type="range"
                      min={10} max={1000} step={10}
                      value={coinRequestAmount}
                      onChange={(e) => setCoinRequestAmount(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#ffd700" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                      <span>10</span><span>1000</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCoinRequest}
                    disabled={coinRequestLoading}
                    style={{
                      width: "100%", height: "46px",
                      background: coinRequestLoading
                        ? "linear-gradient(135deg, #444, #333)"
                        : "linear-gradient(135deg, #ffe033 0%, #ff9500 60%, #e07000 100%)",
                      border: "none", borderRadius: "12px",
                      color: coinRequestLoading ? "#888" : "#1a0a00",
                      fontSize: "15px", fontWeight: "800",
                      cursor: coinRequestLoading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      boxShadow: coinRequestLoading ? "none" : "0 0 20px rgba(255,180,0,0.5)",
                      transition: "all 0.2s",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {coinRequestLoading ? "Submitting…" : (
                      <><FaCoins /> Submit Request ({coinRequestAmount} coins)</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Online Players Panel */}
        <AnimatePresence>
        {showOnlinePlayers && (
          <motion.div
            className="game-online-panel"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            style={{
              position: "fixed",
              top: isMobileLandscape ? "44px" : "clamp(60px,9vh,80px)",
              right: "16px",
              width: isMobileLandscape ? "min(260px, 60vw)" : "clamp(260px,30vw,320px)",
              maxHeight: isMobileLandscape ? `calc(${appVh} - 52px)` : `calc(${appVh} - 100px)`,
              background: "linear-gradient(160deg,#0a2f1f,#1a4d2e)",
              border: "2px solid #ffd700",
              borderRadius: "14px",
              padding: "0",
              zIndex: 150,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(255,215,0,0.15)",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "2px solid rgba(255,215,0,0.3)",
              background: "rgba(255,215,0,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>🟢</span>
                <span style={{ fontWeight: "bold", fontSize: "14px", color: "#ffd700" }}>
                  Online Players
                </span>
                <span style={{
                  background: "#4CAF50", color: "#fff", borderRadius: "12px",
                  padding: "2px 8px", fontSize: "12px", fontWeight: "bold",
                }}>{onlinePlayers.length}</span>
              </div>
              <button
                onClick={() => setShowOnlinePlayers(false)}
                style={{ background: "none", border: "none", color: "#ffd700", fontSize: "18px", cursor: "pointer", lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Player list */}
            <div style={{ overflowY: "auto", flex: 1 }} className="custom-scrollbar">
              {onlinePlayers.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#888", fontSize: "13px" }}>
                  No other players online
                </div>
              ) : (
                onlinePlayers.map((player, index) => (
                  <div
                    key={player.userId || index}
                    ref={(el) => { playerRowRefs.current[(player.userId || '').toString()] = el; }}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                      border: "2px solid #ffd700", overflow: "hidden",
                      background: "linear-gradient(135deg,#2196F3,#9C27B0)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "16px", fontWeight: "bold",
                    }}>
                      {player.profilePicture
                        ? <img src={player.profilePicture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : player.username?.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {player.username}
                      </div>
                      <div style={{ fontSize: "12px", color: "#ffd700", display: "flex", alignItems: "center", gap: "3px" }}>
                        <span>💰</span>
                        <span>{(player.coins ?? 0).toLocaleString()}</span>
                      </div>
                    </div>
                    {/* Online dot */}
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4CAF50", flexShrink: 0 }} />
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* ── GEM COIN FLYING OVERLAY ────────────────────────────── */}
      {flyingCoins.map((fc) => (
        <motion.div
          key={fc.id}
          initial={{ x: fc.fromX - 17, y: fc.fromY - 17, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: fc.toX - 17, y: fc.toY - 17, opacity: [1, 1, 0], scale: [1, 0.82, 0.22], rotate: 18 }}
          transition={{ duration: 0.65, ease: "easeIn" }}
          style={{
            position: "fixed",
            top: 0, left: 0,
            width: "34px", height: "34px",
            borderRadius: "50%",
            background: [
              "radial-gradient(ellipse at 26% 20%, rgba(255,255,255,0.72) 0%, transparent 28%)",
              "linear-gradient(132deg, rgba(255,255,255,0.38) 0%, transparent 36%)",
              "linear-gradient(312deg, rgba(0,0,0,0.28) 0%, transparent 42%)",
              "linear-gradient(202deg, rgba(255,255,255,0.16) 0%, transparent 30%)",
              fc.color,
            ].join(", "),
            border: "2px solid rgba(255,255,255,0.88)",
            boxShadow: `0 0 10px ${fc.color}, 0 0 22px ${fc.color}90, 0 0 0 2.5px ${fc.color}60`,
            zIndex: 9999,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {/* Refraction cut-line */}
          <div style={{
            position: "absolute",
            top: "8%", left: "42%",
            width: "1.5px", height: "52%",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.6), transparent)",
            transform: "rotate(-32deg)",
            borderRadius: "2px",
          }} />
        </motion.div>
      ))}

      {/* ── BAN OVERLAY ── */}
      {userBanned && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.97)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "20px", textAlign: "center",
        }}>
          <div style={{
            maxWidth: "480px", width: "100%",
            background: "linear-gradient(160deg,#1a0000,#2d0000)",
            border: "2px solid #f44336",
            borderRadius: "20px", padding: "40px 32px",
            boxShadow: "0 0 60px rgba(244,67,54,0.4)",
          }}>
            <div style={{ fontSize: "60px", marginBottom: "16px" }}>🚫</div>
            <h1 style={{ color: "#f44336", fontSize: "28px", fontWeight: "900", marginBottom: "12px" }}>
              Account Banned
            </h1>
            <div style={{
              background: "rgba(244,67,54,0.12)", border: "1px solid rgba(244,67,54,0.4)",
              borderRadius: "10px", padding: "14px 18px", marginBottom: "20px",
            }}>
              <p style={{ color: "#ffcdd2", fontSize: "15px", margin: 0, lineHeight: 1.6 }}>
                <strong>Reason:</strong> {userBanReason || "Violation of terms of service"}
              </p>
            </div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", lineHeight: 1.6, marginBottom: "24px" }}>
              Your account has been suspended by the administrator. If you believe this is a mistake, please contact support to appeal.
            </p>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              style={{
                width: "100%", height: "46px",
                background: "linear-gradient(135deg,#ef4444,#b91c1c)",
                border: "none", borderRadius: "12px",
                color: "#fff", fontSize: "15px", fontWeight: "700",
                cursor: "pointer",
              }}
            >Logout</button>
          </div>
        </div>
      )}

      {/* ── GAME STOPPED OVERLAY ── */}
      {gameStopped && gameStatus === "stopped" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 600,
          background: "rgba(0,0,0,0.88)",
          backdropFilter: "blur(8px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "20px", textAlign: "center",
        }}>
          <div style={{
            maxWidth: "440px", width: "100%",
            background: "linear-gradient(160deg,#0f172a,#1e293b)",
            border: "2px solid rgba(251,191,36,0.5)",
            borderRadius: "20px", padding: "40px 32px",
            boxShadow: "0 0 60px rgba(251,191,36,0.15)",
          }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>⏸️</div>
            <h2 style={{ color: "#fbbf24", fontSize: "24px", fontWeight: "900", marginBottom: "12px" }}>
              Game Temporarily Paused
            </h2>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "15px", lineHeight: 1.7, marginBottom: "0" }}>
              The game has been temporarily stopped by the administrator. Please wait — it will resume shortly.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default Game;
