import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Camera, Snowflake, Flame, Thermometer } from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Header } from '../../src/components/ui/Header';
import { CameraScreen } from '../../src/components/camera/CameraScreen';
import { OCRResult } from '../../src/components/camera/OCRResult';
import { Colors } from '../../src/constants/colors';
import { THRESHOLDS, isCompliant } from '../../src/constants/thresholds';
import { useTemperatureStore } from '../../src/stores/temperatureStore';
import { useAuthStore } from '../../src/stores/authStore';
import { extractTemperature } from '../../src/services/ocr';
import type { TemperatureReading } from '../../src/types/database';

type Step = 'ready' | 'camera' | 'processing' | 'result';

interface OCRData {
  value: number;
  confidence: number;
  rawText: string;
}

function getEquipmentIcon(type: string): React.ReactNode {
  switch (type) {
    case 'cold_positive':
    case 'cold_positive_veg':
    case 'cold_negative':
    case 'cold_room':
    case 'display_case':
      return <Snowflake size={24} color={Colors.primary} />;
    case 'hot_holding':
    case 'cooking':
    case 'fryer':
      return <Flame size={24} color={Colors.accent} />;
    default:
      return <Thermometer size={24} color={Colors.primary} />;
  }
}

function getThresholdLabel(type: string): string {
  const threshold = THRESHOLDS[type];
  if (!threshold) return 'Aucun seuil defini';
  if (threshold.min !== undefined && threshold.max !== undefined) {
    return `Min ${threshold.min}°C / Max ${threshold.max}°C`;
  }
  if (threshold.max !== undefined) return `Seuil max : ${threshold.max}°C`;
  if (threshold.min !== undefined) return `Seuil min : ${threshold.min}°C`;
  return 'Aucun seuil defini';
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    cold_positive: 'Chambre froide positive',
    cold_negative: 'Chambre froide negative',
    cold_positive_veg: 'Frigo legumes',
    cold_room: 'Chambre froide',
    display_case: 'Vitrine refrigeree',
    hot_holding: 'Maintien chaud',
    cooking: 'Cuisson',
    fryer: 'Friteuse',
    other: 'Autre',
  };
  return labels[type] ?? type;
}

