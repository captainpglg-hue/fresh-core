import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Colors } from '../../constants/colors';

interface Props {
  onScanned: (lotCode: string) => void;
}

const URL_PATTERN = /\/origine\/([A-Z0-9]{8,32})$/i;
const BARE_CODE_PATTERN = /^[A-Z0-9]{8,32}$/i;

/**
 * Scanner QR — accepte soit l'URL canonique (https://fresh-core.app/origine/XXXX)
 * soit le code brut (XXXX). Tolère un QR cassé/mal cadré : on dédoublonne et
 * on n'appelle onScanned qu'une fois.
 */
export function LotScanner({ onScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  const handle = useCallback(
    (data: string) => {
      if (locked) return;
      const trimmed = data.trim();
      const fromUrl = trimmed.match(URL_PATTERN);
      const code = fromUrl ? fromUrl[1].toUpperCase() : BARE_CODE_PATTERN.test(trimmed) ? trimmed.toUpperCase() : null;
      if (!code) return;
      setLocked(true);
      onScanned(code);
    },
    [locked, onScanned]
  );

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Initialisation de la caméra…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text variant="body" style={styles.message}>
          La caméra est nécessaire pour scanner les QR codes des lots.
        </Text>
        <Button title="Autoriser la caméra" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(e) => handle(e.data)}
      />
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.frame} />
        <Text variant="body" style={styles.hint}>
          Cadre le QR code dans le carré
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  message: { textAlign: 'center' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  frame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: Colors.white,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: {
    color: Colors.white,
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
