export interface Lead {
  id: number;
  full_name: string;
  phone: string;
  email?: string;
  job_type: string;
  quote_amount?: number;
  status: 'NEW' | 'FOLLOWING_UP' | 'REPLIED' | 'WON' | 'LOST' | 'GHOSTED';
  tags?: string[];
  notes?: string;
  preferred_channel: 'SMS' | 'EMAIL' | 'BOTH';
  last_contact_at?: string;
  next_followup_at?: string;
  current_sequence_id?: number;
  current_step_index: number;
  created_at: string;
}

export interface SequenceStep {
  id: number;
  day_offset: number;
  channel: 'SMS' | 'EMAIL' | 'BOTH';
  message_template: string;
  email_subject?: string;
  step_order: number;
}

export interface Sequence {
  id: number;
  name: string;
  is_builtin: boolean;
  steps: SequenceStep[];
  created_at: string;
}

export interface MessageLog {
  id: number;
  lead_id: number;
  direction: 'OUTBOUND' | 'INBOUND';
  channel: 'SMS' | 'EMAIL';
  body: string;
  subject?: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  provider_message_id?: string;
  error?: string;
  timestamp: string;
}

export interface DashboardStats {
  todays_followups: number;
  hot_leads: number;
  pipeline_counts: Record<string, number>;
  money_at_risk: number;
}

export interface Subscription {
  id: number;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'inactive';
  plan?: 'SOLO' | 'GROWTH' | 'TEAM';
  active_lead_limit: number;
  stripe_customer_id?: string;
}
