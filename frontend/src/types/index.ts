// FollowUp Pro v2 Types

export type LeadStatus = 'NEW' | 'CONTACTED' | 'BOOKED' | 'WON' | 'LOST';
export type CaptureType = 'TEXT_PASTE' | 'SCREENSHOT' | 'EMAIL_FORWARD' | 'MANUAL';
export type TemplateCategory = 'SMS' | 'EMAIL' | 'PLATFORM';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type MessageChannel = 'SMS' | 'EMAIL';
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'MOCKED';

export interface LeadSource {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface LeadCapture {
  id: string;
  type: CaptureType;
  text?: string;
  file_url?: string;
  created_at: string;
}

export interface Lead {
  id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  status: LeadStatus;
  notes?: string;
  won_value_cents?: number;
  next_action?: string;
  next_action_at?: string;
  lead_source_id?: string;
  lead_source?: LeadSource;
  follow_up_plan_id?: string;
  automation_paused: boolean;
  created_at: string;
  updated_at: string;
  contacted_at?: string;
  booked_at?: string;
  closed_at?: string;
  captures?: LeadCapture[];
}

export interface LeadListItem {
  id: string;
  customer_name: string;
  customer_phone?: string;
  status: LeadStatus;
  next_action?: string;
  next_action_at?: string;
  lead_source?: LeadSource;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  subject?: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityRule {
  id: string;
  weekday: number;
  start_time_local: string;
  end_time_local: string;
  enabled: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  lead_id?: string;
  start_at_utc: string;
  end_at_utc: string;
  status: AppointmentStatus;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  notes?: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface FollowUpStep {
  id: string;
  step_order: number;
  delay_minutes_from_previous: number;
  channel: MessageChannel;
  template_id?: string;
  custom_body?: string;
  created_at: string;
}

export interface FollowUpPlan {
  id: string;
  name: string;
  enabled: boolean;
  steps: FollowUpStep[];
  created_at: string;
  updated_at: string;
}

export interface MessageLog {
  id: string;
  lead_id?: string;
  channel: MessageChannel;
  direction: string;
  to_address?: string;
  from_address?: string;
  subject?: string;
  body: string;
  status: MessageStatus;
  external_id?: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface SourceAnalytics {
  source_id: string;
  source_name: string;
  source_color: string;
  total_leads: number;
  new_leads: number;
  contacted_leads: number;
  booked_leads: number;
  won_leads: number;
  lost_leads: number;
  close_rate: number;
  revenue_cents: number;
  cost_cents: number;
  roi?: number;
}

export interface AnalyticsSummary {
  period_start: string;
  period_end: string;
  total_leads: number;
  total_booked: number;
  total_won: number;
  total_lost: number;
  overall_close_rate: number;
  total_revenue_cents: number;
  total_cost_cents: number;
  overall_roi?: number;
  by_source: SourceAnalytics[];
}

export interface SourceCost {
  id: string;
  lead_source_id: string;
  month: string;
  cost_cents: number;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  pro_name: string;
  business_name?: string;
  phone?: string;
  timezone: string;
  public_booking_id: string;
  default_appt_duration_minutes: number;
  buffer_minutes: number;
  daily_appt_limit: number;
  subscription_status: string;
  created_at: string;
}

export interface Device {
  id: string;
  expo_push_token: string;
  platform?: string;
  device_name?: string;
  created_at: string;
}
