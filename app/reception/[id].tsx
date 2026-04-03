import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Header } from '../../src/components/ui/Header';
import { Colors } from '../../src/constants/colors';
import { getByIdLocal, getAllLocal } from '../../src/services/database';
import { useSupplierStore } from '../../src/stores/supplierStore';
import type { Delivery, DeliveryItem, Supplier } from '../../src/types/database';

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'success' | 'danger' | 'warning' | 'info' }
> = {
  pending: { label: 'En cours', variant: 'warning' },
  accepted: { label: 'Acceptee', variant: 'success' },
  refused: { label: 'Refusee', variant: 'danger' },
  partial: { label: 'Partielle', variant: 'info' },
};

export default function ReceptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { suppliers } = useSupplierStore();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const d = await getByIdLocal<Delivery>('deliveries', id);
        setDelivery(d);
        const i = await getAllLocal<DeliveryItem>('delivery_items', 'delivery_id = ?', [id]);
        setItems(i);
      } catch {
        // Loading error
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Detail reception" showBack onBack={() => router.back()} />
        <View style={styles.centerContent}>
          <Text variant="body" color={Colors.textSecondary}>
            Chargement...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Detail reception" showBack onBack={() => router.back()} />
        <View style={styles.centerContent}>
          <Text variant="h3" color={Colors.textSecondary}>
            Reception introuvable
          </Text>
          <View style={styles.spacer} />
          <Button title="Retour" onPress={() => router.back()} variant="ghost" />
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_MAP[delivery.status] ?? STATUS_MAP.pending;
  const supplier: Supplier | undefined = delivery.supplier_id
    ? suppliers.find((s) => s.id === delivery.supplier_id)
    : undefined;

  const conformeCount = items.filter(
    (i) => i.temperature_compliant !== false && i.packaging_ok && i.visual_ok,
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Detail reception" showBack onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status + date */}
        <View style={styles.topRow}>
          <Badge text={status.label} variant={status.variant} />
          <Text variant="caption" color={Colors.textSecondary}>
            {delivery.delivery_date}
          </Text>
        </View>

        {/* Supplier info */}
        {supplier && (
          <Card style={styles.supplierCard}>
            <Text variant="caption" color={Colors.textSecondary}>
              FOURNISSEUR
            </Text>
            <Text variant="h3">{supplier.name}</Text>
            {supplier.sanitary_approval && (
              <Text variant="caption" color={Colors.textSecondary}>
                Agrement: {supplier.sanitary_approval}
              </Text>
            )}
            {supplier.contact_phone && (
              <Text variant="caption" color={Colors.textSecondary}>
                Tel: {supplier.contact_phone}
              </Text>
            )}
          </Card>
        )}

        {/* Delivery note photo */}
        {delivery.delivery_note_photo_path && (
          <Card style={styles.photoCard}>
            <Text variant="caption" color={Colors.textSecondary} style={styles.sectionLabel}>
              BON DE LIVRAISON
            </Text>
            <Image
              source={{ uri: delivery.delivery_note_photo_path }}
              style={styles.deliveryNotePhoto}
              resizeMode="cover"
            />
          </Card>
        )}

        {/* Refusal reason */}
        {delivery.status === 'refused' && delivery.refusal_reason && (
          <Card variant="alert" style={styles.refusalCard}>
            <Text variant="h3" color={Colors.danger}>
              Motif de refus
            </Text>
            <Text variant="body">{delivery.refusal_reason}</Text>
            {delivery.refusal_photo_path && (
              <Image
                source={{ uri: delivery.refusal_photo_path }}
                style={styles.refusalPhoto}
                resizeMode="cover"
              />
            )}
          </Card>
        )}

        {/* Products */}
        <View style={styles.productsHeader}>
          <Text variant="h2">
            {items.length} produit{items.length > 1 ? 's' : ''} controle{items.length > 1 ? 's' : ''}
          </Text>
          <Text variant="caption" color={Colors.textSecondary}>
            {conformeCount}/{items.length} conforme{conformeCount > 1 ? 's' : ''}
          </Text>
        </View>

        {items.map((item) => {
          const tempOk = item.temperature_compliant !== false;
          const allOk = tempOk && item.packaging_ok && item.visual_ok;

          return (
            <Card
              key={item.id}
              style={styles.itemCard}
              variant={allOk ? 'default' : 'alert'}
            >
              <View style={styles.itemHeader}>
                <Text variant="h3">{item.product_name}</Text>
                {item.category && (
                  <Badge text={item.category} variant="info" />
                )}
              </View>

              <View style={styles.itemBadges}>
                {item.temperature !== null && item.temperature !== undefined && (
                  <Badge
                    text={`${item.temperature}°C`}
                    variant={tempOk ? 'success' : 'danger'}
                  />
                )}
                <Badge
                  text={item.packaging_ok ? 'Emb. OK' : 'Emb. KO'}
                  variant={item.packaging_ok ? 'success' : 'danger'}
                />
                <Badge
                  text={item.visual_ok ? 'Visuel OK' : 'Visuel KO'}
                  variant={item.visual_ok ? 'success' : 'danger'}
                />
              </View>

              <View style={styles.itemDetails}>
                {item.dlc && (
                  <Text variant="caption" color={Colors.textSecondary}>
                    DLC: {item.dlc}
                  </Text>
                )}
                {item.lot_number && (
                  <Text variant="caption" color={Colors.textSecondary}>
                    Lot: {item.lot_number}
                  </Text>
                )}
              </View>

              {item.photo_paths && item.photo_paths.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photosRow}
                >
                  {item.photo_paths.map((uri, idx) => (
                    <Image
                      key={`${item.id}-photo-${idx}`}
                      source={{ uri }}
                      style={styles.itemPhoto}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              )}
            </Card>
          );
        })}

        <View style={styles.bottomSpacer} />
        <Button title="Retour" onPress={() => router.back()} variant="ghost" fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  supplierCard: {
    marginBottom: 12,
    gap: 4,
  },
  photoCard: {
    marginBottom: 12,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  deliveryNotePhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  refusalCard: {
    marginBottom: 12,
    gap: 8,
  },
  refusalPhoto: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: Colors.border,
    marginTop: 8,
  },
  productsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  itemCard: {
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  itemDetails: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  photosRow: {
    marginTop: 8,
  },
  itemPhoto: {
    width: 100,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: Colors.border,
  },
  spacer: {
    height: 16,
  },
  bottomSpacer: {
    height: 16,
  },
});
