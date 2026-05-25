import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Colors } from '../../src/constants/colors';
import { supabase, isDemoMode } from '../../src/services/supabase';
import { getAllLocal } from '../../src/services/database';
import type { Delivery, DeliveryItem, Supplier, Establishment } from '../../src/types/database';

type OrigineItem = {
  id: string;
  product_name: string;
  category: string | null;
  temperature: number | null;
  temperature_compliant: boolean | null;
  dlc: string | null;
  lot_number: string | null;
  packaging_ok: boolean;
  visual_ok: boolean;
};

type OriginePayload = {
  delivery: {
    id: string;
    local_id: string | null;
    delivery_date: string;
    recorded_at: string;
    status: string;
    blockchain_hash: string | null;
  };
  supplier: { name: string; sanitary_approval: string | null } | null;
  establishment: { name: string; city: string | null } | null;
  items: OrigineItem[];
};

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

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMMM yyyy', { locale: fr });
  } catch {
    return iso;
  }
}

export default function OrigineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<OriginePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        if (isDemoMode) {
          // En mode démo, Supabase n'est pas joignable : on recompose
          // le même shape JSON que la RPC `get_origine` en lisant le
          // SQLite local (seedé par src/services/demoData.ts avec
          // local_id = "del-meat-001" et "del-fish-001").
          const deliveries = await getAllLocal<Delivery>(
            'deliveries',
            'id = ? OR local_id = ?',
            [id, id],
          );
          const delivery = deliveries[0];
          if (!delivery) {
            if (!cancelled) setData(null);
            return;
          }
          const itemsRaw = await getAllLocal<DeliveryItem>(
            'delivery_items',
            'delivery_id = ?',
            [delivery.id],
          );
          let supplier: Supplier | null = null;
          if (delivery.supplier_id) {
            const suppliers = await getAllLocal<Supplier>(
              'suppliers',
              'id = ?',
              [delivery.supplier_id],
            );
            supplier = suppliers[0] ?? null;
          }
          const establishments = await getAllLocal<Establishment>(
            'establishments',
            'id = ?',
            [delivery.establishment_id],
          );
          const establishment = establishments[0] ?? null;

          const payload: OriginePayload = {
            delivery: {
              id: delivery.id,
              local_id: delivery.local_id,
              delivery_date: delivery.delivery_date,
              recorded_at: delivery.recorded_at,
              status: delivery.status,
              blockchain_hash: delivery.blockchain_hash,
            },
            supplier: supplier
              ? { name: supplier.name, sanitary_approval: supplier.sanitary_approval }
              : null,
            establishment: establishment
              ? { name: establishment.name, city: establishment.city }
              : null,
            items: itemsRaw.map((it) => ({
              id: it.id,
              product_name: it.product_name,
              category: it.category,
              temperature: it.temperature,
              // SQLite stocke les booléens en INTEGER 0/1 → on
              // normalise pour le rendu.
              temperature_compliant:
                it.temperature_compliant === null || it.temperature_compliant === undefined
                  ? null
                  : Boolean(it.temperature_compliant),
              dlc: it.dlc,
              lot_number: it.lot_number,
              packaging_ok: Boolean(it.packaging_ok),
              visual_ok: Boolean(it.visual_ok),
            })),
          };
          if (!cancelled) setData(payload);
          return;
        }

        const { data: rpcData, error: rpcError } = await supabase.rpc('get_origine', { p_id: id });
        if (cancelled) return;
        if (rpcError) {
          setError(rpcError.message);
        } else {
          setData(rpcData as OriginePayload | null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur réseau');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text variant="body" color={Colors.textSecondary}>Chargement du parcours…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text variant="h3">Produit introuvable</Text>
          <Text variant="caption" color={Colors.textSecondary} style={styles.centerSub}>
            Le code {id} ne correspond à aucune réception. Vérifiez le QR ou demandez au restaurateur.
          </Text>
          {error ? (
            <Text variant="caption" color={Colors.danger} style={styles.centerSub}>
              {error}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const { delivery, supplier, establishment, items } = data;
  const categories = Array.from(new Set(items.map((it) => categoryLabel(it.category)))).join(' · ');
  const allCompliant = items.every(
    (it) => it.temperature_compliant !== false && it.packaging_ok && it.visual_ok,
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text variant="h1" color={Colors.white} style={styles.heroTitle}>
            Parcours certifié
          </Text>
          <Text variant="body" color={Colors.white}>
            {categories || 'Produit servi'}
          </Text>
          {establishment ? (
            <Text variant="caption" color={Colors.white} style={styles.heroEstab}>
              servi par {establishment.name}
              {establishment.city ? `, ${establishment.city}` : ''}
            </Text>
          ) : null}
        </View>

        <Card style={styles.section}>
          <Text variant="caption" color={Colors.textSecondary} style={styles.label}>
            RÉCEPTION
          </Text>
          <Text variant="h3">{formatDate(delivery.recorded_at)}</Text>
          <View style={styles.row}>
            <Badge text={allCompliant ? 'Conforme HACCP' : 'Écart relevé'} variant={allCompliant ? 'success' : 'warning'} />
          </View>
        </Card>

        {supplier ? (
          <Card style={styles.section}>
            <Text variant="caption" color={Colors.textSecondary} style={styles.label}>
              FOURNISSEUR
            </Text>
            <Text variant="h3">{supplier.name}</Text>
            {supplier.sanitary_approval ? (
              <Text variant="caption" color={Colors.textSecondary}>
                Agrément sanitaire {supplier.sanitary_approval}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <View style={styles.itemsHeader}>
          <Text variant="h2">
            {items.length} produit{items.length > 1 ? 's' : ''}
          </Text>
        </View>

        {items.map((it) => {
          const tempOk = it.temperature_compliant !== false;
          const ok = tempOk && it.packaging_ok && it.visual_ok;
          return (
            <Card key={it.id} style={styles.itemCard} variant={ok ? 'default' : 'alert'}>
              <Text variant="h3">{it.product_name}</Text>
              <View style={styles.badgeRow}>
                {it.category ? <Badge text={categoryLabel(it.category)} variant="info" /> : null}
                {it.temperature !== null && it.temperature !== undefined ? (
                  <Badge
                    text={`${it.temperature}°C`}
                    variant={tempOk ? 'success' : 'danger'}
                  />
                ) : null}
                <Badge text={it.packaging_ok ? 'Emb. OK' : 'Emb. KO'} variant={it.packaging_ok ? 'success' : 'danger'} />
                <Badge text={it.visual_ok ? 'Visuel OK' : 'Visuel KO'} variant={it.visual_ok ? 'success' : 'danger'} />
              </View>
              {it.lot_number ? (
                <Text variant="caption" color={Colors.textSecondary}>
                  Lot {it.lot_number}
                </Text>
              ) : null}
              {it.dlc ? (
                <Text variant="caption" color={Colors.textSecondary}>
                  DLC {it.dlc}
                </Text>
              ) : null}
            </Card>
          );
        })}

        {delivery.blockchain_hash ? (
          <Card style={styles.section}>
            <Text variant="caption" color={Colors.textSecondary} style={styles.label}>
              EMPREINTE D'INTÉGRITÉ
            </Text>
            <Text variant="caption" color={Colors.textSecondary} style={styles.hash}>
              {delivery.blockchain_hash}
            </Text>
          </Card>
        ) : null}

        <Text variant="caption" color={Colors.textSecondary} style={styles.footer}>
          Données certifiées HACCP par Fresh-Core · code {delivery.local_id ?? delivery.id}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  centerSub: {
    marginTop: 12,
    textAlign: 'center',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    gap: 4,
  },
  heroTitle: {
    marginBottom: 4,
  },
  heroEstab: {
    marginTop: 8,
  },
  section: {
    marginBottom: 12,
    gap: 4,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  itemsHeader: {
    marginTop: 8,
    marginBottom: 8,
  },
  itemCard: {
    marginBottom: 8,
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hash: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  footer: {
    marginTop: 16,
    textAlign: 'center',
  },
});
