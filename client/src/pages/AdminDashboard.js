import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  FaTachometerAlt, FaUsers, FaCoins, FaGamepad, FaUser,
  FaBars, FaTimes, FaSearch, FaCheck, FaBan, FaUnlock,
  FaSignOutAlt, FaEye, FaEyeSlash, FaCamera, FaKey, FaEdit,
  FaStop, FaPlay, FaSync, FaClock, FaHistory, FaShieldAlt,
  FaExclamationTriangle, FaFilter, FaUserSlash, FaUserCheck,
  FaMoneyBillWave, FaCircle, FaChevronRight, FaTrash
} from 'react-icons/fa';

// ─── Theme ──────────────────────────────────────────────────────────────────
const T = {
  bg:        '#0f172a',
  sidebar:   '#1e293b',
  card:      '#1e293b',
  cardDark:  '#162032',
  border:    '#334155',
  primary:   '#3b82f6',
  primaryHover:'#2563eb',
  success:   '#22c55e',
  warning:   '#f59e0b',
  danger:    '#ef4444',
  text:      '#f1f5f9',
  muted:     '#94a3b8',
  gold:      '#fbbf24',
  purple:    '#a855f7',
};

// ─── Animal display helper ───────────────────────────────────────────────────
const ANIMAL_MAP = {
  monkey:'🐵', rabbit:'🐰', lion:'🦁', panda:'🐼',
  swallow:'🐦', pigeon:'🕊️', peacock:'🦚', eagle:'🦅',
  shark_24x:'🦈', golden_shark_100x:'🦈', take_all:'💀', pay_all:'💰',
};

// ─── Shared sub-components ────────────────────────────────────────────────────
const Badge = ({ label, color }) => (
  <span style={{
    display:'inline-block', padding:'2px 10px', borderRadius:'20px',
    fontSize:'11px', fontWeight:'700', letterSpacing:'0.4px', textTransform:'uppercase',
    background: color + '22', color, border:`1px solid ${color}55`,
  }}>{label}</span>
);

const Card = ({ children, style = {} }) => (
  <div style={{
    background: T.card, border:`1px solid ${T.border}`,
    borderRadius:'14px', padding:'20px', ...style
  }}>{children}</div>
);

const SectionTitle = ({ children }) => (
  <h2 style={{ fontSize:'18px', fontWeight:'700', color: T.text, margin:'0 0 18px', display:'flex', alignItems:'center', gap:'8px' }}>{children}</h2>
);

const StatCard = ({ icon, label, value, color, sub }) => (
  <Card>
    <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
      <div style={{
        width:'50px', height:'50px', borderRadius:'12px', flexShrink:0,
        background: color+'22', display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'22px', color,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize:'13px', color: T.muted, marginBottom:'4px' }}>{label}</div>
        <div style={{ fontSize:'26px', fontWeight:'800', color: T.text, lineHeight:1 }}>{value}</div>
        {sub && <div style={{ fontSize:'12px', color: T.muted, marginTop:'4px' }}>{sub}</div>}
      </div>
    </div>
  </Card>
);

const Btn = ({ children, onClick, color='primary', disabled=false, sm=false, full=false, outline=false, style={} }) => {
  const bg = outline ? 'transparent' : T[color] || T.primary;
  const borderCol = T[color] || T.primary;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: sm ? '32px' : '40px',
        padding: sm ? '0 12px' : '0 18px',
        background: disabled ? '#334155' : bg,
        border: `1.5px solid ${disabled ? T.border : borderCol}`,
        borderRadius:'8px',
        color: disabled ? T.muted : (outline ? borderCol : '#fff'),
        fontSize: sm ? '12px' : '13px',
        fontWeight:'600', cursor: disabled ? 'not-allowed' : 'pointer',
        display:'inline-flex', alignItems:'center', gap:'6px',
        transition:'all 0.15s', whiteSpace:'nowrap',
        width: full ? '100%' : 'auto',
        justifyContent: full ? 'center' : 'flex-start',
        opacity: disabled ? 0.6 : 1, ...style,
      }}
    >{children}</button>
  );
};

const Input = ({ label, value, onChange, type='text', placeholder='', style={} }) => (
  <div style={{ marginBottom:'14px' }}>
    {label && <label style={{ display:'block', fontSize:'13px', color: T.muted, marginBottom:'6px' }}>{label}</label>}
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{
        width:'100%', height:'40px', background:'#0f172a',
        border:`1.5px solid ${T.border}`, borderRadius:'8px',
        padding:'0 12px', color: T.text, fontSize:'14px',
        outline:'none', boxSizing:'border-box', ...style,
      }}
    />
  </div>
);

