import {
  CRAFT_RECIPES,
  FIREWOOD_SPLITTER_RECIPES,
  MACHINE_SPECS,
  SAG_MILL_RECIPES,
  SMELT_RECIPES,
} from '../data/catalog.ts';
import { parseVoxelKey, sampleAutoMinerDrop, voxelKey } from './terrain.ts';
import type {
  AugmentId,
  MachineKind,
  PlacedMachine,
  PowerGridSnapshot,
  PowerNetworkSummary,
  ResourceItemId,
} from '../types/game.ts';

export const COAL_BURN_SECONDS_PER_UNIT = 40; // 40s per Split Firewood Bundle / Fuel unit

const NEIGHBOR_DIRS: readonly [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function normalizeMachineKind(kind: MachineKind): MachineKind {
  switch (kind) {
    case 'coal_generator':
      return 'firewood_boiler';
    case 'battery_bank':
      return 'flux_battery';
    case 'auto_miner':
      return 'digital_miner';
    case 'electric_smelter':
      return 'alloy_smelter';
    case 'auto_crafter':
      return 'molecular_assembler';
    case 'storage_terminal':
      return 'me_controller';
    default:
      return kind;
  }
}

export function getMachineAugmentMultipliers(augments?: AugmentId[]): {
  speedMult: number;
  yieldBonus: number;
  feConsumerMult: number;
  feGenMult: number;
  batteryCapMult: number;
  hasMeBus: boolean;
} {
  const list = augments || [];
  let speedCount = 0;
  let yieldCount = 0;
  let coilCount = 0;
  let hasMeBus = false;

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === 'aug_speed_flux') speedCount++;
    else if (a === 'aug_yield_sieve') yieldCount++;
    else if (a === 'aug_fe_coil') coilCount++;
    else if (a === 'aug_me_bus') hasMeBus = true;
  }

  return {
    speedMult: 1 + speedCount * 0.55,
    yieldBonus: yieldCount,
    feConsumerMult: Math.max(0.25, 1 - coilCount * 0.25),
    feGenMult: 1 + coilCount * 0.5,
    batteryCapMult: 1 + coilCount * 0.5,
    hasMeBus,
  };
}

export function getMachineEffectiveFeStats(
  machine: PlacedMachine,
  solarEfficiency: number
): { genFe: number; demandFe: number; maxEnergy: number } {
  const normKind = normalizeMachineKind(machine.kind);
  const spec = MACHINE_SPECS[normKind];
  const aug = getMachineAugmentMultipliers(machine.augments);

  if (!machine.enabled) {
    return { genFe: 0, demandFe: 0, maxEnergy: Math.round(spec.batteryCapacity * aug.batteryCapMult) };
  }

  let genFe = 0;
  if (normKind === 'firewood_boiler') {
    const isBurning = machine.coalFuelSeconds > 0 || machine.coalBuffer > 0;
    if (isBurning) {
      genFe = Math.round(spec.generationKw * aug.feGenMult);
    }
  } else if (normKind === 'solar_array') {
    genFe = Math.round(spec.generationKw * Math.max(0, solarEfficiency) * aug.feGenMult);
  } else if (normKind === 'powah_reactor') {
    const isFueled = machine.coalFuelSeconds > 0 || machine.coalBuffer > 0;
    const basePassive = Math.round(150 * Math.max(0.25, solarEfficiency));
    const rawGen = isFueled ? spec.generationKw : basePassive;
    genFe = Math.round(rawGen * aug.feGenMult);
  }

  const demandFe =
    spec.consumeKw > 0 ? Math.max(5, Math.round(spec.consumeKw * aug.feConsumerMult)) : 0;
  const maxEnergy = Math.round(spec.batteryCapacity * aug.batteryCapMult);

  return { genFe, demandFe, maxEnergy };
}

/**
 * Evaluates connected Ender IO Universal Conduit + FTB Machine networks via 6-axis BFS.
 */
