import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { Text } from '../src/components/ui/Text';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { Colors } from '../src/constants/colors';
import { FiliereGrid } from '../src/components/onboarding/FiliereGrid';
import { MaillonGrid } from '../src/components/onboarding/MaillonGrid';
import { FILIERES, MAILLONS } from '../src/constants/filieres';
import { useAuthStore } from '../src/stores/authStore';
import type { Filiere, Maillon } from '../src/types/lotChain';

type Step = 'intro' | 'filiere' | 'maillon' | 'recap';

/**
 * Onboarding adaptatif Phase 3. L'utilisateur choisit sa filière puis son
 * maillon dans la filière. Le choix configure le dashboard, les actions
 * disponibles sur les lots, et les modules HACCP pertinents. Persisté via
 * authStore.setFiliereMaillon (Supabase + SQLite + fallback mémoire démo).
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { setFiliereMaillon, establishment, user } = useAuthStore();
  const [step, setStep] = useState<Step>('intro');
  const [filiere, setFiliere] = useState<Filiere | null>(null);
  const [maillon, setMaillon] = useState<Maillon | null>(null);
  const [saving, setSaving] = useState(false);

  const goNext = useCallback(() => {
    if (step === 'intro') setStep('filiere');
    else if (step === 'filiere' && filiere) setStep('maillon');
    else if (step === 'maillon' && maillon) setStep('recap');
  }, [step, filiere, maillon]);

  const goBack = useCallback(() => {
    if (step === 'maillon') {
      setStep('filiere');
      setMaillon(null);
    } else if (step === 'filiere') setStep('intro');
    else if (step === 'recap') setStep('maillon');
  }, [step]);

  const onSelectFiliere = useCallback((f: Filiere) => {
    setFiliere(f);
    setMaillon(null);
    // Auto-advance après une légère pause visuelle (UX cards picker).
    setTimeout(() => setStep('maillon'), 150);
  }, []);

  const onSelectMaillon = useCallback((m: Maillon) => {
    setMaillon(m);
    setTimeout(() => setStep('recap'), 150);
  }, []);

  const finish = useCallback(async () => {
    if (!filiere || !maillon) return;
    setSaving(true);
    try {
      await setFiliereMaillon(filiere, maillon);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  }, [filiere, maillon, setFiliereMaillon, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.progress}>
          <Dot active={step === 'intro'} done={step !== 'intro'} />
          <Dot active={step === 'filiere'} done={step === 'maillon' || step === 'recap'} />
          <Dot active={step === 'maillon'} done={step === 'recap'} />
          <Dot active={step === 'recap'} done={false} />
        </View>

        {step === 'intro' ? (
          <View style={styles.intro}>
            <View style={styles.iconHero}>
              <ShieldCheck size={56} color={Colors.primary} />
            </View>
            <Text variant="h1" style={styles.center}>Traçabilité bout en bout</Text>
            <Text variant="body" color={Colors.textSecondary} style={styles.center}>
              Fresh-Core suit chaque lot du producteur à l'assiette du consommateur.
              Chaque étape est signée, chaînée et ancrée sur blockchain.
              Réponds à 2 questions pour configurer ton compte selon ton métier.
            </Text>
          </View>
        ) : null}

        {step === 'filiere' ? (
          <View>
            <Text variant="h1" style={styles.title}>Quelle est ta filière ?</Text>
            <Text variant="body" color={Colors.textSecondary} style={styles.subtitle}>
              On adaptera les champs de traçabilité au métier (zone FAO pour la pêche, abattoir pour l'élevage, recette pour la fromagerie, etc.).
            </Text>
            <FiliereGrid selected={filiere} onSelect={onSelectFiliere} />
          </View>
        ) : null}

        {step === 'maillon' && filiere ? (
          <View>
            <Text variant="h1" style={styles.title}>Ton rôle dans la filière {FILIERES[filiere].shortLabel} ?</Text>
            <Text variant="body" color={Colors.textSecondary} style={styles.subtitle}>
              On affichera les actions adaptées à ton poste : créer un lot à la source, transformer, contrôler, transférer, consommer.
            </Text>
            <MaillonGrid filiere={filiere} selected={maillon} onSelect={onSelectMaillon} />
          </View>
        ) : null}

        {step === 'recap' && filiere && maillon ? (
          <View>
            <Text variant="h1" style={styles.title}>Tout est prêt</Text>
            <Card style={styles.recapCard}>
              <Row label="Filière" value={FILIERES[filiere].label} />
              <Row label="Maillon" value={MAILLONS[maillon].label} />
              <Row label="Établissement" value={establishment?.name ?? '—'} />
              <Row label="Profil" value={user?.full_name ?? '—'} />
            </Card>
            <Card style={styles.previewCard}>
              <Text variant="h3" style={styles.previewTitle}>Tu pourras :</Text>
              {MAILLONS[maillon].canCreate ? (
                <Bullet text="Créer de nouveaux lots à la source" />
              ) : null}
              {MAILLONS[maillon].allowedActions.includes('TRANSFORM') ? (
                <Bullet text="Transformer des lots reçus en nouveaux lots (recette / process)" />
              ) : null}
              {MAILLONS[maillon].allowedActions.includes('TRANSFER') ? (
                <Bullet text="Transférer / réceptionner des lots via scan QR" />
              ) : null}
              {MAILLONS[maillon].allowedActions.includes('CONTROL') ? (
                <Bullet text="Ajouter des contrôles (T°, DLC, nettoyage…)" />
              ) : null}
              <Bullet text={`Modules HACCP : ${MAILLONS[maillon].haccpModules.join(', ') || '—'}`} />
            </Card>
          </View>
        ) : null}

        <View style={styles.actions}>
          {step !== 'intro' ? (
            <Button
              title="Précédent"
              onPress={goBack}
              variant="ghost"
              icon={<ArrowLeft size={18} color={Colors.primary} />}
            />
          ) : <View />}

          {step === 'intro' ? (
            <Button title="Commencer" onPress={goNext} icon={<ArrowRight size={18} color={Colors.white} />} />
          ) : null}
          {step === 'recap' ? (
            <Button
              title={saving ? 'Configuration…' : 'Lancer Fresh-Core'}
              onPress={finish}
              loading={saving}
              disabled={saving}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recapRow}>
      <Text variant="caption" color={Colors.textSecondary}>{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text variant="body" style={styles.flex}>{text}</Text>
    </View>
  );
}

function Dot({ active, done }: { active: boolean; done: boolean }) {
  return <View style={[styles.dot, active && styles.dotActive, done && styles.dotDone]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, gap: 24, paddingBottom: 48 },
  progress: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 24 },
  dotDone: { backgroundColor: Colors.primaryLighter },
  intro: { gap: 16, alignItems: 'center', paddingTop: 24 },
  iconHero: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.paleGreen,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  title: { marginBottom: 8 },
  subtitle: { marginBottom: 16, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  recapCard: { padding: 16, gap: 12 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewCard: { padding: 16, gap: 8, marginTop: 16 },
  previewTitle: { marginBottom: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 8,
  },
  flex: { flex: 1 },
});
