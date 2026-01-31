import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

const SERVICES = [
  { id: 'gas_delivery', name: 'Gas Delivery', icon: 'flame', color: '#FF9500' },
  { id: 'towing', name: 'Towing', icon: 'car', color: '#007AFF' },
  { id: 'tire_repair', name: 'Tire Repair', icon: 'disc', color: '#5856D6' },
  { id: 'mechanic', name: 'Mobile Mechanic', icon: 'construct', color: '#34C759' },
  { id: 'car_wash', name: 'Car Wash', icon: 'water', color: '#00C7BE' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  
  const [step, setStep] = useState<'profile' | 'services' | 'vehicle' | 'complete'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  
  // Profile
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
  
  // Services
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  
  // Vehicle
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  const handleToggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((s) => s !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = async () => {
    if (!name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (selectedServices.length === 0) {
      Alert.alert('Error', 'Please select at least one service');
      return;
    }

    setIsLoading(true);
    try {
      await api.createProviderProfile({
        user_id: user?.id || '',
        name,
        services_offered: selectedServices,
        vehicle_info: {
          make: vehicleMake,
          model: vehicleModel,
          year: vehicleYear,
          color: vehicleColor,
          license_plate: licensePlate,
        },
        bio,
      });
      
      await refreshUser();
      setStep('complete');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not create profile');
    } finally {
      setIsLoading(false);
    }
  };

  const renderProfileStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Your Profile</Text>
      <Text style={styles.stepSubtitle}>Tell us about yourself</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Bio (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell customers about yourself and your experience"
          placeholderTextColor="#666"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[styles.continueButton, !name && styles.disabledButton]}
        onPress={() => setStep('services')}
        disabled={!name}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderServicesStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Services Offered</Text>
      <Text style={styles.stepSubtitle}>Select the services you want to provide</Text>

      <View style={styles.servicesGrid}>
        {SERVICES.map((service) => {
          const isSelected = selectedServices.includes(service.id);
          return (
            <TouchableOpacity
              key={service.id}
              style={[styles.serviceCard, isSelected && styles.serviceCardSelected]}
              onPress={() => handleToggleService(service.id)}
            >
              <View style={[styles.serviceIcon, { backgroundColor: `${service.color}20` }]}>
                <Ionicons name={service.icon as any} size={28} color={service.color} />
              </View>
              <Text style={styles.serviceCardName}>{service.name}</Text>
              {isSelected && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep('profile')}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, styles.continueButtonFlex, selectedServices.length === 0 && styles.disabledButton]}
          onPress={() => setStep('vehicle')}
          disabled={selectedServices.length === 0}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderVehicleStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Vehicle Information</Text>
      <Text style={styles.stepSubtitle}>Enter your vehicle details</Text>

      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>Make</Text>
          <TextInput
            style={styles.input}
            value={vehicleMake}
            onChangeText={setVehicleMake}
            placeholder="e.g., Toyota"
            placeholderTextColor="#666"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
          <Text style={styles.inputLabel}>Model</Text>
          <TextInput
            style={styles.input}
            value={vehicleModel}
            onChangeText={setVehicleModel}
            placeholder="e.g., Camry"
            placeholderTextColor="#666"
          />
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>Year</Text>
          <TextInput
            style={styles.input}
            value={vehicleYear}
            onChangeText={setVehicleYear}
            placeholder="e.g., 2020"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
          <Text style={styles.inputLabel}>Color</Text>
          <TextInput
            style={styles.input}
            value={vehicleColor}
            onChangeText={setVehicleColor}
            placeholder="e.g., Black"
            placeholderTextColor="#666"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>License Plate</Text>
        <TextInput
          style={styles.input}
          value={licensePlate}
          onChangeText={setLicensePlate}
          placeholder="e.g., ABC-1234"
          placeholderTextColor="#666"
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.infoText}>
          Your vehicle information helps customers identify you when you arrive.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep('services')}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, styles.continueButtonFlex]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Complete Setup</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderCompleteStep = () => (
    <View style={styles.completeContent}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={80} color="#34C759" />
      </View>
      <Text style={styles.completeTitle}>You're All Set!</Text>
      <Text style={styles.completeSubtitle}>
        Your profile is under review. You'll be notified once approved for each service.
      </Text>

      <View style={styles.nextSteps}>
        <Text style={styles.nextStepsTitle}>Next Steps:</Text>
        <View style={styles.nextStep}>
          <Ionicons name="document-text" size={20} color="#007AFF" />
          <Text style={styles.nextStepText}>Upload required documents</Text>
        </View>
        <View style={styles.nextStep}>
          <Ionicons name="card" size={20} color="#007AFF" />
          <Text style={styles.nextStepText}>Set up payout method</Text>
        </View>
        <View style={styles.nextStep}>
          <Ionicons name="time" size={20} color="#007AFF" />
          <Text style={styles.nextStepText}>Wait for admin approval</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.startButton}
        onPress={() => router.replace('/(provider)')}
      >
        <Text style={styles.startButtonText}>Go to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Become a Provider</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Progress */}
        {step !== 'complete' && (
          <View style={styles.progress}>
            {['profile', 'services', 'vehicle'].map((s, index) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  ['profile', 'services', 'vehicle'].indexOf(step) >= index && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Content */}
        {step === 'profile' && renderProfileStep()}
        {step === 'services' && renderServicesStep()}
        {step === 'vehicle' && renderVehicleStep()}
        {step === 'complete' && renderCompleteStep()}
      </KeyboardAvoidingView>
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
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
  continueButtonFlex: {
    flex: 2,
  },
  disabledButton: {
    backgroundColor: '#333',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    position: 'relative',
  },
  serviceCardSelected: {
    borderColor: '#34C759',
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceCardName: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
    marginBottom: 20,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  backButtonText: {
    color: '#888',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    color: '#007AFF',
    fontSize: 14,
    lineHeight: 20,
  },
  completeContent: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    marginBottom: 24,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  nextSteps: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nextStepText: {
    marginLeft: 12,
    color: '#888',
    fontSize: 15,
  },
  startButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
