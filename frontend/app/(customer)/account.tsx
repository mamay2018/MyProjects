import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
}

function MenuItem({ icon, title, subtitle, onPress, showArrow = true, danger = false }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconBg, danger && styles.dangerIconBg]}>
        <Ionicons name={icon} size={22} color={danger ? '#FF3B30' : '#007AFF'} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, danger && styles.dangerText]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && <Ionicons name="chevron-forward" size={20} color="#444" />}
    </TouchableOpacity>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        {/* Profile Section */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || user?.phone?.slice(-2)}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profilePhone}>{user?.phone}</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Switch to Provider */}
        <TouchableOpacity
          style={styles.switchCard}
          onPress={() => router.push('/(provider)/onboarding')}
        >
          <View style={styles.switchIconBg}>
            <Ionicons name="swap-horizontal" size={24} color="#34C759" />
          </View>
          <View style={styles.switchContent}>
            <Text style={styles.switchTitle}>Become a Provider</Text>
            <Text style={styles.switchSubtitle}>Earn money helping others</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#444" />
        </TouchableOpacity>

        {/* Menu Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="card"
              title="Payment Methods"
              subtitle="Manage your cards"
              onPress={() => {}}
            />
            <MenuItem
              icon="receipt"
              title="Billing History"
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="location"
              title="Saved Addresses"
              onPress={() => {}}
            />
            <MenuItem
              icon="notifications"
              title="Notifications"
              onPress={() => {}}
            />
            <MenuItem
              icon="shield-checkmark"
              title="Privacy & Security"
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="help-circle"
              title="Help Center"
              onPress={() => {}}
            />
            <MenuItem
              icon="chatbubble"
              title="Contact Support"
              onPress={() => {}}
            />
            <MenuItem
              icon="document-text"
              title="Terms & Conditions"
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="log-out"
              title="Sign Out"
              onPress={handleLogout}
              danger
              showArrow={false}
            />
          </View>
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  profilePhone: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  switchIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchContent: {
    flex: 1,
    marginLeft: 12,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
  switchSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    paddingHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  menuGroup: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerIconBg: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  menuContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    fontSize: 16,
    color: '#fff',
  },
  dangerText: {
    color: '#FF3B30',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  version: {
    textAlign: 'center',
    color: '#444',
    fontSize: 13,
    marginBottom: 40,
  },
});
