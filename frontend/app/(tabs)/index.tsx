import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { analyticsAPI, leadsAPI } from '../../src/api';
import { useAuthStore } from '../../src/store/authStore';
import { StatCard } from '../../src/components/StatCard';
import { COLORS, SPACING, FONTS, SHADOWS, STATUS_COLORS, STATUS_LABELS, formatCurrency, formatPercent } from '../../src/constants/theme';
import { AnalyticsSummary, LeadListItem } from '../../src/types';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [recentLeads, setRecentLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [analyticsRes, leadsRes] = await Promise.all([
        analyticsAPI.getSummary(),
        leadsAPI.getAll({ limit: 5 }),
      ]);
      setAnalytics(analyticsRes.data);
      setRecentLeads(leadsRes.data);
    } catch (error) {
      console.log('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
            <Text style={styles.businessName}>{user?.business_name || user?.pro_name || 'Pro'}</Text>
          </View>
          <View style={styles.logoContainer}>
            <Ionicons name="flash" size={28} color={COLORS.primary} />
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <StatCard
            title="Total Leads"
            value={analytics?.total_leads || 0}
            icon="people"
            color={COLORS.primary}
          />
          <StatCard
            title="Won Deals"
            value={analytics?.total_won || 0}
            icon="trophy"
            color={COLORS.success}
          />
        </View>

        {/* Revenue Card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <Ionicons name="cash" size={24} color={COLORS.secondary} />
            <Text style={styles.revenueTitle}>Total Revenue</Text>
          </View>
          <Text style={styles.revenueValue}>
            {formatCurrency(analytics?.total_revenue_cents || 0)}
          </Text>
          <View style={styles.revenueStats}>
            <View style={styles.revenueStat}>
              <Text style={styles.revenueStatLabel}>Close Rate</Text>
              <Text style={styles.revenueStatValue}>
                {formatPercent(analytics?.overall_close_rate || 0)}
              </Text>
            </View>
            {analytics?.overall_roi !== null && analytics?.overall_roi !== undefined && (
              <View style={styles.revenueStat}>
                <Text style={styles.revenueStatLabel}>ROI</Text>
                <Text style={[styles.revenueStatValue, { color: analytics.overall_roi >= 0 ? COLORS.success : COLORS.error }]}>
                  {formatPercent(analytics.overall_roi)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Pipeline Overview */}
        <View style={styles.pipelineCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Pipeline Overview</Text>
          </View>
          <View style={styles.pipelineGrid}>
            <View style={styles.pipelineItem}>
              <View style={[styles.pipelineDot, { backgroundColor: STATUS_COLORS.NEW }]} />
              <Text style={styles.pipelineLabel}>New</Text>
              <Text style={styles.pipelineCount}>
                {analytics?.by_source.reduce((sum, s) => sum + s.new_leads, 0) || 0}
              </Text>
            </View>
            <View style={styles.pipelineItem}>
              <View style={[styles.pipelineDot, { backgroundColor: STATUS_COLORS.CONTACTED }]} />
              <Text style={styles.pipelineLabel}>Contacted</Text>
              <Text style={styles.pipelineCount}>
                {analytics?.by_source.reduce((sum, s) => sum + s.contacted_leads, 0) || 0}
              </Text>
            </View>
            <View style={styles.pipelineItem}>
              <View style={[styles.pipelineDot, { backgroundColor: STATUS_COLORS.BOOKED }]} />
              <Text style={styles.pipelineLabel}>Booked</Text>
              <Text style={styles.pipelineCount}>{analytics?.total_booked || 0}</Text>
            </View>
            <View style={styles.pipelineItem}>
              <View style={[styles.pipelineDot, { backgroundColor: STATUS_COLORS.WON }]} />
              <Text style={styles.pipelineLabel}>Won</Text>
              <Text style={styles.pipelineCount}>{analytics?.total_won || 0}</Text>
            </View>
            <View style={styles.pipelineItem}>
              <View style={[styles.pipelineDot, { backgroundColor: STATUS_COLORS.LOST }]} />
              <Text style={styles.pipelineLabel}>Lost</Text>
              <Text style={styles.pipelineCount}>{analytics?.total_lost || 0}</Text>
            </View>
          </View>
        </View>

        {/* Recent Leads */}
        <View style={styles.recentCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Recent Leads</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/leads')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentLeads.length === 0 ? (
            <Text style={styles.noLeadsText}>No leads yet. Add your first lead!</Text>
          ) : (
            recentLeads.map((lead) => (
              <TouchableOpacity 
                key={lead.id} 
                style={styles.recentLeadItem}
                onPress={() => router.push(`/lead/${lead.id}`)}
              >
                <View style={styles.recentLeadInfo}>
                  <Text style={styles.recentLeadName} numberOfLines={1}>{lead.customer_name}</Text>
                  {lead.lead_source && (
                    <View style={styles.recentLeadSource}>
                      <View style={[styles.sourceDot, { backgroundColor: lead.lead_source.color }]} />
                      <Text style={styles.recentLeadSourceName}>{lead.lead_source.name}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[lead.status] + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[lead.status] }]}>
                    {STATUS_LABELS[lead.status]}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Tip */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb" size={20} color={COLORS.warning} />
            <Text style={styles.tipsTitle}>Quick Tip</Text>
          </View>
          <Text style={styles.tipsText}>
            Track your lead sources to see which marketing channels bring the best ROI!
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
  revenueCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  revenueTitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  revenueValue: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  revenueStats: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: SPACING.lg,
  },
  revenueStat: {},
  revenueStatLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
  },
  revenueStatValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  pipelineCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  viewAllText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '500',
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
  recentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  noLeadsText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  recentLeadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recentLeadInfo: {
    flex: 1,
  },
  recentLeadName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  recentLeadSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recentLeadSourceName: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
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
