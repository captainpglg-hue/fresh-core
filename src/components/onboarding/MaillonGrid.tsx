import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Anchor, Beef, Building2, ChefHat, Croissant, Drumstick, Factory, Fish,
  Leaf, MilkOff, Package, ShoppingBag, Sprout, Truck, Utensils, Warehouse,
  Wheat, Wine,
  type LucideIcon,
} from 'lucide-react-native';
import { Text } from '../ui/Text';
import { Colors } from '../../constants/colors';
import { FILIERES, MAILLONS } from '../../constants/filieres';
import type { Filiere, Maillon } from '../../types/lotChain';

const ICONS: Record<Maillon, LucideIcon> = {
  producteur: Sprout,
  pecheur: Anchor,
  eleveur: Beef,
  transformateur: Factory,
  criee: Fish,
  mareyeur: Truck,
  fromager: MilkOff,
  charcutier: Drumstick,
  boulanger: Croissant,
  distributeur: Warehouse,
  detaillant: ShoppingBag,
  poissonnier: Fish,
  primeur: Leaf,
  cremier: Building2,
  caviste: Wine,
  restaurateur: ChefHat,
  logisticien: Truck,
  autre: Package,
};

interface Props {
  filiere: Filiere;
  selected: Maillon | null;
  onSelect: (maillon: Maillon) => void;
}

export function MaillonGrid({ filiere, selected, onSelect }: Props) {
  const maillons = FILIERES[filiere].maillons;

  return (
    <View style={styles.grid}>
      {maillons.map((m) => {
        const Icon = ICONS[m] ?? Package;
        const conf = MAILLONS[m];
        const isSelected = selected === m;
        return (
          <Pressable
            key={m}
            onPress={() => onSelect(m)}
            style={[styles.card, isSelected && styles.cardSelected]}
          >
            <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
              <Icon size={22} color={isSelected ? Colors.white : Colors.primary} />
            </View>
            <Text variant="h3" style={styles.label} numberOfLines={2}>
              {conf.label}
            </Text>
            {conf.canCreate ? (
              <Text variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                Maillon source — peut créer un lot
              </Text>
            ) : (
              <Text variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                Reçoit · transforme · transmet
              </Text>
            )}
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
    minHeight: 110,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.paleGreen,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconWrapSelected: {
    backgroundColor: Colors.primary,
  },
  label: { marginBottom: 2 },
});
