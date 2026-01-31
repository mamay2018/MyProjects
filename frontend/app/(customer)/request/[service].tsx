import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../../src/context/AuthContext';
import { api } from '../../../src/services/api';

const { width } = Dimensions.get('window');

interface ServiceConfig {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  fields: 'gas' | 'towing' | 'repair' | 'wash';
}

const SERVICE_CONFIGS: { [key: string]: ServiceConfig } = {
  gas_delivery: {
    name: 'Gas Delivery',
    icon: 'flame',
    color: '#FF9500',
    fields: 'gas',
  },
  towing: {
    name: 'Towing',
    icon: 'car',
    color: '#007AFF',
    fields: 'towing',
  },
  tire_repair: {
    name: 'Tire Repair',
    icon: 'disc',
    color: '#5856D6',
    fields: 'repair',
  },
  mechanic: {
    name: 'Mobile Mechanic',
    icon: 'construct',
    color: '#34C759',
    fields: 'repair',
  },
  car_wash: {
    name: 'Mobile Car Wash',
    icon: 'water',
    color: '#00C7BE',
    fields: 'wash',
  },
};

const FUEL_TYPES = ['regular', 'mid', 'premium', 'diesel'];
const GALLON_OPTIONS = [2, 5, 10];
const WASH_TYPES = ['basic', 'standard', 'premium', 'detail'];

