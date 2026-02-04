import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, SHADOWS, STATUS_COLORS, STATUS_LABELS } from '../constants/theme';
import { Lead } from '../types';
import { format } from 'date-fns';

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onPress }) => {
  const statusColor = STATUS_COLORS[lead.status] || COLORS.textSecondary;
  
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>{lead.full_name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[lead.status]}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
      </View>
      
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="briefcase-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>{lead.job_type}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="call-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>{lead.phone}</Text>
        </View>
        
        {lead.quote_amount && (
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color={COLORS.secondary} />
            <Text style={[styles.detailText, { color: COLORS.secondary, fontWeight: '600' }]}>
              ${lead.quote_amount.toLocaleString()}
            </Text>
          </View>
        )}
      </View>
      
      {lead.next_followup_at && (
        <View style={styles.footer}>
          <Ionicons name="time-outline" size={14} color={COLORS.warning} />
          <Text style={styles.footerText}>
            Next follow-up: {format(new Date(lead.next_followup_at), 'MMM d, h:mm a')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  name: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  details: {
    gap: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  detailText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    fontWeight: '500',
  },
});
