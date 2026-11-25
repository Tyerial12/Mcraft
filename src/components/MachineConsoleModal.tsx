import React, { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CloudFog,
  CloudRain,
  Cpu,
  Flame,
  Layers,
  PackageCheck,
  Plus,
  Power,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  AUGMENT_SPECS,
  CRAFT_RECIPES,
  FIREWOOD_SPLITTER_RECIPES,
  ITEMS,
  MACHINE_SPECS,
  SAG_MILL_RECIPES,
  SMELT_RECIPES,
} from '../data/catalog';
import {
  COAL_BURN_SECONDS_PER_UNIT,
  getMachineAugmentMultipliers,
  getMachineEffectiveFeStats,
  normalizeMachineKind,
} from '../engine/powerGrid';
import type {
  AugmentId,
  CharacterProfile,
  DayNightState,
  PlacedMachine,
  PowerGridSnapshot,
  ResourceItemId,
} from '../types/game';

interface MachineConsoleModalProps {
  machine: PlacedMachine;
  grid: PowerGridSnapshot;
  dayNight: DayNightState;
  character: CharacterProfile;
  storageInventory: Partial<Record<ResourceItemId, number>>;
  onClose: () => void;
  onUpdateMachine: (updated: PlacedMachine) => void;
  onFeedFuel: (machineId: string, fuelItemId: ResourceItemId, qty: number) => void;
  onInstallAugment: (machineId: string, augmentId: AugmentId) => void;
  onRemoveAugment: (machineId: string, slotIndex: number) => void;
  onCollectHopper: (machineId: string) => void;
  onStorageTransfer: (machineId: string, itemId: ResourceItemId, deltaToStorage: number) => void;
  onDepositAllOres: (machineId: string) => void;
  onDismantleMachine: (machineId: string) => void;
}

const ALL_AUGMENT_IDS: AugmentId[] = [
  'aug_speed_flux',
  'aug_yield_sieve',
  'aug_fe_coil',
  'aug_me_bus',
];

