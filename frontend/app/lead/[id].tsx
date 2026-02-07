import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
  TextInput,
  Modal,
  Share,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { leadsAPI, messageAPI, templateAPI, appointmentAPI } from '../../src/api';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS, SHADOWS, STATUS_COLORS, STATUS_LABELS, STATUS_ORDER, formatCurrency } from '../../src/constants/theme';
import { Lead, MessageLog, Template, LeadStatus } from '../../src/types';
import { format } from 'date-fns';

export default function LeadDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showWonModal, setShowWonModal] = useState(false);
  const [wonValue, setWonValue] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      const [leadRes, messagesRes, templatesRes] = await Promise.all([
        leadsAPI.get(id),
        messageAPI.getAll({ lead_id: id }),
        templateAPI.getAll(),
      ]);
      setLead(leadRes.data);
      setMessages(messagesRes.data);
      setTemplates(templatesRes.data);
    } catch (error) {
      console.log('Error loading lead:', error);
      Alert.alert('Error', 'Could not load lead details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCall = () => {
    if (lead?.customer_phone) {
      Linking.openURL(`tel:${lead.customer_phone}`);
    }
  };

  const handleSMS = () => {
    if (lead?.customer_phone) {
      Linking.openURL(`sms:${lead.customer_phone}`);
    }
  };

  const handleEmail = () => {
    if (lead?.customer_email) {
      Linking.openURL(`mailto:${lead.customer_email}`);
    }
  };

  const handleShareBookingLink = async () => {
    if (!user?.public_booking_id) return;
    const bookingUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL}/book/${user.public_booking_id}`;
    try {
      await Share.share({
        message: `Book an appointment with me: ${bookingUrl}`,
        url: bookingUrl,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return;
    
    if (newStatus === 'WON') {
      setShowStatusModal(false);
      setShowWonModal(true);
      return;
    }
    
    setActionLoading(true);
    try {
      await leadsAPI.update(lead.id, { status: newStatus });
      await loadData();
      setShowStatusModal(false);
    } catch (error) {
      Alert.alert('Error', 'Could not update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkWon = async () => {
    if (!lead) return;
    setActionLoading(true);
    try {
      const valueInCents = wonValue ? Math.round(parseFloat(wonValue) * 100) : undefined;
      await leadsAPI.update(lead.id, { 
        status: 'WON',
        won_value_cents: valueInCents,
      });
      await loadData();
      setShowWonModal(false);
      setWonValue('');
    } catch (error) {
      Alert.alert('Error', 'Could not update lead');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAutomation = async () => {
    if (!lead) return;
    setActionLoading(true);
    try {
      await leadsAPI.update(lead.id, { automation_paused: !lead.automation_paused });
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Could not update automation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Lead',
      'Are you sure you want to delete this lead? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await leadsAPI.delete(lead!.id);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Could not delete lead');
            }
          }
        },
      ]
    );
  };

  if (loading || !lead) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[lead.status] || COLORS.textSecondary;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <Text style={styles.customerName}>{lead.customer_name}</Text>
          
          {lead.lead_source && (
            <View style={styles.sourceRow}>
              <View style={[styles.sourceDot, { backgroundColor: lead.lead_source.color }]} />
              <Text style={styles.sourceText}>{lead.lead_source.name}</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}
            onPress={() => setShowStatusModal(true)}
          >
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[lead.status]}
            </Text>
            <Ionicons name="chevron-down" size={16} color={statusColor} />
          </TouchableOpacity>
          
          {lead.won_value_cents && (
            <Text style={styles.wonValue}>{formatCurrency(lead.won_value_cents)}</Text>
          )}
        </View>

        {/* Contact Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <View style={styles.actionsRow}>
            {lead.customer_phone && (
              <>
                <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
                  <Ionicons name="call" size={24} color={COLORS.primary} />
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleSMS}>
                  <Ionicons name="chatbubble" size={24} color={COLORS.primary} />
                  <Text style={styles.actionText}>SMS</Text>
                </TouchableOpacity>
              </>
            )}
            {lead.customer_email && (
              <TouchableOpacity style={styles.actionButton} onPress={handleEmail}>
                <Ionicons name="mail" size={24} color={COLORS.primary} />
                <Text style={styles.actionText}>Email</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionButton} onPress={handleShareBookingLink}>
              <Ionicons name="calendar" size={24} color={COLORS.secondary} />
              <Text style={styles.actionText}>Book</Text>
            </TouchableOpacity>
          </View>
          
          {lead.customer_phone && (
            <Text style={styles.contactInfo}>{lead.customer_phone}</Text>
          )}
          {lead.customer_email && (
            <Text style={styles.contactInfo}>{lead.customer_email}</Text>
          )}
        </View>

        {/* Automation Control */}
        <View style={styles.automationCard}>
          <View style={styles.automationHeader}>
            <View>
              <Text style={styles.sectionTitle}>Follow-up Automation</Text>
              <Text style={styles.automationStatus}>
                {lead.automation_paused ? 'Paused' : 'Active'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                !lead.automation_paused && styles.toggleButtonActive
              ]}
              onPress={handleToggleAutomation}
              disabled={actionLoading}
            >
              <Text style={[
                styles.toggleText,
                !lead.automation_paused && styles.toggleTextActive
              ]}>
                {lead.automation_paused ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Status Actions */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            {lead.status !== 'BOOKED' && lead.status !== 'WON' && lead.status !== 'LOST' && (
              <TouchableOpacity 
                style={[styles.quickAction, { backgroundColor: STATUS_COLORS.BOOKED + '20' }]}
                onPress={() => handleStatusChange('BOOKED')}
              >
                <Ionicons name="calendar-outline" size={20} color={STATUS_COLORS.BOOKED} />
                <Text style={[styles.quickActionText, { color: STATUS_COLORS.BOOKED }]}>Mark Booked</Text>
              </TouchableOpacity>
            )}
            {lead.status !== 'WON' && lead.status !== 'LOST' && (
              <TouchableOpacity 
                style={[styles.quickAction, { backgroundColor: STATUS_COLORS.WON + '20' }]}
                onPress={() => handleStatusChange('WON')}
              >
                <Ionicons name="trophy-outline" size={20} color={STATUS_COLORS.WON} />
                <Text style={[styles.quickActionText, { color: STATUS_COLORS.WON }]}>Mark Won</Text>
              </TouchableOpacity>
            )}
            {lead.status !== 'WON' && lead.status !== 'LOST' && (
              <TouchableOpacity 
                style={[styles.quickAction, { backgroundColor: STATUS_COLORS.LOST + '20' }]}
                onPress={() => handleStatusChange('LOST')}
              >
                <Ionicons name="close-circle-outline" size={20} color={STATUS_COLORS.LOST} />
                <Text style={[styles.quickActionText, { color: STATUS_COLORS.LOST }]}>Mark Lost</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Notes */}
        {lead.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{lead.notes}</Text>
          </View>
        )}

        {/* Message History */}
        <View style={styles.messagesCard}>
          <Text style={styles.sectionTitle}>Message History</Text>
          {messages.length === 0 ? (
            <Text style={styles.noMessages}>No messages yet</Text>
          ) : (
            messages.slice(0, 5).map((msg) => (
              <View key={msg.id} style={styles.messageItem}>
                <View style={styles.messageHeader}>
                  <Ionicons 
                    name={msg.channel === 'SMS' ? 'chatbubble' : 'mail'} 
                    size={14} 
                    color={COLORS.textSecondary} 
                  />
                  <Text style={styles.messageChannel}>{msg.channel}</Text>
                  <Text style={styles.messageTime}>
                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                  </Text>
                  <View style={[styles.messageStatusBadge, { 
                    backgroundColor: msg.status === 'MOCKED' ? COLORS.warning + '20' : 
                                    msg.status === 'SENT' ? COLORS.success + '20' : COLORS.error + '20'
                  }]}>
                    <Text style={[styles.messageStatusText, {
                      color: msg.status === 'MOCKED' ? COLORS.warning :
                             msg.status === 'SENT' ? COLORS.success : COLORS.error
                    }]}>{msg.status}</Text>
                  </View>
                </View>
                <Text style={styles.messageBody} numberOfLines={2}>{msg.body}</Text>
              </View>
            ))
          )}
        </View>

        {/* Timestamps */}
        <View style={styles.timestampsCard}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>Created</Text>
            <Text style={styles.timestampValue}>{format(new Date(lead.created_at), 'MMM d, yyyy h:mm a')}</Text>
          </View>
          {lead.contacted_at && (
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Contacted</Text>
              <Text style={styles.timestampValue}>{format(new Date(lead.contacted_at), 'MMM d, yyyy h:mm a')}</Text>
            </View>
          )}
          {lead.booked_at && (
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Booked</Text>
              <Text style={styles.timestampValue}>{format(new Date(lead.booked_at), 'MMM d, yyyy h:mm a')}</Text>
            </View>
          )}
          {lead.closed_at && (
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Closed</Text>
              <Text style={styles.timestampValue}>{format(new Date(lead.closed_at), 'MMM d, yyyy h:mm a')}</Text>
            </View>
          )}
        </View>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
          <Text style={styles.deleteText}>Delete Lead</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Status Change Modal */}
      <Modal visible={showStatusModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Status</Text>
            {STATUS_ORDER.map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.modalOption,
                  lead.status === status && styles.modalOptionActive
                ]}
                onPress={() => handleStatusChange(status as LeadStatus)}
                disabled={actionLoading}
              >
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
                <Text style={styles.modalOptionText}>{STATUS_LABELS[status]}</Text>
                {lead.status === status && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowStatusModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Won Value Modal */}
      <Modal visible={showWonModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mark as Won</Text>
            <Text style={styles.modalSubtitle}>Enter the job value (optional)</Text>
            <View style={styles.valueInputContainer}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.valueInput}
                placeholder="0"
                value={wonValue}
                onChangeText={setWonValue}
                keyboardType="numeric"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            <Button
              title="Mark as Won"
              onPress={handleMarkWon}
              loading={actionLoading}
              style={styles.modalButton}
            />
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowWonModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
  },
  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  customerName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sourceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sourceText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    gap: SPACING.xs,
  },
  statusText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  wonValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.success,
    marginTop: SPACING.sm,
  },
  actionsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.md,
  },
  actionButton: {
    alignItems: 'center',
    padding: SPACING.sm,
  },
  actionText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  contactInfo: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  automationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  automationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  automationStatus: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  toggleButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.border,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  quickActionsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    gap: SPACING.xs,
  },
  quickActionText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
  },
  notesCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  notesText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  messagesCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  noMessages: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  messageItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  messageChannel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  messageTime: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
  },
  messageStatusBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  messageStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  messageBody: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
  },
  timestampsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  timestampLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  timestampValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  deleteText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalOptionActive: {
    backgroundColor: COLORS.primary + '10',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalOptionText: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
  },
  modalCancel: {
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  modalCancelText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  valueInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  dollarSign: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textSecondary,
  },
  valueInput: {
    flex: 1,
    fontSize: FONTS.sizes.xl,
    color: COLORS.text,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  modalButton: {
    marginBottom: SPACING.sm,
  },
});
