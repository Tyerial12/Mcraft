import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { createStarterCharacter } from '../data/catalog';
import { sanitizeClaims } from '../engine/claims';
import { getSurfaceHeight } from '../engine/terrain';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  CharacterProfile,
  WorldAccessMode,
  WorldData,
  WorldMode,
  WorldPlayerState,
} from '../types/game';

const LOCAL_CHAR_PREFIX = 'aethercraft_v2_char_';
const LOCAL_WORLD_PREFIX = 'aethercraft_v2_world_';
const LOCAL_WORLD_PLAYER_PREFIX = 'aethercraft_v2_wp_';

interface SerializedWorldPayload {
  voxelDeltas: WorldData['voxelDeltas'];
  machines: WorldData['machines'];
  cables: WorldData['cables'];
  storageInventory: WorldData['storageInventory'];
  claims: WorldData['claims'];
  playerStates?: Record<string, WorldPlayerState>;
  exploredChunks?: string[];
  tradeOffers?: WorldData['tradeOffers'];
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  createdAtMs?: number;
}

const ALLOWED_PICKAXE_TIERS = new Set([
  'wood',
  'stone',
  'iron',
  'diamond',
  'flux_drill',
  'mining_gadget',
]);

export function saveLocalWorldPlayerState(
  uid: string,
  worldId: string,
  state: WorldPlayerState
): void {
  try {
    localStorage.setItem(`${LOCAL_WORLD_PLAYER_PREFIX}${uid}_${worldId}`, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLocalWorldPlayerState(
  uid: string,
  worldId: string
): WorldPlayerState | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_WORLD_PLAYER_PREFIX}${uid}_${worldId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorldPlayerState;
    if (parsed && typeof parsed === 'object' && parsed.inventory && Array.isArray(parsed.hotbar)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateWorldId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cacheCharacterLocal(char: CharacterProfile) {
  try {
    localStorage.setItem(`${LOCAL_CHAR_PREFIX}${char.uid}`, JSON.stringify(char));
  } catch {
    // Ignore storage quota errors
  }
}

function readCharacterLocal(uid: string): CharacterProfile | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_CHAR_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as CharacterProfile;
  } catch {
    return null;
  }
}

function cacheWorldLocal(world: WorldData) {
  try {
    localStorage.setItem(`${LOCAL_WORLD_PREFIX}${world.id}`, JSON.stringify(world));
  } catch {
    // Ignore storage quota errors
  }
}

export async function loadOrCreateCharacter(
  uid: string,
  displayName: string
): Promise<CharacterProfile> {
  const userRef = doc(db, 'users', uid);
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (typeof data.characterJson === 'string') {
        try {
          const parsed = JSON.parse(data.characterJson) as CharacterProfile;
          if (parsed && parsed.uid === uid && parsed.appearance && parsed.inventory) {
            cacheCharacterLocal(parsed);
            return parsed;
          }
        } catch {
          // Fall through to initialize fresh character
        }
      }
      // Existing legacy /users/{uid} doc without characterJson -> upgrade smoothly using updateDoc!
      const starter = readCharacterLocal(uid) || createStarterCharacter(uid, displayName);
      starter.uid = uid;
      starter.displayName = displayName.trim().slice(0, 64) || 'Builder';
      await saveCharacterToCloud(starter, true);
      return starter;
    }

    const starter = readCharacterLocal(uid) || createStarterCharacter(uid, displayName);
    starter.uid = uid;
    starter.displayName = displayName.trim().slice(0, 64) || 'Builder';
    await saveCharacterToCloud(starter, false);
    return starter;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveCharacterToCloud(
  character: CharacterProfile,
  knownExists?: boolean
): Promise<void> {
  const safePickaxeTier = ALLOWED_PICKAXE_TIERS.has(character.pickaxeTier)
    ? character.pickaxeTier
    : 'wood';
  const cleanChar: CharacterProfile = {
    ...character,
    displayName: (character.displayName || 'Builder').trim().slice(0, 64) || 'Builder',
    characterName: (character.characterName || 'Builder').trim().slice(0, 32) || 'Builder',
    level: Math.max(1, Math.min(999, Math.floor(character.level || 1))),
    credits: Math.max(0, Math.min(99999999, Math.floor(character.credits || 0))),
    pickaxeTier: safePickaxeTier,
    hiredWorkers: Array.isArray(character.hiredWorkers)
      ? character.hiredWorkers.slice(0, 40)
      : [],
    updatedAtMs: Date.now(),
  };
  cacheCharacterLocal(cleanChar);

  const userRef = doc(db, 'users', cleanChar.uid);
  const path = `users/${cleanChar.uid}`;
  let characterJson = JSON.stringify(cleanChar);
  if (characterJson.length > 47000) {
    const trimmedChar: CharacterProfile = {
      ...cleanChar,
      hiredWorkers: (cleanChar.hiredWorkers || []).slice(0, 20),
    };
    characterJson = JSON.stringify(trimmedChar).slice(0, 47000);
  }

  let exists = knownExists;
  if (exists === undefined) {
    try {
      const snap = await getDoc(userRef);
      exists = snap.exists();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  const writeFreshDoc = async () => {
    await setDoc(userRef, {
      uid: cleanChar.uid,
      displayName: cleanChar.displayName,
      characterName: cleanChar.characterName,
      level: cleanChar.level,
      credits: cleanChar.credits,
      pickaxeTier: cleanChar.pickaxeTier,
      characterJson,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  if (exists) {
    try {
      await updateDoc(userRef, {
        displayName: cleanChar.displayName,
        characterName: cleanChar.characterName,
        level: cleanChar.level,
        credits: cleanChar.credits,
        pickaxeTier: cleanChar.pickaxeTier,
        characterJson,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const errCode = (error as { code?: string } | null)?.code;
      if (errCode === 'not-found') {
        try {
          await writeFreshDoc();
          return;
        } catch (createErr) {
          handleFirestoreError(createErr, OperationType.CREATE, path);
        }
      }
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await writeFreshDoc();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

function parseWorldDoc(raw: Record<string, unknown>): WorldData | null {
  if (typeof raw.id !== 'string' || typeof raw.ownerId !== 'string' || typeof raw.worldJson !== 'string') {
    return null;
  }
  try {
    const payload = JSON.parse(raw.worldJson) as Partial<SerializedWorldPayload>;
    const seed = Math.max(1, Math.floor(Number(raw.seed) || 1001));
    const spawnX = Number.isFinite(Number(payload.spawnX)) ? Number(payload.spawnX) : 0.5;
    const spawnZ = Number.isFinite(Number(payload.spawnZ)) ? Number(payload.spawnZ) : 0.5;
    const spawnY = Number.isFinite(Number(payload.spawnY))
      ? Number(payload.spawnY)
      : getSurfaceHeight(seed, Math.floor(spawnX), Math.floor(spawnZ)) + 2;

    const updatedMs =
      raw.updatedAt && typeof (raw.updatedAt as { toMillis?: () => number }).toMillis === 'function'
        ? (raw.updatedAt as { toMillis: () => number }).toMillis()
        : Date.now();
    const createdMs =
      typeof payload.createdAtMs === 'number' && Number.isFinite(payload.createdAtMs)
        ? payload.createdAtMs
        : raw.createdAt && typeof (raw.createdAt as { toMillis?: () => number }).toMillis === 'function'
          ? (raw.createdAt as { toMillis: () => number }).toMillis()
          : updatedMs;

    return {
      id: raw.id,
      ownerId: raw.ownerId,
      ownerName: typeof raw.ownerName === 'string' ? raw.ownerName : 'Builder',
      name: typeof raw.name === 'string' ? raw.name : 'Voxel World',
      seed,
      mode: raw.mode === 'peaceful' ? 'peaceful' : 'survival',
      accessMode:
        raw.accessMode === 'public' || raw.accessMode === 'friends' ? raw.accessMode : 'private',
      inviteCode: typeof raw.inviteCode === 'string' ? raw.inviteCode : generateInviteCode(),
      invitedUids: Array.isArray(raw.invitedUids)
        ? raw.invitedUids.filter((u): u is string => typeof u === 'string').slice(0, 40)
        : [],
      voxelDeltas: payload.voxelDeltas && typeof payload.voxelDeltas === 'object' ? payload.voxelDeltas : {},
      machines: Array.isArray(payload.machines) ? payload.machines : [],
      cables: Array.isArray(payload.cables) ? payload.cables : [],
      storageInventory:
        payload.storageInventory && typeof payload.storageInventory === 'object'
          ? payload.storageInventory
          : {},
      claims: sanitizeClaims(payload.claims),
      playerStates:
        payload.playerStates && typeof payload.playerStates === 'object'
          ? payload.playerStates
          : {},
      exploredChunks: Array.isArray(payload.exploredChunks)
        ? payload.exploredChunks.filter((k): k is string => typeof k === 'string').slice(-256)
        : [],
      tradeOffers: Array.isArray(payload.tradeOffers) ? payload.tradeOffers.slice(0, 40) : [],
      spawnX,
      spawnY,
      spawnZ,
      createdAtMs: createdMs,
      updatedAtMs: updatedMs,
    };
  } catch {
    return null;
  }
}

export async function listOwnedWorlds(ownerId: string): Promise<WorldData[]> {
  const path = 'worlds';
  try {
    const q = query(collection(db, 'worlds'), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    const worlds: WorldData[] = [];
    snap.forEach((docSnap) => {
      const parsed = parseWorldDoc(docSnap.data());
      if (parsed) worlds.push(parsed);
    });
    return worlds.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listPublicCloudWorlds(): Promise<WorldData[]> {
  const path = 'worlds';
  try {
    const q = query(collection(db, 'worlds'), where('accessMode', '==', 'public'));
    const snap = await getDocs(q);
    const worlds: WorldData[] = [];
    snap.forEach((docSnap) => {
      const parsed = parseWorldDoc(docSnap.data());
      if (parsed) worlds.push(parsed);
    });
    return worlds.sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, 24);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createNewWorldInCloud(params: {
  ownerId: string;
  ownerName: string;
  name: string;
  seed: number;
  mode: WorldMode;
  accessMode: WorldAccessMode;
}): Promise<WorldData> {
  const id = generateWorldId();
  const cleanSeed = Math.max(1, Math.min(2147483647, Math.floor(params.seed) || Math.floor(Math.random() * 900000) + 1000));
  const spawnY = getSurfaceHeight(cleanSeed, 0, 0) + 2;
  const world: WorldData = {
    id,
    ownerId: params.ownerId,
    ownerName: params.ownerName.trim().slice(0, 64) || 'Builder',
    name: params.name.trim().slice(0, 48) || 'Industrial Frontier',
    seed: cleanSeed,
    mode: params.mode,
    accessMode: params.accessMode,
    inviteCode: generateInviteCode(),
    invitedUids: [],
    voxelDeltas: {},
    machines: [],
    cables: [],
    storageInventory: {},
    claims: [],
    playerStates: {},
    exploredChunks: [],
    spawnX: 0.5,
    spawnY,
    spawnZ: 0.5,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };

  const payload: SerializedWorldPayload = {
    voxelDeltas: world.voxelDeltas,
    machines: world.machines,
    cables: world.cables,
    storageInventory: world.storageInventory,
    claims: world.claims,
    playerStates: world.playerStates,
    exploredChunks: world.exploredChunks,
    spawnX: world.spawnX,
    spawnY: world.spawnY,
    spawnZ: world.spawnZ,
    createdAtMs: world.createdAtMs,
  };

  const worldRef = doc(db, 'worlds', world.id);
  const path = `worlds/${world.id}`;
  try {
    await setDoc(worldRef, {
      id: world.id,
      ownerId: world.ownerId,
      ownerName: world.ownerName,
      name: world.name,
      seed: world.seed,
      mode: world.mode,
      accessMode: world.accessMode,
      inviteCode: world.inviteCode,
      invitedUids: world.invitedUids,
      worldJson: JSON.stringify(payload),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    cacheWorldLocal(world);
    return world;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveWorldToCloud(world: WorldData): Promise<void> {
  const cleanName = world.name.trim().slice(0, 48) || 'Industrial Frontier';
  const cleanOwnerName = world.ownerName.trim().slice(0, 64) || 'Builder';
  const safeMode: WorldMode = world.mode === 'peaceful' ? 'peaceful' : 'survival';
  const safeAccessMode: WorldAccessMode =
    world.accessMode === 'public' || world.accessMode === 'friends' ? world.accessMode : 'private';
  const rawInvite = (world.inviteCode || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  const safeInviteCode = rawInvite.length >= 4 ? rawInvite : generateInviteCode();

  // Cap deltas and enforce firestore.rules <= 350,000 byte worldJson limit
  let deltaEntries = Object.entries(world.voxelDeltas || {});
  if (deltaEntries.length > 2600) {
    deltaEntries = deltaEntries.slice(-2600);
  }
  let cappedDeltas = Object.fromEntries(deltaEntries);

  const payload: SerializedWorldPayload = {
    voxelDeltas: cappedDeltas,
    machines: (world.machines || []).slice(0, 120),
    cables: (world.cables || []).slice(0, 500),
    storageInventory: world.storageInventory || {},
    claims: sanitizeClaims(world.claims),
    playerStates: world.playerStates || {},
    exploredChunks: Array.isArray(world.exploredChunks) ? world.exploredChunks.slice(-256) : [],
    tradeOffers: Array.isArray(world.tradeOffers) ? world.tradeOffers.slice(0, 40) : [],
    spawnX: Number.isFinite(world.spawnX) ? world.spawnX : 0.5,
    spawnY: Number.isFinite(world.spawnY) ? world.spawnY : 4,
    spawnZ: Number.isFinite(world.spawnZ) ? world.spawnZ : 0.5,
    createdAtMs: world.createdAtMs,
  };

  let serialized = JSON.stringify(payload);
  while (serialized.length > 340000 && deltaEntries.length > 200) {
    deltaEntries = deltaEntries.slice(Math.floor(deltaEntries.length * 0.25));
    cappedDeltas = Object.fromEntries(deltaEntries);
    payload.voxelDeltas = cappedDeltas;
    serialized = JSON.stringify(payload);
  }
  if (serialized.length > 340000 && payload.exploredChunks && payload.exploredChunks.length > 32) {
    payload.exploredChunks = payload.exploredChunks.slice(-32);
    serialized = JSON.stringify(payload);
  }

  cacheWorldLocal({
    ...world,
    mode: safeMode,
    accessMode: safeAccessMode,
    inviteCode: safeInviteCode,
    voxelDeltas: cappedDeltas,
    updatedAtMs: Date.now(),
  });

  const worldRef = doc(db, 'worlds', world.id);
  const path = `worlds/${world.id}`;

  try {
    await updateDoc(worldRef, {
      ownerName: cleanOwnerName,
      name: cleanName,
      mode: safeMode,
      accessMode: safeAccessMode,
      inviteCode: safeInviteCode,
      invitedUids: (world.invitedUids || []).slice(0, 40),
      worldJson: serialized,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWorldFromCloud(worldId: string): Promise<void> {
  const path = `worlds/${worldId}`;
  try {
    await deleteDoc(doc(db, 'worlds', worldId));
    try {
      localStorage.removeItem(`${LOCAL_WORLD_PREFIX}${worldId}`);
    } catch {
      // Ignore
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
