import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [lastResults, setLastResults] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token, user } = useAuth();
  
  const socketRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!token || !user) return;

    const connectSocket = () => {
      if (socketRef.current?.connected) return;

      const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });
      
      socketRef.current = newSocket;

      newSocket.on('connect', () => {
        console.log('🔌 Socket connected:', newSocket.id);
        setIsConnected(true);
        reconnectAttempts.current = 0;
        newSocket.emit('authenticate', token);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
        reconnectAttempts.current++;
        
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('Max reconnection attempts reached');
          newSocket.close();
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Reconnect manually if server disconnected
          setTimeout(() => {
            newSocket.connect();
          }, 1000);
        }
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
        // Re-authenticate after reconnect
        newSocket.emit('authenticate', token);
      });

      newSocket.on('online-players', (data) => {
        setOnlinePlayers(data.players || []);
      });

      newSocket.on('history-results', (results) => {
        setLastResults(results);
      });

      newSocket.on('game-state', (state) => {
        setGameState(state);
      });

      newSocket.on('auth-error', (data) => {
        console.error('Socket auth error:', data.message);
        // Token might be invalid, force logout?
      });

      setSocket(newSocket);
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ 
      socket: socketRef.current, 
      onlinePlayers, 
      lastResults, 
      gameState,
      isConnected 
    }}>
      {children}
    </SocketContext.Provider>
  );
};