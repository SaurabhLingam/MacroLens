// services/notificationService.js

// import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform, DeviceEventEmitter } from "react-native";
import { isMedicineScheduledForDate } from "./medicineHistoryUtils";

export const isExpoGo = Constants.appOwnership === "expo";

// ─── Time parser ──────────────────────────────────────────────────────────────
const parseTime = (timeStr) => {
  try {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
  } catch {
    return { hours: 8, minutes: 0 };
  }
};

// ─── Next fire date for a medicine + time slot ────────────────────────────────
/**
 * getNextFireDate
 *
 * Walks forward day-by-day from now until it finds a date on which
 * isMedicineScheduledForDate returns true, then returns a Date set to
 * the given time on that day.
 *
 * Returns null if no valid date is found within 366 days (shouldn't happen).
 *
 * Examples:
 *   daily      → today if time hasn't passed, else tomorrow
 *   weekly/Sun → walks to next Sunday
 *   monthly/15 → walks to next 15th of the month
 *   alternate  → next even-numbered day from startDate
 *   custom/7   → next day that is a multiple of 7 from startDate
 */
export const getNextFireDate = (medicine, timeStr) => {
  const { hours, minutes } = parseTime(timeStr);

  const candidate = new Date();
  candidate.setHours(hours, minutes, 0, 0);

  // If today's slot has already passed, begin the search from tomorrow
  if (candidate.getTime() <= Date.now()) {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(hours, minutes, 0, 0);
  }

  for (let i = 0; i < 366; i++) {
    if (isMedicineScheduledForDate(medicine, candidate)) {
      return new Date(candidate);
    }
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(hours, minutes, 0, 0);
  }

  return null; // unreachable in practice
};

// ─── Next N fire dates (used for batching individual date triggers) ────────────
const getUpcomingOccurrences = (medicine, timeStr, count = 20) => {
  const { hours, minutes } = parseTime(timeStr);
  const results = [];

  const candidate = new Date();
  candidate.setHours(hours, minutes, 0, 0);

  // Start from tomorrow so we don't re-fire something today
  candidate.setDate(candidate.getDate() + 1);
  candidate.setHours(hours, minutes, 0, 0);

  let safety = 0;
  while (results.length < count && safety < 730) {
    if (isMedicineScheduledForDate(medicine, candidate)) {
      results.push(new Date(candidate));
    }
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(hours, minutes, 0, 0);
    safety++;
  }

  return results;
};

// ─── In-app timer store ───────────────────────────────────────────────────────
const inAppTimers = {};

const clearInAppTimer = (id) => {
  const entry = inAppTimers[id];
  if (!entry) return;
  clearTimeout(entry.timeoutId);
  delete inAppTimers[id];
};

const playReminderSound = async () => {
  try {
    const { Audio } = require("expo-av");
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" },
      { shouldPlay: true, volume: 1.0 }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) sound.unloadAsync();
    });
  } catch (e) {
    console.warn("Could not play reminder sound:", e);
  }
};

// ─── Schedule-aware in-app reminder ──────────────────────────────────────────
/**
 * scheduleInAppReminder
 *
 * Fires at the next scheduled occurrence for this medicine+time, then
 * automatically re-schedules itself for the occurrence after that.
 *
 * For daily medicines this produces a daily reminder loop.
 * For weekly/monthly/alternate/custom it fires only on valid days.
 *
 * Note: setTimeout with very large delays (days/weeks) is best-effort in
 * React Native — this is acceptable for the Expo Go fallback. The real
 * Expo Notifications implementation (see commented section below) handles
 * background/killed-app delivery reliably.
 */
const scheduleInAppReminder = ({ id, medicine, time, title, body }) => {
  // Cancel any existing timer for this slot before creating a new one
  clearInAppTimer(id);

  const fireAt = getNextFireDate(medicine, time);
  if (!fireAt) return; // no valid future date (shouldn't happen)

  const delay = Math.max(0, fireAt.getTime() - Date.now());

  const timeoutId = setTimeout(() => {
    playReminderSound();
    DeviceEventEmitter.emit("medtrack-in-app-reminder", { title, message: body });
    delete inAppTimers[id];

    // Reschedule for next occurrence (daily loops every day; others advance
    // to the next valid calendar day for this medicine's schedule)
    scheduleInAppReminder({ id, medicine, time, title, body });
  }, delay);

  inAppTimers[id] = { timeoutId, title, body };
};

