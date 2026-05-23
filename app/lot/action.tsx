import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Colors } from '../../src/constants/colors';
import { DynamicForm, type DynamicFormValues } from '../../src/components/forms/DynamicForm';
import {
  CONTROL_FIELDS,
  CONSUME_FIELDS,
  DESTROY_FIELDS,
  TRANSFER_FIELDS,
  TRANSFORM_FIELDS,
  CREATE_SCHEMAS,
  MAILLONS,
  type FieldDef,
} from '../../src/constants/filieres';
import { useMaillonContext } from '../../src/hooks/useMaillonContext';
import { useLotStore } from '../../src/stores/lotStore';
import { useAuthStore } from '../../src/stores/authStore';
import type { Lot, LotEventType } from '../../src/types/lotChain';

type ActionType = Exclude<LotEventType, 'CREATE'>;

const TITLES: Record<ActionType, string> = {
  TRANSFER: 'Transférer le lot',
  TRANSFORM: 'Transformer en nouveau lot',
  CONTROL: 'Ajouter un contrôle',
  CONSUME: 'Marquer comme consommé',
  DESTROY: 'Marquer comme détruit',
};

const SUBMIT_LABELS: Record<ActionType, string> = {
  TRANSFER: 'Confirmer le transfert',
  TRANSFORM: 'Créer le lot enfant',
  CONTROL: 'Enregistrer le contrôle',
  CONSUME: 'Confirmer la consommation',
  DESTROY: 'Confirmer la destruction',
};

function fieldsFor(action: ActionType): FieldDef[] {
  switch (action) {
    case 'TRANSFER': return TRANSFER_FIELDS;
    case 'TRANSFORM': return TRANSFORM_FIELDS;
    case 'CONTROL': return CONTROL_FIELDS;
    case 'CONSUME': return CONSUME_FIELDS;
    case 'DESTROY': return DESTROY_FIELDS;
  }
}

/**
 * Écran unifié pour tous les events non-CREATE sur un lot existant.
 * Routage : /lot/action?code=XXXX&type=TRANSFORM
 *
 * - TRANSFER : ajoute un event TRANSFER (le scan du QR par le récepteur fera
 *   un nouveau TRANSFER côté entrant — Phase 1 livre la moitié émettrice).
 * - TRANSFORM : crée un nouveau lot enfant lié au parent, type d'event
 *   TRANSFORM côté parent + CREATE côté enfant. Pour Phase 1 on garde simple :
 *   1 parent → 1 enfant. Multi-parents et multi-enfants viendront ensuite.
 * - CONTROL / CONSUME / DESTROY : pur metadata sur le lot.
 */
export default function LotActionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; type: string }>();
  const code = params.code;
  const action = (params.type as ActionType) || 'CONTROL';

  const { maillon, filiere } = useMaillonContext();
  const { user, establishment } = useAuthStore();
  const { fetchByCode, appendEvent, createLot } = useLotStore();

  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<DynamicFormValues>({});

  // Champs spécifiques TRANSFORM (création de lot enfant).
  const [childName, setChildName] = useState('');
  const [childQty, setChildQty] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!code) return;
      const l = await fetchByCode(code);
      if (active) {
        setLot(l);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [code, fetchByCode]);

  const fields = useMemo(() => fieldsFor(action), [action]);

  const canSubmit = useMemo(() => {
    for (const f of fields) {
      if (f.required && !values[f.key]) return false;
    }
    if (action === 'TRANSFORM' && !childName.trim()) return false;
    return true;
  }, [fields, values, action, childName]);

  const submit = useCallback(async () => {
    if (!canSubmit || !user || !establishment || !lot) return;
    setSubmitting(true);
    try {
      const cleanPayload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v != null && v !== '') cleanPayload[k] = v;
      }

      if (action === 'TRANSFORM') {
        // 1) Créer le lot enfant (event CREATE sur le nouveau).
        const child = await createLot({
          filiere,
          maillonOrigin: maillon,
          productName: childName.trim(),
          unit: lot.unit ?? undefined,
          quantity: childQty ? Number(childQty.replace(',', '.')) : undefined,
          actorId: user.id,
          establishmentId: establishment.id,
          payload: {
            ...cleanPayload,
            parent_lot_codes: [lot.lot_code],
          },
        });
        // 2) Append TRANSFORM event côté parent + lien parent->enfant.
        await appendEvent({
          lotId: lot.id,
          type: 'TRANSFORM',
          actorId: user.id,
          actorMaillon: maillon,
          establishmentId: establishment.id,
          payload: {
            ...cleanPayload,
            child_lot_code: child.lot_code,
            child_product_name: child.product_name,
          },
          parentLotIds: [lot.id],
        });
        router.replace(`/lot/${child.lot_code}`);
        return;
      }

      // TRANSFER / CONTROL / CONSUME / DESTROY : append simple
      const transferPayload =
        action === 'TRANSFER'
          ? { from_maillon: maillon, to_maillon: maillon, ...cleanPayload }
          : cleanPayload;

      await appendEvent({
        lotId: lot.id,
        type: action,
        actorId: user.id,
        actorMaillon: maillon,
        establishmentId: establishment.id,
        payload: transferPayload,
      });
      router.replace(`/lot/${lot.lot_code}`);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Action impossible');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, user, establishment, lot, values, action, filiere, maillon, createLot, appendEvent, childName, childQty, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="…" showBack onBack={() => router.back()} />
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!lot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Lot introuvable" showBack onBack={() => router.back()} />
        <View style={styles.center}>
          <Text variant="body">Code : {code}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const childSchema = CREATE_SCHEMAS[filiere] ?? CREATE_SCHEMAS.autre!;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title={TITLES[action]}
        subtitle={`${lot.product_name} · ${lot.lot_code}`}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {action === 'TRANSFORM' ? (
          <Card style={styles.card}>
            <Text variant="h3">Lot enfant</Text>
            <View style={styles.field}>
              <Text variant="caption" color={Colors.textSecondary}>{childSchema.productNameLabel} *</Text>
              <Input value={childName} onChangeText={setChildName} placeholder={childSchema.productNamePlaceholder} />
            </View>
            <View style={styles.field}>
              <Text variant="caption" color={Colors.textSecondary}>Quantité ({lot.unit || childSchema.defaultUnit})</Text>
              <Input value={childQty} onChangeText={setChildQty} keyboardType="decimal-pad" placeholder="0" />
            </View>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text variant="h3">{action === 'TRANSFORM' ? 'Process' : 'Détails'}</Text>
          <DynamicForm fields={fields} values={values} onChange={setValues} />
        </Card>

        {action === 'CONSUME' || action === 'DESTROY' ? (
          <Card style={styles.warnCard}>
            <Text variant="body" color={Colors.warning}>
              Cette action est définitive : le lot ne pourra plus recevoir d'événement après confirmation.
            </Text>
          </Card>
        ) : null}

        <Button
          title={submitting ? 'En cours…' : SUBMIT_LABELS[action]}
          onPress={submit}
          disabled={!canSubmit || submitting}
          loading={submitting}
          variant={action === 'DESTROY' ? 'danger' : 'primary'}
          fullWidth
        />

        <Text variant="caption" color={Colors.textSecondary} style={styles.signedAs}>
          Signé en tant que {MAILLONS[maillon].label}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 16 },
  card: { padding: 16, gap: 12 },
  warnCard: { padding: 16, backgroundColor: '#FFF8E1' },
  field: { gap: 6 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  signedAs: { textAlign: 'center', marginTop: 8 },
});
