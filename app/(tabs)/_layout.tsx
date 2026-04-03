import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import {
  Home,
  Thermometer,
  Truck,
  SprayCan,
  Flame,
  Tag,
  Droplet,
  Bug,
  Settings,
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
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
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
        name="deliveries"
        options={{
          title: 'Receptions',
          tabBarIcon: ({ color, size }) => <Truck size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cleaning"
        options={{
          title: 'Nettoyage',
          tabBarIcon: ({ color, size }) => (
            <SprayCan size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cooking"
        options={{
          title: 'Cuisson',
          tabBarIcon: ({ color, size }) => <Flame size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="traceability"
        options={{
          title: 'DLC',
          tabBarIcon: ({ color, size }) => <Tag size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="oil"
        options={{
          title: 'Huiles',
          tabBarIcon: ({ color, size }) => (
            <Droplet size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pests"
        options={{
          title: 'Nuisibles',
          tabBarIcon: ({ color, size }) => <Bug size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Reglages',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
