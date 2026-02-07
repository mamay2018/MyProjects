import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Backend URL - use the external preview URL for all platforms
// This allows both web and Expo Go to reach the backend
const API_URL = 'https://profollow.preview.emergentagent.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Token storage for web/native compatibility
const getToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('auth_token');
    }
    return await SecureStore.getItemAsync('auth_token');
  } catch {
    return null;
  }
};

const removeToken = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem('auth_token');
    } else {
      await SecureStore.deleteItemAsync('auth_token');
    }
  } catch (error) {
    console.log('Error removing token:', error);
  }
};

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  try {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.log('Error getting token:', error);
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth APIs
export const authAPI = {
  signup: (email: string, password: string) => 
    api.post('/auth/signup', { email, password }),
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  updatePushToken: (expo_push_token: string) => 
    api.post('/auth/push-token', { expo_push_token }),
};

// Business APIs
export const businessAPI = {
  get: () => api.get('/business'),
  create: (data: any) => api.post('/business', data),
  update: (data: any) => api.put('/business', data),
};

// Lead APIs
export const leadsAPI = {
  getAll: (params?: { status?: string; search?: string }) => 
    api.get('/leads', { params }),
  get: (id: number) => api.get(`/leads/${id}`),
  create: (data: any) => api.post('/leads', data),
  update: (id: number, data: any) => api.put(`/leads/${id}`, data),
  delete: (id: number) => api.delete(`/leads/${id}`),
  assignSequence: (leadId: number, sequenceId: number) => 
    api.post(`/leads/${leadId}/assign-sequence`, { sequence_id: sequenceId }),
  getMessages: (leadId: number) => api.get(`/leads/${leadId}/messages`),
  sendMessage: (leadId: number, body: string, channel: string = 'SMS') => 
    api.post(`/leads/${leadId}/messages`, { body, channel }),
};

// Sequence APIs
export const sequencesAPI = {
  getAll: () => api.get('/sequences'),
  get: (id: number) => api.get(`/sequences/${id}`),
  create: (data: any) => api.post('/sequences', data),
  delete: (id: number) => api.delete(`/sequences/${id}`),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard'),
};

// AI API
export const aiAPI = {
  rewrite: (message: string, tone: string, length?: string) => 
    api.post('/ai/rewrite', { message, tone, length }),
};

// Subscription API
export const subscriptionAPI = {
  get: () => api.get('/subscription'),
  checkout: (plan: string) => api.post(`/subscription/checkout?plan=${plan}`),
  portal: () => api.post('/subscription/portal'),
};
