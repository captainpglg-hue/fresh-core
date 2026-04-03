import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const sizeHeights: Record<string, number> = {
  sm: 40,
  md: 48,
  lg: 56,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
}: Props) {
  const isDisabled = disabled || loading;

  const variantStyle = variantStyles[variant] ?? variantStyles.primary;
  const textVariantStyle = textVariantStyles[variant] ?? textVariantStyles.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => {
        const combined: ViewStyle[] = [
          styles.base,
          variantStyle,
          {
            height: sizeHeights[size] ?? sizeHeights.md,
            paddingHorizontal: size === 'sm' ? 12 : size === 'lg' ? 20 : 16,
          },
          fullWidth ? styles.fullWidth : undefined,
          isDisabled ? styles.disabled : undefined,
          pressed && !isDisabled ? styles.pressed : undefined,
        ].filter(Boolean) as ViewStyle[];
        return combined;
      }}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'ghost' || variant === 'outline'
              ? Colors.primary
              : Colors.white
          }
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              textVariantStyle,
              size === 'sm'
                ? styles.smText
                : size === 'lg'
                  ? styles.lgText
                  : styles.mdText,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const variantStyles: Record<string, ViewStyle> = StyleSheet.create({
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.accent,
  },
  danger: {
    backgroundColor: Colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
});

const textVariantStyles = StyleSheet.create({
  primary: {
    color: Colors.white,
  },
  secondary: {
    color: Colors.white,
  },
  danger: {
    color: Colors.white,
  },
  ghost: {
    color: Colors.primary,
  },
  outline: {
    color: Colors.primary,
  },
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontWeight: '600',
  },
  smText: {
    fontSize: 14,
  },
  mdText: {
    fontSize: 16,
  },
  lgText: {
    fontSize: 18,
  },
});
