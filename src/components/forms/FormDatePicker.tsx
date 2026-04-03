import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Controller,
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from 'react-hook-form';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors } from '../../constants/colors';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  mode?: 'date' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  rules?: RegisterOptions<T>;
}

function formatDate(date: Date, mode: 'date' | 'datetime'): string {
  if (mode === 'datetime') {
    return format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
  }
  return format(date, "dd MMMM yyyy", { locale: fr });
}

export function FormDatePicker<T extends FieldValues>({
  control,
  name,
  label,
  mode = 'date',
  minimumDate,
  maximumDate,
  rules,
}: Props<T>) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  return (
    <Controller
      control={control}
      name={name}
      rules={rules as RegisterOptions<T, Path<T>>}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        const rawValue = value as unknown;
        const dateValue = rawValue instanceof Date ? rawValue : (rawValue ? new Date(String(rawValue)) : new Date());
        const hasValue = value !== undefined && value !== null;
        const hasError = Boolean(error);

        const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (Platform.OS === 'android') {
            setShowPicker(false);
            if (event.type === 'dismissed') {
              return;
            }
            if (selectedDate) {
              if (mode === 'datetime' && pickerMode === 'date') {
                onChange(selectedDate);
                setPickerMode('time');
                setShowPicker(true);
                return;
              }
              onChange(selectedDate);
              setPickerMode('date');
            }
          } else {
            if (selectedDate) {
              onChange(selectedDate);
            }
          }
        };

        const handlePress = () => {
          setPickerMode('date');
          setShowPicker(true);
        };

        const handleIOSDone = () => {
          setShowPicker(false);
        };

        return (
          <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <Pressable
              onPress={handlePress}
              style={[
                styles.fieldWrapper,
                hasError && styles.fieldWrapperError,
              ]}
            >
              <Text
                style={[
                  styles.fieldText,
                  !hasValue && styles.placeholderText,
                ]}
              >
                {hasValue
                  ? formatDate(dateValue, mode)
                  : 'Selectionner une date...'}
              </Text>
            </Pressable>
            {hasError && (
              <Text style={styles.errorText}>{error?.message}</Text>
            )}

            {showPicker && Platform.OS === 'ios' && (
              <View style={styles.iosPickerContainer}>
                <Pressable onPress={handleIOSDone} style={styles.iosDoneRow}>
                  <Text style={styles.iosDoneText}>OK</Text>
                </Pressable>
                <DateTimePicker
                  value={dateValue}
                  mode={mode === 'datetime' ? 'datetime' : 'date'}
                  display="spinner"
                  onChange={handleChange}
                  minimumDate={minimumDate}
                  maximumDate={maximumDate}
                  locale="fr-FR"
                />
              </View>
            )}

            {showPicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={dateValue}
                mode={pickerMode}
                display="default"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  fieldWrapperError: {
    borderColor: Colors.danger,
  },
  fieldText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  placeholderText: {
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
  iosPickerContainer: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
    overflow: 'hidden',
  },
  iosDoneRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iosDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
});
