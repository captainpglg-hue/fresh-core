import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { requestPermissions } from '../services/notifications';

export function useNotifications() {
  const router = useRouter();

  useEffect(() => {
    requestPermissions();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      switch (data.type) {
        case 'TEMPERATURE_ALERT':
          router.push('/(tabs)/temperatures');
          break;
        case 'DLC_ALERT':
          router.push('/(tabs)/tracabilite');
          break;
        case 'CLEANING_REMINDER':
          router.push('/(tabs)/nettoyage');
          break;
        case 'PEST_REMINDER':
          router.push('/(tabs)/nuisibles');
          break;
      }
    });

    return () => subscription.remove();
  }, []);