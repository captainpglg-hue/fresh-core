import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Fresh-Core',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return true;
}

export async function scheduleTemperatureAlert(equipmentName: string, temperature: number, threshold: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Alerte Temperature !',
      body: `${equipmentName}: ${temperature}°C (seuil: ${threshold}°C). Action corrective requise.`,
      data: { type: 'TEMPERATURE_ALERT' },
    },
    trigger: null, // immediate
  });
}

export async function scheduleDLCAlert(productName: string, dlcDate: string, daysUntil: number): Promise<void> {
  if (daysUntil <= 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'DLC Expiree !',
        body: `${productName} a depasse sa DLC (${dlcDate}). Destruction requise.`,
        data: { type: 'DLC_ALERT' },
      },
      trigger: null,
    });
  } else {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'DLC Proche',
        body: `${productName} expire dans ${daysUntil} jour(s) (${dlcDate}).`,
        data: { type: 'DLC_ALERT' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 60, repeats: false },
    });
  }
}

export async function scheduleCleaningReminder(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rappel Nettoyage',
      body: 'Des taches de nettoyage sont en attente. Ouvrez Fresh-Core pour les valider.',
      data: { type: 'CLEANING_REMINDER' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3600, repeats: false },
  });
}

export async function schedulePestReminder(daysUntilVisit: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rappel Nuisibles',
      body: `Prochaine visite du prestataire dans ${daysUntilVisit} jour(s).`,
      data: { type: 'PEST_REMINDER' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 60, repeats: false },
  });
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
