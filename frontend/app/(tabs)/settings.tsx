import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
  Linking,
  Share,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { availabilityAPI, deviceAPI, authAPI } from '../../src/api';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS, SHADOWS, WEEKDAY_LABELS } from '../../src/constants/theme';
import { AvailabilityRule } from '../../src/types';

const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuthStore();
  const [availability, setAvailability] = useState<AvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Editable availability state
  const [editRules, setEditRules] = useState<{
    weekday: number;
    enabled: boolean;
    start: string;
    end: string;
  }[]>([]);

  const loadData = async () => {
    try {
      const response = await availabilityAPI.get();
      setAvailability(response.data);
      
      // Initialize edit state from API data
      const rules = WEEKDAY_LABELS.map((_, weekday) => {
        const existing = response.data.find((r: AvailabilityRule) => r.weekday === weekday);
        return {
          weekday,
          enabled: existing?.enabled ?? (weekday < 5), // Default: Mon-Fri enabled
          start: existing ? existing.start_time_local.slice(0, 5) : DEFAULT_START,
          end: existing ? existing.end_time_local.slice(0, 5) : DEFAULT_END,
        };
      });
      setEditRules(rules);
      
      // Check push notification status
      const { status } = await Notifications.getPermissionsAsync();
      setPushEnabled(status === 'granted');
    } catch (error) {
      console.log('Error loading settings:', error);
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

  const handleToggleDay = (weekday: number) => {
    setEditRules(rules => 
      rules.map(r => r.weekday === weekday ? { ...r, enabled: !r.enabled } : r)
    );
  };

  const handleSaveAvailability = async () => {
    setSaving(true);
    try {
      const rules = editRules
        .filter(r => r.enabled)
        .map(r => ({
          weekday: r.weekday,
          start_time_local: r.start + ':00',
          end_time_local: r.end + ':00',
          enabled: true,
        }));
      
      await availabilityAPI.set(rules);
      Alert.alert('Success', 'Availability saved!');
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Could not save availability');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      // Request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      
      // Get push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      
      // Register with backend
      await deviceAPI.register(
        token.data,
        Platform.OS,
        Platform.OS === 'ios' ? 'iPhone' : 'Android'
      );
      
      setPushEnabled(true);
      Alert.alert('Success', 'Push notifications enabled!');
    } catch (error) {
      console.log('Push registration error:', error);
      Alert.alert('Error', 'Could not enable push notifications');
    } finally {
      setPushLoading(false);
    }
  };

  const handleShareBookingLink = async () => {
    if (!user?.public_booking_id) return;
    const bookingUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL}/book/${user.public_booking_id}`;
    try {
      await Share.share({
        message: `Book an appointment with me: ${bookingUrl}`,
        url: bookingUrl,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => {
          logout();
          router.replace('/(auth)/login');
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Section */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>
              {user?.pro_name?.charAt(0).toUpperCase() || 'P'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.pro_name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {user?.business_name && (
              <Text style={styles.profileBusiness}>{user.business_name}</Text>
            )}
          </View>
        </View>

        {/* Booking Link */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="link" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Public Booking Link</Text>
          </View>
          <Text style={styles.bookingUrl} numberOfLines={1}>
            /book/{user?.public_booking_id}
          </Text>
          <Button
            title="Share Booking Link"
            onPress={handleShareBookingLink}
            variant="outline"
            style={styles.shareButton}
          />
        </View>

        {/* Push Notifications */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="notifications" size={20} color={COLORS.warning} />
            <Text style={styles.cardTitle}>Push Notifications</Text>
          </View>
          <View style={styles.pushRow}>
            <Text style={styles.pushText}>
              {pushEnabled ? 'Notifications are enabled' : 'Enable to receive new booking alerts'}
            </Text>
            {!pushEnabled && (
              <Button
                title="Enable"
                onPress={handleEnablePush}
                loading={pushLoading}
                style={styles.enableButton}
              />
            )}
            {pushEnabled && (
              <View style={styles.enabledBadge}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.enabledText}>Enabled</Text>
              </View>
            )}
          </View>
        </View>

        {/* Availability Editor */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar" size={20} color={COLORS.secondary} />
            <Text style={styles.cardTitle}>Availability</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Set your weekly availability for customer bookings
          </Text>
          
          {editRules.map((rule) => (
            <View key={rule.weekday} style={styles.dayRow}>
              <TouchableOpacity
                style={styles.dayToggle}
                onPress={() => handleToggleDay(rule.weekday)}
              >
                <View style={[
                  styles.dayCheckbox,
                  rule.enabled && styles.dayCheckboxActive
                ]}>
                  {rule.enabled && (
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  )}
                </View>
                <Text style={[
                  styles.dayLabel,
                  !rule.enabled && styles.dayLabelDisabled
                ]}>
                  {WEEKDAY_LABELS[rule.weekday]}
                </Text>
              </TouchableOpacity>
              
              {rule.enabled && (
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{rule.start}</Text>
                  <Text style={styles.timeSeparator}>-</Text>
                  <Text style={styles.timeText}>{rule.end}</Text>
                </View>
              )}
            </View>
          ))}
          
          <Button
            title="Save Availability"
            onPress={handleSaveAvailability}
            loading={saving}
            style={styles.saveButton}
          />
        </View>

        {/* Booking Settings */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={20} color={COLORS.info} />
            <Text style={styles.cardTitle}>Booking Settings</Text>
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Appointment Duration</Text>
            <Text style={styles.settingValue}>{user?.default_appt_duration_minutes || 60} min</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Buffer Between Appointments</Text>
            <Text style={styles.settingValue}>{user?.buffer_minutes || 15} min</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Max Appointments Per Day</Text>
            <Text style={styles.settingValue}>{user?.daily_appt_limit || 8}</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>FollowUp Pro v2.0.0</Text>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  profileName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  profileBusiness: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  bookingUrl: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  shareButton: {
    marginTop: SPACING.xs,
  },
  pushRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pushText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  enableButton: {
    paddingHorizontal: SPACING.md,
  },
  enabledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  enabledText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontWeight: '500',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dayCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCheckboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  dayLabelDisabled: {
    color: COLORS.textLight,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
  },
  timeSeparator: {
    color: COLORS.textLight,
  },
  saveButton: {
    marginTop: SPACING.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  settingValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.md,
  },
  logoutText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.error,
    fontWeight: '500',
  },
  version: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxl,
  },
});
