import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Colors } from '../../constants/colors';

interface Props {
  value: number;
  confidence: number;
  isCompliant: boolean;
  equipmentName: string;
  onValidate: (finalValue: number) => void;
  onRetake: () => void;
}

export function OCRResultCard({
  value,
  confidence,
  isCompliant,
  equipmentName,
  onValidate,
  onRetake,
}: Props) {
  const lowConfidence = confidence < 0.85;
  const [correctedValue, setCorrectedValue] = useState(value.toString());

  const handleValidate = () => {
    const finalValue = lowConfidence ? parseFloat(correctedValue) : value;
    if (isNaN(finalValue)) return;
    onValidate(finalValue);
  };

  const parsedCorrected = parseFloat(correctedValue);
  const isInputValid = !isNaN(parsedCorrected);

  return (
    <Card style={styles.card}>
      <Text variant="caption" color={Colors.textSecondary} style={styles.equipmentLabel}>
        {equipmentName}
      </Text>

      <View style={styles.temperatureRow}>
        <Text variant="h1" style={styles.temperatureValue}>
          {value.toFixed(1)}°C
        </Text>
        <Badge
          text={isCompliant ? 'CONFORME' : 'HORS SEUIL'}
          variant={isCompliant ? 'success' : 'danger'}
        />
      </View>

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

      {lowConfidence && (
        <View style={styles.correctionSection}>
          <Text variant="body" color={Colors.warning} style={styles.correctionWarning}>
            Fiabilite faible — verifiez et corrigez si necessaire
          </Text>
          <Input
            label="Temperature corrigee (°C)"
            value={correctedValue}
            onChangeText={setCorrectedValue}
            keyboardType="numeric"
            placeholder="Ex: 3.2"
          />
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title="Valider"
          onPress={handleValidate}
          variant="primary"
          size="lg"
          disabled={lowConfidence && !isInputValid}
        />
        <View style={styles.actionSpacing} />
        <Button
          title="Reprendre"
          onPress={onRetake}
          variant="ghost"
          size="md"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
  },
  equipmentLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  temperatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  temperatureValue: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.primary,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  correctionSection: {
    marginBottom: 8,
  },
  correctionWarning: {
    marginBottom: 12,
    fontWeight: '600',
  },
  actions: {
    marginTop: 8,
  },
  actionSpacing: {
    height: 8,
  },
});
