import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// For web, use relative URL since proxy handles routing
// For native, use the full backend URL
const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    // On web, requests go through the same origin (proxy handles /api routes)
    return '';
  }
  // For native apps, use the full URL
  return process.env.EXPO_PUBLIC_BACKEND_URL || 'https://followboost-33.preview.emergentagent.com';
};

const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
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
      await SecureStore.deleteItemAsync('auth_token');
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
