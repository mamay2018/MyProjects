import React, { useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const [isChecking, setIsChecking] = React.useState(true);

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userStr = await AsyncStorage.getItem('auth_user');
      
      if (token && userStr) {
        const user = JSON.parse(userStr);
        if (user.role === 'admin') {
          router.replace('/(admin)');
        } else if (user.role === 'provider') {
          router.replace('/(provider)');
        } else {
          router.replace('/(customer)');
        }
      } else {
        setIsChecking(false);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsChecking(false);
    }
  };

  if (isChecking) {
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
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="car" size={60} color="#007AFF" />
          </View>
          <Text style={styles.title}>RoadAssist</Text>
          <Text style={styles.subtitle}>24/7 Roadside Services</Text>
        </View>

        <View style={styles.servicesPreview}>
          <View style={styles.serviceRow}>
            <ServiceIcon name="local-gas-station" label="Gas" />
            <ServiceIcon name="build" label="Towing" />
            <ServiceIcon name="tire-repair" label="Tire" />
          </View>
          <View style={styles.serviceRow}>
            <ServiceIcon name="car-repair" label="Mechanic" />
            <ServiceIcon name="local-car-wash" label="Wash" />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.orText}>Already have an account?</Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ServiceIcon({ name, label }: { name: string; label: string }) {
  const iconMap: { [key: string]: keyof typeof Ionicons.glyphMap } = {
    'local-gas-station': 'flame',
    'build': 'construct',
    'tire-repair': 'disc',
    'car-repair': 'settings',
    'local-car-wash': 'water',
  };

  return (
    <View style={styles.serviceIcon}>
      <View style={styles.serviceIconCircle}>
        <Ionicons name={iconMap[name] || 'help'} size={24} color="#007AFF" />
      </View>
      <Text style={styles.serviceLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  servicesPreview: {
    alignItems: 'center',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  serviceIcon: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  serviceIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: 12,
    color: '#888',
  },
  buttonContainer: {
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  orText: {
    color: '#666',
    marginBottom: 12,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
