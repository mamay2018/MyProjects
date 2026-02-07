import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { leadsAPI, leadSourceAPI, followUpPlanAPI } from '../../src/api';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS } from '../../src/constants/theme';
import { LeadSource, FollowUpPlan } from '../../src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SOURCE_KEY = 'last_used_source_id';

export default function NewLeadScreen() {
  const router = useRouter();
  
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [plans, setPlans] = useState<FollowUpPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPasteMode, setShowPasteMode] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [sourcesRes, plansRes] = await Promise.all([
        leadSourceAPI.getAll(),
        followUpPlanAPI.getAll(),
      ]);
      setSources(sourcesRes.data);
      setPlans(plansRes.data);
      
      // Load last used source
      const lastSourceId = await AsyncStorage.getItem(LAST_SOURCE_KEY);
      if (lastSourceId && sourcesRes.data.find((s: LeadSource) => s.id === lastSourceId)) {
        setSelectedSourceId(lastSourceId);
      } else {
        // Default to "Referral" or first source
        const defaultSource = sourcesRes.data.find((s: LeadSource) => s.is_default) || sourcesRes.data[0];
        if (defaultSource) {
          setSelectedSourceId(defaultSource.id);
        }
      }
      
      // Default to first enabled plan
      const enabledPlan = plansRes.data.find((p: FollowUpPlan) => p.enabled);
      if (enabledPlan) {
        setSelectedPlanId(enabledPlan.id);
      }
    } catch (error) {
      console.log('Error loading initial data:', error);
    }
  };

  const handleCreate = async () => {
    if (!customerName) {
      Alert.alert('Error', 'Please enter a customer name');
      return;
    }

    setLoading(true);
    try {
      await leadsAPI.create({
        customer_name: customerName,
        customer_phone: phone || undefined,
        customer_email: email || undefined,
        lead_source_id: selectedSourceId || undefined,
        notes: notes || pastedText || undefined,
        follow_up_plan_id: selectedPlanId || undefined,
      });
      
      // Save last used source
      if (selectedSourceId) {
        await AsyncStorage.setItem(LAST_SOURCE_KEY, selectedSourceId);
      }
      
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not create lead');
    } finally {
      setLoading(false);
    }
  };

  const renderSourceSelector = () => (
    <View style={styles.sourceContainer}>
      {sources.map((source) => (
        <TouchableOpacity
          key={source.id}
          style={[
            styles.sourceChip,
            selectedSourceId === source.id && styles.sourceChipActive,
            { borderColor: source.color }
          ]}
          onPress={() => setSelectedSourceId(source.id)}
        >
          <View style={[styles.sourceDot, { backgroundColor: source.color }]} />
          <Text style={[
            styles.sourceText,
            selectedSourceId === source.id && styles.sourceTextActive
          ]} numberOfLines={1}>
            {source.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

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
          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, !showPasteMode && styles.modeButtonActive]}
              onPress={() => setShowPasteMode(false)}
            >
              <Ionicons name="create-outline" size={20} color={!showPasteMode ? '#FFF' : COLORS.textSecondary} />
              <Text style={[styles.modeButtonText, !showPasteMode && styles.modeButtonTextActive]}>Manual Entry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, showPasteMode && styles.modeButtonActive]}
              onPress={() => setShowPasteMode(true)}
            >
              <Ionicons name="clipboard-outline" size={20} color={showPasteMode ? '#FFF' : COLORS.textSecondary} />
              <Text style={[styles.modeButtonText, showPasteMode && styles.modeButtonTextActive]}>Paste Text</Text>
            </TouchableOpacity>
          </View>

          {showPasteMode ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Paste Lead Info</Text>
              <Text style={styles.sectionHint}>Paste text from Thumbtack, email, etc.</Text>
              <Input
                placeholder="Paste lead information here..."
                value={pastedText}
                onChangeText={setPastedText}
                multiline
                numberOfLines={8}
                style={styles.pasteInput}
              />
              <Input
                label="Customer Name *"
                placeholder="Extract from paste or enter manually"
                value={customerName}
                onChangeText={setCustomerName}
                autoCapitalize="words"
              />
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Info</Text>
              
              <Input
                label="Customer Name *"
                placeholder="John Smith"
                value={customerName}
                onChangeText={setCustomerName}
                autoCapitalize="words"
              />
              
              <Input
                label="Phone Number"
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
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lead Source *</Text>
            {renderSourceSelector()}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Follow-up Plan</Text>
            <View style={styles.planContainer}>
              <TouchableOpacity
                style={[
                  styles.planChip,
                  !selectedPlanId && styles.planChipActive
                ]}
                onPress={() => setSelectedPlanId(null)}
              >
                <Text style={[styles.planText, !selectedPlanId && styles.planTextActive]}>None</Text>
              </TouchableOpacity>
              {plans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planChip,
                    selectedPlanId === plan.id && styles.planChipActive
                  ]}
                  onPress={() => setSelectedPlanId(plan.id)}
                >
                  <Text style={[styles.planText, selectedPlanId === plan.id && styles.planTextActive]}>
                    {plan.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!showPasteMode && (
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
          )}

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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  modeButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
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
  sectionHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
  },
  sourceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    gap: SPACING.xs,
  },
  sourceChipActive: {
    backgroundColor: COLORS.primary + '15',
  },
  sourceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sourceText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  sourceTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  planContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  planChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  planText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  planTextActive: {
    color: '#FFFFFF',
  },
  pasteInput: {
    height: 150,
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: SPACING.md,
  },
});
