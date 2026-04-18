import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { CameraOverlay } from '../../src/components/camera/CameraOverlay';
import { OCRResultCard } from '../../src/components/camera/OCRResultCard';
import { TemperatureChart } from '../../src/components/charts/TemperatureChart';
import { Colors } from '../../src/constants/colors';
import { THRESHOLDS } from '../../src/constants/thresholds';
import { useTemperatureStore } from '../../src/stores/temperatureStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useOCR } from '../../src/hooks/useOCR';
import type { TemperatureReading, Equipment } from '../../src/types/database';

type Step = 'info' | 'camera' | 'processing' | 'result';

export default function TemperatureEquipmentScreen() {
  const { equipmentId } = useLocalSearchParams<{ equipmentId: string }>();
  const router = useRouter();

  const { equipment, readings, addReading, getReadingsForDate } = useTemperatureStore();
  const { establishment, user } = useAuthStore();
  const { processImage, isProcessing, result, reset: resetOCR } = useOCR();

  const [step, setStep] = useState<Step>('info');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [recentReadings, setRecentReadings] = useState<TemperatureReading[]>([]);

  const currentEquipment: Equipment | undefined = equipment.find(
    (e) => e.id === equipmentId,
  );

  const threshold = currentEquipment?.type
    ? THRESHOLDS[currentEquipment.type]
    : undefined;

  // Load recent readings
  useEffect(() => {
    const loadRecent = async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayReadings = await getReadingsForDate(today);
      const filtered = todayReadings.filter(
        (r) => r.equipment_id === equipmentId,
      );
      setRecentReadings(filtered);
    };
    loadRecent();
  }, [equipmentId, getReadingsForDate]);

  const handleCapture = useCallback(
    async (uri: string) => {
      setPhotoUri(uri);
      setStep('processing');
      await processImage(uri);
      setStep('result');
    },
    [processImage],
  );

  const handleRetake = useCallback(() => {
    setPhotoUri(null);
    resetOCR();
    setStep('camera');
  }, [resetOCR]);

  const handleValidate = useCallback(
    async (finalValue: number) => {
      if (!currentEquipment || !establishment) return;

      const compliant = currentEquipment.type
        ? (() => {
            const t = THRESHOLDS[currentEquipment.type];
            if (!t) return true;
            if (t.min !== undefined && finalValue < t.min) return false;
            if (t.max !== undefined && finalValue > t.max) return false;
            return true;
          })()
        : true;

      await addReading({
        establishment_id: establishment.id,
        equipment_id: currentEquipment.id,
        temperature_value: finalValue,
        threshold_min: threshold?.min ?? null,
        threshold_max: threshold?.max ?? null,
        is_compliant: compliant,
        ocr_confidence: result?.confidence ?? null,
        manual_entry: (result?.confidence ?? 0) < 0.85,
        photo_path: photoUri,
        reading_type: 'routine',
        corrective_action: null,
        corrective_action_photo_path: null,
        recorded_by: user?.id ?? null,
        recorded_at: new Date().toISOString(),
      });

      if (!compliant) {
        router.replace({
          pathname: '/temperature/correctif',
          params: {
            equipmentId: currentEquipment.id,
            equipmentName: currentEquipment.name,
            temperature: String(finalValue),
            thresholdMin: threshold?.min !== undefined ? String(threshold.min) : '',
            thresholdMax: threshold?.max !== undefined ? String(threshold.max) : '',
          },
        });
      } else {
        router.back();
      }
    },
    [currentEquipment, establishment, user, threshold, result, photoUri, addReading, router],
  );

  // Camera step: full screen
  if (step === 'camera') {
    return (
      <CameraOverlay
        onCapture={handleCapture}
        onClose={() => setStep('info')}
      />
    );
  }

  // Processing step
  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text variant="h2" style={styles.processingText}>
            Analyse OCR en cours...
          </Text>
          <Text variant="body" color={Colors.textSecondary}>
            Lecture de la temperature sur la photo
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Result step
  if (step === 'result' && result) {
    const compliant = currentEquipment?.type
      ? (() => {
          const t = THRESHOLDS[currentEquipment.type];
          if (!t) return true;
          if (t.min !== undefined && result.value < t.min) return false;
          if (t.max !== undefined && result.value > t.max) return false;
          return true;
        })()
      : true;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Button title="Retour" onPress={() => router.back()} variant="ghost" size="sm" />
          </View>
          <OCRResultCard
            value={result.value}
            confidence={result.confidence}
            isCompliant={compliant}
            equipmentName={currentEquipment?.name ?? 'Equipement'}
            onValidate={handleValidate}
            onRetake={handleRetake}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Result step but OCR failed
  if (step === 'result' && !result) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Button title="Retour" onPress={() => router.back()} variant="ghost" size="sm" />
          </View>
          <Card style={styles.errorCard}>
            <Text variant="h2" color={Colors.danger}>
              Erreur de lecture
            </Text>
            <Text variant="body" color={Colors.textSecondary} style={styles.errorText}>
              Impossible de lire la temperature sur la photo. Verifiez que le thermometre est bien visible et reessayez.
            </Text>
            <Button title="Reprendre la photo" onPress={handleRetake} variant="primary" />
            <View style={styles.spacing} />
            <Button title="Retour" onPress={() => router.back()} variant="ghost" />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Info step (default)
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Button title="Retour" onPress={() => router.back()} variant="ghost" size="sm" />
        </View>

        <Card style={styles.infoCard}>
          <Text variant="h1" style={styles.equipmentName}>
            {currentEquipment?.name ?? 'Equipement inconnu'}
          </Text>

          {currentEquipment?.location && (
            <Text variant="body" color={Colors.textSecondary}>
              {currentEquipment.location}
            </Text>
          )}

          {currentEquipment?.type && (
            <Badge
              text={currentEquipment.type.replace(/_/g, ' ')}
              variant="info"
            />
          )}

          {/* Thresholds */}
          <View style={styles.thresholdsSection}>
            <Text variant="h3" style={styles.sectionTitle}>
              Seuils reglementaires
            </Text>
            <View style={styles.thresholdRow}>
              {threshold?.min !== undefined && (
                <View style={styles.thresholdChip}>
                  <Text variant="caption" color={Colors.textSecondary}>
                    Min
                  </Text>
                  <Text variant="h2" color={Colors.warning}>
                    {threshold.min}°C
                  </Text>
                </View>
              )}
              {threshold?.max !== undefined && (
                <View style={styles.thresholdChip}>
                  <Text variant="caption" color={Colors.textSecondary}>
                    Max
                  </Text>
                  <Text variant="h2" color={Colors.danger}>
                    {threshold.max}°C
                  </Text>
                </View>
              )}
              {!threshold && (
                <Text variant="body" color={Colors.textSecondary}>
                  Aucun seuil defini
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Take photo CTA */}
        <View style={styles.ctaContainer}>
          <Button
            title="Prendre la photo"
            onPress={() => setStep('camera')}
            variant="primary"
            size="lg"
          />
        </View>

        {/* Recent readings */}
        {recentReadings.length > 0 && (
          <Card style={styles.historyCard}>
            <Text variant="h3" style={styles.sectionTitle}>
              Releves du jour
            </Text>
            <TemperatureChart
              readings={recentReadings}
              thresholdMin={threshold?.min}
              thresholdMax={threshold?.max}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  infoCard: {
    margin: 16,
    gap: 8,
  },
  equipmentName: {
    marginBottom: 4,
  },
  thresholdsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  thresholdRow: {
    flexDirection: 'row',
    gap: 16,
  },
  thresholdChip: {
    backgroundColor: Colors.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  ctaContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  historyCard: {
    margin: 16,
    marginTop: 0,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  processingText: {
    marginTop: 8,
  },
  errorCard: {
    margin: 16,
    gap: 12,
  },
  errorText: {
    marginBottom: 8,
  },
  spacing: {
    height: 8,
  },
});
 