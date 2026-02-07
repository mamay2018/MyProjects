import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Backend URL - uses relative path for web, env var for native
const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    return '/api';
  }
  // For Expo Go, use the env variable or fallback
  return process.env.EXPO_PUBLIC_BACKEND_URL 
    ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
    : '/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
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

// Auth APIs - v2
export const authAPI = {
  register: (data: {
    email: string;
    password: string;
    pro_name: string;
    business_name?: string;
    phone?: string;
    timezone?: string;
  }) => api.post('/auth/register', data),
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.patch('/auth/me', data),
};

// Device APIs - for push notifications
export const deviceAPI = {
  register: (expo_push_token: string, platform?: string, device_name?: string) =>
    api.post('/devices', { expo_push_token, platform, device_name }),
  list: () => api.get('/devices'),
  delete: (deviceId: string) => api.delete(`/devices/${deviceId}`),
};

// Lead Source APIs
export const leadSourceAPI = {
  getAll: () => api.get('/lead-sources'),
  create: (data: { name: string; color?: string; is_default?: boolean }) =>
    api.post('/lead-sources', data),
  update: (id: string, data: any) => api.patch(`/lead-sources/${id}`, data),
  delete: (id: string) => api.delete(`/lead-sources/${id}`),
};

// Lead APIs - v2
export const leadsAPI = {
  getAll: (params?: { status?: string; source_id?: string; search?: string; limit?: number; offset?: number }) => 
    api.get('/leads', { params }),
  get: (id: string) => api.get(`/leads/${id}`),
  create: (data: {
    customer_name: string;
    customer_phone?: string;
    customer_email?: string;
    lead_source_id?: string;
    notes?: string;
    follow_up_plan_id?: string;
  }) => api.post('/leads', data),
  update: (id: string, data: any) => api.patch(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
  addCapture: (leadId: string, data: { type: string; text?: string; file_url?: string }) =>
    api.post(`/leads/${leadId}/captures`, data),
};

// Template APIs
export const templateAPI = {
  getAll: (category?: string) => api.get('/templates', { params: { category } }),
  get: (id: string) => api.get(`/templates/${id}`),
  create: (data: { name: string; category: string; subject?: string; body: string; is_default?: boolean }) =>
    api.post('/templates', data),
  update: (id: string, data: any) => api.patch(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
};

// Availability APIs
export const availabilityAPI = {
  get: () => api.get('/availability'),
  set: (rules: Array<{ weekday: number; start_time_local: string; end_time_local: string; enabled: boolean }>) =>
    api.put('/availability', { rules }),
};

// Appointment APIs
export const appointmentAPI = {
  getAll: (params?: { start_date?: string; end_date?: string; status?: string }) =>
    api.get('/appointments', { params }),
  get: (id: string) => api.get(`/appointments/${id}`),
  create: (data: any) => api.post('/appointments', data),
  update: (id: string, data: any) => api.patch(`/appointments/${id}`, data),
  delete: (id: string) => api.delete(`/appointments/${id}`),
  getIcs: (id: string) => api.get(`/appointments/${id}/ics`, { responseType: 'blob' }),
};

// Follow-up Plan APIs
export const followUpPlanAPI = {
  getAll: () => api.get('/follow-up-plans'),
  get: (id: string) => api.get(`/follow-up-plans/${id}`),
  create: (data: any) => api.post('/follow-up-plans', data),
  update: (id: string, data: any) => api.patch(`/follow-up-plans/${id}`, data),
  delete: (id: string) => api.delete(`/follow-up-plans/${id}`),
};

// Message Log APIs
export const messageAPI = {
  getAll: (params?: { lead_id?: string; limit?: number; offset?: number }) =>
    api.get('/messages', { params }),
};

// Analytics APIs
export const analyticsAPI = {
  getSummary: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/analytics/summary', { params }),
};

// Source Cost APIs
export const sourceCostAPI = {
  getAll: (params?: { lead_source_id?: string; month?: string }) =>
    api.get('/source-costs', { params }),
  upsert: (data: { lead_source_id: string; month: string; cost_cents: number }) =>
    api.post('/source-costs', data),
};

// Debug APIs (MOCK_MODE)
export const debugAPI = {
  sendPush: (data: { title?: string; body?: string; data?: any }) =>
    api.post('/debug/send-push', data),
  triggerWorker: () => api.post('/debug/trigger-worker'),
  inboundMessage: (data: { lead_id: string; channel: string; body: string }) =>
    api.post('/debug/inbound-message', data),
};

// Public Booking APIs (no auth required)
export const publicBookingAPI = {
  getSlots: (publicId: string, date?: string) =>
    api.get(`/book/${publicId}/slots`, { params: { date } }),
  createBooking: (publicId: string, data: {
    start_at_utc: string;
    customer_name: string;
    customer_phone?: string;
    customer_email?: string;
    notes?: string;
  }) => api.post(`/book/${publicId}`, data),
};
