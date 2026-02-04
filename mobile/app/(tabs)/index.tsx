import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { dashboardAPI } from '../../src/api';
import { useAuthStore } from '../../src/store/authStore';
import { StatCard } from '../../src/components/StatCard';
import { COLORS, SPACING, FONTS, SHADOWS, STATUS_COLORS, STATUS_LABELS } from '../../src/constants/theme';
import { DashboardStats } from '../../src/types';

export default function DashboardScreen() {
  const { business } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.log('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.businessName}>{business?.business_name || 'Your Business'}</Text>
          </View>
          <View style={styles.logoContainer}>
            <Ionicons name="flash" size={28} color={COLORS.primary} />
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <StatCard
            title="Today's Follow-ups"
            value={stats?.todays_followups || 0}
            icon="calendar"
            color={COLORS.primary}
          />
          <StatCard
            title="Hot Leads"
            value={stats?.hot_leads || 0}
            icon="flame"
            color={COLORS.warning}
          />
        </View>

        {/* Money at Risk */}
        <View style={styles.moneyCard}>
          <View style={styles.moneyHeader}>
            <Ionicons name="cash" size={24} color={COLORS.secondary} />
            <Text style={styles.moneyTitle}>Money at Risk</Text>
          </View>
          <Text style={styles.moneyValue}>
            ${(stats?.money_at_risk || 0).toLocaleString()}
          </Text>
          <Text style={styles.moneySubtitle}>From active leads</Text>
        </View>

        {/* Pipeline */}
        <View style={styles.pipelineCard}>
          <Text style={styles.sectionTitle}>Pipeline Overview</Text>
          <View style={styles.pipelineGrid}>
            {Object.entries(stats?.pipeline_counts || {}).map(([status, count]) => (
              <View key={status} style={styles.pipelineItem}>
                <View style={[styles.pipelineDot, { backgroundColor: STATUS_COLORS[status] }]} />
                <Text style={styles.pipelineLabel}>{STATUS_LABELS[status]}</Text>
                <Text style={styles.pipelineCount}>{count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Tips */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb" size={20} color={COLORS.warning} />
            <Text style={styles.tipsTitle}>Quick Tip</Text>
          </View>
          <Text style={styles.tipsText}>
            Assign sequences to new leads to automatically follow up until they respond!
          </Text>
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
  scrollContent: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  businessName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  moneyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  moneyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  moneyTitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  moneyValue: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  moneySubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  pipelineCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  pipelineGrid: {
    gap: SPACING.sm,
  },
  pipelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pipelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pipelineLabel: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  pipelineCount: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  tipsCard: {
    backgroundColor: COLORS.warning + '15',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  tipsTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.warning,
  },
  tipsText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
});
