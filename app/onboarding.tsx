import { useState, useRef } from 'react';
import { View, StyleSheet, FlatList, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../src/components/ui/Text';
import { Button } from '../src/components/ui/Button';
import { Colors } from '../src/constants/colors';
import { Camera, WifiOff, Shield } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: Camera,
    title: 'Fini les fiches papier',
    subtitle: 'Chaque controle HACCP en 30 secondes grace a la photo guidee et la reconnaissance automatique.',
  },
  {
    id: '2',
    icon: WifiOff,
    title: '100% hors-ligne',
    subtitle: 'Fonctionne sans internet, meme au marche. Vos donnees se synchronisent automatiquement au retour en ligne.',
  },
  {
    id: '3',
    icon: Shield,
    title: 'Certifie blockchain',
    subtitle: 'Vos releves sont horodates et infalsifiables grace a la technologie blockchain. Preuve acceptee par la DDPP.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/(auth)/register');
    }
  };

  const renderSlide = ({ item }: { item: typeof slides[0] }) => {
    const Icon = item.icon;
    return (
      <View style={styles.slide}>
        <View style={styles.iconContainer}>
          <Icon size={64} color={Colors.primary} />
        </View>
        <Text variant="h1" style={styles.title}>{item.title}</Text>
        <Text variant="body" color={Colors.textSecondary} style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />

      {/* Dots */}
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Button */}
      <View style={styles.buttonContainer}>
        <Button
          title={currentIndex === slides.length - 1 ? 'Commencer' : 'Suivant'}
          onPress={handleNext}
          size="lg"
        />
        {currentIndex < slides.length - 1 && (
          <Pressable onPress={() => router.replace('/(auth)/register')}>
            <Text variant="caption" color={Colors.textSecondary} style={styles.skipText}>Passer</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  slide: { width, justifyContent: 'center', alignItems: 'center', padding: 48 },
  iconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.paleGreen, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  title: { textAlign: 'center', marginBottom: 16 },
  subtitle: { textAlign: 'center', lineHeight: 24 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DEE2E6' },
  dotActive: { backgroundColor: Colors.primary, width: 24 },
  buttonContainer: { paddingHorizontal: 24, paddingBottom: 48, gap: 16, alignItems: 'center' },
  skipText: { padding: 8 },
});
