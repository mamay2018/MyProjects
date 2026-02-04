import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sequencesAPI } from '../../src/api';
import { COLORS, SPACING, FONTS, SHADOWS, CHANNEL_LABELS } from '../../src/constants/theme';
import { Sequence } from '../../src/types';

export default function SequenceDetailScreen() {
  const { id } = useLocalSearchParams();
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSequence();
  }, [id]);

  const loadSequence = async () => {
    try {
      const response = await sequencesAPI.get(Number(id));
      setSequence(response.data);
    } catch (error) {
      console.log('Error loading sequence:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!sequence) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Sequence not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons 
              name={sequence.is_builtin ? 'flash' : 'create'} 
              size={28} 
              color={sequence.is_builtin ? COLORS.warning : COLORS.primary} 
            />
            <Text style={styles.title}>{sequence.name}</Text>
          </View>
          {sequence.is_builtin && (
            <View style={styles.builtinBadge}>
              <Text style={styles.builtinText}>Built-in Template</Text>
            </View>
          )}
        </View>

        {/* Steps Timeline */}
        <View style={styles.stepsContainer}>
          <Text style={styles.sectionTitle}>Follow-up Steps</Text>
          
          {sequence.steps
            .sort((a, b) => a.step_order - b.step_order)
            .map((step, index) => (
              <View key={step.id} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepMeta}>
                    <Text style={styles.stepDay}>Day {step.day_offset}</Text>
                    <View style={[
                      styles.channelBadge,
                      { backgroundColor: step.channel === 'SMS' ? COLORS.primary + '20' : COLORS.secondary + '20' }
                    ]}>
                      <Ionicons 
                        name={step.channel === 'SMS' ? 'chatbubble' : 'mail'} 
                        size={12} 
                        color={step.channel === 'SMS' ? COLORS.primary : COLORS.secondary} 
                      />
                      <Text style={[
                        styles.channelText,
                        { color: step.channel === 'SMS' ? COLORS.primary : COLORS.secondary }
                      ]}>
                        {CHANNEL_LABELS[step.channel]}
                      </Text>
                    </View>
                  </View>
                </View>
                
                {step.email_subject && (
                  <View style={styles.subjectContainer}>
                    <Text style={styles.subjectLabel}>Subject:</Text>
                    <Text style={styles.subjectText}>{step.email_subject}</Text>
                  </View>
                )}
                
                <View style={styles.messageContainer}>
                  <Text style={styles.messageLabel}>Message:</Text>
                  <Text style={styles.messageText}>{step.message_template}</Text>
                </View>

                {/* Connector line */}
                {index < sequence.steps.length - 1 && (
                  <View style={styles.connector} />
                )}
              </View>
            ))}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={COLORS.info} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Variables Available</Text>
            <Text style={styles.infoText}>
              {'{firstName}'} - Lead's first name{"\n"}
              {'{jobType}'} - Type of job/project{"\n"}
              {'{quoteAmount}'} - Quote amount{"\n"}
              {'{businessName}'} - Your business name
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  builtinBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  builtinText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    fontWeight: '600',
  },
  stepsContainer: {
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
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepMeta: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepDay: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  channelText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  subjectContainer: {
    marginBottom: SPACING.sm,
  },
  subjectLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  subjectText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  messageContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
  },
  messageLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  connector: {
    position: 'absolute',
    left: 34,
    bottom: -SPACING.md,
    width: 2,
    height: SPACING.md,
    backgroundColor: COLORS.border,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.info + '15',
    borderRadius: 12,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
