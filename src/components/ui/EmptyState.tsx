import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { Colors } from '../../constants/colors';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Standard "nothing here yet" screen for empty FlatLists / module dashboards.
 * Use it for "first-time user" moments to guide them to the next action,
 * not for transient loading states (use the loading spinner instead).
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text variant="h3" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text
          variant="body"
          color={Colors.textSecondary}
          style={styles.description}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.actionWrap}>
          <Button title={actionLabel} variant="primary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 8,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
  },
  actionWrap: {
    marginTop: 20,
  },
});
