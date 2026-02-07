import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { analyticsAPI } from '../../src/api';
import { COLORS, SPACING, FONTS, SHADOWS, formatCurrency, formatPercent } from '../../src/constants/theme';
import { AnalyticsSummary } from '../../src/types';

type Period = '7d' | '30d' | '90d' | 'all';

export default function AnalyticsScreen() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');

  const loadData = async () => {
    try {
      const now = new Date();
      let startDate: Date | undefined;
      
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = undefined;
          break;
      }
      
      const response = await analyticsAPI.getSummary({
        start_date: startDate?.toISOString(),
        end_date: now.toISOString(),
      });
      setAnalytics(response.data);
    } catch (error) {
      console.log('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [period])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {(['7d', '30d', '90d', 'all'] as Period[]).map((p) => (
        <TouchableOpacity
          key={p}
          style={[styles.periodButton, period === p && styles.periodButtonActive]}
          onPress={() => setPeriod(p)}
        >
          <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
            {p === 'all' ? 'All Time' : p.replace('d', ' Days')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Lead Source Analytics</Text>
        
        {renderPeriodSelector()}

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Leads</Text>
            <Text style={styles.summaryValue}>{analytics?.total_leads || 0}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Won</Text>
            <Text style={[styles.summaryValue, { color: COLORS.success }]}>{analytics?.total_won || 0}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Revenue</Text>
            <Text style={[styles.summaryValue, { color: COLORS.secondary }]}>
              {formatCurrency(analytics?.total_revenue_cents || 0)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Close Rate</Text>
            <Text style={styles.summaryValue}>
              {formatPercent(analytics?.overall_close_rate || 0)}
            </Text>
          </View>
        </View>

        {analytics?.overall_roi !== null && analytics?.overall_roi !== undefined && (
          <View style={styles.roiCard}>
            <Text style={styles.roiLabel}>Overall ROI</Text>
            <Text style={[
              styles.roiValue,
              { color: analytics.overall_roi >= 0 ? COLORS.success : COLORS.error }
            ]}>
              {analytics.overall_roi >= 0 ? '+' : ''}{formatPercent(analytics.overall_roi)}
            </Text>
          </View>
        )}

        {/* Source Breakdown Table */}
        <View style={styles.tableCard}>
          <Text style={styles.tableTitle}>Performance by Source</Text>
          
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Source</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Leads</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Won</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Rate</Text>
            <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Revenue</Text>
          </View>

          {/* Table Rows */}
          {analytics?.by_source.map((source) => (
            <View key={source.source_id} style={styles.tableRow}>
              <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }]}>
                <View style={[styles.sourceDot, { backgroundColor: source.source_color }]} />
                <Text style={styles.sourceName} numberOfLines={1}>{source.source_name}</Text>
              </View>
              <Text style={[styles.tableCellText, { flex: 1, textAlign: 'center' }]}>
                {source.total_leads}
              </Text>
              <Text style={[styles.tableCellText, { flex: 1, textAlign: 'center', color: COLORS.success }]}>
                {source.won_leads}
              </Text>
              <Text style={[styles.tableCellText, { flex: 1, textAlign: 'center' }]}>
                {formatPercent(source.close_rate)}
              </Text>
              <Text style={[styles.tableCellText, { flex: 1.5, textAlign: 'right', fontWeight: '600' }]}>
                {formatCurrency(source.revenue_cents)}
              </Text>
            </View>
          ))}

          {(!analytics?.by_source || analytics.by_source.length === 0) && (
            <Text style={styles.noDataText}>No data for this period</Text>
          )}
        </View>

        {/* ROI by Source (if costs available) */}
        {analytics?.by_source.some(s => s.cost_cents > 0) && (
          <View style={styles.tableCard}>
            <Text style={styles.tableTitle}>ROI by Source</Text>
            
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Source</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Cost</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Revenue</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>ROI</Text>
            </View>

            {analytics?.by_source
              .filter(s => s.cost_cents > 0)
              .map((source) => (
                <View key={source.source_id} style={styles.tableRow}>
                  <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }]}>
                    <View style={[styles.sourceDot, { backgroundColor: source.source_color }]} />
                    <Text style={styles.sourceName} numberOfLines={1}>{source.source_name}</Text>
                  </View>
                  <Text style={[styles.tableCellText, { flex: 1, textAlign: 'center' }]}>
                    {formatCurrency(source.cost_cents)}
                  </Text>
                  <Text style={[styles.tableCellText, { flex: 1, textAlign: 'center' }]}>
                    {formatCurrency(source.revenue_cents)}
                  </Text>
                  <Text style={[
                    styles.tableCellText, 
                    { flex: 1, textAlign: 'right', fontWeight: '600' },
                    { color: (source.roi ?? 0) >= 0 ? COLORS.success : COLORS.error }
                  ]}>
                    {source.roi !== null && source.roi !== undefined 
                      ? `${source.roi >= 0 ? '+' : ''}${formatPercent(source.roi)}`
                      : '-'}
                  </Text>
                </View>
              ))}
          </View>
        )}
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
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  periodButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  summaryLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  roiCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  roiLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  roiValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  tableCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  tableTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeaderText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableCell: {
    flexDirection: 'row',
  },
  tableCellText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sourceName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    flex: 1,
  },
  noDataText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});
