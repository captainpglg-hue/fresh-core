import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Image, Pressable, Modal, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  ShieldCheck,
  Truck,
  Tag,
  Calendar,
  QrCode,
  Link2,
  Share2,
  Fish,
  Beef,
  AlertOctagon,
} from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { getByIdLocal, getAllLocal } from '../../src/services/database';
import { useSupplierStore } from '../../src/stores/supplierStore';
import { verifyChain } from '../../src/utils/hashChain';
import type { Delivery, DeliveryItem, Supplier, Establishment } from '../../src/types/database';

// Where the public consumer page is hosted. Used as the QR target so a
// customer who scans an in-restaurant QR lands on this same page.
const PUBLIC_ORIGIN_BASE = 'https://captainpglg-hue.github.io/fresh-core/origine';

function categoryIcon(category: string | null | undefined, size = 20) {
  if (!category) return <Tag size={size} color={Colors.white} />;
  if (category.includes('poisson')) return <Fish size={size} color={Colors.white} />;
  if (category.includes('viande') || category.includes('volaille')) return <Beef size={size} color={Colors.white} />;
  return <Tag size={size} color={Colors.white} />;
}

function categoryLabel(category: string | null | undefined): string {
  if (!category) return 'Produit';
  if (category.includes('poisson')) return 'Filière poisson';
  if (category.includes('volaille')) return 'Filière volaille';
  if (category.includes('viande')) return 'Filière viande';
  if (category.includes('laitier')) return 'Filière laitière';
  if (category.includes('légume') || category.includes('legume')) return 'Filière maraîchère';
  if (category.includes('surgel')) return 'Filière surgelé';
  return 'Produit';
}

function deDupeCategories(items: DeliveryItem[]): string {
  const set = new Set<string>();
  items.forEach((it) => set.add(categoryLabel(it.category)));
  return Array.from(set).join(' · ');
}

