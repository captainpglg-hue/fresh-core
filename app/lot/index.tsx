import React, { useCallback, useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Package, QrCode, Scan } from 'lucide-react-native';
import { Header } from '../../src/components/ui/Header';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Colors } from '../../src/constants/colors';
import { useLotStore } from '../../src/stores/lotStore';
import { useAuthStore } from '../../src/stores/authStore';
import type { Lot } from '../../src/types/lotChain';

export default function LotsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { lots, loading, loadHeldByUser } = useLotStore();

  const load = useCallback(() => {
    if (user?.id) loadHeldByUser(user.id);
  }, [user?.id, loadHeldByUser]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Mes lots" subtitle="Traçabilité bout en bout" showBack onBack={() => router.back()} />
      <View style={styles.actions}>
        <Button
          title="Scanner un lot"
          onPress={() => router.push('/lot/scanner')}
          icon={<Scan size={18} color={Colors.white} />}
          fullWidth
        />
      </View>
      <FlatList
        data={lots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Package size={48} color={Colors.textSecondary} />
            <Text variant="h3" style={styles.emptyTitle}>Aucun lot en garde</Text>
            <Text variant="body" color={Colors.textSecondary} style={styles.emptyBody}>
              Scanne un QR code pour réceptionner un lot, ou crée-en un nouveau depuis ton module métier.
            </Text>
          </View>
        }
        renderItem={({ item }) => <LotRow lot={item} onPress={() => router.push(`/lot/${item.lot_code}`)} />}
      />
    </SafeAreaView>
  );
}

function LotRow({ lot, onPress }: { lot: Lot; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        <View style={styles.iconWrap}>
          <QrCode size={28} color={Colors.primary} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowHead}>
            <Text variant="h3">{lot.product_name}</Text>
            <Badge
              variant={lot.status === 'active' ? 'success' : lot.status === 'destroyed' ? 'danger' : 'info'}
              text={lot.status === 'active' ? 'Actif' : lot.status === 'consumed' ? 'Consommé' : 'Détruit'}
            />
          </View>
          <Text variant="caption" color={Colors.textSecondary} style={styles.code}>
            {lot.lot_code}
          </Text>
          <Text variant="caption" color={Colors.textSecondary}>
            {lot.filiere} · {lot.maillon_origin} · seq {lot.head_sequence}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  actions: { paddingHorizontal: 16, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontFamily: 'monospace', marginTop: 2 },
  empty: { padding: 48, alignItems: 'center', gap: 12 },
  emptyTitle: { textAlign: 'center' },
  emptyBody: { textAlign: 'center' },
});
