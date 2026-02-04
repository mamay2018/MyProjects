import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { leadsAPI } from '../../src/api';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS, CHANNEL_LABELS } from '../../src/constants/theme';
import { TouchableOpacity } from 'react-native';

const CHANNELS = ['SMS', 'EMAIL', 'BOTH'] as const;

export default function NewLeadScreen() {
  const router = useRouter();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [jobType, setJobType] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [preferredChannel, setPreferredChannel] = useState<'SMS' | 'EMAIL' | 'BOTH'>('SMS');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!fullName || !phone || !jobType) {
      Alert.alert('Error', 'Please fill in required fields (Name, Phone, Job Type)');
      return;
    }

    setLoading(true);
    try {
      await leadsAPI.create({
        full_name: fullName,
        phone,
        email: email || undefined,
        job_type: jobType,
        quote_amount: quoteAmount ? parseFloat(quoteAmount) : undefined,
        preferred_channel: preferredChannel,
        notes: notes || undefined,
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not create lead');
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Info</Text>
            
            <Input
              label="Full Name *"
              placeholder="John Smith"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
            
            <Input
              label="Phone Number *"
              placeholder="(555) 123-4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            
            <Input
              label="Email"
              placeholder="john@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Details</Text>
            
            <Input
              label="Job Type *"
              placeholder="e.g., Kitchen Remodel, Roof Repair"
              value={jobType}
              onChangeText={setJobType}
            />
            
            <Input
              label="Quote Amount"
              placeholder="5000"
              value={quoteAmount}
              onChangeText={setQuoteAmount}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Communication Preference</Text>
            
            <View style={styles.channelContainer}>
              {CHANNELS.map((channel) => (
                <TouchableOpacity
                  key={channel}
                  style={[
                    styles.channelOption,
                    preferredChannel === channel && styles.channelOptionActive
                  ]}
                  onPress={() => setPreferredChannel(channel)}
                >
                  <Ionicons 
                    name={channel === 'SMS' ? 'chatbubble' : channel === 'EMAIL' ? 'mail' : 'layers'} 
                    size={20} 
                    color={preferredChannel === channel ? '#FFFFFF' : COLORS.textSecondary} 
                  />
                  <Text style={[
                    styles.channelText,
                    preferredChannel === channel && styles.channelTextActive
                  ]}>
                    {CHANNEL_LABELS[channel]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            
            <Input
              placeholder="Any additional notes..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              style={styles.notesInput}
            />
          </View>

          <Button
            title="Create Lead"
            onPress={handleCreate}
            loading={loading}
            style={styles.button}
          />
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
    padding: SPACING.md,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  channelContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  channelOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  channelOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  channelText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  channelTextActive: {
    color: '#FFFFFF',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: SPACING.md,
  },
});