// ─── Cancel scheduled notifications ──────────────────────────────────────────
/**
 * cancelNotifications
 *
 * Call this when a medicine is deleted or deactivated so its timers/
 * system notifications are cleaned up.
 *
 * @param {string[]} notificationIds  - the ids returned by scheduleNotifications
 */
export async function cancelNotifications(notificationIds = []) {
  for (const id of notificationIds) {
    if (typeof id === "string" && id.startsWith("inapp_")) {
      clearInAppTimer(id);
    }
    // Dev-build real notifications:
    // else if (!isExpoGo) {
    //   try {
    //     await Notifications.cancelScheduledNotificationAsync(id);
    //   } catch (_) {}
    // }
  }
}

// // ─── Configure foreground notification behaviour (call once at app startup) ───
// export function configureForegroundHandler() {
//   Notifications.setNotificationHandler({
//     handleNotification: async () => ({
//       shouldShowAlert: true,
//       shouldPlaySound: true,
//       shouldSetBadge: false,
//     }),
//   });
// }

// // ─── Android channel ──────────────────────────────────────────────────────────
// export async function setupNotificationChannel() {
//   if (Platform.OS === "android") {
//     await Notifications.setNotificationChannelAsync("medicine-reminders", {
//       name: "Medicine Reminders",
//       importance: Notifications.AndroidImportance.HIGH,
//       sound: true,
//       vibrationPattern: [0, 250, 250, 250],
//     });
//   }
// }

// // ─── Action category ──────────────────────────────────────────────────────────
// export async function setupNotificationCategory() {
//   try {
//     await Notifications.setNotificationCategoryAsync("medicine-reminder", [
//       {
//         identifier: "mark-taken",
//         buttonTitle: "✅ Mark as Taken",
//         options: { opensAppToForeground: true },
//       },
//       {
//         identifier: "ignore",
//         buttonTitle: "Ignore",
//         options: { isDestructive: false, opensAppToForeground: true },
//       },
//     ]);
//   } catch (e) {
//     console.warn("Category setup error:", e);
//   }
// }

// // ─── Permission request ───────────────────────────────────────────────────────
// export async function requestNotificationPermission() {
//   const { status } = await Notifications.getPermissionsAsync();
//   if (status !== "granted") {
//     const result = await Notifications.requestPermissionsAsync();
//     return result.status === "granted";
//   }
//   return true;
// }

// // ─── Notification action handler ──────────────────────────────────────────────
// export async function handleNotificationAction(response) {
//   if (!response) return;
//   const actionId = response.actionIdentifier;
//   const data = response.notification?.request?.content?.data;

//   if (actionId === "ignore" || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
//     await dismissNotification(response);
//     return;
//   }
//   if (!data?.medicineId) { await dismissNotification(response); return; }

//   if (actionId === "mark-taken") {
//     try {
//       const userEmail = await AsyncStorage.getItem("currentUser");
//       if (!userEmail) { await dismissNotification(response); return; }
//       const historyRaw = await AsyncStorage.getItem(`history_${userEmail}`);
//       const history = historyRaw ? JSON.parse(historyRaw) : [];
//       const today = new Date().toDateString();
//       const idx = history.findIndex(
//         (h) => h.medicineId === data.medicineId &&
//                new Date(h.scheduledTime).toDateString() === today && !h.taken
//       );
//       if (idx !== -1) {
//         history[idx].taken = true;
//         history[idx].takenAt = new Date().toISOString();
//         await AsyncStorage.setItem(`history_${userEmail}`, JSON.stringify(history));
//       }
//       const medsRaw = await AsyncStorage.getItem(`medicines_${userEmail}`);
//       const meds = medsRaw ? JSON.parse(medsRaw) : [];
//       const medIdx = meds.findIndex((m) => m.id === data.medicineId);
//       if (medIdx !== -1 && meds[medIdx].remainingQuantity > 0) {
//         meds[medIdx].remainingQuantity -= 1;
//         await AsyncStorage.setItem(`medicines_${userEmail}`, JSON.stringify(meds));
//       }
//     } catch (e) {
//       console.warn("Error handling mark-taken action:", e);
//     } finally {
//       await dismissNotification(response);
//     }
//   }
// }

