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
          router.push('/(tabs)/traceability');
          break;
        case 'CLEANING_REMINDER':
          router.push('/(tabs)/cleaning');
          break;
        case 'PEST_REMINDER':
          router.push('/(tabs)/pests');
          break;
      }
    });

    return () => subscription.remove();
  }, []);
}
