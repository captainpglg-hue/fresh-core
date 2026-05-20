import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';
import { initDatabase } from '../src/services/database';
import { seedDemoData } from '../src/services/demoData';

export default function RootLayout() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        await seedDemoData();
        setDbReady(true);
        await initialize();
      } catch (error: unknown) {
        console.warn('Initialization error:', error);
        setDbReady(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isLoading || !dbReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    // /origine/<id> is the consumer-facing QR target. A customer scanning
    // it isn't an app user, so the auth gate must let them through.
    const inPublic = segments[0] === 'origine';
    if (inPublic) return;

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
        <Stack.Screen name="temperature/releve" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="temperature/correctif" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="reception/nouvelle" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="reception/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="produit/ajouter" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="rapport/ddpp" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="origine/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="camera/capture" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
