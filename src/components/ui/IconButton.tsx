import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  icon: React.ReactNode;
  onPress: () => void;
  size?: number;
}

export function IconButton({ icon, onPress, size = 44 }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        pressed && styles.pressed,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  pressed: {
    opacity: 0.7,
  },
});
