import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/authStore';
import { businessAPI } from '../src/api';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { COLORS, SPACING, FONTS } from '../src/constants/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  const { loadUser, setBusiness } = useAuthStore();
  
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!businessName || !ownerName) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await businessAPI.create({
        business_name: businessName,
        owner_name: ownerName,
        phone: phone || undefined,
        email: email || undefined,
        timezone: 'America/New_York',
      });
      setBusiness(response.data);
      await loadUser();
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not create business profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="business" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Set Up Your Business</Text>
            <Text style={styles.subtitle}>
              Tell us about your business to personalize your follow-ups
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Business Name *"
              placeholder="e.g., Smith Plumbing Services"
              value={businessName}
              onChangeText={setBusinessName}
              autoCapitalize="words"
            />

            <Input
              label="Your Name *"
              placeholder="e.g., John Smith"
              value={ownerName}
              onChangeText={setOwnerName}
              autoCapitalize="words"
            />

            <Input
              label="Business Phone"
              placeholder="(555) 123-4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Input
              label="Business Email"
              placeholder="contact@yourbusiness.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Button
              title="Complete Setup"
              onPress={handleSubmit}
              loading={loading}
              style={styles.button}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: SPACING.lg,
  },
});
