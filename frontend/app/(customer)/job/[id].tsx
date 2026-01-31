import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/services/api';
import { io, Socket } from 'socket.io-client';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const STATUS_CONFIG: { [key: string]: { label: string; color: string; icon: keyof typeof Ionicons.glyphMap } } = {
  pending: { label: 'Creating Request', color: '#FF9500', icon: 'hourglass' },
  matching: { label: 'Finding Provider', color: '#007AFF', icon: 'search' },
  accepted: { label: 'Provider Assigned', color: '#34C759', icon: 'checkmark-circle' },
  en_route: { label: 'Provider En Route', color: '#007AFF', icon: 'car' },
  arrived: { label: 'Provider Arrived', color: '#34C759', icon: 'location' },
  in_progress: { label: 'Service In Progress', color: '#5856D6', icon: 'construct' },
  completed: { label: 'Completed', color: '#34C759', icon: 'checkmark-done' },
  cancelled: { label: 'Cancelled', color: '#FF3B30', icon: 'close-circle' },
};

const SERVICE_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  gas_delivery: 'flame',
  towing: 'car',
  tire_repair: 'disc',
  mechanic: 'construct',
  car_wash: 'water',
};

export default function JobTrackingScreen() {
  const router = useRouter();
  const { id, autoDispatch } = useLocalSearchParams<{ id: string; autoDispatch?: string }>();
  
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [providerLocation, setProviderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
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

  useEffect(() => {
    if (autoDispatch === 'true' && job?.status === 'pending') {
      handleDispatch();
    }
  }, [job, autoDispatch]);

  const loadJob = async () => {
    try {
      const data = await api.getJob(id);
      setJob(data);
      
      if (data.provider?.location) {
        setProviderLocation(data.provider.location);
      }
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

    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      socketRef.current?.emit('join_job', { job_id: id });
    });

    socketRef.current.on(`job_${id}_update`, (data: any) => {
      console.log('Job update:', data);
      setJob((prev: any) => prev ? { ...prev, status: data.status, provider_id: data.provider_id } : prev);
      loadJob(); // Refresh full job data
    });

    socketRef.current.on(`job_${id}_location`, (data: any) => {
      console.log('Location update:', data);
      setProviderLocation(data.provider_location);
    });
  };

  const handleDispatch = async () => {
    try {
      await api.dispatchJob(id);
      setJob((prev: any) => prev ? { ...prev, status: 'matching' } : prev);
    } catch (error: any) {
      console.error('Dispatch error:', error);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.cancelJob(id, 'Customer requested cancellation');
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Could not cancel request');
            }
          },
        },
      ]
    );
  };

  const handleCallProvider = () => {
    if (job?.provider?.phone) {
      Linking.openURL(`tel:${job.provider.phone}`);
    }
  };

  const handleStartNavigation = () => {
    if (!job?.pickup_location) return;

    const { lat, lng } = job.pickup_location;
    const label = encodeURIComponent(job.pickup_address || 'Destination');

    if (Platform.OS === 'ios') {
      // Open Apple Maps with option for Google Maps
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
      // Android
      Linking.openURL(`google.navigation:q=${lat},${lng}`).catch(() =>
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
      );
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

  const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const isActive = ['matching', 'accepted', 'en_route', 'arrived', 'in_progress'].includes(job.status);
  const canCancel = ['pending', 'matching'].includes(job.status);
  const showProviderControls = ['accepted', 'en_route', 'arrived', 'in_progress'].includes(job.status);

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Placeholder - Full Screen Background */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={60} color="#333" />
          <Text style={styles.mapPlaceholderText}>Map View</Text>
          <Text style={styles.mapPlaceholderSubtext}>
            {providerLocation
              ? `Provider at: ${providerLocation.lat.toFixed(4)}, ${providerLocation.lng.toFixed(4)}`
              : 'Waiting for provider location...'}
          </Text>
        </View>
      </View>

      {/* Top Status Card */}
      <View style={styles.topCard}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.serviceInfo}>
          <View style={[styles.serviceIconBg, { backgroundColor: `${statusConfig.color}20` }]}>
            <Ionicons
              name={SERVICE_ICONS[job.service_type] || 'help'}
              size={24}
              color={statusConfig.color}
            />
          </View>
          <View>
            <Text style={styles.serviceType}>
              {job.service_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>

        {job.provider && (
          <View style={styles.providerInfo}>
            <View style={styles.providerAvatar}>
              <Text style={styles.providerAvatarText}>
                {job.provider.name?.charAt(0) || 'P'}
              </Text>
            </View>
            <View style={styles.providerDetails}>
              <Text style={styles.providerName}>{job.provider.name}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>{job.provider.rating?.toFixed(1) || '5.0'}</Text>
              </View>
            </View>
          </View>
        )}

        {eta && (
          <View style={styles.etaContainer}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text style={styles.etaValue}>{eta} min</Text>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Status Timeline */}
        {isActive && (
          <View style={styles.timeline}>
            {['matching', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed'].map((status, index) => {
              const statusIndex = ['matching', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed'].indexOf(job.status);
              const isCompleted = index <= statusIndex;
              const isCurrent = status === job.status;

              return (
                <View key={status} style={styles.timelineItem}>
                  <View style={[
                    styles.timelineDot,
                    isCompleted && styles.timelineDotActive,
                    isCurrent && styles.timelineDotCurrent,
                  ]} />
                  {index < 5 && (
                    <View style={[
                      styles.timelineLine,
                      isCompleted && styles.timelineLineActive,
                    ]} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Provider Action Buttons */}
        {showProviderControls && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={handleStartNavigation}
            >
              <Ionicons name="navigate" size={28} color="#fff" />
              <Text style={styles.navigationButtonText}>Navigate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCallProvider}
            >
              <Ionicons name="call" size={28} color="#fff" />
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.chatButton}>
              <Ionicons name="chatbubble" size={28} color="#fff" />
              <Text style={styles.chatButtonText}>Chat</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Matching Animation */}
        {job.status === 'matching' && (
          <View style={styles.matchingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.matchingText}>Looking for nearby providers...</Text>
          </View>
        )}

        {/* Job Details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={20} color="#007AFF" />
            <Text style={styles.detailText} numberOfLines={2}>{job.pickup_address}</Text>
          </View>
          {job.destination_address && (
            <View style={styles.detailRow}>
              <Ionicons name="flag" size={20} color="#34C759" />
              <Text style={styles.detailText} numberOfLines={2}>{job.destination_address}</Text>
            </View>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total</Text>
            <Text style={styles.priceValue}>${(job.final_price || job.estimated_price).toFixed(2)}</Text>
          </View>
        </View>

        {/* Cancel Button */}
        {canCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel Request</Text>
          </TouchableOpacity>
        )}

        {/* Completed Actions */}
        {job.status === 'completed' && (
          <View style={styles.completedActions}>
            <TouchableOpacity
              style={styles.rateButton}
              onPress={() => router.push({
                pathname: '/(customer)/job/rate',
                params: { id: job.id, providerId: job.provider_id }
              })}
            >
              <Ionicons name="star" size={24} color="#FFD700" />
              <Text style={styles.rateButtonText}>Rate & Tip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.homeButton}
              onPress={() => router.replace('/(customer)')}
            >
              <Text style={styles.homeButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
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
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#666',
    fontSize: 18,
    marginTop: 16,
  },
  mapPlaceholderSubtext: {
    color: '#444',
    fontSize: 14,
    marginTop: 8,
  },
  topCard: {
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    marginHorizontal: 16,
    marginTop: 8,
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
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  providerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  providerDetails: {
    marginLeft: 12,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    color: '#888',
    marginLeft: 4,
  },
  etaContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: 12,
    color: '#888',
  },
  etaValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: '#333',
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  timelineDotActive: {
    backgroundColor: '#34C759',
  },
  timelineDotCurrent: {
    backgroundColor: '#007AFF',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelineLine: {
    width: 40,
    height: 3,
    backgroundColor: '#333',
  },
  timelineLineActive: {
    backgroundColor: '#34C759',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  navigationButton: {
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 100,
  },
  navigationButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
  },
  callButton: {
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 80,
  },
  callButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: '#5856D6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 80,
  },
  chatButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
  },
  matchingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  matchingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
  detailsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailText: {
    flex: 1,
    color: '#fff',
    marginLeft: 12,
    fontSize: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  priceLabel: {
    color: '#888',
    fontSize: 16,
  },
  priceValue: {
    color: '#007AFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 12,
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  completedActions: {
    gap: 12,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
  },
  rateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  homeButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
