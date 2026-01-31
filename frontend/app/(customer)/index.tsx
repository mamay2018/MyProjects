import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

const { width } = Dimensions.get('window');
const TILE_WIDTH = (width - 64) / 2;

interface Service {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
}

const services: Service[] = [
  {
    id: 'gas_delivery',
    name: 'Gas Delivery',
    icon: 'flame',
    color: '#FF9500',
    description: 'Out of fuel? We deliver',
  },
  {
    id: 'towing',
    name: 'Towing',
    icon: 'car',
    color: '#007AFF',
    description: 'Vehicle breakdown help',
  },
  {
    id: 'tire_repair',
    name: 'Tire Repair',
    icon: 'disc',
    color: '#5856D6',
    description: 'Flat tire assistance',
  },
  {
    id: 'mechanic',
    name: 'Mobile Mechanic',
    icon: 'construct',
    color: '#34C759',
    description: 'On-site repairs',
  },
  {
    id: 'car_wash',
    name: 'Mobile Car Wash',
    icon: 'water',
    color: '#00C7BE',
    description: 'We come to you',
  },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const handleServiceSelect = (serviceId: string) => {
    router.push({
      pathname: '/(customer)/request/[service]',
      params: { service: serviceId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name || 'there'}</Text>
            <Text style={styles.subtitle}>What do you need help with?</Text>
          </View>
          <TouchableOpacity style={styles.sosButton}>
            <Ionicons name="alert-circle" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        {/* Featured Service - Gas Delivery */}
        <TouchableOpacity
          style={styles.featuredCard}
          onPress={() => handleServiceSelect('gas_delivery')}
        >
          <View style={styles.featuredContent}>
            <View style={[styles.featuredIconBg, { backgroundColor: 'rgba(255, 149, 0, 0.2)' }]}>
              <Ionicons name="flame" size={32} color="#FF9500" />
            </View>
            <View style={styles.featuredText}>
              <Text style={styles.featuredTitle}>Gas Delivery</Text>
              <Text style={styles.featuredDescription}>
                Out of fuel? We'll bring gas to you in minutes
              </Text>
            </View>
          </View>
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>Most Popular</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" style={styles.featuredArrow} />
        </TouchableOpacity>

        {/* All Services */}
        <Text style={styles.sectionTitle}>All Services</Text>
        <View style={styles.servicesGrid}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceCard}
              onPress={() => handleServiceSelect(service.id)}
            >
              <View style={[styles.serviceIconBg, { backgroundColor: `${service.color}20` }]}>
                <Ionicons name={service.icon} size={28} color={service.color} />
              </View>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceDescription}>{service.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity Preview */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/activity')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={40} color="#444" />
            <Text style={styles.emptyText}>No recent activity</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  sosButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featuredText: {
    flex: 1,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featuredDescription: {
    fontSize: 14,
    color: '#888',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featuredBadgeText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredArrow: {
    position: 'absolute',
    right: 16,
    top: '50%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  serviceCard: {
    width: TILE_WIDTH,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  serviceIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#666',
  },
  recentSection: {
    paddingBottom: 24,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
    marginBottom: 16,
  },
  seeAllText: {
    color: '#007AFF',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    marginHorizontal: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
  },
  emptyText: {
    color: '#666',
    marginTop: 8,
  },
});
