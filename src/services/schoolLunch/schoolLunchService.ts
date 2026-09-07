import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { newId } from '@/utils/id';
import { ALL_KIDS, MAX_SCHOOL_LUNCH_CYCLE_WEEKS, SETTINGS_KEYS } from '@/models';
import type { Kid, SchoolLunchException, SchoolLunchMenu, SchoolLunchOverride } from '@/models';

// ---------------------------------------------------------------------
// Kids
// ---------------------------------------------------------------------

export async function getKids(): Promise<Kid[]> {
  return db.kids.orderBy('name').toArray();
}

export async function addKid(name: string): Promise<Kid | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const kid: Kid = { id: newId(), name: trimmed, createdAt: new Date().toISOString() };
  await db.kids.put(kid);
  return kid;
}

/** Deletes a kid and cascades to their assigned menus and any
 * single-day overrides for them — a menu without an owning kid isn't
 * meaningful, and orphaned overrides would just be dead rows. Menus
 * assigned to ALL_KIDS are left alone even if this was the last kid;
 * the household can reassign or delete those separately. */
export async function deleteKid(id: string): Promise<void> {
  const [menus, overrides] = await Promise.all([
    db.schoolLunchMenus.where('kidId').equals(id).toArray(),
    db.schoolLunchOverrides.where('kidId').equals(id).toArray(),
  ]);
  await db.schoolLunchMenus.bulkDelete(menus.map((m) => m.id));
  await db.schoolLunchOverrides.bulkDelete(overrides.map((o) => o.id));
  await db.kids.delete(id);
}

// ---------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------

export async function getMenus(): Promise<SchoolLunchMenu[]> {
  return db.schoolLunchMenus.toArray();
}

export async function getMenu(id: string): Promise<SchoolLunchMenu | undefined> {
  return db.schoolLunchMenus.get(id);
}

export function clampCycleWeeks(weeks: number): number {
  if (Number.isNaN(weeks)) return 1;
  return Math.min(MAX_SCHOOL_LUNCH_CYCLE_WEEKS, Math.max(1, Math.round(weeks)));
}

/** Resizes the `days` grid to match a new cycle length, preserving any
 * weeks that still fit and padding new weeks with blank days. Used
 * both for a brand-new menu and whenever the cycle-length field
 * changes in the editor. */
export function resizeCycleDays(days: string[][], newWeeks: number): string[][] {
  const clamped = clampCycleWeeks(newWeeks);
  return Array.from({ length: clamped }, (_, w) => days[w] ?? ['', '', '', '', '']);
}

