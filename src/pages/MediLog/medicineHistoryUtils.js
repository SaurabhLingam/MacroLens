// services/medicineHistoryUtils.js
//
// Drop this in the same folder as notificationService.js.
//
// Call ensureTodayHistory(userEmail) from:
//   - MedicineWellnessSection  → inside loadData's useCallback
//   - MediLogDash              → inside loadTodaySummary
//   - History                  → replace the inline auto-mark block in loadHistory
//
// That's it. No other changes needed to get today's doses showing up correctly.

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Time parser (mirrors LogNewMedicine exactly) ─────────────────────────────
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

// ─── Full calendar days between two dates (time-of-day ignored) ───────────────
const daysBetween = (dateA, dateB) => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round(Math.abs(a - b) / (24 * 60 * 60 * 1000));
};

// ─── Should this medicine be taken on `date`? ─────────────────────────────────
/**
 * isMedicineScheduledForDate
 *
 * Returns true if `med` should have a dose seeded on `date`.
 * Falls back to daily for medicines created before scheduleType was added,
 * so old data is never silently broken.
 *
 * scheduleType values:
 *   "daily"     → every day
 *   "alternate" → every other day counting from startDate
 *   "weekly"    → only on days in med.weekdays (0 = Sun … 6 = Sat)
 *   "monthly"   → only on dates in med.monthDays (1 … 31)
 *   "custom"    → every med.intervalDays days counting from startDate
 */
export function isMedicineScheduledForDate(med, date) {
  const scheduleType = med.scheduleType ?? "daily";

  switch (scheduleType) {
    case "daily":
      return true;

    case "alternate": {
      const start = med.startDate ? new Date(med.startDate) : date;
      return daysBetween(start, date) % 2 === 0;
    }

    case "weekly": {
      const weekdays = med.weekdays ?? [];
      return weekdays.includes(date.getDay());
    }

    case "monthly": {
      const monthDays = med.monthDays ?? [];
      return monthDays.includes(date.getDate());
    }

    case "custom": {
      const interval = med.intervalDays ?? 2;
      const start    = med.startDate ? new Date(med.startDate) : date;
      return daysBetween(start, date) % interval === 0;
    }

    default:
      return true;
  }
}

// ─── Core utility ─────────────────────────────────────────────────────────────
/**
 * ensureTodayHistory
 *
 * Does three things in one AsyncStorage round-trip:
 *
 * 0. CLEAN STALE ENTRIES — removes any non-taken today entries for medicines
 *    that are not scheduled today (handles data logged before schedule-aware
 *    seeding was introduced). Taken entries are never touched.
 *
 * 1. SEED — for every active medicine scheduled for today, creates history
 *    entries if they don't already exist. Uses the same ID format as
 *    LogNewMedicine so there are never duplicates.
 *
 * 2. AUTO-MARK MISSED — any past-due pending entry (scheduledTime < now) gets
 *    markedMissed: true so counts are accurate everywhere.
 *
 * Safe to call on every screen focus — bails out immediately if nothing changed.
 *
 * @param {string} userEmail
 * @returns {Promise<void>}
 */
export async function ensureTodayHistory(userEmail) {
  if (!userEmail) return;

  try {
    const [medsRaw, historyRaw] = await Promise.all([
      AsyncStorage.getItem(`medicines_${userEmail}`),
      AsyncStorage.getItem(`history_${userEmail}`),
    ]);

    const meds    = medsRaw    ? JSON.parse(medsRaw)    : [];
    let   history = historyRaw ? JSON.parse(historyRaw) : [];

    const today    = new Date();
    const todayStr = today.toDateString();
    const now      = Date.now();

    const activeMeds = meds.filter((m) => m.active !== false);

    // Fast lookup: medicineId → medicine object
    const medMap = new Map(activeMeds.map((m) => [m.id, m]));

    let dirty = false;

    // ── 0. Remove stale today entries for medicines not scheduled today ────────
    //
    // This cleans up entries that were created before schedule-aware seeding,
    // e.g. Vitamin D (weekly/Sunday) showing up on a Tuesday.
    // Never removes taken: true entries — those are the user's real history.
    //
    const beforeClean = history.length;
    history = history.filter((entry) => {
      // Keep everything outside today — this function only manages today
      if (new Date(entry.scheduledTime).toDateString() !== todayStr) return true;
      // Never delete what the user has already marked
      if (entry.taken) return true;
      // Keep entry only if the medicine is scheduled for today
      const med = medMap.get(entry.medicineId);
      if (!med) return true; // medicine was deleted; leave the orphan alone
      return isMedicineScheduledForDate(med, today);
    });
    if (history.length !== beforeClean) dirty = true;

    // ── 1. Seed missing entries for today ─────────────────────────────────────
    const existingIds = new Set(history.map((h) => h.id));

    for (const med of activeMeds) {
      // "As needed" medicines have no fixed times
      if (!med.times || !med.times.length) continue;

      // Skip if not on today's schedule
      if (!isMedicineScheduledForDate(med, today)) continue;

      for (const time of med.times) {
        const entryId = `${med.id}_${time}_${todayStr}`;
        if (existingIds.has(entryId)) continue;

        const { hours, minutes } = parseTime(time);
        const scheduled = new Date(today);
        scheduled.setHours(hours, minutes, 0, 0);

        history.push({
          id:            entryId,
          medicineId:    med.id,
          medicineName:  med.name,
          doseType:      med.doseType,
          time,
          scheduledTime: scheduled.toISOString(),
          taken:         false,
          takenAt:       null,
        });

        existingIds.add(entryId);
        dirty = true;
      }
    }

    // ── 2. Auto-mark past-due entries as missed ───────────────────────────────
    for (const entry of history) {
      if (
        !entry.taken &&
        !entry.markedMissed &&
        new Date(entry.scheduledTime).getTime() < now
      ) {
        entry.markedMissed = true;
        dirty = true;
      }
    }

    // ── Write back only if something changed ──────────────────────────────────
    if (dirty) {
      await AsyncStorage.setItem(`history_${userEmail}`, JSON.stringify(history));
    }
  } catch (e) {
    console.warn("ensureTodayHistory error:", e);
  }
}