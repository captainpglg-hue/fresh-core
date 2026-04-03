import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  title: string;
  subtitle?: string;
  showSync?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : 0;

export function Header({
  title,
  subtitle,
  showSync = false,
  showBack = false,
  onBack,
  rightAction,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.leftSection}>
          {showBack && onBack ? (
            <Pressable
              onPress={onBack}
              style={styles.backButton}
              hitSlop={8}
            >
              <Text style={styles.backArrow}>{'<'}</Text>
            </Pressable>
          ) : null}
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rightSection}>
          {showSync && (
            <View style={styles.syncBadge}>
              <Text style={styles.syncText}>En ligne</Text>
            </View>
          )}
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    paddingTop: STATUS_BAR_HEIGHT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    marginRight: 4,
  },
  backArrow: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.paleGreen,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  syncBadge: {
    backgroundColor: Colors.primaryLighter,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 24,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
});
