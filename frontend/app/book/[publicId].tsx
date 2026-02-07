import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { publicBookingAPI } from '../../src/api';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS, SHADOWS } from '../../src/constants/theme';
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns';

interface BookingSlot {
  start_at_utc: string;
  end_at_utc: string;
}

interface BookingSlotsResponse {
  pro_name: string;
  business_name: string | null;
  duration_minutes: number;
  slots: BookingSlot[];
}

interface BookingConfirmation {
  appointment_id: string;
  start_at_utc: string;
  end_at_utc: string;
  pro_name: string;
  business_name: string | null;
  ics_url: string;
}

export default function PublicBookingScreen() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotsData, setSlotsData] = useState<BookingSlotsResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  
  // Customer form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadSlots();
  }, [publicId]);

  const loadSlots = async () => {
    if (!publicId) return;
    try {
      const response = await publicBookingAPI.getSlots(publicId);
      setSlotsData(response.data);
      setError(null);
    } catch (err: any) {
      console.log('Error loading slots:', err);
      if (err.response?.status === 404) {
        setError('Booking page not found. Please check the link.');
      } else {
        setError('Could not load available times. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot || !customerName) {
      Alert.alert('Error', 'Please select a time and enter your name');
      return;
    }
    if (!customerPhone && !customerEmail) {
      Alert.alert('Error', 'Please enter your phone number or email');
      return;
    }

    setBooking(true);
    try {
      const response = await publicBookingAPI.createBooking(publicId!, {
        start_at_utc: selectedSlot.start_at_utc,
        customer_name: customerName,
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        notes: notes || undefined,
      });
      setConfirmation(response.data);
    } catch (err: any) {
      console.log('Booking error:', err);
      Alert.alert('Booking Failed', err.response?.data?.detail || 'Could not complete booking. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const handleAddToCalendar = () => {
    if (confirmation?.ics_url) {
      Linking.openURL(confirmation.ics_url);
    }
  };

  // Group slots by date
  const slotsByDate = React.useMemo(() => {
    if (!slotsData?.slots) return {};
    const grouped: Record<string, BookingSlot[]> = {};
    slotsData.slots.forEach(slot => {
      const date = slot.start_at_utc.split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(slot);
    });
    return grouped;
  }, [slotsData]);

  const dates = Object.keys(slotsByDate).sort();

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  // Confirmation Screen
  if (confirmation) {
    const apptTime = parseISO(confirmation.start_at_utc);
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.confirmationContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
          </View>
          <Text style={styles.confirmationTitle}>Booking Confirmed!</Text>
          <Text style={styles.confirmationSubtitle}>
            Your appointment with {confirmation.business_name || confirmation.pro_name} is scheduled.
          </Text>
          
          <View style={styles.confirmationCard}>
            <View style={styles.confirmationRow}>
              <Ionicons name="calendar" size={20} color={COLORS.primary} />
              <Text style={styles.confirmationText}>
                {format(apptTime, 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>
            <View style={styles.confirmationRow}>
              <Ionicons name="time" size={20} color={COLORS.primary} />
              <Text style={styles.confirmationText}>
                {format(apptTime, 'h:mm a')}
              </Text>
            </View>
            <View style={styles.confirmationRow}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
              <Text style={styles.confirmationText}>
                {customerName}
              </Text>
            </View>
          </View>

          <Button
            title="Add to Calendar"
            onPress={handleAddToCalendar}
            style={styles.calendarButton}
            icon={<Ionicons name="calendar-outline" size={20} color="#FFF" />}
          />
          
          <Text style={styles.confirmationNote}>
            A confirmation message has been sent. We look forward to seeing you!
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Loading State
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading available times...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error State
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color={COLORS.error} />
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try Again" onPress={loadSlots} style={styles.retryButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.businessIcon}>
            <Ionicons name="business" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.businessName}>
            {slotsData?.business_name || slotsData?.pro_name || 'Book Appointment'}
          </Text>
          <Text style={styles.duration}>
            {slotsData?.duration_minutes} minute appointment
          </Text>
        </View>

        {/* Date Selection */}
        <Text style={styles.sectionTitle}>Select a Date</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datesContainer}
        >
          {dates.length === 0 ? (
            <Text style={styles.noSlotsText}>No available times. Please check back later.</Text>
          ) : (
            dates.map(date => (
              <TouchableOpacity
                key={date}
                style={[
                  styles.dateChip,
                  selectedDate === date && styles.dateChipActive
                ]}
                onPress={() => {
                  setSelectedDate(date);
                  setSelectedSlot(null);
                }}
              >
                <Text style={[
                  styles.dateChipText,
                  selectedDate === date && styles.dateChipTextActive
                ]}>
                  {getDateLabel(date)}
                </Text>
                <Text style={[
                  styles.dateChipCount,
                  selectedDate === date && styles.dateChipTextActive
                ]}>
                  {slotsByDate[date].length} slots
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Time Selection */}
        {selectedDate && (
          <>
            <Text style={styles.sectionTitle}>Select a Time</Text>
            <View style={styles.timesGrid}>
              {slotsByDate[selectedDate]?.map((slot, index) => {
                const time = parseISO(slot.start_at_utc);
                const isSelected = selectedSlot?.start_at_utc === slot.start_at_utc;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.timeChip,
                      isSelected && styles.timeChipActive
                    ]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text style={[
                      styles.timeChipText,
                      isSelected && styles.timeChipTextActive
                    ]}>
                      {format(time, 'h:mm a')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Customer Info Form */}
        {selectedSlot && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Your Information</Text>
            
            <Input
              label="Name *"
              placeholder="Your full name"
              value={customerName}
              onChangeText={setCustomerName}
              autoCapitalize="words"
            />
            
            <Input
              label="Phone Number *"
              placeholder="(555) 123-4567"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />
            
            <Input
              label="Email"
              placeholder="your@email.com"
              value={customerEmail}
              onChangeText={setCustomerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <Input
              label="Notes (optional)"
              placeholder="Any details about your appointment..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.selectedSummary}>
              <Ionicons name="calendar" size={18} color={COLORS.primary} />
              <Text style={styles.selectedSummaryText}>
                {format(parseISO(selectedSlot.start_at_utc), 'EEEE, MMMM d')} at {format(parseISO(selectedSlot.start_at_utc), 'h:mm a')}
              </Text>
            </View>

            <Button
              title="Confirm Booking"
              onPress={handleBook}
              loading={booking}
              style={styles.bookButton}
            />
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  errorTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  errorText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  retryButton: {
    marginTop: SPACING.lg,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  businessIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  businessName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  duration: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  datesContainer: {
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  noSlotsText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  dateChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    marginRight: SPACING.sm,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  dateChipActive: {
    backgroundColor: COLORS.primary,
  },
  dateChipText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  dateChipTextActive: {
    color: '#FFFFFF',
  },
  dateChipCount: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  timesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  timeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timeChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  timeChipTextActive: {
    color: '#FFFFFF',
  },
  formSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  selectedSummaryText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  bookButton: {
    marginTop: SPACING.sm,
  },
  // Confirmation styles
  confirmationContent: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  successIcon: {
    marginTop: SPACING.xxl,
    marginBottom: SPACING.lg,
  },
  confirmationTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  confirmationSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  confirmationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    gap: SPACING.md,
    ...SHADOWS.md,
  },
  confirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  confirmationText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  calendarButton: {
    marginTop: SPACING.lg,
    width: '100%',
  },
  confirmationNote: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
});
