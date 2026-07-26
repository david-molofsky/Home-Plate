import { useEffect } from 'react';
import { useLiveQuery, useObservable } from 'dexie-react-hooks';
import { db, isCloudConfigured, setCachedHouseholdRealmId } from '@/services/database/db';

/**
 * Keeps the in-memory "which realm do new records belong to" cache
 * (see householdSyncService.registerRealmHooks) in sync with reality,
 * and hands components the pieces they need to render sync status:
 * the signed-in user, the household realm (once set up), and its
 * member list.
 */
export function useHouseholdRealm() {
  const currentUser = useObservable(db.cloud.currentUser);
  const syncState = useObservable(db.cloud.syncState);
  const invites = useObservable(db.cloud.invites);

  const householdRealm = useLiveQuery(async () => {
    if (!isCloudConfigured || !currentUser?.isLoggedIn) return null;
    const realms = await db.realms.where('name').equals('Household').toArray();
    return realms[0] ?? null;
  }, [currentUser?.isLoggedIn]);

  const members = useLiveQuery(async () => {
    if (!householdRealm) return [];
    return db.members.where('realmId').equals(householdRealm.realmId).toArray();
  }, [householdRealm?.realmId]);

  useEffect(() => {
    setCachedHouseholdRealmId(householdRealm?.realmId ?? null);
  }, [householdRealm?.realmId]);

  return {
    currentUser,
    syncState,
    invites: invites ?? [],
    householdRealm: householdRealm ?? null,
    members: members ?? [],
  };
}
