export const COLORS = {
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  secondary: '#10B981',
  secondaryLight: '#34D399',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6',
  
  // v2 Status colors
  statusNew: '#3B82F6',
  statusContacted: '#F59E0B',
  statusBooked: '#8B5CF6',
  statusWon: '#22C55E',
  statusLost: '#EF4444',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
};

// v2 Status system
export const STATUS_COLORS: Record<string, string> = {
  NEW: COLORS.statusNew,
  CONTACTED: COLORS.statusContacted,
  BOOKED: COLORS.statusBooked,
  WON: COLORS.statusWon,
  LOST: COLORS.statusLost,
};

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  BOOKED: 'Booked',
  WON: 'Won',
  LOST: 'Lost',
};

export const STATUS_ORDER = ['NEW', 'CONTACTED', 'BOOKED', 'WON', 'LOST'];

export const CHANNEL_LABELS: Record<string, string> = {
  SMS: 'SMS',
  EMAIL: 'Email',
};

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const formatCurrency = (cents: number): string => {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};
