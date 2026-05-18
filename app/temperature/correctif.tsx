import React, { useState, useCallback } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Camera } from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Header } from '../../src/components/ui/Header';
import { FormField } from '../../src/components/forms/FormField';
import { FormPicker } from '../../src/components/forms/FormPicker';
import { CameraScreen } from '../../src/components/camera/CameraScreen';
import { Colors } from '../../src/constants/colors';
import { THRESHOLDS } from '../../src/constants/thresholds';
import { useTemperatureStore } from '../../src/stores/temperatureStore';
import { useAuthStore } from '../../src/stores/authStore';

const CORRECTIVE_OPTIONS = [
  {
    label: 'Transfert des produits vers un equipement conforme',
    value: 'transfert_produits',
  },
  {
    label: 'Reglage du thermostat',
    value: 'reglage_thermostat',
  },
  {
    label: 'Alerte maintenance — equipement defaillant',
    value: 'alerte_maintenance',
  },
  {
    label: 'Refroidissement rapide des produits',
    value: 'refroidissement_rapide',
  },
  {
    label: 'Destruction des produits a risque',
    value: 'destruction_produits',
  },
  {
    label: 'Autre action (preciser)',
    value: 'autre',
  },
];

const correctiveSchema = z.object({
  action: z.string().min(1, 'Veuillez choisir une action corrective'),
  details: z.string().optional(),
});

type CorrectiveFormData = z.infer<typeof correctiveSchema>;

