import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { requestNotificationPermission } from '../lib/notifications';

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  useEffect(() => {
    if (session) requestNotificationPermission();
  }, [session]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="plant/[id]" options={{ headerShown: true, title: 'Plant Detail', headerTintColor: '#4a7c59' }} />
      <Stack.Screen name="plant/[id]/log-event" options={{ headerShown: true, title: 'Log Event', headerTintColor: '#4a7c59', presentation: 'modal' }} />
      <Stack.Screen name="plant/[id]/edit" options={{ headerShown: true, title: 'Edit Plant', headerTintColor: '#4a7c59', presentation: 'modal' }} />
      <Stack.Screen name="species-search" options={{ headerShown: true, title: 'Find Species', headerTintColor: '#4a7c59', presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
