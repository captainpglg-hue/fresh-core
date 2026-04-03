import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { CameraOverlay } from '../../src/components/camera/CameraOverlay';
import { Colors } from '../../src/constants/colors';

const CORRECTIVE_OPTIONS = [
  'Alerte maintenance - equipement defaillant',
  'Transfert des produits vers un autre equipement',
  'Verification et reglage du thermostat',
  'Mise en place refroidissement rapide',
  'Autre (preciser)',
] as const;

type CorrectiveOption = (typeof CORRECTIVE_OPTIONS)[number];

export default function CorrectiveActionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    equipmentId: string;
    equipmentName: string;
    temperature: string;
    thresholdMin: string;
    thresholdMax: string;
  }>();

  const temperature = parseFloat(params.temperature || '0');
  const thresholdMin = params.thresholdMin ? parseFloat(params.thresholdMin) : undefined;
  const thresholdMax = params.thresholdMax ? parseFloat(params.thresholdMax) : undefined;

  const [selectedOption, setSelectedOption] = useState<CorrectiveOption | null>(null);
  const [notes, setNotes] = useState('');
  const [proofPhotoUri, setProofPhotoUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const exceededThreshold =
    thresholdMax !== undefined && temperature > thresholdMax
      ? `${thresholdMax}°C (max)`
      : thresholdMin !== undefined && temperature < thresholdMin
        ? `${thresholdMin}°C (min)`
        : 'inconnu';

  const canValidate =
    selectedOption !== null &&
    (selectedOption !== 'Autre (preciser)' || notes.trim().length > 0);

  const handleValidate = async () => {
    if (!canValidate) return;
    setIsSaving(true);

    try {
      // In a full implementation, save to the database via temperatureStore
      // For now, just navigate back
      router.dismiss(2);
    } catch {
      setIsSaving(false);
    }
  };

  const handleCaptureProof = (uri: string) => {
    setProofPhotoUri(uri);
    setShowCamera(false);
  };

  if (showCamera) {
    return (
      <CameraOverlay
        onCapture={handleCaptureProof}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Button title="Retour" onPress={() => router.back()} variant="ghost" size="sm" />
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text variant="h1" color={Colors.danger}>
            Action corrective requise
          </Text>
        </View>

        {/* Alert card */}
        <Card style={styles.alertCard}>
          <View style={styles.alertRow}>
            <View style={styles.alertCol}>
              <Text variant="caption" color={Colors.textSecondary}>
                Equipement
              </Text>
              <Text variant="h3">
                {params.equipmentName || 'Equipement'}
              </Text>
            </View>
          </View>

          <View style={styles.alertDivider} />

          <View style={styles.alertMetrics}>
            <View style={styles.metricBox}>
              <Text variant="caption" color={Colors.textSecondary}>
                Temperature relevee
              </Text>
              <Text variant="h1" color={Colors.danger}>
                {temperature.toFixed(1)}°C
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text variant="caption" color={Colors.textSecondary}>
                Seuil depasse
              </Text>
              <Text variant="h2" color={Colors.textSecondary}>
                {exceededThreshold}
              </Text>
            </View>
          </View>

          <Badge text="HORS SEUIL" variant="danger" />
        </Card>

        {/* Corrective actions */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            Choisir l'action corrective
          </Text>

          {CORRECTIVE_OPTIONS.map((option) => {
            const isSelected = selectedOption === option;
            return (
              <Pressable
                key={option}
                onPress={() => setSelectedOption(option)}
                style={[
                  styles.radioRow,
                  isSelected && styles.radioRowSelected,
                ]}
              >
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.radioCircleSelected,
                  ]}
                >
                  {isSelected && <View style={styles.radioCircleInner} />}
                </View>
                <Text
                  variant="body"
                  style={styles.radioLabel}
                  color={isSelected ? Colors.primary : Colors.textPrimary}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            Notes complementaires
          </Text>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Decrivez les actions prises..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Proof photo */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            Photo preuve (optionnel)
          </Text>
          {proofPhotoUri ? (
            <View style={styles.photoPreview}>
              <Badge text="Photo prise" variant="success" />
              <View style={styles.photoActions}>
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
              variant="ghost"
              size="md"
            />
          )}
        </View>

        {/* Validate */}
        <View style={styles.validateSection}>
          <Button
            title="Valider l'action"
            onPress={handleValidate}
            variant="primary"
            size="lg"
            disabled={!canValidate}
            loading={isSaving}
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
  scrollContent: {
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  titleSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  alertCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  alertRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  alertCol: {
    flex: 1,
    gap: 4,
  },
  alertDivider: {
    height: 1,
    backgroundColor: '#EEE',
    marginBottom: 12,
  },
  alertMetrics: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    gap: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: Colors.white,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    minHeight: 44,
  },
  radioRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F7F4',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    flex: 1,
  },
  textArea: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    minHeight: 100,
  },
  photoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoActions: {
    flexDirection: 'row',
  },
  validateSection: {
    paddingHorizontal: 16,
  },
});