export default function CorrectifScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    equipmentId: string;
    equipmentName: string;
    temperature: string;
    threshold: string;
    thresholdType: string;
  }>();

  const temperature = parseFloat(params.temperature || '0');
  const equipmentId = params.equipmentId ?? '';
  const equipmentName = params.equipmentName ?? 'Equipement';
  const thresholdValue = params.threshold ?? '';
  const thresholdType = params.thresholdType ?? '';

  const thresholdConfig = THRESHOLDS[thresholdType];
  const thresholdDisplay =
    thresholdConfig?.max !== undefined
      ? `Max ${thresholdConfig.max}°C`
      : thresholdConfig?.min !== undefined
        ? `Min ${thresholdConfig.min}°C`
        : thresholdValue
          ? `${thresholdValue}°C`
          : 'Non defini';

  const { addReading } = useTemperatureStore();
  const { establishment, user } = useAuthStore();

  const [showCamera, setShowCamera] = useState(false);
  const [proofPhotoUri, setProofPhotoUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { control, handleSubmit, watch, formState } =
    useForm<CorrectiveFormData>({
      resolver: zodResolver(correctiveSchema),
      defaultValues: {
        action: '',
        details: '',
      },
    });

  const selectedAction = watch('action');

  const handleCaptureProof = useCallback((uri: string) => {
    setProofPhotoUri(uri);
    setShowCamera(false);
  }, []);

  const onSubmit = useCallback(
    async (data: CorrectiveFormData) => {
      if (!establishment) return;

      setIsSaving(true);
      try {
        const actionLabel =
          CORRECTIVE_OPTIONS.find((o) => o.value === data.action)?.label ??
          data.action;

        const fullAction = data.details
          ? `${actionLabel} — ${data.details}`
          : actionLabel;

        await addReading({
          establishment_id: establishment.id,
          equipment_id: equipmentId,
          temperature_value: temperature,
          threshold_min: thresholdConfig?.min ?? null,
          threshold_max: thresholdConfig?.max ?? null,
          is_compliant: false,
          ocr_confidence: null,
          manual_entry: false,
          photo_path: null,
          reading_type: 'corrective',
          corrective_action: fullAction,
          corrective_action_photo_path: proofPhotoUri,
          recorded_by: user?.id ?? null,
          recorded_at: new Date().toISOString(),
        });

        Alert.alert(
          'Action enregistree',
          'L\'action corrective a ete sauvegardee avec succes.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to temperatures list
                router.dismiss(2);
              },
            },
          ],
        );
      } catch {
        Alert.alert(
          'Erreur',
          'Impossible de sauvegarder l\'action corrective. Veuillez reessayer.',
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      establishment,
      user,
      equipmentId,
      temperature,
      thresholdConfig,
      proofPhotoUri,
      addReading,
      router,
    ],
  );

  // -------------------------------------------------------
  // Camera mode for proof photo
  // -------------------------------------------------------
  if (showCamera) {
    return (
      <CameraScreen
        onCapture={handleCaptureProof}
        onClose={() => setShowCamera(false)}
        guidanceText="Prenez une photo de la preuve de l'action corrective"
        showGuideRect={false}
      />
    );
  }

  // -------------------------------------------------------
  // Main form screen
  // -------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Action corrective"
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.dangerBanner}>
        <AlertTriangle size={20} color={Colors.white} />
        <Text variant="body" color={Colors.white} style={styles.dangerText}>
          Action corrective requise
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Alert Card */}
        <Card variant="alert" style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Text variant="caption" color={Colors.textSecondary}>
              {equipmentName}
            </Text>
            <Badge text="HORS SEUIL" variant="danger" />
          </View>

          <View style={styles.alertMetrics}>
            <View style={styles.metricBox}>
              <Text variant="caption" color={Colors.textSecondary}>
                Temperature relevee
              </Text>
              <Text variant="h1" color={Colors.danger}>
                {temperature.toFixed(1)}°C
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBox}>
              <Text variant="caption" color={Colors.textSecondary}>
                Seuil reglementaire
              </Text>
              <Text variant="h2" color={Colors.textPrimary}>
                {thresholdDisplay}
              </Text>
            </View>
          </View>
        </Card>

        {/* Corrective action picker */}
        <View style={styles.formSection}>
          <FormPicker
            control={control}
            name="action"
            label="Action entreprise"
            placeholder="Selectionnez une action..."
            options={CORRECTIVE_OPTIONS}
            rules={{ required: 'Veuillez choisir une action' }}
          />

          {/* Show details field, especially important for "Autre" */}
          <FormField
            control={control}
            name="details"
            label="Details complementaires"
            placeholder={
              selectedAction === 'autre'
                ? 'Preciser l\'action entreprise...'
                : 'Informations supplementaires (optionnel)'
            }
            multiline
            rules={
              selectedAction === 'autre'
                ? { required: 'Veuillez preciser l\'action' }
                : undefined
            }
          />
        </View>

        {/* Photo proof section */}
        <View style={styles.formSection}>
          <Text variant="h3" style={styles.sectionTitle}>
            Photo preuve
          </Text>
          <Text
            variant="caption"
            color={Colors.textSecondary}
            style={styles.sectionSubtitle}
          >
            Photographiez la preuve de l&apos;action corrective (optionnel)
          </Text>

          {proofPhotoUri ? (
            <View style={styles.photoPreviewContainer}>
              <Image
                source={{ uri: proofPhotoUri }}
                style={styles.photoThumbnail}
                resizeMode="cover"
              />
              <View style={styles.photoActions}>
                <Badge text="Photo prise" variant="success" />
                <Button
                  title="Reprendre"
                  onPress={() => setShowCamera(true)}
                  variant="ghost"
                  size="sm"
                />
              </View>
            </View>
          ) : (
            <Button
              title="Prendre photo preuve"
              onPress={() => setShowCamera(true)}
              variant="outline"
              size="md"
              icon={<Camera size={18} color={Colors.primary} />}
            />
          )}
        </View>

        {/* Submit button */}
        <View style={styles.submitSection}>
          <Button
            title="Valider l'action corrective"
            onPress={handleSubmit(onSubmit)}
            variant="primary"
            size="lg"
            fullWidth
            loading={isSaving}
            disabled={!formState.isValid || isSaving}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  dangerBanner: {
    backgroundColor: Colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  dangerText: {
    fontWeight: '700',
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Alert card
  alertCard: {
    margin: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBox: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 48,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  // Form sections
  formSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  sectionSubtitle: {
    marginBottom: 12,
  },
  // Photo proof
  photoPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoThumbnail: {
    width: 100,
    height: 75,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  photoActions: {
    flex: 1,
    gap: 8,
    alignItems: 'flex-start',
  },
  // Submit
  submitSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
});