export default function ServiceRequestScreen() {
  const router = useRouter();
  const { service } = useLocalSearchParams<{ service: string }>();
  const { user } = useAuth();
  
  const [step, setStep] = useState<'location' | 'details' | 'quote' | 'confirm'>('location');
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Location state
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationLocation, setDestinationLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationAddress, setDestinationAddress] = useState('');
  
  // Service details state
  const [fuelType, setFuelType] = useState('regular');
  const [gallons, setGallons] = useState(5);
  const [customGallons, setCustomGallons] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [washType, setWashType] = useState('standard');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [notes, setNotes] = useState('');
  
  // Quote state
  const [quote, setQuote] = useState<any>(null);

  const serviceConfig = SERVICE_CONFIGS[service || ''] || SERVICE_CONFIGS.gas_delivery;

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to use this service.');
    }
  };

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const { latitude, longitude } = location.coords;
      setPickupLocation({ lat: latitude, lng: longitude });
      
      // Reverse geocode
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (address) {
        const formattedAddress = `${address.streetNumber || ''} ${address.street || ''}, ${address.city || ''}, ${address.region || ''}`;
        setPickupAddress(formattedAddress.trim());
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get your location. Please enter it manually.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const getServiceDetails = () => {
    switch (serviceConfig.fields) {
      case 'gas':
        return {
          fuel_type: fuelType,
          gallons: customGallons ? parseInt(customGallons) : gallons,
        };
      case 'towing':
        return {
          issue: issueDescription,
          vehicle_info: vehicleInfo,
        };
      case 'repair':
        return {
          issue: issueDescription,
          vehicle_info: vehicleInfo,
        };
      case 'wash':
        return {
          wash_type: washType,
          vehicle_info: vehicleInfo,
        };
      default:
        return {};
    }
  };

  const handleGetQuote = async () => {
    if (!pickupLocation || !pickupAddress) {
      Alert.alert('Error', 'Please set your pickup location');
      return;
    }

    setIsLoading(true);
    try {
      const quoteData = await api.getQuote({
        service_type: service || 'gas_delivery',
        pickup_location: pickupLocation,
        destination_location: destinationLocation || undefined,
        service_details: getServiceDetails(),
      });
      setQuote(quoteData);
      setStep('quote');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not get quote');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!user || !pickupLocation) return;

    setIsLoading(true);
    try {
      const job = await api.createJob({
        customer_id: user.id,
        service_type: service || 'gas_delivery',
        pickup_location: pickupLocation,
        destination_location: destinationLocation || undefined,
        pickup_address: pickupAddress,
        destination_address: destinationAddress || undefined,
        service_details: getServiceDetails(),
        estimated_price: quote.total,
        notes: notes || undefined,
      });
      
      // Navigate to job tracking
      router.replace({
        pathname: '/(customer)/job/[id]',
        params: { id: job.id, autoDispatch: 'true' },
      });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not create job');
    } finally {
      setIsLoading(false);
    }
  };

  const renderLocationStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Where are you?</Text>
      <Text style={styles.stepSubtitle}>Set your current location</Text>

      <TouchableOpacity
        style={styles.locationButton}
        onPress={getCurrentLocation}
        disabled={isGettingLocation}
      >
        <View style={styles.locationIconBg}>
          {isGettingLocation ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <Ionicons name="locate" size={24} color="#007AFF" />
          )}
        </View>
        <Text style={styles.locationButtonText}>Use Current Location</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="location" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Enter pickup address"
          placeholderTextColor="#666"
          value={pickupAddress}
          onChangeText={setPickupAddress}
        />
      </View>

      {serviceConfig.fields === 'towing' && (
        <View style={styles.inputContainer}>
          <Ionicons name="flag" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Destination address (optional)"
            placeholderTextColor="#666"
            value={destinationAddress}
            onChangeText={setDestinationAddress}
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.continueButton, !pickupAddress && styles.disabledButton]}
        onPress={() => setStep('details')}
        disabled={!pickupAddress}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGasFields = () => (
    <>
      <Text style={styles.fieldLabel}>Fuel Type</Text>
      <View style={styles.optionsRow}>
        {FUEL_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.optionButton, fuelType === type && styles.optionButtonActive]}
            onPress={() => setFuelType(type)}
          >
            <Text style={[styles.optionText, fuelType === type && styles.optionTextActive]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Gallons</Text>
      <View style={styles.optionsRow}>
        {GALLON_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.gallonButton,
              gallons === option && !customGallons && styles.optionButtonActive,
            ]}
            onPress={() => {
              setGallons(option);
              setCustomGallons('');
            }}
          >
            <Text style={[
              styles.optionText,
              gallons === option && !customGallons && styles.optionTextActive,
            ]}>
              {option} gal
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.customGallonContainer}>
          <TextInput
            style={styles.customGallonInput}
            placeholder="Custom"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            value={customGallons}
            onChangeText={setCustomGallons}
            maxLength={2}
          />
        </View>
      </View>

      <View style={styles.safetyNotice}>
        <Ionicons name="warning" size={20} color="#FF9500" />
        <Text style={styles.safetyText}>
          Turn off your engine and stay away from the vehicle during fuel delivery.
        </Text>
      </View>
    </>
  );

  const renderRepairFields = () => (
    <>
      <Text style={styles.fieldLabel}>Vehicle Information</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="car" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="e.g., 2020 Honda Civic"
          placeholderTextColor="#666"
          value={vehicleInfo}
          onChangeText={setVehicleInfo}
        />
      </View>

      <Text style={styles.fieldLabel}>Describe the Issue</Text>
      <TextInput
        style={styles.textArea}
        placeholder="What's wrong with your vehicle?"
        placeholderTextColor="#666"
        value={issueDescription}
        onChangeText={setIssueDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </>
  );

  const renderWashFields = () => (
    <>
      <Text style={styles.fieldLabel}>Wash Type</Text>
      <View style={styles.washOptions}>
        {WASH_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.washOption, washType === type && styles.washOptionActive]}
            onPress={() => setWashType(type)}
          >
            <Text style={[styles.washOptionTitle, washType === type && styles.washOptionTitleActive]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
            <Text style={styles.washOptionPrice}>
              ${type === 'basic' ? '25' : type === 'standard' ? '35' : type === 'premium' ? '50' : '80'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Vehicle Type</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="car" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="e.g., Sedan, SUV, Truck"
          placeholderTextColor="#666"
          value={vehicleInfo}
          onChangeText={setVehicleInfo}
        />
      </View>
    </>
  );

  const renderDetailsStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Service Details</Text>
      <Text style={styles.stepSubtitle}>Tell us what you need</Text>

      {serviceConfig.fields === 'gas' && renderGasFields()}
      {(serviceConfig.fields === 'repair' || serviceConfig.fields === 'towing') && renderRepairFields()}
      {serviceConfig.fields === 'wash' && renderWashFields()}

      <Text style={styles.fieldLabel}>Additional Notes (Optional)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Any special instructions?"
        placeholderTextColor="#666"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={styles.continueButton}
        onPress={handleGetQuote}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.continueButtonText}>Get Quote</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderQuoteStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Your Quote</Text>
      <Text style={styles.stepSubtitle}>Review pricing before confirming</Text>

      <View style={styles.quoteCard}>
        <View style={styles.quoteRow}>
          <Text style={styles.quoteLabel}>Base Fee</Text>
          <Text style={styles.quoteValue}>${quote?.base_fee?.toFixed(2)}</Text>
        </View>
        {quote?.distance_fee > 0 && (
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>Distance Fee</Text>
            <Text style={styles.quoteValue}>${quote?.distance_fee?.toFixed(2)}</Text>
          </View>
        )}
        {quote?.service_fee > 0 && (
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>Service Fee</Text>
            <Text style={styles.quoteValue}>${quote?.service_fee?.toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.quoteRow}>
          <Text style={styles.quoteLabel}>Platform Fee</Text>
          <Text style={styles.quoteValue}>${quote?.platform_fee?.toFixed(2)}</Text>
        </View>
        <View style={styles.quoteDivider} />
        <View style={styles.quoteRow}>
          <Text style={styles.quoteTotalLabel}>Total</Text>
          <Text style={styles.quoteTotalValue}>${quote?.total?.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.etaCard}>
        <Ionicons name="time" size={24} color="#007AFF" />
        <View style={styles.etaContent}>
          <Text style={styles.etaLabel}>Estimated Arrival</Text>
          <Text style={styles.etaValue}>{quote?.estimated_arrival_minutes || 15} minutes</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={handleCreateJob}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.confirmButtonText}>Confirm & Request</Text>
            <Text style={styles.confirmButtonPrice}>${quote?.total?.toFixed(2)}</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep('details')}
      >
        <Text style={styles.backButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIconBg, { backgroundColor: `${serviceConfig.color}20` }]}>
            <Ionicons name={serviceConfig.icon} size={24} color={serviceConfig.color} />
          </View>
          <Text style={styles.headerTitle}>{serviceConfig.name}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progress}>
        {['location', 'details', 'quote'].map((s, index) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              (step === s || ['location', 'details', 'quote'].indexOf(step) > index) &&
                styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      {step === 'location' && renderLocationStep()}
      {step === 'details' && renderDetailsStep()}
      {step === 'quote' && renderQuoteStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 44,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  progressDotActive: {
    backgroundColor: '#007AFF',
    width: 24,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  locationIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#666',
    paddingHorizontal: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 16,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#333',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    marginTop: 20,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  optionButtonActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderColor: '#007AFF',
  },
  optionText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#007AFF',
  },
  gallonButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  customGallonContainer: {
    flex: 1,
  },
  customGallonInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    textAlign: 'center',
  },
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  safetyText: {
    flex: 1,
    marginLeft: 12,
    color: '#FF9500',
    fontSize: 14,
  },
  textArea: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
  },
  washOptions: {
    gap: 12,
  },
  washOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  washOptionActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderColor: '#007AFF',
  },
  washOptionTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  washOptionTitleActive: {
    color: '#007AFF',
  },
  washOptionPrice: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  quoteCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quoteLabel: {
    fontSize: 16,
    color: '#888',
  },
  quoteValue: {
    fontSize: 16,
    color: '#fff',
  },
  quoteDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 12,
  },
  quoteTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  quoteTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  etaContent: {
    marginLeft: 12,
  },
  etaLabel: {
    fontSize: 14,
    color: '#888',
  },
  etaValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  confirmButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 'auto',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  confirmButtonPrice: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
