import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

export default function RoleSelectScreen() {
  const router = useRouter();
  const { user, setRole } = useAuth();

  const handleSelectRole = async (role: 'customer' | 'provider') => {
    try {
      await setRole(role);
      if (role === 'customer') {
        router.replace('/(customer)');
      } else {
        router.replace('/(provider)/onboarding');
      }
    } catch (error) {
      console.error('Error setting role:', error);
    }
  };

  // If user already has a role, redirect
  React.useEffect(() => {
    if (user?.role === 'admin') {
      router.replace('/(admin)');
    } else if (user?.role === 'provider') {
      router.replace('/(provider)');
    }
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>How would you like to use RoadAssist?</Text>
          <Text style={styles.subtitle}>You can change this later in settings</Text>
        </View>

        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => handleSelectRole('customer')}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons name="car-outline" size={48} color="#007AFF" />
            </View>
            <Text style={styles.optionTitle}>I Need Help</Text>
            <Text style={styles.optionDescription}>
              Request roadside assistance services like gas delivery, towing, and more
            </Text>
            <View style={styles.optionArrow}>
              <Ionicons name="arrow-forward" size={24} color="#007AFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => handleSelectRole('provider')}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons name="construct-outline" size={48} color="#34C759" />
            </View>
            <Text style={styles.optionTitle}>I Want to Help</Text>
            <Text style={styles.optionDescription}>
              Become a service provider and earn money helping stranded drivers
            </Text>
            <View style={[styles.optionArrow, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
              <Ionicons name="arrow-forward" size={24} color="#34C759" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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
    paddingTop: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    position: 'relative',
  },
  optionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    paddingRight: 40,
  },
  optionArrow: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
