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
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';

const SERVICE_COLORS: { [key: string]: string } = {
  gas_delivery: '#FF9500',
  towing: '#007AFF',
  tire_repair: '#5856D6',
  mechanic: '#34C759',
  car_wash: '#00C7BE',
};

export default function AdminProvidersScreen() {
  const [providers, setProviders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const data = await api.getVerificationQueue();
      setProviders(data);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProviders();
  };

  const handleApprove = async (providerId: string, serviceType: string, approved: boolean) => {
    setIsProcessing(true);
    try {
      await api.approveProvider(providerId, serviceType, approved);
      Alert.alert(
        'Success',
        `Provider ${approved ? 'approved' : 'denied'} for ${serviceType.replace('_', ' ')}`
      );
      loadProviders();
      setShowModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not process approval');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderProvider = ({ item }: { item: any }) => {
    const pendingServices = Object.entries(item.verification_status || {})
      .filter(([_, status]) => status === 'pending')
      .map(([service]) => service);

    return (
      <TouchableOpacity
        style={styles.providerCard}
        onPress={() => {
          setSelectedProvider(item);
          setShowModal(true);
        }}
      >
        <View style={styles.providerHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#fff" />
          </View>
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{item.name}</Text>
            <Text style={styles.providerServices}>
              {pendingServices.length} service(s) pending approval
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingServices.length}</Text>
          </View>
        </View>
        <View style={styles.pendingServicesRow}>
          {pendingServices.map((service) => (
            <View
              key={service}
              style={[
                styles.serviceBadge,
                { backgroundColor: `${SERVICE_COLORS[service]}20` },
              ]}
            >
              <Text style={[styles.serviceBadgeText, { color: SERVICE_COLORS[service] }]}>
                {service.replace('_', ' ')}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.title}>Provider Verification</Text>
        <Text style={styles.subtitle}>{providers.length} pending reviews</Text>
      </View>

      <FlatList
        data={providers}
        renderItem={renderProvider}
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
            <Ionicons name="checkmark-circle" size={48} color="#34C759" />
            <Text style={styles.emptyText}>No pending verifications</Text>
          </View>
        }
      />

      {/* Provider Detail Modal */}
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
            <Text style={styles.modalTitle}>Provider Details</Text>
            <View style={{ width: 28 }} />
          </View>

          {selectedProvider && (
            <ScrollView style={styles.modalContent}>
              {/* Provider Info */}
              <View style={styles.modalSection}>
                <View style={styles.modalAvatar}>
                  <Ionicons name="person" size={40} color="#fff" />
                </View>
                <Text style={styles.modalName}>{selectedProvider.name}</Text>
                {selectedProvider.bio && (
                  <Text style={styles.modalBio}>{selectedProvider.bio}</Text>
                )}
              </View>

              {/* Vehicle Info */}
              {selectedProvider.vehicle_info && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionLabel}>Vehicle Information</Text>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoText}>
                      {selectedProvider.vehicle_info.year} {selectedProvider.vehicle_info.make}{' '}
                      {selectedProvider.vehicle_info.model}
                    </Text>
                    <Text style={styles.infoSubtext}>
                      {selectedProvider.vehicle_info.color} • {selectedProvider.vehicle_info.license_plate}
                    </Text>
                  </View>
                </View>
              )}

              {/* Documents */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionLabel}>Documents ({selectedProvider.documents?.length || 0})</Text>
                {selectedProvider.documents?.map((doc: any) => (
                  <View key={doc.id} style={styles.documentCard}>
                    <Ionicons name="document" size={24} color="#007AFF" />
                    <View style={styles.documentInfo}>
                      <Text style={styles.documentType}>
                        {doc.doc_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Text>
                      <Text style={styles.documentStatus}>{doc.status}</Text>
                    </View>
                    <TouchableOpacity style={styles.viewDocButton}>
                      <Text style={styles.viewDocText}>View</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {(!selectedProvider.documents || selectedProvider.documents.length === 0) && (
                  <Text style={styles.noDocuments}>No documents uploaded yet</Text>
                )}
              </View>

              {/* Services Verification */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionLabel}>Services</Text>
                {Object.entries(selectedProvider.verification_status || {}).map(
                  ([service, status]) => (
                    <View key={service} style={styles.serviceVerificationCard}>
                      <View style={styles.serviceVerificationInfo}>
                        <Text style={styles.serviceVerificationName}>
                          {service.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            status === 'approved' && styles.statusApproved,
                            status === 'denied' && styles.statusDenied,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              status === 'approved' && { color: '#34C759' },
                              status === 'denied' && { color: '#FF3B30' },
                            ]}
                          >
                            {status as string}
                          </Text>
                        </View>
                      </View>
                      {status === 'pending' && (
                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={styles.denyButton}
                            onPress={() => handleApprove(selectedProvider.id, service, false)}
                            disabled={isProcessing}
                          >
                            <Ionicons name="close" size={20} color="#FF3B30" />
                            <Text style={styles.denyButtonText}>Deny</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.approveButton}
                            onPress={() => handleApprove(selectedProvider.id, service, true)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <>
                                <Ionicons name="checkmark" size={20} color="#fff" />
                                <Text style={styles.approveButtonText}>Approve</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )
                )}
              </View>
            </ScrollView>
          )}
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
    paddingBottom: 16,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  providerCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  providerServices: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  pendingServicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  serviceBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#888',
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
    marginBottom: 24,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  modalBio: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoText: {
    fontSize: 16,
    color: '#fff',
  },
  infoSubtext: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentType: {
    fontSize: 14,
    color: '#fff',
  },
  documentStatus: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  viewDocButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
  viewDocText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '500',
  },
  noDocuments: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  serviceVerificationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  serviceVerificationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceVerificationName: {
    fontSize: 16,
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
  },
  statusApproved: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  statusDenied: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
    textTransform: 'capitalize',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  denyButtonText: {
    color: '#FF3B30',
    marginLeft: 6,
    fontWeight: '600',
  },
  approveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#34C759',
  },
  approveButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
});
