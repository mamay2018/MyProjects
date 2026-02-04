import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authAPI, businessAPI } from '../api';

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

interface User {
  id: number;
  email: string;
  created_at: string;
  has_business: boolean;
  subscription_status?: string;
  subscription_plan?: string;
}

interface Business {
  id: number;
  business_name: string;
  owner_name: string;
  timezone: string;
  phone?: string;
  email?: string;
}

interface AuthState {
  user: User | null;
  business: Business | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => void;
  setBusiness: (business: Business | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  loadBusiness: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  business: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setToken: async (token) => {
    if (token) {
      await SecureStore.setItemAsync('auth_token', token);
    } else {
      await SecureStore.deleteItemAsync('auth_token');
    }
    set({ token, isAuthenticated: !!token });
  },

  setUser: (user) => set({ user }),
  setBusiness: (business) => set({ business }),

  login: async (email, password) => {
    const response = await authAPI.login(email, password);
    const { access_token } = response.data;
    await get().setToken(access_token);
    await get().loadUser();
  },

  signup: async (email, password) => {
    const response = await authAPI.signup(email, password);
    const { access_token } = response.data;
    await get().setToken(access_token);
    await get().loadUser();
  },

  logout: async () => {
    await get().setToken(null);
    set({ user: null, business: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const response = await authAPI.me();
      set({ user: response.data });
      if (response.data.has_business) {
        await get().loadBusiness();
      }
    } catch (error) {
      console.log('Error loading user:', error);
      await get().logout();
    }
  },

  loadBusiness: async () => {
    try {
      const response = await businessAPI.get();
      set({ business: response.data });
    } catch (error) {
      console.log('No business profile yet');
    }
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync('auth_token');
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
