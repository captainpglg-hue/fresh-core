import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Source unique de vérité pour le mode démo.
// Quand .env.local est absent ou contient les valeurs placeholder, l'app bascule
// sur l'utilisateur fictif Marie Dupont / Restaurant Le Provençal (voir authStore).
export const isDemoMode =
  !process.env.EXPO_PUBLIC_SUPABASE_URL ||
  supabaseUrl.toLowerCase().includes('placeholder');

/**
 * Adapter de stockage pour la session Supabase, platform-aware :
 *  - iOS/Android : expo-secure-store (Keychain / Keystore, chiffré OS)
 *  - Web : localStorage (pas de Keychain dispo en navigateur)
 *  - SSR / pas de window : in-memory fallback (évite le crash au boot)
 *
 * Lazy-load d'expo-secure-store pour ne pas tirer le module natif en web
 * (où il jette `getValueWithKeyAsync is not a function` au runtime).
 */
function makeStorageAdapter() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      return {
        getItem: async (key: string) => window.localStorage.getItem(key),
        setItem: async (key: string, value: string) => window.localStorage.setItem(key, value),
        removeItem: async (key: string) => window.localStorage.removeItem(key),
      };
    }
    // SSR / sandbox sans localStorage : in-memory.
    const mem: Record<string, string> = {};
    return {
      getItem: async (key: string) => mem[key] ?? null,
      setItem: async (key: string, value: string) => { mem[key] = value; },
      removeItem: async (key: string) => { delete mem[key]; },
    };
  }

  // Native (iOS / Android). Lazy-load pour ne pas crash sur web.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require('expo-secure-store');
  return {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: makeStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
