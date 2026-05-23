# Fresh-Core — Smart contracts

## FreshCoreAnchor.sol

Registre on-chain de Merkle roots qui ancrent les chaînes d'événements de
lots Fresh-Core. Une seule fonction d'écriture (`anchorRoot`, owner-only),
plusieurs vues. Coût d'ancrage typique : ~50 000 gas (~0.005 MATIC à 30
gwei sur Polygon PoS).

### Déploiement (Polygon Amoy testnet)

1. **Récupérer des MATIC testnet** sur https://faucet.polygon.technology (réseau Amoy).
2. **Déployer le contrat** depuis Remix (https://remix.ethereum.org) :
   - Charger `FreshCoreAnchor.sol`
   - Compiler avec Solidity 0.8.20+
   - Déployer via "Injected Provider — MetaMask" sur le réseau Polygon Amoy
   - Noter l'adresse du contrat
3. **Configurer le batcher** (variables d'environnement) :
   ```bash
   export FRESHCORE_ANCHOR_RPC_URL="https://rpc-amoy.polygon.technology"
   export FRESHCORE_ANCHOR_CONTRACT="0x..."   # adresse du contrat
   export FRESHCORE_ANCHOR_PRIVATE_KEY="0x..." # clé privée du batcher
   ```
4. **Tester en dry-run** :
   ```bash
   npm run anchor -- --dry-run
   ```
5. **Lancer en réel** :
   ```bash
   npm run anchor
   ```
6. **Cron** : programmer toutes les 15 min via cron / systemd / GitHub Actions.

### Vérification d'inclusion

La page publique `/origine/<lot_code>` expose, pour chaque lot ancré :
- `anchor_tx_hash` : la transaction Polygon
- `head_hash` : le hash de tête de la chaîne du lot
- (optionnel) un **Merkle proof** servi par `proofForLot()` qui permet de
  recomputer le root et le comparer à celui retourné par
  `FreshCoreAnchor.getRoot(batchId)`.

La vérification d'inclusion est volontairement off-chain (le contrat ne
fait que stocker le root) : ça garde le coût de gas constant quelle que
soit la taille du batch, et la vérification reste auditable par n'importe
quel tiers via les données publiques + le code open-source.

### Production (Polygon PoS mainnet)

Identique à Amoy mais :
- RPC : `https://polygon-rpc.com` (ou Alchemy/Infura premium)
- Faucet : acheter des MATIC sur exchange
- Provisionner ~50 MATIC sur le batcher pour 12 mois (à 50k gas / batch,
  4 batchs / heure → 17.5 MATIC / an environ, marge confortable)
