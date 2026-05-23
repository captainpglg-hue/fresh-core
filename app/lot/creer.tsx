import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { DynamicForm, type DynamicFormValues } from '../../src/components/forms/DynamicForm';
import { CREATE_SCHEMAS, MAILLONS } from '../../src/constants/filieres';
import { useMaillonContext } from '../../src/hooks/useMaillonContext';
import { useLotStore } from '../../src/stores/lotStore';
import { useAuthStore } from '../../src/stores/authStore';

/**
 * Création d'un lot par un maillon source. Pour Phase 1, on utilise la
 * filière du maillon courant (résolue via useMaillonContext) ; en Phase 3
 * l'onboarding adaptatif aura déjà fixé filière + maillon dans le profil.
 *
 * Le formulaire est entièrement piloté par CREATE_SCHEMAS[filiere] — chaque
 * filière a ses champs métier (zone FAO, ID animal, variété, cépage, ...).
 */
export default function CreerLotScreen() {
  const router = useRouter();
  const { filiere, maillon, filiereConfig, maillonConfig } = useMaillonContext();
  const { user, establishment } = useAuthStore();
  const { createLot } = useLotStore();

  const schema = CREATE_SCHEMAS[filiere] ?? CREATE_SCHEMAS.autre!;
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(schema.defaultUnit);
  const [values, setValues] = useState<DynamicFormValues>({});
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    if (!productName.trim()) return false;
    for (const f of schema.fields) {
      if (f.required && !values[f.key]) return false;
    }
    return true;
  }, [productName, schema.fields, values]);

  const sourceNotAllowed = !maillonConfig.canCreate;

  const submit = useCallback(async () => {
    if (!canSubmit || !user || !establishment) return;
    setSubmitting(true);
    try {
      const cleanPayload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v != null && v !== '') cleanPayload[k] = v;
      }

      const lot = await createLot({
        filiere,
        maillonOrigin: maillon,
        productName: productName.trim(),
        unit,
        quantity: quantity ? Number(quantity.replace(',', '.')) : undefined,
        actorId: user.id,
        establishmentId: establishment.id,
        payload: cleanPayload,
      });

      router.replace(`/lot/${lot.lot_code}`);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Création impossible');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, user, establishment, values, createLot, filiere, maillon, productName, unit, quantity, router]);

  if (sourceNotAllowed) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Nouveau lot" showBack onBack={() => router.back()} />
        <View style={styles.empty}>
          <Text variant="h3">Création de lot indisponible</Text>
          <Text variant="body" color={Colors.textSecondary} style={styles.center}>
            Le maillon {MAILLONS[maillon].label} ne peut pas créer un nouveau lot à la source. Tu peux scanner un lot existant (réception) puis y ajouter un événement de transformation, contrôle, ou transfert.
          </Text>
          <Button title="Scanner un lot" onPress={() => router.push('/lot/scanner')} fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Nouveau lot" subtitle={`${filiereConfig.label} · ${MAILLONS[maillon].label}`} showBack onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Text variant="h3" style={styles.section}>Produit</Text>
          <View style={styles.field}>
            <Text variant="caption" style={styles.fieldLabel}>{schema.productNameLabel} *</Text>
            <Input value={productName} onChangeText={setProductName} placeholder={schema.productNamePlaceholder} />
          </View>
          <View style={styles.qtyRow}>
            <View style={styles.qtyAmount}>
              <Text variant="caption" style={styles.fieldLabel}>Quantité</Text>
              <Input value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="0" />
            </View>
            <View style={styles.qtyUnit}>
              <Text variant="caption" style={styles.fieldLabel}>Unité</Text>
              <DynamicForm
                fields={[{ key: 'unit', label: '', type: 'select', options: schema.unitOptions }]}
                values={{ unit }}
                onChange={(v) => setUnit((v.unit as string) || schema.defaultUnit)}
              />
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text variant="h3" style={styles.section}>Traçabilité {filiereConfig.shortLabel}</Text>
          <DynamicForm fields={schema.fields} values={values} onChange={setValues} />
        </Card>

        <Button
          title={submitting ? 'Création…' : 'Créer le lot et générer le QR'}
          onPress={submit}
          disabled={!canSubmit || submitting}
          loading={submitting}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 16 },
  card: { padding: 16, gap: 12 },
  section: {},
  field: { gap: 6 },
  fieldLabel: { color: Colors.textSecondary },
  qtyRow: { flexDirection: 'row', gap: 12 },
  qtyAmount: { flex: 1 },
  qtyUnit: { flex: 1 },
  empty: { padding: 24, gap: 16, justifyContent: 'center', alignItems: 'center', flex: 1 },
  center: { textAlign: 'center' },
});
