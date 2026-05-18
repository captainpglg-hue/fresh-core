import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  Dimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Text } from './Text';
import { Colors } from '../../constants/colors';

interface PhotoViewerProps {
  uri: string | null;
  visible: boolean;
  caption?: string;
  onClose: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Full-screen modal showing a stored photo (HACCP evidence trail).
 * Tap anywhere outside the image to dismiss. The close button is also
 * provided in the top-right for clarity on small screens.
 */
export function PhotoViewer({ uri, visible, caption, onClose }: PhotoViewerProps) {
  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.imageWrap} onPress={(e) => e.stopPropagation()}>
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
          />
          {caption ? (
            <View style={styles.captionBar}>
              <Text variant="caption" color={Colors.white}>
                {caption}
              </Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
          <X size={24} color={Colors.white} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    width: SCREEN_W,
    height: SCREEN_H * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  captionBar: {
    position: 'absolute',
    bottom: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
