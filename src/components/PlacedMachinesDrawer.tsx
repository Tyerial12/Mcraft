import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  ExternalLink,
  Flame,
  Lock,
  Navigation,
  PackageCheck,
  Pause,
  Play,
  Power,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  AUGMENT_SPECS,
  CRAFT_RECIPES,
  FIREWOOD_SPLITTER_RECIPES,
  FTB_QUESTS,
  isMachinePlacedByPlayer,
  ITEMS,
  MACHINE_SPECS,
  SAG_MILL_RECIPES,
  SMELT_RECIPES,
} from '../data/catalog';
import {
  getMachineAugmentMultipliers,
  getMachineEffectiveFeStats,
  normalizeMachineKind,
} from '../engine/powerGrid';
import { findClaimAt, hasClaimPermission } from '../engine/claims';
import type {
  AugmentId,
  CharacterProfile,
  DayNightState,
  PlacedMachine,
  PowerGridSnapshot,
  ResourceItemId,
  WorldData,
} from '../types/game';

export type DrawerActiveSection = 'machines' | 'quests';

interface PlacedMachinesDrawerProps {
  variant: 'drawer' | 'modal_tab';
  isOpen?: boolean;
  activeSection?: DrawerActiveSection;
  onToggleOpen?: () => void;
  onChangeSection?: (section: DrawerActiveSection) => void;
  world: WorldData;
  character: CharacterProfile;
  grid: PowerGridSnapshot;
  dayNight: DayNightState;
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
  onOpenCraftingTerminal: () => void;
}

type MachineCategoryFilter = 'all' | 'power' | 'processing' | 'ae2' | 'attention';
type OwnershipScope = 'mine' | 'all_world';

const ALL_AUGMENT_IDS: AugmentId[] = [
  'aug_speed_flux',
  'aug_yield_sieve',
  'aug_fe_coil',
  'aug_me_bus',
];

function getMachineCategory(kind: PlacedMachine['kind']): 'power' | 'processing' | 'ae2' {
  const norm = normalizeMachineKind(kind);
  if (
    norm === 'firewood_boiler' ||
    norm === 'coal_generator' ||
    norm === 'firewood_splitter' ||
    norm === 'forestry_multifarm' ||
    norm === 'powah_reactor' ||
    norm === 'flux_battery' ||
    norm === 'solar_array' ||
    norm === 'battery_bank'
  ) {
    return 'power';
  }
  if (
    norm === 'me_controller' ||
    norm === 'storage_terminal' ||
    norm === 'molecular_assembler' ||
    norm === 'auto_crafter' ||
    norm === 'dire_automator' ||
    norm === 'claim_beacon'
  ) {
    return 'ae2';
  }
  return 'processing';
}

