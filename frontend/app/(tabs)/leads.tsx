import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
  TextInput
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { leadsAPI, leadSourceAPI } from '../../src/api';
import { LeadCard } from '../../src/components/LeadCard';
import { COLORS, SPACING, FONTS, STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '../../src/constants/theme';
import { LeadListItem, LeadSource } from '../../src/types';

const STATUS_FILTERS = ['ALL', ...STATUS_ORDER];

export default function LeadsScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [leadsRes, sourcesRes] = await Promise.all([
        leadsAPI.getAll({
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          source_id: selectedSource || undefined,
          search: search || undefined,
        }),
        leadSourceAPI.getAll(),
      ]);
      setLeads(leadsRes.data);
      setSources(sourcesRes.data);
    } catch (error) {
      console.log('Error loading leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedStatus, selectedSource, search])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderStatusFilter = () => (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={STATUS_FILTERS}
      keyExtractor={(item) => item}
      contentContainerStyle={styles.filterContainer}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedStatus === item && styles.filterChipActive
          ]}
          onPress={() => setSelectedStatus(item)}
        >
          {item !== 'ALL' && (
            <View style={[styles.filterDot, { backgroundColor: STATUS_COLORS[item] }]} />
          )}
          <Text style={[
            styles.filterText,
            selectedStatus === item && styles.filterTextActive
          ]}>
            {item === 'ALL' ? 'All' : STATUS_LABELS[item]}
          </Text>
        </TouchableOpacity>
      )}
    />
  );

  const renderSourceFilter = () => (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={[{ id: null, name: 'All Sources', color: COLORS.textSecondary }, ...sources]}
      keyExtractor={(item) => item.id || 'all'}
      contentContainerStyle={styles.filterContainer}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.sourceChip,
            selectedSource === item.id && styles.sourceChipActive
          ]}
          onPress={() => setSelectedSource(item.id)}
        >
          <View style={[styles.sourceDot, { backgroundColor: item.color }]} />
          <Text style={[
            styles.filterText,
            selectedSource === item.id && styles.filterTextActive
          ]} numberOfLines={1}>
            {item.name}
          </Text>
        </TouchableOpacity>
      )}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search leads..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={COLORS.textLight}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/lead/new')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      {renderStatusFilter()}
      
      {/* Source Filter */}
      {renderSourceFilter()}

      {/* Leads List */}
      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <LeadCard
            lead={item}
            onPress={() => router.push(`/lead/${item.id}`)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No leads found</Text>
            <Text style={styles.emptySubtext}>
              {search ? 'Try a different search' : 'Add your first lead to get started'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    marginRight: SPACING.sm,
    gap: SPACING.xs,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    marginRight: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sourceChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listContent: {
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
