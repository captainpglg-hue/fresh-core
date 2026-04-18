# Fresh-Core — Contexte pour Claude Code

> Lis ce fichier en entier avant toute action. Il décrit l'état du projet, la stack, les conventions et les garde-fous. Le plan d'exécution étape par étape est dans `~/Desktop/PLAN-DEMO-PILOTE.md` (hors repo, document de travail).

## Mission produit

Application mobile HACCP pour restaurateurs. Remplace les fiches papier par un protocole photo guidé de 30 secondes. Cible : TPE de la restauration (1-10 couverts/service) qui craignent le contrôle DDPP et perdent du temps sur la paperasse.

**Objectif court terme** (2 semaines) : une **beta installable sur le téléphone Android du propriétaire du projet** (Philippe), utilisable en conditions réelles pour valider le parcours de saisie quotidien avant pilote client.

## Stack

- **Framework** : Expo 54 + React Native 0.81 + React 19 + TypeScript (strict)
- **Navigation** : expo-router v6 (file-based)
- **State** : zustand (un store par domaine métier)
- **Forms** : react-hook-form + zod
- **Backend** : Supabase (Postgres + auth + storage) — migration SQL dans `supabase/migrations/`
- **Local DB** : expo-sqlite (offline-first, table miroir du schema Supabase)
- **OCR** : `@react-native-ml-kit/text-recognition` → **module natif, PAS compatible Expo Go, exige un dev build**
- **Camera** : expo-camera
- **PDF** : expo-print (rapport DDPP)
- **Notifications** : expo-notifications
- **Tests** : jest + jest-expo + @testing-library/react-native

## Architecture des dossiers

```
app/                     Routes expo-router (UI)
  (auth)/                Login, register, layout auth
  (tabs)/                5 onglets visibles + écrans masqués (href:null)
  camera/capture.tsx     Écran caméra plein écran
  delivery/ reception/   Flux réception marchandise
  produit/ajouter.tsx    Ajout produit en stock
  rapport/ddpp.tsx       Génération PDF DDPP
  temperature/           Relevé, correctif
  onboarding.tsx
src/
  components/ui/         Button, Card, Badge, Input, Header, ProgressCircle, Text…
  components/camera/     CameraOverlay, CameraScreen, OCRResult, OCRResultCard
  components/forms/      FormField, FormPicker, FormSwitch, FormDatePicker
  components/charts/     TemperatureChart
  constants/             colors, thresholds (seuils HACCP), dlcRules
  hooks/                 useAuth, useCamera, useDashboard, useOCR, useOfflineSync, useNotifications
  services/              supabase, database (SQLite), sync, ocr, pdf, notifications, blockchain, demoData
  stores/                authStore, temperatureStore, cleaningStore, cookingStore, oilStore, pestStore,
                         deliveryStore, traceabilityStore, supplierStore, syncStore
  types/                 api, database, navigation
  utils/                 dateUtils, hash, merkle
supabase/migrations/     001_initial_schema.sql (248 lignes)
```

## Modules HACCP (7)

| # | Module          | Route onglet      | Routes masquées connexes                          | Store                  |
|---|-----------------|-------------------|---------------------------------------------------|------------------------|
| 1 | Températures    | `(tabs)/temperatures` | `temperature/[equipmentId]`, `temperature/releve`, `temperature/correctif` | temperatureStore       |
| 2 | Réceptions      | `(tabs)/receptions`   | `reception/nouvelle`, `reception/[id]`             | deliveryStore, supplierStore |
| 3 | Nettoyage       | `(tabs)/nettoyage`    | —                                                  | cleaningStore          |
| 4 | Cuisson         | `(tabs)/cuisson` (via Plus) | —                                            | cookingStore           |
| 5 | Traçabilité/DLC | `(tabs)/tracabilite` (via Plus) | `produit/ajouter`                        | traceabilityStore      |
| 6 | Huiles          | `(tabs)/huiles` (via Plus) | —                                             | oilStore               |
| 7 | Nuisibles       | `(tabs)/nuisibles` (via Plus) | —                                          | pestStore              |

Tab bar visible : Accueil, Températures, Réceptions, Nettoyage, **Plus** (sous-menu vers les 4 autres modules + Réglages).

## État actuel (snapshot 17 avril 2026)

### Ce qui marche
- Bootstrap app : `app/_layout.tsx` initialise SQLite → seed demoData → initialize authStore → redirige vers (auth) ou (tabs)
- **Mode démo** : si `EXPO_PUBLIC_SUPABASE_URL` absent, l'app bascule sur faux utilisateur `Marie Dupont` / `Restaurant Le Provençal` avec 6 équipements, 3 fournisseurs, 5 produits, 3 relevés de température, 4 checkpoints nuisibles déjà seedés.
- Unit tests : `database.test.ts`, `ocr.test.ts`, `merkle.test.ts`, `thresholds.test.ts` → `npm test` doit passer.
- Génération PDF DDPP (`src/services/pdf.ts` + `app/rapport/ddpp.tsx`).

