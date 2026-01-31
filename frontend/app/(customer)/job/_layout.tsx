import { Stack } from 'expo-router';

export default function JobLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    />
  );
}
