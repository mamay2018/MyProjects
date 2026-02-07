import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../api';

// Token storage helpers that work on both web and native
const tokenStorage = {
  getToken: async (): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem('auth_token');
      }
      return await SecureStore.getItemAsync('auth_token');
    } catch {
      return null;
    }
  },
  setToken: async (token: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('auth_token', token);
      } else {
        await SecureStore.setItemAsync('auth_token', token);
      }
    } catch (error) {
      console.log('Error saving token:', error);
    }
  },
  removeToken: async (): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem('auth_token');
      } else {
        await SecureStore.deleteItemAsync('auth_token');
      }
    } catch (error) {
      console.log('Error removing token:', error);
    }
  },
};

// User type matching v2 API
interface User {
  id: string;
  email: string;
  pro_name: string;
  business_name: string | null;
  phone: string | null;
  timezone: string;
  public_booking_id: string;
  default_appt_duration_minutes: number;
  buffer_minutes: number;
  daily_appt_limit: number;
  subscription_status: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    pro_name: string;
    business_name?: string;
    phone?: string;
    timezone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setToken: async (token) => {
    if (token) {
      await tokenStorage.setToken(token);
    } else {
      await tokenStorage.removeToken();
    }
    set({ token, isAuthenticated: !!token });
  },

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    const response = await authAPI.login(email, password);
    const { access_token, user } = response.data;
    await get().setToken(access_token);
    set({ user });
  },

  register: async (data) => {
    const response = await authAPI.register(data);
    const { access_token, user } = response.data;
    await get().setToken(access_token);
    set({ user });
  },

  logout: async () => {
    await get().setToken(null);
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const response = await authAPI.me();
      set({ user: response.data });
    } catch (error) {
      console.log('Error loading user:', error);
      await get().logout();
    }
  },

  updateProfile: async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      set({ user: response.data });
    } catch (error) {
      console.log('Error updating profile:', error);
      throw error;
    }
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      const token = await tokenStorage.getToken();
      if (token) {
        set({ token, isAuthenticated: true });
        await get().loadUser();
      }
    } catch (error) {
      console.log('Error initializing auth:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
