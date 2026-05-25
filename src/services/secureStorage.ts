/**
 * Polyfill cross-platform pour expo-secure-store.
 *
 * En natif (iOS / Android) on délègue directement à expo-secure-store
 * (Keychain / Keystore). En web, expo-secure-store n'a pas
 * d'implémentation native et appeler `getValueWithKeyAsync` jette
 * `n.default.getValueWithKeyAsync is not a function` dans le bundle
 * Metro web — on tombe alors sur localStorage avec un try/catch pour
 * les contextes où il est indisponible (mode incognito strict, certains
 * iframes sandboxés). En dernier recours on retourne null / silencieux
 * pour ne jamais faire crasher l'app sur une préférence non-critique.
 *
 * API alignée sur expo-secure-store :
 *   getItemAsync(key)    → Promise<string | null>
 *   setItemAsync(key, v) → Promise<void>
 *   deleteItemAsync(key) → Promise<void>
 *
 * Tous les imports de l'app doivent passer par ce module et non plus
 * directement par 'expo-secure-store'.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function getLocalStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as { localStorage?: Storage }).localStorage) {
      return (globalThis as { localStorage?: Storage }).localStorage ?? null;
    }
  } catch {
    // localStorage peut throw en mode incognito strict ou iframe sandboxé.
  }
  return null;
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const ls = getLocalStorage();
    if (!ls) return null;
    try {
      return ls.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    const ls = getLocalStorage();
    if (!ls) return;
    try {
      ls.setItem(key, value);
    } catch {
      // quota dépassé / storage interdit → on swallow (préf non-critique).
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    const ls = getLocalStorage();
    if (!ls) return;
    try {
      ls.removeItem(key);
    } catch {
      // idem
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
