import { useEffect } from 'react';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { exportToGoogleDrive } from '@/services/googleDrive/googleDriveService';
import { SETTINGS_KEYS } from '@/models';

/**
 * Watches for the daily 23:59 auto-backup window (per Settings' auto
 * backup toggle). Checks every 5 minutes while the app is open, plus
 * once on load in case it's opened after 23:59 with no backup yet
 * today — matches Media Journal's "runs at 23:59 or as soon as it's
 * next opened" behaviour.
 */
export function useAutoBackup() {
  useEffect(() => {
    const check = async () => {
      const enabledRecord = await db.appSettings.get(SETTINGS_KEYS.autoBackupEnabled);
      if (!enabledRecord?.value) return;

      const lastRecord = await db.appSettings.get(SETTINGS_KEYS.lastAutoBackupAt);
      const lastRun = lastRecord?.value as string | undefined;
      const today = dayjs().format('YYYY-MM-DD');
      const alreadyRanToday = lastRun && dayjs(lastRun).format('YYYY-MM-DD') === today;
      if (alreadyRanToday) return;

      const isPastBackupTime = dayjs().hour() === 23 && dayjs().minute() >= 59;
      const isFirstOpenToday = !alreadyRanToday && dayjs().hour() >= 0;
      if (!isPastBackupTime && !isFirstOpenToday) return;

      try {
        await exportToGoogleDrive();
        await db.appSettings.put({ key: SETTINGS_KEYS.lastAutoBackupAt, value: new Date().toISOString() });
      } catch {
        // Silent — user will notice via "last backup" timestamp in Settings.
      }
    };

    void check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
}
