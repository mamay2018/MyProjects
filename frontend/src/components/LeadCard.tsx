import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, SHADOWS, STATUS_COLORS, STATUS_LABELS } from '../constants/theme';
import { LeadListItem } from '../types';
import { format } from 'date-fns';

interface LeadCardProps {
  lead: LeadListItem;
  onPress: () => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onPress }) => {
  const statusColor = STATUS_COLORS[lead.status] || COLORS.textSecondary;
  
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>{lead.customer_name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[lead.status]}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
      </View>
      
      <View style={styles.details}>
        {lead.lead_source && (
          <View style={styles.detailRow}>
            <View style={[styles.sourceDot, { backgroundColor: lead.lead_source.color }]} />
            <Text style={styles.detailText}>{lead.lead_source.name}</Text>
          </View>
        )}
        
        {lead.customer_phone && (
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{lead.customer_phone}</Text>
          </View>
        )}
      </View>
      
      {lead.next_action && (
        <View style={styles.footer}>
          <Ionicons name="flag-outline" size={14} color={COLORS.warning} />
          <Text style={styles.footerText} numberOfLines={1}>
            {lead.next_action}
            {lead.next_action_at && ` · ${format(new Date(lead.next_action_at), 'MMM d')}`}
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
  sourceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    flex: 1,
  },
});
