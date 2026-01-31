import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';
import { io, Socket } from 'socket.io-client';

const { width } = Dimensions.get('window');
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const SERVICE_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  gas_delivery: 'flame',
  towing: 'car',
  tire_repair: 'disc',
  mechanic: 'construct',
  car_wash: 'water',
};

const SERVICE_COLORS: { [key: string]: string } = {
  gas_delivery: '#FF9500',
  towing: '#007AFF',
  tire_repair: '#5856D6',
  mechanic: '#34C759',
  car_wash: '#00C7BE',
};

interface JobOffer {
  id: string;
  job_id: string;
  payout_estimate: number;
  expires_at: string;
  job: {
    service_type: string;
    pickup_address: string;
    service_details: any;
    estimated_price: number;
  };
}

export default function ProviderHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [pendingOffers, setPendingOffers] = useState<JobOffer[]>([]);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<JobOffer | null>(null);
  const [offerTimer, setOfferTimer] = useState(60);
  
  const socketRef = useRef<Socket | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProviderData();
    setupSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
  }, [isOnline]);

  useEffect(() => {
    if (currentOffer && showOfferModal) {
      setOfferTimer(60);
      timerRef.current = setInterval(() => {
        setOfferTimer((prev) => {
          if (prev <= 1) {
            handleDeclineOffer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentOffer, showOfferModal]);

  const loadProviderData = async () => {
    try {
      const profileData = await api.getProviderProfile();
      setProfile(profileData);
      setIsOnline(profileData.is_online);

      const activeJobData = await api.getProviderActiveJob();
      setActiveJob(activeJobData);

      const offers = await api.getJobOffers();
      setPendingOffers(offers);
      
      if (offers.length > 0 && !currentOffer) {
        setCurrentOffer(offers[0]);
        setShowOfferModal(true);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No profile, redirect to onboarding
        router.replace('/(provider)/onboarding');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setupSocket = () => {
    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('Provider socket connected');
    });

    socketRef.current.on(`provider_${user?.id}_offer`, (data: any) => {
      console.log('New job offer:', data);
      loadProviderData(); // Refresh offers
    });

    socketRef.current.on(`provider_${user?.id}_job_cancelled`, (data: any) => {
      Alert.alert('Job Cancelled', 'The customer has cancelled the job.');
      setActiveJob(null);
    });
  };

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to go online.');
      setIsOnline(false);
      return;
    }

    locationWatchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      async (location) => {
        try {
          await api.updateProviderLocation(
            location.coords.latitude,
            location.coords.longitude
          );
        } catch (error) {
          console.error('Error updating location:', error);
        }
      }
    );
  };

  const stopLocationTracking = () => {
    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
      locationWatchRef.current = null;
    }
  };

  const handleToggleOnline = async (value: boolean) => {
    try {
      await api.toggleOnline(value);
      setIsOnline(value);
    } catch (error) {
      Alert.alert('Error', 'Could not change online status');
    }
  };

  const handleAcceptOffer = async () => {
    if (!currentOffer) return;

    try {
      const result = await api.acceptJobOffer(currentOffer.id);
      setShowOfferModal(false);
      setCurrentOffer(null);
      setActiveJob(result.job);
      router.push({
        pathname: '/(provider)/job/[id]',
        params: { id: result.job.id },
      });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not accept offer');
    }
  };

  const handleDeclineOffer = async () => {
    if (!currentOffer) return;

    try {
      await api.declineJobOffer(currentOffer.id);
      setShowOfferModal(false);
      setCurrentOffer(null);
      setPendingOffers((prev) => prev.filter((o) => o.id !== currentOffer.id));
    } catch (error) {
      console.error('Error declining offer:', error);
    }
  };

  const getVerificationStatus = (serviceType: string) => {
    return profile?.verification_status?.[serviceType] || 'pending';
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
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {profile?.name || 'Provider'}</Text>
            <Text style={styles.subtitle}>
              {isOnline ? 'You are online' : 'You are offline'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.accountButton}
            onPress={() => router.push('/(provider)/account')}
          >
            <Ionicons name="person-circle" size={40} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Online Toggle */}
        <View style={[styles.onlineCard, isOnline && styles.onlineCardActive]}>
          <View style={styles.onlineContent}>
            <View style={[styles.statusIndicator, isOnline && styles.statusIndicatorActive]} />
            <View>
              <Text style={styles.onlineTitle}>
                {isOnline ? 'Accepting Jobs' : 'Go Online'}
              </Text>
              <Text style={styles.onlineSubtitle}>
                {isOnline ? 'You will receive job offers' : 'Toggle to start receiving jobs'}
              </Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#333', true: '#34C759' }}
            thumbColor="#fff"
          />
        </View>

        {/* Active Job Card */}
        {activeJob && (
          <TouchableOpacity
            style={styles.activeJobCard}
            onPress={() => router.push({
              pathname: '/(provider)/job/[id]',
              params: { id: activeJob.id },
            })}
          >
            <View style={styles.activeJobHeader}>
              <View style={[styles.activeJobIconBg, { backgroundColor: `${SERVICE_COLORS[activeJob.service_type]}20` }]}>
                <Ionicons
                  name={SERVICE_ICONS[activeJob.service_type] || 'help'}
                  size={24}
                  color={SERVICE_COLORS[activeJob.service_type]}
                />
              </View>
              <View style={styles.activeJobInfo}>
                <Text style={styles.activeJobTitle}>Active Job</Text>
                <Text style={styles.activeJobService}>
                  {activeJob.service_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#007AFF" />
            </View>
            <View style={styles.activeJobDetails}>
              <Ionicons name="location" size={16} color="#888" />
              <Text style={styles.activeJobAddress} numberOfLines={1}>
                {activeJob.pickup_address}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(provider)/earnings')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
              <Ionicons name="wallet" size={24} color="#34C759" />
            </View>
            <Text style={styles.quickActionText}>Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(0, 122, 255, 0.1)' }]}>
              <Ionicons name="time" size={24} color="#007AFF" />
            </View>
            <Text style={styles.quickActionText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(88, 86, 214, 0.1)' }]}>
              <Ionicons name="document-text" size={24} color="#5856D6" />
            </View>
            <Text style={styles.quickActionText}>Documents</Text>
          </TouchableOpacity>
        </View>

        {/* Services Status */}
        <Text style={styles.sectionTitle}>Your Services</Text>
        <View style={styles.servicesContainer}>
          {profile?.services_offered?.map((service: string) => {
            const status = getVerificationStatus(service);
            return (
              <View key={service} style={styles.serviceItem}>
                <View style={[styles.serviceIconBg, { backgroundColor: `${SERVICE_COLORS[service]}20` }]}>
                  <Ionicons
                    name={SERVICE_ICONS[service] || 'help'}
                    size={20}
                    color={SERVICE_COLORS[service]}
                  />
                </View>
                <Text style={styles.serviceName}>
                  {service.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Text>
                <View style={[
                  styles.verificationBadge,
                  status === 'approved' && styles.approvedBadge,
                  status === 'denied' && styles.deniedBadge,
                ]}>
                  <Text style={[
                    styles.verificationText,
                    status === 'approved' && styles.approvedText,
                    status === 'denied' && styles.deniedText,
                  ]}>
                    {status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Today's Summary */}
        <Text style={styles.sectionTitle}>Today's Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>0</Text>
            <Text style={styles.summaryLabel}>Jobs</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>$0</Text>
            <Text style={styles.summaryLabel}>Earned</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>0h</Text>
            <Text style={styles.summaryLabel}>Online</Text>
          </View>
        </View>
      </ScrollView>

      {/* Job Offer Modal */}
      <Modal
        visible={showOfferModal && !!currentOffer}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.offerModal}>
            <View style={styles.offerTimerContainer}>
              <View style={styles.timerCircle}>
                <Text style={styles.timerText}>{offerTimer}</Text>
              </View>
              <Text style={styles.timerLabel}>seconds to accept</Text>
            </View>

            <Text style={styles.offerTitle}>New Job Offer!</Text>
            
            <View style={[styles.offerServiceBadge, { backgroundColor: `${SERVICE_COLORS[currentOffer?.job?.service_type || '']}20` }]}>
              <Ionicons
                name={SERVICE_ICONS[currentOffer?.job?.service_type || ''] || 'help'}
                size={32}
                color={SERVICE_COLORS[currentOffer?.job?.service_type || '']}
              />
              <Text style={[styles.offerServiceText, { color: SERVICE_COLORS[currentOffer?.job?.service_type || ''] }]}>
                {currentOffer?.job?.service_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </Text>
            </View>

            <View style={styles.offerDetails}>
              <View style={styles.offerDetailRow}>
                <Ionicons name="location" size={20} color="#888" />
                <Text style={styles.offerDetailText} numberOfLines={2}>
                  {currentOffer?.job?.pickup_address}
                </Text>
              </View>
            </View>

            <View style={styles.offerPayout}>
              <Text style={styles.payoutLabel}>Your Payout</Text>
              <Text style={styles.payoutValue}>
                ${currentOffer?.payout_estimate?.toFixed(2)}
              </Text>
            </View>

            <View style={styles.offerButtons}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={handleDeclineOffer}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={handleAcceptOffer}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  accountButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#333',
  },
  onlineCardActive: {
    borderColor: '#34C759',
  },
  onlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666',
    marginRight: 12,
  },
  statusIndicatorActive: {
    backgroundColor: '#34C759',
  },
  onlineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  onlineSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  activeJobCard: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  activeJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeJobIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activeJobInfo: {
    flex: 1,
  },
  activeJobTitle: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  activeJobService: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  activeJobDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeJobAddress: {
    flex: 1,
    marginLeft: 8,
    color: '#888',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    color: '#888',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  servicesContainer: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  serviceIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceName: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
  },
  verificationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
  },
  approvedBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  deniedBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
    textTransform: 'capitalize',
  },
  approvedText: {
    color: '#34C759',
  },
  deniedText: {
    color: '#FF3B30',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#333',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  offerModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  offerTimerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF3B30',
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  timerLabel: {
    color: '#888',
    marginTop: 8,
  },
  offerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  offerServiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  offerServiceText: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
  },
  offerDetails: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  offerDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  offerDetailText: {
    flex: 1,
    marginLeft: 12,
    color: '#fff',
    fontSize: 15,
  },
  offerPayout: {
    alignItems: 'center',
    marginBottom: 24,
  },
  payoutLabel: {
    color: '#888',
    marginBottom: 4,
  },
  payoutValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#34C759',
  },
  offerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#34C759',
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
