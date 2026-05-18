import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../src/stores/authStore';
import { initDatabase } from '../src/services/database';
import { seedDemoData } from '../src/services/demoData';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import { useNotifications } from '../src/hooks/useNotifications';

const ONBOARDING_DONE_KEY = 'fc.onboarding.seen';

export default function RootLayout() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [dbReady, setDbReady] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useNotifications();

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        await seedDemoData();
        setDbReady(true);
        await initialize();
        const seen = await SecureStore.getItemAsync(ONBOARDING_DONE_KEY);
        setOnboardingSeen(seen === '1');
      } catch (error: unknown) {
        console.warn('Initialization error:', error);
        setDbReady(true);
        setOnboardingSeen(true);
      }
    };
    init();
  }, [initialize]);

  useEffect(() => {
    if (isLoading || !dbReady || onboardingSeen === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!onboardingSeen && !inOnboarding) {
      router.replace('/onboarding');
      void SecureStore.setItemAsync(ONBOARDING_DONE_KEY, '1');
      setOnboardingSeen(true);
      return;
    }

    if (!isAuthenticated && !inAuthGroup && !inOnboarding) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, dbReady, onboardingSeen, segments, router]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="temperature/[equipmentId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="temperature/releve" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="temperature/correctif" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="reception/nouvelle" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="reception/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="produit/ajouter" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="rapport/ddpp" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="camera/capture" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
