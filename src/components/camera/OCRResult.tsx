import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Colors } from '../../constants/colors';
import { isCompliant } from '../../constants/thresholds';

interface OCRResultProps {
  temperature: number | null;
  confidence: number;
  photoUri: string;
  equipmentName: string;
  thresholdType: string;
  onValidate: (value: number) => void;
  onRetake: () => void;
}

export function OCRResult({
  temperature,
  confidence,
  photoUri,
  equipmentName,
  thresholdType,
  onValidate,
  onRetake,
}: OCRResultProps) {
  const [manualValue, setManualValue] = useState(
    temperature !== null ? temperature.toString() : ''
  );

  const lowConfidence = temperature !== null && confidence < 0.85;
  const compliant = temperature !== null ? isCompliant(temperature, thresholdType) : false;

  const handleValidate = () => {
    if (temperature !== null && !lowConfidence) {
      onValidate(temperature);
      return;
    }
    const parsed = parseFloat(manualValue.replace(',', '.'));
    if (!isNaN(parsed)) {
      onValidate(parsed);
    }
  };

  const parsedManual = parseFloat(manualValue.replace(',', '.'));
  const isManualValid = !isNaN(parsedManual);

  return (
    <View style={styles.container}>
      {/* Photo thumbnail */}
      <View style={styles.photoRow}>
        <Image source={{ uri: photoUri }} style={styles.thumbnail} />
        <View style={styles.equipmentInfo}>
          <Text variant="caption" color={Colors.textSecondary} style={styles.equipmentLabel}>
            EQUIPEMENT
          </Text>
          <Text variant="h3">{equipmentName}</Text>
        </View>
      </View>

      {temperature !== null ? (
        <View style={styles.resultSection}>
          {/* Temperature display */}
          <Text
            variant="h1"
            style={[
              styles.temperatureValue,
              { color: compliant ? Colors.success : Colors.danger },
            ]}
          >
            {temperature.toFixed(1)}°C
          </Text>

          <View style={styles.badgeRow}>
            <Badge
              text={compliant ? 'CONFORME' : 'HORS SEUIL'}
              variant={compliant ? 'success' : 'danger'}
            />
          </View>

          {/* Confidence info */}
          <View style={styles.confidenceRow}>
            <Text variant="caption" color={Colors.textSecondary}>
              Fiabilite OCR : {Math.round(confidence * 100)}%
            </Text>
            <View
              style={[
                styles.confidenceDot,
                { backgroundColor: confidence >= 0.85 ? Colors.success : Colors.warning },
              ]}
            />
          </View>

          {/* Low confidence correction */}
          {lowConfidence && (
            <View style={styles.correctionSection}>
              <Text variant="body" color={Colors.warning} style={styles.correctionWarning}>
                Confiance faible, verifiez la valeur
              </Text>
              <Input
                label="Temperature corrigee"
                value={manualValue}
                onChangeText={setManualValue}
                keyboardType="numeric"
                placeholder="Ex: 3.2"
              />
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Valider ce releve"
              onPress={handleValidate}
              variant="primary"
              size="lg"
              disabled={lowConfidence && !isManualValid}
            />
            <View style={styles.actionSpacing} />
            <Button
              title="Reprendre la photo"
              onPress={onRetake}
              variant="ghost"
              size="md"
            />
          </View>
        </View>
      ) : (
        <View style={styles.resultSection}>
          {/* No temperature detected */}
          <Text variant="h3" style={styles.noResultTitle}>
            Impossible de lire la temperature automatiquement
          </Text>
          <Text variant="body" color={Colors.textSecondary} style={styles.noResultSubtitle}>
            Saisissez la valeur manuellement.
          </Text>

          <Input
            label="Temperature"
            value={manualValue}
            onChangeText={setManualValue}
            keyboardType="numeric"
            placeholder="Saisissez la temperature"
          />
          <Text variant="caption" color={Colors.textSecondary} style={styles.unitHint}>
            °C
          </Text>

          <View style={styles.actions}>
            <Button
              title="Valider"
              onPress={handleValidate}
              variant="primary"
              size="lg"
              disabled={!isManualValid}
            />
            <View style={styles.actionSpacing} />
            <Button
              title="Reprendre la photo"
              onPress={onRetake}
              variant="ghost"
              size="md"
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  thumbnail: {
    width: 120,
    height: 90,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  equipmentInfo: {
    flex: 1,
    marginLeft: 16,
  },
  equipmentLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  resultSection: {
    flex: 1,
  },
  temperatureValue: {
    fontSize: 64,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  correctionSection: {
    marginBottom: 16,
  },
  correctionWarning: {
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  noResultTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultSubtitle: {
    textAlign: 'center',
    marginBottom: 24,
  },
  unitHint: {
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  actionSpacing: {
    height: 8,
  },
});
