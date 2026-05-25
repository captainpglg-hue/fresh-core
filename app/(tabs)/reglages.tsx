import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from '../../src/services/secureStorage';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { IconButton } from '../../src/components/ui/IconButton';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { isDemoMode } from '../../src/services/supabase';
import { useSyncStore } from '../../src/stores/syncStore';
import { syncManager } from '../../src/services/sync';
import { updateLocal, getAllLocal } from '../../src/services/database';
import { verifyChain } from '../../src/utils/hashChain';
import type { Delivery, DeliveryItem } from '../../src/types/database';
import { ArrowLeft, User, Building2, Wifi, WifiOff, FileText, Info, LogOut, ChevronRight, Pencil, X, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react-native';

const NOTIF_PREF_KEYS = {
  temp: 'fc.notif.temp',
  dlc: 'fc.notif.dlc',
  cleaning: 'fc.notif.cleaning',
  pest: 'fc.notif.pest',
} as const;

async function loadPref(key: string): Promise<boolean> {
  const v = await SecureStore.getItemAsync(key);
  return v === null ? true : v === '1';
}

async function savePref(key: string, value: boolean) {
  await SecureStore.setItemAsync(key, value ? '1' : '0');
}

export default function ReglagesScreen() {
  const router = useRouter();
  const { user, establishment, signOut, setEstablishment } = useAuthStore();
  const { isOnline, pendingCount, lastSyncAt, isSyncing } = useSyncStore();

  const [showEditEstab, setShowEditEstab] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPostal, setEditPostal] = useState('');
  const [savingEstab, setSavingEstab] = useState(false);

  const [notifTemp, setNotifTemp] = useState(true);
  const [notifDlc, setNotifDlc] = useState(true);
  const [notifCleaning, setNotifCleaning] = useState(true);
  const [notifPest, setNotifPest] = useState(true);

  // Chain verification UI state — null = jamais lancé.
  const [verifying, setVerifying] = useState(false);
  const [verifResult, setVerifResult] = useState<
    | null
    | { ok: true; total: number }
    | { ok: false; total: number; firstBreakAt: string | null; reason: string | null }
  >(null);

  // Compteur d'items "failed" (terminaux après épuisement du backoff).
  // Sans cette UI ils restent invisibles à l'utilisateur sauf inspection
  // SQLite. Rechargé après chaque sync forcée ou requeue manuel.
  const [failedCount, setFailedCount] = useState(0);
  const [requeuing, setRequeuing] = useState(false);

  const refreshFailedCount = async () => {
    try {
      const stats = await syncManager.getStats();
      setFailedCount(stats.failed);
    } catch {
      // Stats sont une lecture pure, mais en cas de panne SQLite on
      // ne veut pas faire crasher Réglages.
      setFailedCount(0);
    }
  };

  useEffect(() => {
    void refreshFailedCount();
  }, [pendingCount, isSyncing]);

  // Load persisted toggle states (SecureStore) on mount.
  useEffect(() => {
    (async () => {
      const [t, d, c, p] = await Promise.all([
        loadPref(NOTIF_PREF_KEYS.temp),
        loadPref(NOTIF_PREF_KEYS.dlc),
        loadPref(NOTIF_PREF_KEYS.cleaning),
        loadPref(NOTIF_PREF_KEYS.pest),
      ]);
      setNotifTemp(t);
      setNotifDlc(d);
      setNotifCleaning(c);
      setNotifPest(p);
    })();
  }, []);

  const toggleAndPersist =
    (key: string, setter: (v: boolean) => void) => (value: boolean) => {
      setter(value);
      void savePref(key, value);
    };

  const handleSignOut = () => {
    if (isDemoMode) {
      Alert.alert(
        'Mode démo',
        'Mode démo — recharger un état neuf pour Marie Dupont ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Réinitialiser la démo',
            style: 'destructive',
            onPress: () => signOut(),
          },
        ],
      );
      return;
    }
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleForceSync = async () => {
    await syncManager.startSync();
    void refreshFailedCount();
  };

  /**
   * Bouton "Réessayer maintenant" : remet à 'pending' les items
   * de sync_queue qui ont épuisé leur backoff (status='failed').
   * Sans cette UI, requeueFailed() existait dans syncManager mais
   * n'était jamais appelé — les items restaient bloqués à vie.
   */
  const handleRequeueFailed = async () => {
    setRequeuing(true);
    try {
      const n = await syncManager.requeueFailed();
      await refreshFailedCount();
      Alert.alert('Sync', `${n} élément(s) remis en attente.`);
    } catch (e) {
      Alert.alert(
        'Réessai impossible',
        e instanceof Error ? e.message : 'Erreur inconnue',
      );
    } finally {
      setRequeuing(false);
    }
  };

  /**
   * Bouton "Vérifier l'intégrité du journal" : recalcule SHA-256 sur la
   * totalité des réceptions chaînées de l'établissement et compare au
   * blockchain_hash persisté. C'est la matérialisation visible de la
   * promesse "tamper-evident" du produit — sans ce bouton, le code
   * existait mais l'utilisateur n'en voyait jamais le bénéfice.
   */
  const handleVerifyChain = async () => {
    if (!establishment?.id) return;
    setVerifying(true);
    setVerifResult(null);
    try {
      const deliveries = await getAllLocal<Delivery>(
        'deliveries',
        'establishment_id = ?',
        [establishment.id],
      );
      // On charge les items de toutes les livraisons pour pouvoir rejouer
      // le payload (même structure que stocké lors de la création).
      const allItems = await getAllLocal<DeliveryItem & { delivery_id: string }>(
        'delivery_items',
      );
      const itemsByDeliveryId: Record<string, DeliveryItem[]> = {};
      for (const it of allItems) {
        const key = it.delivery_id;
        if (!itemsByDeliveryId[key]) itemsByDeliveryId[key] = [];
        itemsByDeliveryId[key].push(it);
      }
      const verifInput = deliveries.map((d) => ({
        id: d.id,
        supplier_id: d.supplier_id,
        establishment_id: d.establishment_id,
        delivery_date: d.delivery_date,
        recorded_at: d.recorded_at,
        status: d.status,
        refusal_reason: d.refusal_reason,
        blockchain_hash: d.blockchain_hash,
      }));
      const itemInput: Record<string, {
        product_name: string | null;
        category: string | null;
        temperature: number | null;
        dlc: string | null;
        lot_number: string | null;
        photo_paths: string[] | null;
      }[]> = {};
      for (const [did, items] of Object.entries(itemsByDeliveryId)) {
        itemInput[did] = items.map((it) => ({
          product_name: it.product_name,
          category: it.category,
          temperature: it.temperature,
          dlc: it.dlc,
          lot_number: it.lot_number,
          photo_paths: it.photo_paths
            ? (typeof it.photo_paths === 'string'
                ? (JSON.parse(it.photo_paths) as string[])
                : it.photo_paths)
            : null,
        }));
      }
      const result = await verifyChain(verifInput, itemInput);
      if (result.ok) {
        setVerifResult({ ok: true, total: result.totalChecked });
      } else {
        setVerifResult({
          ok: false,
          total: result.totalChecked,
          firstBreakAt: result.firstBreakAt,
          reason: result.breakReason,
        });
      }
    } catch (e) {
      Alert.alert(
        'Vérification impossible',
        e instanceof Error ? e.message : 'Erreur inconnue',
      );
    } finally {
      setVerifying(false);
    }
  };

  const openEditEstab = () => {
    if (!establishment) return;
    setEditName(establishment.name);
    setEditCity(establishment.city ?? '');
    setEditAddress(establishment.address ?? '');
    setEditPostal(establishment.postal_code ?? '');
    setShowEditEstab(true);
  };

  const saveEstab = async () => {
    if (!establishment || !editName.trim()) return;
    setSavingEstab(true);
    try {
      const updated = {
        ...establishment,
        name: editName.trim(),
        city: editCity.trim() || null,
        address: editAddress.trim() || null,
        postal_code: editPostal.trim() || null,
      };
      await updateLocal('establishments', establishment.id, {
        name: updated.name,
        city: updated.city,
        address: updated.address,
        postal_code: updated.postal_code,
      });
      setEstablishment(updated);
      setShowEditEstab(false);
    } catch (e) {
      Alert.alert('Impossible de sauvegarder', e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSavingEstab(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Réglages</Text>
        <View style={styles.placeholder} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="h3" style={styles.sectionTitle}>Mon profil</Text>
        <Card>
          <View style={styles.row}>
            <User size={20} color={Colors.primary} />
            <View style={styles.rowInfo}>
              <Text variant="body">{user?.full_name || 'Non connecté'}</Text>
              <Text variant="caption" color={Colors.textSecondary}>{user?.email || ''}</Text>
            </View>
          </View>
        </Card>

        <Text variant="h3" style={styles.sectionTitle}>Mon établissement</Text>
        <Pressable onPress={openEditEstab}><Card>
          <View style={styles.row}>
            <Building2 size={20} color={Colors.primary} />
            <View style={styles.rowInfo}>
              <Text variant="body">{establishment?.name || 'Non configuré'}</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                {establishment?.establishment_type || ''} {establishment?.city ? `— ${establishment.city}` : ''}
              </Text>
              {establishment?.siret && (
                <Text variant="caption" color={Colors.textSecondary}>SIRET: {establishment.siret}</Text>
              )}
            </View>
            <Pencil size={16} color={Colors.textSecondary} />
          </View>
        </Card></Pressable>

        <Text variant="h3" style={styles.sectionTitle}>Synchronisation</Text>
        <Card>
          <View style={styles.row}>
            {isOnline ? <Wifi size={20} color={Colors.success} /> : <WifiOff size={20} color={Colors.warning} />}
            <View style={styles.rowInfo}>
              <Text variant="body">{isOnline ? 'En ligne' : 'Hors-ligne'}</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                {pendingCount > 0 ? `${pendingCount} élément(s) en attente` : 'Tout est synchronisé'}
              </Text>
              {lastSyncAt && (
                <Text variant="caption" color={Colors.textSecondary}>
                  Dernière sync: {new Date(lastSyncAt).toLocaleString('fr-FR')}
                </Text>
              )}
            </View>
          </View>
          <Button
            title={isSyncing ? 'Synchronisation...' : 'Forcer la synchronisation'}
            onPress={handleForceSync}
            variant="ghost"
            loading={isSyncing}
            size="sm"
          />
        </Card>

        {failedCount > 0 && (
          <Card>
            <View style={styles.row}>
              <AlertTriangle size={20} color={Colors.danger} />
              <View style={styles.rowInfo}>
                <Text variant="body">
                  {failedCount} élément(s) en échec définitif
                </Text>
                <Text variant="caption" color={Colors.textSecondary}>
                  Backoff épuisé. Réessayez après avoir corrigé le problème
                  (connectivité, identifiants…).
                </Text>
              </View>
            </View>
            <Button
              title={requeuing ? 'Réessai...' : 'Réessayer maintenant'}
              onPress={handleRequeueFailed}
              variant="ghost"
              loading={requeuing}
              size="sm"
            />
          </Card>
        )}

        <Text variant="h3" style={styles.sectionTitle}>Intégrité du journal</Text>
        <Card>
          <View style={styles.row}>
            {verifResult?.ok === false ? (
              <ShieldAlert size={20} color={Colors.danger} />
            ) : (
              <ShieldCheck size={20} color={verifResult?.ok ? Colors.success : Colors.primary} />
            )}
            <View style={styles.rowInfo}>
              <Text variant="body">Chaîne de hash des réceptions</Text>
              {verifResult === null && (
                <Text variant="caption" color={Colors.textSecondary}>
                  Recalcule SHA-256 sur chaque réception et compare au hash stocké.
                </Text>
              )}
              {verifResult?.ok === true && (
                <Text variant="caption" color={Colors.success}>
                  {verifResult.total} réception(s) vérifiée(s), chaîne intègre.
                </Text>
              )}
              {verifResult?.ok === false && (
                <>
                  <Text variant="caption" color={Colors.danger}>
                    Rupture détectée à la réception {verifResult.firstBreakAt ?? '?'}.
                  </Text>
                  {verifResult.reason && (
                    <Text variant="caption" color={Colors.textSecondary}>{verifResult.reason}</Text>
                  )}
                </>
              )}
            </View>
          </View>
          <Button
            title={verifying ? 'Vérification...' : 'Vérifier maintenant'}
            onPress={handleVerifyChain}
            variant="ghost"
            loading={verifying}
            size="sm"
          />
        </Card>

        <Text variant="h3" style={styles.sectionTitle}>Rapport DDPP</Text>
        <Pressable onPress={() => router.push('/rapport/ddpp')}>
          <Card>
            <View style={styles.row}>
              <FileText size={20} color={Colors.primary} />
              <View style={styles.rowInfo}>
                <Text variant="body">Générer un rapport</Text>
                <Text variant="caption" color={Colors.textSecondary}>Export PDF pour la DDPP</Text>
              </View>
              <ChevronRight size={16} color={Colors.textSecondary} />
            </View>
          </Card>
        </Pressable>

        <Text variant="h3" style={styles.sectionTitle}>Notifications</Text>
        <Card style={styles.notifCard}>
          <View style={styles.notifRow}>
            <Text variant="body">Alertes température</Text>
            <Switch value={notifTemp} onValueChange={toggleAndPersist(NOTIF_PREF_KEYS.temp, setNotifTemp)} trackColor={{ true: Colors.primary }} />
          </View>
          <View style={styles.notifRow}>
            <Text variant="body">Alertes DLC</Text>
            <Switch value={notifDlc} onValueChange={toggleAndPersist(NOTIF_PREF_KEYS.dlc, setNotifDlc)} trackColor={{ true: Colors.primary }} />
          </View>
          <View style={styles.notifRow}>
            <Text variant="body">Rappels nettoyage</Text>
            <Switch value={notifCleaning} onValueChange={toggleAndPersist(NOTIF_PREF_KEYS.cleaning, setNotifCleaning)} trackColor={{ true: Colors.primary }} />
          </View>
          <View style={styles.notifRow}>
            <Text variant="body">Rappels nuisibles</Text>
            <Switch value={notifPest} onValueChange={toggleAndPersist(NOTIF_PREF_KEYS.pest, setNotifPest)} trackColor={{ true: Colors.primary }} />
          </View>
        </Card>

        <Text variant="h3" style={styles.sectionTitle}>À propos</Text>
        <Card>
          <View style={styles.row}>
            <Info size={20} color={Colors.primary} />
            <View style={styles.rowInfo}>
              <Text variant="body">Fresh-Core</Text>
              <Text variant="caption" color={Colors.textSecondary}>Version 1.0.0</Text>
              <Text variant="caption" color={Colors.textSecondary}>par pass-core.io</Text>
            </View>
          </View>
        </Card>

        <Button title="Déconnexion" onPress={handleSignOut} variant="danger" icon={<LogOut size={16} color={Colors.white} />} />
      </ScrollView>

      <Modal
        visible={showEditEstab}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditEstab(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="h2">Modifier l&apos;établissement</Text>
              <IconButton
                icon={<X size={22} color={Colors.textSecondary} />}
                onPress={() => setShowEditEstab(false)}
              />
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              <Input
                label="Nom de l'établissement"
                value={editName}
                onChangeText={setEditName}
                placeholder="Ex: Le Provençal"
              />
              <Input
                label="Adresse"
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="12 rue de la Paix"
              />
              <Input
                label="Code postal"
                value={editPostal}
                onChangeText={setEditPostal}
                placeholder="75002"
                keyboardType="numeric"
              />
              <Input
                label="Ville"
                value={editCity}
                onChangeText={setEditCity}
                placeholder="Paris"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button title="Annuler" variant="ghost" onPress={() => setShowEditEstab(false)} />
              <Button
                title="Enregistrer"
                variant="primary"
                onPress={saveEstab}
                loading={savingEstab}
                disabled={!editName.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DEE2E6',
    backgroundColor: Colors.white,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  placeholder: { width: 44 },
  scroll: { padding: 16, paddingBottom: 40, gap: 4 },
  sectionTitle: { marginTop: 20, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowInfo: { flex: 1, gap: 2 },
  notifCard: { gap: 4 },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#DEE2E6' },
  modalBody: { padding: 20 },
  modalBodyContent: { gap: 12 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: '#DEE2E6' },
});
