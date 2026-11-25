import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { AuthHub } from './components/AuthHub';
import { ClaimManagerModal } from './components/ClaimManagerModal';
import {
  ClassTradeWorkersModal,
  type ClassWorkersTradeTab,
} from './components/ClassTradeWorkersModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InventoryDrawerModal } from './components/InventoryDrawerModal';
import { MachineConsoleModal } from './components/MachineConsoleModal';
import { MinecraftHud } from './components/MinecraftHud';
import { MultiplayerModal } from './components/MultiplayerModal';
import { OfflineIndicator } from './components/PWAInstallButton';
import { ShopModal, type ShopModalTab } from './components/ShopModal';
import {
  AUGMENT_SPECS,
  BLOCK_HARDNESS,
  CRAFT_RECIPES,
  createFreshWorldPlayerState,
  DIRE_TRADER_DEALS,
  DOOR_KINDS,
  FIREWOOD_SPLITTER_RECIPES,
  FTB_QUESTS,
  getArmorMeta,
  getPickaxeMeta,
  getWeaponMeta,
  isMachinePlacedByPlayer,
  ITEMS,
  MACHINE_KINDS,
  MACHINE_SPECS,
  PICKAXE_TIERS,
  PLAYER_CLASSES,
  SAG_MILL_RECIPES,
  SMELT_RECIPES,
  WORKER_HIRE_COST,
  WORKER_TASK_SPECS,
} from './data/catalog';
import { gameAudio } from './engine/audio';
import {
  CLAIM_SIZE,
  computeClaimOrigin12x12,
  findClaimAt,
  getClaimAccessError,
  getClaimDimensions,
  hasClaimPermission,
  isClaimOwner,
  isInsideClaim12x12,
  isTrustedFriendOnClaim,
} from './engine/claims';
import {
  getTownProtectionError,
  STARTER_TOWN_SPAWN,
  validateNewClaimOutsideSafeZones,
} from './engine/safeZones';
import { getDayNightState } from './engine/dayNight';
import {
  COAL_BURN_SECONDS_PER_UNIT,
  evaluatePowerGrid,
  normalizeMachineKind,
  tickMachinesOneSecond,
} from './engine/powerGrid';
import {
  getClosestChunkKeys,
  getSurfaceHeight,
  isWithinWorldBounds,
  MAX_ACTIVE_CHUNKS,
  voxelKey,
} from './engine/terrain';
import { VoxelWorldEngine, type HoverTarget } from './engine/three/VoxelWorldEngine';
import {
  createNewWorldInCloud,
  deleteWorldFromCloud,
  listOwnedWorlds,
  loadLocalWorldPlayerState,
  loadOrCreateCharacter,
  saveCharacterToCloud,
  saveLocalWorldPlayerState,
  saveWorldToCloud,
} from './services/cloudSaves';
import { auth, googleProvider, testFirestoreConnection } from './services/firebase';
import { WorldMultiplayerClient, type WsConnectionStatus } from './services/multiplayerClient';
import type {
  AugmentId,
  BuildingGadgetMode,
  CharacterProfile,
  ClaimPermissionKey,
  HiredWorker,
  LandClaim12x12,
  MachineKind,
  MiningGadgetMode,
  PersonalSpawnPoint,
  PickaxeTier,
  PlacedMachine,
  PlayerClassId,
  RemotePlayer,
  ResourceItemId,
  RoomChatMessage,
  ServerWsMessage,
  TerrainBlockKind,
  TradeOffer,
  TrustedFriend,
  TrustedFriendPermissions,
  WorkerTask,
  WorldAccessMode,
  WorldData,
  WorldMode,
  WorldPlayerState,
  WorldVoxelDelta,
} from './types/game';

function extractWorldPlayerState(
  ch: CharacterProfile,
  personalSpawn: PersonalSpawnPoint | null = null
): WorldPlayerState {
  return {
    level: ch.level,
    xp: ch.xp,
    credits: ch.credits,
    health: ch.health,
    maxHealth: ch.maxHealth,
    hunger: ch.hunger ?? 100,
    maxHunger: ch.maxHunger ?? 100,
    saturation: ch.saturation ?? 60,
    claimedQuestIds: ch.claimedQuestIds || [],
    pickaxeTier: ch.pickaxeTier,
    armorTier: ch.armorTier,
    weaponTier: ch.weaponTier,
    miningGadgetMode: ch.miningGadgetMode || 'single_1x1',
    buildingGadgetMode: ch.buildingGadgetMode || 'single',
    playerClass: ch.playerClass || 'engineer',
    hiredWorkers: ch.hiredWorkers || [],
    inventory: { ...ch.inventory },
    hotbar: [...ch.hotbar],
    selectedSlot: ch.selectedSlot,
    personalSpawn,
  };
}

function getSavedPersonalSpawnForWorld(
  uid: string,
  wd: WorldData
): PersonalSpawnPoint | null {
  const saved = wd.playerStates?.[uid] || loadLocalWorldPlayerState(uid, wd.id);
  return saved?.personalSpawn ?? null;
}

function hydrateCharacterForWorld(ch: CharacterProfile, wd: WorldData): CharacterProfile {
  const saved = wd.playerStates?.[ch.uid] || loadLocalWorldPlayerState(ch.uid, wd.id);
  const fresh = createFreshWorldPlayerState();
  const resolvedTier = saved?.pickaxeTier || fresh.pickaxeTier;
  const canUseBore = wd.mode === 'peaceful' || getPickaxeMeta(resolvedTier).supports3x3Bore;
  const state: WorldPlayerState = saved
    ? {
        ...fresh,
        ...saved,
        level: Math.max(1, Math.floor(saved.level || 1)),
        xp: Math.max(0, Math.floor(saved.xp || 0)),
        credits: Math.max(0, Math.floor(saved.credits ?? 0)),
        hunger: saved.hunger ?? 100,
        maxHunger: saved.maxHunger ?? 100,
        saturation: saved.saturation ?? 60,
        playerClass: saved.playerClass || ch.playerClass || 'engineer',
        hiredWorkers: Array.isArray(saved.hiredWorkers) ? saved.hiredWorkers : [],
        claimedQuestIds: Array.isArray(saved.claimedQuestIds) ? saved.claimedQuestIds : [],
        miningGadgetMode:
          canUseBore && saved.miningGadgetMode === 'bore_3x3' ? 'bore_3x3' : 'single_1x1',
        buildingGadgetMode: saved.buildingGadgetMode || 'single',
        inventory: { ...fresh.inventory, ...(saved.inventory || {}) },
        hotbar:
          Array.isArray(saved.hotbar) && saved.hotbar.length === 9
            ? saved.hotbar.map((id, i) => (id && ITEMS[id] ? id : fresh.hotbar[i]))
            : fresh.hotbar,
      }
    : {
        ...fresh,
        level: 1,
        xp: 0,
        credits: 0,
        playerClass: ch.playerClass || 'engineer',
        hiredWorkers: [],
      };

  return {
    ...ch,
    ...state,
  };
}

const AUTO_SAVE_INTERVAL_MS = 10000;
const BUILDING_MODES_ORDER: BuildingGadgetMode[] = ['single', 'floor_3x3', 'wall_3x3', 'line_5'];

