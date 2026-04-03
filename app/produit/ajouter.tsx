import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { Scan } from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Header } from '../../src/components/ui/Header';
import { FormField } from '../../src/components/forms/FormField';
import { FormPicker } from '../../src/components/forms/FormPicker';
import { FormDatePicker } from '../../src/components/forms/FormDatePicker';
import { CameraOverlay } from '../../src/components/camera/CameraOverlay';
import { Colors } from '../../src/constants/colors';
import { useTraceabilityStore } from '../../src/stores/traceabilityStore';
import { useSupplierStore } from '../../src/stores/supplierStore';
import { useAuthStore } from '../../src/stores/authStore';
import {
  recognizeText,
  extractDateFromText,
  extractLotNumber,
} from '../../src/services/ocr';

interface ProductFormValues {
  productName: string;
  category: string;
  dlc: Date | undefined;
  lotNumber: string;
  supplierId: string;
}

const CATEGORY_OPTIONS = [
  { label: 'Viande', value: 'viande' },
  { label: 'Volaille', value: 'volaille' },
  { label: 'Poisson', value: 'poisson' },
  { label: 'Legumes', value: 'legumes' },
  { label: 'Laitier', value: 'laitier' },
  { label: 'Surgele', value: 'surgele' },
  { label: 'Sec', value: 'sec' },
  { label: 'Fait maison', value: 'fait_maison' },
  { label: 'Autre', value: 'autre' },
];

export default function AjouterProduitScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();
  const { suppliers } = useSupplierStore();
  const traceStore = useTraceabilityStore();

  const [showCamera, setShowCamera] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    dlc: Date | null;
    lot: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit, setValue, watch, formState } = useForm<ProductFormValues>({
    defaultValues: {
      productName: '',
      category: '',
      dlc: undefined,
      lotNumber: '',
      supplierId: '',
    },
  });

  const supplierOptions = suppliers.map((s) => ({
    label: s.name,
    value: s.id,
  }));

  const handleOcrCapture = useCallback(
    async (uri: string) => {
      setShowCamera(false);
      setOcrProcessing(true);
      try {
        const rawText = await recognizeText(uri);
        const dlcResult = extractDateFromText(rawText);
        const lotResult = extractLotNumber(rawText);

        setOcrResult({ dlc: dlcResult, lot: lotResult });

        if (dlcResult) {
          setValue('dlc', dlcResult);
        }
        if (lotResult) {
          setValue('lotNumber', lotResult);
        }
      } catch {
        // OCR failed silently
      } finally {
        setOcrProcessing(false);
      }
    },
    [setValue],
  );

  const onSubmit = useCallback(
    async (data: ProductFormValues) => {
      if (!establishment?.id) return;
      setSaving(true);
      try {
        await traceStore.addProduct({
          establishment_id: establishment.id,
          product_name: data.productName,
          category: data.category || null,
          dlc_primary: data.dlc ? data.dlc.toISOString().split('T')[0] : null,
          lot_number: data.lotNumber || null,
          supplier_id: data.supplierId || null,
          status: 'in_stock',
        });
        router.back();
      } catch {
        // Save failed
      } finally {
        setSaving(false);
      }
    },
    [establishment?.id, traceStore, router],
  );

  if (showCamera) {
    return (
      <CameraOverlay
        onCapture={handleOcrCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  if (ocrProcessing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text variant="h2" style={styles.processingText}>
            Analyse de l'etiquette...
          </Text>
          <Text variant="body" color={Colors.textSecondary}>
            Extraction DLC et numero de lot
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Ajouter un produit" showBack onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <FormField
          control={control}
          name="productName"
          label="Nom du produit"
          placeholder="Ex: Filet de boeuf"
          rules={{ required: 'Le nom du produit est requis' }}
        />

        <FormPicker
          control={control}
          name="category"
          label="Categorie"
          options={CATEGORY_OPTIONS}
          placeholder="Selectionner une categorie..."
        />

        <FormDatePicker
          control={control}
          name="dlc"
          label="DLC"
          rules={{ required: 'La DLC est requise' }}
          minimumDate={new Date()}
        />

        <FormField
          control={control}
          name="lotNumber"
          label="Numero de lot"
          placeholder="Ex: L20260401"
        />

        {supplierOptions.length > 0 && (
          <FormPicker
            control={control}
            name="supplierId"
            label="Fournisseur"
            options={supplierOptions}
            placeholder="Selectionner un fournisseur..."
          />
        )}

        {/* OCR scan button */}
        <Button
          title="Scanner l'etiquette"
          onPress={() => setShowCamera(true)}
          variant="outline"
          size="lg"
          fullWidth
          icon={<Scan size={18} color={Colors.primary} />}
        />

        {ocrResult && (
          <View style={styles.ocrResultContainer}>
            {ocrResult.dlc && (
              <Badge
                text={`DLC detectee: ${ocrResult.dlc.getDate().toString().padStart(2, '0')}/${(ocrResult.dlc.getMonth() + 1).toString().padStart(2, '0')}/${ocrResult.dlc.getFullYear()}`}
                variant="success"
              />
            )}
            {ocrResult.lot && (
              <Badge text={`Lot detecte: ${ocrResult.lot}`} variant="success" />
            )}
            {!ocrResult.dlc && !ocrResult.lot && (
              <Badge text="Aucune information detectee" variant="warning" />
            )}
          </View>
        )}

        <View style={styles.spacer} />

        <Button
          title="Enregistrer le produit"
          onPress={handleSubmit(onSubmit)}
          variant="primary"
          size="lg"
          fullWidth
          loading={saving}
          disabled={saving}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  processingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  processingText: {
    marginTop: 8,
  },
  ocrResultContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  spacer: {
    height: 24,
  },
});