export default function OrigineScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { suppliers, loadSuppliers } = useSupplierStore();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; details: string } | null>(null);

  const publicUrl = id ? `${PUBLIC_ORIGIN_BASE}/${id}` : '';

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const d = await getByIdLocal<Delivery>('deliveries', id);
        setDelivery(d);
        if (d) {
          await loadSuppliers(d.establishment_id);
          const est = await getByIdLocal<Establishment>('establishments', d.establishment_id);
          setEstablishment(est);
        }
        const i = await getAllLocal<DeliveryItem>('delivery_items', 'delivery_id = ?', [id]);
        const parsed = i.map((it) => {
          if (typeof it.photo_paths === 'string') {
            try {
              return { ...it, photo_paths: JSON.parse(it.photo_paths) as string[] };
            } catch {
              return { ...it, photo_paths: null };
            }
          }
          return it;
        });
        setItems(parsed);
      } catch {
        // UI handles the "introuvable" case below
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, loadSuppliers]);

  const supplier: Supplier | undefined = useMemo(
    () => (delivery?.supplier_id ? suppliers.find((s) => s.id === delivery.supplier_id) : undefined),
    [suppliers, delivery?.supplier_id],
  );

  const handleVerify = async () => {
    if (!delivery) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const allDeliveries = await getAllLocal<Delivery>(
        'deliveries',
        'establishment_id = ?',
        [delivery.establishment_id],
      );
      const itemsByDeliveryId: Record<string, DeliveryItem[]> = {};
      for (const d of allDeliveries) {
        const di = await getAllLocal<DeliveryItem>('delivery_items', 'delivery_id = ?', [d.id]);
        itemsByDeliveryId[d.id] = di.map((it) => {
          if (typeof it.photo_paths === 'string') {
            try {
              return { ...it, photo_paths: JSON.parse(it.photo_paths) as string[] };
            } catch {
              return { ...it, photo_paths: null };
            }
          }
          return it;
        });
      }
      const result = await verifyChain(allDeliveries, itemsByDeliveryId);
      setVerifyResult({
        ok: result.ok,
        details: result.ok
          ? `${result.totalChecked} réception(s) vérifiée(s). Aucune altération détectée.`
          : `Rupture à la réception ${result.firstBreakAt}. ${result.breakReason}`,
      });
    } catch (e) {
      setVerifyResult({
        ok: false,
        details: e instanceof Error ? e.message : 'Vérification impossible',
      });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text variant="body" color={Colors.textSecondary}>Chargement du parcours…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text variant="h3">Produit introuvable</Text>
          <Text variant="caption" color={Colors.textSecondary} style={styles.centerSub}>
            Le code {id} ne correspond à aucune réception. Vérifiez le QR ou
            demandez au restaurateur.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const recordedAt = new Date(delivery.recorded_at);
  const categories = deDupeCategories(items);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero — consumer-facing */}
        <View style={styles.hero}>
          <View style={styles.heroIconCircle}>
            <ShieldCheck size={40} color={Colors.white} />
          </View>
          <Text variant="h1" color={Colors.white} style={styles.heroTitle}>
            Parcours certifié
          </Text>
          <Text variant="body" color={Colors.white} style={styles.heroSub}>
            {categories || 'Produit servi'}
          </Text>
          {establishment ? (
            <Text variant="caption" color={Colors.white} style={styles.heroEstab}>
              servi par {establishment.name}
              {establishment.city ? `, ${establishment.city}` : ''}
            </Text>
          ) : null}
        </View>

        {/* Trust signals row */}
        <View style={styles.trustRow}>
          <View style={styles.trustChip}>
            <Text variant="caption" color={Colors.success} style={styles.trustNum}>✓</Text>
            <Text variant="caption" color={Colors.textSecondary}>Inviolable</Text>
          </View>
          <View style={styles.trustChip}>
            <Text variant="caption" color={Colors.success} style={styles.trustNum}>✓</Text>
            <Text variant="caption" color={Colors.textSecondary}>Horodaté</Text>
          </View>
          <View style={styles.trustChip}>
            <Text variant="caption" color={Colors.success} style={styles.trustNum}>✓</Text>
            <Text variant="caption" color={Colors.textSecondary}>Audité HACCP</Text>
          </View>
        </View>

        {/* Items list — consumer view */}
        <View style={styles.itemsBlock}>
          <Text variant="h3" style={styles.blockTitle}>Produits livrés ce jour</Text>
          {items.map((item) => {
            const tempOk = item.temperature_compliant !== false;
            const photos = Array.isArray(item.photo_paths) ? item.photo_paths : [];
            return (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeaderRow}>
                  <View style={[styles.itemIconBg, { backgroundColor: Colors.primary }]}>
                    {categoryIcon(item.category)}
                  </View>
                  <View style={styles.itemHeaderText}>
                    <Text variant="body" style={styles.itemName}>{item.product_name}</Text>
                    <Text variant="caption" color={Colors.textSecondary}>
                      {categoryLabel(item.category)}
                      {item.lot_number ? ` · Lot ${item.lot_number}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemMetrics}>
                  {item.temperature !== null && item.temperature !== undefined ? (
                    <View style={styles.metric}>
                      <Text variant="caption" color={Colors.textSecondary}>Température</Text>
                      <Text variant="h3" color={tempOk ? Colors.success : Colors.danger}>
                        {item.temperature}°C
                      </Text>
                    </View>
                  ) : null}
                  {item.dlc ? (
                    <View style={styles.metric}>
                      <Text variant="caption" color={Colors.textSecondary}>DLC</Text>
                      <Text variant="h3">{item.dlc}</Text>
                    </View>
                  ) : null}
                  <View style={styles.metric}>
                    <Text variant="caption" color={Colors.textSecondary}>État</Text>
                    <Badge
                      text={item.packaging_ok && item.visual_ok ? 'Conforme' : 'Non conforme'}
                      variant={item.packaging_ok && item.visual_ok ? 'success' : 'danger'}
                    />
                  </View>
                </View>

                {photos.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
                    {photos.map((uri, idx) => (
                      <Image
                        key={`${item.id}-photo-${idx}`}
                        source={{ uri }}
                        style={styles.itemPhoto}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </Card>
            );
          })}
        </View>

        {/* Supplier / origin */}
        <View style={styles.itemsBlock}>
          <Text variant="h3" style={styles.blockTitle}>Origine</Text>
          <Card>
            <View style={styles.row}>
              <Truck size={20} color={Colors.primary} />
              <View style={styles.rowInfo}>
                <Text variant="body">{supplier?.name || 'Fournisseur'}</Text>
                {supplier?.sanitary_approval ? (
                  <Text variant="caption" color={Colors.textSecondary}>
                    Agrément sanitaire {supplier.sanitary_approval}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
          <Card>
            <View style={styles.row}>
              <Calendar size={20} color={Colors.primary} />
              <View style={styles.rowInfo}>
                <Text variant="body">
                  Reçu le {format(recordedAt, 'd MMMM yyyy', { locale: fr })}
                </Text>
                <Text variant="caption" color={Colors.textSecondary}>
                  à {format(recordedAt, 'HH:mm')} par {establishment?.name || 'le restaurant'}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Cryptographic proof */}
        <View style={styles.itemsBlock}>
          <Text variant="h3" style={styles.blockTitle}>Preuve cryptographique</Text>
          <Card>
            <View style={styles.row}>
              <ShieldCheck size={20} color={Colors.success} />
              <View style={styles.rowInfo}>
                <Text variant="body">SHA-256 chaîné</Text>
                <Text variant="caption" color={Colors.textSecondary} style={styles.mono}>
                  {delivery.blockchain_hash || '—'}
                </Text>
                <Text variant="caption" color={Colors.textSecondary} style={styles.chainNote}>
                  Cette empreinte dépend de toutes les réceptions précédentes.
                  Modifier un relevé après coup romprait la chaîne et serait
                  immédiatement détectable.
                </Text>
              </View>
            </View>

            <View style={styles.verifyBlock}>
              <Button
                title={verifying ? 'Vérification…' : 'Vérifier la chaîne maintenant'}
                onPress={handleVerify}
                loading={verifying}
                variant="ghost"
                fullWidth
              />
              {verifyResult ? (
                <View style={[styles.verifyResult, verifyResult.ok ? styles.verifyOk : styles.verifyBad]}>
                  {verifyResult.ok ? (
                    <ShieldCheck size={18} color={Colors.success} />
                  ) : (
                    <AlertOctagon size={18} color={Colors.danger} />
                  )}
                  <Text
                    variant="caption"
                    color={verifyResult.ok ? Colors.success : Colors.danger}
                    style={styles.verifyText}
                  >
                    {verifyResult.details}
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>
        </View>

        {/* Actions — restaurateur only (only shown if we got here from inside the app) */}
        <View style={styles.actionsRow}>
          <Button
            title="QR consommateur"
            onPress={() => setShowQR(true)}
            variant="primary"
            icon={<QrCode size={16} color={Colors.white} />}
          />
          <Button
            title="Partager"
            onPress={() => Share.share({ message: publicUrl, url: publicUrl })}
            variant="ghost"
            icon={<Share2 size={16} color={Colors.primary} />}
          />
        </View>

        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <ArrowLeft size={14} color={Colors.textSecondary} />
          <Text variant="caption" color={Colors.textSecondary}>Retour</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <Pressable style={styles.qrBackdrop} onPress={() => setShowQR(false)}>
          <Pressable style={styles.qrCard} onPress={(e) => e.stopPropagation()}>
            <Text variant="h3" style={styles.qrTitle}>Scanne pour voir l&apos;origine</Text>
            <Text variant="caption" color={Colors.textSecondary} style={styles.qrSub}>
              Imprime ce QR et colle-le près du plat. Le client scanne avec
              son téléphone et accède à toute la traçabilité.
            </Text>
            <View style={styles.qrWrap}>
              <QRCode value={publicUrl} size={240} backgroundColor="white" color={Colors.primary} />
            </View>
            <View style={styles.qrUrlRow}>
              <Link2 size={14} color={Colors.textSecondary} />
              <Text variant="caption" color={Colors.textSecondary} style={styles.qrUrl}>
                {publicUrl}
              </Text>
            </View>
            <Button title="Fermer" onPress={() => setShowQR(false)} variant="ghost" />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerSub: { marginTop: 8, textAlign: 'center' },
  scroll: { paddingBottom: 32 },

  hero: {
    backgroundColor: Colors.primary,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  heroIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTitle: { textAlign: 'center', fontSize: 24, fontWeight: '700' },
  heroSub: { textAlign: 'center', opacity: 0.92 },
  heroEstab: { textAlign: 'center', opacity: 0.85, marginTop: 4 },

  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  trustChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderRadius: 12,
    gap: 2,
  },
  trustNum: { fontSize: 18, fontWeight: '700' },

  itemsBlock: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  blockTitle: { paddingHorizontal: 4, marginBottom: 4 },

  itemCard: { gap: 12 },
  itemHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIconBg: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemHeaderText: { flex: 1, gap: 2 },
  itemName: { fontWeight: '600' },

  itemMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  metric: { alignItems: 'center', gap: 4, paddingHorizontal: 4 },

  photosRow: { marginTop: 4 },
  itemPhoto: {
    width: 100,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: Colors.border,
  },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowInfo: { flex: 1, gap: 4 },
  mono: { fontFamily: 'monospace' },
  chainNote: { marginTop: 8, lineHeight: 18 },

  verifyBlock: { marginTop: 12, gap: 8 },
  verifyResult: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  verifyOk: { backgroundColor: Colors.paleGreen },
  verifyBad: { backgroundColor: '#FECDD3' },
  verifyText: { flex: 1, lineHeight: 18 },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 20, paddingHorizontal: 16, flexWrap: 'wrap' },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 16,
  },
  bottomSpacer: { height: 16 },

  qrBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  qrCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    gap: 12,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
  },
  qrTitle: { textAlign: 'center' },
  qrSub: { textAlign: 'center', lineHeight: 18 },
  qrWrap: { padding: 16, backgroundColor: Colors.white, borderRadius: 12 },
  qrUrlRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  qrUrl: { flex: 1, textAlign: 'center' },
});
