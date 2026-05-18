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
} from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { getByIdLocal, getAllLocal } from '../../src/services/database';
import { useSupplierStore } from '../../src/stores/supplierStore';
import { shortHash } from '../../src/utils/hashChain';
import type { Delivery, DeliveryItem, Supplier } from '../../src/types/database';

// Where the public consumer page is hosted. Same Pages deploy + a
// fresh-core/origine/<id> deep link (single-output Expo web bundle
// catches all routes client-side once index.html is served).
const PUBLIC_ORIGIN_BASE = 'https://captainpglg-hue.github.io/fresh-core/origine';

function categoryIcon(category: string | null | undefined) {
  if (!category) return <Tag size={16} color={Colors.primary} />;
  if (category.includes('poisson')) return <Fish size={16} color={Colors.primary} />;
  if (category.includes('viande') || category.includes('volaille')) return <Beef size={16} color={Colors.primary} />;
  return <Tag size={16} color={Colors.primary} />;
}

export default function OrigineScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { suppliers, loadSuppliers } = useSupplierStore();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  const publicUrl = id ? `${PUBLIC_ORIGIN_BASE}/${id}` : '';

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const d = await getByIdLocal<Delivery>('deliveries', id);
        setDelivery(d);
        if (d) {
          await loadSuppliers(d.establishment_id);
        }
        const i = await getAllLocal<DeliveryItem>('delivery_items', 'delivery_id = ?', [id]);
        setItems(i);
      } catch {
        // ignore — UI shows "introuvable" below
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Origine produit</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.center}>
          <Text variant="body" color={Colors.textSecondary}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Origine produit</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.center}>
          <Text variant="h3">Réception introuvable</Text>
          <Text variant="caption" color={Colors.textSecondary} style={styles.centerSub}>
            L&apos;identifiant {id} n&apos;existe pas dans le journal local.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const recordedAt = new Date(delivery.recorded_at);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Origine produit</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero / trust badge */}
        <Card style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <ShieldCheck size={28} color={Colors.success} />
          </View>
          <Text variant="h2" style={styles.heroTitle}>Parcours certifié</Text>
          <Text variant="caption" color={Colors.textSecondary} style={styles.heroSub}>
            Chaque étape ci-dessous a été enregistrée et scellée dans la chaîne
            d&apos;audit Fresh-Core. La moindre modification rétroactive serait
            détectée par recomputation du hash.
          </Text>
          <Badge text={`Empreinte : ${shortHash(delivery.blockchain_hash)}`} variant="success" />
        </Card>

        {/* Supplier */}
        <Text variant="h3" style={styles.sectionTitle}>1. Fournisseur</Text>
        <Card>
          <View style={styles.row}>
            <Truck size={20} color={Colors.primary} />
            <View style={styles.rowInfo}>
              <Text variant="body">{supplier?.name || 'Fournisseur inconnu'}</Text>
              {supplier?.sanitary_approval ? (
                <Text variant="caption" color={Colors.textSecondary}>
                  Agrément sanitaire : {supplier.sanitary_approval}
                </Text>
              ) : null}
              {supplier?.contact_phone ? (
                <Text variant="caption" color={Colors.textSecondary}>
                  Contact : {supplier.contact_phone}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Reception */}
        <Text variant="h3" style={styles.sectionTitle}>2. Réception en cuisine</Text>
        <Card>
          <View style={styles.row}>
            <Calendar size={20} color={Colors.primary} />
            <View style={styles.rowInfo}>
              <Text variant="body">{format(recordedAt, 'EEEE d MMMM yyyy', { locale: fr })}</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                Validée à {format(recordedAt, 'HH:mm')}
              </Text>
            </View>
          </View>
        </Card>

        {/* Items */}
        <Text variant="h3" style={styles.sectionTitle}>
          3. {items.length} produit{items.length > 1 ? 's' : ''} contrôlé
          {items.length > 1 ? 's' : ''}
        </Text>
        {items.map((item) => {
          const tempOk = item.temperature_compliant !== false;
          const photos = Array.isArray(item.photo_paths) ? item.photo_paths : [];
          return (
            <Card key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                {categoryIcon(item.category)}
                <View style={styles.itemHeaderText}>
                  <Text variant="body">{item.product_name}</Text>
                  {item.lot_number ? (
                    <Text variant="caption" color={Colors.textSecondary}>
                      Lot {item.lot_number}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.itemBadges}>
                {item.temperature !== null && item.temperature !== undefined ? (
                  <Badge
                    text={`${item.temperature}°C`}
                    variant={tempOk ? 'success' : 'danger'}
                  />
                ) : null}
                {item.dlc ? <Badge text={`DLC ${item.dlc}`} variant="info" /> : null}
                <Badge
                  text={item.packaging_ok ? 'Emballage OK' : 'Emballage KO'}
                  variant={item.packaging_ok ? 'success' : 'danger'}
                />
                <Badge
                  text={item.visual_ok ? 'Visuel OK' : 'Visuel KO'}
                  variant={item.visual_ok ? 'success' : 'danger'}
                />
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

        {/* Chain hash */}
        <Text variant="h3" style={styles.sectionTitle}>4. Empreinte d&apos;audit</Text>
        <Card>
          <View style={styles.row}>
            <ShieldCheck size={20} color={Colors.success} />
            <View style={styles.rowInfo}>
              <Text variant="body">SHA-256 chaîné</Text>
              <Text variant="caption" color={Colors.textSecondary} style={styles.mono}>
                {delivery.blockchain_hash || '—'}
              </Text>
              <Text variant="caption" color={Colors.textSecondary} style={styles.chainNote}>
                Ce hash dépend de la réception précédente du même
                établissement. Toute modification a posteriori rompt la
                chaîne et devient détectable par recalcul.
              </Text>
            </View>
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Button
            title="QR consommateur"
            onPress={() => setShowQR(true)}
            variant="primary"
            icon={<QrCode size={16} color={Colors.white} />}
          />
          <Button
            title="Partager le lien"
            onPress={() => Share.share({ message: publicUrl, url: publicUrl })}
            variant="ghost"
            icon={<Share2 size={16} color={Colors.primary} />}
          />
        </View>

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
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  placeholder: { width: 44 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerSub: { marginTop: 8, textAlign: 'center' },
  scroll: { padding: 16, gap: 8, paddingBottom: 40 },
  heroCard: { alignItems: 'center', gap: 8, padding: 20 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { textAlign: 'center' },
  heroSub: { textAlign: 'center', lineHeight: 20 },
  sectionTitle: { marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowInfo: { flex: 1, gap: 4 },
  itemCard: { gap: 8 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemHeaderText: { flex: 1, gap: 2 },
  itemBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photosRow: { marginTop: 8 },
  itemPhoto: {
    width: 100,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: Colors.border,
  },
  mono: { fontFamily: 'monospace' },
  chainNote: { marginTop: 8, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 20, flexWrap: 'wrap' },
  bottomSpacer: { height: 24 },
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
