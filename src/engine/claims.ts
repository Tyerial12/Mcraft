import type {
  ClaimPermissionKey,
  LandClaim12x12,
  PersonalSpawnPoint,
  TrustedFriend,
  TrustedFriendPermissions,
} from '../types/game.ts';

export const CLAIM_SIZE = 12; // 1 chunk is 12×12 blocks
export const CLAIM_TWO_CHUNK_SPAN = 24; // 2 chunks side-by-side is 24×12 (or 12×24) blocks
export const MAX_CLAIMS_PER_WORLD = 32;
export const MAX_CLAIMS_PER_PLAYER = 4;
export const MAX_TRUSTED_FRIENDS = 20;

export const DEFAULT_TRUSTED_PERMISSIONS: TrustedFriendPermissions = {
  build: true,
  toggleMachines: true,
  openChests: true,
  useLevers: true,
};

export const CLAIM_PERMISSION_LABELS: Record<ClaimPermissionKey, string> = {
  toggleMachines: 'Toggle Machines',
  build: 'Build & Mine',
  openChests: 'Open Chests',
  useLevers: 'Use Levers & Doors',
};

export interface PlayerIdentity {
  uid: string;
  displayName?: string;
}

/**
 * Normalizes a claim's block dimensions.
 * One chunk is 12×12 blocks; a 2-chunk claim is 24×12 (East–West) or 12×24 (North–South).
 */
export function getClaimDimensions(claim: { sizeX?: number; sizeZ?: number }): {
  sizeX: number;
  sizeZ: number;
  chunkCount: number;
} {
  const rawX = Number(claim.sizeX);
  const rawZ = Number(claim.sizeZ);
  const sizeX = rawX === 12 ? 12 : rawX === 24 ? 24 : CLAIM_TWO_CHUNK_SPAN;
  const sizeZ = rawZ === 24 && sizeX === 12 ? 24 : 12;
  const chunkCount = Math.max(1, Math.round((sizeX * sizeZ) / (CLAIM_SIZE * CLAIM_SIZE)));
  return { sizeX, sizeZ, chunkCount };
}

/**
 * Compute the canonical 2-chunk (24×12 or 12×24) or 1-chunk (12×12) origin (minX, minZ)
 * centered around a beacon or player block position.
 */
export function computeClaimOrigin12x12(
  centerX: number,
  centerZ: number,
  sizeX: number = CLAIM_TWO_CHUNK_SPAN,
  sizeZ: number = CLAIM_SIZE
): { minX: number; minZ: number; sizeX: number; sizeZ: number } {
  const { sizeX: normX, sizeZ: normZ } = getClaimDimensions({ sizeX, sizeZ });
  const bx = Math.floor(centerX);
  const bz = Math.floor(centerZ);
  return {
    minX: bx - Math.floor(normX / 2),
    minZ: bz - Math.floor(normZ / 2),
    sizeX: normX,
    sizeZ: normZ,
  };
}

export function isInsideClaim12x12(claim: LandClaim12x12, x: number, z: number): boolean {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  const { sizeX, sizeZ } = getClaimDimensions(claim);
  return (
    bx >= claim.minX &&
    bx < claim.minX + sizeX &&
    bz >= claim.minZ &&
    bz < claim.minZ + sizeZ
  );
}

export function claimsOverlap12x12(
  a: { minX: number; minZ: number; sizeX?: number; sizeZ?: number },
  b: { minX: number; minZ: number; sizeX?: number; sizeZ?: number }
): boolean {
  const dimA = getClaimDimensions(a);
  const dimB = getClaimDimensions(b);
  const aMaxX = a.minX + dimA.sizeX - 1;
  const aMaxZ = a.minZ + dimA.sizeZ - 1;
  const bMaxX = b.minX + dimB.sizeX - 1;
  const bMaxZ = b.minZ + dimB.sizeZ - 1;
  return a.minX <= bMaxX && aMaxX >= b.minX && a.minZ <= bMaxZ && aMaxZ >= b.minZ;
}

export function findClaimAt(
  claims: LandClaim12x12[],
  x: number,
  z: number
): LandClaim12x12 | null {
  for (const claim of claims) {
    if (isInsideClaim12x12(claim, x, z)) {
      return claim;
    }
  }
  return null;
}

export function isClaimOwner(claim: LandClaim12x12, identity: PlayerIdentity): boolean {
  if (!identity.uid) return false;
  return claim.ownerId === identity.uid;
}