// ─── Main export: schedule notifications for a medicine ──────────────────────
/**
 * scheduleNotifications
 *
 * Expo Go  → in-app audio + DeviceEventEmitter fallback.
 *            Fires on the correct days for all schedule types.
 *            Self-rescheduling so it keeps working across multiple days.
 *
 * Dev build (uncomment the Notifications block below) →
 *   daily    : repeating CalendarTrigger  { hour, minute, repeats: true }
 *   weekly   : repeating CalendarTrigger  { weekday, hour, minute, repeats: true }
 *              one notification per (weekday × time) pair
 *   monthly  : batched DateTriggers for the next 12 occurrences per time
 *   alternate: batched DateTriggers for the next 30 occurrences per time
 *   custom   : batched DateTriggers for the next 20 occurrences per time
 *
 * iOS hard-cap: 64 scheduled local notifications per app. With the batch
 * limits above a user would need 64+ (time × occurrence) slots to hit it,
 * which is unlikely in practice.
 *
 * @param {object} medicine  - the full medicine object from AsyncStorage
 * @returns {Promise<string[]>} notification IDs to store on the medicine
 */
export async function scheduleNotifications(medicine) {
  const ids = [];
  const scheduleType = medicine.scheduleType ?? "daily";

  // ── Expo Go: in-app fallback ──────────────────────────────────────────────
  if (isExpoGo) {
    for (const time of medicine.times) {
      const id = `inapp_${medicine.id}_${time}`;
      scheduleInAppReminder({
        id,
        medicine,
        time,
        title: "💊 Medicine Reminder",
        body:  `Time to take your ${medicine.name} (${medicine.doseType})`,
      });
      ids.push(id);
    }
    return ids;
  }

  // ── Dev build: real Expo Notifications ───────────────────────────────────
  // Uncomment this entire block when you switch to a development build.
  //
  // for (const time of medicine.times) {
  //   const { hours, minutes } = parseTime(time);
  //   const content = {
  //     title: "💊 Medicine Reminder",
  //     body:  `Time to take your ${medicine.name} (${medicine.doseType})`,
  //     data:  { medicineId: medicine.id, time },
  //     categoryIdentifier: "medicine-reminder",
  //     sound: true,
  //   };
  //
  //   if (scheduleType === "daily") {
  //     // ── Repeating daily trigger ────────────────────────────────────────
  //     const id = await Notifications.scheduleNotificationAsync({
  //       content,
  //       trigger: { hour: hours, minute: minutes, repeats: true },
  //     });
  //     ids.push(id);
  //
  //   } else if (scheduleType === "weekly") {
  //     // ── Repeating weekly trigger — one per selected weekday ────────────
  //     // Expo's weekday field: 1 = Sunday, 2 = Monday, … 7 = Saturday
  //     // Our weekdays array:   0 = Sunday, 1 = Monday, … 6 = Saturday
  //     for (const wd of (medicine.weekdays ?? [])) {
  //       const id = await Notifications.scheduleNotificationAsync({
  //         content,
  //         trigger: { weekday: wd + 1, hour: hours, minute: minutes, repeats: true },
  //       });
  //       ids.push(id);
  //     }
  //
  //   } else {
  //     // ── monthly / alternate / custom: batch individual date triggers ───
  //     // No native repeating trigger exists for these patterns, so we
  //     // schedule the next N occurrences as one-shot DateTriggers.
  //     // ensureTodayHistory + this function should be re-called periodically
  //     // (e.g. on app foreground) to top up the batch as dates are consumed.
  //     const batchSize =
  //       scheduleType === "monthly"   ? 12 :
  //       scheduleType === "alternate" ? 30 : 20; // custom
  //
  //     const occurrences = getUpcomingOccurrences(medicine, time, batchSize);
  //     for (const fireAt of occurrences) {
  //       const id = await Notifications.scheduleNotificationAsync({
  //         content,
  //         trigger: { date: fireAt },
  //       });
  //       ids.push(id);
  //     }
  //   }
  // }

  return ids;
}