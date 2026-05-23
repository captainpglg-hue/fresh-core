import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Text } from '../../src/components/ui/Text';
import { Badge } from '../../src/components/ui/Badge';
import { Colors } from '../../src/constants/colors';
import { LotQRCode } from '../../src/components/lot/LotQRCode';
import { LotTimeline } from '../../src/components/lot/LotTimeline';
import { useLotStore } from '../../src/stores/lotStore';
import type { Lot, LotEvent } from '../../src/types/lotChain';

export default function LotDetailScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { fetchByCode, fetchEvents, verify } = useLotStore();
  const [lot, setLot] = useState<Lot | null>(null);
  const [events, setEvents] = useState<LotEvent[]>([]);
  const [integrity, setIntegrity] = useState<{ ok: boolean; brokenAtSequence: number | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      const l = await fetchByCode(code);
      setLot(l);
      if (l) {
        const evs = await fetchEvents(l.id);
        setEvents(evs);
        const i = await verify(l.id);
        setIntegrity(i);
      }
    } finally {
      setLoading(false);
    }
  }, [code, fetchByCode, fetchEvents, verify]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Lot" showBack onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!lot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Lot" showBack onBack={() => router.back()} />
        <View style={styles.center}>
          <Text variant="h3">Lot introuvable</Text>
          <Text variant="body" color={Colors.textSecondary}>
            Code : {code}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title={lot.product_name} subtitle={lot.lot_code} showBack onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.qrCard}>
          <LotQRCode lotCode={lot.lot_code} />
        </Card>

        <Card style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text variant="caption" color={Colors.textSecondary}>Filière</Text>
            <Text variant="body">{lot.filiere}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text variant="caption" color={Colors.textSecondary}>Maillon d'origine</Text>
            <Text variant="body">{lot.maillon_origin}</Text>
          </View>
          {lot.quantity != null ? (
            <View style={styles.metaRow}>
              <Text variant="caption" color={Colors.textSecondary}>Quantité</Text>
              <Text variant="body">
                {lot.quantity} {lot.unit || ''}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text variant="caption" color={Colors.textSecondary}>État chaîne</Text>
            {integrity?.ok ? (
              <View style={styles.integrityRow}>
                <CheckCircle2 size={16} color={Colors.success} />
                <Text variant="body" color={Colors.success}>
                  Intègre · {events.length} événement{events.length > 1 ? 's' : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.integrityRow}>
                <XCircle size={16} color={Colors.danger} />
                <Text variant="body" color={Colors.danger}>
                  Chaîne cassée à la séquence {integrity?.brokenAtSequence}
                </Text>
              </View>
            )}
          </View>
          {lot.anchored_at ? (
            <View style={styles.metaRow}>
              <Badge variant="success" text="Ancré blockchain" />
            </View>
          ) : (
            <View style={styles.metaRow}>
              <Badge variant="info" text="Ancrage en attente" />
            </View>
          )}
        </Card>

        <Card style={styles.timelineCard}>
          <Text variant="h2" style={styles.sectionTitle}>Parcours</Text>
          <LotTimeline events={events} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  qrCard: { alignItems: 'center', padding: 16 },
  metaCard: { padding: 16, gap: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  integrityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineCard: { padding: 16 },
  sectionTitle: { marginBottom: 8 },
});