export function sanitizeTrustedFriendPermissions(raw: unknown): TrustedFriendPermissions {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_TRUSTED_PERMISSIONS };
  }
  const p = raw as Partial<TrustedFriendPermissions>;
  return {
    build: typeof p.build === 'boolean' ? p.build : true,
    toggleMachines: typeof p.toggleMachines === 'boolean' ? p.toggleMachines : true,
    openChests: typeof p.openChests === 'boolean' ? p.openChests : true,
    useLevers: typeof p.useLevers === 'boolean' ? p.useLevers : true,
  };
}

export function getTrustedFriendPermissions(
  friend?: TrustedFriend | null
): TrustedFriendPermissions {
  if (!friend || !friend.permissions) {
    return { ...DEFAULT_TRUSTED_PERMISSIONS };
  }
  return sanitizeTrustedFriendPermissions(friend.permissions);
}

export function getTrustedFriendEntry(
  claim: LandClaim12x12,
  identity: PlayerIdentity
): TrustedFriend | null {
  const cleanName = identity.displayName?.trim().toLowerCase() || '';
  for (const friend of claim.trustedFriends) {
    if (identity.uid && friend.uid && friend.uid === identity.uid) return friend;
    if (cleanName && friend.displayName.trim().toLowerCase() === cleanName) return friend;
  }
  return null;
}

export function isTrustedFriendOnClaim(
  claim: LandClaim12x12,
  identity: PlayerIdentity
): boolean {
  if (isClaimOwner(claim, identity)) return true;
  return getTrustedFriendEntry(claim, identity) !== null;
}

/**
 * Checks whether a player has permission inside a specific claim.
 * - The claim owner who placed the claim always has all permissions.
 * - Players not on the Trusted Friends list never have access.
 * - Players on the Trusted Friends list have access to enter the 2-chunk territory,
 *   and their granular actions (build, toggleMachines, openChests, useLevers)
 *   are checked against their per-friend permission flags.
 */
export function hasClaimPermission(
  claim: LandClaim12x12,
  identity: PlayerIdentity,
  permission?: ClaimPermissionKey
): boolean {
  if (isClaimOwner(claim, identity)) return true;
  const friend = getTrustedFriendEntry(claim, identity);
  if (!friend) return false;
  if (!permission) return true;
  const perms = getTrustedFriendPermissions(friend);
  return Boolean(perms[permission]);
}

/**
 * Returns true if the player is permitted to perform an action at world block position (x, z).
 * - Unclaimed land: allowed for everyone.
 * - Inside a claimed 2-chunk territory: ONLY the claim owner or Trusted Friends with the required permission.
 */
export function canAccessPosition(
  claims: LandClaim12x12[],
  x: number,
  z: number,
  identity: PlayerIdentity,
  permission?: ClaimPermissionKey
): boolean {
  const claim = findClaimAt(claims, x, z);
  if (!claim) return true;
  return hasClaimPermission(claim, identity, permission);
}

export function getClaimAccessError(
  claims: LandClaim12x12[],
  x: number,
  z: number,
  identity: PlayerIdentity,
  actionLabel = 'access this area',
  permission?: ClaimPermissionKey
): string | null {
  const claim = findClaimAt(claims, x, z);
  if (!claim) return null;
  if (isClaimOwner(claim, identity)) return null;

  const { sizeX, sizeZ, chunkCount } = getClaimDimensions(claim);
  const friend = getTrustedFriendEntry(claim, identity);
  if (!friend) {
    return `Locked ${chunkCount}-Chunk Claim ("${claim.label}", ${sizeX}×${sizeZ}) owned by ${claim.ownerName}. Only the owner or players added to the Trusted List can ${actionLabel}.`;
  }

  if (permission) {
    const perms = getTrustedFriendPermissions(friend);
    if (!perms[permission]) {
      return `Permission locked in "${claim.label}": ${claim.ownerName} has not enabled "${CLAIM_PERMISSION_LABELS[permission]}" for your Trusted Friend role.`;
    }
  }
  return null;
}

/**
 * Validates that a player's saved Personal Spawn Point still lies inside an active claim
 * where they have Owner or Trusted Friend access.
 */
export function resolveValidPersonalSpawn(
  spawn: PersonalSpawnPoint | null | undefined,
  claims: LandClaim12x12[],
  identity: PlayerIdentity
): PersonalSpawnPoint | null {
  if (!spawn) return null;
  if (!Number.isFinite(spawn.x) || !Number.isFinite(spawn.y) || !Number.isFinite(spawn.z)) {
    return null;
  }
  const claim =
    claims.find((c) => c.id === spawn.claimId && isInsideClaim12x12(c, spawn.x, spawn.z)) ||
    findClaimAt(claims, spawn.x, spawn.z);
  if (!claim) return null;
  if (!isTrustedFriendOnClaim(claim, identity)) return null;
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    claimId: claim.id,
    claimLabel: claim.label,
  };
}

