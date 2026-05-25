/**
 * Régression — feat(secure-storage): polyfill localStorage pour le bundle web.
 *
 * `expo-secure-store` n'a pas d'implémentation web → 3 erreurs console
 * récurrentes dans le test E2E Playwright précédent
 * (`n.default.getValueWithKeyAsync is not a function`).
 *
 * Le wrapper `src/services/secureStorage.ts` doit :
 *  - en web → utiliser localStorage avec try/catch
 *  - en natif → déléguer à expo-secure-store
 */

describe('secureStorage wrapper', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('web: setItemAsync + getItemAsync → roundtrip via localStorage', async () => {
    const store: Record<string, string> = {};
    const fakeLocalStorage = {
      getItem: jest.fn((k: string) => (k in store ? store[k] : null)),
      setItem: jest.fn((k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn((k: string) => {
        delete store[k];
      }),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage = fakeLocalStorage;

    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }));
    // Le module expo-secure-store ne doit PAS être appelé en mode web.
    const secureStoreMock = {
      getItemAsync: jest.fn(),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn(),
    };
    jest.doMock('expo-secure-store', () => secureStoreMock);

    const wrapper = require('../../src/services/secureStorage');
    await wrapper.setItemAsync('fc.test', 'hello');
    const v = await wrapper.getItemAsync('fc.test');
    expect(v).toBe('hello');
    expect(fakeLocalStorage.setItem).toHaveBeenCalledWith('fc.test', 'hello');
    expect(fakeLocalStorage.getItem).toHaveBeenCalledWith('fc.test');
    // Vérifie qu'on n'a PAS délégué à expo-secure-store côté web.
    expect(secureStoreMock.setItemAsync).not.toHaveBeenCalled();
    expect(secureStoreMock.getItemAsync).not.toHaveBeenCalled();

    await wrapper.deleteItemAsync('fc.test');
    expect(fakeLocalStorage.removeItem).toHaveBeenCalledWith('fc.test');
    expect(await wrapper.getItemAsync('fc.test')).toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;
  });

  it('web: getItemAsync sans localStorage (incognito strict) → renvoie null sans throw', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;

    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
    jest.doMock('expo-secure-store', () => ({
      getItemAsync: jest.fn(),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn(),
    }));

    const wrapper = require('../../src/services/secureStorage');
    await expect(wrapper.getItemAsync('any')).resolves.toBeNull();
    await expect(wrapper.setItemAsync('any', 'v')).resolves.toBeUndefined();
    await expect(wrapper.deleteItemAsync('any')).resolves.toBeUndefined();
  });

  it('natif (ios): délègue à expo-secure-store', async () => {
    const secureStoreMock = {
      getItemAsync: jest.fn(() => Promise.resolve('native-value')),
      setItemAsync: jest.fn(() => Promise.resolve()),
      deleteItemAsync: jest.fn(() => Promise.resolve()),
    };
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    jest.doMock('expo-secure-store', () => secureStoreMock);

    const wrapper = require('../../src/services/secureStorage');
    await wrapper.setItemAsync('k', 'v');
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith('k', 'v');
    const got = await wrapper.getItemAsync('k');
    expect(secureStoreMock.getItemAsync).toHaveBeenCalledWith('k');
    expect(got).toBe('native-value');
    await wrapper.deleteItemAsync('k');
    expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith('k');
  });

  it("aucun import direct de 'expo-secure-store' hors du wrapper", () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const repoRoot = join(__dirname, '..', '..');
    const targets = [
      'src/services/supabase.ts',
      'app/_layout.tsx',
      'app/(tabs)/reglages.tsx',
    ];
    for (const rel of targets) {
      const src = readFileSync(join(repoRoot, rel), 'utf8');
      expect(src).not.toMatch(/from\s+['"]expo-secure-store['"]/);
      expect(src).toMatch(/from\s+['"][^'"]*secureStorage['"]/);
    }
  });
});
