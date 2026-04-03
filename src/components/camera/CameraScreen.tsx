import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { X, Zap, ZapOff } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Colors } from '../../constants/colors';

interface CameraScreenProps {
  onCapture: (uri: string) => void;
  onClose: () => void;
  guidanceText?: string;
  showGuideRect?: boolean;
}

export function CameraScreen({
  onCapture,
  onClose,
  guidanceText = 'Prenez la photo',
  showGuideRect = true,
}: CameraScreenProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch {
      // Capture failed, allow retry
    } finally {
      setIsCapturing(false);
    }
  };

  const handleOpenSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  // Permission loading
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={Colors.white} />
        <Text variant="body" color={Colors.white} style={styles.permissionLoadingText}>
          Chargement...
        </Text>
      </View>
    );
  }

  // Permission not yet asked
  if (!permission.granted && permission.canAskAgain) {
    return (
      <View style={styles.permissionContainer}>
        <Text variant="h2" color={Colors.white} style={styles.permissionTitle}>
          Acces camera
        </Text>
        <Text variant="body" color={Colors.white} style={styles.permissionText}>
          Fresh-Core a besoin d'acceder a votre camera pour photographier les thermometres et documents HACCP.
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

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text variant="h2" color={Colors.white} style={styles.permissionTitle}>
          Camera non autorisee
        </Text>
        <Text variant="body" color={Colors.white} style={styles.permissionText}>
          L'acces a la camera a ete refuse. Vous pouvez l'activer dans les reglages de votre appareil.
        </Text>
        <Button
          title="Ouvrir les reglages"
          onPress={handleOpenSettings}
          variant="primary"
          size="lg"
        />
        <View style={styles.permissionSpacing} />
        <Button title="Retour" onPress={onClose} variant="ghost" />
      </View>
    );
  }

  // Permission granted - show camera
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flash}
      >
        {/* Overlay */}
        {showGuideRect && (
          <View style={styles.overlayContainer} pointerEvents="none">
            {/* Top overlay */}
            <View style={styles.overlayTop} />
            {/* Middle row */}
            <View style={styles.overlayMiddleRow}>
              <View style={styles.overlaySide} />
              {/* Transparent hole */}
              <View style={styles.hole}>
                {/* Top-left corner */}
                <View style={[styles.cornerH, styles.cornerTopLeftH]} />
                <View style={[styles.cornerV, styles.cornerTopLeftV]} />
                {/* Top-right corner */}
                <View style={[styles.cornerH, styles.cornerTopRightH]} />
                <View style={[styles.cornerV, styles.cornerTopRightV]} />
                {/* Bottom-left corner */}
                <View style={[styles.cornerH, styles.cornerBottomLeftH]} />
                <View style={[styles.cornerV, styles.cornerBottomLeftV]} />
                {/* Bottom-right corner */}
                <View style={[styles.cornerH, styles.cornerBottomRightH]} />
                <View style={[styles.cornerV, styles.cornerBottomRightV]} />
              </View>
              <View style={styles.overlaySide} />
            </View>
            {/* Guidance text */}
            <View style={styles.guidanceContainer}>
              <Text variant="body" color={Colors.white} style={styles.guidanceText}>
                {guidanceText}
              </Text>
            </View>
            {/* Bottom overlay */}
            <View style={styles.overlayBottom} />
          </View>
        )}

        {/* Top bar controls */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.topButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFlash((prev) => !prev)}
            style={[styles.topButton, flash && styles.flashActive]}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {flash ? (
              <Zap size={24} color={Colors.white} />
            ) : (
              <ZapOff size={24} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>

        {/* Capture button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={handleCapture}
            disabled={isCapturing}
            activeOpacity={0.7}
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const HOLE_WIDTH = 280;
const HOLE_HEIGHT = 200;
const CORNER_LENGTH = 30;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  // Permission screens
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionLoadingText: {
    marginTop: 16,
  },
  permissionTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
    lineHeight: 24,
  },
  permissionSpacing: {
    height: 12,
  },
  // Overlay
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTop: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddleRow: {
    flexDirection: 'row',
    height: HOLE_HEIGHT,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  hole: {
    width: HOLE_WIDTH,
    height: HOLE_HEIGHT,
  },
  guidanceContainer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
  },
  guidanceText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayBottom: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  // Corner brackets - horizontal bars
  cornerH: {
    position: 'absolute',
    width: CORNER_LENGTH,
    height: CORNER_THICKNESS,
    backgroundColor: Colors.white,
  },
  // Corner brackets - vertical bars
  cornerV: {
    position: 'absolute',
    width: CORNER_THICKNESS,
    height: CORNER_LENGTH,
    backgroundColor: Colors.white,
  },
  // Top-left
  cornerTopLeftH: {
    top: 0,
    left: 0,
  },
  cornerTopLeftV: {
    top: 0,
    left: 0,
  },
  // Top-right
  cornerTopRightH: {
    top: 0,
    right: 0,
  },
  cornerTopRightV: {
    top: 0,
    right: 0,
  },
  // Bottom-left
  cornerBottomLeftH: {
    bottom: 0,
    left: 0,
  },
  cornerBottomLeftV: {
    bottom: 0,
    left: 0,
  },
  // Bottom-right
  cornerBottomRightH: {
    bottom: 0,
    right: 0,
  },
  cornerBottomRightV: {
    bottom: 0,
    right: 0,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashActive: {
    backgroundColor: Colors.accent,
  },
  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.white,
  },
});
