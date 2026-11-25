import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  Backpack,
  BookOpen,
  Camera,
  Check,
  CloudFog,
  CloudRain,
  Coins,
  Cpu,
  Eye,
  EyeOff,
  Flame,
  Gamepad2,
  Gauge,
  Grid,
  Heart,
  HelpCircle,
  Home,
  Lock,
  LogOut,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Moon,
  Pickaxe,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sword,
  Users,
  Utensils,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  BLOCK_HARDNESS,
  getPickaxeMeta,
  isMachinePlacedByPlayer,
  ITEMS,
  MACHINE_SPECS,
  PLAYER_CLASSES,
} from '../data/catalog';
import { findClaimAt, getClaimDimensions, isTrustedFriendOnClaim } from '../engine/claims';
import { getMachineEffectiveFeStats, normalizeMachineKind } from '../engine/powerGrid';
import { useFullscreen } from '../hooks/useFullscreen';
import { useMobileDevice } from '../hooks/useMobileDevice';
import type { ClassWorkersTradeTab } from './ClassTradeWorkersModal';
import { FullscreenToggleButton } from './FullscreenToggleButton';
import { PlacedMachinesDrawer, type DrawerActiveSection } from './PlacedMachinesDrawer';
import type { ShopModalTab } from './ShopModal';
import { TouchJoystick } from './TouchJoystick';
import { VoxelMinimap } from './VoxelMinimap';
import type { HoverTarget } from '../engine/three/VoxelWorldEngine';
import type { WsConnectionStatus } from '../services/multiplayerClient';
import type {
  AugmentId,
  BuildingGadgetMode,
  CameraMode,
  CharacterProfile,
  DayNightState,
  MiningGadgetMode,
  PersonalSpawnPoint,
  PlacedMachine,
  PowerGridSnapshot,
  RemotePlayer,
  ResourceItemId,
  RoomChatMessage,
  TerrainBlockKind,
  WorldData,
} from '../types/game';

interface MinecraftHudProps {
  character: CharacterProfile;
  world: WorldData;
  grid: PowerGridSnapshot;
  dayNight: DayNightState;
  playerPos: { x: number; y: number; z: number; yaw: number };
  hoverTarget: HoverTarget | null;
  remotePlayers: RemotePlayer[];
  isMultiplayer: boolean;
  mpStatus: WsConnectionStatus;
  chatMessages: RoomChatMessage[];
  cameraMode: CameraMode;
  muted: boolean;
  showClaimBorders: boolean;
  lowLagMode: boolean;
  activeChunkKeys: string[];
  exploredChunks: string[];
  personalSpawn: PersonalSpawnPoint | null;
  autoSaveLabel: string;
  toast: { message: string; tone: 'info' | 'error' | 'claim_locked' } | null;
  onSelectSlot: (slotIndex: number) => void;
  onOpenInventory: () => void;
  onOpenShop: (initialTab?: ShopModalTab) => void;
  onOpenMultiplayer: () => void;
  onOpenClaims: () => void;
  onOpenClassWorkersTrade: (tab?: ClassWorkersTradeTab) => void;
  onQuickClaimHere: () => void;
  onSetSpawnHere: () => void;
  onReturnToBaseSpawn: () => void;
  onReturnToTown: () => void;
  onToggleClaimBorders: () => void;
  onToggleLowLagMode: () => void;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onEatRation: () => void;
  onSaveAndExit: () => void;
  onSendChat: (text: string) => void;
  onShareLocationInChat: () => void;
  onCycleMiningGadgetMode: () => void;
  onCycleBuildingGadgetMode: () => void;
  onUpdateMachine: (updated: PlacedMachine) => void;
  onFeedFuel: (machineId: string, fuelItemId: ResourceItemId, qty: number) => void;
  onInstallAugment: (machineId: string, augmentId: AugmentId) => void;
  onRemoveAugment: (machineId: string, slotIndex: number) => void;
  onCollectHopper: (machineId: string) => void;
  onDismantleMachine: (machineId: string) => void;
  onOpenMachineConsole: (machineId: string) => void;
  onTeleportToMachine: (machine: PlacedMachine) => void;
  onBatchFuelMyMachines: () => void;
  onBatchCollectMyHoppers: () => void;
  onBatchToggleMyMachines: (enable: boolean) => void;
  onClaimQuestReward: (questId: string) => void;
  touchCrouching: boolean;
  playerHurtFlash: boolean;
  onToggleTouchCrouch: () => void;
  onTouchAttack: () => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchMine: () => void;
  onTouchPlace: () => void;
  onTouchInteract: () => void;
  onTouchJump: () => void;
}

const BUILDING_MODE_LABELS: Record<BuildingGadgetMode, string> = {
  single: '1×1',
  floor_3x3: '3×3 Floor',
  wall_3x3: '3×3 Wall',
  line_5: '5-Line',
};

