import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { format } from 'date-fns';

interface Job {
  id: string;
  service_type: string;
  status: string;
  pickup_address: string;
  estimated_price: number;
  final_price?: number;
  created_at: string;
  completed_at?: string;
}

const SERVICE_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  gas_delivery: 'flame',
  towing: 'car',
  tire_repair: 'disc',
  mechanic: 'construct',
  car_wash: 'water',
};

const SERVICE_COLORS: { [key: string]: string } = {
  gas_delivery: '#FF9500',
  towing: '#007AFF',
  tire_repair: '#5856D6',
  mechanic: '#34C759',
  car_wash: '#00C7BE',
};

const STATUS_COLORS: { [key: string]: string } = {
  pending: '#FF9500',
  matching: '#007AFF',
  accepted: '#34C759',
  en_route: '#007AFF',
  arrived: '#34C759',
  in_progress: '#5856D6',
  completed: '#34C759',
  cancelled: '#FF3B30',
};

export default function ActivityScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const data = await api.getCustomerJobs();
      setJobs(data);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const activeJobs = jobs.filter(job => 
    ['pending', 'matching', 'accepted', 'en_route', 'arrived', 'in_progress'].includes(job.status)
  );
  
  const completedJobs = jobs.filter(job => 
    ['completed', 'cancelled'].includes(job.status)
  );

  const displayedJobs = activeTab === 'active' ? activeJobs : completedJobs;

  const renderJob = ({ item }: { item: Job }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => router.push({
        pathname: '/(customer)/job/[id]',
        params: { id: item.id }
      })}
    >
      <View style={styles.jobHeader}>
        <View style={[styles.iconBg, { backgroundColor: `${SERVICE_COLORS[item.service_type] || '#007AFF'}20` }]}>
          <Ionicons
            name={SERVICE_ICONS[item.service_type] || 'help'}
            size={24}
            color={SERVICE_COLORS[item.service_type] || '#007AFF'}
          />
        </View>
        <View style={styles.jobInfo}>
          <Text style={styles.jobService}>
            {item.service_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Text>
          <Text style={styles.jobAddress} numberOfLines={1}>
            {item.pickup_address}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[item.status]}20` }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
            {item.status.replace('_', ' ')}
          </Text>
        </View>
      </View>
      <View style={styles.jobFooter}>
        <Text style={styles.jobDate}>
          {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
        </Text>
        <Text style={styles.jobPrice}>
          ${(item.final_price || item.estimated_price).toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({activeJobs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            History ({completedJobs.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayedJobs}
        renderItem={renderJob}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>
              {activeTab === 'active' ? 'No active jobs' : 'No completed jobs'}
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
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#1a1a1a',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    color: '#888',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  jobCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobService: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  jobAddress: {
    fontSize: 13,
    color: '#888',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  jobDate: {
    fontSize: 13,
    color: '#666',
  },
  jobPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    marginTop: 12,
    fontSize: 16,
  },
});
