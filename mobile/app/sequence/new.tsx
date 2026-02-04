import React, { useState } from 'react';
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
import { sequencesAPI } from '../../src/api';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS, SHADOWS, CHANNEL_LABELS } from '../../src/constants/theme';

interface Step {
  day_offset: number;
  channel: 'SMS' | 'EMAIL';
  message_template: string;
  email_subject: string;
  step_order: number;
}

const CHANNELS = ['SMS', 'EMAIL'] as const;

export default function NewSequenceScreen() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<Step[]>([
    { day_offset: 0, channel: 'SMS', message_template: '', email_subject: '', step_order: 0 }
  ]);
  const [loading, setLoading] = useState(false);

  const addStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps([
      ...steps,
      {
        day_offset: lastStep.day_offset + 2,
        channel: lastStep.channel === 'SMS' ? 'EMAIL' : 'SMS',
        message_template: '',
        email_subject: '',
        step_order: steps.length
      }
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length === 1) {
      Alert.alert('Error', 'A sequence must have at least one step');
      return;
    }
    setSteps(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i })));
  };

  const updateStep = (index: number, field: keyof Step, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleCreate = async () => {
    if (!name) {
      Alert.alert('Error', 'Please enter a sequence name');
      return;
    }

    const emptySteps = steps.filter(s => !s.message_template);
    if (emptySteps.length > 0) {
      Alert.alert('Error', 'Please fill in all message templates');
      return;
    }

    setLoading(true);
    try {
      await sequencesAPI.create({
        name,
        steps: steps.map(s => ({
          ...s,
          email_subject: s.channel === 'EMAIL' ? (s.email_subject || 'Follow-up') : undefined
        }))
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not create sequence');
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
            <Input
              label="Sequence Name *"
              placeholder="e.g., My Custom Follow-up"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Follow-up Steps</Text>
            
            {steps.map((step, index) => (
              <View key={index} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepTitle}>Step {index + 1}</Text>
                  {steps.length > 1 && (
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => removeStep(index)}
                    >
                      <Ionicons name="close-circle" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.stepRow}>
                  <View style={styles.dayInput}>
                    <Text style={styles.label}>Day</Text>
                    <Input
                      placeholder="0"
                      value={step.day_offset.toString()}
                      onChangeText={(v) => updateStep(index, 'day_offset', parseInt(v) || 0)}
                      keyboardType="number-pad"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                  
                  <View style={styles.channelInput}>
                    <Text style={styles.label}>Channel</Text>
                    <View style={styles.channelButtons}>
                      {CHANNELS.map((ch) => (
                        <TouchableOpacity
                          key={ch}
                          style={[
                            styles.channelButton,
                            step.channel === ch && styles.channelButtonActive
                          ]}
                          onPress={() => updateStep(index, 'channel', ch)}
                        >
                          <Ionicons 
                            name={ch === 'SMS' ? 'chatbubble' : 'mail'} 
                            size={16} 
                            color={step.channel === ch ? '#FFFFFF' : COLORS.textSecondary} 
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {step.channel === 'EMAIL' && (
                  <Input
                    label="Email Subject"
                    placeholder="Subject line..."
                    value={step.email_subject}
                    onChangeText={(v) => updateStep(index, 'email_subject', v)}
                  />
                )}

                <Input
                  label="Message Template *"
                  placeholder="Hi {firstName}! ..."
                  value={step.message_template}
                  onChangeText={(v) => updateStep(index, 'message_template', v)}
                  multiline
                  numberOfLines={4}
                  style={styles.messageInput}
                />

                <Text style={styles.hint}>
                  Variables: {'{firstName}'}, {'{jobType}'}, {'{quoteAmount}'}, {'{businessName}'}
                </Text>
              </View>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={addStep}>
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
              <Text style={styles.addButtonText}>Add Another Step</Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Create Sequence"
            onPress={handleCreate}
            loading={loading}
            style={styles.createButton}
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
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  stepCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepTitle: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  removeButton: {
    padding: 4,
  },
  stepRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  dayInput: {
    width: 80,
  },
  channelInput: {
    flex: 1,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  channelButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  channelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  channelButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  createButton: {
    marginTop: SPACING.md,
  },
});
