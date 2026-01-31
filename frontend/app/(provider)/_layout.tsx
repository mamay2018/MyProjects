import { Stack } from 'expo-router';

export default function ProviderLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
