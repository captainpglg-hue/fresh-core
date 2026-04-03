import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import {
  Controller,
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from 'react-hook-form';
import { Colors } from '../../constants/colors';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: string;
  rules?: RegisterOptions<T>;
}

export function FormSwitch<T extends FieldValues>({
  control,
  name,
  label,
  description,
  rules,
}: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules as RegisterOptions<T, Path<T>>}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        const hasError = Boolean(error);

        return (
          <View style={styles.container}>
            <View style={styles.row}>
              <View style={styles.textContainer}>
                <Text style={styles.label}>{label}</Text>
                {description ? (
                  <Text style={styles.description}>{description}</Text>
                ) : null}
              </View>
              <Switch
                value={Boolean(value)}
                onValueChange={onChange}
                trackColor={{
                  false: Colors.border,
                  true: Colors.primary,
                }}
                thumbColor={Colors.white}
                ios_backgroundColor={Colors.border}
              />
            </View>
            {hasError && (
              <Text style={styles.errorText}>{error?.message}</Text>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
});
