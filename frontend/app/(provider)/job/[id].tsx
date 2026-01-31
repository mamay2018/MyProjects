import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../../src/services/api';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const STATUS_CONFIG: { [key: string]: { label: string; nextStatus: string; nextLabel: string } } = {
  accepted: { label: 'Job Accepted', nextStatus: 'en_route', nextLabel: 'Start Navigation' },
  en_route: { label: 'On The Way', nextStatus: 'arrived', nextLabel: 'I Have Arrived' },
  arrived: { label: 'Arrived', nextStatus: 'in_progress', nextLabel: 'Start Service' },
  in_progress: { label: 'In Progress', nextStatus: 'completed', nextLabel: 'Complete Job' },
  completed: { label: 'Completed', nextStatus: '', nextLabel: '' },
};

export default function ProviderJobScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    loadJob();
    setupSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  const loadJob = async () => {
    try {
      const data = await api.getJob(id);
      setJob(data);
    } catch (error) {
      console.error('Error loading job:', error);
      Alert.alert('Error', 'Could not load job details');
    } finally {
      setIsLoading(false);
    }
  };

  const setupSocket = () => {
    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket'],
    });

    socketRef.current.on(`job_${id}_update`, (data: any) => {
      setJob((prev: any) => prev ? { ...prev, status: data.status } : prev);
    });
  };

  const handleUpdateStatus = async () => {
    if (!job) return;
    
    const nextStatus = STATUS_CONFIG[job.status]?.nextStatus;
    if (!nextStatus) return;

    // If completing, require proof photo for gas delivery
    if (nextStatus === 'completed' && job.service_type === 'gas_delivery' && !proofPhoto) {
      Alert.alert('Photo Required', 'Please take a proof photo before completing the job.');
      return;
    }

    setIsUpdating(true);
    try {
      // Upload proof photo if completing
      if (nextStatus === 'completed' && proofPhoto) {
        await api.uploadProofPhoto(id, proofPhoto, completionNotes);
      }
      
      await api.updateJobStatus(id, nextStatus);
      setJob((prev: any) => prev ? { ...prev, status: nextStatus } : prev);
      
      if (nextStatus === 'completed') {
        Alert.alert('Job Completed!', 'Great work! The customer has been notified.', [
          { text: 'OK', onPress: () => router.replace('/(provider)') },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCallCustomer = () => {
    if (job?.customer?.phone) {
      Linking.openURL(`tel:${job.customer.phone}`);
    }
  };

  const handleStartNavigation = () => {
    if (!job?.pickup_location) return;

    const { lat, lng } = job.pickup_location;

    if (Platform.OS === 'ios') {
      Alert.alert(
        'Open Navigation',
        'Choose your navigation app',
        [
          {
            text: 'Apple Maps',
            onPress: () => Linking.openURL(`maps:?daddr=${lat},${lng}&dirflg=d`),
          },
          {
            text: 'Google Maps',
            onPress: () => Linking.openURL(`comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`).catch(() =>
              Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
            ),
          },
          {
            text: 'Waze',
            onPress: () => Linking.openURL(`waze://?ll=${lat},${lng}&navigate=yes`).catch(() =>
              Alert.alert('Waze not installed')
            ),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      Linking.openURL(`google.navigation:q=${lat},${lng}`).catch(() =>
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
      );
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setProofPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
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

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Job not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[job.status];
  const canAdvance = ['accepted', 'en_route', 'arrived', 'in_progress'].includes(job.status);
  const showProofUpload = job.status === 'in_progress';

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={60} color="#333" />
          <Text style={styles.mapPlaceholderText}>Navigation Map</Text>
        </View>
      </View>

      {/* Top Status Card */}
      <View style={styles.topCard}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{statusConfig?.label || job.status}</Text>
        </View>

        <View style={styles.customerInfo}>
          <View style={styles.customerAvatar}>
            <Ionicons name="person" size={24} color="#fff" />
          </View>
          <View style={styles.customerDetails}>
            <Text style={styles.customerName}>{job.customer?.name || 'Customer'}</Text>
            <Text style={styles.serviceType}>
              {job.service_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </Text>
          </View>
          <Text style={styles.payoutAmount}>
            ${(job.provider_payout || job.estimated_price * 0.85).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Location Details */}
        <View style={styles.locationCard}>
          <View style={styles.locationRow}>
            <View style={styles.locationIconBg}>
              <Ionicons name="location" size={20} color="#007AFF" />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Pickup Location</Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {job.pickup_address}
              </Text>
            </View>
          </View>
          {job.destination_address && (
            <View style={[styles.locationRow, { marginTop: 12 }]}>
              <View style={[styles.locationIconBg, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                <Ionicons name="flag" size={20} color="#34C759" />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Destination</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {job.destination_address}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Service Details */}
        {job.service_details && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Service Details</Text>
            {job.service_type === 'gas_delivery' && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Fuel Type</Text>
                  <Text style={styles.detailValue}>
                    {job.service_details.fuel_type?.charAt(0).toUpperCase() + job.service_details.fuel_type?.slice(1)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Gallons</Text>
                  <Text style={styles.detailValue}>{job.service_details.gallons} gal</Text>
                </View>
              </>
            )}
            {job.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Customer Notes:</Text>
                <Text style={styles.notesText}>{job.notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Proof Photo Upload (for completion) */}
        {showProofUpload && (
          <View style={styles.proofSection}>
            <Text style={styles.proofTitle}>Proof of Completion</Text>
            
            {proofPhoto ? (
              <View style={styles.proofPreview}>
                <Image source={{ uri: proofPhoto }} style={styles.proofImage} />
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => setProofPhoto(null)}
                >
                  <Ionicons name="refresh" size={20} color="#FF3B30" />
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={32} color="#007AFF" />
                <Text style={styles.photoButtonText}>Take Proof Photo</Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.notesInput}
              placeholder="Add completion notes (optional)"
              placeholderTextColor="#666"
              value={completionNotes}
              onChangeText={setCompletionNotes}
              multiline
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.callButton} onPress={handleCallCustomer}>
            <Ionicons name="call" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.chatButton}>
            <Ionicons name="chatbubble" size={24} color="#fff" />
          </TouchableOpacity>

          {job.status === 'accepted' && (
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={handleStartNavigation}
            >
              <Ionicons name="navigate" size={24} color="#fff" />
              <Text style={styles.navigateButtonText}>Navigate</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Main Action Button */}
        {canAdvance && (
          <TouchableOpacity
            style={[
              styles.mainActionButton,
              job.status === 'in_progress' && styles.completeButton,
            ]}
            onPress={handleUpdateStatus}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={job.status === 'in_progress' ? 'checkmark-circle' : 'arrow-forward'}
                  size={24}
                  color="#fff"
                />
                <Text style={styles.mainActionText}>
                  {statusConfig?.nextLabel || 'Continue'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
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
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  mapContainer: {
    height: '35%',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#666',
    marginTop: 8,
  },
  topCard: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerDetails: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  serviceType: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  payoutAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34C759',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '55%',
  },
  locationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#fff',
  },
  detailsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#888',
  },
  detailValue: {
    color: '#fff',
    fontWeight: '500',
  },
  notesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  notesLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  notesText: {
    color: '#fff',
  },
  proofSection: {
    marginBottom: 16,
  },
  proofTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  photoButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  photoButtonText: {
    color: '#007AFF',
    marginTop: 8,
    fontWeight: '500',
  },
  proofPreview: {
    alignItems: 'center',
    marginBottom: 12,
  },
  proofImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retakeText: {
    color: '#FF3B30',
    marginLeft: 4,
  },
  notesInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    marginTop: 12,
    minHeight: 60,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  callButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#5856D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  navigateButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  mainActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
  },
  completeButton: {
    backgroundColor: '#34C759',
  },
  mainActionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});
