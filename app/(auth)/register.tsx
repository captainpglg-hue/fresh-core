import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { FormField } from '../../src/components/forms/FormField';
import { FormPicker } from '../../src/components/forms/FormPicker';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';

// Les valeurs DOIVENT matcher le CHECK de la colonne establishment_type en base
// (supabase/migrations/001_initial_schema.sql).
const ESTABLISHMENT_TYPES: Array<{ label: string; value: string }> = [
  { label: 'Restaurant', value: 'restaurant' },
  { label: 'Boulangerie / Patisserie', value: 'boulangerie' },
  { label: 'Traiteur', value: 'traiteur' },
  { label: 'Epicerie fine', value: 'epicerie' },
  { label: 'Food truck', value: 'food_truck' },
  { label: 'Cantine', value: 'cantine' },
  { label: 'Hotel-restaurant', value: 'hotel_restaurant' },
  { label: 'Autre', value: 'autre' },
];

const registerSchema = z.object({
  fullName: z.string().min(2, 'Minimum 2 caracteres'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caracteres'),
  confirmPassword: z.string(),
  establishmentType: z.string().min(1, 'Selectionnez un type'),
  establishmentName: z.string().min(2, 'Minimum 2 caracteres'),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  siret: z.string().optional(),
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

  const { control, handleSubmit } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      establishmentType: '',
      establishmentName: '',
      address: '',
      postalCode: '',
      city: '',
      siret: '',
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError('');
    try {
      await signUp(data.email, data.password, data.fullName);

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        await supabase.from('establishments').insert({
          owner_id: sessionData.session.user.id,
          name: data.establishmentName,
          establishment_type: data.establishmentType,
          address: data.address || null,
          postal_code: data.postalCode || null,
          city: data.city || null,
          siret: data.siret || null,
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'inscription");
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
        <Text style={styles.title}>Creer votre compte</Text>
        <Text style={styles.subtitle}>
          Commencez a securiser votre conformite HACCP
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>

          <FormField
            control={control}
            name="fullName"
            label="Nom complet"
            placeholder="Jean Dupont"
          />

          <FormField
            control={control}
            name="email"
            label="Email"
            placeholder="votre@email.com"
            keyboardType="email-address"
          />

          <FormField
            control={control}
            name="password"
            label="Mot de passe"
            placeholder="Minimum 8 caracteres"
            secureTextEntry
          />

          <FormField
            control={control}
            name="confirmPassword"
            label="Confirmer le mot de passe"
            placeholder="Confirmez votre mot de passe"
            secureTextEntry
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Etablissement</Text>

          <FormPicker
            control={control}
            name="establishmentType"
            label="Type d'etablissement"
            options={ESTABLISHMENT_TYPES}
          />

          <FormField
            control={control}
            name="establishmentName"
            label="Nom de l'etablissement"
            placeholder="Mon Restaurant"
          />

          <FormField
            control={control}
            name="address"
            label="Adresse"
            placeholder="12 rue de la Paix"
          />

          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <FormField
                control={control}
                name="postalCode"
                label="Code postal"
                placeholder="75001"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.rowHalf}>
              <FormField
                control={control}
                name="city"
                label="Ville"
                placeholder="Paris"
              />
            </View>
          </View>

          <FormField
            control={control}
            name="siret"
            label="SIRET (optionnel)"
            placeholder="123 456 789 00012"
            keyboardType="numeric"
          />
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <Button
          title="Creer mon compte"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          variant="primary"
        />

        <Pressable
          onPress={() => router.back()}
          style={styles.linkContainer}
        >
          <Text style={styles.linkText}>
            Deja un compte ?{' '}
            <Text style={styles.linkTextBold}>Se connecter</Text>
          </Text>
        </Pressable>
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
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  section: {
    gap: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowHalf: {
    flex: 1,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  linkContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  linkText: {
    color