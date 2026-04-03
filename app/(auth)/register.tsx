import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';

const ESTABLISHMENT_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'boulangerie', label: 'Boulangerie' },
  { value: 'traiteur', label: 'Traiteur' },
  { value: 'epicerie', label: 'Epicerie' },
  { value: 'food_truck', label: 'Food Truck' },
  { value: 'cantine', label: 'Cantine' },
  { value: 'hotel_restaurant', label: 'Hotel-Restaurant' },
  { value: 'autre', label: 'Autre' },
] as const;

const registerSchema = z.object({
  fullName: z.string().min(2, 'Nom requis (minimum 2 caracteres)'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirmez le mot de passe'),
  establishmentName: z.string().min(2, 'Nom de l\'etablissement requis'),
  establishmentType: z.string().min(1, 'Selectionnez un type d\'etablissement'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('');

  const { control, handleSubmit, formState: { errors }, setValue } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      establishmentName: '',
      establishmentType: '',
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError('');
    try {
      await signUp(data.email, data.password, data.fullName);

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('establishments').insert({
          owner_id: session.user.id,
          name: data.establishmentName,
          type: data.establishmentType,
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="h1" style={styles.title}>Creer un compte</Text>
        <Text
          variant="body"
          color={Colors.textSecondary}
          style={styles.subtitle}
        >
          Commencez a securiser votre HACCP
        </Text>

        <View style={styles.form}>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Nom complet"
                value={value}
                onChangeText={onChange}
                placeholder="Jean Dupont"
                error={errors.fullName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Email"
                value={value}
                onChangeText={onChange}
                placeholder="votre@email.com"
                keyboardType="email-address"
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Mot de passe"
                value={value}
                onChangeText={onChange}
                placeholder="Minimum 6 caracteres"
                secureTextEntry
                error={errors.password?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Confirmer le mot de passe"
                value={value}
                onChangeText={onChange}
                placeholder="Confirmez votre mot de passe"
                secureTextEntry
                error={errors.confirmPassword?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="establishmentName"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Nom de l'etablissement"
                value={value}
                onChangeText={onChange}
                placeholder="Mon Restaurant"
                error={errors.establishmentName?.message}
              />
            )}
          />

          <View>
            <Text variant="body" style={styles.label}>
              Type d'etablissement
            </Text>
            <View style={styles.typeGrid}>
              {ESTABLISHMENT_TYPES.map((type) => (
                <Pressable
                  key={type.value}
                  style={[
                    styles.typeChip,
                    selectedType === type.value && styles.typeChipSelected,
                  ]}
                  onPress={() => {
                    setSelectedType(type.value);
                    setValue('establishmentType', type.value);
                  }}
                >
                  <Text
                    variant="caption"
                    color={selectedType === type.value ? Colors.white : Colors.textPrimary}
                  >
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.establishmentType ? (
              <Text variant="caption" color={Colors.danger}>
                {errors.establishmentType.message}
              </Text>
            ) : null}
          </View>

          {error ? (
            <Text variant="caption" color={Colors.danger} style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            title="Creer mon compte"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
          />

          <Button
            title="Deja un compte ? Se connecter"
            onPress={() => router.back()}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  label: {
    fontWeight: '700',
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  typeChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  error: {
    textAlign: 'center',
  },
});
