import { Stack } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

export default function SequenceLayout() {
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
      <Stack.Screen name="new" options={{ title: 'Create Sequence' }} />
      <Stack.Screen name="[id]" options={{ title: 'Sequence Details' }} />
    </Stack>
  );
}
