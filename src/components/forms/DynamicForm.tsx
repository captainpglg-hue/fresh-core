import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Switch, Platform, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '../ui/Text';
import { Input } from '../ui/Input';
import { Colors } from '../../constants/colors';
import type { FieldDef } from '../../constants/filieres';

export type DynamicFormValues = Record<string, string | number | boolean | null>;

interface Props {
  fields: FieldDef[];
  values: DynamicFormValues;
  onChange: (values: DynamicFormValues) => void;
}

export function DynamicForm({ fields, values, onChange }: Props) {
  const set = (key: string, val: string | number | boolean | null) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <View style={styles.list}>
      {fields.map((f) => (
        <FieldRow key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
    </View>
  );
}

interface FieldRowProps {
  field: FieldDef;
  value: string | number | boolean | null | undefined;
  onChange: (val: string | number | boolean | null) => void;
}

function FieldRow({ field, value, onChange }: FieldRowProps) {
  switch (field.type) {
    case 'text':
    case 'textarea':
      return (
        <View style={styles.field}>
          <Text variant="caption" style={styles.label}>
            {field.label}
            {field.required ? ' *' : ''}
          </Text>
          <Input
            value={(value as string) ?? ''}
            onChangeText={(t) => onChange(t)}
            placeholder={field.placeholder}
            multiline={field.type === 'textarea'}
          />
          {field.help ? <Text variant="caption" color={Colors.textSecondary}>{field.help}</Text> : null}
        </View>
      );

    case 'number':
      return (
        <View style={styles.field}>
          <Text variant="caption" style={styles.label}>
            {field.label}
            {field.required ? ' *' : ''}
            {field.unit ? ` (${field.unit})` : ''}
          </Text>
          <Input
            value={value == null ? '' : String(value)}
            onChangeText={(t) => {
              const cleaned = t.replace(',', '.').replace(/[^0-9.\-]/g, '');
              if (cleaned === '' || cleaned === '-') {
                onChange(null);
              } else {
                const n = Number(cleaned);
                onChange(Number.isFinite(n) ? n : null);
              }
            }}
            keyboardType="decimal-pad"
            placeholder={field.placeholder}
          />
        </View>
      );

    case 'boolean':
      return (
        <View style={[styles.field, styles.row]}>
          <Text variant="body" style={styles.flex}>
            {field.label}
          </Text>
          <Switch
            value={Boolean(value)}
            onValueChange={onChange}
            trackColor={{ false: Colors.border, true: Colors.primaryLighter }}
          />
        </View>
      );

    case 'select':
      return (
        <View style={styles.field}>
          <Text variant="caption" style={styles.label}>
            {field.label}
            {field.required ? ' *' : ''}
          </Text>
          <SelectField
            value={value == null ? '' : String(value)}
            placeholder={field.placeholder ?? 'Sélectionner…'}
            options={field.options ?? []}
            onChange={(v) => onChange(v)}
          />
        </View>
      );

    case 'date':
      return (
        <View style={styles.field}>
          <Text variant="caption" style={styles.label}>
            {field.label}
            {field.required ? ' *' : ''}
          </Text>
          <DateField value={value as string | null | undefined} onChange={onChange} />
        </View>
      );
  }
}

// ----------------------------------------------------------------------------
// Select : iOS modal natif + Android inline.
// ----------------------------------------------------------------------------
function SelectField({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  if (Platform.OS === 'android') {
    return (
      <View style={styles.androidPickerWrap}>
        <Picker selectedValue={value} onValueChange={(v) => onChange(String(v))}>
          <Picker.Item label={placeholder} value="" />
          {options.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>
    );
  }

  return (
    <>
      <Pressable style={styles.iosTrigger} onPress={() => setOpen(true)}>
        <Text variant="body" color={selected ? Colors.textPrimary : Colors.textSecondary}>
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text variant="h3">Choisir</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text color={Colors.primary}>Fermer</Text>
              </Pressable>
            </View>
            <Picker selectedValue={value} onValueChange={(v) => onChange(String(v))}>
              <Picker.Item label={placeholder} value="" />
              {options.map((o) => (
                <Picker.Item key={o.value} label={o.label} value={o.value} />
              ))}
            </Picker>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ----------------------------------------------------------------------------
// Date : datetimepicker natif sur iOS/Android, format ISO interne (YYYY-MM-DD).
// ----------------------------------------------------------------------------
function DateField({ value, onChange }: { value: string | null | undefined; onChange: (v: string | null) => void }) {
  const [show, setShow] = useState(false);
  const currentDate = value ? new Date(value) : new Date();

  return (
    <>
      <Pressable style={styles.iosTrigger} onPress={() => setShow(true)}>
        <Text variant="body" color={value ? Colors.textPrimary : Colors.textSecondary}>
          {value ? new Date(value).toLocaleDateString('fr-FR') : 'Choisir une date'}
        </Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selected) => {
            setShow(Platform.OS === 'ios');
            if (selected) {
              onChange(selected.toISOString().slice(0, 10));
            }
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  field: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  label: { color: Colors.textSecondary },
  iosTrigger: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  androidPickerWrap: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