export function validateNewClaim12x12(
  existingClaims: LandClaim12x12[],
  ownerId: string,
  minX: number,
  minZ: number,
  sizeX: number = CLAIM_TWO_CHUNK_SPAN,
  sizeZ: number = CLAIM_SIZE
): string | null {
  if (existingClaims.length >= MAX_CLAIMS_PER_WORLD) {
    return `World claim limit reached (${MAX_CLAIMS_PER_WORLD} claims max).`;
  }
  const ownedCount = existingClaims.filter((c) => c.ownerId === ownerId).length;
  if (ownedCount >= MAX_CLAIMS_PER_PLAYER) {
    return `You already own ${MAX_CLAIMS_PER_PLAYER} active territory claims in this world.`;
  }
  const candidate = { minX, minZ, sizeX, sizeZ };
  for (const existing of existingClaims) {
    if (claimsOverlap12x12(candidate, existing)) {
      const dim = getClaimDimensions(existing);
      return `This ${sizeX}×${sizeZ} (${Math.round((sizeX * sizeZ) / 144)}-chunk) area overlaps "${existing.label}" (${dim.sizeX}×${dim.sizeZ}, owned by ${existing.ownerName}). Move further away.`;
    }
  }
  return null;
}

export function sanitizeTrustedFriends(raw: unknown): TrustedFriend[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: TrustedFriend[] = [];
  for (const entry of raw) {
    if (result.length >= MAX_TRUSTED_FRIENDS) break;
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Partial<TrustedFriend>;
    const displayName =
      typeof obj.displayName === 'string' ? obj.displayName.trim().slice(0, 32) : '';
    const uid = typeof obj.uid === 'string' ? obj.uid.trim().slice(0, 128) : '';
    if (!displayName && !uid) continue;
    const dedupeKey = uid || displayName.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push({
      uid,
      displayName: displayName || uid.slice(0, 12),
      permissions: sanitizeTrustedFriendPermissions(obj.permissions),
    });
  }
  return result;
}

export function sanitizeClaims(raw: unknown): LandClaim12x12[] {
  if (!Array.isArray(raw)) return [];
  const valid: LandClaim12x12[] = [];
  const seenIds = new Set<string>();
  for (const item of raw) {
    if (valid.length >= MAX_CLAIMS_PER_WORLD) break;
    if (!item || typeof item !== 'object') continue;
    const c = item as Partial<LandClaim12x12>;
    const id = typeof c.id === 'string' && c.id.trim().length > 0 ? c.id.trim().slice(0, 64) : '';
    const ownerId =
      typeof c.ownerId === 'string' && c.ownerId.trim().length > 0
        ? c.ownerId.trim().slice(0, 128)
        : '';
    if (!id || !ownerId || seenIds.has(id)) continue;
    const minX = Math.floor(Number(c.minX));
    const minZ = Math.floor(Number(c.minZ));
    if (!Number.isFinite(minX) || !Number.isFinite(minZ)) continue;
    const { sizeX, sizeZ } = getClaimDimensions(c);
    if (valid.some((existing) => claimsOverlap12x12({ minX, minZ, sizeX, sizeZ }, existing))) {
      continue;
    }
    seenIds.add(id);
    valid.push({
      id,
      ownerId,
      ownerName:
        typeof c.ownerName === 'string' && c.ownerName.trim()
          ? c.ownerName.trim().slice(0, 32)
          : 'Builder',
      label:
        typeof c.label === 'string' && c.label.trim()
          ? c.label.trim().slice(0, 36)
          : '2-Chunk Base (24×12)',
      minX,
      minZ,
      sizeX,
      sizeZ,
      beaconX: Number.isFinite(Number(c.beaconX))
        ? Math.floor(Number(c.beaconX))
        : minX + Math.floor(sizeX / 2),
      beaconY: Number.isFinite(Number(c.beaconY)) ? Math.floor(Number(c.beaconY)) : 3,
      beaconZ: Number.isFinite(Number(c.beaconZ))
        ? Math.floor(Number(c.beaconZ))
        : minZ + Math.floor(sizeZ / 2),
      trustedFriends: sanitizeTrustedFriends(c.trustedFriends),
      createdAtMs: Number.isFinite(Number(c.createdAtMs)) ? Number(c.createdAtMs) : Date.now(),
    });
  }
  return valid;
}
