import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/** Reads/writes a boolean value in appSettings, reactively. */
export function useBooleanSetting(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const value = useLiveQuery(async () => {
    const record = await db.appSettings.get(key);
    return (record?.value as boolean) ?? fallback;
  }, [key]);

  const setValue = (next: boolean) => {
    void db.appSettings.put({ key, value: next });
  };

  return [value ?? fallback, setValue];
}
