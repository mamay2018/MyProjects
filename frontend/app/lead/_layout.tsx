import { Stack } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

export default function LeadLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
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
      <Stack.Screen name="new" options={{ title: 'Add Lead' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Lead Details' }} />
      <Stack.Screen name="[id]/conversation" options={{ title: 'Conversation' }} />
    </Stack>
  );
}
