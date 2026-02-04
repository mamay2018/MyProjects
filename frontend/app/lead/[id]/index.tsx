import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { leadsAPI, sequencesAPI } from '../../../src/api';
import { Button } from '../../src/components/Button';
import { SequenceCard } from '../../src/components/SequenceCard';
import { COLORS, SPACING, FONTS, SHADOWS, STATUS_COLORS, STATUS_LABELS, CHANNEL_LABELS } from '../../src/constants/theme';
import { Lead, Sequence } from '../../src/types';
import { format } from 'date-fns';

const STATUSES = ['NEW', 'FOLLOWING_UP', 'REPLIED', 'WON', 'LOST', 'GHOSTED'] as const;

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [assigningSequence, setAssigningSequence] = useState(false);

  useEffect(() => {
    loadLead();
    loadSequences();
  }, [id]);

  const loadLead = async () => {
    try {
      const response = await leadsAPI.get(Number(id));
      setLead(response.data);
    } catch (error) {
      console.log('Error loading lead:', error);
      Alert.alert('Error', 'Could not load lead details');
    } finally {
      setLoading(false);
    }
  };

  const loadSequences = async () => {
    try {
      const response = await sequencesAPI.getAll();
      setSequences(response.data);
    } catch (error) {
      console.log('Error loading sequences:', error);
    }
  };

  const handleAssignSequence = async (sequenceId: number) => {
    setAssigningSequence(true);
    try {
      const response = await leadsAPI.assignSequence(Number(id), sequenceId);
      setLead(response.data);
      setShowSequenceModal(false);
      Alert.alert('Success', 'Sequence assigned! Follow-ups will start automatically.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not assign sequence');
    } finally {
      setAssigningSequence(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      const response = await leadsAPI.update(Number(id), { status });
      setLead(response.data);
      setShowStatusModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not update status');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Lead',
      'Are you sure you want to delete this lead? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await leadsAPI.delete(Number(id));
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Could not delete lead');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Lead not found</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[lead.status];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{lead.full_name}</Text>
            <TouchableOpacity 
              style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}
              onPress={() => setShowStatusModal(true)}
            >
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABELS[lead.status]}
              </Text>
              <Ionicons name="chevron-down" size={14} color={statusColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.contactInfo}>
            <View style={styles.contactRow}>
              <Ionicons name="call" size={18} color={COLORS.primary} />
              <Text style={styles.contactText}>{lead.phone}</Text>
            </View>
            {lead.email && (
              <View style={styles.contactRow}>
                <Ionicons name="mail" size={18} color={COLORS.primary} />
                <Text style={styles.contactText}>{lead.email}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Project Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Job Type</Text>
            <Text style={styles.detailValue}>{lead.job_type}</Text>
          </View>
          
          {lead.quote_amount && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Quote Amount</Text>
              <Text style={[styles.detailValue, { color: COLORS.secondary }]}>
                ${lead.quote_amount.toLocaleString()}
              </Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Preferred Channel</Text>
            <Text style={styles.detailValue}>{CHANNEL_LABELS[lead.preferred_channel]}</Text>
          </View>
          
          {lead.last_contact_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last Contact</Text>
              <Text style={styles.detailValue}>
                {format(new Date(lead.last_contact_at), 'MMM d, yyyy h:mm a')}
              </Text>
            </View>
          )}
          
          {lead.next_followup_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Next Follow-up</Text>
              <Text style={[styles.detailValue, { color: COLORS.warning }]}>
                {format(new Date(lead.next_followup_at), 'MMM d, yyyy h:mm a')}
              </Text>
            </View>
          )}
        </View>

        {/* Sequence Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Follow-up Sequence</Text>
          
          {lead.current_sequence_id ? (
            <View style={styles.sequenceInfo}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.secondary} />
              <Text style={styles.sequenceText}>Sequence assigned (Step {lead.current_step_index + 1})</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.assignButton}
              onPress={() => setShowSequenceModal(true)}
            >
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
              <Text style={styles.assignText}>Assign a sequence to start automation</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notes */}
        {lead.notes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Text style={styles.notesText}>{lead.notes}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="View Conversation"
            onPress={() => router.push(`/lead/${id}/conversation`)}
            icon={<Ionicons name="chatbubbles" size={20} color="#FFFFFF" />}
            style={styles.actionButton}
          />
          
          <Button
            title="Assign Sequence"
            onPress={() => setShowSequenceModal(true)}
            variant="outline"
            icon={<Ionicons name="git-branch" size={20} color={COLORS.primary} />}
            style={styles.actionButton}
          />
          
          <Button
            title="Delete Lead"
            onPress={handleDelete}
            variant="ghost"
            textStyle={{ color: COLORS.error }}
            icon={<Ionicons name="trash" size={20} color={COLORS.error} />}
          />
        </View>
      </ScrollView>

      {/* Status Modal */}
      <Modal
        visible={showStatusModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Status</Text>
            {STATUSES.map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.statusOption}
                onPress={() => handleStatusChange(status)}
              >
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
                <Text style={styles.statusOptionText}>{STATUS_LABELS[status]}</Text>
                {lead.status === status && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sequence Modal */}
      <Modal
        visible={showSequenceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSequenceModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSequenceModal(false)}
        >
          <View style={[styles.modalContent, styles.sequenceModal]}>
            <Text style={styles.modalTitle}>Select Sequence</Text>
            <ScrollView style={styles.sequenceList}>
              {sequences.map((sequence) => (
                <SequenceCard
                  key={sequence.id}
                  sequence={sequence}
                  onPress={() => handleAssignSequence(sequence.id)}
                  selected={lead.current_sequence_id === sequence.id}
                />
              ))}
            </ScrollView>
            {assigningSequence && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            )}
          </View>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
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
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  name: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  contactInfo: {
    gap: SPACING.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  contactText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  sequenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sequenceText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  assignText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
  },
  notesText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  actions: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionButton: {
    marginBottom: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusOptionText: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
  },
  sequenceModal: {
    maxHeight: '70%',
  },
  sequenceList: {
    maxHeight: 400,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
