import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Box, CheckCircle2, MoveRight, ShieldCheck, Trash2, Utensils, XCircle, Inbox } from 'lucide-react-native';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Colors } from '../../src/constants/colors';
import { LotQRCode } from '../../src/components/lot/LotQRCode';
import { LotTimeline } from '../../src/components/lot/LotTimeline';
import { useLotStore } from '../../src/stores/lotStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useMaillonContext } from '../../src/hooks/useMaillonContext';
import { MAILLONS } from '../../src/constants/filieres';
import type { Lot, LotEvent, LotEventType } from '../../src/types/lotChain';

type ActionType = Exclude<LotEventType, 'CREATE'>;

function actionIcon(type: ActionType) {
  switch (type) {
    case 'TRANSFER': return MoveRight;
    case 'TRANSFORM': return Box;
    case 'CONTROL': return ShieldCheck;
    case 'CONSUME': return Utensils;
    case 'DESTROY': return Trash2;
  }
}

function actionLabel(type: ActionType): string {
  switch (type) {
    case 'TRANSFER': return 'Transférer';
    case 'TRANSFORM': return 'Transformer';
    case 'CONTROL': return 'Contrôle';
    case 'CONSUME': return 'Consommer';
    case 'DESTROY': return 'Détruire';
  }
}

export default function LotDetailScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, establishment } = useAuthStore();
  const { maillon, maillonConfig } = useMaillonContext();
  const { fetchByCode, fetchEvents, verify, appendEvent } = useLotStore();

  const [lot, setLot] = useState<Lot | null>(null);
  const [events, setEvents] = useState<LotEvent[]>([]);
  const [integrity, setIntegrity] = useState<{ ok: boolean; brokenAtSequence: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);

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

  const receive = useCallback(async () => {
    if (!lot || !user || !establishment) return;
    setReceiving(true);
    try {
      await appendEvent({
        lotId: lot.id,
        type: 'TRANSFER',
        actorId: user.id,
        actorMaillon: maillon,
        establishmentId: establishment.id,
        payload: {
          from_maillon: lot.maillon_origin,
          to_maillon: maillon,
          context: 'reception_handoff',
        },
        newHolderId: user.id,
        newEstablishmentId: establishment.id,
      });
      await load();
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Réception impossible');
    } finally {
      setReceiving(false);
    }
  }, [lot, user, establishment, maillon, appendEvent, load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Lot" showBack onBack={() => router.back()} />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!lot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Lot" showBack onBack={() => router.back()} />
        <View style={styles.center}>
          <Text variant="h3">Lot introuvable</Text>
          <Text variant="body" color={Colors.textSecondary}>Code : {code}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isHolder = lot.current_holder_id === user?.id;
  const isActive = lot.status === 'active';
  const canAct = isHolder && isActive;
  const canReceive = !isHolder && isActive;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title={lot.product_name} subtitle={lot.lot_code} showBack onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.qrCard}>
          <LotQRCode lotCode={lot.lot_code} />
        </Card>

        <Card style={styles.metaCard}>
          <Row label="Filière" value={lot.filiere} />
          <Row label="Maillon d'origine" value={MAILLONS[lot.maillon_origin]?.label ?? lot.maillon_origin} />
          {lot.quantity != null ? <Row label="Quantité" value={`${lot.quantity} ${lot.unit ?? ''}`} /> : null}
          <View style={styles.row}>
            <Text variant="caption" color={Colors.textSecondary}>État chaîne</Text>
            {integrity?.ok ? (
              <View style={styles.inline}>
                <CheckCircle2 size={16} color={Colors.success} />
                <Text variant="body" color={Colors.success}>
                  Intègre · {events.length} événement{events.length > 1 ? 's' : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.inline}>
                <XCircle size={16} color={Colors.danger} />
                <Text variant="body" color={Colors.danger}>
                  Cassée à la séq. {integrity?.brokenAtSequence}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.row}>
            <Badge
              variant={lot.status === 'active' ? 'success' : lot.status === 'destroyed' ? 'danger' : 'info'}
              text={lot.status === 'active' ? 'Actif' : lot.status === 'consumed' ? 'Consommé' : 'Détruit'}
            />
            <Badge
              variant={lot.anchored_at ? 'success' : 'info'}
              text={lot.anchored_at ? 'Ancré blockchain' : 'Ancrage en attente'}
            />
          </View>
        </Card>

        {canReceive ? (
          <Card style={styles.actionCard}>
            <View style={styles.inline}>
              <Inbox size={20} color={Colors.primary} />
              <Text variant="h3">Réceptionner ce lot</Text>
            </View>
            <Text variant="body" color={Colors.textSecondary}>
              Tu n'es pas le détenteur actuel. Confirme la réception : un événement TRANSFER signé en tant que {MAILLONS[maillon].label} sera ajouté à la chaîne.
            </Text>
            <Button
              title={receiving ? 'Réception…' : 'Confirmer la réception'}
              onPress={receive}
              loading={receiving}
              disabled={receiving}
              fullWidth
            />
          </Card>
        ) : null}

        {canAct ? (
          <Card style={styles.actionCard}>
            <Text variant="h3">Actions</Text>
            <View style={styles.actionGrid}>
              {maillonConfig.allowedActions.map((act) => {
                const Icon = actionIcon(act);
                return (
                  <Button
                    key={act}
                    title={actionLabel(act)}
                    onPress={() => router.push(`/lot/action?code=${lot.lot_code}&type=${act}`)}
                    icon={<Icon size={16} color={Colors.white} />}
                    variant={act === 'DESTROY' ? 'danger' : 'primary'}
                    size="sm"
                  />
                );
              })}
            </View>
          </Card>
        ) : null}

        <Card style={styles.timelineCard}>
          <Text variant="h2" style={styles.sectionTitle}>Parcours</Text>
          <LotTimeline events={events} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" color={Colors.textSecondary}>{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  qrCard: { alignItems: 'center', padding: 16 },
  metaCard: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCard: { padding: 16, gap: 12 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timelineCard: { padding: 16 },
  sectionTitle: { marginBottom: 8 },
});
