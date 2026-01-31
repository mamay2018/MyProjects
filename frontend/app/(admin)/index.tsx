import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const data = await api.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Roadside Services Overview</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardBlue]}>
            <Text style={styles.statValue}>{analytics?.jobs?.active || 0}</Text>
            <Text style={styles.statLabel}>Active Jobs</Text>
          </View>
          <View style={[styles.statCard, styles.statCardGreen]}>
            <Text style={styles.statValue}>{analytics?.users?.online_providers || 0}</Text>
            <Text style={styles.statLabel}>Online Providers</Text>
          </View>
        </View>

        {/* Revenue Card */}
        <View style={styles.revenueCard}>
          <Text style={styles.sectionTitle}>Revenue</Text>
          <View style={styles.revenueStats}>
            <View style={styles.revenueItem}>
              <Text style={styles.revenueValue}>
                ${(analytics?.revenue?.total || 0).toFixed(2)}
              </Text>
              <Text style={styles.revenueLabel}>Total Revenue</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueItem}>
              <Text style={styles.revenueValue}>
                ${(analytics?.revenue?.platform_fees || 0).toFixed(2)}
              </Text>
              <Text style={styles.revenueLabel}>Platform Fees</Text>
            </View>
          </View>
        </View>

        {/* Jobs Summary */}
        <View style={styles.jobsCard}>
          <Text style={styles.sectionTitle}>Jobs Summary</Text>
          <View style={styles.jobsStats}>
            <View style={styles.jobStatItem}>
              <Text style={styles.jobStatValue}>{analytics?.jobs?.total || 0}</Text>
              <Text style={styles.jobStatLabel}>Total</Text>
            </View>
            <View style={styles.jobStatItem}>
              <Text style={[styles.jobStatValue, { color: '#34C759' }]}>
                {analytics?.jobs?.completed || 0}
              </Text>
              <Text style={styles.jobStatLabel}>Completed</Text>
            </View>
            <View style={styles.jobStatItem}>
              <Text style={[styles.jobStatValue, { color: '#FF3B30' }]}>
                {analytics?.jobs?.cancelled || 0}
              </Text>
              <Text style={styles.jobStatLabel}>Cancelled</Text>
            </View>
            <View style={styles.jobStatItem}>
              <Text style={[styles.jobStatValue, { color: '#007AFF' }]}>
                {analytics?.jobs?.completion_rate || 0}%
              </Text>
              <Text style={styles.jobStatLabel}>Rate</Text>
            </View>
          </View>
        </View>

        {/* Jobs by Service */}
        <View style={styles.serviceCard}>
          <Text style={styles.sectionTitle}>Jobs by Service</Text>
          {Object.entries(analytics?.jobs?.by_service || {}).map(([service, count]) => (
            <View key={service} style={styles.serviceRow}>
              <Text style={styles.serviceName}>
                {service.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
              <View style={styles.serviceBarContainer}>
                <View
                  style={[
                    styles.serviceBar,
                    {
                      width: `${Math.min(
                        ((count as number) / (analytics?.jobs?.total || 1)) * 100,
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.serviceCount}>{count as number}</Text>
            </View>
          ))}
        </View>

        {/* Users Summary */}
        <View style={styles.usersCard}>
          <Text style={styles.sectionTitle}>Users</Text>
          <View style={styles.usersStats}>
            <View style={styles.userStatItem}>
              <Ionicons name="person" size={24} color="#007AFF" />
              <Text style={styles.userStatValue}>
                {analytics?.users?.total_customers || 0}
              </Text>
              <Text style={styles.userStatLabel}>Customers</Text>
            </View>
            <View style={styles.userStatItem}>
              <Ionicons name="construct" size={24} color="#34C759" />
              <Text style={styles.userStatValue}>
                {analytics?.users?.total_providers || 0}
              </Text>
              <Text style={styles.userStatLabel}>Providers</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statCardBlue: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  statCardGreen: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  revenueCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    marginBottom: 16,
  },
  revenueStats: {
    flexDirection: 'row',
  },
  revenueItem: {
    flex: 1,
    alignItems: 'center',
  },
  revenueValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
  },
  revenueLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  revenueDivider: {
    width: 1,
    backgroundColor: '#333',
  },
  jobsCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  jobsStats: {
    flexDirection: 'row',
  },
  jobStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  jobStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  jobStatLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  serviceCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    width: 100,
    fontSize: 13,
    color: '#888',
  },
  serviceBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginHorizontal: 12,
  },
  serviceBar: {
    height: 8,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  serviceCount: {
    width: 40,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'right',
  },
  usersCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#333',
  },
  usersStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  userStatItem: {
    alignItems: 'center',
  },
  userStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  userStatLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
});
