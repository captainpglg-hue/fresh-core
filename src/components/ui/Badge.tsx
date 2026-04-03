import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  text: string;
  variant: 'success' | 'danger' | 'warning' | 'info';
}

export function Badge({ text, variant }: Props) {
  return (
    <View style={[styles.base, styles[`${variant}Bg`]]}>
      <Text style={[styles.text, styles[`${variant}Text`]]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 24,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Backgrounds
  successBg: {
    backgroundColor: '#B7E4C7',
  },
  dangerBg: {
    backgroundColor: '#FECDD3',
  },
  warningBg: {
    backgroundColor: '#FEE2C5',
  },
  infoBg: {
    backgroundColor: '#D1ECF1',
  },
  // Text colors
  successText: {
    color: '#1B4332',
  },
  dangerText: {
    color: '#E63946',
  },
  warningText: {
    color: '#E76F51',
  },
  infoText: {
    color: '#0C5460',
  },
});