export const MinecraftHud: React.FC<MinecraftHudProps> = ({
  character,
  world,
  grid,
  dayNight,
  playerPos,
  hoverTarget,
  remotePlayers,
  isMultiplayer,
  mpStatus,
  chatMessages,
  cameraMode,
  muted,
  lowLagMode,
  activeChunkKeys,
  exploredChunks,
  personalSpawn,
  autoSaveLabel,
  toast,
  onSelectSlot,
  onOpenInventory,
  onOpenShop,
  onOpenMultiplayer,
  onOpenClaims,
  onOpenClassWorkersTrade,
  onQuickClaimHere,
  onSetSpawnHere,
  onReturnToBaseSpawn,
  onReturnToTown,
  onToggleLowLagMode,
  onToggleCamera,
  onToggleMute,
  onEatRation,
  onSaveAndExit,
  onSendChat,
  onShareLocationInChat,
  onCycleMiningGadgetMode,
  onCycleBuildingGadgetMode,
  onUpdateMachine,
  onFeedFuel,
  onInstallAugment,
  onRemoveAugment,
  onCollectHopper,
  onDismantleMachine,
  onOpenMachineConsole,
  onTeleportToMachine,
  onBatchFuelMyMachines,
  onBatchCollectMyHoppers,
  onBatchToggleMyMachines,
  onClaimQuestReward,
  touchCrouching,
  playerHurtFlash,
  onToggleTouchCrouch,
  onTouchAttack,
  onTouchMove,
  onTouchMine,
  onTouchPlace,
  onTouchInteract,
  onTouchJump,
}) => {
  const { isTouchDevice, isCompactViewport, isTablet, isPortraitPhone, isLandscapePhone } =
    useMobileDevice();
  const isCompactPhone = isPortraitPhone || isLandscapePhone;
  const { isFallbackImmersive } = useFullscreen();
  const isPhoneDefault =
    typeof window !== 'undefined' && (window.innerWidth < 640 || window.innerHeight < 520);
  const isMobileOrTabletDefault =
    typeof window !== 'undefined' && (window.innerWidth < 1100 || window.innerHeight < 640);

  const [hudMinimized, setHudMinimized] = useState(false);
  const [minimapMinimized, setMinimapMinimized] = useState(() => isPhoneDefault);
  const [machineDrawerOpen, setMachineDrawerOpen] = useState(() => !isMobileOrTabletDefault);
  const [drawerSection, setDrawerSection] = useState<DrawerActiveSection>('machines');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [copiedCodeQuick, setCopiedCodeQuick] = useState(false);
  const [touchControlsOverride, setTouchControlsOverride] = useState<boolean | null>(null);

  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastTouchFireRef = useRef<number>(0);
  const holdRepeatTimerRef = useRef<number | null>(null);

  const effectiveHudMinimized = hudMinimized || isFallbackImmersive;
  const showMobileControls =
    touchControlsOverride !== null
      ? touchControlsOverride
      : isTouchDevice || isCompactViewport || isTablet;

  useEffect(() => {
    return () => {
      if (holdRepeatTimerRef.current) {
        window.clearInterval(holdRepeatTimerRef.current);
      }
    };
  }, []);

  const stopHoldRepeat = () => {
    if (holdRepeatTimerRef.current !== null) {
      window.clearInterval(holdRepeatTimerRef.current);
      holdRepeatTimerRef.current = null;
    }
  };

  const bindHoldRepeat = (action: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      lastTouchFireRef.current = performance.now();
      action();
      stopHoldRepeat();
      holdRepeatTimerRef.current = window.setInterval(() => {
        action();
      }, 240);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      stopHoldRepeat();
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      stopHoldRepeat();
    },
    onPointerLeave: () => {
      stopHoldRepeat();
    },
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (performance.now() - lastTouchFireRef.current < 450) return;
      action();
    },
  });

  const bindInstantTap = (action: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (e.pointerType !== 'mouse') {
        e.preventDefault();
        lastTouchFireRef.current = performance.now();
        action();
      }
    },
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (performance.now() - lastTouchFireRef.current < 450) return;
      action();
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.code === 'Escape' && chatOpen) {
          setChatOpen(false);
        }
        return;
      }
      if (e.code === 'KeyH') {
        setHudMinimized((v) => !v);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        setDrawerSection('machines');
        setMachineDrawerOpen((v) => !v);
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        if (machineDrawerOpen && drawerSection === 'quests') {
          setMachineDrawerOpen(false);
        } else {
          setDrawerSection('quests');
          setMachineDrawerOpen(true);
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        onEatRation();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        onOpenClaims();
      } else if (e.code === 'KeyK') {
        e.preventDefault();
        onOpenClassWorkersTrade('class');
      } else if (e.code === 'KeyT' && isMultiplayer) {
        e.preventDefault();
        setChatOpen(true);
        window.setTimeout(() => chatInputRef.current?.focus(), 20);
      } else if (e.code === 'Slash' && e.shiftKey) {
        e.preventDefault();
        setShowControlsGuide((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatOpen, isMultiplayer, machineDrawerOpen, drawerSection, onEatRation, onOpenClaims, onOpenClassWorkersTrade]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, chatOpen]);

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = chatDraft.trim();
    if (!cleaned) {
      setChatOpen(false);
      return;
    }
    onSendChat(cleaned);
    setChatDraft('');
    setChatOpen(false);
  };

  const handleQuickCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(world.inviteCode);
      setCopiedCodeQuick(true);
      window.setTimeout(() => setCopiedCodeQuick(false), 1800);
    } catch {
      onOpenMultiplayer();
    }
  };

  const selectedItemId = character.hotbar[character.selectedSlot];
  const selectedItemMeta = selectedItemId ? ITEMS[selectedItemId] : null;
  const pickMeta = getPickaxeMeta(character.pickaxeTier);
  const miningMode: MiningGadgetMode = character.miningGadgetMode || 'single_1x1';
  const buildingMode: BuildingGadgetMode = character.buildingGadgetMode || 'single';

  const totalMeItems = Object.values(world.storageInventory || {}).reduce(
    (acc, q) => acc + (q || 0),
    0
  );
  const netFe = grid.totalGenKw - grid.totalDemandKw;
  const batteryPct =
    grid.totalMaxEnergy > 0
      ? Math.min(100, Math.round((grid.totalStoredEnergy / grid.totalMaxEnergy) * 100))
      : 0;

  // WAILA / Jade Target Inspector Data
  const hoveredMachine =
    hoverTarget?.kind === 'machine' && hoverTarget.machineId
      ? world.machines.find((m) => m.id === hoverTarget.machineId) || null
      : null;
  const hoveredMachineNormKind = hoveredMachine ? normalizeMachineKind(hoveredMachine.kind) : null;
  const hoveredMachineSpec = hoveredMachineNormKind ? MACHINE_SPECS[hoveredMachineNormKind] : null;
  const hoveredMachinePowered = hoveredMachine ? Boolean(grid.machinePowered[hoveredMachine.id]) : false;
  const hoveredMachineFe = hoveredMachine
    ? getMachineEffectiveFeStats(hoveredMachine, dayNight.solarEfficiency)
    : null;
  const hoveredMachineIsMine = hoveredMachine
    ? isMachinePlacedByPlayer(hoveredMachine, character.uid, world.ownerId)
    : false;
  const hoveredBlockMeta =
    hoverTarget?.kind === 'block' && hoverTarget.blockKind
      ? ITEMS[hoverTarget.blockKind as ResourceItemId] || null
      : null;
  const hoveredBlockHardness =
    hoverTarget?.kind === 'block' && hoverTarget.blockKind
      ? BLOCK_HARDNESS[hoverTarget.blockKind as TerrainBlockKind] || null
      : null;
  const bonusHarvestPower = character.playerClass === 'miner' ? 1 : 0;
  const canHarvestHoveredBlock = hoveredBlockHardness
    ? pickMeta.harvestPower + bonusHarvestPower >= hoveredBlockHardness.minPower
    : true;

  const hungerPct = Math.max(
    0,
    Math.min(100, Math.round(((character.hunger ?? 100) / (character.maxHunger ?? 100)) * 100))
  );
  const saturationPct = Math.max(0, Math.min(100, Math.round(character.saturation ?? 60)));
  const healthHearts = Math.max(0, Math.min(10, Math.ceil((character.health / Math.max(1, character.maxHealth)) * 10)));
  const hungerShanks = Math.max(0, Math.min(10, Math.ceil((hungerPct / 100) * 10)));
  const rationCount =
    (character.inventory.cooked_ration || 0) + (world.storageInventory.cooked_ration || 0);
  const myPlacedMachinesCount = world.machines.filter((m) =>
    isMachinePlacedByPlayer(m, character.uid, world.ownerId)
  ).length;
  const activeClassSpec =
    PLAYER_CLASSES.find((c) => c.id === (character.playerClass || 'engineer')) ||
    PLAYER_CLASSES[2];
  const workers = character.hiredWorkers || [];
  const hungryWorkersCount = workers.filter((w) => w.starving || (w.hunger ?? 100) <= 0).length;
  const standingClaim = findClaimAt(world.claims, playerPos.x, playerPos.z);
  const standingClaimTrusted = standingClaim
    ? isTrustedFriendOnClaim(standingClaim, {
        uid: character.uid,
        displayName: character.characterName,
      })
    : false;
  const standingClaimDims = standingClaim ? getClaimDimensions(standingClaim) : null;

  const visibleChatMessages = chatOpen ? chatMessages.slice(-24) : chatMessages.slice(-4);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-1.5 sm:p-4 safe-pt safe-pb safe-pl safe-pr select-none">
      {/* Survival Combat Hurt Vignette Flash */}
      {playerHurtFlash && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-30 border-[6px] border-[#ef4444]/80 bg-[#ef4444]/18 transition-opacity"
        />
      )}

      {/* Crisp Precision First-Person Crosshair */}
      {cameraMode === 'first' && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          aria-hidden="true"
        >
          <div className="relative w-5 h-5">
            <div className="absolute left-1/2 top-0 h-1.5 w-[2px] -translate-x-1/2 bg-white/90 shadow-[0_0_4px_rgba(0,0,0,0.95)]" />
            <div className="absolute left-1/2 bottom-0 h-1.5 w-[2px] -translate-x-1/2 bg-white/90 shadow-[0_0_4px_rgba(0,0,0,0.95)]" />
            <div className="absolute top-1/2 left-0 w-1.5 h-[2px] -translate-y-1/2 bg-white/90 shadow-[0_0_4px_rgba(0,0,0,0.95)]" />
            <div className="absolute top-1/2 right-0 w-1.5 h-[2px] -translate-y-1/2 bg-white/90 shadow-[0_0_4px_rgba(0,0,0,0.95)]" />
            <div
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full ${
                miningMode === 'bore_3x3' ? 'bg-[#f59e0b]' : 'bg-[#22d3ee]'
              }`}
            />
          </div>
        </div>
      )}

      {/* TOP ROW: Compact Mobile Stack on Portrait Phones · Full Left/Center/Right HUD on Tablet & Desktop */}
      <div
        className={`flex relative w-full ${
          isPortraitPhone
            ? 'flex-col-reverse gap-1.5'
            : 'flex-row items-start justify-between gap-2'
        }`}
      >
        {/* TOP-LEFT: World Telemetry + Survival Vitals + Collapsible Placed-Machine UI Drawer */}
        <div
          className={`pointer-events-auto flex flex-col gap-1.5 sm:gap-2 min-w-0 ${
            isPortraitPhone
              ? 'w-full'
              : isLandscapePhone
                ? 'max-w-[54vw]'
                : 'max-w-[385px]'
          }`}
        >
          {isCompactPhone ? (
            /* ULTRA-COMPACT PHONE TELEMETRY STRIP (Zero Overflow on 360px Portrait & Short Landscape) */
            <div className="hud-glass rounded-xl px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 font-mono text-[10px] tabular-nums">
              <div className="flex items-center gap-2 min-w-0">
                {/* Compact HP */}
                <span
                  className="inline-flex items-center gap-1 text-[#f87171] font-semibold shrink-0"
                  title={`Health: ${Math.round(character.health)}/${character.maxHealth} HP`}
                >
                  <Heart className="w-3 h-3 fill-[#ef4444] text-[#ef4444]" />
                  {Math.round(character.health)}
                </span>

                {/* Compact Hunger */}
                <span
                  className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                    hungerPct === 0
                      ? 'text-[#ef4444] animate-pulse'
                      : hungerPct <= 30
                        ? 'text-[#fbbf24]'
                        : 'text-[#34d399]'
                  }`}
                  title={`Hunger: ${hungerPct}% · Saturation: ${saturationPct}%`}
                >
                  <Utensils className="w-3 h-3" />
                  {hungerPct}%
                </span>

                {/* Compact Coins & Level */}
                <span className="inline-flex items-center gap-0.5 text-[#fbbf24] shrink-0">
                  <Coins className="w-3 h-3" />
                  {character.credits.toLocaleString()}c
                </span>
                <span className="text-[#a78bfa] shrink-0">Lv.{character.level}</span>

                {dayNight.weather.kind !== 'clear' && (
                  <span
                    className={`inline-flex items-center gap-0.5 shrink-0 font-semibold ${
                      dayNight.weather.kind === 'light_rain' ? 'text-[#7dd3fc]' : 'text-[#cbd5e1]'
                    }`}
                    title={`${dayNight.weather.label} · Solar ${Math.round(dayNight.weather.solarMultiplier * 100)}% · Coal Boiler Burn ${dayNight.weather.boilerFuelBurnMultiplier.toFixed(2)}×`}
                  >
                    {dayNight.weather.kind === 'light_rain' ? (
                      <CloudRain className="w-3 h-3" />
                    ) : (
                      <CloudFog className="w-3 h-3" />
                    )}
                    {Math.round(dayNight.weather.solarMultiplier * 100)}%
                  </span>
                )}

                {!isPortraitPhone && (
                  <span
                    className={`inline-flex items-center gap-0.5 shrink-0 ${
                      netFe >= 0 ? 'text-[#f59e0b]' : 'text-[#f87171]'
                    }`}
                  >
                    <Flame className="w-3 h-3" />
                    +{grid.totalGenKw}/-{grid.totalDemandKw}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onEatRation}
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                    hungerPct <= 30
                      ? 'border-[#f59e0b] bg-[#f59e0b]/25 text-[#fde68a] animate-pulse'
                      : 'border-[#10b981]/50 bg-[#10b981]/15 text-[#6ee7b7]'
                  }`}
                >
                  <Utensils className="w-2.5 h-2.5" />
                  Eat ({rationCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerSection('quests');
                    setMachineDrawerOpen((v) => !v);
                  }}
                  title="FTB Quests"
                  className="rounded-md border border-[#f59e0b]/40 bg-[#f59e0b]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#fbbf24] inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <Award className="w-2.5 h-2.5" />
                  Q
                </button>
                <button
                  type="button"
                  onClick={() => setHudMinimized((v) => !v)}
                  title={effectiveHudMinimized ? 'Show HUD' : 'Hide HUD'}
                  aria-label={effectiveHudMinimized ? 'Show HUD' : 'Hide HUD'}
                  className="p-1 rounded-md text-[#94a3b8] hover:text-white cursor-pointer"
                >
                  {effectiveHudMinimized ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="hud-glass rounded-xl px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display text-xs sm:text-sm font-bold text-white truncate">
                  {world.name}
                </span>
                <span className="hidden sm:inline text-[#475569]" aria-hidden="true">
                  ·
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-[#cbd5e1] shrink-0">
                  {dayNight.isNight ? (
                    <Moon className="w-3 h-3 text-[#38bdf8]" />
                  ) : (
                    <Sun className="w-3 h-3 text-[#f59e0b]" />
                  )}
                  {dayNight.phase === 'night' ? 'Night' : 'Day'}
                </span>
                <span className="hidden sm:inline text-[#475569]" aria-hidden="true">
                  ·
                </span>
                <span
                  className={`hidden sm:inline-flex items-center gap-1 font-mono text-[11px] shrink-0 ${
                    dayNight.weather.kind === 'light_rain'
                      ? 'text-[#7dd3fc] font-semibold'
                      : dayNight.weather.kind === 'fog'
                        ? 'text-[#cbd5e1] font-semibold'
                        : 'text-[#94a3b8]'
                  }`}
                  title={`${dayNight.weather.label} (${dayNight.weather.formattedTimeRemaining} left) · Solar Panels: ${Math.round(dayNight.solarEfficiency * 100)}% eff · Coal/Firewood Boiler Burn: ${dayNight.weather.boilerFuelBurnMultiplier.toFixed(2)}×`}
                >
                  {dayNight.weather.kind === 'light_rain' ? (
                    <CloudRain className="w-3 h-3 text-[#38bdf8]" />
                  ) : dayNight.weather.kind === 'fog' ? (
                    <CloudFog className="w-3 h-3 text-[#cbd5e1]" />
                  ) : null}
                  {dayNight.weather.kind === 'clear'
                    ? 'Clear'
                    : `${dayNight.weather.shortLabel} · Solar ${Math.round(dayNight.solarEfficiency * 100)}%`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setHudMinimized((v) => !v)}
                title={effectiveHudMinimized ? 'Show HUD (H)' : 'Hide HUD (H)'}
                aria-label={effectiveHudMinimized ? 'Show HUD' : 'Hide HUD'}
                className="p-1 rounded-md text-[#94a3b8] hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                {effectiveHudMinimized ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {!effectiveHudMinimized && (
              <>
                {/* Live Forge Energy + ME Storage + Credits Strip */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] tabular-nums">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      netFe >= 0 ? 'text-[#f59e0b]' : 'text-[#f87171]'
                    }`}
                  >
                    <Flame className="w-3 h-3" />
                    +{grid.totalGenKw}/-{grid.totalDemandKw} FE/t
                  </span>

                  <button
                    type="button"
                    onClick={() => onOpenShop('me_terminal')}
                    className="inline-flex items-center gap-1 text-[#22d3ee] hover:text-[#67e8f9] cursor-pointer"
                    title="Open Crafting & AE2 ME Grid (G)"
                  >
                    <Cpu className="w-3 h-3" />
                    ME {totalMeItems.toLocaleString()}
                  </button>

                  <span className="inline-flex items-center gap-1 text-[#cbd5e1]">
                    <Coins className="w-3 h-3 text-[#fbbf24]" />
                    {character.credits.toLocaleString()}c
                  </span>

                  <span className="inline-flex items-center gap-1 text-[#a78bfa]">
                    Lv.{character.level}
                  </span>
                </div>

                {/* Minecraft Survival Vitals: 10 Hearts + 10 Drumstick Food Bar + Eat Food Button */}
                <div className="space-y-1.5 pt-1 border-t border-white/10 font-mono text-[11px] tabular-nums">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* 10 Minecraft Hearts */}
                    <div className="flex items-center gap-1" title={`Health: ${Math.round(character.health)}/${character.maxHealth} HP`}>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 10 }).map((_, idx) => (
                          <span
                            key={idx}
                            className={`w-2 h-2.5 rounded-xs border ${
                              idx < healthHearts
                                ? 'bg-[#ef4444] border-[#fca5a5]/70'
                                : 'bg-[#1e2430] border-white/15'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-[#f87171]">
                        {Math.round(character.health)} HP
                      </span>
                    </div>

                    {/* 10 Minecraft Food Drumsticks (Shanks) + Golden Saturation Trim */}
                    <div
                      className="flex items-center gap-1"
                      title={`Minecraft Hunger: ${hungerPct}% (${hungerShanks}/10 Drumsticks) · Saturation: ${saturationPct}%`}
                    >
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 10 }).map((_, idx) => {
                          const filled = idx < hungerShanks;
                          const satGlow = saturationPct >= (idx + 1) * 10;
                          return (
                            <span
                              key={idx}
                              className={`w-2 h-2.5 rounded-xs border ${
                                filled
                                  ? hungerPct <= 30
                                    ? 'bg-[#f59e0b]'
                                    : 'bg-[#10b981]'
                                  : 'bg-[#1e2430]'
                              } ${
                                satGlow
                                  ? 'border-[#fbbf24]'
                                  : filled
                                  ? 'border-[#6ee7b7]/60'
                                  : 'border-white/15'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <span
                        className={`text-[10px] ${
                          hungerPct === 0
                            ? 'text-[#ef4444] font-bold animate-pulse'
                            : hungerPct <= 30
                            ? 'text-[#fbbf24] font-bold'
                            : 'text-[#34d399]'
                        }`}
                      >
                        {hungerPct === 0
                          ? 'STARVING!'
                          : hungerPct <= 30
                          ? `${hungerPct}% (No Sprint)`
                          : hungerPct >= 90 && character.health < character.maxHealth
                          ? `${hungerPct}% (+Regen)`
                          : `${hungerPct}%`}
                      </span>
                    </div>
                  </div>

                  {/* Eat Food & Pickaxe Tier Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={onEatRation}
                        title="Eat Energized Field Ration (+Hunger & +Saturation for Minecraft Health Regen · Hotkey: R)"
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                          hungerPct <= 30
                            ? 'border-[#f59e0b] bg-[#f59e0b]/25 text-[#fde68a] animate-pulse'
                            : 'border-[#10b981]/50 bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#6ee7b7]'
                        }`}
                      >
                        <Utensils className="w-3 h-3" />
                        Eat Food ({rationCount}) · R
                      </button>
                      {hungryWorkersCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenClassWorkersTrade('workers')}
                          className="rounded-md border border-[#ef4444]/70 bg-[#ef4444]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#fca5a5] cursor-pointer"
                        >
                          {hungryWorkersCount} Worker Hungry!
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenShop('gadgets')}
                      title="Upgrade Pickaxe Tier & Mining Laser"
                      className="inline-flex items-center gap-1 text-[#38bdf8] hover:text-white cursor-pointer truncate"
                    >
                      <Pickaxe className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        Pwr {pickMeta.harvestPower + bonusHarvestPower} ·{' '}
                        {pickMeta.name.split(' (')[0]}
                      </span>
                    </button>
                  </div>

                  {/* Quick Strip: Active Class · Hired Workers · 2-Chunk Territory Claim */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => onOpenClassWorkersTrade('class')}
                      className="rounded-md border border-white/15 bg-white/5 hover:border-[#10b981] px-2 py-0.5 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1"
                      style={{ color: activeClassSpec.accentColor }}
                    >
                      <Award className="w-3 h-3" />
                      {activeClassSpec.name}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenClassWorkersTrade('workers')}
                      className="rounded-md border border-white/15 bg-white/5 hover:border-[#fbbf24] px-2 py-0.5 text-[10px] font-semibold text-[#fcd34d] cursor-pointer inline-flex items-center gap-1"
                    >
                      <Users className="w-3 h-3" />
                      Workers ({workers.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenClassWorkersTrade('trade')}
                      className="rounded-md border border-white/15 bg-white/5 hover:border-[#38bdf8] px-2 py-0.5 text-[10px] font-semibold text-[#7dd3fc] cursor-pointer inline-flex items-center gap-1"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      Trade
                    </button>

                    {standingClaim && standingClaimDims ? (
                      <button
                        type="button"
                        onClick={onOpenClaims}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                          standingClaimTrusted
                            ? 'border-[#10b981]/50 bg-[#10b981]/15 text-[#34d399]'
                            : 'border-[#ef4444]/60 bg-[#ef4444]/20 text-[#fca5a5]'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {standingClaim.label} ({standingClaimDims.sizeX}×{standingClaimDims.sizeZ})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onQuickClaimHere}
                        title="Claim a 2-Chunk Territory (24×12) here or open Claim Manager"
                        className="rounded-md border border-[#10b981]/45 bg-[#10b981]/12 hover:bg-[#10b981]/25 px-2 py-0.5 text-[10px] font-semibold text-[#34d399] cursor-pointer inline-flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Claim 2 Chunks
                      </button>
                    )}
                  </div>
                </div>

                {/* Battery Storage Bar when Flux Capacitor Banks exist */}
                {grid.totalMaxEnergy > 0 && (
                  <div className="space-y-0.5">
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#38bdf8] transition-all duration-300"
                        style={{ width: `${batteryPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Live Co-op Session Quick Strip when Hosting/Joined */}
                {isMultiplayer && (
                  <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={onOpenMultiplayer}
                      className="inline-flex items-center gap-1.5 text-[#cbd5e1] hover:text-white cursor-pointer truncate"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          mpStatus === 'connected'
                            ? 'bg-[#10b981]'
                            : mpStatus === 'reconnecting'
                              ? 'bg-[#f59e0b]'
                              : 'bg-[#ef4444]'
                        }`}
                      />
                      <span className="font-mono text-[#22d3ee] font-semibold">
                        {world.inviteCode}
                      </span>
                      <span className="text-[#94a3b8]">
                        · {remotePlayers.length} online
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleQuickCopyCode()}
                      className="text-[10px] font-medium text-[#94a3b8] hover:text-[#22d3ee] cursor-pointer shrink-0 inline-flex items-center gap-1"
                    >
                      {copiedCodeQuick ? (
                        <>
                          <Check className="w-3 h-3 text-[#10b981]" />
                          Copied
                        </>
                      ) : (
                        'Copy'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          )}

          {/* Collapsible Placed-Machine Control UI Drawer & FTB Quest Book (Hide collapsed edge buttons on compact phones to maximize 3D screen space) */}
          {!effectiveHudMinimized && (!isCompactPhone || machineDrawerOpen) && (
            <PlacedMachinesDrawer
              variant="drawer"
              isOpen={machineDrawerOpen}
              activeSection={drawerSection}
              onToggleOpen={() => setMachineDrawerOpen((v) => !v)}
              onChangeSection={(sec) => setDrawerSection(sec)}
              world={world}
              character={character}
              grid={grid}
              dayNight={dayNight}
              onUpdateMachine={onUpdateMachine}
              onFeedFuel={onFeedFuel}
              onInstallAugment={onInstallAugment}
              onRemoveAugment={onRemoveAugment}
              onCollectHopper={onCollectHopper}
              onDismantleMachine={onDismantleMachine}
              onOpenMachineConsole={onOpenMachineConsole}
              onTeleportToMachine={onTeleportToMachine}
              onBatchFuelMyMachines={onBatchFuelMyMachines}
              onBatchCollectMyHoppers={onBatchCollectMyHoppers}
              onBatchToggleMyMachines={onBatchToggleMyMachines}
              onClaimQuestReward={onClaimQuestReward}
              onOpenCraftingTerminal={() => onOpenShop('me_terminal')}
            />
          )}
        </div>

        {/* TOP-CENTER: WAILA / Jade Target Inspector ("What Am I Looking At") */}
        {!effectiveHudMinimized && !isLandscapePhone && hoverTarget && (
          <div className="hidden md:flex fixed left-1/2 top-4 -translate-x-1/2 z-20 pointer-events-none">
            <div className="hud-glass rounded-xl px-3.5 py-2 min-w-[250px] max-w-[400px]">
              {hoverTarget.kind === 'machine' && hoveredMachine && hoveredMachineSpec ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-xs border border-white/25 shrink-0"
                        style={{ backgroundColor: ITEMS[hoveredMachineNormKind!]?.color || '#22d3ee' }}
                      />
                      <span className="font-display text-xs font-bold text-white truncate">
                        {hoveredMachineSpec.name}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-[10px] font-semibold shrink-0 ${
                        hoveredMachinePowered ? 'text-[#10b981]' : 'text-[#f87171]'
                      }`}
                    >
                      {hoveredMachinePowered ? 'ONLINE' : 'NO FE'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#94a3b8] tabular-nums">
                    <span className="text-[#38bdf8] truncate">{hoveredMachineSpec.modSuite}</span>
                    <span>
                      {hoveredMachineFe && hoveredMachineFe.genFe > 0
                        ? `+${hoveredMachineFe.genFe} FE/t`
                        : hoveredMachineFe && hoveredMachineFe.demandFe > 0
                          ? `-${hoveredMachineFe.demandFe} FE/t`
                          : '0 FE/t'}
                      {' · '}
                      {(hoveredMachine.augments || []).length}/3 Augs
                    </span>
                  </div>

                  {hoveredMachine.progress > 0 && (
                    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#22d3ee]"
                        style={{ width: `${Math.min(100, hoveredMachine.progress)}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    {hoveredMachineIsMine ? (
                      <>
                        <span className="text-[#10b981] font-medium">Placed by You</span>
                        <span className="text-[#94a3b8]">
                          Click Console · Shift+Click Wrench
                        </span>
                      </>
                    ) : (
                      <span className="text-[#fca5a5] inline-flex items-center gap-1 font-medium">
                        <Lock className="w-3 h-3" />
                        Locked · Placed by {hoveredMachine.ownerName || 'Teammate'}
                      </span>
                    )}
                  </div>
                </div>
              ) : hoverTarget.kind === 'cable' ? (
                <div className="space-y-0.5">
                  <div className="font-display text-xs font-bold text-[#f59e0b]">
                    Ender IO Universal Conduit
                  </div>
                  <div className="text-[11px] font-mono text-[#94a3b8]">
                    3-in-1 FE Power · Items · AE2 ME Channels
                  </div>
                  <div className="text-[10px] text-[#94a3b8]">
                    L-Click Remove · R-Click Branch Conduit
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-4 h-4 rounded-xs border border-white/25 shrink-0"
                    style={{ backgroundColor: hoveredBlockMeta?.color || '#64748b' }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xs font-bold text-white truncate">
                        {hoveredBlockMeta?.name || hoverTarget.blockKind}
                      </span>
                      {hoveredBlockHardness && hoveredBlockHardness.minPower < 999 && (
                        <span
                          className={`font-mono text-[10px] shrink-0 ${
                            canHarvestHoveredBlock ? 'text-[#10b981]' : 'text-[#f87171]'
                          }`}
                        >
                          {canHarvestHoveredBlock
                            ? `Harvestable (Pwr ${hoveredBlockHardness.minPower})`
                            : `Requires Pickaxe Pwr ${hoveredBlockHardness.minPower}+`}
                        </span>
                      )}
                    </div>
                    {hoverTarget.blockKind === 'mob_spawner' ? (
                      <div className="space-y-0.5 mt-0.5">
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <span className="text-[#fb923c] font-semibold">
                            {hoverTarget.spawnerMobKind === 'slag_golem'
                              ? 'Slag Golem Cage'
                              : 'Night Stalker Cage'}
                          </span>
                          <span className="text-[#64748b]">·</span>
                          <span
                            className={
                              hoverTarget.spawnerStatus === 'active'
                                ? 'text-[#f97316] font-bold'
                                : hoverTarget.spawnerStatus === 'torch_suppressed'
                                  ? 'text-[#10b981]'
                                  : 'text-[#94a3b8]'
                            }
                          >
                            {hoverTarget.spawnerStatus === 'active'
                              ? 'ACTIVE (Night · ≤16m)'
                              : hoverTarget.spawnerStatus === 'torch_suppressed'
                                ? 'SUPPRESSED (Torch / Safe Zone)'
                                : hoverTarget.spawnerStatus === 'mob_cap'
                                  ? 'PAUSED (Local Mob Cap)'
                                  : hoverTarget.spawnerStatus === 'out_of_range'
                                    ? 'IDLE (Move Within 16m)'
                                    : hoverTarget.spawnerStatus === 'creative_peaceful'
                                      ? 'INACTIVE (Creative Mode)'
                                      : 'DORMANT (Spawns at Night)'}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#94a3b8]">
                          Place Torch within 5 blocks to suppress · L-Click Mine (Pwr 2+)
                        </div>
                      </div>
                    ) : hoverTarget.blockKind === 'chest' ? (
                      <div className="text-[10px] text-[#34d399]">
                        Click or press E to Open Storage Chest · Shift+Click Mine
                      </div>
                    ) : hoverTarget.blockKind === 'lever' ? (
                      <div className="text-[10px] text-[#fbbf24]">
                        Click or press E to Flip Redstone Lever (Toggles Adjacent Machines) · Shift+Click Mine
                      </div>
                    ) : (
                      <div className="text-[10px] text-[#94a3b8]">
                        L-Click Mine ({miningMode === 'bore_3x3' ? '3×3 Bore' : '1×1'}) · R-Click{' '}
                        {BUILDING_MODE_LABELS[buildingMode]}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TOP-RIGHT: Streamlined Action Dock + Settings Popover + Minimap */}
        <div
          className={`pointer-events-auto flex flex-col gap-1.5 sm:gap-2 shrink-0 relative ${
            isPortraitPhone ? 'w-full items-stretch' : 'items-end'
          }`}
        >
          <div
            className={`hud-glass rounded-xl p-1 flex items-center gap-0.5 sm:gap-1 ${
              isPortraitPhone ? 'w-full justify-between' : 'max-w-[46vw] sm:max-w-none overflow-x-auto no-scrollbar'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setDrawerSection('machines');
                setMachineDrawerOpen((v) => !v);
              }}
              title="Toggle My Placed Machines Command Drawer (Hotkey: F)"
              className={`min-h-[34px] sm:min-h-[36px] px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isPortraitPhone ? 'flex-1' : ''
              } ${
                machineDrawerOpen && drawerSection === 'machines'
                  ? 'bg-[#38bdf8]/20 text-[#38bdf8]'
                  : 'text-[#e2e8f0] hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Machines ({myPlacedMachinesCount})</span>
            </button>

            <button
              type="button"
              onClick={onOpenClaims}
              title="2-Chunk Territory Claims (24×12) & Trusted Friend Permissions (Hotkey: C)"
              className={`min-h-[34px] sm:min-h-[36px] px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#34d399] hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap ${
                isPortraitPhone ? 'flex-1' : ''
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Claims ({world.claims.length})</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenClassWorkersTrade('workers')}
              title="Player Class, Hired Workers (1,000 Dire Coins) & Trade Exchange (Hotkey: K)"
              className={`min-h-[34px] sm:min-h-[36px] px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#fbbf24] hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap ${
                isPortraitPhone ? 'flex-1' : ''
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Class / Workers ({workers.length})</span>
            </button>

            <button
              type="button"
              onClick={onOpenMultiplayer}
              title="Multiplayer Co-op & Engineers (P)"
              className={`min-h-[34px] sm:min-h-[36px] px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isPortraitPhone ? 'flex-1' : ''
              } ${
                isMultiplayer
                  ? 'bg-[#10b981]/18 text-[#34d399] hover:bg-[#10b981]/28'
                  : 'text-[#e2e8f0] hover:bg-white/10'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isMultiplayer ? `Co-op (${remotePlayers.length})` : 'Co-op'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenShop('me_terminal')}
              title="Crafting, Hand-Smelting & Wireless AE2 ME Grid (G)"
              className={`min-h-[34px] sm:min-h-[36px] px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#22d3ee] hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap ${
                isPortraitPhone ? 'flex-1' : ''
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Craft / ME</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenShop('jei_chains')}
              title="JEI Tech Chains & Machines (J)"
              className={`hidden sm:inline-flex min-h-[36px] px-2.5 py-1.5 rounded-lg items-center justify-center gap-1.5 text-xs font-semibold text-[#10b981] hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">JEI</span>
            </button>

            <button
              type="button"
              onClick={onOpenInventory}
              title="Backpack & Hotbar (I)"
              className={`min-h-[34px] sm:min-h-[36px] px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#f3f5f8] hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap ${
                isPortraitPhone ? 'flex-1' : ''
              }`}
            >
              <Backpack className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Bag</span>
            </button>

            {isPortraitPhone && (
              <button
                type="button"
                onClick={() => setMinimapMinimized((v) => !v)}
                title="Toggle Minimap"
                className={`flex-1 min-h-[34px] px-1.5 py-1 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
                  !minimapMinimized ? 'bg-[#22d3ee]/20 text-[#22d3ee]' : 'text-[#cbd5e1] hover:bg-white/10'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title="Tools, Waypoints & Settings"
              aria-label="Open Tools and Settings"
              className={`min-h-[34px] sm:min-h-[36px] min-w-[34px] sm:min-w-[36px] px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
                isPortraitPhone ? 'flex-1' : ''
              } ${
                menuOpen
                  ? 'bg-[#22d3ee]/20 text-[#22d3ee]'
                  : 'text-[#cbd5e1] hover:text-white hover:bg-white/10'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Clean Tools, Waypoints & Settings Popover */}
          {menuOpen && (
            <div className="fixed right-2 top-[54px] sm:static hud-glass rounded-xl p-3 w-[min(17rem,calc(100vw-1rem))] sm:w-64 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain touch-pan-y space-y-2.5 text-xs z-40">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-display font-bold text-white">Factory Menu</span>
                <span className="font-mono text-[10px] text-[#10b981]">{autoSaveLabel}</span>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onReturnToTown();
                    setMenuOpen(false);
                  }}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[#fbbf24] hover:bg-white/8 flex items-center gap-2 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  Teleport to 9×9 Workshop Pad
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSetSpawnHere();
                    setMenuOpen(false);
                  }}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[#38bdf8] hover:bg-white/8 flex items-center gap-2 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Set Personal Waypoint Here
                </button>

                {personalSpawn && (
                  <button
                    type="button"
                    onClick={() => {
                      onReturnToBaseSpawn();
                      setMenuOpen(false);
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[#10b981] hover:bg-white/8 flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Recall Waypoint ({Math.floor(personalSpawn.x)}, {Math.floor(personalSpawn.z)})
                  </button>
                )}
              </div>

              <div className="border-t border-white/10 pt-2 space-y-1">
                <button
                  type="button"
                  onClick={onToggleCamera}
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-[#e2e8f0] hover:bg-white/8 flex items-center justify-between cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-[#94a3b8]" />
                    Camera View
                  </span>
                  <span className="font-mono text-[11px] text-[#22d3ee]">
                    {cameraMode === 'first' ? '1st Person' : '3rd Person'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onToggleLowLagMode}
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-[#e2e8f0] hover:bg-white/8 flex items-center justify-between cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Gauge className="w-3.5 h-3.5 text-[#94a3b8]" />
                    Performance Mode
                  </span>
                  <span
                    className={`font-mono text-[11px] ${
                      lowLagMode ? 'text-[#10b981]' : 'text-[#94a3b8]'
                    }`}
                  >
                    {lowLagMode ? 'Low-Lag' : 'Standard'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onToggleMute}
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-[#e2e8f0] hover:bg-white/8 flex items-center justify-between cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    {muted ? (
                      <VolumeX className="w-3.5 h-3.5 text-[#94a3b8]" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-[#94a3b8]" />
                    )}
                    Audio
                  </span>
                  <span className="font-mono text-[11px] text-[#cbd5e1]">
                    {muted ? 'Muted' : 'On'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTouchControlsOverride((prev) =>
                      prev === null ? !showMobileControls : !prev
                    )
                  }
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-[#e2e8f0] hover:bg-white/8 flex items-center justify-between cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Gamepad2 className="w-3.5 h-3.5 text-[#94a3b8]" />
                    Touch Controls (Tablet/Mobile)
                  </span>
                  <span
                    className={`font-mono text-[11px] ${
                      showMobileControls ? 'text-[#10b981]' : 'text-[#94a3b8]'
                    }`}
                  >
                    {showMobileControls ? 'Enabled' : 'Hidden'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowControlsGuide((v) => !v);
                    setMenuOpen(false);
                  }}
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-[#e2e8f0] hover:bg-white/8 flex items-center gap-2 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#94a3b8]" />
                  Controls &amp; Shortcuts
                </button>

                <div className="pt-1 flex items-center justify-between gap-2">
                  <FullscreenToggleButton variant="hud" />
                  <button
                    type="button"
                    onClick={onSaveAndExit}
                    className="flex-1 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/12 hover:bg-[#ef4444]/22 px-3 py-1.5 text-xs font-semibold text-[#fca5a5] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Save &amp; Exit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible FTB Minimap */}
          {!effectiveHudMinimized &&
            !menuOpen &&
            (minimapMinimized ? (
              !isPortraitPhone && (
                <button
                  type="button"
                  onClick={() => setMinimapMinimized(false)}
                  className="hud-glass rounded-xl min-h-[34px] px-2.5 py-1 inline-flex items-center gap-1.5 text-xs text-[#cbd5e1] hover:text-white cursor-pointer"
                >
                  <MapIcon className="w-3.5 h-3.5 text-[#22d3ee]" />
                  Map
                </button>
              )
            ) : (
              <div className={isPortraitPhone ? 'self-end' : ''}>
                <VoxelMinimap
                  seed={world.seed}
                  playerX={playerPos.x}
                  playerZ={playerPos.z}
                  playerYaw={playerPos.yaw}
                  localUid={character.uid}
                  localDisplayName={character.characterName}
                  machines={world.machines}
                  claims={world.claims}
                  voxelDeltas={world.voxelDeltas}
                  remotePlayers={remotePlayers}
                  activeChunkKeys={activeChunkKeys}
                  exploredChunks={exploredChunks}
                  personalSpawn={personalSpawn}
                  onMinimize={() => setMinimapMinimized(true)}
                />
              </div>
            ))}
        </div>
      </div>

      {/* Optional Controls Guide Popover */}
      {showControlsGuide && (
        <div className="pointer-events-auto fixed left-1/2 top-20 sm:top-24 -translate-x-1/2 z-40 w-[92vw] max-w-md max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain touch-pan-y hud-glass rounded-xl p-4 text-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-display font-bold text-sm text-white">Controls &amp; Hotkeys</span>
            <button
              type="button"
              onClick={() => setShowControlsGuide(false)}
              className="p-1 text-[#94a3b8] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 font-mono text-[11px]">
            <span className="text-[#94a3b8]">Move / Jump</span>
            <span className="text-white">WASD · Space</span>
            <span className="text-[#94a3b8]">Mine / Place</span>
            <span className="text-white">L-Click · R-Click</span>
            <span className="text-[#94a3b8]">Placed Machines Drawer</span>
            <span className="text-[#38bdf8]">F</span>
            <span className="text-[#94a3b8]">FTB Quest Book</span>
            <span className="text-[#f59e0b]">Q</span>
            <span className="text-[#94a3b8]">Machine Console</span>
            <span className="text-white">Click Your Machine</span>
            <span className="text-[#94a3b8]">Wrench Dismantle</span>
            <span className="text-white">Shift + Click</span>
            <span className="text-[#94a3b8]">Crafting &amp; ME Grid</span>
            <span className="text-[#22d3ee]">G</span>
            <span className="text-[#94a3b8]">JEI Tech Guide</span>
            <span className="text-[#10b981]">J</span>
            <span className="text-[#94a3b8]">Eat Campfire Ration</span>
            <span className="text-[#6ee7b7]">E</span>
            <span className="text-[#94a3b8]">Co-op Multiplayer / Chat</span>
            <span className="text-[#34d399]">P · T</span>
            <span className="text-[#94a3b8]">3×3 Bore / Build Mode</span>
            <span className="text-[#a855f7]">M · V</span>
            <span className="text-[#94a3b8]">Backpack / Hide HUD</span>
            <span className="text-white">I · H</span>
          </div>
        </div>
      )}

      {/* Transient Toast Notification */}
      {toast && (
        <div className="fixed top-24 md:top-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none max-w-[92vw]">
          <div
            className={`hud-glass rounded-xl px-4 py-2 text-xs font-medium text-center ${
              toast.tone === 'claim_locked' || toast.tone === 'error'
                ? 'border-[#ef4444]/60 text-[#fca5a5]'
                : 'border-[#22d3ee]/50 text-[#e0f2fe]'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* LIVE CO-OP CHAT OVERLAY (Works on Desktop, Tablet & Mobile) */}
      {isMultiplayer && !effectiveHudMinimized && (
        <div
          className={`pointer-events-auto fixed z-20 flex flex-col gap-1.5 ${
            showMobileControls
              ? 'left-1/2 -translate-x-1/2 bottom-36 w-[88vw] max-w-xs'
              : 'left-4 bottom-24 w-72 sm:w-80'
          }`}
        >
          {visibleChatMessages.length > 0 && (!showMobileControls || chatOpen) && (
            <div
              ref={chatScrollRef}
              className={`rounded-xl px-3 py-2 space-y-1 text-xs overflow-y-auto transition-all ${
                chatOpen
                  ? 'hud-glass max-h-44'
                  : 'bg-[#0b0f18]/55 border border-white/5 max-h-24'
              }`}
            >
              {visibleChatMessages.map((m) => (
                <div key={m.id} className="leading-snug break-words">
                  {m.system ? (
                    <span className="text-[#94a3b8] italic">{m.text}</span>
                  ) : (
                    <>
                      <span className="font-semibold text-[#22d3ee]">{m.senderName}: </span>
                      <span className="text-[#f1f5f9]">{m.text}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {chatOpen ? (
            <form onSubmit={handleSubmitChat} className="hud-glass rounded-xl p-1.5 flex items-center gap-1.5">
              <input
                ref={chatInputRef}
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                maxLength={180}
                placeholder="Message factory teammates..."
                className="flex-1 bg-transparent px-2 py-1 text-xs text-white placeholder-[#64748b] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onShareLocationInChat();
                  setChatOpen(false);
                }}
                title="Share your coordinates in chat"
                className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#22d3ee] hover:bg-white/10 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
              </button>
              <button
                type="submit"
                aria-label="Send chat message"
                className="p-1.5 rounded-lg bg-[#22d3ee] text-[#06131a] hover:bg-[#38bdf8] cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            !showMobileControls && (
              <button
                type="button"
                onClick={() => {
                  setChatOpen(true);
                  window.setTimeout(() => chatInputRef.current?.focus(), 20);
                }}
                className="self-start hud-glass rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#cbd5e1] hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#22d3ee]" />
                Team Chat (T)
              </button>
            )
          )}
        </div>
      )}

      {/* BOTTOM AREA: Tablet & Mobile Touch Controls + Gadget Mode Bar + Upgraded 9-Slot Hotbar */}
      <div className={`w-full flex flex-col items-center ${isLandscapePhone ? 'gap-1' : 'gap-1.5'}`}>
        {showMobileControls && (
          <div
            className={`w-full flex items-end justify-between gap-2 px-0.5 sm:px-2 ${
              isLandscapePhone ? 'mb-0' : 'mb-0.5 sm:mb-1'
            }`}
          >
            {/* Left Analog Thumbstick */}
            <div className="pointer-events-auto flex flex-col items-start gap-1.5 shrink-0">
              <TouchJoystick
                onMove={onTouchMove}
                compact={isLandscapePhone}
                tablet={isTablet}
              />
            </div>

            {/* Right Ergonomic 6-Button Action Pad (Zero Overflow on 360px+ Portrait & Landscape Phones) */}
            <div className="pointer-events-auto grid grid-cols-3 gap-1 sm:gap-2 shrink-0">
              <button
                type="button"
                {...bindHoldRepeat(onTouchMine)}
                className={`hud-glass rounded-xl font-semibold text-[#22d3ee] active:scale-95 transition-transform select-none touch-manipulation inline-flex items-center justify-center gap-1 ${
                  isLandscapePhone
                    ? 'min-h-[38px] w-[58px] px-1 text-[10px]'
                    : isPortraitPhone
                      ? 'min-h-[42px] w-[62px] px-1 text-[10px]'
                      : 'min-h-[48px] min-w-[76px] sm:min-h-[52px] sm:min-w-[84px] px-2.5 text-xs'
                }`}
              >
                <Pickaxe className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>Mine</span>
              </button>

              <button
                type="button"
                {...bindHoldRepeat(onTouchAttack)}
                className={`hud-glass rounded-xl font-semibold active:scale-95 transition-transform select-none touch-manipulation inline-flex items-center justify-center gap-1 ${
                  hoverTarget?.kind === 'mob' || (world.mode === 'survival' && dayNight.isNight)
                    ? 'border-[#ef4444]/75 bg-[#ef4444]/20 text-[#fca5a5]'
                    : 'text-[#f87171]'
                } ${
                  isLandscapePhone
                    ? 'min-h-[38px] w-[58px] px-1 text-[10px]'
                    : isPortraitPhone
                      ? 'min-h-[42px] w-[62px] px-1 text-[10px]'
                      : 'min-h-[48px] min-w-[76px] sm:min-h-[52px] sm:min-w-[84px] px-2.5 text-xs'
                }`}
              >
                <Sword className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>{isCompactPhone ? 'Hit' : 'Attack'}</span>
              </button>

              <button
                type="button"
                {...bindInstantTap(onTouchPlace)}
                className={`hud-glass rounded-xl font-semibold text-[#10b981] active:scale-95 transition-transform select-none touch-manipulation inline-flex items-center justify-center gap-1 ${
                  isLandscapePhone
                    ? 'min-h-[38px] w-[58px] px-1 text-[10px]'
                    : isPortraitPhone
                      ? 'min-h-[42px] w-[62px] px-1 text-[10px]'
                      : 'min-h-[48px] min-w-[76px] sm:min-h-[52px] sm:min-w-[84px] px-2.5 text-xs'
                }`}
              >
                <span>Place</span>
              </button>

              <button
                type="button"
                {...bindInstantTap(onTouchInteract)}
                className={`hud-glass rounded-xl font-semibold text-[#f59e0b] active:scale-95 transition-transform select-none touch-manipulation inline-flex items-center justify-center gap-1 ${
                  isLandscapePhone
                    ? 'min-h-[38px] w-[58px] px-1 text-[10px]'
                    : isPortraitPhone
                      ? 'min-h-[42px] w-[62px] px-1 text-[10px]'
                      : 'min-h-[48px] min-w-[76px] sm:min-h-[52px] sm:min-w-[84px] px-2.5 text-xs'
                }`}
              >
                <span>
                  {touchCrouching
                    ? isCompactPhone
                      ? 'Break'
                      : 'Dismantle'
                    : isCompactPhone
                      ? 'Use'
                      : 'Console'}
                </span>
              </button>

              <button
                type="button"
                {...bindInstantTap(onToggleTouchCrouch)}
                title="Toggle Sneak & Wrench Dismantle Mode"
                className={`hud-glass rounded-xl font-semibold active:scale-95 transition-all select-none touch-manipulation inline-flex items-center justify-center gap-1 ${
                  touchCrouching
                    ? 'border-[#f59e0b] bg-[#f59e0b]/25 text-[#fde68a]'
                    : 'text-[#cbd5e1]'
                } ${
                  isLandscapePhone
                    ? 'min-h-[38px] w-[58px] px-1 text-[10px]'
                    : isPortraitPhone
                      ? 'min-h-[42px] w-[62px] px-1 text-[10px]'
                      : 'min-h-[48px] min-w-[76px] sm:min-h-[52px] sm:min-w-[84px] px-2.5 text-xs'
                }`}
              >
                <Wrench className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>{touchCrouching ? (isCompactPhone ? 'ON' : 'Wrench ON') : 'Wrench'}</span>
              </button>

              <button
                type="button"
                {...bindInstantTap(onTouchJump)}
                className={`hud-glass rounded-xl font-semibold text-white active:scale-95 transition-transform select-none touch-manipulation inline-flex items-center justify-center gap-1 ${
                  isLandscapePhone
                    ? 'min-h-[38px] w-[58px] px-1 text-[10px]'
                    : isPortraitPhone
                      ? 'min-h-[42px] w-[62px] px-1 text-[10px]'
                      : 'min-h-[48px] min-w-[76px] sm:min-h-[52px] sm:min-w-[84px] px-2.5 text-xs'
                }`}
              >
                <span>Jump</span>
              </button>
            </div>
          </div>
        )}

        {/* Ergonomic Gadget Mode Bar + Active Held Item Label */}
        {!effectiveHudMinimized && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 max-w-full">
            <button
              type="button"
              onClick={onCycleMiningGadgetMode}
              title={`Toggle ${pickMeta.name} Mode (M)`}
              className={`hud-glass rounded-lg px-2 sm:px-2.5 py-0.5 sm:py-1 min-h-[28px] sm:min-h-[32px] inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors ${
                miningMode === 'bore_3x3'
                  ? 'border-[#f59e0b]/70 text-[#fbbf24]'
                  : 'text-[#22d3ee] hover:border-[#22d3ee]/50'
              }`}
            >
              <Zap className="w-3 h-3" />
              {miningMode === 'bore_3x3' ? '3×3 Bore' : '1×1 Laser'}
              <span className="hidden sm:inline font-mono text-[10px] opacity-70">(M)</span>
            </button>

            <button
              type="button"
              onClick={onCycleBuildingGadgetMode}
              title="Cycle Building Gadget Template (V)"
              className={`hud-glass rounded-lg px-2 sm:px-2.5 py-0.5 sm:py-1 min-h-[28px] sm:min-h-[32px] inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors ${
                buildingMode !== 'single'
                  ? 'border-[#10b981]/70 text-[#34d399]'
                  : 'text-[#cbd5e1] hover:text-white'
              }`}
            >
              <Grid className="w-3 h-3" />
              Build: {BUILDING_MODE_LABELS[buildingMode]}
              <span className="hidden sm:inline font-mono text-[10px] opacity-70">(V)</span>
            </button>

            {isMultiplayer && showMobileControls && (
              <button
                type="button"
                onClick={() => {
                  setChatOpen((v) => !v);
                  window.setTimeout(() => chatInputRef.current?.focus(), 20);
                }}
                className="hud-glass rounded-lg px-2 sm:px-2.5 py-0.5 sm:py-1 min-h-[28px] sm:min-h-[32px] inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-[#22d3ee] cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                Chat
              </button>
            )}

            {selectedItemMeta && (
              <div className="hidden sm:inline-flex hud-glass rounded-lg px-2.5 py-1 min-h-[32px] items-center gap-1.5 text-[11px] text-[#e2e8f0]">
                <span
                  className="w-2.5 h-2.5 rounded-xs border border-white/30"
                  style={{ backgroundColor: selectedItemMeta.color }}
                />
                <span className="font-medium truncate max-w-[180px]">{selectedItemMeta.name}</span>
                <span className="font-mono text-[10px] text-[#94a3b8]">
                  {selectedItemMeta.modSuite}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Upgraded 9-Slot Hotbar (Fits all 9 slots simultaneously on narrow phones with zero clipping!) */}
        <div
          className={`pointer-events-auto hud-glass rounded-xl sm:rounded-2xl max-w-full ${
            isPortraitPhone
              ? 'w-full grid grid-cols-9 gap-0.5 p-1'
              : 'p-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x'
          }`}
        >
          {character.hotbar.map((itemId, index) => {
            const meta = itemId ? ITEMS[itemId] : null;
            const qty = itemId ? character.inventory[itemId] || 0 : 0;
            const active = character.selectedSlot === index;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onSelectSlot(index)}
                className={`relative flex flex-col items-center justify-center cursor-pointer ${
                  isPortraitPhone
                    ? 'w-full h-10 min-w-0'
                    : isLandscapePhone
                      ? 'w-10 h-10 shrink-0'
                      : 'w-11 h-11 sm:w-[52px] sm:h-[52px] shrink-0'
                } ${
                  active ? 'hud-slot-active -translate-y-0.5' : 'hud-slot hover:border-white/25'
                }`}
                title={meta ? `${meta.name} (${qty})` : `Empty Slot ${index + 1}`}
              >
                <span
                  className={`absolute left-1 sm:left-1.5 top-0.5 font-mono text-[8px] sm:text-[9px] leading-none ${
                    active ? 'text-[#22d3ee] font-bold' : 'text-[#64748b]'
                  }`}
                >
                  {index + 1}
                </span>
                {meta && (qty > 0 || world.mode === 'peaceful') ? (
                  <>
                    <span
                      className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-xs border border-black/40"
                      style={{
                        backgroundColor: meta.color,
                        boxShadow: `inset -3px -3px 0 ${meta.accentColor}`,
                      }}
                    />
                    <span className="hidden sm:block mt-0.5 text-[9px] text-[#e2e8f0] leading-none truncate max-w-[46px]">
                      {meta.shortName}
                    </span>
                    <span className="absolute right-0.5 sm:right-1 bottom-0.5 font-mono text-[8px] sm:text-[10px] leading-none font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] tabular-nums">
                      {world.mode === 'peaceful' && qty <= 0 ? '∞' : qty}
                    </span>
                  </>
                ) : (
                  <Pickaxe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#334155]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
