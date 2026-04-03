import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  title: string;
  showSync?: boolean;
}

export function Header({ title, showSync = false }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {showSync && (
        <View style={styles.syncBadge}>
          <Text style={styles.syncText}>En ligne</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    flex: 1,
  },
  syncBadge: {
    backgroundColor: Colors.primaryLighter,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 24,
    marginLeft: 8,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
});
