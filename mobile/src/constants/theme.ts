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
  
  // Status colors
  statusNew: '#3B82F6',
  statusFollowingUp: '#F59E0B',
  statusReplied: '#10B981',
  statusWon: '#22C55E',
  statusLost: '#EF4444',
  statusGhosted: '#6B7280',
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

export const STATUS_COLORS: Record<string, string> = {
  NEW: COLORS.statusNew,
  FOLLOWING_UP: COLORS.statusFollowingUp,
  REPLIED: COLORS.statusReplied,
  WON: COLORS.statusWon,
  LOST: COLORS.statusLost,
  GHOSTED: COLORS.statusGhosted,
};

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  FOLLOWING_UP: 'Following Up',
  REPLIED: 'Replied',
  WON: 'Won',
  LOST: 'Lost',
  GHOSTED: 'Ghosted',
};

export const CHANNEL_LABELS: Record<string, string> = {
  SMS: 'SMS',
  EMAIL: 'Email',
  BOTH: 'Both',
};