export default function ReleveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    equipmentId: string;
    name: string;
    type: string;
  }>();

  const equipmentId = params.equipmentId ?? '';
  const equipmentName = params.name ?? 'Equipement';
  const equipmentType = params.type ?? 'other';

  const { readings, addReading, getReadingsForDate } = useTemperatureStore();
  const { establishment, user } = useAuthStore();

  const [step, setStep] = useState<Step>('ready');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OCRData | null>(null);
  const [todayReadings, setTodayReadings] = useState<TemperatureReading[]>([]);

  const threshold = THRESHOLDS[equipmentType];

  // Load today's readings for this equipment
  useEffect(() => {
    const loadToday = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const allToday = await getReadingsForDate(today);
      const filtered = allToday.filter((r) => r.equipment_id === equipmentId);
      setTodayReadings(filtered);
    };
    loadToday();
  }, [equipmentId, getReadingsForDate]);

  const handleCapture = useCallback(
    async (uri: string) => {
      setPhotoUri(uri);
      setStep('processing');

      try {
        const result = await extractTemperature(uri);
        if (result) {
          setOcrData({
            value: result.value,
            confidence: result.confidence,
            rawText: result.rawText,
          });
        } else {
          setOcrData(null);
        }
      } catch {
        setOcrData(null);
      }

      setStep('result');
    },
    [],
  );

  const handleCameraClose = useCallback(() => {
    setStep('ready');
  }, []);

  const handleRetake = useCallback(() => {
    setPhotoUri(null);
    setOcrData(null);
    setStep('camera');
  }, []);

  const handleValidate = useCallback(
    async (finalValue: number) => {
      if (!establishment) return;

      const compliant = isCompliant(finalValue, equipmentType);

      await addReading({
        establishment_id: establishment.id,
        equipment_id: equipmentId,
        temperature_value: finalValue,
        threshold_min: threshold?.min ?? null,
        threshold_max: threshold?.max ?? null,
        is_compliant: compliant,
        ocr_confidence: ocrData?.confidence ?? null,
        manual_entry: ocrData === null || ocrData.confidence < 0.85,
        photo_path: photoUri,
        reading_type: 'routine',
        corrective_action: null,
        corrective_action_photo_path: null,
        recorded_by: user?.id ?? null,
        recorded_at: new Date().toISOString(),
      });

      if (compliant) {
        Alert.alert(
          'Releve enregistre !',
          `${finalValue.toFixed(1)}°C - Conforme`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        const thresholdDisplay =
          threshold?.max !== undefined
            ? String(threshold.max)
            : threshold?.min !== undefined
              ? String(threshold.min)
              : '';

        router.push({
          pathname: '/temperature/correctif',
          params: {
            equipmentId,
            equipmentName,
            temperature: String(finalValue),
            threshold: thresholdDisplay,
            thresholdType: equipmentType,
          },
        });
      }
    },
    [
      establishment,
      user,
      equipmentId,
      equipmentName,
      equipmentType,
      threshold,
      ocrData,
      photoUri,
      addReading,
      router,
    ],
  );

  // -------------------------------------------------------
  // Step: camera -- CameraScreen takes over the entire screen
  // -------------------------------------------------------
  if (step === 'camera') {
    return (
      <CameraScreen
        onCapture={handleCapture}
        onClose={handleCameraClose}
        guidanceText="Centrez le thermometre dans le cadre"
        showGuideRect
      />
    );
  }

  // -------------------------------------------------------
  // Step: processing -- full screen loading
  // -------------------------------------------------------
  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text variant="h2" style={styles.processingTitle}>
            Lecture de la temperature en cours...
          </Text>
          <Text
            variant="body"
            color={Colors.textSecondary}
            style={styles.processingSubtitle}
          >
            Analyse OCR de la photo du thermometre
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------
  // Step: result -- render OCRResult component
  // -------------------------------------------------------
  if (step === 'result') {
    return (
      <SafeAreaView style={styles.container}>
        <OCRResult
          temperature={ocrData?.value ?? null}
          confidence={ocrData?.confidence ?? 0}
          photoUri={photoUri ?? ''}
          equipmentName={equipmentName}
          thresholdType={equipmentType}
          onValidate={handleValidate}
          onRetake={handleRetake}
        />
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------
  // Step: ready -- equipment info + open camera button
  // -------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={equipmentName}
        showBack
        onBack={() => router.back()}
        subtitle={getTypeLabel(equipmentType)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Equipment Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              {getEquipmentIcon(equipmentType)}
            </View>
            <View style={styles.infoTextCol}>
              <Text variant="h2">{equipmentName}</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                {getTypeLabel(equipmentType)}
              </Text>
            </View>
          </View>

          <View style={styles.thresholdSection}>
            <Text variant="caption" color={Colors.textSecondary}>
              SEUIL REGLEMENTAIRE
            </Text>
            <Text variant="h3" color={Colors.primary}>
              {getThresholdLabel(equipmentType)}
            </Text>
          </View>
        </Card>

        {/* Today's readings */}
        {todayReadings.length > 0 && (
          <View style={styles.readingsSection}>
            <Text variant="h3" style={styles.sectionTitle}>
              Releves du jour
            </Text>
            {todayReadings.map((reading) => (
              <Card key={reading.id} style={styles.readingMiniCard}>
                <View style={styles.readingMiniRow}>
                  <View style={styles.readingMiniLeft}>
                    <Text
                      variant="h3"
                      color={
                        reading.is_compliant ? Colors.success : Colors.danger
                      }
                    >
                      {reading.temperature_value.toFixed(1)}°C
                    </Text>
                    <Text variant="caption" color={Colors.textSecondary}>
                      {format(new Date(reading.recorded_at), 'HH:mm', {
                        locale: fr,
                      })}
                    </Text>
                  </View>
                  <Badge
                    text={reading.is_compliant ? 'Conforme' : 'Non conforme'}
                    variant={reading.is_compliant ? 'success' : 'danger'}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Big Camera CTA */}
        <View style={styles.ctaContainer}>
          <Button
            title="Ouvrir la camera"
            onPress={() => setStep('camera')}
            variant="primary"
            size="lg"
            fullWidth
            icon={<Camera size={22} color={Colors.white} />}
          />
          <Text
            variant="caption"
            color={Colors.textSecondary}
            style={styles.ctaHint}
          >
            Photographiez l&apos;affichage du thermometre pour une lecture OCR
            automatique
          </Text>
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
  scrollContent: {
    paddingBottom: 40,
  },
  // Info card
  infoCard: {
    margin: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextCol: {
    flex: 1,
    gap: 2,
  },
  thresholdSection: {
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  // Readings section
  readingsSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  readingMiniCard: {
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  readingMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readingMiniLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Camera CTA
  ctaContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  ctaHint: {
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
  },
  // Processing
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  processingTitle: {
    textAlign: 'center',
    marginTop: 8,
  },
  processingSubtitle: {
    textAlign: 'center',
  },
});
