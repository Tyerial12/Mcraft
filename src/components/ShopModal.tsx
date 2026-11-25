import React, { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Coins,
  Cpu,
  Flame,
  Hammer,
  Layers,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  AUGMENT_SPECS,
  CRAFT_RECIPES,
  isMachinePlacedByPlayer,
  ITEMS,
  MACHINE_SPECS,
  PICKAXE_TIERS,
} from '../data/catalog';
import { PlacedMachinesDrawer } from './PlacedMachinesDrawer';
import type {
  AugmentId,
  BuildingGadgetMode,
  CharacterProfile,
  DayNightState,
  MachineKind,
  MiningGadgetMode,
  PickaxeTier,
  PlacedMachine,
  PowerGridSnapshot,
  ResourceItemId,
  WorldData,
  WorldMode,
} from '../types/game';

export type ShopModalTab =
  | 'me_terminal'
  | 'placed_machines'
  | 'jei_chains'
  | 'machines_augments'
  | 'gadgets';

interface ShopModalProps {
  character: CharacterProfile;
  world: WorldData;
  grid: PowerGridSnapshot;
  dayNight: DayNightState;
  worldMode: WorldMode;
  storageInventory: Partial<Record<ResourceItemId, number>>;
  initialTab?: ShopModalTab;
  onClose: () => void;
  onSellItem: (itemId: ResourceItemId, qty: number) => void;
  onBuyItem: (itemId: ResourceItemId, qty: number) => void;
  onBuyPickaxe: (tier: PickaxeTier) => void;
  onCraftPickaxe: (tier: PickaxeTier) => void;
  onCraftRecipe: (recipeId: string) => void;
  onWirelessMeTransfer: (itemId: ResourceItemId, deltaToStorage: number) => void;
  onDepositAllToMe: () => void;
  onSetMiningGadgetMode: (mode: MiningGadgetMode) => void;
  onSetBuildingGadgetMode: (mode: BuildingGadgetMode) => void;
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
}

const FTB_MACHINE_SHOWCASE: MachineKind[] = [
  'firewood_splitter',
  'firewood_boiler',
  'solar_array',
  'forestry_multifarm',
  'sag_mill',
  'alloy_smelter',
  'digital_miner',
  'me_controller',
  'molecular_assembler',
  'powah_reactor',
  'flux_battery',
  'dire_automator',
];

