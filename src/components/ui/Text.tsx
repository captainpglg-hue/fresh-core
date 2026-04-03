import React from 'react';
import { Text as BaseText, StyleSheet, TextStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
  children: React.ReactNode;
  style?: TextStyle;
  color?: string;
}

export function Text({ variant = 'body', children, style, color }: Props) {
  return (
    <BaseText
      style={[
        styles.base,
        styles[variant],
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </BaseText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: Colors.textPrimary,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
  },
  h2: {
    fontSize: 20,
    fontWeight: '700',
  },
  h3: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
  },
});
