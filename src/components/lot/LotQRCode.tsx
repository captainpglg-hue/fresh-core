import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Text } from '../ui/Text';
import { Colors } from '../../constants/colors';

interface Props {
  lotCode: string;
  size?: number;
  showCode?: boolean;
}

/**
 * QR code d'un lot. Le contenu encodé est un URL pointant vers la page
 * publique consommateur — n'importe quel scanner standard (Camera iOS,
 * Google Lens, scanner banque) ouvre la page sans installer l'app.
 *
 * Format : https://fresh-core.app/origine/<lot_code>
 * Schéma compact pour rester sous les 25 caractères + version L (haute
 * tolérance d'erreur, lisible même légèrement abîmé).
 */
export function LotQRCode({ lotCode, size = 200, showCode = true }: Props) {
  const url = `https://fresh-core.app/origine/${lotCode}`;
  return (
    <View style={styles.container}>
      <View style={styles.qrWrap}>
        <QRCode value={url} size={size} backgroundColor="white" color={Colors.primary} />
      </View>
      {showCode ? (
        <View style={styles.codeRow}>
          <Text variant="caption" style={styles.codeLabel}>Code lot</Text>
          <Text variant="h3" style={styles.code}>{lotCode}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
  },
  qrWrap: {
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  codeLabel: {
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  code: {
    color: Colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
});
