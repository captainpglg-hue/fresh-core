import { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Header } from '../../src/components/ui/Header';
import { Colors } from '../../src/constants/colors';
import { useDeliveryStore } from '../../src/stores/deliveryStore';
import { useAuthStore } from '../../src/stores/authStore';
import { Truck, Plus, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Delivery } from '../../src/types/database';

const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' }> = {
  pending: { label: 'En cours', variant: 'warning' },
  accepted: { label: 'Acceptee', variant: 'success' },
  refused: { label: 'Refusee', variant: 'danger' },
  partial: { label: 'Partielle', variant: 'info' },
};

export default function ReceptionsScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();
  const { deliveries, loadDeliveries } = useDeliveryStore();
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (establishment?.id) {
      loadDeliveries(establishment.id, selectedDate);
    }
  }, [establishment?.id, selectedDate]);

  const renderDelivery = ({ item }: { item: Delivery }) => {
    const status = STATUS_MAP[item.status] || STATUS_MAP.pending;
    return (
      <Pressable onPress={() => router.push(`/reception/${item.id}`)}>
        <Card style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardInfo}>
              <Truck size={20} color={Colors.primary} />
              <View>
                <Text variant="h3">Reception</Text>
                <Text variant="caption" color={Colors.textSecondary}>
                  {format(new Date(item.recorded_at), 'HH:mm', { locale: fr })}
                </Text>
              </View>
            </View>
            <View style={styles.cardStatus}>
              <Badge text={status.label} variant={status.variant} />
              <ChevronRight size={16} color={Colors.textSecondary} />
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Receptions" showSync />
      <Text variant="caption" color={Colors.textSecondary} style={styles.date}>
        {format(new Date(selectedDate), 'EEEE d MMMM yyyy', { locale: fr })}
      </Text>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        renderItem={renderDelivery}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="body" color={Colors.textSecondary}>Aucune reception aujourd&apos;hui</Text>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={() => router.push('/reception/nouvelle')}>
        <Plus size={28} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  date: { paddingHorizontal: 16, paddingTop: 8 },
  list: { padding: 16, paddingBottom: 100 },
  card: { marginBottom: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { alignItems: 'center', paddingTop: 60 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },