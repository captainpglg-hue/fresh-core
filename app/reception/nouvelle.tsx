import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { Plus, Thermometer, Calendar, AlertTriangle } from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Input } from '../../src/components/ui/Input';
import { Header } from '../../src/components/ui/Header';
import { FormField } from '../../src/components/forms/FormField';
import { FormPicker } from '../../src/components/forms/FormPicker';
import { FormDatePicker } from '../../src/components/forms/FormDatePicker';
import { CameraOverlay } from '../../src/components/camera/CameraOverlay';
import { Colors } from '../../src/constants/colors';
import { isCompliant } from '../../src/constants/thresholds';
import { useDeliveryStore } from '../../src/stores/deliveryStore';
import { useSupplierStore } from '../../src/stores/supplierStore';
import { useAuthStore } from '../../src/stores/authStore';
import {
  extractTemperatureFromText,
  extractDateFromText,
  recognizeText,
  extractLotNumber,
} from '../../src/services/ocr';

// ── Types ──────────────────────────────────────────────────────────────────

interface SupplierFormValues {
  existingSupplierId: string;
  name: string;
  sanitaryApproval: string;
  sanitaryApprovalExpiry: Date | undefined;
  phone: string;
  email: string;
}

interface RefusalFormValues {
  motif: string;
  motifDetail: string;
}

interface DeliveryItemForm {
  id: string;
  productName: string;
  category: string;
  temperature: number | null;
  temperaturePhotoUri: string | null;
  temperatureCompliant: boolean | null;
  ocrConfidence: number | null;
  dlc: Date | null;
  dlcRaw: string;
  lotNumber: string;
  packagingOk: boolean | null;
  visualOk: boolean | null;
}

type CameraTarget =
  | { type: 'deliveryNote' }
  | { type: 'temperature'; itemIndex: number }
  | { type: 'dlc'; itemIndex: number }
  | { type: 'refusal' };

const CATEGORY_OPTIONS = [
  { label: 'Viande', value: 'viande' },
  { label: 'Volaille', value: 'volaille' },
  { label: 'Poisson', value: 'poisson' },
  { label: 'Legumes', value: 'legumes' },
  { label: 'Laitier', value: 'laitier' },
  { label: 'Surgele', value: 'surgele' },
  { label: 'Sec', value: 'sec' },
  { label: 'Autre', value: 'autre' },
];

const REFUSAL_MOTIFS = [
  { label: 'Temperature non conforme', value: 'temperature' },
  { label: 'DLC depassee', value: 'dlc' },
  { label: 'Emballage endommage', value: 'emballage' },
  { label: 'Aspect visuel non conforme', value: 'visuel' },
  { label: 'Produit manquant', value: 'manquant' },
  { label: 'Autre', value: 'autre' },
];

function getThresholdTypeForCategory(category: string): string {
  switch (category) {
    case 'viande':
    case 'poisson':
    case 'laitier':
      return 'cold_positive';
    case 'volaille':
      return 'cold_positive';
    case 'legumes':
      return 'cold_positive_veg';
    case 'surgele':
      return 'cold_negative';
    default:
      return 'cold_positive';
  }
}

function createEmptyItem(id: string): DeliveryItemForm {
  return {
    id,
    productName: '',
    category: '',
    temperature: null,
    temperaturePhotoUri: null,
    temperatureCompliant: null,
    ocrConfidence: null,
    dlc: null,
    dlcRaw: '',
    lotNumber: '',
    packagingOk: null,
    visualOk: null,
  };
}

// ── Step Indicator ─────────────────────────────────────────────────────────

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  return (
    <View style={stepStyles.container}>
      <View style={stepStyles.row}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          const bgColor = isActive
            ? Colors.primary
            : isCompleted
              ? Colors.primaryLight
              : Colors.border;
          const textColor = isActive || isCompleted ? Colors.white : Colors.textSecondary;

          return (
            <React.Fragment key={stepNum}>
              {i > 0 && (
                <View
                  style={[
                    stepStyles.line,
                    { backgroundColor: isCompleted ? Colors.primaryLight : Colors.border },
                  ]}
                />
              )}
              <View style={[stepStyles.circle, { backgroundColor: bgColor }]}>
                <Text variant="caption" color={textColor} style={stepStyles.circleText}>
                  {String(stepNum)}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <View style={stepStyles.labelRow}>
        {labels.map((label, i) => (
          <Text
            key={label}
            variant="caption"
            color={i + 1 === currentStep ? Colors.primary : Colors.textSecondary}
            style={stepStyles.label}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: { paddingVertical: 16, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleText: { fontWeight: '700', fontSize: 14 },
  line: { flex: 1, height: 2, marginHorizontal: 4 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  label: { flex: 1, textAlign: 'center', fontSize: 11 },
});

// ── Product Item Component ─────────────────────────────────────────────────

interface ProductItemCardProps {
  item: DeliveryItemForm;
  index: number;
  onUpdate: (index: number, updates: Partial<DeliveryItemForm>) => void;
  onTakeTemperature: (index: number) => void;
  onScanDLC: (index: number) => void;
}

function ProductItemCard({
  item,
  index,
  onUpdate,
  onTakeTemperature,
  onScanDLC,
}: ProductItemCardProps) {
  const [showManualDlc, setShowManualDlc] = useState(!item.dlc);
  const dlcForm = useForm<{ dlc: Date | undefined }>({
    defaultValues: { dlc: item.dlc ?? undefined },
  });

  return (
    <Card style={styles.productCard}>
      <Text variant="h3" style={styles.productCardTitle}>
        Produit {index + 1}
      </Text>

      <Input
        label="Nom du produit"
        value={item.productName}
        onChangeText={(val) => onUpdate(index, { productName: val })}
        placeholder="Ex: Filet de poulet"
      />

      {/* Category chips */}
      <Text variant="caption" color={Colors.primary} style={styles.fieldLabel}>
        Categorie
      </Text>
      <View style={styles.categoryGrid}>
        {CATEGORY_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[
              styles.categoryChip,
              item.category === opt.value && styles.categoryChipSelected,
            ]}
            onPress={() => onUpdate(index, { category: opt.value })}
          >
            <Text
              variant="caption"
              color={item.category === opt.value ? Colors.white : Colors.textPrimary}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Temperature */}
      <View style={styles.inlineRow}>
        <Button
          title="Prendre temperature"
          onPress={() => onTakeTemperature(index)}
          variant="outline"
          size="sm"
          icon={<Thermometer size={16} color={Colors.primary} />}
        />
        {item.temperature !== null && (
          <Badge
            text={`${item.temperature.toFixed(1)}°C`}
            variant={item.temperatureCompliant ? 'success' : 'danger'}
          />
        )}
        {item.ocrConfidence !== null && item.ocrConfidence < 0.85 && (
          <Badge text="Faible confiance" variant="warning" />
        )}
      </View>

      {/* DLC */}
      <View style={styles.inlineRow}>
        <Button
          title="Scanner DLC"
          onPress={() => onScanDLC(index)}
          variant="outline"
          size="sm"
          icon={<Calendar size={16} color={Colors.primary} />}
        />
        {item.dlcRaw ? <Badge text={`DLC: ${item.dlcRaw}`} variant="info" /> : null}
      </View>

      {showManualDlc && !item.dlc && (
        <FormDatePicker
          control={dlcForm.control}
          name="dlc"
          label="DLC (manuelle)"
        />
      )}

      <Input
        label="N° de lot"
        value={item.lotNumber}
        onChangeText={(val) => onUpdate(index, { lotNumber: val })}
        placeholder="Ex: L20260401"
      />

      {/* Emballage toggle */}
      <View style={styles.toggleRow}>
        <Text variant="body" style={styles.toggleLabel}>
          Emballage
        </Text>
        <View style={styles.toggleButtons}>
          <Pressable
            style={[styles.toggleBtn, item.packagingOk === true && styles.toggleBtnOk]}
            onPress={() => onUpdate(index, { packagingOk: true })}
          >
            <Text
              variant="caption"
              color={item.packagingOk === true ? Colors.white : Colors.success}
            >
              OK
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, item.packagingOk === false && styles.toggleBtnBad]}
            onPress={() => onUpdate(index, { packagingOk: false })}
          >
            <Text
              variant="caption"
              color={item.packagingOk === false ? Colors.white : Colors.danger}
            >
              Defaut
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Aspect visuel toggle */}
      <View style={styles.toggleRow}>
        <Text variant="body" style={styles.toggleLabel}>
          Aspect visuel
        </Text>
        <View style={styles.toggleButtons}>
          <Pressable
            style={[styles.toggleBtn, item.visualOk === true && styles.toggleBtnOk]}
            onPress={() => onUpdate(index, { visualOk: true })}
          >
            <Text
              variant="caption"
              color={item.visualOk === true ? Colors.white : Colors.success}
            >
              OK
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, item.visualOk === false && styles.toggleBtnBad]}
            onPress={() => onUpdate(index, { visualOk: false })}
          >
            <Text
              variant="caption"
              color={item.visualOk === false ? Colors.white : Colors.danger}
            >
              Defaut
            </Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function NouvelleReceptionScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();
  const { suppliers, addSupplier, loadSuppliers, checkSanitaryApproval } =
    useSupplierStore();
  const { startDelivery, addItem, validateDelivery, refuseDelivery } =
    useDeliveryStore();

  const [step, setStep] = useState(1);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  // Delivery note
  const [notePhotoUri, setNotePhotoUri] = useState<string | null>(null);

  // Camera
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({ type: 'deliveryNote' });
  const [ocrProcessing, setOcrProcessing] = useState(false);

  // Products
  const [items, setItems] = useState<DeliveryItemForm[]>([createEmptyItem('1')]);
  const [nextItemId, setNextItemId] = useState(2);

  // Refusal
  const [showRefusal, setShowRefusal] = useState(false);
  const [refusalPhotoUri, setRefusalPhotoUri] = useState<string | null>(null);

  // Forms
  const supplierForm = useForm<SupplierFormValues>({
    defaultValues: {
      existingSupplierId: '',
      name: '',
      sanitaryApproval: '',
      sanitaryApprovalExpiry: undefined,
      phone: '',
      email: '',
    },
  });

  const refusalForm = useForm<RefusalFormValues>({
    defaultValues: { motif: '', motifDetail: '' },
  });

  useEffect(() => {
    if (establishment?.id) {
      loadSuppliers(establishment.id);
    }
  }, [establishment?.id, loadSuppliers]);

  // ── Camera handling ────────────────────────────────────────────────────

  const handleCameraCapture = useCallback(
    async (uri: string) => {
      setShowCamera(false);

      if (cameraTarget.type === 'deliveryNote') {
        setNotePhotoUri(uri);
        return;
      }

      if (cameraTarget.type === 'refusal') {
        setRefusalPhotoUri(uri);
        return;
      }

      if (cameraTarget.type === 'temperature') {
        setOcrProcessing(true);
        try {
          const rawText = await recognizeText(uri);
          const tempResult = extractTemperatureFromText(rawText);
          setItems((prev) =>
            prev.map((item, idx) => {
              if (idx !== cameraTarget.itemIndex) return item;
              const thresholdType = getThresholdTypeForCategory(item.category);
              const compliant =
                tempResult !== null ? isCompliant(tempResult.value, thresholdType) : null;
              return {
                ...item,
                temperature: tempResult?.value ?? null,
                temperaturePhotoUri: uri,
                temperatureCompliant: compliant,
                ocrConfidence: tempResult?.confidence ?? null,
              };
            }),
          );
        } catch {
          setItems((prev) =>
            prev.map((item, idx) =>
              idx === cameraTarget.itemIndex
                ? { ...item, temperaturePhotoUri: uri, temperature: null }
                : item,
            ),
          );
        } finally {
          setOcrProcessing(false);
        }
        return;
      }

      if (cameraTarget.type === 'dlc') {
        setOcrProcessing(true);
        try {
          const rawText = await recognizeText(uri);
          const dateResult = extractDateFromText(rawText);
          const lotResult = extractLotNumber(rawText);
          setItems((prev) =>
            prev.map((item, idx) => {
              if (idx !== cameraTarget.itemIndex) return item;
              return {
                ...item,
                dlc: dateResult,
                dlcRaw: dateResult
                  ? `${dateResult.getDate().toString().padStart(2, '0')}/${(dateResult.getMonth() + 1).toString().padStart(2, '0')}/${dateResult.getFullYear()}`
                  : '',
                lotNumber: lotResult ?? item.lotNumber,
              };
            }),
          );
        } catch {
          // OCR failed silently
        } finally {
          setOcrProcessing(false);
        }
        return;
      }
    },
    [cameraTarget],
  );

  // ── Step 1 handlers ──────────────────────────────────────────────────

  const handleSelectExistingSupplier = useCallback(() => {
    const suppId = supplierForm.getValues('existingSupplierId');
    if (!suppId || !establishment?.id) return;
    setSelectedSupplierId(suppId);
    startDelivery(suppId, establishment.id);
    setStep(2);
  }, [supplierForm, establishment?.id, startDelivery]);

  const handleCreateSupplier = useCallback(async () => {
    const values = supplierForm.getValues();
    if (!values.name || !establishment?.id) return;
    const id = await addSupplier({
      name: values.name,
      establishment_id: establishment.id,
      sanitary_approval: values.sanitaryApproval || null,
      sanitary_approval_expiry: values.sanitaryApprovalExpiry
        ? values.sanitaryApprovalExpiry.toISOString().split('T')[0]
        : null,
      contact_phone: values.phone || null,
      contact_email: values.email || null,
    });
    setSelectedSupplierId(id);
    startDelivery(id, establishment.id);
    setStep(2);
  }, [supplierForm, establishment?.id, addSupplier, startDelivery]);

  // ── Step 3: item management ──────────────────────────────────────────

  const updateItem = useCallback(
    (index: number, updates: Partial<DeliveryItemForm>) => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  const addNewItem = useCallback(() => {
    const id = String(nextItemId);
    setNextItemId((prev) => prev + 1);
    setItems((prev) => [...prev, createEmptyItem(id)]);
  }, [nextItemId]);

  const handleTakeTemperature = useCallback((index: number) => {
    setCameraTarget({ type: 'temperature', itemIndex: index });
    setShowCamera(true);
  }, []);

  const handleScanDLC = useCallback((index: number) => {
    setCameraTarget({ type: 'dlc', itemIndex: index });
    setShowCamera(true);
  }, []);

  // ── Step 4: validation ───────────────────────────────────────────────

  const handleAccept = useCallback(async () => {
    for (const item of items) {
      if (!item.productName) continue;
      addItem({
        product_name: item.productName,
        category: item.category || null,
        temperature: item.temperature,
        temperature_compliant: item.temperatureCompliant ?? undefined,
        dlc: item.dlc ? item.dlc.toISOString().split('T')[0] : undefined,
        lot_number: item.lotNumber || undefined,
        packaging_ok: item.packagingOk ?? true,
        visual_ok: item.visualOk ?? true,
      });
    }
    await validateDelivery();
    router.back();
  }, [items, addItem, validateDelivery, router]);

  const handleRefuse = useCallback(async () => {
    const values = refusalForm.getValues();
    const reason = `${values.motif}${values.motifDetail ? ' — ' + values.motifDetail : ''}`;
    await refuseDelivery(reason, refusalPhotoUri ?? undefined);
    router.back();
  }, [refusalForm, refusalPhotoUri, refuseDelivery, router]);

  // ── Camera screen ────────────────────────────────────────────────────

  if (showCamera) {
    return (
      <CameraOverlay
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  // ── OCR Processing overlay ───────────────────────────────────────────

  if (ocrProcessing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text variant="h2" style={styles.processingText}>
            Analyse OCR en cours...
          </Text>
          <Text variant="body" color={Colors.textSecondary}>
            Lecture automatique
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Supplier options for picker ──────────────────────────────────────

  const supplierOptions = suppliers.map((s) => ({
    label: s.name,
    value: s.id,
  }));

  const approvalStatus = supplierForm.watch('existingSupplierId')
    ? checkSanitaryApproval(supplierForm.watch('existingSupplierId'))
    : 'valid';

  // ── Conformity stats for step 4 ─────────────────────────────────────

  const validItems = items.filter((i) => i.productName.trim().length > 0);
  const conformeCount = validItems.filter((item) => {
    const tempOk = item.temperatureCompliant !== false;
    const packOk = item.packagingOk !== false;
    const visualOk = item.visualOk !== false;
    return tempOk && packOk && visualOk;
  }).length;

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Nouvelle reception"
        showBack
        onBack={() => {
          if (step > 1) {
            setStep(step - 1);
          } else {
            router.back();
          }
        }}
      />
      <StepIndicator
        currentStep={step}
        totalSteps={4}
        labels={['Fournisseur', 'Bon de livraison', 'Produits', 'Validation']}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── STEP 1: Fournisseur ─────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text variant="h2" style={styles.stepTitle}>
              Fournisseur
            </Text>

            {supplierOptions.length > 0 && (
              <>
                <FormPicker
                  control={supplierForm.control}
                  name="existingSupplierId"
                  label="Selectionner un fournisseur"
                  options={supplierOptions}
                  placeholder="Choisir un fournisseur..."
                />

                {supplierForm.watch('existingSupplierId') !== '' &&
                  approvalStatus === 'expired' && (
                    <View style={styles.alertBanner}>
                      <AlertTriangle size={18} color={Colors.danger} />
                      <Text variant="caption" color={Colors.danger} style={styles.alertText}>
                        Agrement sanitaire expire !
                      </Text>
                    </View>
                  )}

                {supplierForm.watch('existingSupplierId') !== '' &&
                  approvalStatus === 'expiring' && (
                    <View style={styles.warningBanner}>
                      <AlertTriangle size={18} color={Colors.warning} />
                      <Text variant="caption" color={Colors.warning} style={styles.alertText}>
                        Agrement sanitaire bientot expire
                      </Text>
                    </View>
                  )}

                <Button
                  title="Suivant"
                  onPress={handleSelectExistingSupplier}
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!supplierForm.watch('existingSupplierId')}
                />

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text
                    variant="caption"
                    color={Colors.textSecondary}
                    style={styles.dividerText}
                  >
                    ou
                  </Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            <Pressable
              onPress={() => setShowNewSupplier(!showNewSupplier)}
              style={styles.expandableHeader}
            >
              <Text variant="h3" color={Colors.primary}>
                {showNewSupplier ? '- Nouveau fournisseur' : '+ Nouveau fournisseur'}
              </Text>
            </Pressable>

            {showNewSupplier && (
              <Card style={styles.newSupplierCard}>
                <FormField
                  control={supplierForm.control}
                  name="name"
                  label="Raison sociale"
                  rules={{ required: 'Ce champ est requis' }}
                  placeholder="Nom du fournisseur"
                />
                <FormField
                  control={supplierForm.control}
                  name="sanitaryApproval"
                  label="N° agrement sanitaire"
                  placeholder="Ex: FR 75.001.001 CE"
                />
                <FormDatePicker
                  control={supplierForm.control}
                  name="sanitaryApprovalExpiry"
                  label="Date expiration agrement"
                />
                <FormField
                  control={supplierForm.control}
                  name="phone"
                  label="Telephone"
                  placeholder="Ex: 01 23 45 67 89"
                  keyboardType="phone-pad"
                />
                <FormField
                  control={supplierForm.control}
                  name="email"
                  label="Email"
                  placeholder="contact@fournisseur.fr"
                  keyboardType="email-address"
                />

                <Button
                  title="Creer et continuer"
                  onPress={handleCreateSupplier}
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!supplierForm.watch('name')}
                />
              </Card>
            )}
          </View>
        )}

        {/* ── STEP 2: Bon de livraison ────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text variant="h2" style={styles.stepTitle}>
              Bon de livraison
            </Text>
            <Text variant="body" color={Colors.textSecondary} style={styles.stepSubtitle}>
              Photographiez le bon de livraison
            </Text>

            {notePhotoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image
                  source={{ uri: notePhotoUri }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                />
                <Button
                  title="Reprendre"
                  onPress={() => {
                    setNotePhotoUri(null);
                    setCameraTarget({ type: 'deliveryNote' });
                    setShowCamera(true);
                  }}
                  variant="ghost"
                  size="sm"
                />
              </View>
            ) : (
              <Button
                title="Prendre la photo"
                onPress={() => {
                  setCameraTarget({ type: 'deliveryNote' });
                  setShowCamera(true);
                }}
                variant="primary"
                size="lg"
                fullWidth
              />
            )}

            <Button
              title="Continuer sans photo"
              onPress={() => setStep(3)}
              variant="ghost"
              size="md"
            />

            <View style={styles.spacer} />
            <Button
              title="Suivant"
              onPress={() => setStep(3)}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>
        )}

        {/* ── STEP 3: Controle produits ───────────────────────────────── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text variant="h2" style={styles.stepTitle}>
              Controle produits
            </Text>

            {items.map((item, index) => (
              <ProductItemCard
                key={item.id}
                item={item}
                index={index}
                onUpdate={updateItem}
                onTakeTemperature={handleTakeTemperature}
                onScanDLC={handleScanDLC}
              />
            ))}

            <Button
              title="Ajouter un produit"
              onPress={addNewItem}
              variant="outline"
              size="md"
              fullWidth
              icon={<Plus size={16} color={Colors.primary} />}
            />

            <View style={styles.spacer} />
            <Button
              title="Suivant"
              onPress={() => setStep(4)}
              variant="primary"
              size="lg"
              fullWidth
              disabled={items.every((i) => !i.productName)}
            />
          </View>
        )}

        {/* ── STEP 4: Validation ──────────────────────────────────────── */}
        {step === 4 && !showRefusal && (
          <View style={styles.stepContent}>
            <Text variant="h2" style={styles.stepTitle}>
              Validation
            </Text>

            <Card style={styles.statsCard}>
              <Text variant="h1" color={Colors.primary} style={styles.statsNumber}>
                {conformeCount} conforme{conformeCount > 1 ? 's' : ''} sur{' '}
                {validItems.length}
              </Text>
            </Card>

            {validItems.map((item) => {
              const tempOk = item.temperatureCompliant !== false;
              const packOk = item.packagingOk !== false;
              const visualOk = item.visualOk !== false;
              const allOk = tempOk && packOk && visualOk;

              return (
                <Card
                  key={item.id}
                  style={styles.summaryCard}
                  variant={allOk ? 'success' : 'alert'}
                >
                  <Text variant="h3">{item.productName || 'Produit sans nom'}</Text>
                  {item.category ? (
                    <Text variant="caption" color={Colors.textSecondary}>
                      {item.category}
                    </Text>
                  ) : null}
                  <View style={styles.summaryBadges}>
                    {item.temperature !== null && (
                      <Badge
                        text={`${item.temperature.toFixed(1)}°C`}
                        variant={tempOk ? 'success' : 'danger'}
                      />
                    )}
                    <Badge
                      text={packOk ? 'Emb. OK' : 'Emb. KO'}
                      variant={packOk ? 'success' : 'danger'}
                    />
                    <Badge
                      text={visualOk ? 'Visuel OK' : 'Visuel KO'}
                      variant={visualOk ? 'success' : 'danger'}
                    />
                    {item.dlcRaw ? (
                      <Badge text={`DLC: ${item.dlcRaw}`} variant="info" />
                    ) : null}
                    {item.lotNumber ? (
                      <Badge text={`Lot: ${item.lotNumber}`} variant="info" />
                    ) : null}
                  </View>
                </Card>
              );
            })}

            <View style={styles.spacer} />
            <Button
              title="Accepter la livraison"
              onPress={handleAccept}
              variant="primary"
              size="lg"
              fullWidth
            />
            <View style={styles.btnSpacing} />
            <Button
              title="Refuser"
              onPress={() => setShowRefusal(true)}
              variant="danger"
              size="lg"
              fullWidth
            />
          </View>
        )}

        {/* ── Refusal sub-view ────────────────────────────────────────── */}
        {step === 4 && showRefusal && (
          <View style={styles.stepContent}>
            <Text variant="h2" style={styles.stepTitle}>
              Motif de refus
            </Text>

            <FormPicker
              control={refusalForm.control}
              name="motif"
              label="Motif"
              options={REFUSAL_MOTIFS}
              rules={{ required: 'Selectionnez un motif' }}
            />

            <Input
              label="Details supplementaires"
              value={refusalForm.watch('motifDetail')}
              onChangeText={(val) => refusalForm.setValue('motifDetail', val)}
              placeholder="Precision du motif..."
              multiline
            />

            {refusalPhotoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image
                  source={{ uri: refusalPhotoUri }}
                  style={styles.photoPreviewSmall}
                  resizeMode="cover"
                />
                <Button
                  title="Reprendre"
                  onPress={() => {
                    setRefusalPhotoUri(null);
                    setCameraTarget({ type: 'refusal' });
                    setShowCamera(true);
                  }}
                  variant="ghost"
                  size="sm"
                />
              </View>
            ) : (
              <Button
                title="Prendre une photo"
                onPress={() => {
                  setCameraTarget({ type: 'refusal' });
                  setShowCamera(true);
                }}
                variant="outline"
                size="md"
              />
            )}

            <View style={styles.spacer} />
            <Button
              title="Confirmer le refus"
              onPress={handleRefuse}
              variant="danger"
              size="lg"
              fullWidth
              disabled={!refusalForm.watch('motif')}
            />
            <View style={styles.btnSpacing} />
            <Button
              title="Annuler"
              onPress={() => setShowRefusal(false)}
              variant="ghost"
              size="md"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: 40,
  },
  stepContent: {
    paddingHorizontal: 16,
  },
  stepTitle: {
    marginBottom: 8,
  },
  stepSubtitle: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontWeight: '700',
    marginBottom: 6,
  },
  // Alerts
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FECDD3',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2C5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  alertText: {
    flex: 1,
    fontWeight: '600',
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
  },
  // New supplier
  expandableHeader: {
    paddingVertical: 12,
  },
  newSupplierCard: {
    marginBottom: 16,
  },
  // Photo preview
  photoPreviewContainer: {
    marginBottom: 16,
    gap: 8,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  photoPreviewSmall: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  // Products
  productCard: {
    marginBottom: 12,
  },
  productCardTitle: {
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  // Toggle buttons
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleLabel: {
    fontWeight: '600',
  },
  toggleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 70,
    justifyContent: 'center',
  },
  toggleBtnOk: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  toggleBtnBad: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  // Validation
  statsCard: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statsNumber: {
    textAlign: 'center',
  },
  summaryCard: {
    marginBottom: 8,
  },
  summaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  // Processing
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
  // Spacing
  spacer: {
    height: 16,
  },
  btnSpacing: {
    height: 8,
  },
});
