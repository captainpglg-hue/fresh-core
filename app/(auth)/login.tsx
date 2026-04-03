import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { FormField } from '../../src/components/forms/FormField';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/stores/authStore';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      await signIn(data.email, data.password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion');
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
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>FRESH{'\u00B7'}CORE</Text>
            <Text style={styles.logoSubtext}>Conformite HACCP simplifiee</Text>
          </View>
        </View>

        <View style={styles.form}>
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
            placeholder="Mot de passe"
            secureTextEntry
          />

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <Button
            title="Se connecter"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
            variant="primary"
          />

          <Pressable
            onPress={() => router.push('/(auth)/register')}
            style={styles.linkContainer}
          >
            <Text style={styles.linkText}>
              Pas encore de compte ?{' '}
              <Text style={styles.linkTextBold}>Creer un compte</Text>
            </Text>
          </Pressable>
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
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBadge: {
    backgroundColor: '#1B4332',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  logoText: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 3,
  },
  logoSubtext: {
    color: Colors.white,
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  linkContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  linkTextBold: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
