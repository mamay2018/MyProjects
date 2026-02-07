import { Stack } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

export default function BookLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.card,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Stack.Screen name="[publicId]" options={{ title: 'Book Appointment' }} />
    </Stack>
  );
}
