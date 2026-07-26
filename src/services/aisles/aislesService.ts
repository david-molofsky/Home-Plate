import { db } from '@/services/database/db';
import { newId } from '@/utils/id';
import { DEFAULT_AISLES, SETTINGS_KEYS } from '@/models';
import type { AisleConfig } from '@/models';

/** Reads the household's aisle list, seeding DEFAULT_AISLES the first
 * time (no aisles saved yet). Order in the returned array is the
 * display/grouping order — see reorderAisles. Safe to call from
 * useLiveQuery: reads (and, on first run only, writes) db.appSettings,
 * so it stays reactive to changes made elsewhere in this file. */
export async function getAisleConfig(): Promise<AisleConfig[]> {
  const record = await db.appSettings.get(SETTINGS_KEYS.aisles);
  if (record?.value) return record.value as AisleConfig[];
  await db.appSettings.put({ key: SETTINGS_KEYS.aisles, value: DEFAULT_AISLES });
  return DEFAULT_AISLES;
}

async function saveAisleConfig(config: AisleConfig[]): Promise<void> {
  await db.appSettings.put({ key: SETTINGS_KEYS.aisles, value: config });
}

/** Persists a full reorder — the caller (drag-and-drop UI) computes the
 * new array locally and hands it back for saving. */
export async function reorderAisles(config: AisleConfig[]): Promise<void> {
  await saveAisleConfig(config);
}

export async function addAisle(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = await getAisleConfig();
  await saveAisleConfig([...current, { id: newId(), name: trimmed, hidden: false }]);
}

/** Toggles an aisle's hidden state, refusing to hide the last visible
 * aisle (there always has to be somewhere to put a new ingredient).
 * Returns ok: false without saving if that guard trips. */
export async function toggleAisleHidden(id: string): Promise<{ ok: boolean }> {
  const current = await getAisleConfig();
  const target = current.find((a) => a.id === id);
  if (!target) return { ok: false };

  const willBeHidden = !target.hidden;
  const visibleCount = current.filter((a) => !a.hidden).length;
  if (willBeHidden && visibleCount <= 1) return { ok: false };

  await saveAisleConfig(current.map((a) => (a.id === id ? { ...a, hidden: willBeHidden } : a)));
  return { ok: true };
}

export function visibleAisles(config: AisleConfig[]): AisleConfig[] {
  return config.filter((a) => !a.hidden);
}

/** Looks up an aisle's display name by id, falling back to the id
 * itself so a stray/unrecognized aisle id never disappears silently. */
export function aisleName(config: AisleConfig[], id: string): string {
  return config.find((a) => a.id === id)?.name ?? id;
}