export const PlacedMachinesDrawer: React.FC<PlacedMachinesDrawerProps> = ({
  variant,
  isOpen = true,
  activeSection = 'machines',
  onToggleOpen,
  onChangeSection,
  world,
  character,
  grid,
  dayNight,
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
  onOpenCraftingTerminal,
}) => {
  const [ownershipScope, setOwnershipScope] = useState<OwnershipScope>('mine');
  const [categoryFilter, setCategoryFilter] = useState<MachineCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isCreative = world.mode === 'peaceful';
  const claimedSet = useMemo(
    () => new Set(character.claimedQuestIds || []),
    [character.claimedQuestIds]
  );

  const myMachines = useMemo(
    () =>
      world.machines.filter((m) =>
        isMachinePlacedByPlayer(m, character.uid, world.ownerId)
      ),
    [world.machines, character.uid, world.ownerId]
  );

  const teammateMachinesCount = Math.max(0, world.machines.length - myMachines.length);

  const readyHopperCount = useMemo(() => {
    let count = 0;
    for (const m of myMachines) {
      const items = Object.values(m.outputBuffer || {}).reduce((a, b) => a + (b || 0), 0);
      if (items > 0) count++;
    }
    return count;
  }, [myMachines]);

  const unclaimableOrReadyQuests = useMemo(() => {
    let claimable = 0;
    let completedTotal = 0;
    for (const q of FTB_QUESTS) {
      const done = q.isCompleted(character, world);
      const claimed = claimedSet.has(q.id);
      if (done || claimed) completedTotal++;
      if (done && !claimed) claimable++;
    }
    return { claimable, completedTotal };
  }, [character, world, claimedSet]);

  const getCombinedFuelOrAugmentCount = (itemId: ResourceItemId): number =>
    (character.inventory[itemId] || 0) + (world.storageInventory[itemId] || 0);

  const filteredMachines = useMemo(() => {
    const base = ownershipScope === 'mine' ? myMachines : world.machines;
    return base.filter((m) => {
      const norm = normalizeMachineKind(m.kind);
      const spec = MACHINE_SPECS[norm];
      const isPowered = Boolean(grid.machinePowered[m.id]);
      const hopperItems = Object.values(m.outputBuffer || {}).reduce(
        (a, b) => a + (b || 0),
        0
      );
      const needsFuel =
        (norm === 'firewood_boiler' || norm === 'coal_generator') &&
        m.coalFuelSeconds <= 0 &&
        m.coalBuffer <= 0;

      if (categoryFilter === 'power' && getMachineCategory(m.kind) !== 'power') return false;
      if (categoryFilter === 'processing' && getMachineCategory(m.kind) !== 'processing')
        return false;
      if (categoryFilter === 'ae2' && getMachineCategory(m.kind) !== 'ae2') return false;
      if (categoryFilter === 'attention') {
        if (isPowered && !needsFuel && hopperItems === 0 && m.enabled) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const coordStr = `${m.x},${m.y},${m.z}`;
        if (
          !spec.name.toLowerCase().includes(q) &&
          !spec.modSuite.toLowerCase().includes(q) &&
          !(m.ownerName || '').toLowerCase().includes(q) &&
          !coordStr.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [ownershipScope, myMachines, world.machines, categoryFilter, searchQuery, grid.machinePowered]);

  // Collapsed Floating Left Edge Tab (only when variant === 'drawer' and !isOpen)
  if (variant === 'drawer' && !isOpen) {
    return (
      <div className="pointer-events-auto flex flex-col gap-1.5 items-start">
        <button
          type="button"
          onClick={() => {
            onChangeSection?.('machines');
            onToggleOpen?.();
          }}
          title="Open Placed Machines Command Drawer (Hotkey: F)"
          className="hud-glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-semibold text-white hover:border-[#22d3ee]/60 transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#22d3ee]" />
          <span>My Machines ({myMachines.length})</span>
          {readyHopperCount > 0 && (
            <span className="font-mono text-[10px] text-[#10b981]">
              · {readyHopperCount} Hopper
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8]" />
        </button>

        <button
          type="button"
          onClick={() => {
            onChangeSection?.('quests');
            onToggleOpen?.();
          }}
          title="Open FTB Quest Book & Progression Guide (Hotkey: Q)"
          className="hud-glass rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-medium text-[#cbd5e1] hover:text-white hover:border-[#f59e0b]/60 transition-colors cursor-pointer"
        >
          <Award className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>
            FTB Quests ({unclaimableOrReadyQuests.completedTotal}/{FTB_QUESTS.length})
          </span>
          {unclaimableOrReadyQuests.claimable > 0 && (
            <span className="font-mono text-[10px] font-bold text-[#10b981]">
              · +{unclaimableOrReadyQuests.claimable} Claim!
            </span>
          )}
        </button>
      </div>
    );
  }

  const renderMachineCard = (machine: PlacedMachine) => {
    const isOwner = isMachinePlacedByPlayer(machine, character.uid, world.ownerId);
    const claimAtMachine = findClaimAt(world.claims, machine.x, machine.z);
    const hasTrustedToggle = claimAtMachine
      ? hasClaimPermission(
          claimAtMachine,
          { uid: character.uid, displayName: character.characterName },
          'toggleMachines'
        )
      : false;
    const canControlMachine = isOwner || hasTrustedToggle;
    const normKind = normalizeMachineKind(machine.kind);
    const spec = MACHINE_SPECS[normKind];
    const isPowered = Boolean(grid.machinePowered[machine.id]);
    const augStats = getMachineAugmentMultipliers(machine.augments);
    const feStats = getMachineEffectiveFeStats(machine, dayNight.solarEfficiency);
    const installedAugments = machine.augments || [];
    const hopperEntries = Object.entries(machine.outputBuffer || {}).filter(
      ([, q]) => (q || 0) > 0
    ) as [ResourceItemId, number][];
    const totalHopperCount = hopperEntries.reduce((a, [, q]) => a + q, 0);

    const isBoiler = normKind === 'firewood_boiler' || normKind === 'coal_generator';
    const isSolar = normKind === 'solar_array';
    const isReactor = normKind === 'powah_reactor';
    const isFuelMachine = isBoiler || isReactor;

    return (
      <div
        key={machine.id}
        className={`rounded-xl border p-3 space-y-2.5 text-xs transition-colors ${
          canControlMachine
            ? 'border-white/12 bg-[#121826]/95'
            : 'border-[#ef4444]/30 bg-[#14131c]/90'
        }`}
      >
        {/* Row 1: Title, Status, FE/t & Coordinates */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-xs border border-white/25 shrink-0"
                style={{ backgroundColor: ITEMS[normKind]?.color || '#22d3ee' }}
              />
              <span className="font-display font-bold text-white truncate">
                {spec.name}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-mono text-[#94a3b8] mt-0.5 tabular-nums">
              <span className="text-[#38bdf8]">{spec.modSuite}</span>
              <span aria-hidden="true">·</span>
              <span>
                ({machine.x}, {machine.y}, {machine.z})
              </span>
              <span aria-hidden="true">·</span>
              {isOwner ? (
                <span className="text-[#10b981]">Placed by You</span>
              ) : hasTrustedToggle ? (
                <span className="text-[#38bdf8]">Trusted Claim Access ({machine.ownerName})</span>
              ) : (
                <span className="text-[#fca5a5] inline-flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Placed by {machine.ownerName || 'Teammate'}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0 font-mono text-[11px] tabular-nums">
            <span
              className={`font-semibold ${
                !machine.enabled
                  ? 'text-[#94a3b8]'
                  : isPowered
                    ? 'text-[#10b981]'
                    : 'text-[#f87171]'
              }`}
            >
              {!machine.enabled ? 'PAUSED' : isPowered ? 'ONLINE' : 'NO FE'}
            </span>
            <span className="text-[#f59e0b]">
              {feStats.genFe > 0
                ? `+${feStats.genFe} FE/t`
                : feStats.demandFe > 0
                  ? `-${feStats.demandFe} FE/t`
                  : '0 FE/t'}
            </span>
          </div>
        </div>

        {/* Cycle Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#94a3b8] tabular-nums">
            <span>
              Cycle {Math.round(machine.progress)}% · {Math.round(augStats.speedMult * 100)}% Spd
              {augStats.yieldBonus > 0 ? ` · +${augStats.yieldBonus} Yield` : ''}
            </span>
            {isFuelMachine && (
              <span className="text-[#fbbf24]">
                Burn {Math.ceil(machine.coalFuelSeconds)}s · Queued {machine.coalBuffer}
                {isBoiler && dayNight.weather.kind !== 'clear'
                  ? ` · ${dayNight.weather.boilerFuelBurnMultiplier.toFixed(2)}× ${dayNight.weather.shortLabel}`
                  : ''}
              </span>
            )}
            {isSolar && (
              <span
                className={
                  dayNight.weather.kind === 'clear' && !dayNight.isNight
                    ? 'text-[#38bdf8]'
                    : 'text-[#fbbf24]'
                }
              >
                Solar {Math.round(dayNight.solarEfficiency * 100)}% ({dayNight.weather.shortLabel})
              </span>
            )}
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                isPowered ? 'bg-[#22d3ee]' : 'bg-[#64748b]'
              }`}
              style={{ width: `${Math.min(100, machine.progress)}%` }}
            />
          </div>
        </div>

        {/* Owner or Trusted Friend (with Toggle Machines permission) Interactive Controls */}
        {canControlMachine ? (
          <>
            {/* Recipe Selector for Processing / Crafting Machines */}
            {(normKind === 'firewood_splitter' ||
              normKind === 'sag_mill' ||
              normKind === 'alloy_smelter' ||
              normKind === 'electric_smelter' ||
              normKind === 'molecular_assembler' ||
              normKind === 'auto_crafter') && (
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-[#94a3b8]">
                  Active Machine Recipe
                </label>
                <select
                  value={machine.selectedRecipeId || ''}
                  onChange={(e) =>
                    onUpdateMachine({
                      ...machine,
                      selectedRecipeId: e.target.value || null,
                      progress: 0,
                    })
                  }
                  className="w-full rounded-lg border border-white/12 bg-[#0b0f17] px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-[#22d3ee]"
                >
                  {normKind === 'firewood_splitter' &&
                    FIREWOOD_SPLITTER_RECIPES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  {normKind === 'sag_mill' &&
                    SAG_MILL_RECIPES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (→ {r.outputQty + augStats.yieldBonus}×)
                      </option>
                    ))}
                  {(normKind === 'alloy_smelter' || normKind === 'electric_smelter') &&
                    SMELT_RECIPES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  {(normKind === 'molecular_assembler' || normKind === 'auto_crafter') &&
                    CRAFT_RECIPES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Remote Fuel Loader for Firewood Boiler & Powah! Reactor */}
            {isFuelMachine && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  disabled={!isCreative && getCombinedFuelOrAugmentCount('firewood_bundle') <= 0}
                  onClick={() => onFeedFuel(machine.id, 'firewood_bundle', 1)}
                  className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 disabled:opacity-35 px-2 py-1 text-[11px] font-semibold text-[#fbbf24] cursor-pointer"
                >
                  +1 Firewood ({getCombinedFuelOrAugmentCount('firewood_bundle')})
                </button>
                <button
                  type="button"
                  disabled={!isCreative && getCombinedFuelOrAugmentCount('firewood_bundle') <= 0}
                  onClick={() => onFeedFuel(machine.id, 'firewood_bundle', 5)}
                  className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 disabled:opacity-35 px-2 py-1 text-[11px] font-semibold text-[#fbbf24] cursor-pointer"
                >
                  +5 Firewood
                </button>
                <button
                  type="button"
                  disabled={!isCreative && getCombinedFuelOrAugmentCount('coal') <= 0}
                  onClick={() => onFeedFuel(machine.id, 'coal', 4)}
                  className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-35 px-2 py-1 text-[11px] text-[#cbd5e1] cursor-pointer"
                >
                  +4 Coal ({getCombinedFuelOrAugmentCount('coal')})
                </button>
                {isReactor && (
                  <button
                    type="button"
                    disabled={!isCreative && getCombinedFuelOrAugmentCount('blazegold_ingot') <= 0}
                    onClick={() => onFeedFuel(machine.id, 'blazegold_ingot', 1)}
                    className="rounded-lg border border-[#ea580c]/50 bg-[#ea580c]/15 hover:bg-[#ea580c]/25 disabled:opacity-35 px-2 py-1 text-[11px] font-semibold text-[#fdba74] cursor-pointer"
                  >
                    +1 Blazegold ({getCombinedFuelOrAugmentCount('blazegold_ingot')})
                  </button>
                )}
              </div>
            )}

            {/* Inline 3-Slot Machine Augment Addon Rack */}
            <div className="space-y-1.5 pt-1 border-t border-white/8">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#94a3b8]">
                <span className="inline-flex items-center gap-1 text-[#cbd5e1]">
                  <Sparkles className="w-3 h-3 text-[#f59e0b]" />
                  Augment Slots ({installedAugments.length}/3)
                </span>
                <span>Click installed to eject</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((slotIdx) => {
                  const augId = installedAugments[slotIdx];
                  const augSpec = augId ? AUGMENT_SPECS[augId] : null;
                  return augSpec ? (
                    <button
                      key={slotIdx}
                      type="button"
                      onClick={() => onRemoveAugment(machine.id, slotIdx)}
                      title={`Eject ${augSpec.name} to Backpack`}
                      className="rounded-lg border border-[#38bdf8]/50 bg-[#172234] hover:border-[#ef4444] px-2 py-1 text-left flex items-center justify-between gap-1 cursor-pointer"
                    >
                      <span className="font-mono text-[10px] text-[#e0f2fe] truncate">
                        {augSpec.shortName}
                      </span>
                      <span className="text-[10px] text-[#94a3b8]">×</span>
                    </button>
                  ) : (
                    <div
                      key={slotIdx}
                      className="rounded-lg border border-dashed border-white/12 bg-[#0b0f17]/70 px-2 py-1 text-center font-mono text-[10px] text-[#475569]"
                    >
                      Empty #{slotIdx + 1}
                    </div>
                  );
                })}
              </div>

              {installedAugments.length < 3 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {ALL_AUGMENT_IDS.map((augId) => {
                    const aug = AUGMENT_SPECS[augId];
                    const owned = getCombinedFuelOrAugmentCount(augId);
                    const canInstall = isCreative || owned > 0;
                    return (
                      <button
                        key={augId}
                        type="button"
                        disabled={!canInstall}
                        onClick={() => onInstallAugment(machine.id, augId)}
                        title={`Install ${aug.name} (${aug.effectSummary})`}
                        className="rounded-md border border-white/12 bg-white/5 hover:border-[#22d3ee] disabled:opacity-30 px-1.5 py-0.5 font-mono text-[10px] text-[#cbd5e1] cursor-pointer"
                      >
                        +{aug.shortName} ({isCreative ? '∞' : owned})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hopper Output Bar (if items waiting) */}
            {totalHopperCount > 0 && (
              <div className="rounded-lg border border-[#10b981]/40 bg-[#10b981]/10 px-2.5 py-1.5 flex items-center justify-between gap-2">
                <div className="text-[11px] font-mono text-[#a7f3d0] truncate">
                  Hopper:{' '}
                  {hopperEntries
                    .map(([id, q]) => `${q}× ${ITEMS[id]?.shortName || id}`)
                    .join(', ')}
                </div>
                <button
                  type="button"
                  onClick={() => onCollectHopper(machine.id)}
                  className="rounded-md bg-[#10b981] hover:bg-[#34d399] px-2 py-1 text-[10px] font-bold text-[#06130e] inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <PackageCheck className="w-3 h-3" />
                  Collect
                </button>
              </div>
            )}

            {/* Action Footer: Power Toggle, Open Console, Teleport, Dismantle */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-white/8">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateMachine({ ...machine, enabled: !machine.enabled })}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                    machine.enabled
                      ? 'bg-[#10b981]/18 text-[#34d399] border border-[#10b981]/40'
                      : 'bg-white/6 text-[#94a3b8] border border-white/12'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  {machine.enabled ? 'Enabled' : 'Paused'}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenMachineConsole(machine.id)}
                  className="rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] text-[#e2e8f0] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3 text-[#22d3ee]" />
                  Console
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onTeleportToMachine(machine)}
                  title="Teleport Beside This Machine"
                  className="rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 px-2 py-1 text-[11px] text-[#38bdf8] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Navigation className="w-3 h-3" />
                  TP
                </button>

                <button
                  type="button"
                  onClick={() => onDismantleMachine(machine.id)}
                  title="Remote Wrench Dismantle (Returns Machine & Augments to Backpack)"
                  className="rounded-lg border border-[#ef4444]/35 bg-[#ef4444]/10 hover:bg-[#ef4444]/22 px-2 py-1 text-[11px] text-[#fca5a5] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Wrench
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Read-Only Footer for Teammate Machines */
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/8 text-[11px] text-[#94a3b8]">
            <span className="inline-flex items-center gap-1 text-[#fca5a5]">
              <Lock className="w-3 h-3" />
              Only {machine.ownerName || 'the player who placed this'} can control it
            </span>
            <button
              type="button"
              onClick={() => onTeleportToMachine(machine)}
              className="rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] text-[#38bdf8] inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Navigation className="w-3 h-3" />
              TP
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderQuestsView = () => (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#f59e0b]/35 bg-[#131926] p-3 space-y-1 text-xs">
        <div className="font-display font-bold text-[#fbbf24] flex items-center justify-between">
          <span>FTB DireCraft Survival &amp; Tech Progression</span>
          <span className="font-mono text-[11px] text-[#10b981]">
            {unclaimableOrReadyQuests.completedTotal}/{FTB_QUESTS.length} Completed
          </span>
        </div>
        <p className="text-[11px] text-[#94a3b8] leading-relaxed">
          Walk around the 3D world to chop trees, quarry cobblestone, mine coal and ores, upgrade
          your pickaxe tier, and craft each machine from scratch.
        </p>
      </div>

      <div className="space-y-2.5">
        {FTB_QUESTS.map((quest) => {
          const completed = quest.isCompleted(character, world);
          const claimed = claimedSet.has(quest.id);
          return (
            <div
              key={quest.id}
              className={`rounded-xl border p-3 space-y-2 text-xs ${
                claimed
                  ? 'border-[#10b981]/30 bg-[#0f1918]/80'
                  : completed
                    ? 'border-[#22d3ee]/60 bg-[#122030]'
                    : 'border-white/10 bg-[#121826]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display font-bold text-white flex items-center gap-1.5">
                    {claimed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
                    ) : (
                      <Award className="w-4 h-4 text-[#f59e0b] shrink-0" />
                    )}
                    <span>{quest.title}</span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#22d3ee] mt-0.5">
                    {quest.objectiveSummary}
                  </div>
                </div>

                {claimed ? (
                  <span className="font-mono text-[10px] text-[#10b981] shrink-0">CLAIMED</span>
                ) : completed ? (
                  <button
                    type="button"
                    onClick={() => onClaimQuestReward(quest.id)}
                    className="rounded-lg bg-[#10b981] hover:bg-[#34d399] px-3 py-1.5 text-[11px] font-bold text-[#06130e] cursor-pointer shrink-0"
                  >
                    Claim Reward
                  </button>
                ) : (
                  <span className="font-mono text-[10px] text-[#94a3b8] shrink-0">
                    Age {quest.age}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[#94a3b8] leading-relaxed">{quest.guideHint}</p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 border-t border-white/8 font-mono text-[10px] text-[#cbd5e1]">
                <span className="text-[#fbbf24]">+{quest.rewardCredits}c</span>
                <span>·</span>
                <span className="text-[#38bdf8]">+{quest.rewardXp} XP</span>
                {quest.rewardItems.map((ri) => (
                  <React.Fragment key={ri.itemId}>
                    <span>·</span>
                    <span className="text-[#10b981]">
                      +{ri.qty}× {ITEMS[ri.itemId]?.shortName || ri.itemId}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMachinesControlContent = () => (
    <div className="space-y-3">
      {/* Owner-Scoped Batch Factory Actions */}
      <div className="rounded-xl border border-white/10 bg-[#121826] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-white">
            My Placed Machines ({myMachines.length})
          </span>
          {teammateMachinesCount > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOwnershipScope('mine')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium cursor-pointer ${
                  ownershipScope === 'mine'
                    ? 'bg-[#22d3ee]/20 text-[#22d3ee]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                Mine ({myMachines.length})
              </button>
              <button
                type="button"
                onClick={() => setOwnershipScope('all_world')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium cursor-pointer ${
                  ownershipScope === 'all_world'
                    ? 'bg-[#22d3ee]/20 text-[#22d3ee]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                All ({world.machines.length})
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <button
            type="button"
            disabled={myMachines.length === 0}
            onClick={onBatchFuelMyMachines}
            className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/12 hover:bg-[#f59e0b]/22 disabled:opacity-35 px-2 py-1.5 text-[11px] font-semibold text-[#fbbf24] inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Flame className="w-3 h-3" />
            Fuel Boilers
          </button>

          <button
            type="button"
            disabled={readyHopperCount === 0}
            onClick={onBatchCollectMyHoppers}
            className="rounded-lg border border-[#10b981]/40 bg-[#10b981]/14 hover:bg-[#10b981]/24 disabled:opacity-35 px-2 py-1.5 text-[11px] font-semibold text-[#34d399] inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <PackageCheck className="w-3 h-3" />
            Hoppers ({readyHopperCount})
          </button>

          <button
            type="button"
            disabled={myMachines.length === 0}
            onClick={() => onBatchToggleMyMachines(true)}
            className="rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 disabled:opacity-35 px-2 py-1.5 text-[11px] font-medium text-[#e2e8f0] inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3 h-3 text-[#10b981]" />
            Run Mine
          </button>

          <button
            type="button"
            disabled={myMachines.length === 0}
            onClick={() => onBatchToggleMyMachines(false)}
            className="rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 disabled:opacity-35 px-2 py-1.5 text-[11px] font-medium text-[#e2e8f0] inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Pause className="w-3 h-3 text-[#f59e0b]" />
            Pause Mine
          </button>
        </div>
      </div>

      {/* Category Filter Pills & Search */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(
            [
              ['all', 'All'],
              ['power', 'Power & Firewood'],
              ['processing', 'Ore & Smelt'],
              ['ae2', 'AE2 & Auto'],
              ['attention', 'Alerts'],
            ] as [MachineCategoryFilter, string][]
          ).map(([cat, label]) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                categoryFilter === cat
                  ? 'bg-[#22d3ee]/20 text-[#22d3ee]'
                  : 'bg-white/5 text-[#94a3b8] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {world.machines.length > 3 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter machines by name, mod, or (x,y,z)..."
              className="w-full rounded-lg border border-white/12 bg-[#0b0f17] pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#22d3ee]"
            />
          </div>
        )}
      </div>

      {/* Placed Machine List or Survival Gathering Empty State */}
      {myMachines.length === 0 && ownershipScope === 'mine' ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#111723] p-4 text-center space-y-2.5 text-xs">
          <div className="font-display font-bold text-sm text-white">
            No Machines Placed Yet — Gather &amp; Craft!
          </div>
          <p className="text-[11px] text-[#94a3b8] leading-relaxed">
            Walk out into the 3D world to chop <strong>Timber Logs</strong> and mine{' '}
            <strong>Cobblestone &amp; Coal</strong>. Craft a <strong>Stone Pickaxe</strong> to mine
            Copper &amp; Iron, hand-smelt ingots, and craft your first{' '}
            <strong>Firewood Splitter &amp; Boiler</strong>!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenCraftingTerminal}
              className="rounded-lg bg-[#22d3ee] hover:bg-[#38bdf8] px-3 py-1.5 text-xs font-bold text-[#06131a] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              Open Crafting &amp; Hand-Smelting (G)
            </button>
            {variant === 'drawer' && onChangeSection && (
              <button
                type="button"
                onClick={() => onChangeSection('quests')}
                className="rounded-lg border border-[#f59e0b]/50 bg-[#f59e0b]/12 hover:bg-[#f59e0b]/22 px-3 py-1.5 text-xs font-semibold text-[#fbbf24] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                View FTB Quests
              </button>
            )}
          </div>
        </div>
      ) : filteredMachines.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#111723] p-4 text-center text-xs text-[#94a3b8]">
          No placed machines match the current filter.
        </div>
      ) : (
        <div
          className={
            variant === 'modal_tab'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
              : 'space-y-2.5'
          }
        >
          {filteredMachines.map((m) => renderMachineCard(m))}
        </div>
      )}
    </div>
  );

  // Full-width Modal Tab mode inside ShopModal
  if (variant === 'modal_tab') {
    return (
      <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-4">
        {renderMachinesControlContent()}
      </div>
    );
  }

  // Always-On Collapsible Side Drawer on the 3D Gameplay Screen
  return (
    <div className="pointer-events-auto w-full sm:w-[375px] max-w-full sm:max-w-[385px] hud-glass rounded-xl flex flex-col overflow-hidden max-h-[40dvh] sm:max-h-[52dvh] lg:max-h-[calc(100dvh-14rem)]">
      {/* Drawer Header with Section Tabs (My Machines vs FTB Quests) */}
      <div className="shrink-0 flex items-center justify-between gap-1 border-b border-white/10 px-2 sm:px-2.5 py-1.5 sm:py-2 bg-[#0d121c]/90">
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => onChangeSection?.('machines')}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'machines'
                ? 'bg-[#22d3ee]/20 text-[#22d3ee]'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Machines ({myMachines.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSection?.('quests')}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'quests'
                ? 'bg-[#f59e0b]/20 text-[#fbbf24]'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>
              Quests ({unclaimableOrReadyQuests.completedTotal}/{FTB_QUESTS.length})
            </span>
            {unclaimableOrReadyQuests.claimable > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleOpen}
          title="Collapse Drawer (Hotkey: F)"
          aria-label="Collapse Machine Control Drawer"
          className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Drawer Body */}
      <div className="flex-1 min-h-0 p-2.5 sm:p-3 overflow-y-auto overscroll-contain touch-pan-y">
        {activeSection === 'quests' ? renderQuestsView() : renderMachinesControlContent()}
      </div>
    </div>
  );
};
