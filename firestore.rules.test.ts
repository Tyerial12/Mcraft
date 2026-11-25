/**
 * Payload-First Security Rule Test Specification for Aethervale: Brass Highlands.
 * Validates all Dirty Dozen attack vectors against firestore.rules.
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Unauthenticated Read of SaveSlot',
    operation: 'get',
    path: '/users/alice/saves/slot_1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    name: 'Cross-User Read of SaveSlot',
    operation: 'get',
    path: '/users/alice/saves/slot_1',
    auth: { uid: 'bob', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    name: 'Cross-User List Scraping',
    operation: 'list',
    path: '/users/alice/saves',
    auth: { uid: 'bob', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: '/users/alice/saves/slot_1',
    auth: { uid: 'alice', email_verified: true },
    payload: { slotId: 'slot_1', ownerId: 'bob', heroName: 'Spoof' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/users/alice',
    auth: { uid: 'alice', email_verified: false },
    payload: { uid: 'alice', displayName: 'Alice' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Shadow Field Injection on Save Update',
    operation: 'update',
    path: '/users/alice/saves/slot_1',
    auth: { uid: 'alice', email_verified: true },
    payload: { isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'Path ID Poisoning',
    operation: 'create',
    path: '/users/alice/saves/invalid_slot_id_payload',
    auth: { uid: 'alice', email_verified: true },
    payload: { slotId: 'invalid_slot_id_payload', ownerId: 'alice' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    name: 'Orphaned Save Write without Parent UserProfile',
    operation: 'create',
    path: '/users/newuser/saves/slot_1',
    auth: { uid: 'newuser', email_verified: true },
    payload: { slotId: 'slot_1', ownerId: 'newuser' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/users/alice/saves/slot_1',
    auth: { uid: 'alice', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'Immutable Field Mutation (ownerId / createdAt)',
    operation: 'update',
    path: '/users/alice/saves/slot_1',
    auth: { uid: 'alice', email_verified: true },
    payload: { ownerId: 'charlie' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Value Poisoning & Size Exhaustion',
    operation: 'update',
    path: '/users/alice/saves/slot_1',
    auth: { uid: 'alice', email_verified: true },
    payload: { heroName: 'A'.repeat(200), heroLevel: 9999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Array Overflow Attack on Inventory',
    operation: 'update',
    path: '/users/alice/saves/slot_1',
    auth: { uid: 'alice', email_verified: true },
    payload: { inventory: Array.from({ length: 120 }, (_, i) => ({ itemId: `item_${i}`, quantity: 1 })) },
    expected: 'PERMISSION_DENIED',
  },
];