const Modal = ({ title, onClose, children, width='480px' }) => (
  <div style={{
    position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
    backdropFilter:'blur(4px)', zIndex:1000,
    display:'flex', alignItems:'center', justifyContent:'center', padding:'16px',
  }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{
      width:`min(${width},95vw)`, background: T.sidebar,
      border:`1.5px solid ${T.border}`, borderRadius:'16px',
      padding:'24px', position:'relative',
      boxShadow:'0 25px 60px rgba(0,0,0,0.6)',
      maxHeight:'90vh', overflowY:'auto',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h3 style={{ margin:0, fontSize:'17px', fontWeight:'700', color: T.text }}>{title}</h3>
        <button onClick={onClose} style={{ background:'none', border:'none', color: T.muted, fontSize:'18px', cursor:'pointer', lineHeight:1 }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const avatarEl = (u, size=36) => (
  <div style={{
    width:`${size}px`, height:`${size}px`, borderRadius:'50%', flexShrink:0,
    background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',
    border:`2px solid ${T.border}`, overflow:'hidden',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:`${Math.round(size*0.42)}px`, fontWeight:'bold', color:'#fff',
  }}>
    {u?.profilePicture
      ? <img src={u.profilePicture} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      : (u?.username?.charAt(0)?.toUpperCase() || '?')
    }
  </div>
);

const BAN_REASONS = [
  'Cheating / Unfair play',
  'Suspicious betting patterns',
  'Account sharing',
  'Abusive / offensive behavior',
  'Multiple accounts violation',
  'Other (specify below)',
];

const STATUS_COLOR = { pending: T.warning, approved: T.success, rejected: T.danger };

const resultDisplayName = (r) => {
  const map = { monkey:'Monkey',rabbit:'Rabbit',lion:'Lion',panda:'Panda',swallow:'Swallow',pigeon:'Pigeon',peacock:'Peacock',eagle:'Eagle',shark_24x:'Shark 24x',golden_shark_100x:'Golden Shark 100x',take_all:'Take All',pay_all:'Pay All' };
  return map[r] || r?.replace(/_/g,' ').toUpperCase() || r;
};

// ─── Main Component ──────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { user, token, logout, updateUser } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [section, setSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [coinRequests, setCoinRequests] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [gameStopped, setGameStopped] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Player section
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [banModal, setBanModal] = useState(null);
  const [selectedBanReason, setSelectedBanReason] = useState('');
  const [customBanReason, setCustomBanReason] = useState('');
  const [addCoinsModal, setAddCoinsModal] = useState(null);
  const [addCoinsAmount, setAddCoinsAmount] = useState('');
  const [addCoinsReason, setAddCoinsReason] = useState('');

  // Coin requests section
  const [requestStatus, setRequestStatus] = useState('pending');
  const [requestDateFrom, setRequestDateFrom] = useState('');
  const [requestDateTo, setRequestDateTo] = useState('');
  const [requestSearch, setRequestSearch] = useState('');

  // Game control
  const [stopModal, setStopModal] = useState(false);
  const [stopPassword, setStopPassword] = useState('');
  const [showStopPw, setShowStopPw] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);

  // Profile
  const picInputRef = useRef(null);
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurPw, setShowCurPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const ah = { Authorization: `Bearer ${token}` };

  // ─── Data fetchers ────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data } = await axios.get('/api/admin/stats', { headers: ah });
      if (data.success) { setStats(data.stats); setGameStopped(data.stats.gameStopped); }
    } catch { toast.error('Failed to load stats'); }
    finally { setLoadingStats(false); }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data } = await axios.get('/api/admin/users', { headers: ah });
      if (data.success) setUsers(data.users);
    } catch { toast.error('Failed to load users'); }
    finally { setLoadingUsers(false); }
  }, [token]);

  const fetchCoinRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const params = {};
      if (requestStatus !== 'all') params.status = requestStatus;
      if (requestDateFrom) params.dateFrom = requestDateFrom;
      if (requestDateTo) params.dateTo = requestDateTo;
      if (requestSearch) params.search = requestSearch;
      const { data } = await axios.get('/api/admin/coin-requests', { headers: ah, params });
      if (data.success) setCoinRequests(data.requests);
    } catch { toast.error('Failed to load requests'); }
    finally { setLoadingRequests(false); }
  }, [token, requestStatus, requestDateFrom, requestDateTo, requestSearch]);

  const fetchGameHistory = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/game-history', { headers: ah });
      if (data.success) setGameHistory(data.results);
    } catch { /* silent */ }
  }, [token]);

  const fetchGameStatus = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/game/status', { headers: ah });
      if (data.success) { setGameStopped(data.gameStopped); setOnlineCount(data.onlineCount); }
    } catch { /* silent */ }
  }, [token]);

  // ─── Load on section change ───────────────────────────────────────────────
  useEffect(() => {
    if (section === 'dashboard') { fetchStats(); fetchGameHistory(); }
    if (section === 'players') fetchUsers();
    if (section === 'requests') fetchCoinRequests();
    if (section === 'game') { fetchGameStatus(); fetchGameHistory(); }
  }, [section]);

  useEffect(() => {
    if (section === 'requests') fetchCoinRequests();
  }, [requestStatus, requestDateFrom, requestDateTo]);

  // ─── Profile init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) { setProfileUsername(user.username || ''); setProfilePicPreview(user.profilePicture || null); }
  }, [user]);

  // Auto-refresh stats on dashboard every 15s
  useEffect(() => {
    if (section !== 'dashboard') return;
    const id = setInterval(fetchStats, 15000);
    return () => clearInterval(id);
  }, [section, fetchStats]);

  // ─── Socket handlers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.on('online-players', (data) => {
      setOnlineCount(Array.isArray(data?.players) ? data.players.length : 0);
    });
    socket.on('history-update', (results) => {
      const rev = [...results].reverse().slice(0, 25);
      setGameHistory([...results]);
    });
    socket.on('game-stopped', () => setGameStopped(true));
    socket.on('game-resumed', () => setGameStopped(false));
    socket.on('game-state', (s) => {
      if (s.gameStopped !== undefined) setGameStopped(s.gameStopped);
    });
    return () => {
      socket.off('online-players');
      socket.off('history-update');
      socket.off('game-stopped');
      socket.off('game-resumed');
      socket.off('game-state');
    };
  }, [socket]);

  // ─── Filtered users ───────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!u.username?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
    }
    if (userFilter === 'online' && !u.isOnline) return false;
    if (userFilter === 'offline' && u.isOnline) return false;
    if (userFilter === 'banned' && !u.isBanned) return false;
    if (userFilter === 'active' && u.isBanned) return false;
    return true;
  });

  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleBan = async () => {
    const reason = selectedBanReason === 'Other (specify below)' ? customBanReason : selectedBanReason;
    if (!reason?.trim()) { toast.error('Select or enter a ban reason'); return; }
    try {
      await axios.post(`/api/admin/users/${banModal._id}/ban`, { banReason: reason }, { headers: ah });
      toast.success(`${banModal.username} banned`);
      setBanModal(null); setSelectedBanReason(''); setCustomBanReason('');
      fetchUsers();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to ban'); }
  };

  const handleUnban = async (userId, username) => {
    try {
      await axios.post(`/api/admin/users/${userId}/unban`, {}, { headers: ah });
      toast.success(`${username} unbanned`);
      fetchUsers();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to unban'); }
  };

  const handleAddCoins = async () => {
    const amt = parseInt(addCoinsAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!addCoinsReason.trim()) { toast.error('Enter a reason'); return; }
    try {
      await axios.post('/api/admin/add-coins', { userId: addCoinsModal._id, amount: amt, reason: addCoinsReason }, { headers: ah });
      toast.success(`${amt} coins added to ${addCoinsModal.username}`);
      setAddCoinsModal(null); setAddCoinsAmount(''); setAddCoinsReason('');
      fetchUsers();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to add coins'); }
  };

  const handleProcessRequest = async (requestId, status, note = '') => {
    try {
      await axios.post(`/api/admin/coin-requests/${requestId}/process`, { status, adminNote: note || (status === 'approved' ? 'Approved by admin' : 'Rejected by admin') }, { headers: ah });
      toast.success(`Request ${status}`);
      fetchCoinRequests();
      if (section === 'dashboard') fetchStats();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const handleStopGame = async () => {
    if (!stopPassword) { toast.error('Enter your password'); return; }
    setStopLoading(true);
    try {
      await axios.post('/api/admin/game/stop', { password: stopPassword }, { headers: ah });
      toast.success('Game stopped');
      setStopModal(false); setStopPassword('');
      setGameStopped(true);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to stop game'); }
    finally { setStopLoading(false); }
  };

  const handleResumeGame = async () => {
    try {
      await axios.post('/api/admin/game/resume', {}, { headers: ah });
      toast.success('Game resumed');
      setGameStopped(false);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to resume game'); }
  };

  const handleSaveProfile = async () => {
    if (!profileUsername.trim()) { toast.error('Username cannot be empty'); return; }
    setProfileSaving(true);
    try {
      const { data } = await axios.put('/api/admin/profile', { username: profileUsername.trim(), profilePicture: profilePicPreview }, { headers: ah });
      updateUser({ username: data.user.username, profilePicture: data.user.profilePicture });
      toast.success('Profile updated');
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setProfileSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!curPw || !newPw || !confirmPw) { toast.error('Fill all password fields'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    if (newPw.length < 6) { toast.error('Min 6 characters'); return; }
    setProfileSaving(true);
    try {
      await axios.put('/api/admin/profile', { currentPassword: curPw, newPassword: newPw }, { headers: ah });
      toast.success('Password changed');
      setCurPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setProfileSaving(false); }
  };

  const handlePicChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setProfilePicPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // ─── Sections ─────────────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'16px', marginBottom:'24px' }}>
        <StatCard icon={<FaUsers />} label="Total Players" value={stats?.totalUsers ?? '—'} color={T.primary} />
        <StatCard icon={<FaCircle />} label="Online Now" value={stats?.onlineCount ?? '—'} color={T.success} sub="Active sessions" />
        <StatCard icon={<FaCoins />} label="Pending Requests" value={stats?.pendingRequests ?? '—'} color={T.warning} />
        <StatCard icon={<FaUserSlash />} label="Banned Accounts" value={stats?.bannedCount ?? '—'} color={T.danger} />
        <StatCard icon={<FaMoneyBillWave />} label="Total Coins" value={stats?.totalCoins ? stats.totalCoins.toLocaleString() : '—'} color={T.gold} sub="In circulation" />
        <StatCard
          icon={gameStopped ? <FaStop /> : <FaPlay />}
          label="Game Status"
          value={gameStopped ? 'Stopped' : 'Running'}
          color={gameStopped ? T.danger : T.success}
        />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
        <Card>
          <SectionTitle><FaCoins style={{ color: T.warning }} /> Pending Coin Requests</SectionTitle>
          {!stats ? (
            <p style={{ color: T.muted, textAlign:'center', padding:'20px 0' }}>Loading…</p>
          ) : stats.pendingRequests === 0 ? (
            <p style={{ color: T.muted, textAlign:'center', padding:'20px 0' }}>No pending requests</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {coinRequests.filter(r => r.status === 'pending').slice(0,5).map(r => (
                <div key={r._id} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 14px', borderRadius:'10px',
                  background: T.bg, border:`1px solid ${T.border}`, gap:'8px',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:0 }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:T.warning+'22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <FaUser style={{ color: T.warning, fontSize:'13px' }} />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:'13px', fontWeight:'600', color: T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.username}</div>
                      <div style={{ fontSize:'12px', color: T.muted }}>{r.requestedAmount} coins</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    <Btn sm color="success" onClick={() => handleProcessRequest(r._id,'approved')}><FaCheck /></Btn>
                    <Btn sm color="danger" onClick={() => handleProcessRequest(r._id,'rejected')}><FaTimes /></Btn>
                  </div>
                </div>
              ))}
              {stats.pendingRequests > 5 && (
                <button onClick={() => setSection('requests')}
                  style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:'8px', padding:'8px', color: T.primary, fontSize:'13px', cursor:'pointer', textAlign:'center' }}>
                  View all {stats.pendingRequests} pending →
                </button>
              )}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle><FaHistory style={{ color: T.purple }} /> Last 10 Results</SectionTitle>
          {gameHistory.length === 0 ? (
            <p style={{ color: T.muted, textAlign:'center', padding:'20px 0' }}>No results yet</p>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px' }}>
              {[...gameHistory].reverse().slice(0,10).map((r, i) => (
                <div key={i} style={{
                  background: T.bg, border:`1px solid ${T.border}`, borderRadius:'8px',
                  padding:'8px 4px', textAlign:'center',
                }}>
                  <div style={{ fontSize:'22px' }}>{ANIMAL_MAP[r.result] || '🎰'}</div>
                  <div style={{ fontSize:'10px', color: T.muted, marginTop:'2px' }}>
                    ×{r.winningMultiplier ?? r.multiplier ?? 0}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  const renderPlayers = () => (
    <div>
      {/* Filters */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1', minWidth:'200px' }}>
          <FaSearch style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color: T.muted, fontSize:'13px' }} />
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by username or email…"
            style={{ width:'100%', height:'40px', paddingLeft:'36px', paddingRight:'12px', background: T.cardDark, border:`1.5px solid ${T.border}`, borderRadius:'8px', color: T.text, fontSize:'13px', outline:'none', boxSizing:'border-box' }}
          />
        </div>
        {['all','online','offline','active','banned'].map(f => (
          <button key={f} onClick={() => setUserFilter(f)} style={{
            height:'36px', padding:'0 14px', borderRadius:'8px', cursor:'pointer',
            background: userFilter === f ? T.primary : 'transparent',
            border:`1.5px solid ${userFilter === f ? T.primary : T.border}`,
            color: userFilter === f ? '#fff' : T.muted, fontSize:'12px', fontWeight:'600',
            textTransform:'capitalize', transition:'all 0.15s',
          }}>{f}</button>
        ))}
        <Btn onClick={fetchUsers} outline sm><FaSync /> Refresh</Btn>
      </div>

      <div style={{ fontSize:'13px', color: T.muted, marginBottom:'12px' }}>
        Showing {filteredUsers.length} of {users.length} players
      </div>

      {loadingUsers ? (
        <div style={{ textAlign:'center', padding:'40px', color: T.muted }}>Loading players…</div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', color: T.muted }}>No players found</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filteredUsers.map(u => (
            <div key={u._id} style={{
              background: T.card, border:`1px solid ${u.isBanned ? T.danger+'44' : T.border}`,
              borderRadius:'12px', padding:'14px 16px',
              display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap',
            }}>
              {avatarEl(u, 44)}
              <div style={{ flex:'1', minWidth:'160px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'15px', fontWeight:'700', color: T.text }}>{u.username}</span>
                  {u.isOnline && <Badge label="Online" color={T.success} />}
                  {u.isBanned && <Badge label="Banned" color={T.danger} />}
                </div>
                <div style={{ fontSize:'12px', color: T.muted, marginTop:'3px' }}>{u.email}</div>
                {u.isBanned && u.banReason && (
                  <div style={{ fontSize:'11px', color: T.danger, marginTop:'3px' }}>Ban: {u.banReason}</div>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                <div style={{ textAlign:'center', margin:'0 8px' }}>
                  <div style={{ fontSize:'16px', fontWeight:'800', color: T.gold }}>{u.coins?.toLocaleString()}</div>
                  <div style={{ fontSize:'10px', color: T.muted }}>coins</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <Btn sm color="primary" onClick={() => { setAddCoinsModal(u); setAddCoinsAmount(''); setAddCoinsReason(''); }}>
                  <FaCoins /> Add Coins
                </Btn>
                {u.isBanned ? (
                  <Btn sm color="success" onClick={() => handleUnban(u._id, u.username)}>
                    <FaUnlock /> Unban
                  </Btn>
                ) : (
                  <Btn sm color="danger" onClick={() => { setBanModal(u); setSelectedBanReason(''); setCustomBanReason(''); }}>
                    <FaBan /> Ban
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCoinRequests = () => (
    <div>
      {/* Filters */}
      <Card style={{ marginBottom:'16px', padding:'16px' }}>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label style={{ display:'block', fontSize:'12px', color: T.muted, marginBottom:'5px' }}>Status</label>
            <select value={requestStatus} onChange={e => setRequestStatus(e.target.value)}
              style={{ height:'38px', padding:'0 12px', background: T.bg, border:`1.5px solid ${T.border}`, borderRadius:'8px', color: T.text, fontSize:'13px', cursor:'pointer' }}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'12px', color: T.muted, marginBottom:'5px' }}>From</label>
            <input type="date" value={requestDateFrom} onChange={e => setRequestDateFrom(e.target.value)}
              style={{ height:'38px', padding:'0 10px', background: T.bg, border:`1.5px solid ${T.border}`, borderRadius:'8px', color: T.text, fontSize:'13px' }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'12px', color: T.muted, marginBottom:'5px' }}>To</label>
            <input type="date" value={requestDateTo} onChange={e => setRequestDateTo(e.target.value)}
              style={{ height:'38px', padding:'0 10px', background: T.bg, border:`1.5px solid ${T.border}`, borderRadius:'8px', color: T.text, fontSize:'13px' }} />
          </div>
          <div style={{ flex:'1', minWidth:'180px' }}>
            <label style={{ display:'block', fontSize:'12px', color: T.muted, marginBottom:'5px' }}>Search User</label>
            <div style={{ position:'relative' }}>
              <FaSearch style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color: T.muted, fontSize:'12px' }} />
              <input value={requestSearch} onChange={e => setRequestSearch(e.target.value)}
                placeholder="Username or email…"
                style={{ width:'100%', height:'38px', paddingLeft:'32px', paddingRight:'10px', background: T.bg, border:`1.5px solid ${T.border}`, borderRadius:'8px', color: T.text, fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
            </div>
          </div>
          <Btn onClick={fetchCoinRequests}><FaSync /> Apply</Btn>
          <Btn outline onClick={() => { setRequestStatus('all'); setRequestDateFrom(''); setRequestDateTo(''); setRequestSearch(''); setTimeout(fetchCoinRequests, 0); }}>Clear</Btn>
        </div>
      </Card>

      <div style={{ fontSize:'13px', color: T.muted, marginBottom:'12px' }}>{coinRequests.length} requests</div>

      {loadingRequests ? (
        <div style={{ textAlign:'center', padding:'40px', color: T.muted }}>Loading…</div>
      ) : coinRequests.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', color: T.muted }}>No requests found</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {coinRequests.map(r => (
            <div key={r._id} style={{
              background: T.card, border:`1px solid ${T.border}`, borderRadius:'12px', padding:'14px 16px',
              display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap',
            }}>
              <div style={{ width:'38px', height:'38px', borderRadius:'50%', background: T.primary+'22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <FaUser style={{ color: T.primary, fontSize:'14px' }} />
              </div>
              <div style={{ flex:'1', minWidth:'160px' }}>
                <div style={{ fontSize:'14px', fontWeight:'600', color: T.text }}>{r.username}</div>
                <div style={{ fontSize:'12px', color: T.muted }}>{r.email}</div>
                {r.adminNote && <div style={{ fontSize:'11px', color: T.muted, marginTop:'3px' }}>Note: {r.adminNote}</div>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'18px', fontWeight:'800', color: T.gold }}>{r.requestedAmount}</div>
                  <div style={{ fontSize:'10px', color: T.muted }}>coins</div>
                </div>
              </div>
              <div style={{ flexShrink:0 }}>
                <Badge label={r.status} color={STATUS_COLOR[r.status] || T.muted} />
              </div>
              <div style={{ fontSize:'12px', color: T.muted, flexShrink:0 }}>
                {new Date(r.createdAt).toLocaleDateString()}
              </div>
              {r.status === 'pending' && (
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <Btn sm color="success" onClick={() => handleProcessRequest(r._id,'approved')}><FaCheck /> Approve</Btn>
                  <Btn sm color="danger" onClick={() => handleProcessRequest(r._id,'rejected')}><FaTimes /> Reject</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderGameControl = () => (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'24px' }}>
        <Card style={{ borderColor: gameStopped ? T.danger+'55' : T.success+'55' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
            <div style={{
              width:'60px', height:'60px', borderRadius:'16px',
              background: (gameStopped ? T.danger : T.success)+'22',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'28px',
            }}>
              {gameStopped ? '🛑' : '▶️'}
            </div>
            <div>
              <div style={{ fontSize:'13px', color: T.muted, marginBottom:'4px' }}>Game Status</div>
              <div style={{ fontSize:'24px', fontWeight:'800', color: gameStopped ? T.danger : T.success }}>
                {gameStopped ? 'STOPPED' : 'RUNNING'}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            {!gameStopped ? (
              <Btn full color="danger" onClick={() => setStopModal(true)}><FaStop /> Stop Game</Btn>
            ) : (
              <Btn full color="success" onClick={handleResumeGame}><FaPlay /> Resume Game</Btn>
            )}
          </div>
          <p style={{ fontSize:'12px', color: T.muted, marginTop:'12px', marginBottom:0, lineHeight:1.6 }}>
            {gameStopped
              ? 'Game is currently stopped. All users see a pause screen.'
              : 'Game is running. Players can place bets and spin.'}
          </p>
        </Card>

        <Card>
          <SectionTitle><FaCircle style={{ color: T.success, fontSize:'12px' }} /> Live Stats</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color: T.muted, fontSize:'13px' }}>Players Online</span>
              <span style={{ color: T.success, fontWeight:'700', fontSize:'18px' }}>{onlineCount || stats?.onlineCount || 0}</span>
            </div>
            <div style={{ height:'1px', background: T.border }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color: T.muted, fontSize:'13px' }}>Total Players</span>
              <span style={{ color: T.text, fontWeight:'700', fontSize:'16px' }}>{stats?.totalUsers || 0}</span>
            </div>
            <div style={{ height:'1px', background: T.border }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color: T.muted, fontSize:'13px' }}>Pending Requests</span>
              <span style={{ color: T.warning, fontWeight:'700', fontSize:'16px' }}>{stats?.pendingRequests || 0}</span>
            </div>
          </div>
          <div style={{ marginTop:'16px' }}>
            <Btn full outline onClick={() => { fetchGameStatus(); fetchStats(); }}><FaSync /> Refresh</Btn>
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <SectionTitle style={{ margin:0 }}><FaHistory style={{ color: T.purple }} /> Last 25 Game Results</SectionTitle>
          <Btn sm outline onClick={fetchGameHistory}><FaSync /></Btn>
        </div>
        {gameHistory.length === 0 ? (
          <p style={{ color: T.muted, textAlign:'center', padding:'20px 0' }}>No results yet</p>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))', gap:'8px' }}>
            {[...gameHistory].reverse().map((r, i) => (
              <div key={i} style={{
                background: T.bg, border:`1px solid ${T.border}`, borderRadius:'10px',
                padding:'10px 6px', textAlign:'center',
              }}>
                <div style={{ fontSize:'26px', marginBottom:'4px' }}>{ANIMAL_MAP[r.result] || '🎰'}</div>
                <div style={{ fontSize:'10px', color: T.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {resultDisplayName(r.result)}
                </div>
                <div style={{ fontSize:'11px', fontWeight:'700', color: T.gold, marginTop:'2px' }}>
                  ×{r.winningMultiplier ?? r.multiplier ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  const renderProfile = () => (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', alignItems:'start' }}>
      <Card>
        <SectionTitle><FaCamera style={{ color: T.primary }} /> Profile Picture & Username</SectionTitle>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'20px', gap:'12px' }}>
          <div style={{ position:'relative' }}>
            <div style={{
              width:'90px', height:'90px', borderRadius:'50%',
              background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',
              border:`3px solid ${T.primary}`, overflow:'hidden',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'36px', fontWeight:'bold', color:'#fff',
            }}>
              {profilePicPreview
                ? <img src={profilePicPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : user?.username?.charAt(0)?.toUpperCase()
              }
            </div>
            <button onClick={() => picInputRef.current?.click()} style={{
              position:'absolute', bottom:0, right:0, width:'28px', height:'28px', borderRadius:'50%',
              background: T.primary, border:`2px solid ${T.sidebar}`, color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', fontSize:'11px',
            }}><FaCamera /></button>
          </div>
          <input ref={picInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePicChange} />
          {profilePicPreview !== user?.profilePicture && (
            <div style={{ display:'flex', gap:'8px' }}>
              <Btn sm color="success" onClick={handleSaveProfile} disabled={profileSaving}>
                <FaCheck /> Save Picture
              </Btn>
              <Btn sm outline onClick={() => setProfilePicPreview(user?.profilePicture || null)}>
                Cancel
              </Btn>
            </div>
          )}
        </div>

        <Input label="Display Name" value={profileUsername} onChange={e => setProfileUsername(e.target.value)} />
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'4px', marginBottom:'14px' }}>
          <span style={{ fontSize:'12px', color: T.muted }}>Email:</span>
          <span style={{ fontSize:'13px', color: T.text }}>{user?.email}</span>
        </div>
        <Btn full color="primary" onClick={handleSaveProfile} disabled={profileSaving}>
          <FaEdit /> {profileSaving ? 'Saving…' : 'Save Changes'}
        </Btn>
      </Card>

      <Card>
        <SectionTitle><FaKey style={{ color: T.warning }} /> Change Password</SectionTitle>
        <div style={{ position:'relative', marginBottom:'14px' }}>
          <label style={{ display:'block', fontSize:'13px', color: T.muted, marginBottom:'6px' }}>Current Password</label>
          <div style={{ position:'relative' }}>
            <input type={showCurPw ? 'text' : 'password'} value={curPw} onChange={e => setCurPw(e.target.value)}
              style={{ width:'100%', height:'40px', background:'#0f172a', border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'0 40px 0 12px', color: T.text, fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
            <button onClick={() => setShowCurPw(v => !v)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color: T.muted, cursor:'pointer', fontSize:'14px' }}>
              {showCurPw ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>
        <div style={{ marginBottom:'14px' }}>
          <label style={{ display:'block', fontSize:'13px', color: T.muted, marginBottom:'6px' }}>New Password</label>
          <div style={{ position:'relative' }}>
            <input type={showNewPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
              style={{ width:'100%', height:'40px', background:'#0f172a', border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'0 40px 0 12px', color: T.text, fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
            <button onClick={() => setShowNewPw(v => !v)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color: T.muted, cursor:'pointer', fontSize:'14px' }}>
              {showNewPw ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>
        <div style={{ marginBottom:'20px' }}>
          <label style={{ display:'block', fontSize:'13px', color: T.muted, marginBottom:'6px' }}>Confirm New Password</label>
          <div style={{ position:'relative' }}>
            <input type={showConfirmPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              style={{ width:'100%', height:'40px', background:'#0f172a', border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'0 40px 0 12px', color: T.text, fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
            <button onClick={() => setShowConfirmPw(v => !v)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color: T.muted, cursor:'pointer', fontSize:'14px' }}>
              {showConfirmPw ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>
        <Btn full color="warning" onClick={handleChangePassword} disabled={profileSaving}>
          <FaKey /> {profileSaving ? 'Saving…' : 'Change Password'}
        </Btn>
      </Card>
    </div>
  );

  // ─── Nav items ────────────────────────────────────────────────────────────
  const navItems = [
    { id:'dashboard', icon: FaTachometerAlt, label:'Dashboard' },
    { id:'players',   icon: FaUsers,         label:'Players' },
    { id:'requests',  icon: FaCoins,         label:'Coin Requests', badge: stats?.pendingRequests },
    { id:'game',      icon: FaGamepad,       label:'Game Control' },
    { id:'profile',   icon: FaUser,          label:'My Profile' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', height:'100vh', width:'100vw', background: T.bg, color: T.text, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', overflow:'hidden' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:49, display:'block' }}
          className="md-sidebar-overlay"
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width:'220px', flexShrink:0, background: T.sidebar,
        borderRight:`1px solid ${T.border}`,
        display:'flex', flexDirection:'column',
        position:'fixed', top:0, left:0, height:'100%', zIndex:50,
        transform: sidebarOpen ? 'translateX(0)' : undefined,
        transition:'transform 0.25s',
      }} className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Logo */}
        <div style={{ padding:'20px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'10px', background: T.primary, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>
            🐾
          </div>
          <div>
            <div style={{ fontSize:'14px', fontWeight:'800', color: T.text }}>Animal Battle</div>
            <div style={{ fontSize:'11px', color: T.muted }}>Admin Panel</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background:'none', border:'none', color: T.muted, cursor:'pointer', marginLeft:'auto', display:'none' }} className="sidebar-close-btn">
            <FaTimes />
          </button>
        </div>

        {/* Admin info */}
        <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:'10px' }}>
          {avatarEl(user, 38)}
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:'13px', fontWeight:'700', color: T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.username}</div>
            <div style={{ fontSize:'11px', color: T.primary }}>Administrator</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => { setSection(item.id); setSidebarOpen(false); }}
                style={{
                  width:'100%', height:'42px', display:'flex', alignItems:'center', gap:'10px',
                  padding:'0 12px', borderRadius:'10px', cursor:'pointer', marginBottom:'4px',
                  background: active ? T.primary+'22' : 'transparent',
                  border: `1.5px solid ${active ? T.primary+'55' : 'transparent'}`,
                  color: active ? T.primary : T.muted,
                  fontSize:'13px', fontWeight: active ? '700' : '500',
                  textAlign:'left', transition:'all 0.15s', position:'relative',
                }}>
                <Icon style={{ fontSize:'15px', flexShrink:0 }} />
                <span style={{ flex:1 }}>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{
                    background: T.warning, color:'#000', borderRadius:'10px',
                    padding:'1px 7px', fontSize:'11px', fontWeight:'800',
                  }}>{item.badge}</span>
                )}
                {active && <FaChevronRight style={{ fontSize:'10px' }} />}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding:'12px 8px', borderTop:`1px solid ${T.border}` }}>
          <button onClick={() => { logout(); navigate('/login'); }}
            style={{
              width:'100%', height:'40px', display:'flex', alignItems:'center', gap:'10px',
              padding:'0 12px', borderRadius:'10px', cursor:'pointer',
              background:'transparent', border:`1.5px solid ${T.danger}44`,
              color: T.danger, fontSize:'13px', fontWeight:'600',
            }}>
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', marginLeft:'220px', overflow:'hidden', minWidth:0 }} className="admin-main">

        {/* Header */}
        <header style={{
          height:'58px', borderBottom:`1px solid ${T.border}`,
          background: T.sidebar+'cc', backdropFilter:'blur(8px)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 24px', flexShrink:0, gap:'12px',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={() => setSidebarOpen(true)}
              style={{ background:'none', border:'none', color: T.muted, cursor:'pointer', fontSize:'18px', display:'none', padding:'4px' }}
              className="hamburger-btn">
              <FaBars />
            </button>
            <div>
              <div style={{ fontSize:'16px', fontWeight:'700', color: T.text, textTransform:'capitalize' }}>
                {navItems.find(n => n.id === section)?.label || section}
              </div>
              <div style={{ fontSize:'11px', color: T.muted }}>
                {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            {loadingStats && <div style={{ fontSize:'12px', color: T.muted }}>Refreshing…</div>}
            <div style={{
              display:'flex', alignItems:'center', gap:'6px', padding:'4px 10px',
              background: (gameStopped ? T.danger : T.success)+'22',
              border:`1px solid ${(gameStopped ? T.danger : T.success)+'44'}`,
              borderRadius:'20px',
            }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'50%', background: gameStopped ? T.danger : T.success }} />
              <span style={{ fontSize:'12px', color: gameStopped ? T.danger : T.success, fontWeight:'600' }}>
                {gameStopped ? 'Stopped' : 'Live'}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex:1, overflowY:'auto', padding:'24px' }}>
          {section === 'dashboard' && renderDashboard()}
          {section === 'players'   && renderPlayers()}
          {section === 'requests'  && renderCoinRequests()}
          {section === 'game'      && renderGameControl()}
          {section === 'profile'   && renderProfile()}
        </main>
      </div>

      {/* ── Ban Modal ── */}
      {banModal && (
        <Modal title={`Ban: ${banModal.username}`} onClose={() => setBanModal(null)}>
          <p style={{ color: T.muted, fontSize:'13px', marginBottom:'16px', marginTop:0 }}>
            Select a reason. The user will be notified by email and immediately disconnected.
            They can contact you to appeal.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
            {BAN_REASONS.map(reason => (
              <button key={reason} onClick={() => setSelectedBanReason(reason)}
                style={{
                  height:'40px', padding:'0 14px', borderRadius:'8px', cursor:'pointer', textAlign:'left',
                  background: selectedBanReason === reason ? T.danger+'22' : T.bg,
                  border:`1.5px solid ${selectedBanReason === reason ? T.danger : T.border}`,
                  color: selectedBanReason === reason ? T.danger : T.text, fontSize:'13px', fontWeight:'500',
                }}>
                {reason}
              </button>
            ))}
          </div>
          {selectedBanReason === 'Other (specify below)' && (
            <input value={customBanReason} onChange={e => setCustomBanReason(e.target.value)}
              placeholder="Enter custom reason…"
              style={{ width:'100%', height:'40px', background: T.bg, border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'0 12px', color: T.text, fontSize:'13px', marginBottom:'16px', boxSizing:'border-box', outline:'none' }} />
          )}
          <div style={{ display:'flex', gap:'10px' }}>
            <Btn full color="danger" onClick={handleBan} disabled={!selectedBanReason || (selectedBanReason === 'Other (specify below)' && !customBanReason.trim())}>
              <FaBan /> Confirm Ban
            </Btn>
            <Btn full outline onClick={() => setBanModal(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* ── Add Coins Modal ── */}
      {addCoinsModal && (
        <Modal title={`Add Coins: ${addCoinsModal.username}`} onClose={() => setAddCoinsModal(null)} width="400px">
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', padding:'12px', background: T.bg, borderRadius:'10px', border:`1px solid ${T.border}` }}>
            {avatarEl(addCoinsModal, 42)}
            <div>
              <div style={{ fontWeight:'700', color: T.text }}>{addCoinsModal.username}</div>
              <div style={{ fontSize:'12px', color: T.muted }}>{addCoinsModal.email}</div>
              <div style={{ fontSize:'13px', color: T.gold, fontWeight:'700', marginTop:'2px' }}>
                {addCoinsModal.coins?.toLocaleString()} coins
              </div>
            </div>
          </div>
          <Input label="Amount to Add" value={addCoinsAmount} onChange={e => setAddCoinsAmount(e.target.value)} type="number" placeholder="e.g. 500" />
          <Input label="Reason" value={addCoinsReason} onChange={e => setAddCoinsReason(e.target.value)} placeholder="e.g. Welcome bonus" />
          <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
            <Btn full color="success" onClick={handleAddCoins}><FaCoins /> Add Coins</Btn>
            <Btn full outline onClick={() => setAddCoinsModal(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* ── Stop Game Modal ── */}
      {stopModal && (
        <Modal title="⚠️ Stop the Game" onClose={() => { setStopModal(false); setStopPassword(''); }} width="420px">
          <div style={{ background: T.danger+'11', border:`1px solid ${T.danger}33`, borderRadius:'10px', padding:'14px', marginBottom:'20px' }}>
            <p style={{ color:T.danger, fontSize:'13px', margin:0, lineHeight:1.6 }}>
              <strong>Warning:</strong> All players will see a "Game Paused" screen immediately after the current round finishes. New bets will be blocked until you resume.
            </p>
          </div>
          <div style={{ marginBottom:'16px' }}>
            <label style={{ display:'block', fontSize:'13px', color: T.muted, marginBottom:'6px' }}>
              Enter your admin password to confirm:
            </label>
            <div style={{ position:'relative' }}>
              <input
                type={showStopPw ? 'text' : 'password'}
                value={stopPassword} onChange={e => setStopPassword(e.target.value)}
                placeholder="Your password"
                onKeyDown={e => e.key === 'Enter' && handleStopGame()}
                style={{ width:'100%', height:'42px', background: T.bg, border:`1.5px solid ${T.border}`, borderRadius:'8px', padding:'0 42px 0 12px', color: T.text, fontSize:'14px', outline:'none', boxSizing:'border-box' }}
              />
              <button onClick={() => setShowStopPw(v => !v)}
                style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color: T.muted, cursor:'pointer', fontSize:'14px' }}>
                {showStopPw ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <Btn full color="danger" onClick={handleStopGame} disabled={!stopPassword || stopLoading}>
              <FaStop /> {stopLoading ? 'Stopping…' : 'Stop Game'}
            </Btn>
            <Btn full outline onClick={() => { setStopModal(false); setStopPassword(''); }}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* ── Responsive CSS ── */}
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { transform: translateX(-100%); }
          .admin-sidebar.open { transform: translateX(0) !important; }
          .admin-main { margin-left: 0 !important; }
          .hamburger-btn { display: flex !important; }
          .sidebar-close-btn { display: flex !important; }
        }
        @media (max-width: 640px) {
          .admin-main main { padding: 14px !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
