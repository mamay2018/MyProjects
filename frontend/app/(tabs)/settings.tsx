import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  Share,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { availabilityAPI, deviceAPI, authAPI, debugAPI } from '../../src/api';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS, SHADOWS, WEEKDAY_LABELS } from '../../src/constants/theme';
import { AvailabilityRule } from '../../src/types';

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

const formatTime12h = (time24: string) => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

interface DayRule {
  weekday: number;
  enabled: boolean;
  start: string;
  end: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);

  // Availability state
  const [editRules, setEditRules] = useState<DayRule[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'start' | 'end'>('start');

  // Booking settings state
  const [showBookingSettings, setShowBookingSettings] = useState(false);
  const [duration, setDuration] = useState('60');
  const [buffer, setBuffer] = useState('15');
  const [dailyLimit, setDailyLimit] = useState('8');

  const loadData = async () => {
    try {
      const response = await availabilityAPI.get();
      
      // Initialize edit state
      const rules = WEEKDAY_LABELS.map((_, weekday) => {
        const existing = response.data.find((r: AvailabilityRule) => r.weekday === weekday);
        return {
          weekday,
          enabled: existing?.enabled ?? (weekday < 5),
          start: existing ? existing.start_time_local.slice(0, 5) : '09:00',
          end: existing ? existing.end_time_local.slice(0, 5) : '17:00',
        };
      });
      setEditRules(rules);
      
      // Set booking settings from user
      if (user) {
        setDuration(String(user.default_appt_duration_minutes || 60));
        setBuffer(String(user.buffer_minutes || 15));
        setDailyLimit(String(user.daily_appt_limit || 8));
      }
      
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
    }, [user])
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

  const openTimePicker = (weekday: number, field: 'start' | 'end') => {
    setEditingDay(weekday);
    setEditingField(field);
    setShowTimePicker(true);
  };

  const handleTimeSelect = (time: string) => {
    if (editingDay !== null) {
      setEditRules(rules =>
        rules.map(r => {
          if (r.weekday === editingDay) {
            const newRule = { ...r, [editingField]: time };
            // Validate: end must be after start
            if (editingField === 'start' && time >= r.end) {
              // Auto-adjust end time
              const startIndex = TIME_OPTIONS.indexOf(time);
              const newEnd = TIME_OPTIONS[Math.min(startIndex + 2, TIME_OPTIONS.length - 1)];
              newRule.end = newEnd;
            } else if (editingField === 'end' && time <= r.start) {
              Alert.alert('Invalid Time', 'End time must be after start time');
              return r;
            }
            return newRule;
          }
          return r;
        })
      );
    }
    setShowTimePicker(false);
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
    } catch (error) {
      Alert.alert('Error', 'Could not save availability');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBookingSettings = async () => {
    const durationNum = parseInt(duration) || 60;
    const bufferNum = parseInt(buffer) || 15;
    const limitNum = parseInt(dailyLimit) || 8;

    if (durationNum < 15 || durationNum > 480) {
      Alert.alert('Invalid Duration', 'Duration must be between 15 and 480 minutes');
      return;
    }
    if (bufferNum < 0 || bufferNum > 120) {
      Alert.alert('Invalid Buffer', 'Buffer must be between 0 and 120 minutes');
      return;
    }
    if (limitNum < 1 || limitNum > 50) {
      Alert.alert('Invalid Limit', 'Daily limit must be between 1 and 50');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        default_appt_duration_minutes: durationNum,
        buffer_minutes: bufferNum,
        daily_appt_limit: limitNum,
      });
      setShowBookingSettings(false);
      Alert.alert('Success', 'Booking settings saved!');
    } catch (error) {
      Alert.alert('Error', 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
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
      Alert.alert('Error', 'Could not enable push notifications. Make sure you are using a development build, not Expo Go.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    setTestPushLoading(true);
    try {
      const result = await debugAPI.sendPush({
        title: '🔔 Test Notification',
        body: 'Push notifications are working!',
        data: { type: 'test' },
      });
      
      if (result.data.success) {
        Alert.alert(
          'Test Sent!',
          result.data.mock_mode 
            ? 'Running in MOCK_MODE - notification logged but not sent to device.'
            : `Notification sent to ${result.data.tokens_targeted} device(s).`
        );
      } else {
        Alert.alert('No Devices', result.data.message || 'No devices registered for push notifications.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not send test notification');
    } finally {
      setTestPushLoading(false);
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
          
          {!pushEnabled ? (
            <View style={styles.pushRow}>
              <Text style={styles.pushText}>Enable to receive new booking alerts</Text>
              <Button
                title="Enable"
                onPress={handleEnablePush}
                loading={pushLoading}
                style={styles.enableButton}
              />
            </View>
          ) : (
            <>
              <View style={styles.pushRow}>
                <View style={styles.enabledBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.enabledText}>Enabled</Text>
                </View>
              </View>
              <Button
                title="Send Test Push"
                onPress={handleTestPush}
                loading={testPushLoading}
                variant="outline"
                style={styles.testButton}
              />
            </>
          )}
        </View>

        {/* Availability Editor */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar" size={20} color={COLORS.secondary} />
            <Text style={styles.cardTitle}>Weekly Availability</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Set when customers can book appointments
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
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => openTimePicker(rule.weekday, 'start')}
                  >
                    <Text style={styles.timeButtonText}>{formatTime12h(rule.start)}</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeSeparator}>to</Text>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => openTimePicker(rule.weekday, 'end')}
                  >
                    <Text style={styles.timeButtonText}>{formatTime12h(rule.end)}</Text>
                  </TouchableOpacity>
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
        <TouchableOpacity style={styles.card} onPress={() => setShowBookingSettings(true)}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={20} color={COLORS.info} />
            <Text style={styles.cardTitle}>Booking Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} style={{ marginLeft: 'auto' }} />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Appointment Duration</Text>
            <Text style={styles.settingValue}>{user?.default_appt_duration_minutes || 60} min</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Buffer Between Appts</Text>
            <Text style={styles.settingValue}>{user?.buffer_minutes || 15} min</Text>
          </View>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.settingLabel}>Max Per Day</Text>
            <Text style={styles.settingValue}>{user?.daily_appt_limit || 8}</Text>
          </View>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>FollowUp Pro v2.0.0</Text>
      </ScrollView>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModal}>
            <Text style={styles.modalTitle}>
              Select {editingField === 'start' ? 'Start' : 'End'} Time
            </Text>
            <ScrollView style={styles.timeList}>
              {TIME_OPTIONS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeOption,
                    editRules[editingDay || 0]?.[editingField] === time && styles.timeOptionActive
                  ]}
                  onPress={() => handleTimeSelect(time)}
                >
                  <Text style={[
                    styles.timeOptionText,
                    editRules[editingDay || 0]?.[editingField] === time && styles.timeOptionTextActive
                  ]}>
                    {formatTime12h(time)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Booking Settings Modal */}
      <Modal visible={showBookingSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModal}>
            <Text style={styles.modalTitle}>Booking Settings</Text>
            
            <Text style={styles.inputLabel}>Appointment Duration (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
              placeholder="60"
            />
            
            <Text style={styles.inputLabel}>Buffer Between Appointments (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              value={buffer}
              onChangeText={setBuffer}
              keyboardType="number-pad"
              placeholder="15"
            />
            
            <Text style={styles.inputLabel}>Max Appointments Per Day</Text>
            <TextInput
              style={styles.modalInput}
              value={dailyLimit}
              onChangeText={setDailyLimit}
              keyboardType="number-pad"
              placeholder="8"
            />
            
            <Button
              title="Save Settings"
              onPress={handleSaveBookingSettings}
              loading={saving}
              style={styles.modalSaveButton}
            />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowBookingSettings(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  testButton: {
    marginTop: SPACING.md,
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
    width: 40,
  },
  dayLabelDisabled: {
    color: COLORS.textLight,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeButton: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  timeSeparator: {
    color: COLORS.textLight,
    fontSize: FONTS.sizes.sm,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  timePickerModal: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  timeList: {
    maxHeight: 300,
  },
  timeOption: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
  },
  timeOptionActive: {
    backgroundColor: COLORS.primary + '15',
  },
  timeOptionText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    textAlign: 'center',
  },
  timeOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalCancel: {
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  modalCancelText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  bookingModal: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalSaveButton: {
    marginTop: SPACING.lg,
  },
});
