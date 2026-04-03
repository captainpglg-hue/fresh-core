import { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { getByIdLocal, getAllLocal } from '../../src/services/database';
import type { Delivery, DeliveryItem } from '../../src/types/database';

export default function DeliveryDetailScreen() {
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const router = useRouter();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [items, setItems] = useState<DeliveryItem[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!deliveryId) return;
      const d = await getByIdLocal<Delivery>('deliveries', deliveryId);
      setDelivery(d);
      const i = await getAllLocal<DeliveryItem>('delivery_items', 'delivery_id = ?', [deliveryId]);
      setItems(i);
    };
    load();
  }, [deliveryId]);

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container}>
        <Text variant="h2">Chargement...</Text>
      </SafeAreaView>
    );
  }

  const statusMap: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' }> = {
    pending: { label: 'En cours', variant: 'warning' },
    accepted: { label: 'Acceptee', variant: 'success' },
    refused: { label: 'Refusee', variant: 'danger' },
    partial: { label: 'Partielle', variant: 'info' },
  };
  const status = statusMap[delivery.status] || statusMap.pending;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="h1">Detail reception</Text>
        <Badge text={status.label} variant={status.variant} />
        <Text variant="caption" color={Colors.textSecondary}>Date: {delivery.delivery_date}</Text>

        {delivery.refusal_reason && (
          <Card style={styles.refusalCard}>
            <Text variant="h3" color={Colors.danger}>Motif de refus</Text>
            <Text variant="body">{delivery.refusal_reason}</Text>
          </Card>
        )}

        <Text variant="h2" style={styles.sectionTitle}>{items.length} produit(s) controle(s)</Text>
        {items.map((item) => (
          <Card key={item.id} style={styles.itemCard}>
            <Text variant="h3">{item.product_name}</Text>
            {item.category && <Text variant="caption" color={Colors.textSecondary}>{item.category}</Text>}
            <View style={styles.itemDetails}>
              {item.temperature != null && (
                <Badge text={`${item.temperature}°C`} variant={item.temperature_compliant ? 'success' : 'danger'} />
              )}
              {item.lot_number && <Text variant="caption">Lot: {item.lot_number}</Text>}
              {item.dlc && <Text variant="caption">DLC: {item.dlc}</Text>}
            </View>
          </Card>
        ))}

        <Button title="Retour" onPress={() => router.back()} variant="ghost" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, gap: 12 },
  sectionTitle: { marginTop: 16 },
  refusalCard: { borderLeftWidth: 4, borderLeftColor: Colors.danger },
  itemCard: { marginBottom: 8 },
  itemDetails: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
});
