import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, SHADOWS } from '../constants/theme';
import { Sequence } from '../types';

interface SequenceCardProps {
  sequence: Sequence;
  onPress: () => void;
  selected?: boolean;
}

export const SequenceCard: React.FC<SequenceCardProps> = ({ sequence, onPress, selected }) => {
  return (
    <TouchableOpacity 
      style={[styles.card, selected && styles.selectedCard]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons 
            name={sequence.is_builtin ? 'flash' : 'create-outline'} 
            size={20} 
            color={sequence.is_builtin ? COLORS.warning : COLORS.primary} 
          />
          <Text style={styles.name}>{sequence.name}</Text>
        </View>
        {selected && (
          <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
        )}
      </View>
      
      <View style={styles.stepsContainer}>
        {sequence.steps.map((step, index) => (
          <View key={step.id} style={styles.step}>
            <View style={[styles.stepDot, { backgroundColor: step.channel === 'SMS' ? COLORS.primary : COLORS.secondary }]} />
            <Text style={styles.stepText}>
              Day {step.day_offset}: {step.channel}
            </Text>
          </View>
        ))}
      </View>
      
      {sequence.is_builtin && (
        <View style={styles.builtinBadge}>
          <Text style={styles.builtinText}>Built-in</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOWS.md,
  },
  selectedCard: {
    borderColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  name: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  stepsContainer: {
    gap: SPACING.xs,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  builtinBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  builtinText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    fontWeight: '600',
  },
});