export const MachineConsoleModal: React.FC<MachineConsoleModalProps> = ({
  machine,
  grid,
  dayNight,
  character,
  storageInventory,
  onClose,
  onUpdateMachine,
  onFeedFuel,
  onInstallAugment,
  onRemoveAugment,
  onCollectHopper,
  onStorageTransfer,
  onDepositAllOres,
  onDismantleMachine,
}) => {
  const [meSearch, setMeSearch] = useState('');
  const normKind = normalizeMachineKind(machine.kind);
  const spec = MACHINE_SPECS[normKind];
  const isPowered = Boolean(grid.machinePowered[machine.id]);
  const netId = grid.machineNetworkId[machine.id];
  const network = grid.networks.find((n) => n.id === netId);

  const augStats = getMachineAugmentMultipliers(machine.augments);
  const feStats = getMachineEffectiveFeStats(machine, dayNight.solarEfficiency);
  const installedAugments = machine.augments || [];
  const hasMeLink = Boolean(network?.hasMeController || augStats.hasMeBus);

  const hopperEntries = Object.entries(machine.outputBuffer || {}).filter(
    ([, qty]) => (qty || 0) > 0
  ) as [ResourceItemId, number][];

  const availableFirewood =
    (character.inventory.firewood_bundle || 0) + (storageInventory.firewood_bundle || 0);
  const availableCoal = (character.inventory.coal || 0) + (storageInventory.coal || 0);
  const availableBlazegold =
    (character.inventory.blazegold_ingot || 0) + (storageInventory.blazegold_ingot || 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-xs p-1.5 sm:p-4 safe-pt safe-pb safe-pl safe-pr">
      <div className="mc-panel w-full max-w-2xl max-h-[94dvh] sm:max-h-[92dvh] flex flex-col overflow-hidden text-[#f3f5f8]">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 sm:gap-3 border-b border-white/10 px-3 sm:px-5 py-2.5 sm:py-4 bg-[#0d121c]">
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-lg font-bold tracking-tight text-white truncate">
              {spec.name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs font-mono mt-0.5 tabular-nums">
              <span className="text-[#38bdf8]">{spec.modSuite}</span>
              <span aria-hidden="true" className="text-[#475569]">·</span>
              <span className={isPowered ? 'text-[#10b981]' : 'text-[#f87171]'}>
                {isPowered ? 'Online' : 'Standby / No FE'}
              </span>
              {hasMeLink && (
                <>
                  <span aria-hidden="true" className="text-[#475569]">·</span>
                  <span className="text-[#22d3ee]">ME Linked</span>
                </>
              )}
              <span aria-hidden="true" className="text-[#475569]">·</span>
              <span className="text-[#94a3b8]">
                ({machine.x}, {machine.y}, {machine.z})
              </span>
              {network && (
                <>
                  <span aria-hidden="true" className="text-[#475569]">·</span>
                  <span className="text-[#f59e0b]">
                    +{network.generationKw}/-{network.demandKw} FE/t
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Machine Console"
            className="p-1.5 sm:p-2 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/5 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto overscroll-contain touch-pan-y">
          {/* Power & Telemetry Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#10141b] border border-[#2a323f] p-3">
            <div>
              <div className="text-[10px] font-mono uppercase text-[#8d9cb0]">Machine State</div>
              <button
                type="button"
                onClick={() => onUpdateMachine({ ...machine, enabled: !machine.enabled })}
                className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border cursor-pointer ${
                  machine.enabled
                    ? 'border-[#10b981] bg-[#10b981]/15 text-[#10b981]'
                    : 'border-[#475569] bg-[#1e2631] text-[#94a3b8]'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {machine.enabled ? 'Enabled' : 'Paused'}
              </button>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase text-[#8d9cb0]">Forge Energy</div>
              <div className="mt-1 font-mono text-sm font-bold text-[#f59e0b]">
                {feStats.genFe > 0
                  ? `+${feStats.genFe} FE/t`
                  : feStats.demandFe > 0
                    ? `-${feStats.demandFe} FE/t`
                    : '0 FE/t'}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase text-[#8d9cb0]">Speed / Yield</div>
              <div className="mt-1 font-mono text-xs text-[#10b981]">
                {Math.round(augStats.speedMult * 100)}% Spd · +{augStats.yieldBonus} Bonus Yield
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase text-[#8d9cb0]">Cycle Progress</div>
              <div className="mt-1.5 w-full h-2.5 bg-[#1a202c] border border-[#2d3748]">
                <div
                  className="h-full bg-[#38bdf8] transition-all"
                  style={{ width: `${Math.min(100, machine.progress)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3-Slot FTB Machine Augment Addon Rack */}
          <div className="bg-[#121721] border border-[#2c3646] p-3 sm:p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f3f5f8]">
                <Sparkles className="w-4 h-4 text-[#f59e0b] shrink-0" />
                <span>Machine Augment Rack ({installedAugments.length}/3)</span>
              </div>
              <span className="hidden sm:inline text-[11px] font-mono text-[#94a3b8]">
                Click slot to eject · Click addon below to install
              </span>
            </div>

            {/* 3 Installed Augment Slots */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[0, 1, 2].map((slotIdx) => {
                const augId = installedAugments[slotIdx];
                const augSpec = augId ? AUGMENT_SPECS[augId] : null;
                return (
                  <div
                    key={slotIdx}
                    className={`p-2.5 border flex items-center justify-between ${
                      augSpec
                        ? 'border-[#38bdf8]/60 bg-[#172130]'
                        : 'border-dashed border-[#323c4d] bg-[#0e1219]'
                    }`}
                  >
                    {augSpec ? (
                      <>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#f3f5f8] truncate">
                            {augSpec.name}
                          </div>
                          <div className="text-[10px] font-mono text-[#38bdf8] truncate">
                            {augSpec.effectSummary}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveAugment(machine.id, slotIdx)}
                          title="Eject Augment to Backpack"
                          className="ml-1.5 px-2 py-1 text-[10px] font-mono bg-[#263040] hover:bg-[#ef4444] hover:text-white text-[#cbd5e1] cursor-pointer shrink-0"
                        >
                          Eject
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] font-mono text-[#64748b]">
                        Empty Augment Slot #{slotIdx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Available Augments in Backpack or ME Storage */}
            {installedAugments.length < 3 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                {ALL_AUGMENT_IDS.map((augId) => {
                  const aSpec = AUGMENT_SPECS[augId];
                  const inBag = character.inventory[augId] || 0;
                  const inMe = storageInventory[augId] || 0;
                  const totalAvail = inBag + inMe;
                  return (
                    <button
                      key={augId}
                      type="button"
                      disabled={totalAvail <= 0}
                      onClick={() => onInstallAugment(machine.id, augId)}
                      className={`p-2 border text-left transition-colors ${
                        totalAvail > 0
                          ? 'border-[#334155] bg-[#18202c] hover:border-[#f59e0b] cursor-pointer'
                          : 'border-[#1e2633] bg-[#0f131a] opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span style={{ color: aSpec.color }}>{aSpec.shortName}</span>
                        <span className="font-mono text-[10px] text-[#cbd5e1]">×{totalAvail}</span>
                      </div>
                      <div className="text-[10px] text-[#94a3b8] truncate mt-0.5">
                        {aSpec.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 1. HIGH-PRESSURE FIREWOOD & COAL BOILER CONSOLE */}
          {normKind === 'firewood_boiler' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-[#f97316] font-semibold">
                  <Flame className="w-4 h-4" />
                  Coal &amp; Firewood Boiler Chamber ({COAL_BURN_SECONDS_PER_UNIT}s base burn)
                </span>
                <span className="font-mono text-[#e2e8f0]">
                  Burn: {Math.ceil(machine.coalFuelSeconds)}s · Queued Fuel: {machine.coalBuffer}
                </span>
              </div>
              {dayNight.weather.kind !== 'clear' && (
                <div className="flex items-center justify-between gap-2 border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-2 text-[11px] text-[#fde68a]">
                  <span className="inline-flex items-center gap-1.5">
                    {dayNight.weather.kind === 'light_rain' ? (
                      <CloudRain className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                    ) : (
                      <CloudFog className="w-3.5 h-3.5 text-[#cbd5e1] shrink-0" />
                    )}
                    <span>
                      <strong>{dayNight.weather.label}</strong> reduces Solar output to{' '}
                      {Math.round(dayNight.solarEfficiency * 100)}% — boiler drawing{' '}
                      <strong>{dayNight.weather.boilerFuelBurnMultiplier.toFixed(2)}× backup fuel</strong>.
                    </span>
                  </span>
                </div>
              )}
              <div className="w-full h-2.5 bg-[#0c0f14] border border-[#2b3340]">
                <div
                  className="h-full bg-[#f97316] transition-all"
                  style={{
                    width: `${Math.min(100, (machine.coalFuelSeconds / COAL_BURN_SECONDS_PER_UNIT) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-[#9aa8bc]">
                  Available (Bag + ME):{' '}
                  <strong className="text-[#f59e0b] font-mono">{availableFirewood} Firewood</strong> ·{' '}
                  <strong className="text-[#cbd5e1] font-mono">{availableCoal} Coal</strong>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={availableFirewood < 1}
                    onClick={() => onFeedFuel(machine.id, 'firewood_bundle', 1)}
                    className="bg-[#ea580c] disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    +1 Firewood
                  </button>
                  <button
                    type="button"
                    disabled={availableFirewood < 1}
                    onClick={() =>
                      onFeedFuel(machine.id, 'firewood_bundle', Math.min(8, availableFirewood))
                    }
                    className="bg-[#f59e0b] disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-[#10141b] cursor-pointer"
                  >
                    +8 Firewood
                  </button>
                  <button
                    type="button"
                    disabled={availableCoal < 1}
                    onClick={() => onFeedFuel(machine.id, 'coal', Math.min(5, availableCoal))}
                    className="bg-[#263040] disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-[#e2e8f0] cursor-pointer"
                  >
                    +Coal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 1B. SOLAR PANEL ARRAY WEATHER & EFFICIENCY CONSOLE */}
          {normKind === 'solar_array' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-[#38bdf8] font-semibold">
                  {dayNight.weather.kind === 'light_rain' ? (
                    <CloudRain className="w-4 h-4 text-[#7dd3fc]" />
                  ) : dayNight.weather.kind === 'fog' ? (
                    <CloudFog className="w-4 h-4 text-[#cbd5e1]" />
                  ) : (
                    <Sun className="w-4 h-4 text-[#f59e0b]" />
                  )}
                  Solar Panel Photovoltaic Telemetry
                </span>
                <span className="font-mono text-[#f59e0b]">
                  +{feStats.genFe} / +{Math.round(spec.generationKw * augStats.feGenMult)} FE/t Peak
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-[#0c1017] border border-[#263040] p-2.5 tabular-nums">
                <div>
                  <div className="text-[#8d9cb0] text-[10px]">Daylight Sun</div>
                  <div className="text-[#fbbf24] font-semibold mt-0.5">
                    {Math.round(dayNight.baseSolarEfficiency * 100)}%
                  </div>
                </div>
                <div>
                  <div className="text-[#8d9cb0] text-[10px]">Weather ({dayNight.weather.shortLabel})</div>
                  <div
                    className={`font-semibold mt-0.5 ${
                      dayNight.weather.kind === 'clear' ? 'text-[#10b981]' : 'text-[#7dd3fc]'
                    }`}
                  >
                    ×{Math.round(dayNight.weather.solarMultiplier * 100)}%
                  </div>
                </div>
                <div>
                  <div className="text-[#8d9cb0] text-[10px]">Net Solar Eff.</div>
                  <div className="text-[#38bdf8] font-semibold mt-0.5">
                    {Math.round(dayNight.solarEfficiency * 100)}%
                  </div>
                </div>
              </div>

              <div className="w-full h-2.5 bg-[#0c0f14] border border-[#2b3340]">
                <div
                  className={`h-full transition-all ${
                    dayNight.weather.kind === 'clear' ? 'bg-[#38bdf8]' : 'bg-[#f59e0b]'
                  }`}
                  style={{ width: `${Math.min(100, Math.round(dayNight.solarEfficiency * 100))}%` }}
                />
              </div>

              {dayNight.weather.kind !== 'clear' || dayNight.isNight ? (
                <p className="text-xs text-[#fde68a] bg-[#f59e0b]/10 border border-[#f59e0b]/35 px-3 py-2">
                  {dayNight.isNight
                    ? 'Nighttime: Solar generation offline (0%). Rely on Coal/Firewood Boilers and Flux Capacitor Banks until dawn.'
                    : `${dayNight.weather.label} active (${dayNight.weather.formattedTimeRemaining} left): Solar efficiency reduced to ${Math.round(dayNight.solarEfficiency * 100)}%. Keep backup Coal or Firewood loaded in your boilers to prevent brownouts.`}
                </p>
              ) : (
                <p className="text-xs text-[#9aa8bc]">
                  Clear skies: Operating at full daylight output. Light Rain reduces efficiency to 40% and Dense Fog reduces efficiency to 55%.
                </p>
              )}
            </div>
          )}

          {/* 2. POWAH! THERMO & NITRO REACTOR CONSOLE */}
          {normKind === 'powah_reactor' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 text-[#ef4444] font-semibold">
                  <Zap className="w-4 h-4" />
                  Powah! Thermo & Nitro Core
                </span>
                <span className="font-mono text-[#f59e0b]">
                  Output: +{feStats.genFe} FE/t · Nitro Fuel: {machine.coalFuelSeconds}s ({machine.coalBuffer} queued)
                </span>
              </div>
              <p className="text-xs text-[#9aa8bc]">
                Generates passive geothermal FE/t continuously, or surges to{' '}
                <strong className="text-[#ef4444]">480+ FE/t Nitro Mode</strong> when fueled with Just Dire Blazegold or Split Firewood.
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#9aa8bc]">
                  Available (Bag + ME): <strong className="text-[#f59e0b] font-mono">{availableBlazegold} Blazegold</strong> ·{' '}
                  <strong className="text-[#fb923c] font-mono">{availableFirewood} Firewood</strong>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={availableBlazegold < 1}
                    onClick={() => onFeedFuel(machine.id, 'blazegold_ingot', 1)}
                    className="bg-[#ef4444] disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    +1 Blazegold (90s Nitro)
                  </button>
                  <button
                    type="button"
                    disabled={availableFirewood < 1}
                    onClick={() => onFeedFuel(machine.id, 'firewood_bundle', Math.min(4, availableFirewood))}
                    className="bg-[#f59e0b] disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-[#10141b] cursor-pointer"
                  >
                    +Firewood Boost
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. THERMAL FLUX CAPACITOR BANK */}
          {normKind === 'flux_battery' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#9aa8bc]">Stored Forge Energy (FE)</span>
                <span className="font-mono text-[#38bdf8]">
                  {Math.round(machine.storedEnergy).toLocaleString()} / {feStats.maxEnergy.toLocaleString()} FE
                </span>
              </div>
              <div className="w-full h-3 bg-[#0c0f14] border border-[#2b3340]">
                <div
                  className="h-full bg-[#38bdf8] transition-all"
                  style={{
                    width: `${
                      feStats.maxEnergy > 0
                        ? Math.min(100, (machine.storedEnergy / feStats.maxEnergy) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 4. FIREWOOD SPLITTER & SAWMILL RECIPE SELECTOR */}
          {normKind === 'firewood_splitter' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-4 space-y-2.5">
              <div className="text-xs font-semibold text-[#f59e0b]">
                Firewood Splitter & Sawmill Mode (+{augStats.yieldBonus} Auxiliary Sieve Bonus)
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {FIREWOOD_SPLITTER_RECIPES.map((r) => {
                  const active = (machine.selectedRecipeId || FIREWOOD_SPLITTER_RECIPES[0].id) === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onUpdateMachine({ ...machine, selectedRecipeId: r.id, progress: 0 })}
                      className={`p-2.5 text-left border text-xs flex items-center justify-between cursor-pointer ${
                        active
                          ? 'border-[#f59e0b] bg-[#242c3a] text-white'
                          : 'border-[#2b3340] bg-[#151a23] text-[#a3b0c2]'
                      }`}
                    >
                      <span className="font-semibold">{r.name}</span>
                      <span className="font-mono text-[#10b981]">
                        {r.inputQty} {ITEMS[r.inputId].shortName} → {r.outputQty + augStats.yieldBonus}×{' '}
                        {ITEMS[r.outputId].shortName}
                        {r.bonusOutputId ? ` + ${ITEMS[r.bonusOutputId].shortName}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. ENDER IO SAG MILL / CRUSHER (ORE MULTIPLICATION) */}
          {normKind === 'sag_mill' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#10b981]">
                  SAG Mill Ore Multiplication ({2 + augStats.yieldBonus}× Clump Yield per Raw Ore!)
                </span>
                <span className="text-[11px] font-mono text-[#94a3b8]">
                  Auto-scans all ores on ME Network
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SAG_MILL_RECIPES.map((r) => {
                  const active = (machine.selectedRecipeId || SAG_MILL_RECIPES[0].id) === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onUpdateMachine({ ...machine, selectedRecipeId: r.id, progress: 0 })}
                      className={`p-2 text-left border text-xs flex flex-col justify-between cursor-pointer ${
                        active
                          ? 'border-[#10b981] bg-[#1a2826] text-white'
                          : 'border-[#2b3340] bg-[#151a23] text-[#a3b0c2]'
                      }`}
                    >
                      <span className="font-semibold">{ITEMS[r.inputId].name}</span>
                      <span className="font-mono text-[11px] text-[#10b981] mt-0.5">
                        1 Raw → {r.outputQty + augStats.yieldBonus}× {ITEMS[r.outputId].name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. ENDER IO ALLOY & ENERGIZED SMELTER */}
          {normKind === 'alloy_smelter' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#f97316]">
                  Alloy & Energized Smelter Recipe (Auto-fallback across available clumps)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {SMELT_RECIPES.map((r) => {
                  const active = (machine.selectedRecipeId || SMELT_RECIPES[0].id) === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onUpdateMachine({ ...machine, selectedRecipeId: r.id, progress: 0 })}
                      className={`p-2 text-left border text-xs flex flex-col justify-between cursor-pointer ${
                        active
                          ? 'border-[#f59e0b] bg-[#242c3a] text-white'
                          : 'border-[#2b3340] bg-[#151a23] text-[#a3b0c2]'
                      }`}
                    >
                      <span className="font-semibold truncate">{r.name}</span>
                      <span className="font-mono text-[11px] text-[#f59e0b] mt-0.5">
                        {r.inputQty} {ITEMS[r.inputId].shortName}
                        {r.secondaryInputId
                          ? ` + ${r.secondaryInputQty} ${ITEMS[r.secondaryInputId].shortName}`
                          : ''}{' '}
                        → {r.outputQty + augStats.yieldBonus}× {ITEMS[r.outputId].shortName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 7. AE2 MOLECULAR ASSEMBLER */}
          {normKind === 'molecular_assembler' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-4 space-y-2.5">
              <div className="text-xs font-semibold text-[#a855f7]">
                AE2 Molecular Assembler Pattern (Pulls ingredients from ME Network)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {CRAFT_RECIPES.map((r) => {
                  const active = (machine.selectedRecipeId || CRAFT_RECIPES[0].id) === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onUpdateMachine({ ...machine, selectedRecipeId: r.id, progress: 0 })}
                      className={`p-2 text-left border text-xs flex flex-col gap-0.5 cursor-pointer ${
                        active
                          ? 'border-[#a855f7] bg-[#231d33] text-white'
                          : 'border-[#2b3340] bg-[#151a23] text-[#a3b0c2]'
                      }`}
                    >
                      <div className="font-semibold flex justify-between">
                        <span className="truncate">{r.name}</span>
                        <span className="font-mono text-[#38bdf8]">×{r.outputQty}</span>
                      </div>
                      <div className="text-[10px] font-mono text-[#8d9cb0] truncate">
                        Needs: {r.inputs.map((i) => `${i.qty} ${ITEMS[i.itemId].shortName}`).join(' + ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 8. OUTPUT HOPPER BUFFER (For any machine not yet linked to an ME Controller) */}
          {normKind !== 'me_controller' && normKind !== 'flux_battery' && normKind !== 'solar_array' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9aa8bc] inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#38bdf8]" />
                  Internal Output Hopper{' '}
                  {hasMeLink ? '(Auto-Exporting to AE2 ME Drive)' : '(Connect ME Controller or Collect)'}
                </span>
                {hopperEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onCollectHopper(machine.id)}
                    className="inline-flex items-center gap-1 bg-[#10b981] px-2.5 py-1 text-xs font-semibold text-[#08130e] cursor-pointer"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    Collect All to Backpack
                  </button>
                )}
              </div>
              {hopperEntries.length === 0 ? (
                <div className="text-xs text-[#7c8aa0] py-1">
                  {hasMeLink
                    ? 'All produced items are streaming directly into your AE2 ME Storage Network.'
                    : 'Hopper empty — outputs will accumulate here as cycles complete.'}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {hopperEntries.map(([itemId, qty]) => {
                    const meta = ITEMS[itemId];
                    return (
                      <div
                        key={itemId}
                        className="border border-[#2b3340] bg-[#161c26] p-2 flex items-center justify-between text-xs"
                      >
                        <span className="truncate">{meta?.shortName || itemId}</span>
                        <span className="font-mono font-bold text-[#f59e0b]">×{qty}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 9. AE2 ME CONTROLLER & DIGITAL STORAGE DRIVE TERMINAL */}
          {normKind === 'me_controller' && (
            <div className="bg-[#12161e] border border-[#2b3340] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#22d3ee]">
                  <Cpu className="w-4 h-4" />
                  <span>AE2 ME Digital Storage Network (Shared with Splitters, SAG Mills & Assemblers)</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDepositAllOres(machine.id)}
                  className="bg-[#06b6d4] px-3 py-1 text-xs font-semibold text-[#061317] cursor-pointer"
                >
                  Deposit All Ores, Clumps & Firewood
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={meSearch}
                  onChange={(e) => setMeSearch(e.target.value)}
                  placeholder="Search ME Network items..."
                  className="w-full bg-[#0d1117] border border-[#2b3340] pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#22d3ee]"
                />
              </div>

              <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(ITEMS) as ResourceItemId[])
                  .filter((id) => {
                    const q = (character.inventory[id] || 0) + (storageInventory[id] || 0);
                    if (q <= 0) return false;
                    if (!meSearch.trim()) return true;
                    return ITEMS[id].name.toLowerCase().includes(meSearch.toLowerCase());
                  })
                  .map((itemId) => {
                    const meta = ITEMS[itemId];
                    const inBag = character.inventory[itemId] || 0;
                    const inTerm = storageInventory[itemId] || 0;
                    return (
                      <div
                        key={itemId}
                        className="border border-[#2b3340] bg-[#161c26] p-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{meta.name}</div>
                          <div className="font-mono text-[11px] text-[#8d9cb0]">
                            Bag: {inBag} · <span className="text-[#22d3ee]">ME: {inTerm}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={inBag <= 0}
                            onClick={() => onStorageTransfer(machine.id, itemId, inBag)}
                            title="Deposit stack into ME Drive"
                            className="border border-[#323b49] bg-[#1d2430] disabled:opacity-35 px-2 py-1 text-[11px] font-mono inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            <ArrowDownToLine className="w-3 h-3 text-[#38bdf8]" />
                            In
                          </button>
                          <button
                            type="button"
                            disabled={inTerm <= 0}
                            onClick={() => onStorageTransfer(machine.id, itemId, -Math.min(16, inTerm))}
                            title="Withdraw up to 16 to Backpack"
                            className="border border-[#323b49] bg-[#1d2430] disabled:opacity-35 px-2 py-1 text-[11px] font-mono inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            <ArrowUpFromLine className="w-3 h-3 text-[#10b981]" />
                            Out
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Footer: Crescent Hammer Dismantle */}
          <div className="flex items-center justify-between border-t border-[#2b3340] pt-3">
            <span className="text-[11px] text-[#8d9cb0]">
              Owner: <strong className="text-[#e2e8f0]">{machine.ownerName}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                onDismantleMachine(machine.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 border border-[#ef4444]/60 bg-[#ef4444]/10 px-3 py-1.5 text-xs font-medium text-[#fca5a5] hover:bg-[#ef4444]/20 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Wrench Dismantle (Returns Machine + Augments)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
