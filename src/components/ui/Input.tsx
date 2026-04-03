import React from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  icon?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  icon,
  keyboardType = 'default',
}: Props) {
  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.fieldWrapper, hasError && styles.fieldWrapperError]}>
        {icon && <View style={styles.iconWrapper}>{icon}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          style={[styles.field, icon ? styles.fieldWithIcon : null]}
        />
      </View>
      {hasError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 6,
  },
  fieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  fieldWrapperError: {
    borderColor: Colors.danger,
  },
  iconWrapper: {
    paddingLeft: 12,
  },
  field: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    minHeight: 44,
  },
  fieldWithIcon: {
    paddingLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
});
