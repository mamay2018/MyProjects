import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface User {
  id: string;
  phone: string;
  role: 'customer' | 'provider' | 'admin';
  name?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, otp: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<{ otp_for_testing?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
  setRole: (role: 'customer' | 'provider') => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        api.setAuthToken(storedToken);
        
        // Verify token is still valid
        try {
          const userData = await api.getMe();
          setUser(userData);
          await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
        } catch (error) {
          // Token invalid, clear auth
          await logout();
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async (phone: string) => {
    const response = await api.sendOtp(phone);
    return response;
  };

  const login = async (phone: string, otp: string) => {
    const response = await api.verifyOtp(phone, otp);
    
    setToken(response.token);
    setUser(response.user);
    api.setAuthToken(response.token);
    
    await AsyncStorage.setItem('auth_token', response.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(response.user));
  };

  const logout = async () => {
    try {
      if (token) {
        await api.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    setToken(null);
    setUser(null);
    api.setAuthToken(null);
    
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
  };

  const updateProfile = async (data: { name?: string; email?: string }) => {
    await api.updateProfile(data);
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      await AsyncStorage.setItem('auth_user', JSON.stringify(updatedUser));
    }
  };

  const setRole = async (role: 'customer' | 'provider') => {
    await api.setRole(role);
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      await AsyncStorage.setItem('auth_user', JSON.stringify(updatedUser));
    }
  };

  const refreshUser = async () => {
    const userData = await api.getMe();
    setUser(userData);
    await AsyncStorage.setItem('auth_user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        sendOtp,
        logout,
        updateProfile,
        setRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
