import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';
import { initDatabase } from '../src/services/database';

export default function RootLayout() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        setDbReady(true);
        await initialize();
      } catch (e) {
        console.warn('Init error:', e);
        setDbReady(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isLoading || !dbReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, dbReady, segments]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="temperature/[equipmentId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="temperature/corrective" options={{ presentation: 'modal' }} />
        <Stack.Screen name="delivery/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="delivery/[deliveryId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="report/ddpp" options={{ presentation: 'modal' }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
