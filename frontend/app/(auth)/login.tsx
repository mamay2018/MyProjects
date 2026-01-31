import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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

export default function LoginScreen() {
  const router = useRouter();
  const { sendOtp, login } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [testOtp, setTestOtp] = useState<string | null>(null);
  
  const otpInputRef = useRef<TextInput>(null);

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone}`;
      const response = await sendOtp(formattedPhone);
      
      // For MVP testing, show the OTP
      if (response.otp_for_testing) {
        setTestOtp(response.otp_for_testing);
      }
      
      setStep('otp');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone}`;
      await login(formattedPhone, otp);
      router.replace('/(auth)/role-select');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => step === 'otp' ? setStep('phone') : router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'phone' ? 'Enter your phone' : 'Verify your number'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? "We'll send you a verification code"
              : `Code sent to ${phone}`}
          </Text>
        </View>

        {step === 'phone' ? (
          <View style={styles.inputContainer}>
            <View style={styles.phoneInputWrapper}>
              <Text style={styles.countryCode}>+1</Text>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
                placeholder="(555) 123-4567"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
              />
            </View>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              ref={otpInputRef}
              style={styles.otpInput}
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ''))}
              placeholder="000000"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />
            
            {testOtp && (
              <View style={styles.testOtpContainer}>
                <Text style={styles.testOtpLabel}>Test OTP (for development):</Text>
                <Text style={styles.testOtpValue}>{testOtp}</Text>
              </View>
            )}

            <TouchableOpacity onPress={handleSendOtp} disabled={isLoading}>
              <Text style={styles.resendText}>Didn't receive code? Resend</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.continueButton,
            (step === 'phone' ? phone.length < 10 : otp.length !== 6) && styles.continueButtonDisabled,
          ]}
          onPress={step === 'phone' ? handleSendOtp : handleVerifyOtp}
          disabled={isLoading || (step === 'phone' ? phone.length < 10 : otp.length !== 6)}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>
              {step === 'phone' ? 'Send Code' : 'Verify'}
            </Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginTop: 8,
  },
  header: {
    marginTop: 32,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  inputContainer: {
    marginBottom: 32,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  countryCode: {
    fontSize: 18,
    color: '#fff',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    color: '#fff',
    paddingVertical: 16,
  },
  otpInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 32,
    color: '#fff',
    letterSpacing: 16,
  },
  testOtpContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    alignItems: 'center',
  },
  testOtpLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  testOtpValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 8,
  },
  resendText: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#333',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
