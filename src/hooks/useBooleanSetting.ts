import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/** Reads/writes a boolean value, reactively, from either the shared
 * (synced) appSettings table or the device-local deviceSettings table. */
export function useBooleanSetting(
  key: string,
  fallback: boolean,
  table: 'appSettings' | 'deviceSettings' = 'appSettings',
): [boolean, (value: boolean) => void] {
  const value = useLiveQuery(async () => {
    const record = await db[table].get(key);
    return (record?.value as boolean) ?? fallback;
  }, [key, table]);

  const setValue = (next: boolean) => {
    void db[table].put({ key, value: next });
  };

  return [value ?? fallback, setValue];
}
