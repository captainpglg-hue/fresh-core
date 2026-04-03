import React, { useState } from 'react';
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
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  icon,
  suffix,
  keyboardType = 'default',
  multiline = false,
}: Props) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.fieldWrapper,
          focused && styles.fieldWrapperFocused,
          hasError && styles.fieldWrapperError,
        ]}
      >
        {icon ? <View style={styles.iconWrapper}>{icon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.field,
            icon ? styles.fieldWithIcon : null,
            multiline ? styles.fieldMultiline : null,
          ]}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {hasError ? <Text style={styles.errorText}>{error}</Text> : null}
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
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  fieldWrapperFocused: {
    borderColor: Colors.primary,
  },
  fieldWrapperError: {
    borderColor: Colors.danger,
  },
  iconWrapper: {
    paddingLeft: 16,
  },
  field: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    minHeight: 48,
  },
  fieldWithIcon: {
    paddingLeft: 8,
  },
  fieldMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  suffix: {
    fontSize: 16,
    color: Colors.textSecondary,
    paddingRight: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
});
