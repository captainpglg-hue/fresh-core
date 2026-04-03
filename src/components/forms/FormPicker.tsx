import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Controller,
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from 'react-hook-form';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../constants/colors';

interface PickerOption {
  label: string;
  value: string;
}

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  options: PickerOption[];
  placeholder?: string;
  rules?: RegisterOptions<T>;
}

export function FormPicker<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = 'Selectionner...',
  rules,
}: Props<T>) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      rules={rules as RegisterOptions<T, Path<T>>}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        const selectedOption = options.find((o) => o.value === value);
        const displayText = selectedOption ? selectedOption.label : placeholder;
        const hasError = Boolean(error);

        if (Platform.OS === 'android') {
          return (
            <View style={styles.container}>
              <Text style={styles.label}>{label}</Text>
              <View
                style={[
                  styles.fieldWrapper,
                  hasError && styles.fieldWrapperError,
                ]}
              >
                <Picker
                  selectedValue={value ?? ''}
                  onValueChange={(itemValue) => {
                    if (itemValue !== '') {
                      onChange(itemValue);
                    }
                  }}
                  style={styles.androidPicker}
                >
                  <Picker.Item
                    label={placeholder}
                    value=""
                    color={Colors.textSecondary}
                  />
                  {options.map((option) => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                      color={Colors.textPrimary}
                    />
                  ))}
                </Picker>
              </View>
              {hasError && (
                <Text style={styles.errorText}>{error?.message}</Text>
              )}
            </View>
          );
        }

        return (
          <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <Pressable
              onPress={() => setModalVisible(true)}
              style={[
                styles.fieldWrapper,
                styles.touchableField,
                hasError && styles.fieldWrapperError,
              ]}
            >
              <Text
                style={[
                  styles.fieldText,
                  !selectedOption && styles.placeholderText,
                ]}
              >
                {displayText}
              </Text>
              <Text style={styles.chevron}>{'>'}</Text>
            </Pressable>
            {hasError && (
              <Text style={styles.errorText}>{error?.message}</Text>
            )}

            <Modal
              visible={modalVisible}
              transparent
              animationType="slide"
              onRequestClose={() => setModalVisible(false)}
            >
              <Pressable
                style={styles.modalOverlay}
                onPress={() => setModalVisible(false)}
              >
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Pressable onPress={() => setModalVisible(false)}>
                      <Text style={styles.modalCancel}>Annuler</Text>
                    </Pressable>
                    <Text style={styles.modalTitle}>{label}</Text>
                    <Pressable
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.modalDone}>OK</Text>
                    </Pressable>
                  </View>
                  <Picker
                    selectedValue={value ?? ''}
                    onValueChange={(itemValue) => {
                      if (itemValue !== '') {
                        onChange(itemValue);
                      }
                    }}
                  >
                    <Picker.Item
                      label={placeholder}
                      value=""
                      color={Colors.textSecondary}
                    />
                    {options.map((option) => (
                      <Picker.Item
                        key={option.value}
                        label={option.label}
                        value={option.value}
                        color={Colors.textPrimary}
                      />
                    ))}
                  </Picker>
                </View>
              </Pressable>
            </Modal>
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  fieldWrapperError: {
    borderColor: Colors.danger,
  },
  touchableField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  fieldText: {
    fontSize: 16,
    color: Colors.textPrimary,
    flex: 1,
  },
  placeholderText: {
    color: Colors.textSecondary,
  },
  chevron: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  androidPicker: {
    color: Colors.textPrimary,
    paddingHorizontal: 8,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  modalDone: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
});
