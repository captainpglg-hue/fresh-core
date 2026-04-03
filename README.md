# Fresh-Core

Application mobile HACCP pour restaurateurs. Remplace les fiches papier par un protocole photo guide de 30 secondes.

## Installation

```bash
npm install
cp .env.local.example .env.local  # Remplir les cles Supabase
npx expo start
```

## Stack

React Native (Expo) + TypeScript + Supabase + SQLite offline-first

## Modules HACCP

1. Temperatures (OCR thermometre)
2. Receptions marchandises
3. Nettoyage (checklist)
4. Cuisson (sonde + refroidissement)
5. Tracabilite DLC
6. Huiles (test TPM)
7. Nuisibles (controle + interventions)

## Tests

```bash
npm test
```
