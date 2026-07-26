import { db, setCachedHouseholdRealmId } from '@/services/database/db';

/**
 * Household sync via Dexie Cloud. Replaces the old shared "household
 * code" — real accounts (email magic link, no passwords) plus a shared
 * "Household" realm that both members' devices sync through.
 *
 * How it fits together:
 *  - Signing in uses Dexie Cloud's built-in login dialog (email + OTP
 *    code) — we just trigger it via login().
 *  - The first person to sign in calls setUpHouseholdRealm(), which
 *    creates a realm named "Household" and moves all existing local
 *    data (meals, planned meals, shopping list, shared settings) into
 *    it, so it starts syncing.
 *  - That person invites their partner by email via inviteMember(). The
 *    partner sees the invite in Settings (db.cloud.invites) and accepts
 *    it — from then on both devices sync through the same realm.
 *  - New records created after setup are auto-stamped with the
 *    household realm id (see the 'creating' hooks registered in
 *    services/database/db.ts), so day-to-day use never has to think
 *    about realms.
 */

const HOUSEHOLD_REALM_NAME = 'Household';

/** Finds the household realm the current user already belongs to
 * (as owner or invited member), if any. */
export async function findHouseholdRealm(): Promise<{ realmId: string; name?: string } | undefined> {
  const realms = await db.realms.where('name').equals(HOUSEHOLD_REALM_NAME).toArray();
  return realms[0];
}

/** One-time setup run by whoever sets up sync first: creates the shared
 * realm and moves all existing local data into it. Safe to call even if
 * a household realm already exists — it's a no-op in that case. */
export async function setUpHouseholdRealm(): Promise<string> {
  const existing = await findHouseholdRealm();
  if (existing) {
    setCachedHouseholdRealmId(existing.realmId);
    return existing.realmId;
  }

  const realmId = await db.transaction(
    'rw',
    [db.realms, db.meals, db.plannedMeals, db.shoppingListItems, db.appSettings],
    async () => {
      const newRealmId = await db.realms.add({ name: HOUSEHOLD_REALM_NAME });
      await db.meals.toCollection().modify({ realmId: newRealmId });
      await db.plannedMeals.toCollection().modify({ realmId: newRealmId });
      await db.shoppingListItems.toCollection().modify({ realmId: newRealmId });
      await db.appSettings.toCollection().modify({ realmId: newRealmId });
      return newRealmId;
    },
  );

  setCachedHouseholdRealmId(realmId);
  return realmId;
}

/** Invites a household member by email, with full read/write access to
 * the shared realm — there's no concept of separate roles/permissions
 * in this app, everyone in the household can edit everything. */
export async function inviteMember(realmId: string, email: string): Promise<void> {
  await db.members.add({
    realmId,
    email,
    invite: true,
    permissions: { add: '*', update: { '*': '*' }, manage: '*' },
  });
}

/** Triggers Dexie Cloud's built-in login UI (email entry, then OTP code
 * sent to that email — no passwords). */
export async function login(): Promise<void> {
  await db.cloud.login();
}

export async function logout(): Promise<void> {
  await db.cloud.logout();
  setCachedHouseholdRealmId(null);
}
