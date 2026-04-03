import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'alert' | 'success';
  onPress?: () => void;
}

export function Card({
  children,
  style,
  variant = 'default',
  onPress,
}: Props) {
  const variantStyle =
    variant === 'alert'
      ? styles.alert
      : variant === 'success'
        ? styles.success
        : undefined;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          variantStyle,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, variantStyle, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  alert: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  success: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  pressed: {
    opacity: 0.9,
  },
});
