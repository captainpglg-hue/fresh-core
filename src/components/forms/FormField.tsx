import React from 'react';
import {
  Controller,
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from 'react-hook-form';
import { KeyboardTypeOptions } from 'react-native';
import { Input } from '../ui/Input';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  rules?: RegisterOptions<T>;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  multiline?: boolean;
  suffix?: string;
  icon?: React.ReactNode;
}

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  rules,
  placeholder,
  keyboardType,
  secureTextEntry,
  multiline,
  suffix,
  icon,
}: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules as RegisterOptions<T, Path<T>>}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <Input
          label={label}
          value={value ?? ''}
          onChangeText={onChange}
          placeholder={placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          suffix={suffix}
          icon={icon}
          error={error?.message}
        />
      )}
    />
  );
}
