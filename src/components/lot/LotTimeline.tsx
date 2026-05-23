import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Anchor, Box, Move, Package, ShieldCheck, Trash2, Utensils } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { Colors } from '../../constants/colors';
import type { LotEvent, Maillon } from '../../types/lotChain';

interface Props {
  events: LotEvent[];
}

const MAILLON_LABEL: Record<Maillon, string> = {
  producteur: 'Producteur',
  pecheur: 'Pêcheur',
  eleveur: 'Éleveur',
  transformateur: 'Transformateur',
  criee: 'Criée',
  mareyeur: 'Mareyeur',
  fromager: 'Fromager',
  charcutier: 'Charcutier',
  boulanger: 'Boulanger',
  distributeur: 'Distributeur',
  detaillant: 'Détaillant',
  poissonnier: 'Poissonnier',
  primeur: 'Primeur',
  cremier: 'Crémier',
  caviste: 'Caviste',
  restaurateur: 'Restaurateur',
  logisticien: 'Logisticien',
  autre: 'Autre',
};

function eventIcon(type: LotEvent['type']) {
  switch (type) {
    case 'CREATE': return Package;
    case 'TRANSFER': return Move;
    case 'TRANSFORM': return Box;
    case 'CONTROL': return ShieldCheck;
    case 'CONSUME': return Utensils;
    case 'DESTROY': return Trash2;
  }
}

function eventLabel(type: LotEvent['type']) {
  switch (type) {
    case 'CREATE': return 'Création';
    case 'TRANSFER': return 'Transfert';
    case 'TRANSFORM': return 'Transformation';
    case 'CONTROL': return 'Contrôle';
    case 'CONSUME': return 'Consommation';
    case 'DESTROY': return 'Destruction';
  }
}

function eventColor(type: LotEvent['type']): string {
  switch (type) {
    case 'CREATE': return Colors.primaryLight;
    case 'TRANSFER': return Colors.gold;
    case 'TRANSFORM': return Colors.accent;
    case 'CONTROL': return Colors.primaryLighter;
    case 'CONSUME': return Colors.success;
    case 'DESTROY': return Colors.danger;
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function payloadSummary(event: LotEvent): string | null {
  const p = event.payload || {};
  const parts: string[] = [];
  if (typeof p.zone_peche === 'string') parts.push(`Zone ${p.zone_peche}`);
  if (typeof p.espece === 'string') parts.push(p.espece);
  if (typeof p.methode === 'string') parts.push(p.methode);
  if (typeof p.bateau === 'string') parts.push(`Bateau ${p.bateau}`);
  if (typeof p.id_animal === 'string') parts.push(`Animal ${p.id_animal}`);
  if (typeof p.troupeau === 'string') parts.push(`Troupeau ${p.troupeau}`);
  if (typeof p.variete === 'string') parts.push(p.variete);
  if (typeof p.parcelle === 'string') parts.push(`Parcelle ${p.parcelle}`);
  if (typeof p.recette === 'string') parts.push(p.recette);
  if (typeof p.transporteur === 'string') parts.push(`Transport ${p.transporteur}`);
  if (typeof p.temperature_transport === 'number') parts.push(`${p.temperature_transport.toFixed(1)} °C`);
  if (typeof p.control_type === 'string') parts.push(`Contrôle ${p.control_type}`);
  if (typeof p.reason === 'string') parts.push(p.reason);
  if (typeof p.notes === 'string' && parts.length === 0) parts.push(p.notes);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function LotTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="body" color={Colors.textSecondary}>Aucun événement enregistré.</Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {events.map((e, idx) => {
        const Icon = eventIcon(e.type);
        const color = eventColor(e.type);
        const summary = payloadSummary(e);
        const isLast = idx === events.length - 1;
        return (
          <View key={e.id} style={styles.row}>
            <View style={styles.gutter}>
              <View style={[styles.dot, { backgroundColor: color }]}>
                <Icon size={14} color={Colors.white} />
              </View>
              {!isLast ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.body}>
              <View style={styles.headRow}>
                <Text variant="h3">{eventLabel(e.type)}</Text>
                {e.actor_maillon ? (
                  <Text variant="caption" color={Colors.textSecondary}>
                    {MAILLON_LABEL[e.actor_maillon]}
                  </Text>
                ) : null}
              </View>
              <Text variant="caption" color={Colors.textSecondary}>{formatDate(e.occurred_at)}</Text>
              {summary ? <Text variant="body" style={styles.summary}>{summary}</Text> : null}
              <View style={styles.hashRow}>
                <Anchor size={12} color={Colors.textSecondary} />
                <Text variant="caption" color={Colors.textSecondary} style={styles.hash}>
                  {e.hash.slice(0, 16)}…
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 8 },
  empty: { padding: 24, alignItems: 'center' },
  row: { flexDirection: 'row', minHeight: 80 },
  gutter: { width: 32, alignItems: 'center' },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  line: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 2 },
  body: { flex: 1, paddingBottom: 20, paddingLeft: 12 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  summary: { marginTop: 4 },
  hashRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  hash: { fontFamily: 'monospace' },
});
