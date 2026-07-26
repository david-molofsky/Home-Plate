import { db } from '@/services/database/db';
import { newId } from '@/utils/id';
import { DEFAULT_AISLES, SETTINGS_KEYS } from '@/models';
import type { AisleConfig } from '@/models';

/** Reads the household's aisle list, falling back to DEFAULT_AISLES
 * in memory if nothing's been saved yet. Order in the returned array
 * is the display/grouping order — see reorderAisles. Read-only (no
 * writes), so it's safe to call from useLiveQuery: a liveQuery querier
 * must never open a readwrite transaction, or Dexie throws
 * ReadOnlyError and the component tree blanks out. The default list
 * only gets persisted once the household actually changes it (add/
 * toggle/reorder, below), which is fine — callers always get a valid
 * list either way. */
export async function getAisleConfig(): Promise<AisleConfig[]> {
  const record = await db.appSettings.get(SETTINGS_KEYS.aisles);
  return (record?.value as AisleConfig[] | undefined) ?? DEFAULT_AISLES;
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
