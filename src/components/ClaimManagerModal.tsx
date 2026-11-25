import React, { useState } from 'react';
import {
  Box,
  Cpu,
  Eye,
  EyeOff,
  Hammer,
  Home,
  Lock,
  MapPin,
  RotateCcw,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import {
  CLAIM_PERMISSION_LABELS,
  CLAIM_SIZE,
  DEFAULT_TRUSTED_PERMISSIONS,
  getClaimDimensions,
  getTrustedFriendPermissions,
  isClaimOwner,
  isInsideClaim12x12,
  isTrustedFriendOnClaim,
} from '../engine/claims';
import type {
  ClaimPermissionKey,
  LandClaim12x12,
  PersonalSpawnPoint,
  RemotePlayer,
  TrustedFriend,
  TrustedFriendPermissions,
} from '../types/game';

interface ClaimManagerModalProps {
  claims: LandClaim12x12[];
  focusedClaimId: string | null;
  localUid: string;
  localDisplayName: string;
  playerX: number;
  playerZ: number;
  onlinePlayers: RemotePlayer[];
  showClaimBorders: boolean;
  personalSpawn: PersonalSpawnPoint | null;
  claimSizeX: number;
  claimSizeZ: number;
  onChangeClaimSize: (sizeX: number, sizeZ: number) => void;
  onToggleClaimBorders: () => void;
  onClaimHere: () => void;
  onSetSpawnHere: () => void;
  onSetSpawnAtClaim: (claimId: string) => void;
  onClearPersonalSpawn: () => void;
  onTeleportToSpawn: () => void;
  onAddTrustedFriend: (claimId: string, friend: TrustedFriend) => void;
  onUpdateTrustedFriendPermissions: (
    claimId: string,
    friendUidOrName: string,
    permissions: TrustedFriendPermissions
  ) => void;
  onRemoveTrustedFriend: (claimId: string, friendUidOrName: string) => void;
  onRenameClaim: (claimId: string, label: string) => void;
  onDeleteClaim: (claimId: string) => void;
  onClose: () => void;
}

const PERMISSION_KEYS: ClaimPermissionKey[] = [
  'toggleMachines',
  'build',
  'openChests',
  'useLevers',
];

export const ClaimManagerModal: React.FC<ClaimManagerModalProps> = ({
  claims,
  focusedClaimId,
  localUid,
  localDisplayName,
  playerX,
  playerZ,
  onlinePlayers,
  showClaimBorders,
  personalSpawn,
  claimSizeX,
  claimSizeZ,
  onChangeClaimSize,
  onToggleClaimBorders,
  onClaimHere,
  onSetSpawnHere,
  onSetSpawnAtClaim,
  onClearPersonalSpawn,
  onTeleportToSpawn,
  onAddTrustedFriend,
  onUpdateTrustedFriendPermissions,
  onRemoveTrustedFriend,
  onRenameClaim,
  onDeleteClaim,
  onClose,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    focusedClaimId || claims.find((c) => c.ownerId === localUid)?.id || claims[0]?.id || null
  );
  const [friendNameInput, setFriendNameInput] = useState('');
  const [newFriendPerms, setNewFriendPerms] = useState<TrustedFriendPermissions>({
    ...DEFAULT_TRUSTED_PERMISSIONS,
  });
  const [renameInput, setRenameInput] = useState('');

  const activeClaim = claims.find((c) => c.id === selectedId) || claims[0] || null;
  const identity = { uid: localUid, displayName: localDisplayName };
  const isOwner = activeClaim ? isClaimOwner(activeClaim, identity) : false;
  const isTrusted = activeClaim ? isTrustedFriendOnClaim(activeClaim, identity) : false;
  const standingInActiveClaim = activeClaim
    ? isInsideClaim12x12(activeClaim, playerX, playerZ)
    : false;
  const standingClaim = claims.find((c) => isInsideClaim12x12(c, playerX, playerZ)) || null;
  const canSetSpawnWhereStanding = standingClaim
    ? isTrustedFriendOnClaim(standingClaim, identity)
    : false;

  const otherOnlinePlayers = onlinePlayers.filter((p) => p.uid !== localUid);
  const activeDims = activeClaim ? getClaimDimensions(activeClaim) : { sizeX: 24, sizeZ: 12 };
  const activeChunkCount = Math.round((activeDims.sizeX * activeDims.sizeZ) / (CLAIM_SIZE * CLAIM_SIZE));
  const selectedNewChunks = Math.round((claimSizeX * claimSizeZ) / (CLAIM_SIZE * CLAIM_SIZE));

  const renderPermIcon = (key: ClaimPermissionKey) => {
    switch (key) {
      case 'toggleMachines':
        return <Cpu className="w-3 h-3" />;
      case 'build':
        return <Hammer className="w-3 h-3" />;
      case 'openChests':
        return <Box className="w-3 h-3" />;
      case 'useLevers':
        return <ToggleLeft className="w-3 h-3" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-1.5 sm:p-6 safe-pt safe-pb safe-pl safe-pr">
      <div className="w-full max-w-3xl max-h-[94dvh] sm:max-h-[92dvh] mc-panel flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[#323b49] bg-[#171c24] px-3 sm:px-5 py-2.5 sm:py-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-lg font-bold text-[#f3f5f8] truncate">
              <span className="sm:hidden">Territory Claims &amp; Spawn</span>
              <span className="hidden sm:inline">
                2-Chunk Territory Claims (24×12) &amp; Trusted Friend Permissions
              </span>
            </h2>
            <p className="hidden sm:block text-xs text-[#8d9cb0]">
              1 Chunk = 12×12 blocks. Claim a 2-Chunk Area (24×12 or 12×24) — only you and players on your Trusted List can enter or interact inside.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Land Claims"
            className="min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 p-1.5 flex items-center justify-center border border-[#323b49] text-[#a3b0c2] hover:text-[#f3f5f8] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Toolbar + 2-Chunk Footprint Orientation Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#323b49] bg-[#12161d] px-3 sm:px-5 py-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] sm:text-xs font-mono text-[#a3b0c2] tabular-nums">
              Pos: ({Math.floor(playerX)}, {Math.floor(playerZ)})
            </span>
            <div className="flex flex-wrap items-center gap-1 border border-[#323b49] bg-[#171c24] p-0.5">
              <button
                type="button"
                onClick={() => onChangeClaimSize(24, 12)}
                className={`px-2 py-1 text-[11px] font-mono cursor-pointer transition-colors ${
                  claimSizeX === 24 && claimSizeZ === 12
                    ? 'bg-[#10b981] text-[#08130e] font-bold'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <span className="sm:hidden">24×12 E–W</span>
                <span className="hidden sm:inline">2 Chunks E–W (24×12)</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeClaimSize(12, 24)}
                className={`px-2 py-1 text-[11px] font-mono cursor-pointer transition-colors ${
                  claimSizeX === 12 && claimSizeZ === 24
                    ? 'bg-[#10b981] text-[#08130e] font-bold'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <span className="sm:hidden">12×24 N–S</span>
                <span className="hidden sm:inline">2 Chunks N–S (12×24)</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeClaimSize(12, 12)}
                className={`px-2 py-1 text-[11px] font-mono cursor-pointer transition-colors ${
                  claimSizeX === 12 && claimSizeZ === 12
                    ? 'bg-[#10b981] text-[#08130e] font-bold'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <span className="sm:hidden">12×12</span>
                <span className="hidden sm:inline">1 Chunk (12×12)</span>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleClaimBorders}
              className="inline-flex items-center gap-1.5 border border-[#323b49] bg-[#1e242e] px-2.5 py-1.5 text-xs text-[#f3f5f8] hover:border-[#10b981] cursor-pointer"
            >
              {showClaimBorders ? (
                <Eye className="w-3.5 h-3.5 text-[#10b981]" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              {showClaimBorders ? 'Borders: On' : 'Borders: Off'}
            </button>
            <button
              type="button"
              onClick={onClaimHere}
              className="inline-flex items-center gap-1.5 bg-[#10b981] px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-[#08130e] hover:bg-[#34d399] cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="sm:hidden">Claim {claimSizeX}×{claimSizeZ}</span>
              <span className="hidden sm:inline">
                Claim {selectedNewChunks}-Chunk Area ({claimSizeX}×{claimSizeZ}) Here
              </span>
            </button>
          </div>
        </div>

        {/* Personal Spawn Point Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#323b49] bg-[#141922] px-3 sm:px-5 py-2 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Home
              className={`w-4 h-4 shrink-0 ${
                personalSpawn ? 'text-[#38bdf8]' : 'text-[#fbbf24]'
              }`}
            />
            <div className="min-w-0 truncate">
              <span className="text-[#8d9cb0]">Spawn: </span>
              {personalSpawn ? (
                <span className="font-mono text-[#38bdf8]">
                  {personalSpawn.claimLabel} ({Math.floor(personalSpawn.x)},{' '}
                  {Math.floor(personalSpawn.z)})
                </span>
              ) : (
                <span className="text-[#fbbf24]">Haven Town Square</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {canSetSpawnWhereStanding && (
              <button
                type="button"
                onClick={onSetSpawnHere}
                className="inline-flex items-center gap-1 bg-[#38bdf8] px-2.5 py-1 text-xs font-semibold text-[#08131a] hover:bg-[#7dd3fc] cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                Set Spawn
              </button>
            )}
            {personalSpawn && (
              <>
                <button
                  type="button"
                  onClick={onTeleportToSpawn}
                  className="inline-flex items-center gap-1 border border-[#38bdf8]/60 bg-[#1e242e] px-2.5 py-1 text-xs text-[#38bdf8] hover:border-[#38bdf8] cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  Warp Home
                </button>
                <button
                  type="button"
                  onClick={onClearPersonalSpawn}
                  title="Reset spawn back to Haven Town Square"
                  className="inline-flex items-center gap-1 border border-[#323b49] bg-[#1e242e] px-2.5 py-1 text-xs text-[#a3b0c2] hover:text-[#f3f5f8] cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-3 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-5">
          {/* Claims List */}
          <div className="md:col-span-5 space-y-2">
            <div className="text-xs font-medium text-[#8d9cb0]">
              Active Territory Claims ({claims.length})
            </div>
            {claims.length === 0 ? (
              <div className="border border-[#323b49] bg-[#171c24] p-4 text-xs text-[#8d9cb0]">
                No claims yet. Click <strong>Claim 2-Chunk Area (24×12) Here</strong> or place a
                Claim Beacon from your hotbar.
              </div>
            ) : (
              claims.map((c) => {
                const owned = isClaimOwner(c, identity);
                const allowed = isTrustedFriendOnClaim(c, identity);
                const dims = getClaimDimensions(c);
                const chunksCount = Math.round(
                  (dims.sizeX * dims.sizeZ) / (CLAIM_SIZE * CLAIM_SIZE)
                );
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setRenameInput(c.label);
                    }}
                    className={`w-full text-left p-3 border transition-colors cursor-pointer ${
                      activeClaim?.id === c.id
                        ? 'border-[#10b981] bg-[#10b981]/15'
                        : 'border-[#323b49] bg-[#171c24] hover:border-[#4b586d]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-[#f3f5f8] truncate">
                        {c.label}
                      </span>
                      <span
                        className={`font-mono text-[10px] ${
                          owned
                            ? 'text-[#10b981]'
                            : allowed
                            ? 'text-[#38bdf8]'
                            : 'text-[#ef4444]'
                        }`}
                      >
                        {owned ? 'OWNER' : allowed ? 'TRUSTED' : 'LOCKED'}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-[#34d399] tabular-nums">
                      {chunksCount} {chunksCount === 1 ? 'Chunk' : 'Chunks'} ({dims.sizeX}×
                      {dims.sizeZ}) · X {c.minX}..{c.minX + dims.sizeX - 1} · Z {c.minZ}..
                      {c.minZ + dims.sizeZ - 1}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-[#8d9cb0]">
                      <span className="truncate">
                        Owner: {c.ownerName} · {c.trustedFriends.length} Trusted
                      </span>
                      {personalSpawn?.claimId === c.id && (
                        <span className="font-mono text-[10px] text-[#38bdf8] shrink-0">
                          SPAWN
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Claim Details & Trusted Friends Permissions Management */}
          <div className="md:col-span-7">
            {!activeClaim ? (
              <div className="border border-[#323b49] bg-[#171c24] p-6 text-center text-xs text-[#8d9cb0]">
                Select or create a 2-Chunk claim to manage Trusted Friends and granular permissions.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border border-[#323b49] bg-[#171c24] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-base font-bold text-[#f3f5f8]">
                        {activeClaim.label}
                      </div>
                      <div className="mt-1 font-mono text-xs text-[#34d399] tabular-nums">
                        {activeChunkCount}-Chunk Footprint ({activeDims.sizeX}×{activeDims.sizeZ}{' '}
                        blocks · {activeChunkCount}× 12×12 chunks): X [{activeClaim.minX} to{' '}
                        {activeClaim.minX + activeDims.sizeX - 1}] · Z [{activeClaim.minZ} to{' '}
                        {activeClaim.minZ + activeDims.sizeZ - 1}]
                      </div>
                      <div className="mt-1 text-xs text-[#8d9cb0]">
                        Creator (Owner):{' '}
                        <span className="text-[#f3f5f8] font-medium">{activeClaim.ownerName}</span>{' '}
                        · Unauthorized players are physically blocked from entering.
                      </div>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-mono shrink-0 ${
                        isTrusted ? 'text-[#10b981]' : 'text-[#ef4444]'
                      }`}
                    >
                      {isTrusted ? (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                      {isOwner ? 'Owner Access' : isTrusted ? 'Trusted Access' : 'Entry Locked'}
                    </div>
                  </div>

                  {isTrusted && (
                    <div className="mt-3 pt-3 border-t border-[#262e3c] flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-[#9aa8bc]">
                        {personalSpawn?.claimId === activeClaim.id
                          ? `Your respawn is set here at (${Math.floor(personalSpawn.x)}, ${Math.floor(personalSpawn.z)}).`
                          : 'Set your personal spawn inside this claimed territory.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSetSpawnAtClaim(activeClaim.id)}
                        className="inline-flex items-center gap-1.5 border border-[#38bdf8]/70 bg-[#38bdf8]/15 px-3 py-1.5 text-xs font-medium text-[#7dd3fc] hover:bg-[#38bdf8]/25 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        {standingInActiveClaim ? 'Set Spawn at My Feet' : 'Set Spawn at Beacon'}
                      </button>
                    </div>
                  )}

                  {isOwner && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renameInput.trim()) {
                          onRenameClaim(activeClaim.id, renameInput.trim());
                        }
                      }}
                      className="mt-3 flex gap-2"
                    >
                      <input
                        type="text"
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        placeholder={activeClaim.label}
                        maxLength={32}
                        className="flex-1 border border-[#323b49] bg-[#10141b] px-2.5 py-1.5 text-xs text-[#f3f5f8]"
                      />
                      <button
                        type="submit"
                        className="border border-[#323b49] bg-[#1e242e] px-3 py-1.5 text-xs text-[#f3f5f8] hover:border-[#10b981] cursor-pointer"
                      >
                        Rename
                      </button>
                    </form>
                  )}
                </div>

                {/* Trusted Friends & Granular Permissions List */}
                <div className="border border-[#323b49] bg-[#171c24] p-4 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-[#f3f5f8]">
                      Trusted Friends & Granular Access ({activeClaim.trustedFriends.length})
                    </div>
                    <p className="text-[11px] text-[#8d9cb0] mt-0.5">
                      Choose whether each Trusted Friend can Toggle Machines, Build & Mine, Open
                      Chests, or Use Levers & Doors inside your 2-chunk claim.
                    </p>
                  </div>

                  {isOwner ? (
                    <div className="space-y-2.5 border border-[#262e3c] bg-[#12161e] p-3">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const clean = friendNameInput.trim();
                          if (!clean) return;
                          const matchedOnline = otherOnlinePlayers.find(
                            (p) =>
                              p.name.toLowerCase() === clean.toLowerCase() || p.uid === clean
                          );
                          onAddTrustedFriend(activeClaim.id, {
                            uid: matchedOnline?.uid || '',
                            displayName: matchedOnline?.name || clean,
                            permissions: { ...newFriendPerms },
                          });
                          setFriendNameInput('');
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={friendNameInput}
                          onChange={(e) => setFriendNameInput(e.target.value)}
                          placeholder="Friend's character name..."
                          maxLength={32}
                          className="flex-1 border border-[#323b49] bg-[#10141b] px-3 py-1.5 text-xs text-[#f3f5f8] focus:border-[#10b981] focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 bg-[#10b981] px-3 py-1.5 text-xs font-semibold text-[#08130e] hover:bg-[#34d399] cursor-pointer whitespace-nowrap"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Add Trusted Friend
                        </button>
                      </form>

                      {/* Default permissions for new friend */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[#8d9cb0] mr-1">
                          New Friend Permissions:
                        </span>
                        {PERMISSION_KEYS.map((permKey) => {
                          const enabled = newFriendPerms[permKey];
                          return (
                            <button
                              key={permKey}
                              type="button"
                              onClick={() =>
                                setNewFriendPerms((prev) => ({
                                  ...prev,
                                  [permKey]: !prev[permKey],
                                }))
                              }
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border cursor-pointer transition-colors ${
                                enabled
                                  ? 'border-[#10b981] bg-[#10b981]/20 text-[#34d399]'
                                  : 'border-[#323b49] bg-[#10141b] text-[#64748b]'
                              }`}
                            >
                              {renderPermIcon(permKey)}
                              {CLAIM_PERMISSION_LABELS[permKey]}: {enabled ? 'YES' : 'NO'}
                            </button>
                          );
                        })}
                      </div>

                      {otherOnlinePlayers.length > 0 && (
                        <div>
                          <div className="text-[11px] text-[#8d9cb0] mb-1.5">
                            Quick-Add Online Players in World:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {otherOnlinePlayers.map((p) => (
                              <button
                                key={p.clientId}
                                type="button"
                                onClick={() =>
                                  onAddTrustedFriend(activeClaim.id, {
                                    uid: p.uid,
                                    displayName: p.name,
                                    permissions: { ...newFriendPerms },
                                  })
                                }
                                className="border border-[#323b49] bg-[#10141b] px-2.5 py-1 text-xs text-[#f3f5f8] hover:border-[#10b981] cursor-pointer"
                              >
                                + {p.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-[#8d9cb0]">
                      Only {activeClaim.ownerName} (claim creator) can add Trusted Friends or modify
                      their permissions.
                    </div>
                  )}

                  {activeClaim.trustedFriends.length === 0 ? (
                    <div className="text-xs text-[#8d9cb0] py-2">
                      No Trusted Friends added yet. Only {activeClaim.ownerName} can enter or
                      interact inside this {activeDims.sizeX}×{activeDims.sizeZ} territory.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeClaim.trustedFriends.map((f, idx) => {
                        const perms = getTrustedFriendPermissions(f);
                        const friendKey = f.uid || f.displayName;
                        return (
                          <div
                            key={`${friendKey}_${idx}`}
                            className="border border-[#262e3c] bg-[#10141b] p-3 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#38bdf8]" />
                                <span className="font-semibold text-[#f3f5f8]">
                                  {f.displayName}
                                </span>
                                <span className="text-[10px] font-mono text-[#10b981]">
                                  CAN ENTER CLAIM
                                </span>
                              </div>
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveTrustedFriend(activeClaim.id, friendKey)}
                                  className="inline-flex items-center gap-1 text-[#ef4444] hover:text-[#fca5a5] cursor-pointer"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                  Remove
                                </button>
                              )}
                            </div>

                            {/* Granular 4-Permission Toggle Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                              {PERMISSION_KEYS.map((permKey) => {
                                const allowed = perms[permKey];
                                return (
                                  <button
                                    key={permKey}
                                    type="button"
                                    disabled={!isOwner}
                                    onClick={() => {
                                      if (!isOwner) return;
                                      onUpdateTrustedFriendPermissions(activeClaim.id, friendKey, {
                                        ...perms,
                                        [permKey]: !allowed,
                                      });
                                    }}
                                    className={`flex items-center justify-between gap-1 px-2 py-1.5 border text-[10px] font-mono transition-colors ${
                                      allowed
                                        ? 'border-[#10b981]/70 bg-[#10b981]/15 text-[#34d399]'
                                        : 'border-[#323b49] bg-[#151a23] text-[#64748b]'
                                    } ${isOwner ? 'cursor-pointer hover:border-[#38bdf8]' : 'cursor-default'}`}
                                  >
                                    <span className="inline-flex items-center gap-1 truncate">
                                      {renderPermIcon(permKey)}
                                      <span className="truncate">
                                        {permKey === 'toggleMachines'
                                          ? 'Machines'
                                          : permKey === 'build'
                                          ? 'Build'
                                          : permKey === 'openChests'
                                          ? 'Chests'
                                          : 'Levers'}
                                      </span>
                                    </span>
                                    <span className="font-bold shrink-0">
                                      {allowed ? 'ON' : 'OFF'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {isOwner && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteClaim(activeClaim.id);
                        setSelectedId(null);
                      }}
                      className="inline-flex items-center gap-1.5 border border-[#ef4444]/50 px-3 py-1.5 text-xs text-[#fca5a5] hover:bg-[#ef4444]/15 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Unclaim {activeDims.sizeX}×{activeDims.sizeZ} Territory
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