export function evaluatePowerGrid(
  machines: PlacedMachine[],
  cables: string[],
  solarEfficiency: number
): PowerGridSnapshot {
  const cableSet = new Set<string>(cables);
  const machineByCoord = new Map<string, PlacedMachine>();
  for (const m of machines) {
    machineByCoord.set(voxelKey(m.x, m.y, m.z), m);
  }

  const visited = new Set<string>();
  const networks: PowerNetworkSummary[] = [];
  const machinePowered: Record<string, boolean> = {};
  const machineNetworkId: Record<string, string> = {};
  const cablePowered: Record<string, boolean> = {};

  let totalGenKw = 0;
  let totalDemandKw = 0;
  let totalStoredEnergy = 0;
  let totalMaxEnergy = 0;
  let hasOnlineMeNetwork = false;

  const allNodes: string[] = [...cables];
  for (const m of machines) {
    allNodes.push(voxelKey(m.x, m.y, m.z));
  }

  let netCounter = 1;

  for (const startKey of allNodes) {
    if (visited.has(startKey)) continue;
    const startCoord = parseVoxelKey(startKey);
    if (!startCoord) continue;

    const netId = `net_${netCounter++}`;
    const queue: string[] = [startKey];
    visited.add(startKey);

    const netMachines: PlacedMachine[] = [];
    const netCables: string[] = [];

    while (queue.length > 0) {
      const currKey = queue.shift()!;
      if (cableSet.has(currKey)) {
        netCables.push(currKey);
      }
      const m = machineByCoord.get(currKey);
      if (m) {
        netMachines.push(m);
      }

      const c = parseVoxelKey(currKey);
      if (!c) continue;
      for (const [dx, dy, dz] of NEIGHBOR_DIRS) {
        const nk = voxelKey(c.x + dx, c.y + dy, c.z + dz);
        if (visited.has(nk)) continue;
        if (cableSet.has(nk) || machineByCoord.has(nk)) {
          visited.add(nk);
          queue.push(nk);
        }
      }
    }

    let gen = 0;
    let demand = 0;
    let stored = 0;
    let maxE = 0;
    let hasMeController = false;

    for (const m of netMachines) {
      const normKind = normalizeMachineKind(m.kind);
      const stats = getMachineEffectiveFeStats(m, solarEfficiency);
      gen += stats.genFe;
      demand += stats.demandFe;
      if (stats.maxEnergy > 0) {
        stored += m.storedEnergy;
        maxE += stats.maxEnergy;
      }
      if (normKind === 'me_controller' && m.enabled) {
        hasMeController = true;
      }
    }

    const powered =
      (gen >= demand && (gen > 0 || demand === 0)) ||
      (demand > gen && stored >= demand - gen);

    if (hasMeController && (powered || gen > 0 || stored > 0)) {
      hasOnlineMeNetwork = true;
    }

    for (const m of netMachines) {
      const normKind = normalizeMachineKind(m.kind);
      machineNetworkId[m.id] = netId;
      if (normKind === 'claim_beacon') {
        machinePowered[m.id] = true;
      } else if (
        normKind === 'firewood_boiler' ||
        normKind === 'solar_array' ||
        normKind === 'powah_reactor'
      ) {
        const stats = getMachineEffectiveFeStats(m, solarEfficiency);
        machinePowered[m.id] = m.enabled && stats.genFe > 0;
      } else {
        machinePowered[m.id] = Boolean(m.enabled && powered && (gen > 0 || stored > 0));
      }
    }

    const cableActive = gen > 0 || stored > 0;
    for (const ck of netCables) {
      cablePowered[ck] = cableActive;
    }

    totalGenKw += gen;
    totalDemandKw += demand;
    totalStoredEnergy += stored;
    totalMaxEnergy += maxE;

    networks.push({
      id: netId,
      machineIds: netMachines.map((m) => m.id),
      cableKeys: netCables,
      generationKw: gen,
      demandKw: demand,
      storedEnergy: Math.round(stored),
      maxEnergy: Math.round(maxE),
      powered,
      hasMeController,
    });
  }

  return {
    networks,
    machinePowered,
    machineNetworkId,
    cablePowered,
    totalGenKw,
    totalDemandKw,
    totalStoredEnergy: Math.round(totalStoredEnergy),
    totalMaxEnergy: Math.round(totalMaxEnergy),
    hasOnlineMeNetwork,
  };
}