export function emptyMenu(): SchoolLunchMenu {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: '',
    kidId: '',
    cycleWeeks: 1,
    startDate: dayjs().format('YYYY-MM-DD'),
    days: resizeCycleDays([], 1),
    exceptions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveMenu(menu: SchoolLunchMenu): Promise<void> {
  await db.schoolLunchMenus.put({ ...menu, updatedAt: new Date().toISOString() });
}

/** Deletes the menu. Single-day overrides aren't menu-scoped (they're
 * keyed by date + kid), so nothing to cascade there — they simply stop
 * being backed by a cycle, and the resolver falls through to "no menu"
 * for that kid from this point on. */
export async function deleteMenu(id: string): Promise<void> {
  await db.schoolLunchMenus.delete(id);
}

// ---------------------------------------------------------------------
// Household-wide holidays (apply to every menu)
// ---------------------------------------------------------------------

export async function getHouseholdHolidays(): Promise<SchoolLunchException[]> {
  const record = await db.appSettings.get(SETTINGS_KEYS.schoolLunchHolidays);
  return (record?.value as SchoolLunchException[] | undefined) ?? [];
}

export async function saveHouseholdHolidays(list: SchoolLunchException[]): Promise<void> {
  await db.appSettings.put({ key: SETTINGS_KEYS.schoolLunchHolidays, value: list });
}

// ---------------------------------------------------------------------
// Single-day overrides
// ---------------------------------------------------------------------

function overrideId(date: string, kidId: string): string {
  return `${date}:${kidId}`;
}

export async function getOverride(date: string, kidId: string): Promise<SchoolLunchOverride | undefined> {
  return db.schoolLunchOverrides.get(overrideId(date, kidId));
}

/** Sets (or replaces) this kid's override for a single day. An empty
 * `text` is valid and means "explicitly no lunch today" — distinct
 * from clearOverride, which removes the override entirely and falls
 * back to whatever the cycle says. */
export async function setOverride(date: string, kidId: string, text: string): Promise<void> {
  await db.schoolLunchOverrides.put({ id: overrideId(date, kidId), date, kidId, text });
}

export async function clearOverride(date: string, kidId: string): Promise<void> {
  await db.schoolLunchOverrides.delete(overrideId(date, kidId));
}

// ---------------------------------------------------------------------
// Resolver — turns menus + exceptions + overrides into what to display
// ---------------------------------------------------------------------

/** Mon–Fri only — school lunch cycles never apply on weekends. */
export function isSchoolWeekday(date: string): boolean {
  const dow = dayjs(date).day(); // 0=Sun..6=Sat
  return dow >= 1 && dow <= 5;
}

function matchesException(date: string, exceptions: SchoolLunchException[]): SchoolLunchException | undefined {
  return exceptions.find((ex) => {
    if (ex.date) return ex.date === date;
    if (ex.startDate && ex.endDate) {
      return !dayjs(date).isBefore(ex.startDate, 'day') && !dayjs(date).isAfter(ex.endDate, 'day');
    }
    return false;
  });
}

interface CycleResolution {
  text: string;
  /** Set when a school-week date has no lunch because it fell on this
   * menu's own exception or a household holiday. */
  exceptionLabel?: string;
}

/** Resolves what a single menu's cycle says for a date, before
 * overrides are considered. Returns null for dates the cycle simply
 * doesn't cover (weekend, or before the cycle's start date). */
export function resolveCycleText(
  menu: SchoolLunchMenu,
  date: string,
  householdHolidays: SchoolLunchException[],
): CycleResolution | null {
  if (!isSchoolWeekday(date)) return null;
  if (dayjs(date).isBefore(menu.startDate, 'day')) return null;

  const hit = matchesException(date, menu.exceptions) ?? matchesException(date, householdHolidays);
  if (hit) return { text: '', exceptionLabel: hit.label || 'No school' };

  const cycleWeeks = clampCycleWeeks(menu.cycleWeeks);
  const weekIndex = Math.floor(dayjs(date).diff(menu.startDate, 'day') / 7) % cycleWeeks;
  const dayIndex = dayjs(date).day() - 1; // Mon=0..Fri=4
  const text = menu.days[weekIndex]?.[dayIndex] ?? '';
  return { text };
}

export interface KidLunchDisplay {
  kidId: string;
  kidName: string;
  menuId: string;
  menuName: string;
  /** Final text to show — an override wins over the cycle. Empty
   * string means nothing to show (exception day, override explicitly
   * cleared it, or the cycle cell itself was left blank). */
  text: string;
  exceptionLabel?: string;
  isOverride: boolean;
}

function pickMenuForKid(kidId: string, menus: SchoolLunchMenu[]): SchoolLunchMenu | undefined {
  return menus.find((m) => m.kidId === kidId) ?? menus.find((m) => m.kidId === ALL_KIDS);
}

/** Every kid who has an assigned menu (specific or ALL_KIDS), with
 * what to show for that one date — override first, else the resolved
 * cycle text. Kids without any assigned menu are omitted entirely, so
 * callers don't need to filter. */
export async function getLunchDisplaysForDate(date: string): Promise<KidLunchDisplay[]> {
  const [kids, menus, holidays, overrides] = await Promise.all([
    db.kids.toArray(),
    db.schoolLunchMenus.toArray(),
    getHouseholdHolidays(),
    db.schoolLunchOverrides.where('date').equals(date).toArray(),
  ]);
  const overrideByKid = new Map(overrides.map((o) => [o.kidId, o]));
  return buildDisplays(date, kids, menus, holidays, overrideByKid);
}

/** Same resolution as getLunchDisplaysForDate, but for every date in
 * an inclusive range at once — used by the month calendar's badges so
 * it isn't re-querying per cell. Only dates with at least one display
 * are present in the returned map. */
export async function getLunchDisplaysForRange(
  startDate: string,
  endDate: string,
): Promise<Map<string, KidLunchDisplay[]>> {
  const [kids, menus, holidays, overrides] = await Promise.all([
    db.kids.toArray(),
    db.schoolLunchMenus.toArray(),
    getHouseholdHolidays(),
    db.schoolLunchOverrides.where('date').between(startDate, endDate, true, true).toArray(),
  ]);
  const overrideByKey = new Map(overrides.map((o) => [`${o.date}:${o.kidId}`, o]));

  const result = new Map<string, KidLunchDisplay[]>();
  if (kids.length === 0 || menus.length === 0) return result;

  for (let d = dayjs(startDate); !d.isAfter(endDate, 'day'); d = d.add(1, 'day')) {
    const date = d.format('YYYY-MM-DD');
    const overrideByKid = new Map(
      kids
        .map((kid) => [kid.id, overrideByKey.get(`${date}:${kid.id}`)] as const)
        .filter((pair): pair is [string, SchoolLunchOverride] => !!pair[1]),
    );
    const displays = buildDisplays(date, kids, menus, holidays, overrideByKid);
    if (displays.length) result.set(date, displays);
  }
  return result;
}

function buildDisplays(
  date: string,
  kids: Kid[],
  menus: SchoolLunchMenu[],
  holidays: SchoolLunchException[],
  overrideByKid: Map<string, SchoolLunchOverride>,
): KidLunchDisplay[] {
  const displays: KidLunchDisplay[] = [];
  for (const kid of kids) {
    const menu = pickMenuForKid(kid.id, menus);
    if (!menu) continue;

    const override = overrideByKid.get(kid.id);
    if (override) {
      displays.push({
        kidId: kid.id,
        kidName: kid.name,
        menuId: menu.id,
        menuName: menu.name,
        text: override.text,
        isOverride: true,
      });
      continue;
    }

    const resolved = resolveCycleText(menu, date, holidays);
    displays.push({
      kidId: kid.id,
      kidName: kid.name,
      menuId: menu.id,
      menuName: menu.name,
      text: resolved?.text ?? '',
      exceptionLabel: resolved?.exceptionLabel,
      isOverride: false,
    });
  }
  return displays;
}