function InnerApp() {
  // --- Auth & Persistent Character ---
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterProfile | null>(null);

  // --- Worlds Hub ---
  const [myWorlds, setMyWorlds] = useState<WorldData[]>([]);
  const [worldsLoading, setWorldsLoading] = useState(false);

  // --- Active World Session ---
  const [activeWorld, setActiveWorld] = useState<WorldData | null>(null);
  const [isHostingMultiplayer, setIsHostingMultiplayer] = useState(false);
  const [isMultiplayerSession, setIsMultiplayerSession] = useState(false);
  const [mpStatus, setMpStatus] = useState<WsConnectionStatus>('disconnected');
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [initialInviteCode] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('join') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    } catch {
      return '';
    }
  });

  // --- In-Game UI & Modals ---
  const [dayNight, setDayNight] = useState(() => getDayNightState());
  const [playerPos, setPlayerPos] = useState({ x: 0.5, y: 4, z: 0.5, yaw: 0 });
  const [activeChunkKeys, setActiveChunkKeys] = useState<string[]>([]);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const [showClaimBorders, setShowClaimBorders] = useState(true);
  const [lowLagMode, setLowLagMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('aethercraft_low_lag_mode') === '1';
    } catch {
      return false;
    }
  });
  const [muted, setMuted] = useState(false);
  const [autoSaveLabel, setAutoSaveLabel] = useState('Auto-Save Active');
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' | 'claim_locked' } | null>(null);

  const [openMachineId, setOpenMachineId] = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [focusedClaimId, setFocusedClaimId] = useState<string | null>(null);
  const [claimSize, setClaimSize] = useState<{ sizeX: number; sizeZ: number }>({
    sizeX: 24,
    sizeZ: 12,
  });
  const [showClassWorkersModal, setShowClassWorkersModal] = useState(false);
  const [classWorkersTab, setClassWorkersTab] = useState<ClassWorkersTradeTab>('class');
  const [showShopModal, setShowShopModal] = useState(false);
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [shopInitialTab, setShopInitialTab] = useState<ShopModalTab>('me_terminal');
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const [personalSpawn, setPersonalSpawn] = useState<PersonalSpawnPoint | null>(null);

  // Refs for stable access inside Three.js & timers
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelWorldEngine | null>(null);
  const mpClientRef = useRef<WorldMultiplayerClient | null>(null);
  const characterRef = useRef<CharacterProfile | null>(null);
  const worldRef = useRef<WorldData | null>(null);
  const personalSpawnRef = useRef<PersonalSpawnPoint | null>(null);
  const claimSizeRef = useRef(claimSize);
  const lastHungerPosRef = useRef<{ x: number; z: number }>({ x: 0.5, z: 0.5 });
  const workerTickCounterRef = useRef<number>(0);
  const isMultiplayerRef = useRef(false);
  const isHostingRef = useRef(false);
  const charDirtyRef = useRef(false);
  const worldDirtyRef = useRef(false);
  const savingRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const lowLagModeRef = useRef(lowLagMode);
  const lastWeatherKindRef = useRef<string | null>(null);

  characterRef.current = character;
  worldRef.current = activeWorld;
  personalSpawnRef.current = personalSpawn;
  claimSizeRef.current = claimSize;
  isMultiplayerRef.current = isMultiplayerSession;
  isHostingRef.current = isHostingMultiplayer;
  lowLagModeRef.current = lowLagMode;

  const showToast = useCallback(
    (message: string, tone: 'info' | 'error' | 'claim_locked' = 'info') => {
      setToast({ message, tone });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
    },
    []
  );

  const [touchCrouching, setTouchCrouching] = useState(false);
  const [playerHurtFlash, setPlayerHurtFlash] = useState(false);
  const hurtFlashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (hurtFlashTimerRef.current) window.clearTimeout(hurtFlashTimerRef.current);
      gameAudio.stopRainAmbience();
    };
  }, []);

  // Derived Power Grid snapshot
  const grid = useMemo(() => {
    if (!activeWorld) {
      return evaluatePowerGrid([], [], dayNight.solarEfficiency);
    }
    return evaluatePowerGrid(activeWorld.machines, activeWorld.cables, dayNight.solarEfficiency);
  }, [activeWorld, dayNight.solarEfficiency]);

  // --- Firebase Auth Bootstrap ---
  useEffect(() => {
    void testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCharacter(null);
        setMyWorlds([]);
        setActiveWorld(null);
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      setAuthError(null);
      try {
        const displayName = user.displayName || user.email?.split('@')[0] || 'DireEngineer';
        const loadedChar = await loadOrCreateCharacter(user.uid, displayName);
        setCharacter(loadedChar);
        setWorldsLoading(true);
        const owned = await listOwnedWorlds(user.uid);
        setMyWorlds(owned);
      } catch (err) {
        console.error('Failed to bootstrap account:', err);
        setAuthError(err instanceof Error ? err.message : 'Could not load cloud profile.');
      } finally {
        setWorldsLoading(false);
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handleSignInGoogle = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    mpClientRef.current?.disconnect();
    setActiveWorld(null);
    setIsMultiplayerSession(false);
    setIsHostingMultiplayer(false);
    await signOut(auth);
  };

  // --- Auto-Save Flush ---
  const flushAutoSave = useCallback(async (force = false) => {
    if (savingRef.current) return;
    const ch = characterRef.current;
    const wd = worldRef.current;
    if (!ch) return;

    const shouldSaveChar = force || charDirtyRef.current;
    const shouldSaveWorld =
      Boolean(wd) &&
      wd!.ownerId === ch.uid &&
      (force || worldDirtyRef.current || charDirtyRef.current);

    if (!shouldSaveChar && !shouldSaveWorld) return;
    savingRef.current = true;
    setAutoSaveLabel('Saving...');
    try {
      const worldPlayerState = extractWorldPlayerState(ch, personalSpawnRef.current);
      if (wd) {
        saveLocalWorldPlayerState(ch.uid, wd.id, worldPlayerState);
      }
      if (shouldSaveChar) {
        charDirtyRef.current = false;
        await saveCharacterToCloud(ch, true);
      }
      if (shouldSaveWorld && wd) {
        worldDirtyRef.current = false;
        const worldWithPlayerState: WorldData = {
          ...wd,
          playerStates: {
            ...(wd.playerStates || {}),
            [ch.uid]: worldPlayerState,
          },
          updatedAtMs: Date.now(),
        };
        await saveWorldToCloud(worldWithPlayerState);
        setMyWorlds((prev) =>
          prev.map((item) => (item.id === wd.id ? worldWithPlayerState : item))
        );
      }
      const nowStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setAutoSaveLabel(`Saved ${nowStr}`);
    } catch (err) {
      console.error('Auto-save failed:', err);
      setAutoSaveLabel('Save retry pending');
    } finally {
      savingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const interval = window.setInterval(() => {
      void flushAutoSave(false);
    }, AUTO_SAVE_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushAutoSave(true);
      }
    };
    const handlePageHide = () => {
      void flushAutoSave(true);
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [firebaseUser, flushAutoSave]);

  // Day/Night & World Weather Clock Ticker
  const activeWorldCreatedAt = activeWorld?.createdAtMs;
  const activeWorldSeed = activeWorld?.seed ?? 1001;
  useEffect(() => {
    lastWeatherKindRef.current = null;
    if (!activeWorld?.id) {
      gameAudio.stopRainAmbience();
    }
    const syncClock = () => {
      const next = getDayNightState(Date.now(), activeWorldCreatedAt, activeWorldSeed);
      setDayNight((prev) =>
        prev.cycleLabel === next.cycleLabel &&
        prev.phase === next.phase &&
        prev.weather.kind === next.weather.kind &&
        prev.weather.formattedTimeRemaining === next.weather.formattedTimeRemaining &&
        Math.abs(prev.solarEfficiency - next.solarEfficiency) < 0.01
          ? prev
          : next
      );
      engineRef.current?.updateDayNight(next);
      if (worldRef.current) {
        gameAudio.setRainAmbience(next.weather.rainIntensity);
        const prevKind = lastWeatherKindRef.current;
        if (prevKind && prevKind !== next.weather.kind) {
          if (next.weather.kind === 'light_rain') {
            showToast(
              'Light Rain rolling in — Solar panels at 40% efficiency; coal boilers drawing 1.35× backup fuel.',
              'info'
            );
          } else if (next.weather.kind === 'fog') {
            showToast(
              'Dense Fog settling in — Solar panels at 55% efficiency; check backup coal/firewood boilers.',
              'info'
            );
          } else {
            showToast('Skies clearing — Solar panel efficiency restored.', 'info');
          }
        }
        lastWeatherKindRef.current = next.weather.kind;
      }
    };
    syncClock();
    const id = window.setInterval(syncClock, 5000);
    return () => {
      window.clearInterval(id);
      gameAudio.stopRainAmbience();
    };
  }, [activeWorld?.id, activeWorldCreatedAt, activeWorldSeed, showToast]);

  // 1 Hz FTB Forge Energy & Machine Simulation Loop
  useEffect(() => {
    if (!activeWorld) return;
    if (isMultiplayerSession && !isHostingMultiplayer) return;

    const timer = window.setInterval(() => {
      const wd = worldRef.current;
      if (!wd || wd.machines.length === 0) return;
      const dn = getDayNightState(Date.now(), wd.createdAtMs, wd.seed);
      const res = tickMachinesOneSecond(
        wd.seed,
        wd.machines,
        wd.cables,
        wd.storageInventory,
        dn.solarEfficiency,
        dn.weather.boilerFuelBurnMultiplier
      );

      setActiveWorld((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          machines: res.machines,
          storageInventory: res.storageInventory,
        };
      });
      worldDirtyRef.current = true;

      if (isMultiplayerRef.current && isHostingRef.current) {
        mpClientRef.current?.send({
          type: 'world:sync_machines',
          machines: res.machines,
          storageInventory: res.storageInventory,
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeWorld?.id, isMultiplayerSession, isHostingMultiplayer]);

  // --- Character Mutator Helper ---
  const mutateCharacter = useCallback((fn: (prev: CharacterProfile) => CharacterProfile) => {
    setCharacter((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      charDirtyRef.current = true;
      const wd = worldRef.current;
      if (wd) {
        saveLocalWorldPlayerState(
          next.uid,
          wd.id,
          extractWorldPlayerState(next, personalSpawnRef.current)
        );
        worldDirtyRef.current = true;
      }
      return next;
    });
  }, []);

  const addItemToChar = useCallback(
    (itemId: ResourceItemId, qty: number) => {
      if (qty <= 0) return;
      mutateCharacter((prev) => {
        const nextInv = { ...prev.inventory, [itemId]: (prev.inventory[itemId] || 0) + qty };
        const nextHotbar = [...prev.hotbar];
        if (!nextHotbar.includes(itemId)) {
          const emptyIdx = nextHotbar.findIndex((s) => s === null);
          if (emptyIdx !== -1) nextHotbar[emptyIdx] = itemId;
        }
        return { ...prev, inventory: nextInv, hotbar: nextHotbar };
      });
    },
    [mutateCharacter]
  );

  const checkClaimAccess = useCallback(
    (
      x: number,
      z: number,
      actionLabel: string,
      permission?: ClaimPermissionKey
    ): boolean => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      if (!wd || !ch) return false;
      const err = getClaimAccessError(
        wd.claims,
        x,
        z,
        { uid: ch.uid, displayName: ch.characterName },
        actionLabel,
        permission
      );
      if (err) {
        gameAudio.playClaimLocked();
        showToast(err, 'claim_locked');
        return false;
      }
      return true;
    },
    [showToast]
  );

  const canControlMachineInWorld = useCallback(
    (
      machine: PlacedMachine,
      ch: CharacterProfile,
      wd: WorldData,
      perm: ClaimPermissionKey = 'toggleMachines'
    ): boolean => {
      if (isMachinePlacedByPlayer(machine, ch.uid, wd.ownerId)) return true;
      const claim = findClaimAt(wd.claims, machine.x, machine.z);
      if (
        claim &&
        hasClaimPermission(
          claim,
          { uid: ch.uid, displayName: ch.characterName },
          perm
        )
      ) {
        return true;
      }
      return false;
    },
    []
  );

  // --- Direwolf20 Mining Gadget (1x1 Precision OR 3x3 Tunnel Bore Laser) + Class Special Bonuses ---
  const handleMineBlock = useCallback(
    (x: number, y: number, z: number, kind: TerrainBlockKind) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      const eng = engineRef.current;
      if (!wd || !ch || !eng) return;

      const townErr = getTownProtectionError(wd.seed, x, z, 'mine blocks');
      if (townErr) {
        gameAudio.playClaimLocked();
        showToast(townErr, 'claim_locked');
        return;
      }
      if (!checkClaimAccess(x, z, 'mine blocks here', 'build')) return;
      const canMine = eng.canMineKind(kind);
      if (!canMine.ok) {
        gameAudio.playClaimLocked();
        showToast(canMine.reason || 'Pickaxe tier too low to harvest this block.', 'error');
        return;
      }

      // Determine blocks to excavate (1x1 Precision or 3x3 Tunnel Bore gated by Tier 4+)
      const canUse3x3 = wd.mode === 'peaceful' || getPickaxeMeta(ch.pickaxeTier).supports3x3Bore;
      const mode: MiningGadgetMode = canUse3x3 ? (ch.miningGadgetMode || 'single_1x1') : 'single_1x1';
      const coordsToMine: { bx: number; by: number; bz: number; bKind: TerrainBlockKind }[] = [
        { bx: x, by: y, bz: z, bKind: kind },
      ];

      if (mode === 'bore_3x3') {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (dx === 0 && dy === 0 && dz === 0) continue;
              if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
              const nx = x + dx;
              const ny = y + dy;
              const nz = z + dz;
              if (!isWithinWorldBounds(nx, ny, nz)) continue;
              if (wd.machines.some((m) => m.x === nx && m.y === ny && m.z === nz)) continue;
              const nk = eng.getVoxelKindAt(nx, ny, nz);
              if (nk === 'air' || nk === 'bedrock') continue;
              if (!eng.canMineKind(nk).ok) continue;
              coordsToMine.push({ bx: nx, by: ny, bz: nz, bKind: nk });
            }
          }
        }
      }

      gameAudio.playBlockBreak();
      const pClass: PlayerClassId = ch.playerClass || 'engineer';
      const nextDeltas: Record<string, WorldVoxelDelta> = {};
      const dropTotals: Partial<Record<ResourceItemId, number>> = {};
      let totalXp = 0;

      const batchDeltas: WorldVoxelDelta[] = [];
      for (const item of coordsToMine) {
        const k = voxelKey(item.bx, item.by, item.bz);
        const d: WorldVoxelDelta = { x: item.bx, y: item.by, z: item.bz, kind: 'air' };
        nextDeltas[k] = d;
        batchDeltas.push(d);
        const hard = BLOCK_HARDNESS[item.bKind];
        if (hard?.drop) {
          let qty = 1;
          // Lumberjack Special Bonus: 2x Timber Log yield + 1x Split Firewood Bundle per log
          if (pClass === 'lumberjack' && item.bKind === 'wood_log') {
            qty = 2;
            dropTotals.firewood_bundle = (dropTotals.firewood_bundle || 0) + 1;
          }
          // Miner Special Bonus: 2x Raw Ore yield on all ore veins + 25% bonus coal/iron when quarrying stone
          if (
            pClass === 'miner' &&
            (item.bKind === 'coal_ore' ||
              item.bKind === 'copper_ore' ||
              item.bKind === 'iron_ore' ||
              item.bKind === 'gold_ore' ||
              item.bKind === 'crystal_ore' ||
              item.bKind === 'diamond_ore')
          ) {
            qty = 2;
          } else if (
            pClass === 'miner' &&
            (item.bKind === 'stone' || item.bKind === 'cobblestone') &&
            Math.random() < 0.25
          ) {
            const bonusOre: ResourceItemId = Math.random() < 0.5 ? 'iron_ore' : 'coal';
            dropTotals[bonusOre] = (dropTotals[bonusOre] || 0) + 1;
          }
          // Farmer Special Bonus: 65% chance to harvest Energized Field Rations from Canopy Leaves & Grass
          if (
            pClass === 'farmer' &&
            (item.bKind === 'leaves' || item.bKind === 'grass') &&
            Math.random() < 0.65
          ) {
            dropTotals.cooked_ration = (dropTotals.cooked_ration || 0) + 1;
          }
          dropTotals[hard.drop] = (dropTotals[hard.drop] || 0) + qty;
        }
        let baseXp = Math.max(1, Math.floor((hard?.xp || 2) * 0.6));
        if (pClass === 'miner') baseXp = Math.round(baseXp * 1.4);
        else if (pClass === 'lumberjack' && item.bKind === 'wood_log') {
          baseXp = Math.round(baseXp * 1.25);
        }
        totalXp += baseXp;
      }

      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'player:laser', tx: x, ty: y, tz: z });
        if (batchDeltas.length === 1) {
          const only = batchDeltas[0];
          mpClientRef.current?.send({
            type: 'voxel:set',
            x: only.x,
            y: only.y,
            z: only.z,
            kind: 'air',
          });
        } else if (batchDeltas.length > 1) {
          mpClientRef.current?.send({ type: 'voxel:batch', deltas: batchDeltas });
        }
      }

      setActiveWorld((prev) =>
        prev
          ? { ...prev, voxelDeltas: { ...prev.voxelDeltas, ...nextDeltas } }
          : prev
      );
      worldDirtyRef.current = true;

      mutateCharacter((prev) => {
        const nextInv = { ...prev.inventory };
        for (const [dropId, count] of Object.entries(dropTotals)) {
          const id = dropId as ResourceItemId;
          nextInv[id] = (nextInv[id] || 0) + (count || 0);
        }
        let xp = prev.xp + totalXp;
        let level = prev.level;
        let maxHealth = prev.maxHealth;
        let health = prev.health;
        while (xp >= level * 180) {
          xp -= level * 180;
          level += 1;
          maxHealth += 5;
          health = Math.min(maxHealth, health + 5);
        }
        // Minecraft Mining Exhaustion: drains saturation first, then hunger (50% slower for Farmer class)
        const exhaustionCost =
          coordsToMine.length * (pClass === 'farmer' ? 0.25 : 0.5);
        let currSat = prev.saturation ?? 60;
        let currHunger = prev.hunger ?? 100;
        if (wd.mode === 'survival') {
          if (currSat >= exhaustionCost) {
            currSat = Math.max(0, Math.round((currSat - exhaustionCost) * 10) / 10);
          } else {
            const rem = exhaustionCost - currSat;
            currSat = 0;
            currHunger = Math.max(0, Math.round((currHunger - rem) * 10) / 10);
          }
        } else {
          currHunger = 100;
          currSat = 100;
        }
        return {
          ...prev,
          inventory: nextInv,
          xp,
          level,
          health,
          maxHealth,
          hunger: currHunger,
          saturation: currSat,
          totalBlocksMined: prev.totalBlocksMined + coordsToMine.length,
        };
      });
    },
    [checkClaimAccess, mutateCharacter, showToast]
  );

  const handleCreateClaimAt = useCallback(
    (centerX: number, centerY: number, centerZ: number, _consumeBeaconItem: boolean) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      if (!wd || !ch) return;

      const { sizeX, sizeZ } = claimSizeRef.current;
      const { minX, minZ } = computeClaimOrigin12x12(centerX, centerZ, sizeX, sizeZ);
      const err = validateNewClaimOutsideSafeZones(
        wd.claims,
        ch.uid,
        minX,
        minZ,
        wd.seed,
        sizeX,
        sizeZ
      );
      if (err) {
        gameAudio.playClaimLocked();
        showToast(err, 'claim_locked');
        return;
      }

      const claimId = `claim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const bx = Math.floor(centerX);
      const bz = Math.floor(centerZ);
      const by = Number.isFinite(centerY) ? Math.floor(centerY) : getSurfaceHeight(wd.seed, bx, bz) + 1;
      const chunksCount = Math.round((sizeX * sizeZ) / (CLAIM_SIZE * CLAIM_SIZE));

      const newClaim: LandClaim12x12 = {
        id: claimId,
        ownerId: ch.uid,
        ownerName: ch.characterName,
        label: `${ch.characterName}'s ${chunksCount}-Chunk Claim`,
        minX,
        minZ,
        sizeX,
        sizeZ,
        beaconX: bx,
        beaconY: by,
        beaconZ: bz,
        trustedFriends: [],
        createdAtMs: Date.now(),
      };

      const beaconMachine: PlacedMachine = {
        id: `m_beacon_${claimId}`,
        kind: 'claim_beacon',
        x: bx,
        y: by,
        z: bz,
        ownerId: ch.uid,
        ownerName: ch.characterName,
        enabled: true,
        coalFuelSeconds: 0,
        coalBuffer: 0,
        storedEnergy: 0,
        maxEnergy: 0,
        selectedRecipeId: null,
        progress: 0,
        augments: [],
        outputBuffer: {},
        mineCursor: 0,
      };

      gameAudio.playClaimCreated();
      setActiveWorld((prev) =>
        prev
          ? {
              ...prev,
              claims: [...prev.claims, newClaim],
              machines: [...prev.machines, beaconMachine],
            }
          : prev
      );
      worldDirtyRef.current = true;
      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({
          type: 'claim:create',
          claim: newClaim,
          beaconMachine,
        });
      }
      setShowClaimBorders(true);
      showToast(
        `${chunksCount}-Chunk Territory (${sizeX}×${sizeZ} blocks) Claimed! Only you & your Trusted Friends can enter.`,
        'info'
      );
    },
    [showToast]
  );

  // --- Place Machine, Universal Conduit, or Direwolf20 Building Gadget Multi-Block Template ---
  const handlePlaceAt = useCallback(
    (x: number, y: number, z: number) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      const eng = engineRef.current;
      if (!wd || !ch || !eng) return;

      if (!isWithinWorldBounds(x, y, z)) return;
      const heldId = ch.hotbar[ch.selectedSlot];
      if (!heldId) return;
      const isCreative = wd.mode === 'peaceful';
      const qty = ch.inventory[heldId] || 0;
      if (!isCreative && qty <= 0) {
        showToast(`Out of ${ITEMS[heldId]?.name || heldId}.`, 'error');
        return;
      }

      const meta = ITEMS[heldId];
      if (!meta?.placeableKind) {
        return;
      }

      if (meta.placeableKind === 'claim_beacon') {
        handleCreateClaimAt(x, y, z, true);
        return;
      }

      if (!checkClaimAccess(x, z, 'build or place machinery here', 'build')) return;

      const key = voxelKey(x, y, z);
      if (wd.machines.some((m) => m.x === x && m.y === y && m.z === z)) return;

      // 1. Place Ender IO Universal Conduit
      if (meta.placeableKind === 'power_cable') {
        if (wd.cables.includes(key)) return;
        gameAudio.playCableConnect();
        setActiveWorld((prev) =>
          prev ? { ...prev, cables: [...prev.cables, key] } : prev
        );
        worldDirtyRef.current = true;
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'cable:place', x, y, z });
        }
        if (!isCreative) {
          mutateCharacter((prev) => {
            const nextInv = { ...prev.inventory };
            nextInv[heldId] = Math.max(0, (nextInv[heldId] || 1) - 1);
            if (nextInv[heldId] === 0) delete nextInv[heldId];
            return { ...prev, inventory: nextInv, totalBlocksPlaced: prev.totalBlocksPlaced + 1 };
          });
        }
        return;
      }

      // 2. Place FTB Direwolf20 Machine (Zero Coin Placement Cost!)
      if (MACHINE_KINDS.has(meta.placeableKind)) {
        const mKind = normalizeMachineKind(meta.placeableKind as MachineKind);
        const spec = MACHINE_SPECS[mKind];
        const defaultRecipe =
          mKind === 'firewood_splitter'
            ? FIREWOOD_SPLITTER_RECIPES[0].id
            : mKind === 'sag_mill'
              ? SAG_MILL_RECIPES[0].id
              : mKind === 'alloy_smelter'
                ? SMELT_RECIPES[0].id
                : mKind === 'molecular_assembler'
                  ? CRAFT_RECIPES[0].id
                  : null;

        const newMachine: PlacedMachine = {
          id: `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          kind: mKind,
          x,
          y,
          z,
          ownerId: ch.uid,
          ownerName: ch.characterName,
          enabled: true,
          coalFuelSeconds: mKind === 'firewood_boiler' ? COAL_BURN_SECONDS_PER_UNIT : 0,
          coalBuffer: mKind === 'firewood_boiler' ? 2 : 0,
          storedEnergy: 0,
          maxEnergy: spec.batteryCapacity,
          selectedRecipeId: defaultRecipe,
          progress: 0,
          augments: [],
          outputBuffer: {},
          mineCursor: 0,
        };
        gameAudio.playBlockPlace();
        setActiveWorld((prev) =>
          prev ? { ...prev, machines: [...prev.machines, newMachine] } : prev
        );
        worldDirtyRef.current = true;
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'machine:place', machine: newMachine });
        }
        if (!isCreative) {
          mutateCharacter((prev) => {
            const nextInv = { ...prev.inventory };
            nextInv[heldId] = Math.max(0, (nextInv[heldId] || 1) - 1);
            if (nextInv[heldId] === 0) delete nextInv[heldId];
            return { ...prev, inventory: nextInv, totalBlocksPlaced: prev.totalBlocksPlaced + 1 };
          });
        }
        return;
      }

      // 3. Place Terrain Block using Direwolf20 Building Gadget Template Mode!
      const bKind = meta.placeableKind as TerrainBlockKind;
      const buildMode: BuildingGadgetMode = ch.buildingGadgetMode || 'single';
      const candidateCoords: [number, number, number][] = [];

      if (
        buildMode === 'single' ||
        DOOR_KINDS.has(bKind) ||
        bKind === 'torch' ||
        bKind === 'chest' ||
        bKind === 'mob_spawner'
      ) {
        candidateCoords.push([x, y, z]);
      } else if (buildMode === 'floor_3x3') {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            candidateCoords.push([x + dx, y, z + dz]);
          }
        }
      } else if (buildMode === 'wall_3x3') {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = 0; dy <= 2; dy++) {
            candidateCoords.push([x + dx, y + dy, z]);
          }
        }
      } else if (buildMode === 'line_5') {
        for (let dx = -2; dx <= 2; dx++) {
          candidateCoords.push([x + dx, y, z]);
        }
      }

      const pos = eng.getPlayerPosition();
      const px = Math.floor(pos.x);
      const py = Math.floor(pos.y);
      const pz = Math.floor(pos.z);

      const maxCanPlace = isCreative ? candidateCoords.length : Math.min(qty, candidateCoords.length);
      const placedDeltas: Record<string, WorldVoxelDelta> = {};
      let placedCount = 0;

      const placedBatch: WorldVoxelDelta[] = [];
      for (const [tx, ty, tz] of candidateCoords) {
        if (placedCount >= maxCanPlace) break;
        if (!isWithinWorldBounds(tx, ty, tz)) continue;
        if (tx === px && tz === pz && (ty === py + 1 || (ty === py && pos.y < ty + 0.55))) continue;
        if (wd.machines.some((m) => m.x === tx && m.y === ty && m.z === tz)) continue;
        if (placedCount > 0 && eng.getVoxelKindAt(tx, ty, tz) !== 'air') continue;

        const tk = voxelKey(tx, ty, tz);
        const delta: WorldVoxelDelta = DOOR_KINDS.has(bKind)
          ? { x: tx, y: ty, z: tz, kind: bKind, open: false }
          : { x: tx, y: ty, z: tz, kind: bKind };
        placedDeltas[tk] = delta;
        placedBatch.push(delta);
        placedCount++;
      }

      if (placedCount === 0) return;

      if (isMultiplayerRef.current) {
        if (placedBatch.length === 1) {
          const only = placedBatch[0];
          mpClientRef.current?.send({
            type: 'voxel:set',
            x: only.x,
            y: only.y,
            z: only.z,
            kind: only.kind,
            open: only.open,
          });
        } else if (placedBatch.length > 1) {
          mpClientRef.current?.send({ type: 'voxel:batch', deltas: placedBatch });
        }
      }

      gameAudio.playBlockPlace();
      setActiveWorld((prev) =>
        prev ? { ...prev, voxelDeltas: { ...prev.voxelDeltas, ...placedDeltas } } : prev
      );
      worldDirtyRef.current = true;

      if (!isCreative) {
        mutateCharacter((prev) => {
          const nextInv = { ...prev.inventory };
          nextInv[heldId] = Math.max(0, (nextInv[heldId] || placedCount) - placedCount);
          if (nextInv[heldId] === 0) delete nextInv[heldId];
          return {
            ...prev,
            inventory: nextInv,
            totalBlocksPlaced: prev.totalBlocksPlaced + placedCount,
          };
        });
      }
    },
    [checkClaimAccess, handleCreateClaimAt, mutateCharacter, showToast]
  );

  const handleOpenChest = useCallback(
    (x: number, _y: number, z: number) => {
      if (!checkClaimAccess(x, z, 'open storage chests here', 'openChests')) return;
      gameAudio.playMachineOpen();
      setShopInitialTab('me_terminal');
      setShowShopModal(true);
      showToast('Opened Storage Chest & Base Inventory!', 'info');
    },
    [checkClaimAccess, showToast]
  );

  const handleLockedClaimBump = useCallback(
    (claim: LandClaim12x12) => {
      const dims = getClaimDimensions(claim);
      gameAudio.playClaimLocked();
      showToast(
        `Entry Blocked: "${claim.label}" (${dims.sizeX}×${dims.sizeZ} · 2 Chunks) is owned by ${claim.ownerName}. Ask them to add you to their Trusted Friends list!`,
        'claim_locked'
      );
    },
    [showToast]
  );

  const handleClickMachine = useCallback(
    (machineId: string) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      if (!wd || !ch) return;
      const machine = wd.machines.find((m) => m.id === machineId);
      if (!machine) return;

      if (machine.kind === 'claim_beacon') {
        const claim = wd.claims.find(
          (c) => c.beaconX === machine.x && c.beaconZ === machine.z
        );
        gameAudio.playMachineOpen();
        setFocusedClaimId(claim?.id || null);
        setShowClaimModal(true);
        return;
      }

      const requiredPerm: ClaimPermissionKey =
        machine.kind === 'me_controller' || machine.kind === 'storage_terminal'
          ? 'openChests'
          : 'toggleMachines';

      const normKind = normalizeMachineKind(machine.kind);
      if (!checkClaimAccess(machine.x, machine.z, `access this ${MACHINE_SPECS[normKind].name}`, requiredPerm)) {
        return;
      }

      if (!canControlMachineInWorld(machine, ch, wd, requiredPerm)) {
        gameAudio.playClaimLocked();
        showToast(
          `Locked: Only ${machine.ownerName || 'the player who placed this machine'} (or a Trusted Friend with Machine permission on their claim) can control it.`,
          'claim_locked'
        );
        return;
      }

      gameAudio.playMachineOpen();
      setOpenMachineId(machine.id);
    },
    [canControlMachineInWorld, checkClaimAccess, showToast]
  );

  const handleToggleDoor = useCallback(
    (x: number, y: number, z: number) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      if (!wd || !ch) return;
      if (!checkClaimAccess(x, z, 'use levers or doors here', 'useLevers')) return;
      const key = voxelKey(x, y, z);
      const existing = wd.voxelDeltas[key];
      if (!existing || !DOOR_KINDS.has(existing.kind)) return;

      const nextOpen = !existing.open;
      gameAudio.playDoorToggle();

      // If this block is a Redstone Control Lever ('lever'), also toggle adjacent machines within 2 blocks!
      let toggledMachinesCount = 0;
      let nextMachines = wd.machines;
      if (existing.kind === 'lever') {
        nextMachines = wd.machines.map((m) => {
          if (m.kind === 'claim_beacon') return m;
          const dist = Math.max(Math.abs(m.x - x), Math.abs(m.y - y), Math.abs(m.z - z));
          if (dist > 2) return m;
          if (!canControlMachineInWorld(m, ch, wd, 'toggleMachines') && !canControlMachineInWorld(m, ch, wd, 'useLevers')) {
            return m;
          }
          toggledMachinesCount++;
          const updatedM: PlacedMachine = { ...m, enabled: nextOpen };
          if (isMultiplayerRef.current) {
            mpClientRef.current?.send({ type: 'machine:update', machine: updatedM });
          }
          return updatedM;
        });
      }

      setActiveWorld((prev) =>
        prev
          ? {
              ...prev,
              machines: nextMachines,
              voxelDeltas: {
                ...prev.voxelDeltas,
                [key]: { ...existing, open: nextOpen },
              },
            }
          : prev
      );
      worldDirtyRef.current = true;
      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'door:toggle', x, y, z });
      }
      if (existing.kind === 'lever') {
        showToast(
          toggledMachinesCount > 0
            ? `Redstone Lever switched ${nextOpen ? 'ON' : 'OFF'} (${toggledMachinesCount} adjacent machine${toggledMachinesCount > 1 ? 's' : ''} ${nextOpen ? 'Enabled' : 'Paused'}).`
            : `Redstone Lever switched ${nextOpen ? 'ON' : 'OFF'}.`,
          'info'
        );
      }
    },
    [canControlMachineInWorld, checkClaimAccess, showToast]
  );

  const handleRemoveCable = useCallback(
    (x: number, y: number, z: number) => {
      if (!checkClaimAccess(x, z, 'remove conduits here', 'build')) return;
      const key = voxelKey(x, y, z);
      gameAudio.playBlockBreak();
      setActiveWorld((prev) =>
        prev ? { ...prev, cables: prev.cables.filter((c) => c !== key) } : prev
      );
      worldDirtyRef.current = true;
      addItemToChar('power_cable', 1);
      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'cable:remove', x, y, z });
      }
    },
    [addItemToChar, checkClaimAccess]
  );

  const handleRemoveMachine = useCallback(
    (machineId: string) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      if (!wd || !ch) return;
      const target = wd.machines.find((m) => m.id === machineId);
      if (!target) return;

      if (!checkClaimAccess(target.x, target.z, 'dismantle this machine', 'build')) return;

      if (!canControlMachineInWorld(target, ch, wd, 'build')) {
        gameAudio.playClaimLocked();
        showToast(
          `Locked: Only ${target.ownerName || 'the player who placed this machine'} (or a Trusted Friend with Build permission) can dismantle it.`,
          'claim_locked'
        );
        return;
      }

      gameAudio.playBlockBreak();
      setActiveWorld((prev) =>
        prev ? { ...prev, machines: prev.machines.filter((m) => m.id !== machineId) } : prev
      );
      worldDirtyRef.current = true;
      const normKind = normalizeMachineKind(target.kind);
      addItemToChar(normKind, 1);
      if (target.augments && target.augments.length > 0) {
        for (const augId of target.augments) {
          addItemToChar(augId, 1);
        }
      }
      if (target.coalBuffer > 0) {
        addItemToChar(normKind === 'powah_reactor' ? 'blazegold_ingot' : 'firewood_bundle', target.coalBuffer);
      }
      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'machine:remove', machineId });
      }
      showToast(`Dismantled ${MACHINE_SPECS[normKind].name} (returned machine + installed augments).`, 'info');
    },
    [addItemToChar, canControlMachineInWorld, checkClaimAccess, showToast]
  );

  const handleStrikeMob = useCallback(
    (mobId: string) => {
      const ch = characterRef.current;
      const eng = engineRef.current;
      if (!ch || !eng) return;
      const wpn = getWeaponMeta(ch.weaponTier);
      const scaledDamage = Math.round(wpn.attackDamage * (1 + (ch.level - 1) * 0.04));
      gameAudio.playWeaponHit();
      const res = eng.damageMob(mobId, scaledDamage);
      if (res?.killed) {
        const isGolem = res.mobName.toLowerCase().includes('golem');
        const drops: ResourceItemId[] = isGolem
          ? ['iron_ore', 'gold_ore', 'crystal_ore', 'steel_plate']
          : ['coal', 'copper_ore', 'iron_ore', 'cooked_ration'];
        const dropId = drops[Math.floor(Math.random() * drops.length)];
        const coinReward = isGolem ? 65 : 40;
        const xpReward = isGolem ? 80 : 50;
        addItemToChar(dropId, 1);
        mutateCharacter((prev) => {
          let xp = prev.xp + xpReward;
          let level = prev.level;
          let maxHealth = prev.maxHealth;
          let health = prev.health;
          while (xp >= level * 180) {
            xp -= level * 180;
            level += 1;
            maxHealth += 5;
            health = Math.min(maxHealth, health + 5);
          }
          return {
            ...prev,
            credits: prev.credits + coinReward,
            xp,
            level,
            health,
            maxHealth,
          };
        });
        showToast(
          `Slain ${res.mobName}! +${coinReward} Coins, +${xpReward} XP, +1 ${ITEMS[dropId].name}`,
          'info'
        );
      }
    },
    [addItemToChar, mutateCharacter, showToast]
  );

  const handlePlayerDamaged = useCallback(
    (rawDamage: number, sourceName: string) => {
      const ch = characterRef.current;
      const wd = worldRef.current;
      if (!ch || !wd || wd.mode !== 'survival') return;
      const armor = getArmorMeta(ch.armorTier);
      const mitigated = Math.max(2, Math.round(rawDamage * (1 - armor.defense)));

      gameAudio.playWeaponHit();
      setPlayerHurtFlash(true);
      if (hurtFlashTimerRef.current) window.clearTimeout(hurtFlashTimerRef.current);
      hurtFlashTimerRef.current = window.setTimeout(() => setPlayerHurtFlash(false), 360);

      const nextHp = ch.health - mitigated;
      if (nextHp <= 0) {
        // Minecraft-style respawn at Factory Waypoint or central spawn pad with restored health
        const baseSpawn = personalSpawnRef.current;
        const rx = baseSpawn ? baseSpawn.x : STARTER_TOWN_SPAWN.x;
        const rz = baseSpawn ? baseSpawn.z : STARTER_TOWN_SPAWN.z;
        const ry = getSurfaceHeight(wd.seed, Math.floor(rx), Math.floor(rz)) + 1.5;
        engineRef.current?.teleportTo(rx, ry, rz);
        mutateCharacter((prev) => ({
          ...prev,
          health: prev.maxHealth,
          hunger: prev.maxHunger ?? 100,
        }));
        showToast(
          `Knocked out by ${sourceName}! Respawned at your safe sanctuary with full health.`,
          'error'
        );
      } else {
        mutateCharacter((prev) => ({
          ...prev,
          health: nextHp,
        }));
      }
    },
    [mutateCharacter, showToast]
  );

  const persistPersonalSpawn = useCallback((nextSpawn: PersonalSpawnPoint | null) => {
    personalSpawnRef.current = nextSpawn;
    setPersonalSpawn(nextSpawn);
    const ch = characterRef.current;
    const wd = worldRef.current;
    if (ch && wd) {
      saveLocalWorldPlayerState(ch.uid, wd.id, extractWorldPlayerState(ch, nextSpawn));
      setActiveWorld((prev) =>
        prev
          ? {
              ...prev,
              playerStates: {
                ...(prev.playerStates || {}),
                [ch.uid]: extractWorldPlayerState(ch, nextSpawn),
              },
            }
          : prev
      );
      worldDirtyRef.current = true;
    }
  }, []);

  // Unrestricted Factory Waypoint: Set anywhere in the FTB Factory Sandbox!
  const handleSetPersonalSpawnHere = useCallback(() => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    const eng = engineRef.current;
    if (!wd || !ch || !eng) return;

    const pos = eng.getPlayerPosition();
    const bx = Math.floor(pos.x);
    const bz = Math.floor(pos.z);
    const floorY = Math.max(getSurfaceHeight(wd.seed, bx, bz) + 1, Math.floor(pos.y));
    const claim = findClaimAt(wd.claims, pos.x, pos.z);

    const nextSpawn: PersonalSpawnPoint = {
      x: bx + 0.5,
      y: floorY,
      z: bz + 0.5,
      claimId: claim?.id || 'factory_waypoint',
      claimLabel: claim?.label || 'FTB Factory Waypoint',
    };
    persistPersonalSpawn(nextSpawn);
    gameAudio.playClaimCreated();
    showToast(`Factory Waypoint set at (${bx}, ${floorY}, ${bz})!`, 'info');
  }, [persistPersonalSpawn, showToast]);

  const handleSetPersonalSpawnInClaim = useCallback(
    (claimId: string) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      const eng = engineRef.current;
      if (!wd || !ch || !eng) return;

      const claim = wd.claims.find((c) => c.id === claimId);
      if (!claim) return;

      const pos = eng.getPlayerPosition();
      let bx: number;
      let bz: number;
      let floorY: number;

      if (isInsideClaim12x12(claim, pos.x, pos.z)) {
        bx = Math.floor(pos.x);
        bz = Math.floor(pos.z);
        floorY = Math.max(getSurfaceHeight(wd.seed, bx, bz) + 1, Math.floor(pos.y));
      } else {
        const offsetX = claim.beaconX + 1 < claim.minX + CLAIM_SIZE ? claim.beaconX + 1 : claim.beaconX - 1;
        bx = Math.max(claim.minX, Math.min(claim.minX + CLAIM_SIZE - 1, offsetX));
        bz = Math.max(claim.minZ, Math.min(claim.minZ + CLAIM_SIZE - 1, claim.beaconZ));
        floorY = getSurfaceHeight(wd.seed, bx, bz) + 1;
      }

      const nextSpawn: PersonalSpawnPoint = {
        x: bx + 0.5,
        y: floorY,
        z: bz + 0.5,
        claimId: claim.id,
        claimLabel: claim.label,
      };
      persistPersonalSpawn(nextSpawn);
      gameAudio.playClaimCreated();
      showToast(`Factory Waypoint set inside "${claim.label}" (${bx}, ${bz}).`, 'info');
    },
    [persistPersonalSpawn, showToast]
  );

  const handleClearPersonalSpawn = useCallback(() => {
    persistPersonalSpawn(null);
    showToast('Factory Waypoint cleared.', 'info');
  }, [persistPersonalSpawn, showToast]);

  const handleReturnToBaseSpawn = useCallback(() => {
    const wd = worldRef.current;
    const baseSpawn = personalSpawnRef.current;
    if (!wd || !baseSpawn) {
      showToast('No Factory Waypoint set yet. Click "Set Waypoint" on the HUD first.', 'error');
      return;
    }
    const safeY = Math.max(
      baseSpawn.y,
      getSurfaceHeight(wd.seed, Math.floor(baseSpawn.x), Math.floor(baseSpawn.z)) + 1.2
    );
    engineRef.current?.teleportTo(baseSpawn.x, safeY, baseSpawn.z);
    gameAudio.playClaimCreated();
    showToast(`Teleported to Factory Waypoint (${Math.floor(baseSpawn.x)}, ${Math.floor(baseSpawn.z)}).`, 'info');
  }, [showToast]);

  const handleReturnToTown = useCallback(() => {
    const wd = worldRef.current;
    if (!wd) return;
    const safeY = getSurfaceHeight(wd.seed, 0, 0) + 1.5;
    engineRef.current?.teleportTo(STARTER_TOWN_SPAWN.x, safeY, STARTER_TOWN_SPAWN.z);
    gameAudio.playClaimCreated();
    showToast('Teleported to central 9×9 Direwolf20 Factory Workshop Pad (0, 0).', 'info');
  }, [showToast]);

  const handleCycleMiningGadgetMode = useCallback(() => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const canUse3x3 = wd.mode === 'peaceful' || getPickaxeMeta(ch.pickaxeTier).supports3x3Bore;
    if (!canUse3x3) {
      gameAudio.playClaimLocked();
      showToast(
        'Craft or equip Mining Gadget MK-III (Tier 4) to unlock the 3×3 Tunnel Bore Laser!',
        'error'
      );
      mutateCharacter((prev) => ({ ...prev, miningGadgetMode: 'single_1x1' }));
      return;
    }
    const nextMode: MiningGadgetMode =
      ch.miningGadgetMode === 'bore_3x3' ? 'single_1x1' : 'bore_3x3';
    mutateCharacter((prev) => ({ ...prev, miningGadgetMode: nextMode }));
    showToast(
      nextMode === 'bore_3x3'
        ? 'Mining Gadget switched to 3×3 Tunnel Bore Laser Mode!'
        : 'Mining Gadget switched to 1×1 Precision Laser Mode.',
      'info'
    );
  }, [mutateCharacter, showToast]);

  const handleCycleBuildingGadgetMode = useCallback(() => {
    const ch = characterRef.current;
    if (!ch) return;
    const curr = ch.buildingGadgetMode || 'single';
    const nextIdx = (BUILDING_MODES_ORDER.indexOf(curr) + 1) % BUILDING_MODES_ORDER.length;
    const nextMode = BUILDING_MODES_ORDER[nextIdx];
    const labelMap: Record<BuildingGadgetMode, string> = {
      single: 'Single Block (1×1)',
      floor_3x3: '3×3 Horizontal Floor Pad',
      wall_3x3: '3×3 Vertical Wall',
      line_5: '5-Block Line',
    };
    mutateCharacter((prev) => ({ ...prev, buildingGadgetMode: nextMode }));
    showToast(`Building Gadget Mode: ${labelMap[nextMode]}`, 'info');
  }, [mutateCharacter, showToast]);

  const handleActiveChunksChanged = useCallback((keys: string[]) => {
    setActiveChunkKeys(keys);
    const wd = worldRef.current;
    if (!wd) return;
    const prevList = wd.exploredChunks || [];
    const existingSet = new Set(prevList);
    let hasNew = false;
    for (let i = 0; i < keys.length; i++) {
      if (!existingSet.has(keys[i])) {
        existingSet.add(keys[i]);
        hasNew = true;
      }
    }
    if (!hasNew) return;
    const merged = Array.from(existingSet).slice(-256);
    setActiveWorld((prev) => (prev ? { ...prev, exploredChunks: merged } : prev));
    worldDirtyRef.current = true;
  }, []);

  // --- Mount & Sync Three.js Engine ---
  const activeWorldId = activeWorld?.id || null;
  useEffect(() => {
    if (!activeWorldId || !canvasHostRef.current || !characterRef.current) return;
    const wd = worldRef.current!;
    const ch = characterRef.current!;

    setWebglLost(false);
    const engine = new VoxelWorldEngine(canvasHostRef.current, ch.appearance, {
      onPlayerMove: (x, y, z, yaw, crouching) => {
        setPlayerPos({ x, y, z, yaw });
        if (isMultiplayerRef.current) {
          const currChar = characterRef.current;
          mpClientRef.current?.send({
            type: 'player:move',
            x,
            y,
            z,
            yaw,
            crouching,
            heldItem: currChar ? currChar.hotbar[currChar.selectedSlot] : null,
          });
        }
      },
      onActiveChunksChanged: handleActiveChunksChanged,
      onMineBlock: handleMineBlock,
      onPlaceAt: handlePlaceAt,
      onClickMachine: handleClickMachine,
      onToggleDoor: handleToggleDoor,
      onOpenChest: handleOpenChest,
      onLockedClaimBump: handleLockedClaimBump,
      onRemoveCable: handleRemoveCable,
      onRemoveMachine: handleRemoveMachine,
      onStrikeMob: handleStrikeMob,
      onPlayerDamaged: handlePlayerDamaged,
      onHoverChanged: setHoverTarget,
      onWebglContextLost: () => setWebglLost(true),
    });

    engine.setLocalIdentity(ch.uid, ch.characterName);
    engine.setCameraMode(ch.cameraMode);
    engine.setPickaxeTier(ch.pickaxeTier);
    engine.setBonusHarvestPower(ch.playerClass === 'miner' ? 1 : 0);
    engine.setClaimPreviewSize(claimSizeRef.current.sizeX, claimSizeRef.current.sizeZ);
    engine.setHungerExhausted((ch.hunger ?? 100) <= 30);
    engine.setShowClaimBorders(true);
    engine.setLowLagMode(lowLagModeRef.current);
    const initialDay = getDayNightState(Date.now(), wd.createdAtMs, wd.seed);
    setDayNight(initialDay);
    engine.updateDayNight(initialDay);
    lastWeatherKindRef.current = initialDay.weather.kind;
    gameAudio.setRainAmbience(initialDay.weather.rainIntensity);
    const initialGrid = evaluatePowerGrid(wd.machines, wd.cables, initialDay.solarEfficiency);
    const savedPersonalSpawn = personalSpawnRef.current;
    const entrySpawnX = savedPersonalSpawn ? savedPersonalSpawn.x : wd.spawnX;
    const entrySpawnZ = savedPersonalSpawn ? savedPersonalSpawn.z : wd.spawnZ;
    const entrySpawnY = savedPersonalSpawn
      ? Math.max(
          savedPersonalSpawn.y,
          getSurfaceHeight(wd.seed, Math.floor(savedPersonalSpawn.x), Math.floor(savedPersonalSpawn.z)) + 1.2
        )
      : wd.spawnY;

    engine.loadWorld({
      seed: wd.seed,
      mode: wd.mode,
      deltas: wd.voxelDeltas,
      machines: wd.machines,
      cables: wd.cables,
      claims: wd.claims,
      grid: initialGrid,
      spawnX: entrySpawnX,
      spawnY: entrySpawnY,
      spawnZ: entrySpawnZ,
      resetPlayerPos: true,
    });
    engine.setPersonalSpawnMarker(savedPersonalSpawn);
    prevDeltasRef.current = wd.voxelDeltas;
    prevClaimsRef.current = wd.claims;
    prevMachinesRef.current = wd.machines;
    prevCablesRef.current = wd.cables;
    prevGridRef.current = initialGrid;
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [
    activeWorldId,
    handleActiveChunksChanged,
    handleMineBlock,
    handlePlaceAt,
    handleClickMachine,
    handleToggleDoor,
    handleOpenChest,
    handleLockedClaimBump,
    handleRemoveCable,
    handleRemoveMachine,
    handleStrikeMob,
    handlePlayerDamaged,
  ]);

  const prevDeltasRef = useRef<WorldData['voxelDeltas'] | null>(null);
  const prevClaimsRef = useRef<LandClaim12x12[] | null>(null);
  const prevMachinesRef = useRef<PlacedMachine[] | null>(null);
  const prevCablesRef = useRef<string[] | null>(null);
  const prevGridRef = useRef<ReturnType<typeof evaluatePowerGrid> | null>(null);
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !activeWorld) return;
    const terrainDirty = prevDeltasRef.current !== activeWorld.voxelDeltas;
    const claimsDirty = prevClaimsRef.current !== activeWorld.claims;
    const machinesDirty =
      prevMachinesRef.current !== activeWorld.machines ||
      prevCablesRef.current !== activeWorld.cables ||
      prevGridRef.current !== grid;

    prevDeltasRef.current = activeWorld.voxelDeltas;
    prevClaimsRef.current = activeWorld.claims;
    prevMachinesRef.current = activeWorld.machines;
    prevCablesRef.current = activeWorld.cables;
    prevGridRef.current = grid;

    eng.syncWorldState({
      mode: activeWorld.mode,
      deltas: activeWorld.voxelDeltas,
      machines: activeWorld.machines,
      cables: activeWorld.cables,
      claims: activeWorld.claims,
      grid,
      terrainDirty,
      machinesDirty,
      claimsDirty,
    });
  }, [activeWorld, grid]);

  useEffect(() => {
    const anyModalOpen = Boolean(
      openMachineId ||
        showClaimModal ||
        showClassWorkersModal ||
        showShopModal ||
        showInventoryModal ||
        showMultiplayerModal
    );
    engineRef.current?.setInputPaused(anyModalOpen);
  }, [
    openMachineId,
    showClaimModal,
    showClassWorkersModal,
    showShopModal,
    showInventoryModal,
    showMultiplayerModal,
  ]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !character) return;
    eng.setPickaxeTier(character.pickaxeTier);
    eng.setCameraMode(character.cameraMode);
    eng.setBonusHarvestPower(character.playerClass === 'miner' ? 1 : 0);
    eng.setHungerExhausted((character.hunger ?? 100) <= 30);
    const held = character.hotbar[character.selectedSlot];
    eng.setHoldingClaimBeacon(held === 'claim_beacon');
  }, [character]);

  useEffect(() => {
    engineRef.current?.setClaimPreviewSize(claimSize.sizeX, claimSize.sizeZ);
  }, [claimSize]);

  useEffect(() => {
    engineRef.current?.setShowClaimBorders(showClaimBorders);
  }, [showClaimBorders]);

  useEffect(() => {
    engineRef.current?.setPersonalSpawnMarker(personalSpawn);
  }, [personalSpawn, activeWorldId]);

  useEffect(() => {
    engineRef.current?.setLowLagMode(lowLagMode);
    try {
      window.localStorage.setItem('aethercraft_low_lag_mode', lowLagMode ? '1' : '0');
    } catch {
      // Ignore storage quota errors
    }
  }, [lowLagMode]);

  useEffect(() => {
    if (!character) return;
    engineRef.current?.syncRemotePlayers(remotePlayers, character.uid);
  }, [remotePlayers, character]);

  // Keyboard shortcuts (1-9 hotbar, G Wireless ME Grid, J JEI Tech Chains, M 3x3 Laser Mode, V Building Gadget Mode, I Backpack)
  useEffect(() => {
    if (!activeWorld) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        mutateCharacter((prev) => ({ ...prev, selectedSlot: idx }));
      } else if (e.code === 'KeyG') {
        e.preventDefault();
        setShopInitialTab('me_terminal');
        setShowShopModal((v) => !v);
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        setShopInitialTab('jei_chains');
        setShowShopModal((v) => !v);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleCycleMiningGadgetMode();
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        handleCycleBuildingGadgetMode();
      } else if (e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault();
        setShowInventoryModal((v) => !v);
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        setShowMultiplayerModal((v) => !v);
      } else if (e.code === 'KeyB') {
        setShowClaimBorders((v) => !v);
      } else if (e.code === 'Escape') {
        setOpenMachineId(null);
        setShowClaimModal(false);
        setShowShopModal(false);
        setShowInventoryModal(false);
        setShowMultiplayerModal(false);
        setShowClassWorkersModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    activeWorld,
    mutateCharacter,
    handleCycleMiningGadgetMode,
    handleCycleBuildingGadgetMode,
  ]);

  // --- Multiplayer Session Wiring ---
  const createMpClient = useCallback(() => {
    mpClientRef.current?.disconnect();
    const client = new WorldMultiplayerClient({
      onStatus: (status) => {
        setMpStatus(status);
        if (status === 'reconnecting') {
          showToast('Connection interrupted — reconnecting to co-op server...', 'info');
        }
      },
      onReconnectNeeded: () => {
        const wd = worldRef.current;
        const ch = characterRef.current;
        const pos = engineRef.current?.getPlayerPosition() || { x: 0.5, y: 4, z: 0.5 };
        if (!wd || !ch) return;
        const playerPayload = {
          uid: ch.uid,
          name: ch.characterName,
          appearance: ch.appearance,
          x: pos.x,
          y: pos.y,
          z: pos.z,
          yaw: 0,
          heldItem: ch.hotbar[ch.selectedSlot],
          pickaxeTier: ch.pickaxeTier,
          armorTier: ch.armorTier,
          weaponTier: ch.weaponTier,
          crouching: false,
        };
        if (isHostingRef.current) {
          mpClientRef.current?.send({ type: 'world:host', world: wd, player: playerPayload });
        } else {
          mpClientRef.current?.send({
            type: 'world:join',
            inviteCode: wd.inviteCode,
            player: playerPayload,
          });
        }
        showToast('Reconnected to live co-op factory!', 'info');
      },
      onJoined: (_clientId, room) => {
        const ch = characterRef.current;
        const alreadyInSameWorld = worldRef.current?.id === room.world.id;
        if (!alreadyInSameWorld) {
          let resolvedSpawn: PersonalSpawnPoint | null = null;
          if (ch) {
            const hydrated = hydrateCharacterForWorld(ch, room.world);
            characterRef.current = hydrated;
            setCharacter(hydrated);
            resolvedSpawn = getSavedPersonalSpawnForWorld(ch.uid, room.world);
            personalSpawnRef.current = resolvedSpawn;
            setPersonalSpawn(resolvedSpawn);
          }
          const entryX = resolvedSpawn ? resolvedSpawn.x : room.world.spawnX;
          const entryZ = resolvedSpawn ? resolvedSpawn.z : room.world.spawnZ;
          const entryY = resolvedSpawn
            ? Math.max(
                resolvedSpawn.y,
                getSurfaceHeight(
                  room.world.seed,
                  Math.floor(resolvedSpawn.x),
                  Math.floor(resolvedSpawn.z)
                ) + 1.2
              )
            : room.world.spawnY;
          const initialChunks = getClosestChunkKeys(entryX, entryZ, MAX_ACTIVE_CHUNKS);
          setActiveChunkKeys(initialChunks);
          setPlayerPos({ x: entryX, y: entryY, z: entryZ, yaw: 0 });
          setDayNight(getDayNightState(Date.now(), room.world.createdAtMs));
          setActiveWorld({
            ...room.world,
            exploredChunks:
              room.world.exploredChunks && room.world.exploredChunks.length > 0
                ? room.world.exploredChunks
                : initialChunks,
          });
        } else {
          setActiveWorld((prev) =>
            prev
              ? {
                  ...prev,
                  accessMode: room.world.accessMode,
                  inviteCode: room.world.inviteCode,
                }
              : room.world
          );
        }
        setRemotePlayers(room.players);
        setChatMessages(room.chat);
        setIsMultiplayerSession(true);
      },
      onState: (room) => {
        setActiveWorld((prev) => ({
          ...room.world,
          exploredChunks:
            prev &&
            prev.id === room.world.id &&
            prev.exploredChunks &&
            prev.exploredChunks.length > (room.world.exploredChunks?.length || 0)
              ? prev.exploredChunks
              : room.world.exploredChunks,
          playerStates:
            prev && prev.id === room.world.id && prev.playerStates
              ? { ...room.world.playerStates, ...prev.playerStates }
              : room.world.playerStates,
          tradeOffers:
            room.world.tradeOffers && room.world.tradeOffers.length > 0
              ? room.world.tradeOffers
              : prev && prev.id === room.world.id
                ? prev.tradeOffers
                : room.world.tradeOffers,
        }));
        setRemotePlayers(room.players);
        setChatMessages(room.chat);
      },
      onLeft: () => {
        setIsMultiplayerSession(false);
        setIsHostingMultiplayer(false);
        setRemotePlayers([]);
      },
      onMessage: (msg: ServerWsMessage) => {
        if (msg.type === 'player:moved') {
          setRemotePlayers((prev) =>
            prev.map((p) =>
              p.clientId === msg.clientId
                ? {
                    ...p,
                    x: msg.x,
                    y: msg.y,
                    z: msg.z,
                    yaw: msg.yaw,
                    crouching: msg.crouching,
                    heldItem: msg.heldItem,
                  }
                : p
            )
          );
        } else if (msg.type === 'player:laser') {
          engineRef.current?.pulseRemoteLaser(msg.clientId, msg.tx, msg.ty, msg.tz);
        } else if (msg.type === 'voxel:updated') {
          const key = voxelKey(msg.delta.x, msg.delta.y, msg.delta.z);
          setActiveWorld((prev) =>
            prev ? { ...prev, voxelDeltas: { ...prev.voxelDeltas, [key]: msg.delta } } : prev
          );
          worldDirtyRef.current = true;
        } else if (msg.type === 'voxel:batch_updated') {
          const patch: Record<string, WorldVoxelDelta> = {};
          for (const d of msg.deltas) {
            patch[voxelKey(d.x, d.y, d.z)] = d;
          }
          setActiveWorld((prev) =>
            prev ? { ...prev, voxelDeltas: { ...prev.voxelDeltas, ...patch } } : prev
          );
          worldDirtyRef.current = true;
        } else if (msg.type === 'cables:updated') {
          setActiveWorld((prev) => (prev ? { ...prev, cables: msg.cables } : prev));
          worldDirtyRef.current = true;
        } else if (msg.type === 'machines:updated') {
          setActiveWorld((prev) =>
            prev
              ? {
                  ...prev,
                  machines: msg.machines,
                  storageInventory: msg.storageInventory ?? prev.storageInventory,
                }
              : prev
          );
          worldDirtyRef.current = true;
        } else if (msg.type === 'storage:updated') {
          setActiveWorld((prev) =>
            prev ? { ...prev, storageInventory: msg.storageInventory } : prev
          );
          worldDirtyRef.current = true;
        } else if (msg.type === 'claims:updated') {
          setActiveWorld((prev) => (prev ? { ...prev, claims: msg.claims } : prev));
          worldDirtyRef.current = true;
        } else if (msg.type === 'chat:message') {
          setChatMessages((prev) => [...prev.slice(-39), msg.message]);
        } else if (msg.type === 'notice') {
          if (msg.tone === 'claim_locked') gameAudio.playClaimLocked();
          showToast(msg.message, msg.tone);
        }
      },
    });
    mpClientRef.current = client;
    return client;
  }, [showToast]);

  const handleLaunchWorld = async (world: WorldData, hostMultiplayer: boolean) => {
    const ch = characterRef.current;
    if (!ch) return;

    const hydrated = hydrateCharacterForWorld(ch, world);
    characterRef.current = hydrated;
    setCharacter(hydrated);
    const resolvedSpawn = getSavedPersonalSpawnForWorld(ch.uid, world);
    personalSpawnRef.current = resolvedSpawn;
    setPersonalSpawn(resolvedSpawn);
    const entryX = resolvedSpawn ? resolvedSpawn.x : world.spawnX;
    const entryZ = resolvedSpawn ? resolvedSpawn.z : world.spawnZ;
    const entryY = resolvedSpawn
      ? Math.max(
          resolvedSpawn.y,
          getSurfaceHeight(world.seed, Math.floor(resolvedSpawn.x), Math.floor(resolvedSpawn.z)) + 1.2
        )
      : world.spawnY;

    const initialChunks = getClosestChunkKeys(entryX, entryZ, MAX_ACTIVE_CHUNKS);
    const seededWorld: WorldData = {
      ...world,
      exploredChunks:
        world.exploredChunks && world.exploredChunks.length > 0
          ? world.exploredChunks
          : initialChunks,
    };
    setActiveChunkKeys(initialChunks);
    setPlayerPos({ x: entryX, y: entryY, z: entryZ, yaw: 0 });
    setDayNight(getDayNightState(Date.now(), world.createdAtMs));
    setHoverTarget(null);

    if (!hostMultiplayer) {
      mpClientRef.current?.disconnect();
      setIsMultiplayerSession(false);
      setIsHostingMultiplayer(false);
      setRemotePlayers([]);
      setChatMessages([]);
      setActiveWorld(seededWorld);
      return;
    }

    try {
      const client = createMpClient();
      await client.connect();
      setIsHostingMultiplayer(true);
      client.send({
        type: 'world:host',
        world: seededWorld,
        player: {
          uid: hydrated.uid,
          name: hydrated.characterName,
          appearance: hydrated.appearance,
          x: entryX,
          y: entryY,
          z: entryZ,
          yaw: 0,
          heldItem: hydrated.hotbar[hydrated.selectedSlot],
          pickaxeTier: hydrated.pickaxeTier,
          armorTier: hydrated.armorTier,
          weaponTier: hydrated.weaponTier,
          crouching: false,
        },
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not host world.', 'error');
    }
  };

  const handleJoinByCode = async (inviteCode: string) => {
    const ch = characterRef.current;
    if (!ch) return;
    const fresh = createFreshWorldPlayerState();
    try {
      const client = createMpClient();
      await client.connect();
      setIsHostingMultiplayer(false);
      client.send({
        type: 'world:join',
        inviteCode,
        player: {
          uid: ch.uid,
          name: ch.characterName,
          appearance: ch.appearance,
          x: 0.5,
          y: 4,
          z: 0.5,
          yaw: 0,
          heldItem: fresh.hotbar[fresh.selectedSlot],
          pickaxeTier: fresh.pickaxeTier,
          armorTier: fresh.armorTier,
          weaponTier: fresh.weaponTier,
          crouching: false,
        },
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not join world.', 'error');
    }
  };

  const handleStartHostingLive = async (accessMode: WorldAccessMode) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const pos = engineRef.current?.getPlayerPosition() || { x: wd.spawnX, y: wd.spawnY, z: wd.spawnZ };
    const updatedWorld: WorldData = { ...wd, accessMode };
    setActiveWorld(updatedWorld);
    worldDirtyRef.current = true;
    try {
      const client = createMpClient();
      await client.connect();
      setIsHostingMultiplayer(true);
      client.send({
        type: 'world:host',
        world: updatedWorld,
        player: {
          uid: ch.uid,
          name: ch.characterName,
          appearance: ch.appearance,
          x: pos.x,
          y: pos.y,
          z: pos.z,
          yaw: 0,
          heldItem: ch.hotbar[ch.selectedSlot],
          pickaxeTier: ch.pickaxeTier,
          armorTier: ch.armorTier,
          weaponTier: ch.weaponTier,
          crouching: false,
        },
      });
      showToast(`Live Co-op Server opened! Invite Code: ${updatedWorld.inviteCode}`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open co-op server.', 'error');
    }
  };

  const handleUpdateLiveAccessMode = (accessMode: WorldAccessMode) => {
    setActiveWorld((prev) => (prev ? { ...prev, accessMode } : prev));
    worldDirtyRef.current = true;
    if (isMultiplayerRef.current) {
      mpClientRef.current?.send({ type: 'world:settings', accessMode });
    }
    showToast(
      `Room visibility set to ${
        accessMode === 'public'
          ? 'Public Server Browser'
          : accessMode === 'friends'
            ? 'Friends (Invite Code)'
            : 'Private'
      }.`,
      'info'
    );
  };

  const handleTeleportToPlayer = (target: RemotePlayer) => {
    const wd = worldRef.current;
    if (!wd) return;
    const safeY = Math.max(
      target.y,
      getSurfaceHeight(wd.seed, Math.floor(target.x), Math.floor(target.z)) + 1.2
    );
    engineRef.current?.teleportTo(target.x + 1.2, safeY, target.z + 1.2);
    gameAudio.playClaimCreated();
    showToast(`Teleported to ${target.name} (${Math.floor(target.x)}, ${Math.floor(target.z)}).`, 'info');
  };

  const handleShareLocationInChat = () => {
    if (!isMultiplayerRef.current) return;
    const pos = engineRef.current?.getPlayerPosition() || playerPos;
    mpClientRef.current?.send({
      type: 'chat:send',
      text: `📍 Factory Ping: I'm at X ${Math.floor(pos.x)}, Y ${Math.floor(pos.y)}, Z ${Math.floor(pos.z)}!`,
    });
    showToast('Shared your coordinates in Team Chat.', 'info');
  };

  const handleDisconnectMultiplayer = () => {
    mpClientRef.current?.disconnect();
    setIsMultiplayerSession(false);
    setIsHostingMultiplayer(false);
    setRemotePlayers([]);
    showToast('Switched back to Offline Solo mode. Factory progress preserved.', 'info');
  };

  const handleSaveAndExit = async () => {
    gameAudio.stopRainAmbience();
    lastWeatherKindRef.current = null;
    await flushAutoSave(true);
    mpClientRef.current?.disconnect();
    setOpenMachineId(null);
    setShowClaimModal(false);
    setShowShopModal(false);
    setShowInventoryModal(false);
    setShowMultiplayerModal(false);
    setShowClassWorkersModal(false);
    setActiveWorld(null);
    personalSpawnRef.current = null;
    setPersonalSpawn(null);
    setIsMultiplayerSession(false);
    setIsHostingMultiplayer(false);
    setRemotePlayers([]);
    setChatMessages([]);
  };

  // --- Machine Console, Placed Machine Command Drawer & 3-Slot Augment Addon Handlers ---
  const handleUpdateMachine = (updated: PlacedMachine) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    if (!checkClaimAccess(updated.x, updated.z, 'operate this machine', 'toggleMachines')) return;
    if (!canControlMachineInWorld(updated, ch, wd, 'toggleMachines')) {
      gameAudio.playClaimLocked();
      showToast(
        `Locked: Only ${updated.ownerName || 'the player who placed this machine'} (or a Trusted Friend with Toggle Machines permission) can control it.`,
        'claim_locked'
      );
      return;
    }
    setActiveWorld((prev) =>
      prev
        ? { ...prev, machines: prev.machines.map((m) => (m.id === updated.id ? updated : m)) }
        : prev
    );
    worldDirtyRef.current = true;
    if (isMultiplayerRef.current) {
      mpClientRef.current?.send({ type: 'machine:update', machine: updated });
    }
  };

  const handleFeedFuel = (machineId: string, fuelItemId: ResourceItemId, qty: number) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const m = wd.machines.find((x) => x.id === machineId);
    if (!m) return;
    if (!checkClaimAccess(m.x, m.z, 'fuel this machine', 'toggleMachines')) return;
    if (!canControlMachineInWorld(m, ch, wd, 'toggleMachines')) {
      gameAudio.playClaimLocked();
      showToast(
        `Locked: Only ${m.ownerName || 'the player who placed this machine'} (or a Trusted Friend with Toggle Machines permission) can fuel it.`,
        'claim_locked'
      );
      return;
    }
    const isCreative = wd.mode === 'peaceful';
    const inBag = ch.inventory[fuelItemId] || 0;
    const inMe = wd.storageInventory[fuelItemId] || 0;
    const available = isCreative ? qty : inBag + inMe;
    const toLoad = Math.min(qty, available);
    if (toLoad <= 0) {
      showToast(`No ${ITEMS[fuelItemId].name} in Backpack or ME Drive.`, 'error');
      return;
    }

    gameAudio.playCoalLoad();
    if (!isCreative) {
      const fromBag = Math.min(toLoad, inBag);
      const fromMe = toLoad - fromBag;
      if (fromBag > 0) {
        mutateCharacter((prev) => {
          const inv = { ...prev.inventory };
          inv[fuelItemId] = Math.max(0, (inv[fuelItemId] || 0) - fromBag);
          if (inv[fuelItemId] === 0) delete inv[fuelItemId];
          return { ...prev, inventory: inv };
        });
      }
      if (fromMe > 0) {
        const nextStorage = { ...wd.storageInventory };
        nextStorage[fuelItemId] = Math.max(0, (nextStorage[fuelItemId] || 0) - fromMe);
        if (nextStorage[fuelItemId] === 0) delete nextStorage[fuelItemId];
        setActiveWorld((prev) => (prev ? { ...prev, storageInventory: nextStorage } : prev));
        worldDirtyRef.current = true;
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
        }
      }
    }

    // Lumberjack Class Special Bonus: +35% longer Firewood burn time
    const firewoodBonus = ch.playerClass === 'lumberjack' ? 1.35 : 1;
    const burnPerUnit =
      fuelItemId === 'blazegold_ingot'
        ? 90
        : fuelItemId === 'firewood_bundle'
          ? Math.round(COAL_BURN_SECONDS_PER_UNIT * firewoodBonus)
          : 25;
    const needsInstantIgnite = m.coalFuelSeconds <= 0;
    const nextMachine: PlacedMachine = {
      ...m,
      coalFuelSeconds: needsInstantIgnite ? burnPerUnit : m.coalFuelSeconds,
      coalBuffer: m.coalBuffer + (needsInstantIgnite ? toLoad - 1 : toLoad),
    };
    handleUpdateMachine(nextMachine);
    const normKind = normalizeMachineKind(m.kind);
    showToast(`Loaded ${toLoad}× ${ITEMS[fuelItemId].name} into ${MACHINE_SPECS[normKind].name}.`, 'info');
  };

  const handleInstallAugment = (machineId: string, augmentId: AugmentId) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const m = wd.machines.find((x) => x.id === machineId);
    if (!m) return;
    if (!canControlMachineInWorld(m, ch, wd, 'toggleMachines')) {
      gameAudio.playClaimLocked();
      showToast(
        `Locked: Only ${m.ownerName || 'the player who placed this machine'} can install augments.`,
        'claim_locked'
      );
      return;
    }
    const currentAugs = m.augments || [];
    if (currentAugs.length >= 3) {
      showToast('All 3 Augment Addon slots are full — eject one first.', 'error');
      return;
    }

    const isCreative = wd.mode === 'peaceful';
    const inBag = ch.inventory[augmentId] || 0;
    const inMe = wd.storageInventory[augmentId] || 0;
    if (!isCreative && inBag + inMe <= 0) {
      showToast(`No ${AUGMENT_SPECS[augmentId].name} in Backpack or ME Storage.`, 'error');
      return;
    }

    if (!isCreative) {
      if (inBag > 0) {
        mutateCharacter((prev) => {
          const inv = { ...prev.inventory };
          inv[augmentId] = Math.max(0, (inv[augmentId] || 1) - 1);
          if (inv[augmentId] === 0) delete inv[augmentId];
          return { ...prev, inventory: inv };
        });
      } else {
        const nextStorage = { ...wd.storageInventory };
        nextStorage[augmentId] = Math.max(0, (nextStorage[augmentId] || 1) - 1);
        if (nextStorage[augmentId] === 0) delete nextStorage[augmentId];
        setActiveWorld((prev) => (prev ? { ...prev, storageInventory: nextStorage } : prev));
        worldDirtyRef.current = true;
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
        }
      }
    }

    const updated: PlacedMachine = {
      ...m,
      augments: [...currentAugs, augmentId],
    };
    handleUpdateMachine(updated);
    gameAudio.playCableConnect();
    showToast(`Installed ${AUGMENT_SPECS[augmentId].name}!`, 'info');
  };

  const handleRemoveAugment = (machineId: string, slotIndex: number) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const m = wd.machines.find((x) => x.id === machineId);
    if (!m || !m.augments || !m.augments[slotIndex]) return;
    if (!canControlMachineInWorld(m, ch, wd, 'toggleMachines')) {
      gameAudio.playClaimLocked();
      showToast(
        `Locked: Only ${m.ownerName || 'the player who placed this machine'} can eject augments.`,
        'claim_locked'
      );
      return;
    }
    const removedAug = m.augments[slotIndex];
    const nextAugs = m.augments.filter((_, idx) => idx !== slotIndex);
    handleUpdateMachine({ ...m, augments: nextAugs });
    addItemToChar(removedAug, 1);
    gameAudio.playBlockPlace();
    showToast(`Ejected ${AUGMENT_SPECS[removedAug].name} to Backpack.`, 'info');
  };

  const handleCollectHopper = (machineId: string) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const m = wd.machines.find((x) => x.id === machineId);
    if (!m) return;
    if (!checkClaimAccess(m.x, m.z, 'collect outputs from this machine', 'openChests')) return;
    if (!canControlMachineInWorld(m, ch, wd, 'openChests')) {
      gameAudio.playClaimLocked();
      showToast(
        `Locked: Only ${m.ownerName || 'the player who placed this machine'} (or a Trusted Friend with Open Chests permission) can collect its hopper.`,
        'claim_locked'
      );
      return;
    }

    const entries = Object.entries(m.outputBuffer || {}).filter(([, q]) => (q || 0) > 0);
    if (entries.length === 0) return;

    mutateCharacter((prev) => {
      const inv = { ...prev.inventory };
      for (const [id, q] of entries) {
        const itemId = id as ResourceItemId;
        inv[itemId] = (inv[itemId] || 0) + (q || 0);
      }
      return { ...prev, inventory: inv };
    });

    handleUpdateMachine({ ...m, outputBuffer: {} });
    gameAudio.playPurchase();
    showToast('Collected machine hopper outputs into backpack.', 'info');
  };

  // --- Remote Placed-Machine Command Drawer Batch & Teleport Handlers (Owner-Only) ---
  const handleTeleportToMachine = useCallback(
    (machine: PlacedMachine) => {
      const wd = worldRef.current;
      if (!wd) return;
      const safeY = Math.max(
        machine.y + 1.2,
        getSurfaceHeight(wd.seed, Math.floor(machine.x), Math.floor(machine.z)) + 1.2
      );
      engineRef.current?.teleportTo(machine.x + 0.5, safeY, machine.z + 1.5);
      gameAudio.playClaimCreated();
      const normKind = normalizeMachineKind(machine.kind);
      showToast(
        `Teleported to ${MACHINE_SPECS[normKind].name} at (${machine.x}, ${machine.y}, ${machine.z}).`,
        'info'
      );
    },
    [showToast]
  );

  const handleBatchFuelMyMachines = useCallback(() => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;

    const myGenerators = wd.machines.filter((m) => {
      const nk = normalizeMachineKind(m.kind);
      return (
        (nk === 'firewood_boiler' || nk === 'coal_generator' || nk === 'powah_reactor') &&
        isMachinePlacedByPlayer(m, ch.uid, wd.ownerId)
      );
    });

    if (myGenerators.length === 0) {
      showToast('You have no placed Firewood Boilers, Dynamos, or Powah Reactors to fuel.', 'error');
      return;
    }

    const isCreative = wd.mode === 'peaceful';
    const nextInv = { ...ch.inventory };
    const nextStorage = { ...wd.storageInventory };
    let storageChanged = false;
    let invChanged = false;
    let fueledMachinesCount = 0;
    let totalFuelLoaded = 0;

    const updatedMachines = wd.machines.map((m) => {
      const nk = normalizeMachineKind(m.kind);
      const isGen = nk === 'firewood_boiler' || nk === 'coal_generator' || nk === 'powah_reactor';
      if (!isGen || !isMachinePlacedByPlayer(m, ch.uid, wd.ownerId)) return m;

      const candidates: ResourceItemId[] =
        nk === 'powah_reactor'
          ? ['blazegold_ingot', 'coal']
          : nk === 'firewood_boiler'
            ? ['firewood_bundle', 'coal']
            : ['coal', 'firewood_bundle'];

      let chosenFuel: ResourceItemId = candidates[0];
      let avail = isCreative ? 4 : 0;

      if (!isCreative) {
        for (const cand of candidates) {
          const count = (nextInv[cand] || 0) + (nextStorage[cand] || 0);
          if (count > 0) {
            chosenFuel = cand;
            avail = count;
            break;
          }
        }
      }

      const toLoad = Math.min(4, avail);
      if (toLoad <= 0) return m;

      if (!isCreative) {
        const fromBag = Math.min(toLoad, nextInv[chosenFuel] || 0);
        const fromMe = toLoad - fromBag;
        if (fromBag > 0) {
          nextInv[chosenFuel] = Math.max(0, (nextInv[chosenFuel] || 0) - fromBag);
          if (nextInv[chosenFuel] === 0) delete nextInv[chosenFuel];
          invChanged = true;
        }
        if (fromMe > 0) {
          nextStorage[chosenFuel] = Math.max(0, (nextStorage[chosenFuel] || 0) - fromMe);
          if (nextStorage[chosenFuel] === 0) delete nextStorage[chosenFuel];
          storageChanged = true;
        }
      }

      const burnPerUnit =
        chosenFuel === 'blazegold_ingot'
          ? 90
          : chosenFuel === 'firewood_bundle'
            ? COAL_BURN_SECONDS_PER_UNIT
            : 25;
      const needsInstantIgnite = m.coalFuelSeconds <= 0;
      const nextM: PlacedMachine = {
        ...m,
        coalFuelSeconds: needsInstantIgnite ? burnPerUnit : m.coalFuelSeconds,
        coalBuffer: m.coalBuffer + (needsInstantIgnite ? toLoad - 1 : toLoad),
      };
      fueledMachinesCount++;
      totalFuelLoaded += toLoad;
      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'machine:update', machine: nextM });
      }
      return nextM;
    });

    if (fueledMachinesCount === 0) {
      showToast('No Firewood Bundles, Coal, or Blazegold available in Backpack or ME Drive.', 'error');
      return;
    }

    if (invChanged) {
      mutateCharacter((prev) => ({ ...prev, inventory: nextInv }));
    }
    setActiveWorld((prev) =>
      prev
        ? {
            ...prev,
            machines: updatedMachines,
            storageInventory: storageChanged ? nextStorage : prev.storageInventory,
          }
        : prev
    );
    worldDirtyRef.current = true;
    if (storageChanged && isMultiplayerRef.current) {
      mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
    }
    gameAudio.playCoalLoad();
    showToast(
      `Loaded ${totalFuelLoaded} fuel units across ${fueledMachinesCount} of your generators!`,
      'info'
    );
  }, [mutateCharacter, showToast]);

  const handleBatchCollectMyHoppers = useCallback(() => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;

    let collectedTotal = 0;
    let machinesCleared = 0;
    const nextInv = { ...ch.inventory };

    const updatedMachines = wd.machines.map((m) => {
      if (!isMachinePlacedByPlayer(m, ch.uid, wd.ownerId)) return m;
      const entries = Object.entries(m.outputBuffer || {}).filter(([, q]) => (q || 0) > 0);
      if (entries.length === 0) return m;
      for (const [id, q] of entries) {
        const itemId = id as ResourceItemId;
        const count = q || 0;
        nextInv[itemId] = (nextInv[itemId] || 0) + count;
        collectedTotal += count;
      }
      machinesCleared++;
      const nextM: PlacedMachine = { ...m, outputBuffer: {} };
      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'machine:update', machine: nextM });
      }
      return nextM;
    });

    if (collectedTotal === 0) {
      showToast('All of your placed machine hoppers are currently empty.', 'info');
      return;
    }

    mutateCharacter((prev) => ({ ...prev, inventory: nextInv }));
    setActiveWorld((prev) => (prev ? { ...prev, machines: updatedMachines } : prev));
    worldDirtyRef.current = true;
    gameAudio.playPurchase();
    showToast(
      `Collected ${collectedTotal} items from ${machinesCleared} of your placed machines!`,
      'info'
    );
  }, [mutateCharacter, showToast]);

  const handleBatchToggleMyMachines = useCallback(
    (enable: boolean) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      if (!wd || !ch) return;

      let toggledCount = 0;
      const updatedMachines = wd.machines.map((m) => {
        if (m.kind === 'claim_beacon') return m;
        if (!isMachinePlacedByPlayer(m, ch.uid, wd.ownerId)) return m;
        if (m.enabled === enable) return m;
        toggledCount++;
        const nextM: PlacedMachine = { ...m, enabled: enable };
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'machine:update', machine: nextM });
        }
        return nextM;
      });

      if (toggledCount === 0) {
        showToast(
          enable
            ? 'All of your placed machines are already running.'
            : 'All of your placed machines are already paused.',
          'info'
        );
        return;
      }

      setActiveWorld((prev) => (prev ? { ...prev, machines: updatedMachines } : prev));
      worldDirtyRef.current = true;
      gameAudio.playMachineOpen();
      showToast(
        `${enable ? 'Started' : 'Paused'} ${toggledCount} of your placed machines.`,
        'info'
      );
    },
    [showToast]
  );

  // --- FTB Quest Book Milestone Claim Handler ---
  const handleClaimQuestReward = useCallback(
    (questId: string) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      if (!wd || !ch) return;

      const quest = FTB_QUESTS.find((q) => q.id === questId);
      if (!quest) return;
      if ((ch.claimedQuestIds || []).includes(questId)) return;
      if (!quest.isCompleted(ch, wd)) {
        showToast(`Complete "${quest.objectiveSummary}" first to claim this FTB Quest reward.`, 'error');
        return;
      }

      gameAudio.playPurchase();
      mutateCharacter((prev) => {
        const nextInv = { ...prev.inventory };
        const nextHotbar = [...prev.hotbar];
        for (const reward of quest.rewardItems) {
          nextInv[reward.itemId] = (nextInv[reward.itemId] || 0) + reward.qty;
          if (!nextHotbar.includes(reward.itemId)) {
            const emptyIdx = nextHotbar.findIndex((s) => s === null);
            if (emptyIdx !== -1) nextHotbar[emptyIdx] = reward.itemId;
          }
        }
        let xp = prev.xp + quest.rewardXp;
        let level = prev.level;
        let maxHealth = prev.maxHealth;
        let health = prev.health;
        while (xp >= level * 180) {
          xp -= level * 180;
          level += 1;
          maxHealth += 5;
          health = Math.min(maxHealth, health + 5);
        }
        return {
          ...prev,
          credits: prev.credits + quest.rewardCredits,
          xp,
          level,
          health,
          maxHealth,
          inventory: nextInv,
          hotbar: nextHotbar,
          claimedQuestIds: [...(prev.claimedQuestIds || []), questId],
        };
      });

      showToast(
        `FTB Quest Completed: "${quest.title}" (+${quest.rewardCredits} Coins, +${quest.rewardXp} XP)!`,
        'info'
      );
    },
    [mutateCharacter, showToast]
  );

  // --- Resource-Crafted Pickaxe Upgrade Handler ---
  const handleCraftPickaxe = useCallback(
    (tier: PickaxeTier) => {
      const meta = PICKAXE_TIERS.find((t) => t.tier === tier);
      const wd = worldRef.current;
      const ch = characterRef.current;
      if (!meta || !ch || !wd) return;
      const inputs = meta.craftInputs || [];
      const isCreative = wd.mode === 'peaceful';

      if (!isCreative && inputs.length > 0) {
        const canAfford = inputs.every(
          (inp) => (ch.inventory[inp.itemId] || 0) + (wd.storageInventory[inp.itemId] || 0) >= inp.qty
        );
        if (!canAfford) {
          showToast(`Missing materials to craft ${meta.name}.`, 'error');
          return;
        }
      }

      const nextStorage = { ...wd.storageInventory };
      let storageChanged = false;
      const bagDeductions: Partial<Record<ResourceItemId, number>> = {};

      if (!isCreative) {
        for (const inp of inputs) {
          let rem = inp.qty;
          const availBag = Math.max(0, (ch.inventory[inp.itemId] || 0) - (bagDeductions[inp.itemId] || 0));
          const fromBag = Math.min(rem, availBag);
          if (fromBag > 0) {
            bagDeductions[inp.itemId] = (bagDeductions[inp.itemId] || 0) + fromBag;
            rem -= fromBag;
          }
          if (rem > 0) {
            nextStorage[inp.itemId] = Math.max(0, (nextStorage[inp.itemId] || 0) - rem);
            if (nextStorage[inp.itemId] === 0) delete nextStorage[inp.itemId];
            storageChanged = true;
          }
        }
      }

      mutateCharacter((prev) => {
        const inv = { ...prev.inventory };
        for (const [itemId, amt] of Object.entries(bagDeductions) as [ResourceItemId, number][]) {
          inv[itemId] = Math.max(0, (inv[itemId] || 0) - amt);
          if (inv[itemId] === 0) delete inv[itemId];
        }
        return {
          ...prev,
          inventory: inv,
          pickaxeTier: tier,
        };
      });

      if (storageChanged) {
        setActiveWorld((prev) => (prev ? { ...prev, storageInventory: nextStorage } : prev));
        worldDirtyRef.current = true;
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
        }
      }
      gameAudio.playPurchase();
      showToast(`Crafted & equipped ${meta.name} (Harvest Power ${meta.harvestPower})!`, 'info');
    },
    [mutateCharacter, showToast]
  );

  // --- Minecraft-Style Survival Food / Saturation / Hunger Handler ---
  const handleEatRation = useCallback(() => {
    const ch = characterRef.current;
    const wd = worldRef.current;
    if (!ch || !wd) return;
    const isCreative = wd.mode === 'peaceful';
    const inBag = ch.inventory.cooked_ration || 0;
    const inStorage = wd.storageInventory.cooked_ration || 0;
    if (!isCreative && inBag + inStorage <= 0) {
      showToast(
        'No Energized Field Rations! Harvest Canopy Leaves + Firewood to cook Rations, or hire a Farm Food worker.',
        'error'
      );
      return;
    }

    const isFarmer = ch.playerClass === 'farmer';
    const hungerGain = isFarmer ? 60 : 40;
    const saturationGain = isFarmer ? 85 : 65;

    gameAudio.playPurchase();
    if (!isCreative && inBag <= 0 && inStorage > 0) {
      const nextStorage = { ...wd.storageInventory };
      nextStorage.cooked_ration = Math.max(0, (nextStorage.cooked_ration || 1) - 1);
      if (nextStorage.cooked_ration === 0) delete nextStorage.cooked_ration;
      setActiveWorld((prev) => (prev ? { ...prev, storageInventory: nextStorage } : prev));
      worldDirtyRef.current = true;
      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
      }
    }

    mutateCharacter((prev) => {
      const inv = { ...prev.inventory };
      if (!isCreative && (inv.cooked_ration || 0) > 0) {
        inv.cooked_ration = Math.max(0, (inv.cooked_ration || 1) - 1);
        if (inv.cooked_ration === 0) delete inv.cooked_ration;
      }
      return {
        ...prev,
        inventory: inv,
        hunger: Math.min(prev.maxHunger ?? 100, Math.round((prev.hunger ?? 100) + hungerGain)),
        saturation: Math.min(100, Math.round((prev.saturation ?? 40) + saturationGain)),
        health: Math.min(prev.maxHealth, prev.health + (isFarmer ? 20 : 12)),
      };
    });
    showToast(
      `Ate Energized Field Ration (+${hungerGain}% Hunger, +${saturationGain}% Saturation — Minecraft Health Regen active!).`,
      'info'
    );
  }, [mutateCharacter, showToast]);

  // --- Active Minecraft Hunger / Saturation / Natural Health Regen & Hired Workers Loop ---
  useEffect(() => {
    if (!activeWorld) return;
    const timer = window.setInterval(() => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      const eng = engineRef.current;
      if (!wd || !ch) return;

      workerTickCounterRef.current += 1;
      const isWorkerCycle = workerTickCounterRef.current % 3 === 0; // Every 6 seconds

      // 1. Minecraft-Authentic Player Hunger, Saturation, Natural Health Regen & Starvation (Survival Mode)
      if (wd.mode === 'survival') {
        const pos = eng?.getPlayerPosition() || { x: 0.5, y: 4, z: 0.5 };
        const movedDist = Math.hypot(
          pos.x - lastHungerPosRef.current.x,
          pos.z - lastHungerPosRef.current.z
        );
        lastHungerPosRef.current = { x: pos.x, z: pos.z };

        const isFarmer = ch.playerClass === 'farmer';
        // Movement + baseline metabolic exhaustion
        const moveExhaustion = movedDist > 0.25 ? (isFarmer ? 0.45 : 0.9) : isFarmer ? 0.15 : 0.3;

        let currHunger = ch.hunger ?? 100;
        let currSat = ch.saturation ?? 60;
        let currHp = ch.health;
        const maxHp = ch.maxHealth;

        // Drain saturation first, then hunger drumsticks
        if (currSat >= moveExhaustion) {
          currSat = Math.max(0, Math.round((currSat - moveExhaustion) * 10) / 10);
        } else {
          const rem = moveExhaustion - currSat;
          currSat = 0;
          currHunger = Math.max(0, Math.round((currHunger - rem) * 10) / 10);
        }

        // Minecraft Natural Health Regeneration: when Hunger >= 85% (≥8.5/10 drumsticks) and hurt, rapidly heal using saturation/hunger!
        if (currHunger >= 85 && currHp < maxHp && currHp > 0) {
          const healAmt = isFarmer ? 5 : 4;
          currHp = Math.min(maxHp, currHp + healAmt);
          if (currSat >= 4) {
            currSat = Math.max(0, currSat - 4);
          } else {
            currHunger = Math.max(0, currHunger - 2);
          }
        }

        // Minecraft Starvation at 0% Hunger (every 6 seconds)
        if (currHunger <= 0 && isWorkerCycle) {
          eng?.triggerHurtCameraShake();
          handlePlayerDamaged(4, 'Starvation — Eat Food (R)!');
        } else if (
          currHunger !== (ch.hunger ?? 100) ||
          currSat !== (ch.saturation ?? 60) ||
          currHp !== ch.health
        ) {
          mutateCharacter((prev) => ({
            ...prev,
            hunger: currHunger,
            saturation: currSat,
            health: currHp,
          }));
        }
      }

      // 2. Hired Workers Autonomous Gathering + Worker Food Upkeep (Every 6 seconds)
      const workers = ch.hiredWorkers || [];
      if (isWorkerCycle && workers.length > 0) {
        const nextStorage = { ...wd.storageInventory };
        const nextInv = { ...ch.inventory };
        let storageChanged = false;
        let invChanged = false;
        let anyWorkerUpdated = false;
        const pClass = ch.playerClass || 'engineer';
        const engBonus = pClass === 'engineer' ? 1 : 0;

        const consumeOneFoodRation = (): boolean => {
          if ((nextStorage.cooked_ration || 0) > 0) {
            nextStorage.cooked_ration = Math.max(0, (nextStorage.cooked_ration || 1) - 1);
            if (nextStorage.cooked_ration === 0) delete nextStorage.cooked_ration;
            storageChanged = true;
            return true;
          }
          if ((nextInv.cooked_ration || 0) > 0) {
            nextInv.cooked_ration = Math.max(0, (nextInv.cooked_ration || 1) - 1);
            if (nextInv.cooked_ration === 0) delete nextInv.cooked_ration;
            invChanged = true;
            return true;
          }
          return false;
        };

        // First process Farm Food workers so they deposit rations that other workers can eat immediately!
        const updatedWorkers: HiredWorker[] = workers.map((w) => {
          if (!w.active) return w;
          if (w.task === 'food') {
            const foodProduced = 2 + (pClass === 'farmer' ? 1 : 0) + engBonus;
            nextStorage.cooked_ration = (nextStorage.cooked_ration || 0) + foodProduced;
            storageChanged = true;
            anyWorkerUpdated = true;
            return {
              ...w,
              hunger: 100,
              starving: false,
              totalGathered: w.totalGathered + foodProduced,
            };
          }
          return w;
        });

        // Next process Wood, Iron, and Stone workers (which require food stamina to work!)
        for (let i = 0; i < updatedWorkers.length; i++) {
          const w = updatedWorkers[i];
          if (!w.active || w.task === 'food') continue;

          let wHunger = (w.hunger ?? 100) - 20;
          let isStarving = false;

          if (wHunger <= 0) {
            if (consumeOneFoodRation()) {
              wHunger = 100;
              isStarving = false;
            } else {
              wHunger = 0;
              isStarving = true;
            }
          }

          if (isStarving) {
            anyWorkerUpdated = true;
            updatedWorkers[i] = { ...w, hunger: 0, starving: true };
            continue;
          }

          let gatheredThisCycle = 0;
          if (w.task === 'wood') {
            const logQty = 2 + (pClass === 'lumberjack' ? 1 : 0) + engBonus;
            const fwQty = 2 + engBonus;
            nextStorage.wood_log = (nextStorage.wood_log || 0) + logQty;
            nextStorage.firewood_bundle = (nextStorage.firewood_bundle || 0) + fwQty;
            gatheredThisCycle = logQty + fwQty;
          } else if (w.task === 'iron') {
            const ironQty = 2 + (pClass === 'miner' ? 1 : 0) + engBonus;
            const coalQty = 1 + engBonus;
            nextStorage.iron_ore = (nextStorage.iron_ore || 0) + ironQty;
            nextStorage.coal = (nextStorage.coal || 0) + coalQty;
            gatheredThisCycle = ironQty + coalQty;
          } else if (w.task === 'stone') {
            const cobbleQty = 3 + (pClass === 'miner' ? 1 : 0) + engBonus;
            const stoneQty = 1 + engBonus;
            nextStorage.cobblestone = (nextStorage.cobblestone || 0) + cobbleQty;
            nextStorage.stone = (nextStorage.stone || 0) + stoneQty;
            gatheredThisCycle = cobbleQty + stoneQty;
          }

          storageChanged = true;
          anyWorkerUpdated = true;
          updatedWorkers[i] = {
            ...w,
            hunger: wHunger,
            starving: false,
            totalGathered: w.totalGathered + gatheredThisCycle,
          };
        }

        if (anyWorkerUpdated || invChanged) {
          mutateCharacter((prev) => ({
            ...prev,
            inventory: invChanged ? nextInv : prev.inventory,
            hiredWorkers: updatedWorkers,
          }));
        }
        if (storageChanged) {
          setActiveWorld((prev) => (prev ? { ...prev, storageInventory: nextStorage } : prev));
          worldDirtyRef.current = true;
          if (isMultiplayerRef.current) {
            mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
          }
        }
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [activeWorld?.id, handlePlayerDamaged, mutateCharacter]);

  const handleWirelessMeTransfer = useCallback(
    (itemId: ResourceItemId, deltaToStorage: number) => {
      const wd = worldRef.current;
      const ch = characterRef.current;
      if (!wd || !ch || deltaToStorage === 0) return;

      if (deltaToStorage > 0) {
        const avail = ch.inventory[itemId] || 0;
        const amt = Math.min(avail, deltaToStorage);
        if (amt <= 0) return;
        mutateCharacter((prev) => {
          const inv = { ...prev.inventory };
          inv[itemId] = Math.max(0, (inv[itemId] || 0) - amt);
          if (inv[itemId] === 0) delete inv[itemId];
          return { ...prev, inventory: inv };
        });
        setActiveWorld((prev) =>
          prev
            ? {
                ...prev,
                storageInventory: {
                  ...prev.storageInventory,
                  [itemId]: (prev.storageInventory[itemId] || 0) + amt,
                },
              }
            : prev
        );
        worldDirtyRef.current = true;
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'storage:update', itemId, delta: amt });
        }
      } else {
        const avail = wd.storageInventory[itemId] || 0;
        const amt = Math.min(avail, Math.abs(deltaToStorage));
        if (amt <= 0) return;
        setActiveWorld((prev) => {
          if (!prev) return prev;
          const nextStorage = { ...prev.storageInventory };
          nextStorage[itemId] = Math.max(0, (nextStorage[itemId] || 0) - amt);
          if (nextStorage[itemId] === 0) delete nextStorage[itemId];
          return { ...prev, storageInventory: nextStorage };
        });
        worldDirtyRef.current = true;
        addItemToChar(itemId, amt);
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'storage:update', itemId, delta: -amt });
        }
      }
    },
    [addItemToChar, mutateCharacter]
  );

  const handleStorageTransfer = (
    _machineId: string,
    itemId: ResourceItemId,
    deltaToStorage: number
  ) => {
    handleWirelessMeTransfer(itemId, deltaToStorage);
  };

  const handleDepositAllToMe = useCallback(() => {
    const ch = characterRef.current;
    const wd = worldRef.current;
    if (!ch || !wd) return;
    let movedCount = 0;
    const toDeposit: [ResourceItemId, number][] = [];
    for (const [id, qty] of Object.entries(ch.inventory)) {
      const meta = ITEMS[id as ResourceItemId];
      if (
        qty &&
        qty > 0 &&
        meta &&
        (meta.category === 'ore' ||
          meta.category === 'clump' ||
          meta.category === 'ingot' ||
          meta.category === 'fuel')
      ) {
        toDeposit.push([id as ResourceItemId, qty]);
        movedCount += qty;
      }
    }
    if (movedCount > 0) {
      const nextStorage = { ...wd.storageInventory };
      for (const [itemId, qty] of toDeposit) {
        nextStorage[itemId] = (nextStorage[itemId] || 0) + qty;
      }
      mutateCharacter((prev) => {
        const inv = { ...prev.inventory };
        for (const [itemId, qty] of toDeposit) {
          inv[itemId] = Math.max(0, (inv[itemId] || 0) - qty);
          if (inv[itemId] === 0) delete inv[itemId];
        }
        return { ...prev, inventory: inv };
      });
      setActiveWorld((prev) => (prev ? { ...prev, storageInventory: nextStorage } : prev));
      worldDirtyRef.current = true;
      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
      }
      gameAudio.playPurchase();
      showToast(`Deposited ${movedCount} ores, clumps, ingots & firewood into AE2 ME Drive.`, 'info');
    } else {
      showToast('No raw ores, clumps, ingots, or firewood in backpack to deposit.', 'info');
    }
  }, [mutateCharacter, showToast]);

  const handleDepositAllOres = (_machineId: string) => {
    handleDepositAllToMe();
  };

  // --- Claim Manager Handlers (with Multiplayer Sync & Granular Trusted Permissions) ---
  const handleAddTrustedFriend = (claimId: string, friend: TrustedFriend) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const claim = wd.claims.find((c) => c.id === claimId);
    if (!claim || !isClaimOwner(claim, { uid: ch.uid, displayName: ch.characterName })) return;
    setActiveWorld((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        claims: prev.claims.map((c) => {
          if (c.id !== claimId) return c;
          return { ...c, trustedFriends: [...c.trustedFriends, friend] };
        }),
      };
    });
    worldDirtyRef.current = true;
    if (isMultiplayerRef.current) {
      mpClientRef.current?.send({ type: 'claim:add_trusted', claimId, friend });
    }
    showToast(`Added ${friend.displayName} to Trusted Friends on "${claim.label}".`, 'info');
  };

  const handleUpdateTrustedFriendPermissions = (
    claimId: string,
    friendUidOrName: string,
    permissions: TrustedFriendPermissions
  ) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const claim = wd.claims.find((c) => c.id === claimId);
    if (!claim || !isClaimOwner(claim, { uid: ch.uid, displayName: ch.characterName })) return;
    const keyLower = friendUidOrName.toLowerCase();
    setActiveWorld((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        claims: prev.claims.map((c) => {
          if (c.id !== claimId) return c;
          return {
            ...c,
            trustedFriends: c.trustedFriends.map((f) =>
              f.uid === friendUidOrName || f.displayName.toLowerCase() === keyLower
                ? { ...f, permissions }
                : f
            ),
          };
        }),
      };
    });
    worldDirtyRef.current = true;
    if (isMultiplayerRef.current) {
      mpClientRef.current?.send({
        type: 'claim:update_trusted_perms',
        claimId,
        friendUid: friendUidOrName,
        permissions,
      });
    }
  };

  const handleRemoveTrustedFriend = (claimId: string, friendUidOrName: string) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const claim = wd.claims.find((c) => c.id === claimId);
    if (!claim || !isClaimOwner(claim, { uid: ch.uid, displayName: ch.characterName })) return;
    setActiveWorld((prev) =>
      prev
        ? {
            ...prev,
            claims: prev.claims.map((c) =>
              c.id === claimId
                ? {
                    ...c,
                    trustedFriends: c.trustedFriends.filter(
                      (f) =>
                        f.uid !== friendUidOrName &&
                        f.displayName.toLowerCase() !== friendUidOrName.toLowerCase()
                    ),
                  }
                : c
            ),
          }
        : prev
    );
    worldDirtyRef.current = true;
    if (isMultiplayerRef.current) {
      mpClientRef.current?.send({ type: 'claim:remove_trusted', claimId, friendUid: friendUidOrName });
    }
  };

  const handleRenameClaim = (claimId: string, label: string) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const claim = wd.claims.find((c) => c.id === claimId);
    if (!claim || !isClaimOwner(claim, { uid: ch.uid, displayName: ch.characterName })) return;
    setActiveWorld((prev) =>
      prev
        ? { ...prev, claims: prev.claims.map((c) => (c.id === claimId ? { ...c, label } : c)) }
        : prev
    );
    worldDirtyRef.current = true;
    if (isMultiplayerRef.current) {
      mpClientRef.current?.send({ type: 'claim:rename', claimId, label });
    }
  };

  const handleDeleteClaim = (claimId: string) => {
    const wd = worldRef.current;
    const ch = characterRef.current;
    if (!wd || !ch) return;
    const claim = wd.claims.find((c) => c.id === claimId);
    if (!claim || !isClaimOwner(claim, { uid: ch.uid, displayName: ch.characterName })) return;
    setActiveWorld((prev) =>
      prev
        ? {
            ...prev,
            claims: prev.claims.filter((c) => c.id !== claimId),
            machines: prev.machines.filter(
              (m) => !(m.kind === 'claim_beacon' && m.x === claim.beaconX && m.z === claim.beaconZ)
            ),
          }
        : prev
    );
    worldDirtyRef.current = true;
    if (isMultiplayerRef.current) {
      mpClientRef.current?.send({ type: 'claim:delete', claimId });
    }
  };

  // --- Player Character Customizer, Class, Hired Workers (1,000 Coins) & Trade Exchange Handlers ---
  const handleUpdateCharacterCustomization = useCallback(
    (name: string, appearance: CharacterProfile['appearance']) => {
      const cleanedName = name.trim().slice(0, 28) || 'Builder';
      gameAudio.playClaimCreated();
      mutateCharacter((prev) => ({
        ...prev,
        characterName: cleanedName,
        appearance,
      }));
      engineRef.current?.updateAppearance(appearance);
      engineRef.current?.setLocalIdentity(characterRef.current?.uid || '', cleanedName);
      showToast(`Saved 3D character appearance & display name (${cleanedName})!`, 'info');
    },
    [mutateCharacter, showToast]
  );

  const handleSelectClass = useCallback(
    (classId: PlayerClassId) => {
      const spec = PLAYER_CLASSES.find((c) => c.id === classId);
      if (!spec) return;
      gameAudio.playClaimCreated();
      mutateCharacter((prev) => ({
        ...prev,
        playerClass: classId,
      }));
      showToast(`Selected ${spec.name} Class — ${spec.tagline}!`, 'info');
    },
    [mutateCharacter, showToast]
  );

  const handleHireWorker = useCallback(
    (task: WorkerTask) => {
      const ch = characterRef.current;
      const wd = worldRef.current;
      if (!ch || !wd) return;
      const isCreative = wd.mode === 'peaceful';
      if (!isCreative && ch.credits < WORKER_HIRE_COST) {
        showToast(
          `Need ${WORKER_HIRE_COST.toLocaleString()} Dire Coins to hire a worker (you have ${ch.credits.toLocaleString()}).`,
          'error'
        );
        return;
      }
      const taskSpec = WORKER_TASK_SPECS.find((s) => s.task === task) || WORKER_TASK_SPECS[0];
      const workerNum = (ch.hiredWorkers?.length || 0) + 1;
      const newWorker: HiredWorker = {
        id: `worker_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: `Dire Worker #${workerNum}`,
        task,
        ownerId: ch.uid,
        ownerName: ch.characterName,
        active: true,
        totalGathered: 0,
        hiredAtMs: Date.now(),
        hunger: 100,
        starving: false,
      };
      gameAudio.playPurchase();
      mutateCharacter((prev) => ({
        ...prev,
        credits: isCreative ? prev.credits : prev.credits - WORKER_HIRE_COST,
        hiredWorkers: [...(prev.hiredWorkers || []), newWorker],
      }));
      showToast(
        `Hired ${newWorker.name} (${taskSpec.label}) for ${WORKER_HIRE_COST.toLocaleString()} Dire Coins!`,
        'info'
      );
    },
    [mutateCharacter, showToast]
  );

  const handleChangeWorkerTask = useCallback(
    (workerId: string, task: WorkerTask) => {
      mutateCharacter((prev) => ({
        ...prev,
        hiredWorkers: (prev.hiredWorkers || []).map((w) =>
          w.id === workerId
            ? {
                ...w,
                task,
                starving: task === 'food' ? false : w.starving,
                hunger: task === 'food' ? 100 : w.hunger,
              }
            : w
        ),
      }));
    },
    [mutateCharacter]
  );

  const handleToggleWorkerActive = useCallback(
    (workerId: string) => {
      mutateCharacter((prev) => ({
        ...prev,
        hiredWorkers: (prev.hiredWorkers || []).map((w) =>
          w.id === workerId ? { ...w, active: !w.active } : w
        ),
      }));
    },
    [mutateCharacter]
  );

  const handleFeedWorker = useCallback(
    (workerId: string) => {
      const ch = characterRef.current;
      const wd = worldRef.current;
      if (!ch || !wd) return;
      const inBag = ch.inventory.cooked_ration || 0;
      const inStorage = wd.storageInventory.cooked_ration || 0;
      if (inBag + inStorage <= 0) {
        showToast('No Field Rations available to feed worker! Cook or farm more food first.', 'error');
        return;
      }
      if (inStorage > 0) {
        const nextStorage = { ...wd.storageInventory };
        nextStorage.cooked_ration = Math.max(0, (nextStorage.cooked_ration || 1) - 1);
        if (nextStorage.cooked_ration === 0) delete nextStorage.cooked_ration;
        setActiveWorld((prev) => (prev ? { ...prev, storageInventory: nextStorage } : prev));
        worldDirtyRef.current = true;
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
        }
      }
      mutateCharacter((prev) => {
        const inv = { ...prev.inventory };
        if (inStorage <= 0 && (inv.cooked_ration || 0) > 0) {
          inv.cooked_ration = Math.max(0, (inv.cooked_ration || 1) - 1);
          if (inv.cooked_ration === 0) delete inv.cooked_ration;
        }
        return {
          ...prev,
          inventory: inv,
          hiredWorkers: (prev.hiredWorkers || []).map((w) =>
            w.id === workerId ? { ...w, hunger: 100, starving: false, active: true } : w
          ),
        };
      });
      gameAudio.playPurchase();
      showToast('Fed worker 1× Energized Field Ration (100% Food Stamina restored)!', 'info');
    },
    [mutateCharacter, showToast]
  );

  const handleDismissWorker = useCallback(
    (workerId: string) => {
      mutateCharacter((prev) => ({
        ...prev,
        hiredWorkers: (prev.hiredWorkers || []).filter((w) => w.id !== workerId),
      }));
      showToast('Dismissed worker.', 'info');
    },
    [mutateCharacter, showToast]
  );

  const handleExecuteTraderDeal = useCallback(
    (dealId: string) => {
      const deal = DIRE_TRADER_DEALS.find((d) => d.id === dealId);
      const ch = characterRef.current;
      const wd = worldRef.current;
      if (!deal || !ch || !wd) return;

      const haveCost =
        deal.costItemId === 'credits'
          ? ch.credits
          : (ch.inventory[deal.costItemId] || 0) + (wd.storageInventory[deal.costItemId] || 0);
      if (haveCost < deal.costQty) {
        showToast('Insufficient items or Dire Coins for this trade contract.', 'error');
        return;
      }

      const nextStorage = { ...wd.storageInventory };
      let storageChanged = false;
      let bagDeduct = 0;

      if (deal.costItemId !== 'credits') {
        const fromBag = Math.min(deal.costQty, ch.inventory[deal.costItemId] || 0);
        bagDeduct = fromBag;
        const fromStorage = deal.costQty - fromBag;
        if (fromStorage > 0) {
          nextStorage[deal.costItemId] = Math.max(0, (nextStorage[deal.costItemId] || 0) - fromStorage);
          if (nextStorage[deal.costItemId] === 0) delete nextStorage[deal.costItemId];
          storageChanged = true;
        }
      }

      mutateCharacter((prev) => {
        const inv = { ...prev.inventory };
        let nextCredits = prev.credits;

        if (deal.costItemId === 'credits') {
          nextCredits = Math.max(0, nextCredits - deal.costQty);
        } else if (bagDeduct > 0) {
          inv[deal.costItemId] = Math.max(0, (inv[deal.costItemId] || 0) - bagDeduct);
          if (inv[deal.costItemId] === 0) delete inv[deal.costItemId];
        }

        if (deal.rewardItemId === 'credits') {
          nextCredits += deal.rewardQty;
        } else {
          inv[deal.rewardItemId] = (inv[deal.rewardItemId] || 0) + deal.rewardQty;
        }

        return {
          ...prev,
          credits: nextCredits,
          inventory: inv,
        };
      });

      if (storageChanged) {
        setActiveWorld((prev) => (prev ? { ...prev, storageInventory: nextStorage } : prev));
        worldDirtyRef.current = true;
        if (isMultiplayerRef.current) {
          mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
        }
      }

      gameAudio.playPurchase();
      showToast(`Completed Trade: ${deal.title}!`, 'info');
    },
    [mutateCharacter, showToast]
  );

  const handleCreateTradeOffer = useCallback(
    (
      offerItemId: ResourceItemId | 'credits',
      offerQty: number,
      requestItemId: ResourceItemId | 'credits',
      requestQty: number
    ) => {
      const ch = characterRef.current;
      const wd = worldRef.current;
      if (!ch || !wd || offerQty <= 0 || requestQty <= 0) return;

      const have =
        offerItemId === 'credits'
          ? ch.credits
          : (ch.inventory[offerItemId] || 0) + (wd.storageInventory[offerItemId] || 0);
      if (have < offerQty) {
        showToast('You do not have enough of the offered item/coins to post this trade.', 'error');
        return;
      }

      const nextStorage = { ...wd.storageInventory };
      let storageChanged = false;
      let bagDeduct = 0;

      if (offerItemId !== 'credits') {
        const fromBag = Math.min(offerQty, ch.inventory[offerItemId] || 0);
        bagDeduct = fromBag;
        const fromStorage = offerQty - fromBag;
        if (fromStorage > 0) {
          nextStorage[offerItemId] = Math.max(0, (nextStorage[offerItemId] || 0) - fromStorage);
          if (nextStorage[offerItemId] === 0) delete nextStorage[offerItemId];
          storageChanged = true;
        }
      }

      mutateCharacter((prev) => {
        const inv = { ...prev.inventory };
        let nextCredits = prev.credits;
        if (offerItemId === 'credits') {
          nextCredits = Math.max(0, nextCredits - offerQty);
        } else if (bagDeduct > 0) {
          inv[offerItemId] = Math.max(0, (inv[offerItemId] || 0) - bagDeduct);
          if (inv[offerItemId] === 0) delete inv[offerItemId];
        }
        return { ...prev, credits: nextCredits, inventory: inv };
      });

      const newOffer: TradeOffer = {
        id: `trade_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        senderUid: ch.uid,
        senderName: ch.characterName,
        offerItemId,
        offerQty,
        requestItemId,
        requestQty,
        createdAtMs: Date.now(),
      };

      setActiveWorld((prev) =>
        prev
          ? {
              ...prev,
              storageInventory: storageChanged ? nextStorage : prev.storageInventory,
              tradeOffers: [...(prev.tradeOffers || []), newOffer],
            }
          : prev
      );
      worldDirtyRef.current = true;
      if (storageChanged && isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
      }
      gameAudio.playPurchase();
      showToast('Posted trade offer to world trade board!', 'info');
    },
    [mutateCharacter, showToast]
  );

  const handleAcceptTradeOffer = useCallback(
    (offerId: string) => {
      const ch = characterRef.current;
      const wd = worldRef.current;
      if (!ch || !wd) return;
      const offer = (wd.tradeOffers || []).find((o) => o.id === offerId);
      if (!offer || offer.senderUid === ch.uid) return;

      const have =
        offer.requestItemId === 'credits'
          ? ch.credits
          : (ch.inventory[offer.requestItemId] || 0) +
            (wd.storageInventory[offer.requestItemId] || 0);
      if (have < offer.requestQty) {
        showToast('Insufficient items or Dire Coins to accept this trade.', 'error');
        return;
      }

      const nextStorage = { ...wd.storageInventory };
      let storageChanged = false;
      let bagDeduct = 0;

      if (offer.requestItemId !== 'credits') {
        const fromBag = Math.min(offer.requestQty, ch.inventory[offer.requestItemId] || 0);
        bagDeduct = fromBag;
        const fromStorage = offer.requestQty - fromBag;
        if (fromStorage > 0) {
          nextStorage[offer.requestItemId] = Math.max(
            0,
            (nextStorage[offer.requestItemId] || 0) - fromStorage
          );
          if (nextStorage[offer.requestItemId] === 0) delete nextStorage[offer.requestItemId];
          storageChanged = true;
        }
        // Deposit the requested payment into shared storage so the sender receives it
        nextStorage[offer.requestItemId] =
          (nextStorage[offer.requestItemId] || 0) + offer.requestQty;
        storageChanged = true;
      }

      mutateCharacter((prev) => {
        const inv = { ...prev.inventory };
        let nextCredits = prev.credits;
        if (offer.requestItemId === 'credits') {
          nextCredits = Math.max(0, nextCredits - offer.requestQty);
        } else if (bagDeduct > 0) {
          inv[offer.requestItemId] = Math.max(0, (inv[offer.requestItemId] || 0) - bagDeduct);
          if (inv[offer.requestItemId] === 0) delete inv[offer.requestItemId];
        }

        if (offer.offerItemId === 'credits') {
          nextCredits += offer.offerQty;
        } else {
          inv[offer.offerItemId] = (inv[offer.offerItemId] || 0) + offer.offerQty;
        }

        return { ...prev, credits: nextCredits, inventory: inv };
      });

      setActiveWorld((prev) =>
        prev
          ? {
              ...prev,
              storageInventory: storageChanged ? nextStorage : prev.storageInventory,
              tradeOffers: (prev.tradeOffers || []).filter((o) => o.id !== offerId),
            }
          : prev
      );
      worldDirtyRef.current = true;
      if (storageChanged && isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
      }
      gameAudio.playPurchase();
      showToast(`Accepted trade offer from ${offer.senderName}!`, 'info');
    },
    [mutateCharacter, showToast]
  );

  const handleCancelTradeOffer = useCallback(
    (offerId: string) => {
      const ch = characterRef.current;
      const wd = worldRef.current;
      if (!ch || !wd) return;
      const offer = (wd.tradeOffers || []).find((o) => o.id === offerId);
      if (!offer || offer.senderUid !== ch.uid) return;

      mutateCharacter((prev) => {
        const inv = { ...prev.inventory };
        let nextCredits = prev.credits;
        if (offer.offerItemId === 'credits') {
          nextCredits += offer.offerQty;
        } else {
          inv[offer.offerItemId] = (inv[offer.offerItemId] || 0) + offer.offerQty;
        }
        return { ...prev, credits: nextCredits, inventory: inv };
      });

      setActiveWorld((prev) =>
        prev
          ? {
              ...prev,
              tradeOffers: (prev.tradeOffers || []).filter((o) => o.id !== offerId),
            }
          : prev
      );
      worldDirtyRef.current = true;
      showToast('Cancelled trade offer and refunded items.', 'info');
    },
    [mutateCharacter, showToast]
  );

  // --- Wireless ME Terminal, JEI & Crafting Handlers ---
  const handleSellItem = (itemId: ResourceItemId, qty: number) => {
    const ch = characterRef.current;
    const meta = ITEMS[itemId];
    if (!ch || !meta) return;
    const sellQty = Math.min(qty, ch.inventory[itemId] || 0);
    if (sellQty <= 0) return;
    // Engineer Class Special Bonus: +25% Dire Coin sell value
    const unitPrice =
      ch.playerClass === 'engineer' ? Math.round(meta.sellPrice * 1.25) : meta.sellPrice;
    const earned = sellQty * unitPrice;
    gameAudio.playPurchase();
    mutateCharacter((prev) => {
      const inv = { ...prev.inventory };
      inv[itemId] = Math.max(0, (inv[itemId] || 0) - sellQty);
      if (inv[itemId] === 0) delete inv[itemId];
      return { ...prev, credits: prev.credits + earned, inventory: inv };
    });
  };

  const handleBuyItem = (itemId: ResourceItemId, qty: number) => {
    const ch = characterRef.current;
    const wd = worldRef.current;
    const meta = ITEMS[itemId];
    if (!ch || !wd || !meta) return;
    const isCreative = wd.mode === 'peaceful';
    const unitPrice = meta.buyPrice ?? 25;
    const totalCost = isCreative ? 0 : unitPrice * qty;
    if (!isCreative && ch.credits < totalCost) return;
    gameAudio.playPurchase();
    mutateCharacter((prev) => {
      const inv = { ...prev.inventory, [itemId]: (prev.inventory[itemId] || 0) + qty };
      const hotbar = [...prev.hotbar];
      if (!hotbar.includes(itemId)) {
        const empty = hotbar.findIndex((s) => s === null);
        if (empty !== -1) hotbar[empty] = itemId;
      }
      return { ...prev, credits: prev.credits - totalCost, inventory: inv, hotbar };
    });
    showToast(`Added ${qty}× ${meta.name} to Backpack.`, 'info');
  };

  const handleBuyPickaxe = (tier: PickaxeTier) => {
    const meta = PICKAXE_TIERS.find((t) => t.tier === tier);
    const ch = characterRef.current;
    const wd = worldRef.current;
    if (!meta || !ch || !wd) return;
    const isCreative = wd.mode === 'peaceful';
    const cost = isCreative ? 0 : meta.buyPrice;
    if (!isCreative && ch.credits < cost) return;
    gameAudio.playPurchase();
    mutateCharacter((prev) => ({
      ...prev,
      credits: prev.credits - cost,
      pickaxeTier: tier,
    }));
    showToast(`Equipped ${meta.name}!`, 'info');
  };

  // 1-Click ME Auto-Crafting: pulls ingredients seamlessly from Backpack + AE2 ME Storage!
  const handleCraftRecipe = (recipeId: string) => {
    const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId);
    const ch = characterRef.current;
    const wd = worldRef.current;
    if (!recipe || !ch || !wd) return;

    const isCreative = wd.mode === 'peaceful';
    if (!isCreative) {
      const canAfford = recipe.inputs.every(
        (i) => (ch.inventory[i.itemId] || 0) + (wd.storageInventory[i.itemId] || 0) >= i.qty
      );
      if (!canAfford) return;
    }

    // Class Special Crafting Bonuses:
    // - Engineer gets +2 bonus Universal Conduits when crafting power_cable
    // - Lumberjack gets +2 bonus Split Firewood Bundles when splitting logs
    // - Farmer gets +1 bonus Energized Field Ration when cooking food
    let bonusQty = 0;
    if (ch.playerClass === 'engineer' && recipe.outputId === 'power_cable') bonusQty = 2;
    else if (ch.playerClass === 'lumberjack' && recipe.outputId === 'firewood_bundle') bonusQty = 2;
    else if (ch.playerClass === 'farmer' && recipe.outputId === 'cooked_ration') bonusQty = 1;
    const totalOutQty = recipe.outputQty + bonusQty;

    gameAudio.playBlockPlace();
    const nextStorage = { ...wd.storageInventory };
    let storageChanged = false;
    const bagDeductions: Partial<Record<ResourceItemId, number>> = {};

    if (!isCreative) {
      for (const inp of recipe.inputs) {
        let rem = inp.qty;
        const availBag = Math.max(0, (ch.inventory[inp.itemId] || 0) - (bagDeductions[inp.itemId] || 0));
        const fromBag = Math.min(rem, availBag);
        if (fromBag > 0) {
          bagDeductions[inp.itemId] = (bagDeductions[inp.itemId] || 0) + fromBag;
          rem -= fromBag;
        }
        if (rem > 0) {
          nextStorage[inp.itemId] = Math.max(0, (nextStorage[inp.itemId] || 0) - rem);
          if ((nextStorage[inp.itemId] || 0) <= 0) delete nextStorage[inp.itemId];
          storageChanged = true;
        }
      }
    }

    mutateCharacter((prev) => {
      const inv = { ...prev.inventory };
      for (const [itemId, amt] of Object.entries(bagDeductions) as [ResourceItemId, number][]) {
        inv[itemId] = Math.max(0, (inv[itemId] || 0) - amt);
        if ((inv[itemId] || 0) <= 0) delete inv[itemId];
      }
      inv[recipe.outputId] = (inv[recipe.outputId] || 0) + totalOutQty;
      const hotbar = [...prev.hotbar];
      if (!hotbar.includes(recipe.outputId)) {
        const empty = hotbar.findIndex((s) => s === null);
        if (empty !== -1) hotbar[empty] = recipe.outputId;
      }
      return { ...prev, inventory: inv, hotbar };
    });

    if (storageChanged) {
      setActiveWorld((prev) => (prev ? { ...prev, storageInventory: nextStorage } : prev));
      worldDirtyRef.current = true;
      if (isMultiplayerRef.current) {
        mpClientRef.current?.send({ type: 'storage:sync', storageInventory: nextStorage });
      }
    }
    showToast(
      `Crafted ${totalOutQty}× ${ITEMS[recipe.outputId].name}${bonusQty > 0 ? ` (+${bonusQty} Class Bonus)` : ''}!`,
      'info'
    );
  };

  // --- World Hub CRUD ---
  const handleCreateWorld = async (params: {
    name: string;
    seed: number;
    mode: WorldMode;
    accessMode: WorldAccessMode;
  }): Promise<WorldData | null> => {
    if (!firebaseUser || !character) return null;
    try {
      const created = await createNewWorldInCloud({
        ownerId: firebaseUser.uid,
        ownerName: character.characterName,
        ...params,
      });
      setMyWorlds((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create world.', 'error');
      return null;
    }
  };

  const handleDeleteWorld = async (worldId: string) => {
    try {
      await deleteWorldFromCloud(worldId);
      setMyWorlds((prev) => prev.filter((w) => w.id !== worldId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete world.', 'error');
    }
  };

  const handleUpdateWorldAccess = async (
    world: WorldData,
    mode: WorldMode,
    accessMode: WorldAccessMode
  ) => {
    const updated = { ...world, mode, accessMode };
    setMyWorlds((prev) => prev.map((w) => (w.id === world.id ? updated : w)));
    try {
      await saveWorldToCloud(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update world settings.', 'error');
    }
  };

  const handleSaveCharacterFromHub = async (updated: CharacterProfile) => {
    setCharacter(updated);
    await saveCharacterToCloud(updated, true);
  };

  if (!firebaseUser || !character || !activeWorld) {
    return (
      <AuthHub
        authLoading={authLoading}
        isSignedIn={Boolean(firebaseUser && character)}
        userEmail={firebaseUser?.email || null}
        authError={authError}
        character={character}
        myWorlds={myWorlds}
        worldsLoading={worldsLoading}
        initialInviteCode={initialInviteCode}
        onSignInGoogle={handleSignInGoogle}
        onSignOut={handleSignOut}
        onSaveCharacter={handleSaveCharacterFromHub}
        onCreateWorld={handleCreateWorld}
        onDeleteWorld={handleDeleteWorld}
        onUpdateWorldAccess={handleUpdateWorldAccess}
        onLaunchWorld={handleLaunchWorld}
        onJoinByCode={handleJoinByCode}
      />
    );
  }

  const openMachine = openMachineId
    ? activeWorld.machines.find((m) => m.id === openMachineId) || null
    : null;

  return (
    <div className="fixed inset-0 bg-[#10141b] overflow-hidden">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div ref={canvasHostRef} className="w-full h-full" />

      {webglLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10141b]/95 p-6">
          <div className="mc-panel p-6 max-w-md text-center space-y-3">
            <h2 className="font-display text-lg font-bold text-[#f59e0b]">
              3D Graphics Context Interrupted
            </h2>
            <p className="text-xs text-[#a3b0c2]">
              Your FTB factory world and AE2 ME network remain safely auto-saved. Return to the World Hub to reload the renderer.
            </p>
            <button
              type="button"
              onClick={() => void handleSaveAndExit()}
              className="bg-[#f59e0b] px-4 py-2 text-xs font-semibold text-[#10141b] cursor-pointer"
            >
              Return to World Hub
            </button>
          </div>
        </div>
      )}

      {/* DireCraft FTB Direwolf20 HUD + Always-On Placed-Machine Command Drawer */}
      <MinecraftHud
        character={character}
        world={activeWorld}
        grid={grid}
        dayNight={dayNight}
        playerPos={playerPos}
        hoverTarget={hoverTarget}
        remotePlayers={remotePlayers}
        isMultiplayer={isMultiplayerSession}
        mpStatus={mpStatus}
        chatMessages={chatMessages}
        cameraMode={character.cameraMode}
        muted={muted}
        showClaimBorders={showClaimBorders}
        lowLagMode={lowLagMode}
        activeChunkKeys={activeChunkKeys}
        exploredChunks={activeWorld.exploredChunks || activeChunkKeys}
        personalSpawn={personalSpawn}
        autoSaveLabel={autoSaveLabel}
        toast={toast}
        onSelectSlot={(idx) => mutateCharacter((prev) => ({ ...prev, selectedSlot: idx }))}
        onOpenInventory={() => setShowInventoryModal(true)}
        onOpenShop={(tab = 'me_terminal') => {
          setShopInitialTab(tab);
          setShowShopModal(true);
        }}
        onOpenMultiplayer={() => setShowMultiplayerModal(true)}
        onOpenClaims={() => {
          const standing = findClaimAt(activeWorld.claims, playerPos.x, playerPos.z);
          setFocusedClaimId(standing?.id || null);
          setShowClaimModal(true);
        }}
        onOpenClassWorkersTrade={(tab = 'class') => {
          setClassWorkersTab(tab);
          setShowClassWorkersModal(true);
        }}
        onQuickClaimHere={() =>
          handleCreateClaimAt(
            Math.floor(playerPos.x),
            Math.floor(playerPos.y),
            Math.floor(playerPos.z),
            false
          )
        }
        onSetSpawnHere={handleSetPersonalSpawnHere}
        onReturnToBaseSpawn={handleReturnToBaseSpawn}
        onReturnToTown={handleReturnToTown}
        onToggleClaimBorders={() => setShowClaimBorders((v) => !v)}
        onToggleLowLagMode={() => {
          const next = !lowLagMode;
          setLowLagMode(next);
          showToast(
            next
              ? 'Low-Lag Mode enabled (shadows off, lower resolution).'
              : 'Standard graphics restored.',
            'info'
          );
        }}
        onToggleCamera={() =>
          mutateCharacter((prev) => ({
            ...prev,
            cameraMode: prev.cameraMode === 'first' ? 'third' : 'first',
          }))
        }
        onToggleMute={() => setMuted(gameAudio.toggleMute())}
        onEatRation={handleEatRation}
        onSaveAndExit={() => void handleSaveAndExit()}
        onSendChat={(text) => mpClientRef.current?.send({ type: 'chat:send', text })}
        onShareLocationInChat={handleShareLocationInChat}
        onCycleMiningGadgetMode={handleCycleMiningGadgetMode}
        onCycleBuildingGadgetMode={handleCycleBuildingGadgetMode}
        onUpdateMachine={handleUpdateMachine}
        onFeedFuel={handleFeedFuel}
        onInstallAugment={handleInstallAugment}
        onRemoveAugment={handleRemoveAugment}
        onCollectHopper={handleCollectHopper}
        onDismantleMachine={handleRemoveMachine}
        onTeleportToMachine={handleTeleportToMachine}
        onOpenMachineConsole={(machineId) => {
          gameAudio.playMachineOpen();
          setOpenMachineId(machineId);
        }}
        onBatchFuelMyMachines={handleBatchFuelMyMachines}
        onBatchCollectMyHoppers={handleBatchCollectMyHoppers}
        onBatchToggleMyMachines={handleBatchToggleMyMachines}
        onClaimQuestReward={handleClaimQuestReward}
        touchCrouching={touchCrouching}
        playerHurtFlash={playerHurtFlash}
        onToggleTouchCrouch={() => {
          const next = !touchCrouching;
          setTouchCrouching(next);
          engineRef.current?.setTouchCrouch(next);
        }}
        onTouchAttack={() => engineRef.current?.triggerAttackSwipe()}
        onTouchMove={(x, y) => engineRef.current?.setTouchMove(x, y)}
        onTouchMine={() => engineRef.current?.triggerMineCenter()}
        onTouchPlace={() => engineRef.current?.triggerPlaceCenter()}
        onTouchInteract={() => engineRef.current?.triggerPrimaryInteract()}
        onTouchJump={() => engineRef.current?.triggerJump()}
      />

      {/* Placed 3D FTB Machine Console + 3-Slot Augment Rack */}
      {openMachine && (
        <MachineConsoleModal
          machine={openMachine}
          grid={grid}
          dayNight={dayNight}
          character={character}
          storageInventory={activeWorld.storageInventory}
          onClose={() => setOpenMachineId(null)}
          onUpdateMachine={handleUpdateMachine}
          onFeedFuel={handleFeedFuel}
          onInstallAugment={handleInstallAugment}
          onRemoveAugment={handleRemoveAugment}
          onCollectHopper={handleCollectHopper}
          onStorageTransfer={handleStorageTransfer}
          onDepositAllOres={handleDepositAllOres}
          onDismantleMachine={handleRemoveMachine}
        />
      )}

      {/* 2-Chunk Territory Claims (24x12 / 12x24) & Granular Trusted Friend Permissions */}
      {showClaimModal && (
        <ClaimManagerModal
          claims={activeWorld.claims}
          focusedClaimId={focusedClaimId}
          localUid={character.uid}
          localDisplayName={character.characterName}
          playerX={playerPos.x}
          playerZ={playerPos.z}
          onlinePlayers={remotePlayers}
          showClaimBorders={showClaimBorders}
          personalSpawn={personalSpawn}
          claimSizeX={claimSize.sizeX}
          claimSizeZ={claimSize.sizeZ}
          onChangeClaimSize={(sizeX, sizeZ) => setClaimSize({ sizeX, sizeZ })}
          onToggleClaimBorders={() => setShowClaimBorders((v) => !v)}
          onClaimHere={() =>
            handleCreateClaimAt(
              Math.floor(playerPos.x),
              Math.floor(playerPos.y),
              Math.floor(playerPos.z),
              false
            )
          }
          onSetSpawnHere={handleSetPersonalSpawnHere}
          onSetSpawnAtClaim={handleSetPersonalSpawnInClaim}
          onClearPersonalSpawn={handleClearPersonalSpawn}
          onTeleportToSpawn={() => {
            handleReturnToBaseSpawn();
            setShowClaimModal(false);
          }}
          onAddTrustedFriend={handleAddTrustedFriend}
          onUpdateTrustedFriendPermissions={handleUpdateTrustedFriendPermissions}
          onRemoveTrustedFriend={handleRemoveTrustedFriend}
          onRenameClaim={handleRenameClaim}
          onDeleteClaim={handleDeleteClaim}
          onClose={() => setShowClaimModal(false)}
        />
      )}

      {/* Character Customizer · Player Class Selection · Hired Workers (1,000 Coins) & Food Upkeep · Trade Exchange */}
      {showClassWorkersModal && (
        <ClassTradeWorkersModal
          initialTab={classWorkersTab}
          characterName={character.characterName}
          appearance={character.appearance}
          playerClass={character.playerClass || 'engineer'}
          hiredWorkers={character.hiredWorkers || []}
          credits={character.credits}
          playerHunger={character.hunger ?? 100}
          playerMaxHunger={character.maxHunger ?? 100}
          playerSaturation={character.saturation ?? 60}
          playerHealth={character.health}
          playerMaxHealth={character.maxHealth}
          inventory={character.inventory}
          sharedStorage={activeWorld.storageInventory}
          tradeOffers={activeWorld.tradeOffers || []}
          onlinePlayers={remotePlayers}
          localUid={character.uid}
          onUpdateCharacterCustomization={handleUpdateCharacterCustomization}
          onSelectClass={handleSelectClass}
          onHireWorker={handleHireWorker}
          onChangeWorkerTask={handleChangeWorkerTask}
          onToggleWorkerActive={handleToggleWorkerActive}
          onFeedWorker={handleFeedWorker}
          onDismissWorker={handleDismissWorker}
          onEatRation={handleEatRation}
          onQuickCookRation={() => handleCraftRecipe('prim_cook_ration')}
          onExecuteTraderDeal={handleExecuteTraderDeal}
          onCreateTradeOffer={handleCreateTradeOffer}
          onAcceptTradeOffer={handleAcceptTradeOffer}
          onCancelTradeOffer={handleCancelTradeOffer}
          onClose={() => setShowClassWorkersModal(false)}
        />
      )}

      {/* Wireless AE2 ME Crafting Grid, Placed Machines Tab, JEI Tech Browser & Direwolf20 Gadgets */}
      {showShopModal && (
        <ShopModal
          character={character}
          world={activeWorld}
          grid={grid}
          dayNight={dayNight}
          worldMode={activeWorld.mode}
          storageInventory={activeWorld.storageInventory}
          initialTab={shopInitialTab}
          onClose={() => setShowShopModal(false)}
          onSellItem={handleSellItem}
          onBuyItem={handleBuyItem}
          onBuyPickaxe={handleBuyPickaxe}
          onCraftPickaxe={handleCraftPickaxe}
          onCraftRecipe={handleCraftRecipe}
          onWirelessMeTransfer={handleWirelessMeTransfer}
          onDepositAllToMe={handleDepositAllToMe}
          onSetMiningGadgetMode={(mode) => {
            const canUse3x3 =
              activeWorld.mode === 'peaceful' ||
              getPickaxeMeta(character.pickaxeTier).supports3x3Bore;
            if (mode === 'bore_3x3' && !canUse3x3) {
              gameAudio.playClaimLocked();
              showToast(
                'Craft or equip Mining Gadget MK-III (Tier 4) to unlock the 3×3 Tunnel Bore Laser!',
                'error'
              );
              return;
            }
            mutateCharacter((prev) => ({ ...prev, miningGadgetMode: mode }));
          }}
          onSetBuildingGadgetMode={(mode) =>
            mutateCharacter((prev) => ({ ...prev, buildingGadgetMode: mode }))
          }
          onUpdateMachine={handleUpdateMachine}
          onFeedFuel={handleFeedFuel}
          onInstallAugment={handleInstallAugment}
          onRemoveAugment={handleRemoveAugment}
          onCollectHopper={handleCollectHopper}
          onDismantleMachine={handleRemoveMachine}
          onTeleportToMachine={(m) => {
            handleTeleportToMachine(m);
            setShowShopModal(false);
          }}
          onOpenMachineConsole={(machineId) => {
            setShowShopModal(false);
            gameAudio.playMachineOpen();
            setOpenMachineId(machineId);
          }}
          onBatchFuelMyMachines={handleBatchFuelMyMachines}
          onBatchCollectMyHoppers={handleBatchCollectMyHoppers}
          onBatchToggleMyMachines={handleBatchToggleMyMachines}
          onClaimQuestReward={handleClaimQuestReward}
        />
      )}

      {/* Backpack & Hotbar Editor */}
      {showInventoryModal && (
        <InventoryDrawerModal
          character={character}
          onAssignHotbar={(slotIdx, itemId) =>
            mutateCharacter((prev) => {
              const hotbar = [...prev.hotbar];
              hotbar[slotIdx] = itemId;
              return { ...prev, hotbar };
            })
          }
          onHandCraft={handleCraftRecipe}
          onClose={() => setShowInventoryModal(false)}
        />
      )}

      {/* Live Co-op Multiplayer Session Manager */}
      {showMultiplayerModal && (
        <MultiplayerModal
          world={activeWorld}
          localUid={character.uid}
          isMultiplayer={isMultiplayerSession}
          isHost={isHostingMultiplayer || activeWorld.ownerId === character.uid}
          connectionStatus={mpStatus}
          remotePlayers={remotePlayers}
          playerPos={playerPos}
          onClose={() => setShowMultiplayerModal(false)}
          onStartHostingLive={handleStartHostingLive}
          onUpdateAccessMode={handleUpdateLiveAccessMode}
          onTeleportToPlayer={handleTeleportToPlayer}
          onShareLocationInChat={handleShareLocationInChat}
          onDisconnectMultiplayer={handleDisconnectMultiplayer}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <InnerApp />
      <OfflineIndicator />
    </ErrorBoundary>
  );
}
