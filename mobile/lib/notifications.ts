import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWateringReminder(
  plantName: string,
  plantId: string,
  daysFromNow: number,
): Promise<void> {
  if (Platform.OS === 'web') return;
  // Cancel any existing reminder for this plant
  await cancelWateringReminder(plantId);

  if (daysFromNow <= 0) return;

  const trigger = new Date();
  trigger.setDate(trigger.getDate() + daysFromNow);
  trigger.setHours(9, 0, 0, 0); // 9am on the due day

  await Notifications.scheduleNotificationAsync({
    identifier: `watering-${plantId}`,
    content: {
      title: '💧 Time to water!',
      body: `${plantName} is due for watering today.`,
      data: { plantId },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
}

export async function cancelWateringReminder(plantId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`watering-${plantId}`);
  } catch {
    // notification may not exist
  }
}
