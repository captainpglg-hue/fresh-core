# Vérification fresh-core — 17 avril 2026

Rapport de vérification statique effectué sans `npm install` (impossible dans mon environnement — Expo + RN = ~550 paquets, la sandbox tombe en OOM avant la fin). Les points ci-dessous sont **vérifiés par lecture du code**, pas par exécution. Pour le `tsc` et le `npm test` réels, voir la section "À exécuter chez vous" en bas.

## Ce qui est SAIN ✓

1. **Imports cohérents** — les 24 packages utilisés par le code (`src/` + `app/`) sont tous déclarés dans `package.json`. Aucun import cassé, aucun paquet manquant.
2. **Chemins relatifs** — les 200+ imports relatifs (`../../src/...`) pointent tous vers un fichier qui existe. Pas de route orpheline, pas de composant fantôme.
3. **Routes** — toutes les `Stack.Screen` déclarées dans `app/_layout.tsx` ont leur fichier `.tsx` correspondant. Les tabs cachés (`href:null`) aussi.
4. **Schéma DB aligné** — les 13 tables principales existent **à la fois** dans Supabase (`001_initial_schema.sql`) et SQLite local (`services/database.ts`). La table `sync_queue` n'existe que côté SQLite, ce qui est **voulu** (c'est la file offline→online).
5. **Types métier solides** — `TemperatureReading`, `Equipment`, `Supplier`, etc. sont bien typés, enums alignés avec les CHECK constraints Postgres.
6. **Tests présents** — 4 fichiers `.test.ts` (database, ocr, merkle, thresholds). `jest.setup.js` mock bien tout ce qui touche au natif (expo-camera, expo-sqlite, expo-crypto, expo-notifications, expo-secure-store, expo-network, expo-file-system, @react-native-ml-kit). Rien ne devrait péter à `npm test` à part des défauts de logique s'il y en a.
7. **Mode démo seedé** — `seedDemoData()` crée 6 équipements, 3 fournisseurs, 8 tâches nettoyage, 5 produits en stock, 3 relevés, 4 checkpoints nuisibles. Dashboard non vide au premier lancement.
8. **.gitignore correct** — `.env.local` est bien ignoré (`.env*.local`), les dossiers natifs `/ios` `/android` aussi.
9. **Aucun TODO/FIXME/HACK** dans le code de `src/` et `app/` — pas de dette reconnue.

## Ce qui est CASSÉ ✗

### Bug bloquant : mode démo ne s'activera jamais en production

**Fichier** : `src/stores/authStore.ts` ligne 29

```ts
const isDemo = !supabaseUrl || supabaseUrl.includes('PLACEHOLDER');
```

**Fichier** : `src/services/supabase.ts` ligne 4-5

```ts
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
```

Le fallback Supabase contient `placeholder` en **minuscules**, mais `authStore.ts` teste `includes('PLACEHOLDER')` en **MAJUSCULES**. Résultat : quand `.env.local` est absent, `supabaseUrl` vaut `https://placeholder.supabase.co`, `isDemo` vaut **false**, l'app essaie d'appeler un vrai Supabase à cette URL fake, le réseau timeoute → l'écran reste bloqué sur le loading.

**Fix 1 ligne** :

```ts
// dans authStore.ts
const isDemo = !supabaseUrl || supabaseUrl.toLowerCase().includes('placeholder');
```

Ou mieux, exporter `isDemoMode` depuis `supabase.ts` et l'importer partout. C'est déjà dans le plan étape 2.

## Ce qui est SALE (pas bloquant, mais à nettoyer)

### Doublons EN/FR confirmés (10 au total)

Chaque écran existe en double. Les français sont ceux branchés dans le layout. Les anglais sont du code mort :

