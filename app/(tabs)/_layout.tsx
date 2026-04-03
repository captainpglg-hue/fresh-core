import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import {
  House,
  Thermometer,
  Truck,
  SprayCan,
  MoreHorizontal,
} from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: '#DEE2E6',
        },
        tabBarLabelStyle: {
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="temperatures"
        options={{
          title: 'Temperatures',
          tabBarIcon: ({ color, size }) => (
            <Thermometer size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="receptions"
        options={{
          title: 'Receptions',
          tabBarIcon: ({ color, size }) => <Truck size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nettoyage"
        options={{
          title: 'Nettoyage',
          tabBarIcon: ({ color, size }) => (
            <SprayCan size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          title: 'Plus',
          tabBarIcon: ({ color, size }) => (
            <MoreHorizontal size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cuisson"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="tracabilite"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="huiles"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="nuisibles"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="reglages"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
