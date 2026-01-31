import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

class ApiService {
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  // Auth endpoints
  async sendOtp(phone: string) {
    const response = await this.client.post('/auth/send-otp', { phone });
    return response.data;
  }

  async verifyOtp(phone: string, otp: string) {
    const response = await this.client.post('/auth/verify-otp', { phone, otp });
    return response.data;
  }

  async logout() {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async updateProfile(data: { name?: string; email?: string }) {
    const response = await this.client.put('/auth/update-profile', null, { params: data });
    return response.data;
  }

  async setRole(role: string) {
    const response = await this.client.put('/auth/set-role', null, { params: { role } });
    return response.data;
  }

  // Quote & Jobs
  async getQuote(data: {
    service_type: string;
    pickup_location: { lat: number; lng: number };
    destination_location?: { lat: number; lng: number };
    service_details: any;
  }) {
    const response = await this.client.post('/quote', data);
    return response.data;
  }

  async createJob(data: {
    customer_id: string;
    service_type: string;
    pickup_location: { lat: number; lng: number };
    destination_location?: { lat: number; lng: number };
    pickup_address: string;
    destination_address?: string;
    service_details: any;
    estimated_price: number;
    notes?: string;
  }) {
    const response = await this.client.post('/jobs', data);
    return response.data;
  }

  async getJob(jobId: string) {
    const response = await this.client.get(`/jobs/${jobId}`);
    return response.data;
  }

  async dispatchJob(jobId: string) {
    const response = await this.client.post(`/jobs/${jobId}/dispatch`);
    return response.data;
  }

  async cancelJob(jobId: string, reason?: string) {
    const response = await this.client.post(`/jobs/${jobId}/cancel`, null, { params: { reason } });
    return response.data;
  }

  async getCustomerJobs(status?: string) {
    const response = await this.client.get('/jobs', { params: { status } });
    return response.data;
  }

  async addTip(jobId: string, amount: number) {
    const response = await this.client.post(`/jobs/${jobId}/tip`, { job_id: jobId, amount });
    return response.data;
  }

  async rateJob(jobId: string, toUserId: string, rating: number, comment?: string) {
    const response = await this.client.post(`/jobs/${jobId}/rate`, {
      job_id: jobId,
      from_user_id: '', // Will be set by backend
      to_user_id: toUserId,
      rating,
      comment,
    });
    return response.data;
  }

  // Provider endpoints
  async createProviderProfile(data: {
    user_id: string;
    name: string;
    services_offered: string[];
    vehicle_info?: any;
    bio?: string;
  }) {
    const response = await this.client.post('/providers/profile', data);
    return response.data;
  }

  async getProviderProfile() {
    const response = await this.client.get('/providers/profile');
    return response.data;
  }

  async updateProviderProfile(data: {
    name?: string;
    services_offered?: string[];
    vehicle_info?: any;
    bio?: string;
  }) {
    const response = await this.client.put('/providers/profile', null, { params: data });
    return response.data;
  }

  async toggleOnline(isOnline: boolean) {
    const response = await this.client.post('/providers/toggle-online', null, { params: { is_online: isOnline } });
    return response.data;
  }

  async updateProviderLocation(lat: number, lng: number) {
    const response = await this.client.post('/providers/update-location', null, { params: { lat, lng } });
    return response.data;
  }

  async uploadDocument(data: {
    provider_id: string;
    doc_type: string;
    doc_data: string;
    service_type?: string;
  }) {
    const response = await this.client.post('/providers/documents', data);
    return response.data;
  }

  async getProviderDocuments() {
    const response = await this.client.get('/providers/documents');
    return response.data;
  }

  async getJobOffers() {
    const response = await this.client.get('/providers/offers');
    return response.data;
  }

  async acceptJobOffer(offerId: string) {
    const response = await this.client.post(`/providers/offers/${offerId}/accept`);
    return response.data;
  }

  async declineJobOffer(offerId: string) {
    const response = await this.client.post(`/providers/offers/${offerId}/decline`);
    return response.data;
  }

  async updateJobStatus(jobId: string, status: string) {
    const response = await this.client.post(`/providers/jobs/${jobId}/status`, null, { params: { status } });
    return response.data;
  }

  async uploadProofPhoto(jobId: string, photoData: string, notes?: string) {
    const response = await this.client.post(`/providers/jobs/${jobId}/proof`, null, {
      params: { photo_data: photoData, notes },
    });
    return response.data;
  }

  async getProviderEarnings() {
    const response = await this.client.get('/providers/earnings');
    return response.data;
  }

  async getProviderActiveJob() {
    const response = await this.client.get('/providers/active-job');
    return response.data;
  }

  // Payment endpoints
  async createPaymentIntent(jobId: string, amount: number, paymentMethodType: string = 'card') {
    const response = await this.client.post('/payments/create-intent', {
      job_id: jobId,
      amount,
      payment_method_type: paymentMethodType,
    });
    return response.data;
  }

  async confirmPayment(paymentIntentId: string) {
    const response = await this.client.post('/payments/confirm', null, {
      params: { payment_intent_id: paymentIntentId },
    });
    return response.data;
  }

  async getPaymentConfig() {
    const response = await this.client.get('/payments/config');
    return response.data;
  }

  // Dispute
  async createDispute(jobId: string, reason: string, evidence?: string) {
    const response = await this.client.post('/disputes', {
      job_id: jobId,
      raised_by: '',
      reason,
      evidence,
    });
    return response.data;
  }

  // Admin endpoints
  async getVerificationQueue() {
    const response = await this.client.get('/admin/providers/verification-queue');
    return response.data;
  }

  async approveProvider(providerId: string, serviceType: string, approved: boolean, notes?: string) {
    const response = await this.client.post('/admin/providers/approve', {
      provider_id: providerId,
      service_type: serviceType,
      approved,
      notes,
    });
    return response.data;
  }

  async getAdminJobs(status?: string, serviceType?: string) {
    const response = await this.client.get('/admin/jobs', { params: { status, service_type: serviceType } });
    return response.data;
  }

  async getLiveJobs() {
    const response = await this.client.get('/admin/jobs/live');
    return response.data;
  }

  async reassignJob(jobId: string) {
    const response = await this.client.post(`/admin/jobs/${jobId}/reassign`);
    return response.data;
  }

  async processRefund(jobId: string, amount: number, reason: string, isFullRefund: boolean = false) {
    const response = await this.client.post('/admin/refunds', {
      job_id: jobId,
      amount,
      reason,
      is_full_refund: isFullRefund,
    });
    return response.data;
  }

  async getPricingConfigs() {
    const response = await this.client.get('/admin/pricing');
    return response.data;
  }

  async updatePricingConfig(config: {
    service_type: string;
    base_fee: number;
    per_mile_fee?: number;
    surge_multiplier?: number;
    platform_fee_percent?: number;
    gas_max_gallons?: number;
    enabled?: boolean;
  }) {
    const response = await this.client.post('/admin/pricing', config);
    return response.data;
  }

  async getAnalytics() {
    const response = await this.client.get('/admin/analytics');
    return response.data;
  }

  async getDisputes() {
    const response = await this.client.get('/admin/disputes');
    return response.data;
  }

  async resolveDispute(disputeId: string, resolution: string) {
    const response = await this.client.post(`/admin/disputes/${disputeId}/resolve`, null, {
      params: { resolution },
    });
    return response.data;
  }

  async getAllUsers(role?: string) {
    const response = await this.client.get('/admin/users', { params: { role } });
    return response.data;
  }
}

export const api = new ApiService();