/**
 * Advances all placed FTB machines by 1 second (1 Hz factory simulation tick):
 * - Firewood Boilers burn Split Firewood Bundles (or auto-pull from ME Storage / connected Splitters)
 * - Powah! Reactors generate passive thermo FE/t + high-output Nitro FE/t when fueled with Blazegold/Certus
 * - Forestry Multifarms automatically harvest Wood Logs, Split Firewood, and Leaves
 * - Firewood Splitters split 1 Wood Log -> 4+ Split Firewood Bundles + Sawdust
 * - Mekanism Digital Miners excavate raw ores with Auxiliary Sieve multiplication
 * - Ender IO SAG Mills crush 1 Raw Ore -> 2 to 5 Crushed Ore Clumps
 * - Ender IO Alloy Smelters smelt Crushed Clumps -> Ingots and fuse FTB Alloys & AE2 Processors
 * - AE2 Molecular Assemblers auto-craft any recipe from ME Storage
 * - Just Dire Block Automators synthesize Cobblestone, Sand, and Wood Logs
 */
export function tickMachinesOneSecond(
  seed: number,
  machines: PlacedMachine[],
  cables: string[],
  storageInventory: Partial<Record<ResourceItemId, number>>,
  solarEfficiency: number,
  boilerFuelBurnMultiplier: number = 1
): {
  machines: PlacedMachine[];
  storageInventory: Partial<Record<ResourceItemId, number>>;
  grid: PowerGridSnapshot;
} {
  const nextStorage: Partial<Record<ResourceItemId, number>> = { ...storageInventory };
  const cloned: PlacedMachine[] = machines.map((m) => ({
    ...m,
    augments: m.augments ? [...m.augments] : [],
    outputBuffer: { ...m.outputBuffer },
  }));

  // Detect whether solar panels exist on the world grid & are degraded by weather/night,
  // increasing backup load on coal/firewood-fired boilers.
  const hasSolarPanels = cloned.some((m) => normalizeMachineKind(m.kind) === 'solar_array' && m.enabled);
  const weatherBackupPenalty = Math.max(1, boilerFuelBurnMultiplier);
  const solarBackupLoadBonus = hasSolarPanels && solarEfficiency < 0.7 ? 0.2 : 0;
  const effectiveBoilerBurnRate = Number((weatherBackupPenalty + solarBackupLoadBonus).toFixed(2));
  const boilerTargetBuffer = weatherBackupPenalty > 1 ? 6 : 4;

  // 1. Pre-advance Coal/Firewood Boiler & Powah! Reactor fuel timers + auto-pull backup fuel from ME Storage
  for (const m of cloned) {
    if (!m.enabled) continue;
    const normKind = normalizeMachineKind(m.kind);
    if (normKind === 'firewood_boiler') {
      // Auto-refuel from ME storage if coalBuffer is low (pulls deeper reserves during rain/fog)
      if (m.coalBuffer < boilerTargetBuffer) {
        if ((nextStorage.coal || 0) > 0 && weatherBackupPenalty > 1) {
          nextStorage.coal = (nextStorage.coal || 1) - 1;
          if (nextStorage.coal <= 0) delete nextStorage.coal;
          m.coalBuffer += 1;
        } else if ((nextStorage.firewood_bundle || 0) > 0) {
          nextStorage.firewood_bundle = (nextStorage.firewood_bundle || 1) - 1;
          if (nextStorage.firewood_bundle <= 0) delete nextStorage.firewood_bundle;
          m.coalBuffer += 1;
        } else if ((nextStorage.coal || 0) > 0) {
          nextStorage.coal = (nextStorage.coal || 1) - 1;
          if (nextStorage.coal <= 0) delete nextStorage.coal;
          m.coalBuffer += 1;
        }
      }
      if (m.coalFuelSeconds > 0) {
        m.coalFuelSeconds = Math.max(0, Number((m.coalFuelSeconds - effectiveBoilerBurnRate).toFixed(2)));
      }
      if (m.coalFuelSeconds <= 0 && m.coalBuffer > 0) {
        m.coalBuffer -= 1;
        m.coalFuelSeconds = COAL_BURN_SECONDS_PER_UNIT;
      }
    } else if (normKind === 'powah_reactor') {
      if (m.coalBuffer < 2 && (nextStorage.blazegold_ingot || 0) > 0) {
        nextStorage.blazegold_ingot = (nextStorage.blazegold_ingot || 1) - 1;
        if (nextStorage.blazegold_ingot <= 0) delete nextStorage.blazegold_ingot;
        m.coalBuffer += 1;
      }
      if (m.coalFuelSeconds > 0) {
        m.coalFuelSeconds = Math.max(0, m.coalFuelSeconds - 1);
      }
      if (m.coalFuelSeconds <= 0 && m.coalBuffer > 0) {
        m.coalBuffer -= 1;
        m.coalFuelSeconds = 90;
      }
    }
  }

  const grid = evaluatePowerGrid(cloned, cables, solarEfficiency);
  const byId = new Map<string, PlacedMachine>(cloned.map((m) => [m.id, m]));

  const addOutput = (m: PlacedMachine, netHasMe: boolean, itemId: ResourceItemId, qty: number) => {
    if (qty <= 0) return;
    const aug = getMachineAugmentMultipliers(m.augments);
    if (netHasMe || aug.hasMeBus) {
      nextStorage[itemId] = (nextStorage[itemId] || 0) + qty;
    } else {
      m.outputBuffer[itemId] = (m.outputBuffer[itemId] || 0) + qty;
    }
  };

  for (const net of grid.networks) {
    const netMachines: PlacedMachine[] = [];
    for (const id of net.machineIds) {
      const found = byId.get(id);
      if (found) netMachines.push(found);
    }

    // 2. Update Flux Capacitor Banks & internal energy buffers
    const batteries = netMachines.filter((m) => {
      const k = normalizeMachineKind(m.kind);
      return (
        (k === 'flux_battery' ||
          k === 'powah_reactor' ||
          k === 'solar_array' ||
          k === 'me_controller' ||
          k === 'firewood_boiler') &&
        m.enabled
      );
    });
    for (const b of batteries) {
      b.maxEnergy = getMachineEffectiveFeStats(b, solarEfficiency).maxEnergy;
    }

    const netDelta = net.generationKw - net.demandKw;
    if (batteries.length > 0 && netDelta !== 0) {
      const perBattery = netDelta / batteries.length;
      for (const b of batteries) {
        b.storedEnergy = Math.max(0, Math.min(b.maxEnergy, b.storedEnergy + perBattery));
      }
    }

    const netHasMe = Boolean(net.hasMeController);

    // Helper to pull an item from ME storage or any machine outputBuffer on the same conduit network
    const pullInput = (m: PlacedMachine, itemId: ResourceItemId, qty: number): boolean => {
      const aug = getMachineAugmentMultipliers(m.augments);
      const canUseMe = netHasMe || aug.hasMeBus;
      const inMe = canUseMe ? nextStorage[itemId] || 0 : 0;
      let inHoppers = 0;
      for (const peer of netMachines) {
        inHoppers += peer.outputBuffer[itemId] || 0;
      }
      if (inMe + inHoppers < qty) return false;

      let rem = qty;
      if (canUseMe && (nextStorage[itemId] || 0) > 0) {
        const take = Math.min(rem, nextStorage[itemId] || 0);
        nextStorage[itemId] = (nextStorage[itemId] || 0) - take;
        if ((nextStorage[itemId] || 0) <= 0) delete nextStorage[itemId];
        rem -= take;
      }
      if (rem > 0) {
        for (const peer of netMachines) {
          const avail = peer.outputBuffer[itemId] || 0;
          if (avail <= 0) continue;
          const take = Math.min(rem, avail);
          peer.outputBuffer[itemId] = avail - take;
          if ((peer.outputBuffer[itemId] || 0) <= 0) delete peer.outputBuffer[itemId];
          rem -= take;
          if (rem <= 0) break;
        }
      }
      return true;
    };

    // 3. Advance Powered FTB Machines
    for (const m of netMachines) {
      if (!grid.machinePowered[m.id]) continue;
      const normKind = normalizeMachineKind(m.kind);
      const spec = MACHINE_SPECS[normKind];
      const aug = getMachineAugmentMultipliers(m.augments);
      const stepPct = Math.min(100, Math.round((100 / Math.max(1, spec.cycleSeconds)) * aug.speedMult));

      if (normKind === 'forestry_multifarm') {
        m.progress += stepPct;
        if (m.progress >= 100) {
          m.progress = 0;
          m.mineCursor += 1;
          addOutput(m, netHasMe, 'wood_log', 2 + aug.yieldBonus);
          addOutput(m, netHasMe, 'firewood_bundle', 1 + aug.yieldBonus);
          if (m.mineCursor % 2 === 0) {
            addOutput(m, netHasMe, 'leaves', 1);
          }
        }
      } else if (normKind === 'firewood_splitter') {
        const recipe =
          FIREWOOD_SPLITTER_RECIPES.find((r) => r.id === m.selectedRecipeId) ??
          FIREWOOD_SPLITTER_RECIPES[0]!;
        m.progress += stepPct;
        if (m.progress >= 100) {
          if (pullInput(m, recipe.inputId, recipe.inputQty)) {
            m.progress = 0;
            addOutput(m, netHasMe, recipe.outputId, recipe.outputQty + aug.yieldBonus);
            if (recipe.bonusOutputId && recipe.bonusOutputQty) {
              addOutput(m, netHasMe, recipe.bonusOutputId, recipe.bonusOutputQty);
            }
          } else {
            m.progress = 95;
          }
        }
      } else if (normKind === 'digital_miner') {
        m.progress += stepPct;
        if (m.progress >= 100) {
          m.progress = 0;
          m.mineCursor += 1;
          const drop = sampleAutoMinerDrop(seed, m.x, m.z, m.mineCursor);
          addOutput(m, netHasMe, drop, 1 + aug.yieldBonus);
        }
      } else if (normKind === 'sag_mill') {
        const chosen =
          SAG_MILL_RECIPES.find((r) => r.id === m.selectedRecipeId) ?? SAG_MILL_RECIPES[0]!;
        m.progress += stepPct;
        if (m.progress >= 100) {
          // Try chosen recipe first; if input unavailable, auto-scan other SAG Mill ore recipes
          let activeRecipe = chosen;
          let pulled = pullInput(m, activeRecipe.inputId, activeRecipe.inputQty);
          if (!pulled) {
            for (const candidate of SAG_MILL_RECIPES) {
              if (pullInput(m, candidate.inputId, candidate.inputQty)) {
                activeRecipe = candidate;
                pulled = true;
                break;
              }
            }
          }
          if (pulled) {
            m.progress = 0;
            addOutput(m, netHasMe, activeRecipe.outputId, activeRecipe.outputQty + aug.yieldBonus);
          } else {
            m.progress = 95;
          }
        }
      } else if (normKind === 'alloy_smelter') {
        const chosen =
          SMELT_RECIPES.find((r) => r.id === m.selectedRecipeId) ?? SMELT_RECIPES[0]!;
        m.progress += stepPct;
        if (m.progress >= 100) {
          const tryExecuteSmelt = (rec: typeof chosen): boolean => {
            if (!rec.secondaryInputId) {
              return pullInput(m, rec.inputId, rec.inputQty);
            }
            // Check both inputs before consuming
            const canUseMe = netHasMe || aug.hasMeBus;
            const avail1 =
              (canUseMe ? nextStorage[rec.inputId] || 0 : 0) +
              netMachines.reduce((acc, p) => acc + (p.outputBuffer[rec.inputId] || 0), 0);
            const avail2 =
              (canUseMe ? nextStorage[rec.secondaryInputId] || 0 : 0) +
              netMachines.reduce((acc, p) => acc + (p.outputBuffer[rec.secondaryInputId!] || 0), 0);
            if (avail1 < rec.inputQty || avail2 < (rec.secondaryInputQty || 1)) return false;
            pullInput(m, rec.inputId, rec.inputQty);
            pullInput(m, rec.secondaryInputId, rec.secondaryInputQty || 1);
            return true;
          };

          let activeRecipe = chosen;
          let ok = tryExecuteSmelt(activeRecipe);
          if (!ok) {
            for (const candidate of SMELT_RECIPES) {
              if (tryExecuteSmelt(candidate)) {
                activeRecipe = candidate;
                ok = true;
                break;
              }
            }
          }
          if (ok) {
            m.progress = 0;
            addOutput(m, netHasMe, activeRecipe.outputId, activeRecipe.outputQty + aug.yieldBonus);
          } else {
            m.progress = 95;
          }
        }
      } else if (normKind === 'molecular_assembler') {
        const recipe =
          CRAFT_RECIPES.find((r) => r.id === m.selectedRecipeId) ?? CRAFT_RECIPES[0]!;
        m.progress += stepPct;
        if (m.progress >= 100) {
          const canUseMe = netHasMe || aug.hasMeBus;
          const canCraft = recipe.inputs.every((inp) => {
            const avail =
              (canUseMe ? nextStorage[inp.itemId] || 0 : 0) +
              netMachines.reduce((acc, p) => acc + (p.outputBuffer[inp.itemId] || 0), 0);
            return avail >= inp.qty;
          });
          if (canCraft) {
            for (const inp of recipe.inputs) {
              pullInput(m, inp.itemId, inp.qty);
            }
            m.progress = 0;
            addOutput(m, netHasMe, recipe.outputId, recipe.outputQty);
          } else {
            m.progress = 95;
          }
        }
      } else if (normKind === 'dire_automator') {
        m.progress += stepPct;
        if (m.progress >= 100) {
          m.progress = 0;
          m.mineCursor += 1;
          addOutput(m, netHasMe, 'cobblestone', 2 + aug.yieldBonus);
          addOutput(m, netHasMe, 'sand', 1);
          if (m.mineCursor % 2 === 0) {
            addOutput(m, netHasMe, 'wood_log', 1);
          }
        }
      } else if (normKind === 'me_controller') {
        // Auto-import any items sitting in connected machine output hoppers into the ME Network!
        for (const peer of netMachines) {
          if (peer.id === m.id) continue;
          for (const [itemId, qty] of Object.entries(peer.outputBuffer)) {
            if (qty && qty > 0) {
              const id = itemId as ResourceItemId;
              nextStorage[id] = (nextStorage[id] || 0) + qty;
              delete peer.outputBuffer[id];
            }
          }
        }
      }
    }
  }

  const updatedGrid = evaluatePowerGrid(cloned, cables, solarEfficiency);
  return {
    machines: cloned,
    storageInventory: nextStorage,
    grid: updatedGrid,
  };
}