- `app/(tabs)/cleaning.tsx` + `nettoyage.tsx`
- `app/(tabs)/cooking.tsx` + `cuisson.tsx`
- `app/(tabs)/deliveries.tsx` + `receptions.tsx`
- `app/(tabs)/oil.tsx` + `huiles.tsx`
- `app/(tabs)/pests.tsx` + `nuisibles.tsx`
- `app/(tabs)/traceability.tsx` + `tracabilite.tsx`
- `app/(tabs)/settings.tsx` + `reglages.tsx`
- `app/delivery/` (dossier) + `app/reception/`
- `app/report/ddpp.tsx` + `app/rapport/ddpp.tsx`
- `app/temperature/corrective.tsx` + `correctif.tsx`

**Action** : supprimer les 10 versions anglaises + leurs Stack.Screen dans `app/_layout.tsx` et Tabs.Screen dans `app/(tabs)/_layout.tsx`. C'est l'étape 1 du plan.

### Dépendances déclarées mais jamais importées

Confirmé par `grep` sur tout `src/` et `app/` :

- `ethers` (~500 KB, 0 import) — la feature blockchain est stubbed (champ `blockchain_hash` en DB toujours null)
- `expo-image-picker` (0 import) — prévu mais pas câblé
- `react-native-qrcode-svg` (0 import) — prévu pour certificats mais pas câblé

Plus dans la catégorie "peer deps qu'Expo installe automatiquement mais le code n'importe pas directement" (garder) :
`expo`, `expo-constants`, `expo-linking`, `expo-splash-screen`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens`, `@react-native-community/datetimepicker`.

**Action** : retirer `ethers`, `expo-image-picker`, `react-native-qrcode-svg` du `package.json`, plus le fichier `src/services/blockchain.ts` et possiblement `src/utils/merkle.ts` (utilisé uniquement par blockchain et par `utils/hash.ts` lui-même peu utilisé).

### Fichier orphelin à la racine

- `App.tsx` (le "Open up App.tsx to start working on your app!" par défaut d'Expo). L'entry est `index.ts` → `expo-router/entry`, donc App.tsx ne sert à rien. À supprimer.

### Écarts mineurs seuils/équipements

Dans `src/constants/thresholds.ts` : les équipements typés `display_case` et `fryer` n'ont pas de seuil défini. `isCompliant()` retourne `true` par défaut pour ces types. Pas bloquant pour la démo, mais une friteuse aura toujours "conforme" dans les rapports. À compléter quand la règle sera claire (friteuse : TPM ≤ 25 %, c'est déjà dans `oil_tpm`, donc probablement OK).

## À exécuter chez vous pour confirmer

Ces commandes nécessitent une vraie machine (la sandbox n'a pas assez de RAM pour installer 550 paquets). Lancez-les dans l'ordre dans un PowerShell ou un terminal :

```powershell
cd C:\Users\Gigon Le Grain\Desktop\Projets\fresh-core
npm install
npm test
npx tsc --noEmit
```

**Attendus** :
- `npm install` : doit terminer sans erreur peer-deps bloquante. Les warnings `deprecated` sont OK.
- `npm test` : doit afficher 4 suites, 15-20 tests, tout vert.
- `npx tsc --noEmit` : aucune erreur. Si erreurs, copiez-les moi et je les traite.

Une fois ces 3 commandes à vert, le projet est formellement prêt à passer en étape 1 du plan (nettoyage du code mort).

## Synthèse

| Dimension            | État       | Commentaire                                       |
|----------------------|------------|---------------------------------------------------|
| Structure projet     | ✓          | Expo/RN/TS propre, architecture cohérente          |
| Imports & packages   | ✓          | Rien de manquant, rien de mal référencé            |
| Schéma DB            | ✓          | Postgres ↔ SQLite alignés                          |
| Types                | ✓          | Strict TS, enums = CHECK constraints               |
| Tests                | ?          | À confirmer avec `npm test` sur votre machine     |
| Mode démo runtime    | ✗          | **Bug 1 ligne** à corriger avant tout test réel    |
| Code mort            | ⚠          | 10 doublons EN/FR + 3 deps inutiles + `App.tsx`    |

**Verdict** : une fois le bug démo corrigé et `npm install && npm test` confirmés chez vous, l'app est techniquement prête pour l'étape 1 du plan. L'architecture est saine, ce ne sont que des finitions à passer.