export const ShopModal: React.FC<ShopModalProps> = ({
  character,
  world,
  grid,
  dayNight,
  worldMode,
  storageInventory,
  initialTab = 'me_terminal',
  onClose,
  onSellItem,
  onBuyItem,
  onBuyPickaxe,
  onCraftPickaxe,
  onCraftRecipe,
  onWirelessMeTransfer,
  onDepositAllToMe,
  onSetMiningGadgetMode,
  onSetBuildingGadgetMode,
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
}) => {
  const [tab, setTab] = useState<ShopModalTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  const isCreative = worldMode === 'peaceful';
  const currentMiningMode: MiningGadgetMode = character.miningGadgetMode || 'single_1x1';
  const currentBuildingMode: BuildingGadgetMode = character.buildingGadgetMode || 'single';

  const myPlacedCount = world.machines.filter((m) =>
    isMachinePlacedByPlayer(m, character.uid, world.ownerId)
  ).length;

  const getCombinedCount = (itemId: ResourceItemId): number =>
    (character.inventory[itemId] || 0) + (storageInventory[itemId] || 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-xs p-1.5 sm:p-4 safe-pt safe-pb safe-pl safe-pr">
      <div className="mc-panel w-full max-w-4xl max-h-[94dvh] sm:max-h-[92dvh] flex flex-col overflow-hidden text-[#f3f5f8]">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-white/10 px-3 sm:px-5 py-2.5 sm:py-4 bg-[#0d121c]">
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-lg font-bold text-white truncate">
              <span className="sm:hidden">ME Grid &amp; Tech Shop</span>
              <span className="hidden sm:inline">Wireless AE2 ME Grid &amp; JEI Tech Browser</span>
            </h2>
            <div className="hidden sm:flex flex-wrap items-center gap-2 text-xs text-[#94a3b8] mt-0.5">
              <span>FTB Direwolf20 Tech Suite</span>
              {isCreative && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#10b981]">Creative Sandbox (Free Requisition)</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="font-mono text-xs text-[#f59e0b] inline-flex items-center gap-1 sm:gap-1.5 tabular-nums">
              <Coins className="w-3.5 h-3.5" />
              {character.credits.toLocaleString()}
              <span className="hidden sm:inline"> Credits</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Terminal"
              className="p-1.5 sm:p-2 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 5 Navigation Tabs (Including Placed Machines Control Tab!) */}
        <div className="shrink-0 flex overflow-x-auto no-scrollbar border-b border-[#2b3340] bg-[#141922]">
          <button
            type="button"
            onClick={() => setTab('me_terminal')}
            className={`shrink-0 sm:flex-1 py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'me_terminal'
                ? 'bg-[#1c2330] text-[#22d3ee] border-b-2 border-[#22d3ee]'
                : 'text-[#8d9cb0] hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">ME &amp; Craft</span>
            <span className="hidden sm:inline">Crafting &amp; ME Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('placed_machines')}
            className={`shrink-0 sm:flex-1 py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'placed_machines'
                ? 'bg-[#1c2330] text-[#38bdf8] border-b-2 border-[#38bdf8]'
                : 'text-[#8d9cb0] hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Machines ({myPlacedCount})</span>
            <span className="hidden sm:inline">My Placed Machines ({myPlacedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('jei_chains')}
            className={`shrink-0 sm:flex-1 py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'jei_chains'
                ? 'bg-[#1c2330] text-[#10b981] border-b-2 border-[#10b981]'
                : 'text-[#8d9cb0] hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Chains</span>
            <span className="hidden sm:inline">JEI Tech Chains</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('machines_augments')}
            className={`shrink-0 sm:flex-1 py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'machines_augments'
                ? 'bg-[#1c2330] text-[#f59e0b] border-b-2 border-[#f59e0b]'
                : 'text-[#8d9cb0] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Shop</span>
            <span className="hidden sm:inline">Machines &amp; Augments</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('gadgets')}
            className={`shrink-0 sm:flex-1 py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'gadgets'
                ? 'bg-[#1c2330] text-[#a855f7] border-b-2 border-[#a855f7]'
                : 'text-[#8d9cb0] hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Gadgets</span>
            <span className="hidden sm:inline">Pickaxes &amp; Gadgets</span>
          </button>
        </div>

        {/* TAB: PLACED MACHINES COMMAND CENTER */}
        {tab === 'placed_machines' && (
          <PlacedMachinesDrawer
            variant="modal_tab"
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
            onOpenMachineConsole={(machineId) => {
              onClose();
              onOpenMachineConsole(machineId);
            }}
            onTeleportToMachine={(m) => {
              onTeleportToMachine(m);
              onClose();
            }}
            onBatchFuelMyMachines={onBatchFuelMyMachines}
            onBatchCollectMyHoppers={onBatchCollectMyHoppers}
            onBatchToggleMyMachines={onBatchToggleMyMachines}
            onClaimQuestReward={onClaimQuestReward}
            onOpenCraftingTerminal={() => setTab('me_terminal')}
          />
        )}

        {/* TAB 1: WIRELESS AE2 ME CRAFTING TERMINAL */}
        {tab === 'me_terminal' && (
          <div className="flex-1 min-h-0 p-3 sm:p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Wireless ME Network Digital Storage */}
              <div className="bg-[#121722] border border-[#2b3340] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#22d3ee] inline-flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" />
                    AE2 / Refined Storage Digital Drive
                  </span>
                  <button
                    type="button"
                    onClick={onDepositAllToMe}
                    className="bg-[#06b6d4] px-2.5 py-1 text-[11px] font-semibold text-[#071318] cursor-pointer"
                  >
                    Deposit Ores, Clumps & Firewood
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter items in ME Drive or Backpack..."
                    className="w-full bg-[#0b0f17] border border-[#2b3340] pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#22d3ee]"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5">
                  {(Object.keys(ITEMS) as ResourceItemId[])
                    .filter((id) => {
                      const total = getCombinedCount(id);
                      if (total <= 0) return false;
                      if (!searchQuery.trim()) return true;
                      return (
                        ITEMS[id].name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        ITEMS[id].modSuite.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                    })
                    .map((itemId) => {
                      const meta = ITEMS[itemId];
                      const inBag = character.inventory[itemId] || 0;
                      const inMe = storageInventory[itemId] || 0;
                      return (
                        <div
                          key={itemId}
                          className="border border-[#263040] bg-[#161c27] p-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-4 h-4 shrink-0 border border-black/40"
                              style={{ backgroundColor: meta.color }}
                            />
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{meta.name}</div>
                              <div className="font-mono text-[10px] text-[#94a3b8]">
                                Bag: <strong className="text-white">{inBag}</strong> · ME Drive:{' '}
                                <strong className="text-[#22d3ee]">{inMe}</strong>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={inBag <= 0}
                              onClick={() => onWirelessMeTransfer(itemId, inBag)}
                              className="border border-[#334155] bg-[#1e2736] disabled:opacity-35 px-2 py-1 text-[10px] font-mono inline-flex items-center gap-0.5 cursor-pointer"
                              title="Send to ME Storage"
                            >
                              <ArrowDownToLine className="w-3 h-3 text-[#22d3ee]" />
                              To ME
                            </button>
                            <button
                              type="button"
                              disabled={inMe <= 0}
                              onClick={() => onWirelessMeTransfer(itemId, -Math.min(16, inMe))}
                              className="border border-[#334155] bg-[#1e2736] disabled:opacity-35 px-2 py-1 text-[10px] font-mono inline-flex items-center gap-0.5 cursor-pointer"
                              title="Pull to Backpack"
                            >
                              <ArrowUpFromLine className="w-3 h-3 text-[#10b981]" />
                              To Bag
                            </button>
                            <button
                              type="button"
                              disabled={inBag <= 0}
                              onClick={() => onSellItem(itemId, inBag)}
                              className="border border-[#f59e0b]/40 bg-[#f59e0b]/10 disabled:opacity-30 px-2 py-1 text-[10px] font-mono text-[#f59e0b] cursor-pointer"
                              title={`Export for +${inBag * meta.sellPrice} Credits`}
                            >
                              +{inBag * meta.sellPrice}c
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right Column: 1-Click ME Auto-Crafting Grid (Pulls from Backpack + ME Drive!) */}
              <div className="bg-[#121722] border border-[#2b3340] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#f59e0b] inline-flex items-center gap-1.5">
                    <Hammer className="w-4 h-4" />
                    ME Pattern Crafting (Uses Backpack + ME Drive Items)
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'primitive', label: 'Hand-Smelt & Survival' },
                    { id: 'forestry', label: 'Forestry & Firewood' },
                    { id: 'mekanism', label: 'Mekanism & EIO' },
                    { id: 'ae2', label: 'AE2 ME' },
                    { id: 'powah', label: 'Powah! FE' },
                    { id: 'augments', label: 'Augments' },
                    { id: 'building', label: 'Building' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCatFilter(c.id)}
                      className={`px-2 py-1 text-[10px] font-mono border cursor-pointer ${
                        catFilter === c.id
                          ? 'border-[#22d3ee] bg-[#22d3ee]/15 text-[#22d3ee]'
                          : 'border-[#2b3340] bg-[#161c27] text-[#94a3b8]'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5">
                  {CRAFT_RECIPES.filter((r) => catFilter === 'all' || r.category === catFilter).map(
                    (r) => {
                      const canAfford =
                        isCreative ||
                        r.inputs.every((inp) => getCombinedCount(inp.itemId) >= inp.qty);
                      const outMeta = ITEMS[r.outputId];
                      return (
                        <div
                          key={r.id}
                          className="border border-[#263040] bg-[#161c27] p-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-3.5 h-3.5 shrink-0 border border-black/40"
                                style={{ backgroundColor: outMeta.color }}
                              />
                              <span className="font-semibold truncate">{r.name}</span>
                              <span className="text-[10px] font-mono text-[#38bdf8]">
                                [{r.modSuite}]
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-[#94a3b8] mt-0.5 flex flex-wrap gap-x-2">
                              {r.inputs.map((inp) => {
                                const have = getCombinedCount(inp.itemId);
                                const ok = isCreative || have >= inp.qty;
                                return (
                                  <span
                                    key={inp.itemId}
                                    className={ok ? 'text-[#10b981]' : 'text-[#ef4444]'}
                                  >
                                    {inp.qty} {ITEMS[inp.itemId].shortName} ({have})
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onCraftRecipe(r.id)}
                            className="bg-[#10b981] disabled:opacity-35 px-3 py-1.5 text-xs font-semibold text-[#06130e] cursor-pointer shrink-0"
                          >
                            Craft ×{r.outputQty}
                          </button>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: JEI PROCESSING CHAINS (FIREWOOD POWER & 3x-5x ORE MULTIPLICATION) */}
        {tab === 'jei_chains' && (
          <div className="flex-1 min-h-0 p-3 sm:p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-4">
            {/* Chain 1: Forestry Arboretum & Firewood Boiler Power Chain */}
            <div className="bg-[#121722] border border-[#f59e0b]/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-[#f59e0b]">
                  <Flame className="w-4 h-4" />
                  <span>1. Forestry & Firewood Automated Boiler Power Chain (180–450 FE/t)</span>
                </div>
                <span className="text-[11px] font-mono text-[#10b981]">Self-Sustaining Loop</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-xs">
                <div className="border border-[#2b3340] bg-[#161c27] p-3">
                  <div className="font-bold text-[#10b981]">Forestry Multifarm</div>
                  <div className="text-[11px] text-[#94a3b8] mt-1">
                    Automatically grows & harvests <strong>Timber Logs</strong> + Saplings into ME Drive.
                  </div>
                </div>
                <div className="border border-[#2b3340] bg-[#161c27] p-3">
                  <div className="font-bold text-[#f59e0b]">Firewood Splitter</div>
                  <div className="text-[11px] text-[#94a3b8] mt-1">
                    Splits 1 Timber Log → <strong>4 to 7× Split Firewood Bundles</strong> + Sawdust.
                  </div>
                </div>
                <div className="border border-[#2b3340] bg-[#161c27] p-3">
                  <div className="font-bold text-[#ea580c]">Firewood Boiler</div>
                  <div className="text-[11px] text-[#94a3b8] mt-1">
                    Auto-pulls Split Firewood (45s burn each) to generate <strong>180–450 FE/t</strong>!
                  </div>
                </div>
                <div className="border border-[#2b3340] bg-[#161c27] p-3">
                  <div className="font-bold text-[#38bdf8]">Universal Conduits</div>
                  <div className="text-[11px] text-[#94a3b8] mt-1">
                    Routes Forge Energy (FE/t), Items, and AE2 ME Data between all machines in 1 block.
                  </div>
                </div>
              </div>
            </div>

            {/* Chain 2: Mekanism & Ender IO 3x-5x Ore Multiplication */}
            <div className="bg-[#121722] border border-[#10b981]/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-[#10b981]">
                  <Layers className="w-4 h-4" />
                  <span>2. Mekanism & Ender IO Multi-Step Ore Multiplication (2× to 5× Ingots per Ore)</span>
                </div>
                <span className="text-[11px] font-mono text-[#38bdf8]">Install Auxiliary Ore Sieves</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-xs">
                <div className="border border-[#2b3340] bg-[#161c27] p-3">
                  <div className="font-bold text-[#38bdf8]">Digital Miner</div>
                  <div className="text-[11px] text-[#94a3b8] mt-1">
                    Excavates deep Copper, Iron, Gold, Certus Quartz, and Osmium ores automatically.
                  </div>
                </div>
                <div className="border border-[#2b3340] bg-[#161c27] p-3">
                  <div className="font-bold text-[#10b981]">Ender IO SAG Mill</div>
                  <div className="text-[11px] text-[#94a3b8] mt-1">
                    Crushes 1 Raw Ore → <strong>2× Crushed Clumps</strong> (+1 per Sieve Augment up to 5×!).
                  </div>
                </div>
                <div className="border border-[#2b3340] bg-[#161c27] p-3">
                  <div className="font-bold text-[#f97316]">Alloy Smelter</div>
                  <div className="text-[11px] text-[#94a3b8] mt-1">
                    Smelts Crushed Clumps into Ingots, <strong>Steel, Energetic Alloy, Blazegold & Processors</strong>.
                  </div>
                </div>
                <div className="border border-[#2b3340] bg-[#161c27] p-3">
                  <div className="font-bold text-[#a855f7]">Molecular Assembler</div>
                  <div className="text-[11px] text-[#94a3b8] mt-1">
                    Uses AE2 ME Storage ingots to auto-craft Machine Augments, Reactors, and Conduits.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FTB MACHINES, CONDUITS & MACHINE AUGMENT ADDONS */}
        {tab === 'machines_augments' && (
          <div className="flex-1 min-h-0 p-3 sm:p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-5">
            {/* 4 Installable Machine Augment Addons */}
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#38bdf8]">
                Installable FTB Machine Augment Addons (Fit inside any Machine’s 3-Slot Rack)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.values(AUGMENT_SPECS).map((aug) => {
                  const owned = getCombinedCount(aug.id);
                  const canBuy = isCreative || character.credits >= aug.buyPrice;
                  return (
                    <div
                      key={aug.id}
                      className="border border-[#2b3340] bg-[#141922] p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 shrink-0 border border-black/40"
                            style={{ backgroundColor: aug.color }}
                          />
                          <span className="font-bold text-white truncate">{aug.name}</span>
                          <span className="font-mono text-[10px] text-[#10b981]">Owned: {owned}</span>
                        </div>
                        <div className="text-[11px] font-mono text-[#38bdf8] mt-0.5">
                          {aug.effectSummary}
                        </div>
                        <div className="text-[11px] text-[#94a3b8] mt-0.5">{aug.description}</div>
                      </div>
                      <button
                        type="button"
                        disabled={!canBuy}
                        onClick={() => onBuyItem(aug.id, 1)}
                        className="bg-[#f59e0b] disabled:opacity-35 px-3 py-1.5 text-xs font-semibold text-[#10141b] cursor-pointer shrink-0"
                      >
                        {isCreative ? '+1 Free' : `${aug.buyPrice}c`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 11 FTB Direwolf20 Machines + Universal Conduit */}
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#f59e0b]">
                FTB Direwolf20 Machines & Ender IO Universal Conduits (0 Coin Placement Fee!)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Universal Conduit Card */}
                <div className="border border-[#f59e0b]/50 bg-[#141922] p-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-[#f59e0b]">
                      Ender IO Universal Conduit (×8 Bundle)
                    </div>
                    <div className="text-[11px] text-[#94a3b8] mt-0.5">
                      Routes Forge Energy (FE/t), Items, and AE2 ME Channels in one voxel block.
                    </div>
                    <div className="text-[10px] font-mono text-[#10b981] mt-1">
                      Owned: {getCombinedCount('power_cable')}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!isCreative && character.credits < 120}
                    onClick={() => onBuyItem('power_cable', 8)}
                    className="bg-[#38bdf8] disabled:opacity-35 px-3 py-1.5 text-xs font-semibold text-[#061317] cursor-pointer shrink-0"
                  >
                    {isCreative ? '+8 Free' : '120c (×8)'}
                  </button>
                </div>

                {FTB_MACHINE_SHOWCASE.map((kind) => {
                  const spec = MACHINE_SPECS[kind];
                  const owned = getCombinedCount(kind);
                  const canBuy = isCreative || character.credits >= spec.buyPrice;
                  return (
                    <div
                      key={kind}
                      className="border border-[#2b3340] bg-[#141922] p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white truncate">{spec.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#1e2636] text-[#38bdf8]">
                            {spec.modSuite}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#94a3b8] mt-0.5">{spec.description}</div>
                        <div className="text-[10px] font-mono text-[#f59e0b] mt-1">
                          {spec.generationKw > 0
                            ? `Generates +${spec.generationKw} FE/t`
                            : spec.consumeKw > 0
                              ? `Draws -${spec.consumeKw} FE/t`
                              : `Stores ${spec.batteryCapacity.toLocaleString()} FE`}{' '}
                          · Owned: {owned}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canBuy}
                        onClick={() => onBuyItem(kind, 1)}
                        className="bg-[#f59e0b] disabled:opacity-35 px-3 py-1.5 text-xs font-semibold text-[#10141b] cursor-pointer shrink-0"
                      >
                        {isCreative ? '+1 Free' : `${spec.buyPrice}c`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DIREWOLF20 MINING GADGETS & BUILDING GADGETS */}
        {tab === 'gadgets' && (
          <div className="flex-1 min-h-0 p-3 sm:p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-4 sm:space-y-5">
            {/* Live Mode Switchers for Mining Gadget & Building Gadget */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#121722] border border-[#22d3ee]/40 p-3.5 space-y-2">
                <div className="text-xs font-bold text-[#22d3ee]">
                  Direwolf20 Mining Gadget Laser Mode (Hotkey: M)
                </div>
                <p className="text-[11px] text-[#94a3b8]">
                  Switch between precision single-block laser mining and 3×3 Tunnel Bore excavation.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onSetMiningGadgetMode('single_1x1')}
                    className={`flex-1 py-2 px-3 text-xs font-semibold border cursor-pointer ${
                      currentMiningMode === 'single_1x1'
                        ? 'border-[#22d3ee] bg-[#22d3ee]/20 text-white'
                        : 'border-[#2b3340] bg-[#161c27] text-[#94a3b8]'
                    }`}
                  >
                    1×1 Precision Laser
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetMiningGadgetMode('bore_3x3')}
                    className={`flex-1 py-2 px-3 text-xs font-semibold border cursor-pointer ${
                      currentMiningMode === 'bore_3x3'
                        ? 'border-[#f59e0b] bg-[#f59e0b]/20 text-[#f59e0b]'
                        : 'border-[#2b3340] bg-[#161c27] text-[#94a3b8]'
                    }`}
                  >
                    3×3 Tunnel Bore Laser
                  </button>
                </div>
              </div>

              <div className="bg-[#121722] border border-[#10b981]/40 p-3.5 space-y-2">
                <div className="text-xs font-bold text-[#10b981]">
                  Direwolf20 Building Gadget Template Mode (Hotkey: V)
                </div>
                <p className="text-[11px] text-[#94a3b8]">
                  Build iconic 9×9 factory rooms rapidly with multi-block floor, wall, and line placement.
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {(
                    [
                      { id: 'single', label: 'Single (1×1)' },
                      { id: 'floor_3x3', label: '3×3 Floor Pad' },
                      { id: 'wall_3x3', label: '3×3 Vertical Wall' },
                      { id: 'line_5', label: '5-Block Line' },
                    ] as { id: BuildingGadgetMode; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSetBuildingGadgetMode(m.id)}
                      className={`py-1.5 px-2 text-xs font-semibold border cursor-pointer ${
                        currentBuildingMode === m.id
                          ? 'border-[#10b981] bg-[#10b981]/20 text-white'
                          : 'border-[#2b3340] bg-[#161c27] text-[#94a3b8]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mining Pickaxe & Laser Hardware Tier Upgrades (Craft with Gathered Resources OR Credits!) */}
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#a855f7]">
                Minecraft Pickaxe &amp; Direwolf20 Mining Laser Progression (Craft from Resources or Coins)
              </h3>
              <div className="space-y-2">
                {PICKAXE_TIERS.map((p) => {
                  const active = character.pickaxeTier === p.tier;
                  const canCraftWithResources =
                    isCreative ||
                    (p.craftInputs &&
                      p.craftInputs.length > 0 &&
                      p.craftInputs.every((inp) => getCombinedCount(inp.itemId) >= inp.qty));
                  return (
                    <div
                      key={p.tier}
                      className={`border p-3 flex flex-wrap items-center justify-between gap-3 text-xs ${
                        active
                          ? 'border-[#10b981] bg-[#10b981]/10'
                          : 'border-[#2b3340] bg-[#141922]'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="font-bold text-white flex flex-wrap items-center gap-2">
                          <span>{p.name}</span>
                          <span className="text-[10px] font-mono text-[#38bdf8]">
                            Harvest Power {p.harvestPower} · {p.speedMultiplier}× Speed
                          </span>
                          {p.supports3x3Bore && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#f59e0b]/20 text-[#f59e0b]">
                              3×3 Bore Capable
                            </span>
                          )}
                        </div>
                        <div className="text-[#8d9cb0]">{p.description}</div>
                        {p.craftInputs && p.craftInputs.length > 0 && (
                          <div className="text-[10px] font-mono flex flex-wrap items-center gap-x-2">
                            <span className="text-[#94a3b8]">Craft Recipe:</span>
                            {p.craftInputs.map((inp) => {
                              const have = getCombinedCount(inp.itemId);
                              const ok = isCreative || have >= inp.qty;
                              return (
                                <span
                                  key={inp.itemId}
                                  className={ok ? 'text-[#10b981]' : 'text-[#ef4444]'}
                                >
                                  {inp.qty}× {ITEMS[inp.itemId]?.shortName || inp.itemId} ({have})
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {active ? (
                        <span className="font-mono text-[#10b981] font-semibold shrink-0">
                          Equipped
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          {p.craftInputs && p.craftInputs.length > 0 && (
                            <button
                              type="button"
                              disabled={!canCraftWithResources}
                              onClick={() => onCraftPickaxe(p.tier)}
                              className="bg-[#10b981] hover:bg-[#34d399] disabled:opacity-35 px-3 py-1.5 font-semibold text-[#06130e] cursor-pointer"
                            >
                              Craft Tool
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!isCreative && character.credits < p.buyPrice}
                            onClick={() => onBuyPickaxe(p.tier)}
                            className="bg-[#f59e0b] disabled:opacity-40 px-3 py-1.5 font-semibold text-[#10141b] cursor-pointer"
                          >
                            {isCreative ? 'Equip Free' : `${p.buyPrice}c`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
