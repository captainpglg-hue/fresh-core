import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Colors } from '../../constants/colors';

interface Props {
  onCapture: (uri: string) => void;
  onClose: () => void;
}

export function CameraOverlay({ onCapture, onClose }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch {
      // Capture failed silently, allow retry
    } finally {
      setIsCapturing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text variant="body" color={Colors.white}>
          Chargement de la camera...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text variant="h2" color={Colors.white} style={styles.permissionTitle}>
          Acces camera requis
        </Text>
        <Text variant="body" color={Colors.white} style={styles.permissionText}>
          Fresh-Core a besoin d'acceder a votre camera pour photographier les thermometres.
        </Text>
        <Button
          title="Autoriser la camera"
          onPress={requestPermission}
          variant="primary"
          size="lg"
        />
        <View style={styles.permissionSpacing} />
        <Button title="Retour" onPress={onClose} variant="ghost" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        flash={flashEnabled ? 'on' : 'off'}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.topButton,
              pressed && styles.topButtonPressed,
            ]}
          >
            <Text variant="body" color={Colors.white} style={styles.topButtonText}>
              Retour
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFlashEnabled((prev) => !prev)}
            style={({ pressed }) => [
              styles.topButton,
              flashEnabled && styles.flashActive,
              pressed && styles.topButtonPressed,
            ]}
          >
            <Text variant="body" color={Colors.white} style={styles.topButtonText}>
              {flashEnabled ? 'Flash ON' : 'Flash OFF'}
            </Text>
          </Pressable>
        </View>

        {/* Guide rectangle */}
        <View style={styles.guideContainer}>
          <View style={styles.guideRect}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          <Text variant="body" color={Colors.white} style={styles.guideText}>
            Centrez le thermometre dans le cadre
          </Text>
        </View>

        {/* Bottom bar with capture button */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleCapture}
            disabled={isCapturing}
            style={({ pressed }) => [
              styles.captureButton,
              pressed && styles.captureButtonPressed,
              isCapturing && styles.captureButtonDisabled,
            ]}
          >
            <View style={styles.captureButtonInner} />
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  camera: {
    flex: 1,
    justifyContent: 'space-between',
  },
  // Permission screen
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
  },
  permissionSpacing: {
    height: 12,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  topButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topButtonPressed: {
    opacity: 0.7,
  },
  topButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  flashActive: {
    backgroundColor: Colors.accent,
  },
  // Guide rectangle
  guideContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideRect: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: 'rgba(27, 67, 50, 0.3)',
    backgroundColor: 'rgba(27, 67, 50, 0.3)',
    borderRadius: 12,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Colors.white,
  },
  cornerTopLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  guideText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Bottom bar
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  captureButtonPressed: {
    opacity: 0.7,
  },
  captureButtonDisabled: {
    opacity: 0.4,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
  },
});
