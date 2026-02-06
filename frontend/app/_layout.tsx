import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/authStore';
import { COLORS } from '../src/constants/theme';

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: 'Setup Business', headerBackVisible: false }} />
        <Stack.Screen name="lead/new" options={{ title: 'Add Lead' }} />
        <Stack.Screen name="lead/[id]/index" options={{ title: 'Lead Details' }} />
        <Stack.Screen name="lead/[id]/conversation" options={{ title: 'Conversation' }} />
        <Stack.Screen name="sequence/[id]" options={{ title: 'Sequence Details' }} />
        <Stack.Screen name="sequence/new" options={{ title: 'Create Sequence' }} />
      </Stack>
    </>
  );
}