### Ce qui bloque une beta téléphone
1. **`node_modules` absent** → `npm install` à faire.
2. **Aucun `.env.local` ni exemple** → le README le référence mais le fichier manque. Créer `.env.local.example` et le `.env.local` pour le dev local.
3. **Supabase pas provisionné** → pas de projet réel, pas de clés. À créer sur supabase.com, appliquer la migration SQL, récupérer URL + anon key.
4. **Pas de dev build** → Expo Go ne suffit pas (ML Kit OCR natif). Deux options :
   - **EAS Build cloud** (recommandé) : `eas build --profile preview --platform android` → APK signé téléchargeable.
   - **Build local** : `npx expo prebuild` + `npx expo run:android` (nécessite Android Studio + SDK installés sur la machine de dev).
5. **`App.tsx` racine orphelin** : placeholder Expo vide qui n'est pas l'entry point (l'entry est `expo-router/entry` via `index.ts`). À supprimer.
6. **Doublons EN/FR** : chaque écran existe en double (`cleaning.tsx` + `nettoyage.tsx`, etc.) avec `href:null` pour masquer l'anglais. Source de bugs et code mort. À résoudre : **garder uniquement la version française**, supprimer les doublons anglais.
7. **Dépendance `ethers` (~500 KB)** utilisée uniquement par `src/services/blockchain.ts`. La feature blockchain n'est pas branchée dans le parcours. À supprimer sauf décision produit contraire.

## Conventions

### Langue
- **UI en français** exclusivement. Labels, messages, erreurs, boutons.
- **Code/commentaires** : anglais acceptable, mais les strings user-facing restent en français.
- Fichiers de route : **français** (`nettoyage.tsx` et pas `cleaning.tsx`).

### Imports
- Chemins relatifs (`../../src/components/ui/Text`). Pas d'alias path configurés.

### Styles
- `StyleSheet.create` en bas de chaque composant. Pas de styled-components, pas de tailwind.
- Couleurs centralisées : `src/constants/colors.ts` (`Colors.primary` = `#2D6A4F`, `Colors.danger`, etc.)
- Icons : `lucide-react-native`.

### Données
- Tous les mutateurs SQLite passent par un `store` zustand. Pas d'appel direct à `getDatabase()` depuis l'UI.
- Le schéma SQLite doit rester **aligné** avec `supabase/migrations/001_initial_schema.sql`. Toute modif de colonne → les deux côtés.
- IDs : UUID v4 côté Supabase, `Crypto.randomUUID()` côté SQLite. Jamais d'auto-increment.

### OCR
- Tout appel OCR doit passer par `src/services/ocr.ts` qui catch les erreurs et retourne `null` en cas d'échec. **Ne jamais laisser l'OCR crasher la capture.**

### Tests
- Unit tests sous `*.test.ts` à côté du fichier testé.
- Mock `expo-sqlite` et `expo-crypto` dans `jest.setup.js`.
- Pas de tests e2e pour l'instant (à envisager avec Detox plus tard).

## Do / Don't

**Do**
- Lance `npm test` avant tout commit.
- Lance `npx tsc --noEmit` pour typecheck avant commit.
- Quand tu ajoutes une colonne en base, modifie **à la fois** `supabase/migrations/` **et** `src/services/database.ts` (schéma SQLite).
- Tout nouveau composant UI dans `src/components/ui/` avec des props typées.
- Garde les stores zustand fins : logique métier dans le store, pas dans le composant.

**Don't**
- **Ne supprime pas `src/services/demoData.ts`** — c'est la porte d'entrée démo / présentation commerciale, et le seed de la DB pour un test à froid.
- N'appelle pas Supabase directement depuis un composant : passe par le store qui cache la persistance locale ET la synchro.
- N'introduis pas de nouvelle dépendance sans justifier (bundle size RN compte).
- Ne commit jamais `.env.local` (déjà dans `.gitignore` — vérifie).
- N'utilise pas Expo Go pour tester l'OCR : il faut un dev build.

## Commandes utiles

```bash
# Setup
npm install
cp .env.local.example .env.local  # puis remplir

# Dev
npx expo start --dev-client        # serveur Metro pour dev build
npx expo start --web               # test rapide UI (modules natifs OFF)
npm test
npm test -- --watch
npx tsc --noEmit                   # typecheck sans build

# Build Android (EAS, cloud)
npm install -g eas-cli
eas login
eas build:configure                # première fois : génère eas.json
eas build --profile preview --platform android   # APK installable
eas build --profile production --platform android  # AAB pour Play Store

# Build Android (local, nécessite Android Studio + ANDROID_HOME)
npx expo prebuild --platform android --clean
npx expo run:android --variant release

# Supabase
# Dans le dashboard supabase.com, SQL Editor → coller supabase/migrations/001_initial_schema.sql
```

## Points de contact (humain)

- **Philippe** (propriétaire produit, utilisateur beta n°1) — captainpglg@gmail.com
- Restaurateur pilote : à définir

## Rapports d'audit précédents

Fresh-Core est un projet **indépendant** : il ne partage **ni code, ni base de données, ni authentification** avec les autres projets du propriétaire (art-core, pass-core). Ne jamais importer ou référencer du code de ces projets.

Si des rapports d'audit fresh-core sont archivés dans `~/Desktop/Archives/Rapports-2026/`, ils sont identifiables par leur titre. Ignorer les rapports ART-CORE ou Core-Ecosystem — ils concernent d'autres projets.
