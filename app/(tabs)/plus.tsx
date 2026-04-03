import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Flame,
  Tag,
  Droplet,
  Bug,
  Settings,
} from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Colors } from '../../src/constants/colors';

interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  color: string;
}

function ModuleCard({ icon, title, description, onPress, color }: ModuleCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.cardIcon, { backgroundColor: color }]}>
        {icon}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

export default function PlusScreen() {
  const router = useRouter();

  const modules: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
    route: string;
    color: string;
  }> = [
    {
      icon: <Flame size={24} color={Colors.white} />,
      title: 'Cuisson',
      description: 'Sonde, timer refroidissement et remise en temperature',
      route: '/(tabs)/cuisson',
      color: Colors.accent,
    },
    {
      icon: <Tag size={24} color={Colors.white} />,
      title: 'Tracabilite / DLC',
      description: 'Etiquetage secondaire, FIFO, destruction, archivage',
      route: '/(tabs)/tracabilite',
      color: Colors.primaryLight,
    },
    {
      icon: <Droplet size={24} color={Colors.white} />,
      title: 'Huiles',
      description: 'Test TPM, changement, filtration, elimination',
      route: '/(tabs)/huiles',
      color: Colors.warning,
    },
    {
      icon: <Bug size={24} color={Colors.white} />,
      title: 'Nuisibles',
      description: 'Points de controle, signalements, interventions',
      route: '/(tabs)/nuisibles',
      color: Colors.danger,
    },
    {
      icon: <Settings size={24} color={Colors.white} />,
      title: 'Reglages',
      description: 'Compte, etablissement, seuils et preferences',
      route: '/(tabs)/reglages',
      color: Colors.textSecondary,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Autres modules</Text>
        <Text style={styles.headerSubtitle}>
          Acces aux modules complementaires HACCP
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {modules.map((module) => (
            <ModuleCard
              key={module.route}
              icon={module.icon}
              title={module.title}
              description={module.description}
              onPress={() => router.push(module.route as never)}
              color={module.color}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  scroll: {
    padding: 24,
    paddingTop: 16,
  },
  grid: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
