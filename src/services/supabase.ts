import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Source unique de vérité pour le mode démo.
// Quand .env.local est absent ou contient les valeurs placeholder, l'app bascule
// sur l'utilisateur fictif Marie Dupont / Restaurant Le Provençal (voir authStore).
export const isDemoMode =
  !process.env.EXPO_PUBLIC_SUPABASE_URL ||
  supabaseUrl.toLowerCase().includes('placeholder');

// expo-secure-store n'a pas d'implémentation web : sur navigateur on retombe
// sur localStorage. Sans ça, _emitInitialSession() throw au boot et le bundle
// s'arrête avant que React monte (#root reste vide).
const WebStorageAdapter = {
  getItem: async (key: string) =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null,
  setItem: async (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const storage = Platform.OS === 'web' ? WebStorageAdapter : ExpoSecureStoreAdapter;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
