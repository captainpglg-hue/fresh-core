import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Apple, Beef, Cake, Croissant, Drumstick, Fish, Milk, Package, Utensils, Wine,
  type LucideIcon,
} from 'lucide-react-native';
import { Text } from '../ui/Text';
import { Colors } from '../../constants/colors';
import { ALL_FILIERES } from '../../constants/filieres';
import type { Filiere } from '../../types/lotChain';

const ICONS: Record<Filiere, LucideIcon> = {
  peche: Fish,
  elevage: Beef,
  laitier: Milk,
  fromage: Cake,
  charcuterie: Drumstick,
  legumes: Apple,
  boulangerie: Croissant,
  restauration: Utensils,
  vins: Wine,
  autre: Package,
};

interface Props {
  selected: Filiere | null;
  onSelect: (filiere: Filiere) => void;
}

export function FiliereGrid({ selected, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {ALL_FILIERES.map((f) => {
        const Icon = ICONS[f.id];
        const isSelected = selected === f.id;
        return (
          <Pressable
            key={f.id}
            onPress={() => onSelect(f.id)}
            style={[styles.card, isSelected && styles.cardSelected]}
          >
            <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
              <Icon size={26} color={isSelected ? Colors.white : Colors.primary} />
            </View>
            <Text variant="h3" style={styles.label} numberOfLines={1}>
              {f.shortLabel}
            </Text>
            <Text variant="caption" color={Colors.textSecondary} style={styles.desc} numberOfLines={2}>
              {f.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 130,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.paleGreen,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconWrapSelected: {
    backgroundColor: Colors.primary,
  },
  label: { marginBottom: 2 },
  desc: { lineHeight: 14 },
});
