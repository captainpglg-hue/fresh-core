import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Anchor, Leaf, ShieldCheck } from 'lucide-react-native';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Text } from '../../src/components/ui/Text';
import { Badge } from '../../src/components/ui/Badge';
import { Colors } from '../../src/constants/colors';
import { LotTimeline } from '../../src/components/lot/LotTimeline';
import { getLotByCode, getLotEvents, getLotParents } from '../../src/services/lotChain';
import { supabase } from '../../src/services/supabase';
import type { Lot, LotEvent } from '../../src/types/lotChain';

interface OrigineParent {
  lot_code: string;
  filiere: string;
  product_name: string;
  ratio: number | null;
}

interface OrigineView {
  lot: Lot;
  events: LotEvent[];
  parents: OrigineParent[];
}

/**
 * Page publique consommateur : ouvert sans auth. Si Supabase configuré, lit
 * via la RPC get_origine (SECURITY DEFINER, bypass RLS). Sinon, fallback
 * SQLite local (utile en mode démo / dev).
 */
async function fetchOrigine(lotCode: string): Promise<OrigineView | null> {
  try {
    const { data, error } = await supabase.rpc('get_origine', { p_lot_code: lotCode });
    if (!error && data) {
      const d = data as {
        lot_code: string;
        filiere: Lot['filiere'];
        maillon_origin: Lot['maillon_origin'];
        product_name: string;
        product_category: string | null;
        unit: string | null;
        quantity: number | null;
        status: Lot['status'];
        head_hash: string | null;
        head_sequence: number;
        anchored_at: string | null;
        anchor_tx_hash: string | null;
        created_at: string;
        events: LotEvent[];
        parents: OrigineParent[];
      };
      return {
        lot: {
          id: d.lot_code,
          lot_code: d.lot_code,
          filiere: d.filiere,
          maillon_origin: d.maillon_origin,
          product_name: d.product_name,
          product_category: d.product_category,
          unit: d.unit,
          quantity: d.quantity,
          current_holder_id: null,
          current_establishment_id: null,
          status: d.status,
          head_hash: d.head_hash,
          head_sequence: d.head_sequence,
          anchored_at: d.anchored_at,
          anchor_tx_hash: d.anchor_tx_hash,
          created_at: d.created_at,
        },
        events: d.events || [],
        parents: d.parents || [],
      };
    }
  } catch {
    // Supabase indisponible → fallback local
  }

  const lot = await getLotByCode(lotCode);
  if (!lot) return null;
  const events = await getLotEvents(lot.id);
  const parents = await getLotParents(lot.id);
  return {
    lot,
    events,
    parents: parents.map((p) => ({
      lot_code: p.parent_lot_id,
      filiere: '',
      product_name: '',
      ratio: p.ratio,
    })),
  };
}

export default function OrigineScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [view, setView] = useState<OrigineView | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      const v = await fetchOrigine(code);
      setView(v);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Origine" />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!view) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Origine" />
        <View style={styles.center}>
          <Text variant="h3">Produit introuvable</Text>
          <Text variant="body" color={Colors.textSecondary} style={styles.centerText}>
            Le code {code} ne correspond à aucun lot enregistré. Le QR est peut-être ancien ou erroné.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { lot, events, parents } = view;
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Origine" subtitle={lot.product_name} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.heroCard}>
          <View style={styles.heroHead}>
            <Leaf size={28} color={Colors.primary} />
            <Text variant="h1" style={styles.heroTitle}>{lot.product_name}</Text>
          </View>
          <Text variant="body" color={Colors.textSecondary}>
            {lot.filiere} · Origine : {lot.maillon_origin}
          </Text>
          <View style={styles.codeRow}>
            <Text variant="caption" color={Colors.textSecondary}>Code lot</Text>
            <Text variant="h3" style={styles.code}>{lot.lot_code}</Text>
          </View>
        </Card>

        <Card style={styles.trustCard}>
          <View style={styles.trustHead}>
            <ShieldCheck size={20} color={Colors.success} />
            <Text variant="h3">Traçabilité vérifiable</Text>
          </View>
          <Text variant="body" color={Colors.textSecondary}>
            Chaque étape est signée et chaînée par hash. {lot.anchored_at ? 'La chaîne est ancrée sur blockchain.' : "L'ancrage blockchain est en cours."}
          </Text>
          <View style={styles.trustMeta}>
            <View style={styles.trustItem}>
              <Anchor size={14} color={Colors.textSecondary} />
              <Text variant="caption" color={Colors.textSecondary} style={styles.hash}>
                {lot.head_hash ? lot.head_hash.slice(0, 24) + '…' : '—'}
              </Text>
            </View>
            <Badge
              variant={lot.anchored_at ? 'success' : 'info'}
              text={lot.anchored_at ? 'Ancré blockchain' : 'Ancrage en attente'}
            />
          </View>
        </Card>

        {parents.length > 0 ? (
          <Card style={styles.parentsCard}>
            <Text variant="h2" style={styles.sectionTitle}>Composé à partir de</Text>
            {parents.map((p) => (
              <View key={p.lot_code} style={styles.parentRow}>
                <Text variant="body">{p.product_name || p.lot_code}</Text>
                {p.ratio != null ? (
                  <Text variant="caption" color={Colors.textSecondary}>
                    {(p.ratio * 100).toFixed(0)} %
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={styles.timelineCard}>
          <Text variant="h2" style={styles.sectionTitle}>Parcours du lot</Text>
          <LotTimeline events={events} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  centerText: { textAlign: 'center' },
  heroCard: { padding: 20, gap: 8 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTitle: { flex: 1 },
  codeRow: { marginTop: 8 },
  code: { fontFamily: 'monospace', letterSpacing: 2, color: Colors.primary },
  trustCard: { padding: 16, gap: 8 },
  trustHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hash: { fontFamily: 'monospace' },
  parentsCard: { padding: 16, gap: 6 },
  parentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineCard: { padding: 16 },
  sectionTitle: { marginBottom: 8 },
});
