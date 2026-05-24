# Fresh-Core — Déploiement

## Trois modes d'utilisation

| Mode | Pour qui | Données | Ce qu'il faut |
|---|---|---|---|
| **Démo (web)** | Démo commerciale, rdv pilote | Locales (SQLite navigateur) | Rien (déjà actif) |
| **Démo (APK)** | Démo sur téléphone du restaurateur | Locales (SQLite Android) | EAS Build une fois |
| **Production** | Vrais utilisateurs, multi-appareil | Supabase + RLS | Supabase env vars + EAS Build |

---

## Mode démo web (déjà actif)

URL : **https://captainpglg-hue.github.io/fresh-core/**

- Marie Dupont auto-connectée
- 2 réceptions seedées (filière viande Metro + filière poisson Pomona)
- Chaîne de hash SHA-256 inscrite
- QR consommateur fonctionnel (pointe vers `/origine/<id>` sur cette même URL)

Aucune action requise — le workflow `deploy-pages.yml` reconstruit le site à chaque push.

---

## Mode démo APK

1. Sur GitHub : Settings → Secrets and variables → Actions → New repository secret
   - Nom : `EXPO_TOKEN`
   - Valeur : ton token Expo (à générer sur https://expo.dev/settings/access-tokens)
2. Actions → "EAS Build — preview APK" → Run workflow
3. ~25 min plus tard, lien APK reçu par email depuis expo.dev
4. Le lien ouvre une page avec un QR à scanner sur Android → installation directe
5. L'app fonctionne hors-ligne, données locales, Marie Dupont auto-connectée

**Pas besoin du secret Supabase** pour ce mode — le placeholder déclenche le mode démo automatiquement.

---

## Mode production (vrais utilisateurs)

### Backend Supabase

Le projet `fresh-core` a été provisionné le 19 mai 2026 dans l'org **Art-Core Solutions** :

- **URL** : `https://hqsyygywfhtsbtgdtzds.supabase.co`
- **Anon key** (publique, scopée par RLS) : `sb_publishable_dv4pBDtXdSNdwRpDT_nFoA_c4RfR8aH`
- **Région** : eu-west-3 (Paris)
- **Migrations appliquées** :
  - `001_initial_schema` — 13 tables + RLS activé
  - `002_rls_policies` — policies owner-scoped (profiles, equipment, deliveries, …)
  - `003_auto_confirm_users` — trigger qui auto-confirme l'email à l'inscription (skip email round-trip)
  - `004_lock_autoconfirm_function` — durcissement (revoke execute)

### Compte démo Supabase

Pour montrer le mode "réel" sans inscription :

- **Email** : `demo@fresh-core.io`
- **Password** : `DemoFreshCore2026!`

Ce compte voit déjà les 2 livraisons viande/poisson seedées en base, donc l'expérience est la même qu'en mode démo local mais persiste vraiment.

### Activer le mode production sur les builds

Sur GitHub : Settings → Secrets and variables → Actions → ajouter 2 secrets :

```
EXPO_PUBLIC_SUPABASE_URL=https://hqsyygywfhtsbtgdtzds.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dv4pBDtXdSNdwRpDT_nFoA_c4RfR8aH
```

Une fois les secrets posés :

- **Push sur master ou claude/** → le workflow `deploy-pages.yml` rebuild Pages en mode production. Plus de Marie Dupont auto-connectée, login requis, mais le compte démo ci-dessus fonctionne.
- **Run du workflow EAS** → APK en mode production avec les mêmes credentials.

Pour repasser en mode démo : supprimer ces 2 secrets, re-trigger les workflows.

---

## Dev local

```bash
git clone https://github.com/captainpglg-hue/fresh-core.git
cd fresh-core
npm install

# Demo local (Marie Dupont, SQLite navigateur)
npm run web

# Production local — nécessite .env.local
cp .env.local.example .env.local
# .env.local contient déjà les credentials fresh-core par défaut
npm run web
```

Le pre-commit hook `.githooks/pre-commit` refuse tout fichier contenant des null-bytes (corruption CRLF observée sur Windows). Activer une fois :

```bash
git config core.hooksPath .githooks
```

---

## Limites connues du mode démo

- Pas de sync entre appareils (chaque navigateur a sa propre SQLite locale)
- Vider le cache navigateur efface toutes les données saisies
- OCR thermomètre désactivé sur web (ML Kit natif uniquement, présent sur l'APK)

Ces 3 limites disparaissent en mode production.
