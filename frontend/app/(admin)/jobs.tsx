import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { format } from 'date-fns';

const SERVICE_COLORS: { [key: string]: string } = {
  gas_delivery: '#FF9500',
  towing: '#007AFF',
  tire_repair: '#5856D6',
  mechanic: '#34C759',
  car_wash: '#00C7BE',
};

const STATUS_COLORS: { [key: string]: string } = {
  pending: '#FF9500',
  matching: '#007AFF',
  accepted: '#34C759',
  en_route: '#007AFF',
  arrived: '#34C759',
  in_progress: '#5856D6',
  completed: '#34C759',
  cancelled: '#FF3B30',
};

export default function AdminJobsScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [filter, setFilter] = useState<'active' | 'all' | 'completed'>('active');

  useEffect(() => {
    loadJobs();
  }, [filter]);

  const loadJobs = async () => {
    try {
      let data;
      if (filter === 'active') {
        data = await api.getLiveJobs();
      } else {
        const status = filter === 'completed' ? 'completed' : undefined;
        data = await api.getAdminJobs(status);
      }
      setJobs(data);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const handleReassign = async (jobId: string) => {
    Alert.alert(
      'Reassign Job',
      'This will remove the current provider and look for a new one. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reassign',
          onPress: async () => {
            try {
              await api.reassignJob(jobId);
              Alert.alert('Success', 'Job reassigned');
              loadJobs();
              setShowModal(false);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Could not reassign job');
            }
          },
        },
      ]
    );
  };

  const handleRefund = async () => {
    if (!selectedJob || !refundAmount || !refundReason) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const amount = parseFloat(refundAmount);
      const isFullRefund = amount >= (selectedJob.final_price || selectedJob.estimated_price);
      
      await api.processRefund(selectedJob.id, amount, refundReason, isFullRefund);
      Alert.alert('Success', 'Refund processed');
      setShowRefundModal(false);
      setShowModal(false);
      setRefundAmount('');
      setRefundReason('');
      loadJobs();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not process refund');
    }
  };

  const renderJob = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => {
        setSelectedJob(item);
        setShowModal(true);
      }}
    >
      <View style={styles.jobHeader}>
        <View style={[
          styles.serviceIndicator,
          { backgroundColor: SERVICE_COLORS[item.service_type] || '#007AFF' },
        ]} />
        <View style={styles.jobInfo}>
          <Text style={styles.jobService}>
            {item.service_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
          </Text>
          <Text style={styles.jobId}>#{item.id.slice(-8)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[item.status]}20` }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
            {item.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.jobDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color="#888" />
          <Text style={styles.detailText} numberOfLines={1}>
            {item.pickup_address}
          </Text>
        </View>
        {item.customer && (
          <View style={styles.detailRow}>
            <Ionicons name="person" size={16} color="#888" />
            <Text style={styles.detailText}>
              {item.customer.name || 'Customer'} • {item.customer.phone}
            </Text>
          </View>
        )}
        {item.provider && (
          <View style={styles.detailRow}>
            <Ionicons name="construct" size={16} color="#34C759" />
            <Text style={[styles.detailText, { color: '#34C759' }]}>
              {item.provider.name || 'Provider'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.jobFooter}>
        <Text style={styles.jobDate}>
          {format(new Date(item.created_at), 'MMM d, h:mm a')}
        </Text>
        <Text style={styles.jobPrice}>
          ${(item.final_price || item.estimated_price).toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Jobs</Text>
        <Text style={styles.subtitle}>{jobs.length} jobs</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(['active', 'all', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={jobs}
        renderItem={renderJob}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>No jobs found</Text>
          </View>
        }
      />

      {/* Job Detail Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Job Details</Text>
            <View style={{ width: 28 }} />
          </View>

          {selectedJob && (
            <View style={styles.modalContent}>
              {/* Job Status */}
              <View style={styles.modalSection}>
                <View style={[
                  styles.statusBadgeLarge,
                  { backgroundColor: `${STATUS_COLORS[selectedJob.status]}20` },
                ]}>
                  <Text style={[styles.statusTextLarge, { color: STATUS_COLORS[selectedJob.status] }]}>
                    {selectedJob.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Job Info */}
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Service</Text>
                <Text style={styles.infoValue}>
                  {selectedJob.service_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Text>
                
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{selectedJob.pickup_address}</Text>
                
                <Text style={styles.infoLabel}>Price</Text>
                <Text style={styles.infoValue}>
                  ${(selectedJob.final_price || selectedJob.estimated_price).toFixed(2)}
                </Text>

                {selectedJob.customer && (
                  <>
                    <Text style={styles.infoLabel}>Customer</Text>
                    <Text style={styles.infoValue}>
                      {selectedJob.customer.name || 'N/A'} • {selectedJob.customer.phone}
                    </Text>
                  </>
                )}

                {selectedJob.provider && (
                  <>
                    <Text style={styles.infoLabel}>Provider</Text>
                    <Text style={styles.infoValue}>{selectedJob.provider.name || 'N/A'}</Text>
                  </>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actionSection}>
                {['accepted', 'en_route', 'arrived', 'in_progress'].includes(selectedJob.status) && (
                  <TouchableOpacity
                    style={styles.reassignButton}
                    onPress={() => handleReassign(selectedJob.id)}
                  >
                    <Ionicons name="swap-horizontal" size={20} color="#FF9500" />
                    <Text style={styles.reassignButtonText}>Reassign Job</Text>
                  </TouchableOpacity>
                )}

                {selectedJob.status === 'completed' && (
                  <TouchableOpacity
                    style={styles.refundButton}
                    onPress={() => setShowRefundModal(true)}
                  >
                    <Ionicons name="cash" size={20} color="#FF3B30" />
                    <Text style={styles.refundButtonText}>Process Refund</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Refund Modal */}
      <Modal
        visible={showRefundModal}
        animationType="slide"
        transparent
      >
        <View style={styles.refundModalOverlay}>
          <View style={styles.refundModalContent}>
            <Text style={styles.refundModalTitle}>Process Refund</Text>
            
            <Text style={styles.inputLabel}>Amount ($)</Text>
            <TextInput
              style={styles.input}
              value={refundAmount}
              onChangeText={setRefundAmount}
              placeholder="0.00"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
            />

            <Text style={styles.inputLabel}>Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={refundReason}
              onChangeText={setRefundReason}
              placeholder="Enter reason for refund"
              placeholderTextColor="#666"
              multiline
            />

            <View style={styles.refundButtons}>
              <TouchableOpacity
                style={styles.cancelRefundButton}
                onPress={() => setShowRefundModal(false)}
              >
                <Text style={styles.cancelRefundText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmRefundButton}
                onPress={handleRefund}
              >
                <Text style={styles.confirmRefundText}>Process Refund</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
  },
  filterTabText: {
    color: '#888',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  jobCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobService: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  jobId: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  jobDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    flex: 1,
    marginLeft: 8,
    color: '#888',
    fontSize: 13,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  jobDate: {
    fontSize: 12,
    color: '#666',
  },
  jobPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    marginTop: 12,
    fontSize: 16,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadgeLarge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statusTextLarge: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
  },
  infoValue: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
  },
  actionSection: {
    marginTop: 24,
    gap: 12,
  },
  reassignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  reassignButtonText: {
    color: '#FF9500',
    marginLeft: 8,
    fontWeight: '600',
  },
  refundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  refundButtonText: {
    color: '#FF3B30',
    marginLeft: 8,
    fontWeight: '600',
  },
  // Refund Modal
  refundModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  refundModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
  },
  refundModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  refundButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelRefundButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  cancelRefundText: {
    color: '#888',
    fontWeight: '600',
  },
  confirmRefundButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FF3B30',
  },
  confirmRefundText: {
    color: '#fff',
    fontWeight: '600',
  },
});
