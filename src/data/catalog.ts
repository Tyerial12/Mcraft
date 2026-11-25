import type {
  ArmorTier,
  AugmentId,
  CharacterAppearance,
  CharacterProfile,
  MachineKind,
  PickaxeTier,
  PlacedMachine,
  PlayerClassId,
  ResourceItemId,
  TerrainBlockKind,
  WeaponTier,
  WorkerTask,
  WorldData,
  WorldPlayerState,
} from '../types/game.ts';

export const WORKER_HIRE_COST = 1000; // Each worker costs 1,000 Dire Coins

export interface PlayerClassMeta {
  id: PlayerClassId;
  name: string;
  title: string;
  color: string;
  accentColor: string;
  badgeBg: string;
  tagline: string;
  bonuses: string[];
}

export const PLAYER_CLASSES: PlayerClassMeta[] = [
  {
    id: 'farmer',
    name: 'Farmer',
    title: 'Agri-Tech & Sustenance Specialist',
    color: '#10b981',
    accentColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.16)',
    tagline: 'Master of food production, arboretum yields, and hunger endurance.',
    bonuses: [
      '+50% Food Nourishment: Eating Rations restores +60% Hunger & +85% Saturation',
      '50% Slower Hunger Drain while walking, sprinting, and mining in Survival',
      'Harvesting Canopy Leaves or Grass has a 65% chance to drop bonus Field Rations (Food)',
      '+1 Bonus Field Ration whenever cooking food or harvesting from Farm Food workers',
    ],
  },
  {
    id: 'lumberjack',
    name: 'Lumberjack',
    title: 'Timber & Firewood Power Vanguard',
    color: '#f59e0b',
    accentColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.16)',
    tagline: 'Fells double timber and supercharges firewood boilers and splitters.',
    bonuses: [
      '2× Timber Log Yield + 1× Bonus Split Firewood Bundle every time you chop a Wood Log',
      '+2 Bonus Split Firewood Bundles whenever crafting firewood',
      '+35% Longer Burn Duration on all Firewood Boilers you fuel',
      '+25% Bonus XP from harvesting trees and wooden blocks',
    ],
  },
  {
    id: 'engineer',
    name: 'Engineer',
    title: 'FTB Automation & Grid Architect',
    color: '#38bdf8',
    accentColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
    tagline: 'Overclocks factory machinery, Forge Energy grids, and conduit networks.',
    bonuses: [
      '+2 Bonus Universal Conduits crafted per batch',
      '+25% Bonus Dire Coin payout when selling items or ingots at the Trade Depot',
      'Hired Workers under your command gather +1 bonus resource every cycle',
      'Specialized for FTB Tech factory grids, AE2 storage networks, and automation',
    ],
  },
  {
    id: 'miner',
    name: 'Miner',
    title: 'Deep-Vein Quarry & Ore Specialist',
    color: '#a855f7',
    accentColor: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.16)',
    tagline: 'Doubles raw ore extraction and cracks higher-tier mineral veins early.',
    bonuses: [
      '2× Raw Ore Drops when mining Coal, Copper, Iron, Gold, Certus Quartz, or Diamond veins',
      '+1 Bonus Pickaxe Harvest Power (mine higher-tier ores one pickaxe tier earlier!)',
      '+40% Bonus Mining XP from all stone and mineral blocks',
      '25% Chance to uncover bonus Thermal Coal or Iron Ore while quarrying Cobblestone',
    ],
  },
];

export interface WorkerTaskSpec {
  task: WorkerTask;
  name: string;
  label: string;
  shortLabel: string;
  color: string;
  cycleSummary: string;
  description: string;
  outputs: { itemId: ResourceItemId; qty: number }[];
}

export const WORKER_TASK_SPECS: WorkerTaskSpec[] = [
  {
    task: 'wood',
    name: 'Gather Wood & Firewood',
    label: 'Gather Wood',
    shortLabel: 'Gather Wood',
    color: '#f59e0b',
    cycleSummary: '+2× Timber Logs & +2× Split Firewood / cycle',
    description: 'Chops nearby timber and splits firewood bundles directly into your storage.',
    outputs: [
      { itemId: 'wood_log', qty: 2 },
      { itemId: 'firewood_bundle', qty: 2 },
    ],
  },
  {
    task: 'iron',
    name: 'Mine Iron & Coal Veins',
    label: 'Mine Iron',
    shortLabel: 'Mine Iron',
    color: '#38bdf8',
    cycleSummary: '+2× Raw Iron Ore & +1× Thermal Coal / cycle',
    description: 'Excavates iron ore veins and coal seams for your smelters and SAG mills.',
    outputs: [
      { itemId: 'iron_ore', qty: 2 },
      { itemId: 'coal', qty: 1 },
    ],
  },
  {
    task: 'stone',
    name: 'Quarry Stone & Cobble',
    label: 'Quarry Stone',
    shortLabel: 'Quarry Stone',
    color: '#94a3b8',
    cycleSummary: '+3× Cobblestone & +1× Stone / cycle',
    description: 'Quarries structural cobblestone and rock for factory pads and casings.',
    outputs: [
      { itemId: 'cobblestone', qty: 3 },
      { itemId: 'stone', qty: 1 },
    ],
  },
  {
    task: 'food',
    name: 'Farm Food & Rations',
    label: 'Farm Food',
    shortLabel: 'Farm Food',
    color: '#10b981',
    cycleSummary: '+2× Energized Field Rations / cycle',
    description: 'Cultivates crops and prepares ready-to-eat Field Rations to keep your workforce and Hunger full.',
    outputs: [{ itemId: 'cooked_ration', qty: 2 }],
  },
];

export interface DireTraderBarterDeal {
  id: string;
  title: string;
  category: 'resources' | 'food' | 'coins' | 'tech';
  costItemId: ResourceItemId | 'credits';
  costQty: number;
  rewardItemId: ResourceItemId | 'credits';
  rewardQty: number;
  description: string;
}

export const DIRE_TRADER_DEALS: DireTraderBarterDeal[] = [
  {
    id: 'barter_logs_for_food',
    title: '8× Timber Logs → 4× Field Rations (Food)',
    category: 'food',
    costItemId: 'wood_log',
    costQty: 8,
    rewardItemId: 'cooked_ration',
    rewardQty: 4,
    description: 'Trade freshly chopped timber for hearty survival rations.',
  },
  {
    id: 'barter_coins_for_food',
    title: '75 Dire Coins → 4× Field Rations (Food)',
    category: 'food',
    costItemId: 'credits',
    costQty: 75,
    rewardItemId: 'cooked_ration',
    rewardQty: 4,
    description: 'Purchase ready-to-eat Field Rations to feed yourself and your Hired Workers.',
  },
  {
    id: 'barter_cobble_for_iron',
    title: '24× Cobblestone → 4× Raw Iron Ore',
    category: 'resources',
    costItemId: 'cobblestone',
    costQty: 24,
    rewardItemId: 'iron_ore',
    rewardQty: 4,
    description: 'Exchange bulk quarried cobblestone for raw iron ore.',
  },
  {
    id: 'barter_iron_for_coins',
    title: '12× Iron Ingots → 360 Dire Coins',
    category: 'coins',
    costItemId: 'iron_ingot',
    costQty: 12,
    rewardItemId: 'credits',
    rewardQty: 360,
    description: 'Bulk refined iron contract to build your treasury toward a 1,000-Coin Hired Worker.',
  },
  {
    id: 'barter_copper_for_coins',
    title: '15× Copper Ingots → 340 Dire Coins',
    category: 'coins',
    costItemId: 'copper_ingot',
    costQty: 15,
    rewardItemId: 'credits',
    rewardQty: 340,
    description: 'Supply refined copper ingots to the caravan for Dire Coins.',
  },
  {
    id: 'barter_gold_for_crystal',
    title: '5× Gold Ingots → 3× Charged Certus Quartz',
    category: 'tech',
    costItemId: 'gold_ingot',
    costQty: 5,
    rewardItemId: 'aether_crystal',
    rewardQty: 3,
    description: 'Barter refined gold ingots for AE2 Charged Certus Quartz crystals.',
  },
  {
    id: 'barter_firewood_for_coins',
    title: '32× Split Firewood → 320 Dire Coins',
    category: 'coins',
    costItemId: 'firewood_bundle',
    costQty: 32,
    rewardItemId: 'credits',
    rewardQty: 320,
    description: 'Sell surplus kiln-dried firewood bundles to fuel the caravan boilers.',
  },
  {
    id: 'barter_vibrant_contract',
    title: '4× Vibrant Alloy → 750 Dire Coins',
    category: 'coins',
    costItemId: 'vibrant_alloy',
    costQty: 4,
    rewardItemId: 'credits',
    rewardQty: 750,
    description: 'High-tech syndicate contract paying top Dire Coins for Tier-3 Vibrant Alloy.',
  },
];

/**
 * Strict Machine Ownership Check:
 * Only the player who placed a machine can control, configure, fuel, collect from, or dismantle it.
 * Legacy/starter machines stamped with ownerId === 'system' belong to the world creator (worldOwnerId).
 */
export function isMachinePlacedByPlayer(
  machine: Pick<PlacedMachine, 'ownerId'>,
  playerUid: string,
  worldOwnerId?: string
): boolean {
  if (!playerUid) return false;
  if (machine.ownerId === playerUid) return true;
  if (machine.ownerId === 'system' && worldOwnerId && worldOwnerId === playerUid) return true;
  return false;
}

export interface ItemMetadata {
  id: ResourceItemId;
  name: string;
  shortName: string;
  category: 'block' | 'ore' | 'clump' | 'ingot' | 'fuel' | 'machine' | 'augment' | 'utility';
  modSuite: string;
  color: string;
  accentColor: string;
  sellPrice: number;
  buyPrice?: number;
  placeableKind?: TerrainBlockKind | MachineKind | 'power_cable';
  description: string;
}

export interface AugmentSpec {
  id: AugmentId;
  name: string;
  shortName: string;
  modSuite: string;
  color: string;
  buyPrice: number;
  effectSummary: string;
  description: string;
}

export const AUGMENT_SPECS: Record<AugmentId, AugmentSpec> = {
  aug_speed_flux: {
    id: 'aug_speed_flux',
    name: 'Flux Speed Overclocker',
    shortName: '+55% Spd',
    modSuite: 'Thermal & Mekanism',
    color: '#ef4444',
    buyPrice: 360,
    effectSummary: '+55% Processing Speed per Augment',
    description: 'Overclocks machine tick rate by +55% per installed unit (up to +165% with 3 installed).',
  },
  aug_yield_sieve: {
    id: 'aug_yield_sieve',
    name: 'Auxiliary Ore Sieve',
    shortName: '+1 Yield',
    modSuite: 'Ender IO & Mekanism',
    color: '#10b981',
    buyPrice: 460,
    effectSummary: '+1 Bonus Output (3×–5× Ore & Firewood Yield)',
    description: 'Adds +1 extra Crushed Clump, Split Firewood Bundle, or Excavated Ore per cycle.',
  },
  aug_fe_coil: {
    id: 'aug_fe_coil',
    name: 'Efficiency Dynamo Coil',
    shortName: 'FE Coil',
    modSuite: 'Thermal & Powah!',
    color: '#f59e0b',
    buyPrice: 380,
    effectSummary: '-25% FE/t Load or +50% Generator FE/t',
    description: 'Reduces FE/t draw on processing machines by 25%, or boosts Firewood Boiler & Reactor output by +50%.',
  },
  aug_me_bus: {
    id: 'aug_me_bus',
    name: 'ME Auto-Import/Export Bus',
    shortName: 'ME Bus',
    modSuite: 'Applied Energistics 2',
    color: '#38bdf8',
    buyPrice: 420,
    effectSummary: 'Direct Wireless AE2 ME Network I/O',
    description: 'Automatically pulls raw inputs from and pushes finished products straight into your world ME Storage Network.',
  },
};

export interface MachineSpec {
  kind: MachineKind;
  name: string;
  modSuite: string;
  generationKw: number; // Base FE/t generated
  consumeKw: number; // Base FE/t consumed
  batteryCapacity: number; // Base FE buffer capacity
  cycleSeconds: number;
  buyPrice: number;
  placeCostCoins: number; // 0 in pure FTB Factory Sandbox!
  description: string;
}

export const MACHINE_SPECS: Record<MachineKind, MachineSpec> = {
  firewood_splitter: {
    kind: 'firewood_splitter',
    name: 'Firewood Splitter & Sawmill',
    modSuite: 'Forestry & Thermal',
    generationKw: 0,
    consumeKw: 25,
    batteryCapacity: 0,
    cycleSeconds: 3,
    buyPrice: 240,
    placeCostCoins: 0,
    description: 'Splits 1 Wood Log into 4 Split Firewood Bundles (+1 per Sieve Augment) and Sawdust byproduct.',
  },
  firewood_boiler: {
    kind: 'firewood_boiler',
    name: 'High-Pressure Firewood Boiler',
    modSuite: 'Forestry & Railcraft',
    generationKw: 130,
    consumeKw: 0,
    batteryCapacity: 4000,
    cycleSeconds: 1,
    buyPrice: 280,
    placeCostCoins: 0,
    description: 'Coal & Firewood-fired steam boiler (130 FE/t, +65 FE/t per FE Coil). Essential backup power during Night, Light Rain, or Dense Fog when Solar Panel efficiency drops (burns backup fuel faster in wet/foggy weather).',
  },
  forestry_multifarm: {
    kind: 'forestry_multifarm',
    name: 'Forestry Arboretum Multifarm',
    modSuite: 'Forestry',
    generationKw: 0,
    consumeKw: 45,
    batteryCapacity: 0,
    cycleSeconds: 4,
    buyPrice: 450,
    placeCostCoins: 0,
    description: 'Automated tree multifarm that continuously harvests Wood Logs, Split Firewood, and Saplings for your Firewood Boiler chain.',
  },
  powah_reactor: {
    kind: 'powah_reactor',
    name: 'Powah! Thermo & Nitro Reactor',
    modSuite: 'Powah!',
    generationKw: 540,
    consumeKw: 0,
    batteryCapacity: 30000,
    cycleSeconds: 1,
    buyPrice: 1250,
    placeCostCoins: 0,
    description: 'Generates passive 150 FE/t geothermal power, or 540+ FE/t when fueled with Blazegold, Certus Crystal, or Firewood.',
  },
  flux_battery: {
    kind: 'flux_battery',
    name: 'Thermal Flux Capacitor Bank',
    modSuite: 'Thermal Expansion',
    generationKw: 0,
    consumeKw: 0,
    batteryCapacity: 60000,
    cycleSeconds: 1,
    buyPrice: 420,
    placeCostCoins: 0,
    description: 'Stores 60,000 FE (+30,000 FE per Efficiency Coil Augment) and stabilizes peak factory energy loads.',
  },
  digital_miner: {
    kind: 'digital_miner',
    name: 'Mekanism Digital Miner',
    modSuite: 'Mekanism',
    generationKw: 0,
    consumeKw: 150,
    batteryCapacity: 0,
    cycleSeconds: 4,
    buyPrice: 1100,
    placeCostCoins: 0,
    description: 'Scans deep strata to excavate Copper, Iron, Gold, Certus Quartz, Coal, and Osmium ores (+1 bonus ore per Sieve Augment).',
  },
  sag_mill: {
    kind: 'sag_mill',
    name: 'Ender IO SAG Mill & Crusher',
    modSuite: 'Ender IO & Mekanism',
    generationKw: 0,
    consumeKw: 55,
    batteryCapacity: 0,
    cycleSeconds: 3,
    buyPrice: 480,
    placeCostCoins: 0,
    description: 'Crushes 1 Raw Ore into 2 Crushed Ore Clumps (+1 per Auxiliary Ore Sieve Augment for 3× to 5× ore multiplication!).',
  },
  alloy_smelter: {
    kind: 'alloy_smelter',
    name: 'Ender IO Alloy & Energized Smelter',
    modSuite: 'Ender IO & Mekanism',
    generationKw: 0,
    consumeKw: 65,
    batteryCapacity: 0,
    cycleSeconds: 3,
    buyPrice: 520,
    placeCostCoins: 0,
    description: 'Smelts Crushed Ore Clumps into pure ingots and fuses FTB alloys: Energetic Alloy, Vibrant Alloy, Blazegold, Steel Plate, and AE2 Certus Processors.',
  },
  me_controller: {
    kind: 'me_controller',
    name: 'AE2 ME Controller & Storage Drive',
    modSuite: 'Applied Energistics 2',
    generationKw: 0,
    consumeKw: 35,
    batteryCapacity: 12000,
    cycleSeconds: 1,
    buyPrice: 640,
    placeCostCoins: 0,
    description: 'Digitizes all factory items into a unified AE2 / Refined Storage ME Network accessible from any machine or your Wireless ME Grid (G).',
  },
  molecular_assembler: {
    kind: 'molecular_assembler',
    name: 'AE2 Molecular Assembler',
    modSuite: 'Applied Energistics 2',
    generationKw: 0,
    consumeKw: 85,
    batteryCapacity: 0,
    cycleSeconds: 4,
    buyPrice: 820,
    placeCostCoins: 0,
    description: 'Automated pattern crafter that pulls ingredients from your ME Network to continuously manufacture conduits, augments, and machines.',
  },
  dire_automator: {
    kind: 'dire_automator',
    name: 'Just Dire Block Automator',
    modSuite: 'Just Dire Things',
    generationKw: 0,
    consumeKw: 40,
    batteryCapacity: 0,
    cycleSeconds: 3,
    buyPrice: 380,
    placeCostCoins: 0,
    description: 'In-world block breaker/placer that synthesizes Cobblestone, Sand, and Wood Logs directly into your ME Network.',
  },
  // Legacy compatibility mappings (zero placement cost, auto-upgraded in UI)
  coal_generator: {
    kind: 'coal_generator',
    name: 'High-Pressure Firewood Boiler',
    modSuite: 'Forestry & Railcraft',
    generationKw: 130,
    consumeKw: 0,
    batteryCapacity: 4000,
    cycleSeconds: 1,
    buyPrice: 280,
    placeCostCoins: 0,
    description: 'Burns Split Firewood Bundles or Coal for 130 FE/t.',
  },
  solar_array: {
    kind: 'solar_array',
    name: 'Solar Panel Array',
    modSuite: 'Powah! Solar',
    generationKw: 160,
    consumeKw: 0,
    batteryCapacity: 6000,
    cycleSeconds: 1,
    buyPrice: 460,
    placeCostCoins: 0,
    description: 'Clean daytime photovoltaic generator (up to 160 FE/t in Clear Skies). Efficiency drops to 40% in Light Rain and 55% in Dense Fog — pair with Coal/Firewood Boilers for backup power.',
  },
  battery_bank: {
    kind: 'battery_bank',
    name: 'Thermal Flux Capacitor Bank',
    modSuite: 'Thermal Expansion',
    generationKw: 0,
    consumeKw: 0,
    batteryCapacity: 60000,
    cycleSeconds: 1,
    buyPrice: 420,
    placeCostCoins: 0,
    description: 'Stores 60,000 FE buffer energy.',
  },
  auto_miner: {
    kind: 'auto_miner',
    name: 'Mekanism Digital Miner',
    modSuite: 'Mekanism',
    generationKw: 0,
    consumeKw: 150,
    batteryCapacity: 0,
    cycleSeconds: 4,
    buyPrice: 1100,
    placeCostCoins: 0,
    description: 'Automated deep-strata ore excavator.',
  },
  electric_smelter: {
    kind: 'electric_smelter',
    name: 'Ender IO Alloy & Energized Smelter',
    modSuite: 'Ender IO & Mekanism',
    generationKw: 0,
    consumeKw: 65,
    batteryCapacity: 0,
    cycleSeconds: 3,
    buyPrice: 520,
    placeCostCoins: 0,
    description: 'Smelts crushed clumps and alloys.',
  },
  auto_crafter: {
    kind: 'auto_crafter',
    name: 'AE2 Molecular Assembler',
    modSuite: 'Applied Energistics 2',
    generationKw: 0,
    consumeKw: 85,
    batteryCapacity: 0,
    cycleSeconds: 4,
    buyPrice: 820,
    placeCostCoins: 0,
    description: 'Pattern auto-crafter connected to ME storage.',
  },
  storage_terminal: {
    kind: 'storage_terminal',
    name: 'AE2 ME Controller & Storage Drive',
    modSuite: 'Applied Energistics 2',
    generationKw: 0,
    consumeKw: 35,
    batteryCapacity: 12000,
    cycleSeconds: 1,
    buyPrice: 640,
    placeCostCoins: 0,
    description: 'Central AE2 ME digital storage hub.',
  },
  claim_beacon: {
    kind: 'claim_beacon',
    name: '2-Chunk Territory Claim Beacon (24×12)',
    modSuite: 'FTB Chunks',
    generationKw: 0,
    consumeKw: 0,
    batteryCapacity: 0,
    cycleSeconds: 1,
    buyPrice: 220,
    placeCostCoins: 0,
    description:
      'Claims a 2-Chunk territory (2× 12×12 chunks = 24×12 blocks) that only you can access unless you add players to your Trusted List with custom permissions (Toggle Machines, Build, Open Chests, Use Levers).',
  },
};

export const ITEMS: Record<ResourceItemId, ItemMetadata> = {
  grass: {
    id: 'grass',
    name: 'Turf Block',
    shortName: 'Grass',
    category: 'block',
    modSuite: 'Vanilla',
    color: '#4f9e46',
    accentColor: '#6d5038',
    sellPrice: 1,
    buyPrice: 4,
    placeableKind: 'grass',
    description: 'Surface grass block.',
  },
  dirt: {
    id: 'dirt',
    name: 'Soil Block',
    shortName: 'Dirt',
    category: 'block',
    modSuite: 'Vanilla',
    color: '#78553a',
    accentColor: '#5e402a',
    sellPrice: 1,
    buyPrice: 4,
    placeableKind: 'dirt',
    description: 'Compact earth for Forestry tree farms.',
  },
  stone: {
    id: 'stone',
    name: 'Laboratory Stone',
    shortName: 'Stone',
    category: 'block',
    modSuite: 'Chisel & FTB',
    color: '#7c8594',
    accentColor: '#5f6775',
    sellPrice: 2,
    buyPrice: 6,
    placeableKind: 'stone',
    description: 'Smooth Direwolf20 laboratory stone block.',
  },
  cobblestone: {
    id: 'cobblestone',
    name: 'Cobblestone',
    shortName: 'Cobble',
    category: 'block',
    modSuite: 'Vanilla',
    color: '#69717d',
    accentColor: '#4c525c',
    sellPrice: 2,
    buyPrice: 5,
    placeableKind: 'cobblestone',
    description: 'Rough quarried stone; can be crushed into Sand in a SAG Mill.',
  },
  wood_log: {
    id: 'wood_log',
    name: 'Timber Log',
    shortName: 'Log',
    category: 'fuel',
    modSuite: 'Forestry',
    color: '#7a5230',
    accentColor: '#b58d5b',
    sellPrice: 4,
    buyPrice: 10,
    placeableKind: 'wood_log',
    description: 'Raw timber log. Feed into a Firewood Splitter to produce 4× Split Firewood Bundles!',
  },
  wood_planks: {
    id: 'wood_planks',
    name: 'Treated Wood Planks',
    shortName: 'Planks',
    category: 'block',
    modSuite: 'Forestry',
    color: '#b88c56',
    accentColor: '#8f693c',
    sellPrice: 3,
    buyPrice: 8,
    placeableKind: 'wood_planks',
    description: 'Sawn structural timber planks.',
  },
  leaves: {
    id: 'leaves',
    name: 'Arboretum Foliage',
    shortName: 'Leaves',
    category: 'block',
    modSuite: 'Forestry',
    color: '#3a7d3b',
    accentColor: '#295e2a',
    sellPrice: 1,
    buyPrice: 4,
    placeableKind: 'leaves',
    description: 'Biomass foliage harvested by Forestry Multifarms.',
  },
  sand: {
    id: 'sand',
    name: 'Silica Sand',
    shortName: 'Sand',
    category: 'block',
    modSuite: 'AE2 & Thermal',
    color: '#dfd19b',
    accentColor: '#c4b378',
    sellPrice: 2,
    buyPrice: 6,
    placeableKind: 'sand',
    description: 'Fine silica sand for smelting Reinforced Glass and Silicon.',
  },
  brick: {
    id: 'brick',
    name: 'Coke Oven Brick',
    shortName: 'Brick',
    category: 'block',
    modSuite: 'Railcraft & FTB',
    color: '#a84a3b',
    accentColor: '#7d3428',
    sellPrice: 5,
    buyPrice: 12,
    placeableKind: 'brick',
    description: 'Heat-resistant industrial masonry brick.',
  },
  glass: {
    id: 'glass',
    name: 'Quartz Clear Glass',
    shortName: 'Glass',
    category: 'block',
    modSuite: 'AE2 & Ender IO',
    color: '#a5f3fc',
    accentColor: '#38bdf8',
    sellPrice: 5,
    buyPrice: 12,
    placeableKind: 'glass',
    description: 'High-clarity connected factory observation glass.',
  },
  iron_block: {
    id: 'iron_block',
    name: 'Factory Machine Casing',
    shortName: 'Casing',
    category: 'block',
    modSuite: 'Mekanism & Thermal',
    color: '#cbd5e1',
    accentColor: '#64748b',
    sellPrice: 18,
    buyPrice: 36,
    placeableKind: 'iron_block',
    description: 'Heavy steel machine frame casing for clean Direwolf20 9×9 factory rooms.',
  },
  torch: {
    id: 'torch',
    name: 'Glowstone Luminator Torch',
    shortName: 'Torch',
    category: 'block',
    modSuite: 'FTB Lighting',
    color: '#fbbf24',
    accentColor: '#d97706',
    sellPrice: 4,
    buyPrice: 10,
    placeableKind: 'torch',
    description: 'High-lumen workshop torch.',
  },
  mob_spawner: {
    id: 'mob_spawner',
    name: 'Monster Spawner Cage',
    shortName: 'Spawner',
    category: 'block',
    modSuite: 'Minecraft Dungeon',
    color: '#1e293b',
    accentColor: '#ea580c',
    sellPrice: 85,
    buyPrice: 190,
    placeableKind: 'mob_spawner',
    description:
      'Forged-iron dungeon spawner cage. Activates at night in Survival when a player is within 16 blocks. Place a Torch within 5 blocks to suppress.',
  },
  wood_door: {
    id: 'wood_door',
    name: 'Workshop Door',
    shortName: 'W.Door',
    category: 'block',
    modSuite: 'Vanilla',
    color: '#9c6f44',
    accentColor: '#694728',
    sellPrice: 8,
    buyPrice: 20,
    placeableKind: 'wood_door',
    description: 'Click in-world to open or close.',
  },
  iron_door: {
    id: 'iron_door',
    name: 'Airlock Security Door',
    shortName: 'S.Door',
    category: 'block',
    modSuite: 'Mekanism',
    color: '#94a3b8',
    accentColor: '#475569',
    sellPrice: 22,
    buyPrice: 48,
    placeableKind: 'iron_door',
    description: 'Reinforced reactor room door. Requires Use Levers & Doors permission in claimed areas.',
  },
  chest: {
    id: 'chest',
    name: 'Reinforced Storage Chest',
    shortName: 'Chest',
    category: 'block',
    modSuite: 'Iron Chests',
    color: '#b45309',
    accentColor: '#facc15',
    sellPrice: 14,
    buyPrice: 32,
    placeableKind: 'chest',
    description:
      'Click in-world to open shared storage. Inside a 2-chunk claim, requires Open Chests permission.',
  },
  lever: {
    id: 'lever',
    name: 'Redstone Machine Control Lever',
    shortName: 'Lever',
    category: 'block',
    modSuite: 'Redstone Control',
    color: '#ef4444',
    accentColor: '#64748b',
    sellPrice: 8,
    buyPrice: 18,
    placeableKind: 'lever',
    description:
      'Click in-world to flip ON/OFF and toggle nearby machines. Inside a 2-chunk claim, requires Use Levers permission.',
  },
  // Raw Ores & Fuels
  coal: {
    id: 'coal',
    name: 'Thermal Coal',
    shortName: 'Coal',
    category: 'fuel',
    modSuite: 'Vanilla & Thermal',
    color: '#27272a',
    accentColor: '#52525b',
    sellPrice: 6,
    buyPrice: 14,
    description: 'Standard carbon fuel (25s boiler burn) and steel alloying input.',
  },
  firewood_bundle: {
    id: 'firewood_bundle',
    name: 'Split Firewood Bundle',
    shortName: 'Firewood',
    category: 'fuel',
    modSuite: 'Forestry & Firewood',
    color: '#c26d2d',
    accentColor: '#f59e0b',
    sellPrice: 9,
    buyPrice: 16,
    description: 'Kiln-dried split firewood! Burns for 45 seconds at high pressure in a Firewood Boiler (180+ FE/t).',
  },
  sawdust: {
    id: 'sawdust',
    name: 'Compressed Sawdust',
    shortName: 'Sawdust',
    category: 'fuel',
    modSuite: 'Thermal & Forestry',
    color: '#d6b27c',
    accentColor: '#a37e49',
    sellPrice: 4,
    buyPrice: 8,
    description: 'Byproduct from splitting Firewood. Can be burned or compressed into Planks.',
  },
  copper_ore: {
    id: 'copper_ore',
    name: 'Raw Copper Ore',
    shortName: 'Cu Ore',
    category: 'ore',
    modSuite: 'Mekanism & Thermal',
    color: '#d97706',
    accentColor: '#78716c',
    sellPrice: 8,
    buyPrice: 18,
    description: 'Crush in a SAG Mill for 2×–4× Crushed Copper Clumps!',
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Raw Iron Ore',
    shortName: 'Fe Ore',
    category: 'ore',
    modSuite: 'Mekanism & Thermal',
    color: '#e11d48',
    accentColor: '#78716c',
    sellPrice: 12,
    buyPrice: 26,
    description: 'Crush in a SAG Mill for 2×–4× Crushed Iron Clumps!',
  },
  gold_ore: {
    id: 'gold_ore',
    name: 'Raw Gold Ore',
    shortName: 'Au Ore',
    category: 'ore',
    modSuite: 'Mekanism & Thermal',
    color: '#facc15',
    accentColor: '#854d0e',
    sellPrice: 20,
    buyPrice: 44,
    description: 'Crush in a SAG Mill for 2×–4× Crushed Gold Clumps!',
  },
  crystal_ore: {
    id: 'crystal_ore',
    name: 'Certus Quartz Ore',
    shortName: 'Certus',
    category: 'ore',
    modSuite: 'Applied Energistics 2',
    color: '#38bdf8',
    accentColor: '#0284c7',
    sellPrice: 28,
    buyPrice: 60,
    description: 'Crystalline AE2 ore used for ME Storage Drives, Processors, and Flux Augments.',
  },
  diamond: {
    id: 'diamond',
    name: 'Osmium & Diamond Core',
    shortName: 'Osmium',
    category: 'ore',
    modSuite: 'Mekanism & Powah!',
    color: '#22d3ee',
    accentColor: '#0891b2',
    sellPrice: 55,
    buyPrice: 110,
    description: 'High-density deep Mekanism Osmium / Diamond crystal for Tier-3 machines and Powah! Reactors.',
  },
  // Crushed Ore Clumps (Ore Multiplication intermediate)
  crushed_copper: {
    id: 'crushed_copper',
    name: 'Crushed Copper Clump',
    shortName: 'Cu Clump',
    category: 'clump',
    modSuite: 'Mekanism & Ender IO',
    color: '#fb923c',
    accentColor: '#c2410c',
    sellPrice: 10,
    buyPrice: 20,
    description: 'Purified copper clump from SAG Mill. Smelt in Alloy Smelter into Copper Ingots.',
  },
  crushed_iron: {
    id: 'crushed_iron',
    name: 'Crushed Iron Clump',
    shortName: 'Fe Clump',
    category: 'clump',
    modSuite: 'Mekanism & Ender IO',
    color: '#fda4af',
    accentColor: '#be123c',
    sellPrice: 15,
    buyPrice: 30,
    description: 'Purified iron clump from SAG Mill. Smelt in Alloy Smelter into Iron Ingots or Steel.',
  },
  crushed_gold: {
    id: 'crushed_gold',
    name: 'Crushed Gold Clump',
    shortName: 'Au Clump',
    category: 'clump',
    modSuite: 'Mekanism & Ender IO',
    color: '#fde047',
    accentColor: '#ca8a04',
    sellPrice: 24,
    buyPrice: 48,
    description: 'Purified gold clump from SAG Mill. Smelt in Alloy Smelter into Gold Ingots or Energetic Alloy.',
  },
  crushed_osmium: {
    id: 'crushed_osmium',
    name: 'Purified Osmium Clump',
    shortName: 'Os Clump',
    category: 'clump',
    modSuite: 'Mekanism',
    color: '#67e8f9',
    accentColor: '#0e7490',
    sellPrice: 45,
    buyPrice: 90,
    description: 'Multiplied deep-strata Osmium/Diamond clump.',
  },
  // Smelted Ingots, Alloys & Processors
  copper_ingot: {
    id: 'copper_ingot',
    name: 'Copper Ingot',
    shortName: 'Cu Ingot',
    category: 'ingot',
    modSuite: 'Thermal & Mekanism',
    color: '#f97316',
    accentColor: '#c2410c',
    sellPrice: 14,
    buyPrice: 28,
    description: 'Conductive copper bar for Universal Conduits, Splitters, and Boilers.',
  },
  iron_ingot: {
    id: 'iron_ingot',
    name: 'Refined Iron Ingot',
    shortName: 'Fe Ingot',
    category: 'ingot',
    modSuite: 'Thermal & Mekanism',
    color: '#e2e8f0',
    accentColor: '#94a3b8',
    sellPrice: 20,
    buyPrice: 40,
    description: 'Structural metal bar for FTB machines, Multifarms, and Conduits.',
  },
  gold_ingot: {
    id: 'gold_ingot',
    name: 'Gold Ingot',
    shortName: 'Au Ingot',
    category: 'ingot',
    modSuite: 'Thermal & Ender IO',
    color: '#eab308',
    accentColor: '#a16207',
    sellPrice: 34,
    buyPrice: 68,
    description: 'High-conductivity gold bar for Flux Coils, AE2 Processors, and Energetic Alloy.',
  },
  aether_crystal: {
    id: 'aether_crystal',
    name: 'Charged Certus Quartz',
    shortName: 'Charged Qtz',
    category: 'ingot',
    modSuite: 'Applied Energistics 2',
    color: '#38bdf8',
    accentColor: '#0369a1',
    sellPrice: 48,
    buyPrice: 95,
    description: 'Energized AE2 Certus Quartz crystal for ME networks and Flux Overclockers.',
  },
  steel_plate: {
    id: 'steel_plate',
    name: 'Infused Steel Plate',
    shortName: 'Steel',
    category: 'ingot',
    modSuite: 'Mekanism',
    color: '#64748b',
    accentColor: '#334155',
    sellPrice: 42,
    buyPrice: 82,
    description: 'Carbon-infused Mekanism steel plate for Digital Miners, Boilers, and Reactors.',
  },
  energetic_alloy: {
    id: 'energetic_alloy',
    name: 'Energetic Alloy Ingot',
    shortName: 'Energetic',
    category: 'ingot',
    modSuite: 'Ender IO',
    color: '#fb923c',
    accentColor: '#ea580c',
    sellPrice: 52,
    buyPrice: 100,
    description: 'Ender IO conductive alloy fused from Gold and Charged Certus Quartz.',
  },
  vibrant_alloy: {
    id: 'vibrant_alloy',
    name: 'Vibrant Alloy Ingot',
    shortName: 'Vibrant',
    category: 'ingot',
    modSuite: 'Ender IO',
    color: '#a3e635',
    accentColor: '#4d7c0f',
    sellPrice: 75,
    buyPrice: 145,
    description: 'Tier-3 Ender IO phase alloy for high-speed conduits and overclockers.',
  },
  blazegold_ingot: {
    id: 'blazegold_ingot',
    name: 'Just Dire Blazegold Ingot',
    shortName: 'Blazegold',
    category: 'ingot',
    modSuite: 'Just Dire Things & Powah!',
    color: '#f59e0b',
    accentColor: '#b45309',
    sellPrice: 64,
    buyPrice: 125,
    description: 'Superheated Just Dire Things alloy; powers Powah! Nitro Reactors for 90s at max output!',
  },
  certus_processor: {
    id: 'certus_processor',
    name: 'AE2 Engineering Processor',
    shortName: 'Processor',
    category: 'ingot',
    modSuite: 'Applied Energistics 2',
    color: '#06b6d4',
    accentColor: '#155e75',
    sellPrice: 68,
    buyPrice: 130,
    description: 'Printed AE2 silicon & gold logic processor for ME Controllers, Assemblers, and ME Buses.',
  },
  // Universal Conduit
  power_cable: {
    id: 'power_cable',
    name: 'Ender IO Universal Conduit (FE + ME + Item)',
    shortName: 'Conduit',
    category: 'utility',
    modSuite: 'Ender IO',
    color: '#f59e0b',
    accentColor: '#06b6d4',
    sellPrice: 10,
    buyPrice: 18,
    placeableKind: 'power_cable',
    description: 'Bundled 3-in-1 Ender IO conduit routing Forge Energy (FE/t), Items, and AE2 ME Data in a single block!',
  },
  // 4 Machine Augment Addons
  aug_speed_flux: {
    id: 'aug_speed_flux',
    name: 'Augment: Flux Speed Overclocker',
    shortName: 'Aug:Speed',
    category: 'augment',
    modSuite: 'Thermal & Mekanism',
    color: '#ef4444',
    accentColor: '#991b1b',
    sellPrice: 110,
    buyPrice: 360,
    description: 'Install in any machine’s 3-Slot Augment Rack for +55% processing speed per augment.',
  },
  aug_yield_sieve: {
    id: 'aug_yield_sieve',
    name: 'Augment: Auxiliary Ore Sieve',
    shortName: 'Aug:Yield',
    category: 'augment',
    modSuite: 'Ender IO & Mekanism',
    color: '#10b981',
    accentColor: '#065f46',
    sellPrice: 140,
    buyPrice: 460,
    description: 'Install in SAG Mill, Firewood Splitter, Digital Miner, or Multifarm for +1 bonus output per operation!',
  },
  aug_fe_coil: {
    id: 'aug_fe_coil',
    name: 'Augment: Efficiency Dynamo Coil',
    shortName: 'Aug:Coil',
    category: 'augment',
    modSuite: 'Thermal & Powah!',
    color: '#f59e0b',
    accentColor: '#92400e',
    sellPrice: 120,
    buyPrice: 380,
    description: 'Install in machines for -25% FE/t draw, or in Firewood Boilers / Reactors for +50% FE/t power output!',
  },
  aug_me_bus: {
    id: 'aug_me_bus',
    name: 'Augment: ME Auto-Import/Export Bus',
    shortName: 'Aug:ME Bus',
    category: 'augment',
    modSuite: 'Applied Energistics 2',
    color: '#38bdf8',
    accentColor: '#0369a1',
    sellPrice: 130,
    buyPrice: 420,
    description: 'Links a machine wirelessly to your world’s AE2 ME Storage Network without needing physical cables.',
  },
  // 11 FTB Direwolf20 Placeable Machines
  firewood_splitter: {
    id: 'firewood_splitter',
    name: 'Firewood Splitter & Sawmill',
    shortName: 'Splitter',
    category: 'machine',
    modSuite: 'Forestry & Thermal',
    color: '#d97706',
    accentColor: '#78350f',
    sellPrice: 90,
    buyPrice: 240,
    placeableKind: 'firewood_splitter',
    description: MACHINE_SPECS.firewood_splitter.description,
  },
  firewood_boiler: {
    id: 'firewood_boiler',
    name: 'High-Pressure Firewood Boiler',
    shortName: 'Boiler',
    category: 'machine',
    modSuite: 'Forestry & Railcraft',
    color: '#ea580c',
    accentColor: '#7c2d12',
    sellPrice: 110,
    buyPrice: 280,
    placeableKind: 'firewood_boiler',
    description: MACHINE_SPECS.firewood_boiler.description,
  },
  forestry_multifarm: {
    id: 'forestry_multifarm',
    name: 'Forestry Arboretum Multifarm',
    shortName: 'Multifarm',
    category: 'machine',
    modSuite: 'Forestry',
    color: '#16a34a',
    accentColor: '#14532d',
    sellPrice: 180,
    buyPrice: 450,
    placeableKind: 'forestry_multifarm',
    description: MACHINE_SPECS.forestry_multifarm.description,
  },
  powah_reactor: {
    id: 'powah_reactor',
    name: 'Powah! Thermo & Nitro Reactor',
    shortName: 'Reactor',
    category: 'machine',
    modSuite: 'Powah!',
    color: '#dc2626',
    accentColor: '#7f1d1d',
    sellPrice: 480,
    buyPrice: 1250,
    placeableKind: 'powah_reactor',
    description: MACHINE_SPECS.powah_reactor.description,
  },
  flux_battery: {
    id: 'flux_battery',
    name: 'Thermal Flux Capacitor Bank',
    shortName: 'FluxBank',
    category: 'machine',
    modSuite: 'Thermal Expansion',
    color: '#f59e0b',
    accentColor: '#b45309',
    sellPrice: 170,
    buyPrice: 420,
    placeableKind: 'flux_battery',
    description: MACHINE_SPECS.flux_battery.description,
  },
  digital_miner: {
    id: 'digital_miner',
    name: 'Mekanism Digital Miner',
    shortName: 'DigMiner',
    category: 'machine',
    modSuite: 'Mekanism',
    color: '#38bdf8',
    accentColor: '#1e3a8a',
    sellPrice: 420,
    buyPrice: 1100,
    placeableKind: 'digital_miner',
    description: MACHINE_SPECS.digital_miner.description,
  },
  sag_mill: {
    id: 'sag_mill',
    name: 'Ender IO SAG Mill & Crusher',
    shortName: 'SAG Mill',
    category: 'machine',
    modSuite: 'Ender IO & Mekanism',
    color: '#10b981',
    accentColor: '#064e3b',
    sellPrice: 190,
    buyPrice: 480,
    placeableKind: 'sag_mill',
    description: MACHINE_SPECS.sag_mill.description,
  },
  alloy_smelter: {
    id: 'alloy_smelter',
    name: 'Ender IO Alloy & Energized Smelter',
    shortName: 'Smelter',
    category: 'machine',
    modSuite: 'Ender IO & Mekanism',
    color: '#f97316',
    accentColor: '#9a3412',
    sellPrice: 210,
    buyPrice: 520,
    placeableKind: 'alloy_smelter',
    description: MACHINE_SPECS.alloy_smelter.description,
  },
  me_controller: {
    id: 'me_controller',
    name: 'AE2 ME Controller & Storage Drive',
    shortName: 'ME Drive',
    category: 'machine',
    modSuite: 'Applied Energistics 2',
    color: '#06b6d4',
    accentColor: '#164e63',
    sellPrice: 250,
    buyPrice: 640,
    placeableKind: 'me_controller',
    description: MACHINE_SPECS.me_controller.description,
  },
  molecular_assembler: {
    id: 'molecular_assembler',
    name: 'AE2 Molecular Assembler',
    shortName: 'Assembler',
    category: 'machine',
    modSuite: 'Applied Energistics 2',
    color: '#8b5cf6',
    accentColor: '#4c1d95',
    sellPrice: 320,
    buyPrice: 820,
    placeableKind: 'molecular_assembler',
    description: MACHINE_SPECS.molecular_assembler.description,
  },
  dire_automator: {
    id: 'dire_automator',
    name: 'Just Dire Block Automator',
    shortName: 'Automator',
    category: 'machine',
    modSuite: 'Just Dire Things',
    color: '#ec4899',
    accentColor: '#831843',
    sellPrice: 150,
    buyPrice: 380,
    placeableKind: 'dire_automator',
    description: MACHINE_SPECS.dire_automator.description,
  },
  // Legacy item compatibility entries
  coal_generator: {
    id: 'coal_generator',
    name: 'High-Pressure Firewood Boiler',
    shortName: 'Boiler',
    category: 'machine',
    modSuite: 'Forestry',
    color: '#ea580c',
    accentColor: '#7c2d12',
    sellPrice: 110,
    buyPrice: 280,
    placeableKind: 'firewood_boiler',
    description: MACHINE_SPECS.firewood_boiler.description,
  },
  solar_array: {
    id: 'solar_array',
    name: 'Solar Panel Array',
    shortName: 'Solar',
    category: 'machine',
    modSuite: 'Powah! Solar',
    color: '#1d4ed8',
    accentColor: '#38bdf8',
    sellPrice: 210,
    buyPrice: 460,
    placeableKind: 'solar_array',
    description: MACHINE_SPECS.solar_array.description,
  },
  battery_bank: {
    id: 'battery_bank',
    name: 'Thermal Flux Capacitor Bank',
    shortName: 'FluxBank',
    category: 'machine',
    modSuite: 'Thermal Expansion',
    color: '#f59e0b',
    accentColor: '#b45309',
    sellPrice: 170,
    buyPrice: 420,
    placeableKind: 'flux_battery',
    description: MACHINE_SPECS.flux_battery.description,
  },
  auto_miner: {
    id: 'auto_miner',
    name: 'Mekanism Digital Miner',
    shortName: 'DigMiner',
    category: 'machine',
    modSuite: 'Mekanism',
    color: '#38bdf8',
    accentColor: '#1e3a8a',
    sellPrice: 420,
    buyPrice: 1100,
    placeableKind: 'digital_miner',
    description: MACHINE_SPECS.digital_miner.description,
  },
  electric_smelter: {
    id: 'electric_smelter',
    name: 'Ender IO Alloy & Energized Smelter',
    shortName: 'Smelter',
    category: 'machine',
    modSuite: 'Ender IO',
    color: '#f97316',
    accentColor: '#9a3412',
    sellPrice: 210,
    buyPrice: 520,
    placeableKind: 'alloy_smelter',
    description: MACHINE_SPECS.alloy_smelter.description,
  },
  auto_crafter: {
    id: 'auto_crafter',
    name: 'AE2 Molecular Assembler',
    shortName: 'Assembler',
    category: 'machine',
    modSuite: 'Applied Energistics 2',
    color: '#8b5cf6',
    accentColor: '#4c1d95',
    sellPrice: 320,
    buyPrice: 820,
    placeableKind: 'molecular_assembler',
    description: MACHINE_SPECS.molecular_assembler.description,
  },
  storage_terminal: {
    id: 'storage_terminal',
    name: 'AE2 ME Controller & Storage Drive',
    shortName: 'ME Drive',
    category: 'machine',
    modSuite: 'Applied Energistics 2',
    color: '#06b6d4',
    accentColor: '#164e63',
    sellPrice: 250,
    buyPrice: 640,
    placeableKind: 'me_controller',
    description: MACHINE_SPECS.me_controller.description,
  },
  claim_beacon: {
    id: 'claim_beacon',
    name: '2-Chunk Territory Claim Beacon (24×12)',
    shortName: '2ChunkClaim',
    category: 'machine',
    modSuite: 'FTB Chunks',
    color: '#10b981',
    accentColor: '#059669',
    sellPrice: 90,
    buyPrice: 220,
    placeableKind: 'claim_beacon',
    description:
      'Claims a 2-Chunk territory (2× 12×12 chunks = 24×12 blocks) locked to you and your Trusted List.',
  },
  cooked_ration: {
    id: 'cooked_ration',
    name: 'Energized Field Ration',
    shortName: 'Ration',
    category: 'utility',
    modSuite: 'Thermal',
    color: '#ea580c',
    accentColor: '#9a3412',
    sellPrice: 12,
    buyPrice: 28,
    description: 'Restores +40 Health.',
  },
};

export interface SmeltRecipe {
  id: string;
  name: string;
  modSuite: string;
  inputId: ResourceItemId;
  inputQty: number;
  secondaryInputId?: ResourceItemId;
  secondaryInputQty?: number;
  outputId: ResourceItemId;
  outputQty: number;
  bonusOutputId?: ResourceItemId;
  bonusOutputQty?: number;
}

// Recipes for the Firewood Splitter & Sawmill
export const FIREWOOD_SPLITTER_RECIPES: SmeltRecipe[] = [
  {
    id: 'split_oak_firewood',
    name: 'Split Timber Log → 4× Firewood Bundles',
    modSuite: 'Forestry & Firewood',
    inputId: 'wood_log',
    inputQty: 1,
    outputId: 'firewood_bundle',
    outputQty: 4,
    bonusOutputId: 'sawdust',
    bonusOutputQty: 1,
  },
  {
    id: 'saw_timber_planks',
    name: 'Saw Timber Log → 6× Treated Planks',
    modSuite: 'Forestry & Thermal',
    inputId: 'wood_log',
    inputQty: 1,
    outputId: 'wood_planks',
    outputQty: 6,
    bonusOutputId: 'sawdust',
    bonusOutputQty: 1,
  },
  {
    id: 'compress_sawdust_firewood',
    name: 'Compress 2× Sawdust → 2× Firewood Bundles',
    modSuite: 'Forestry & Thermal',
    inputId: 'sawdust',
    inputQty: 2,
    outputId: 'firewood_bundle',
    outputQty: 2,
  },
];

// Recipes for Ender IO SAG Mill / Mekanism Crusher (2x base + 1x per Sieve Augment = up to 5x Ore Multiplication!)
export const SAG_MILL_RECIPES: SmeltRecipe[] = [
  {
    id: 'sag_copper_ore',
    name: 'Crush Copper Ore → 2× Crushed Copper (+Sieve Bonus)',
    modSuite: 'Ender IO & Mekanism',
    inputId: 'copper_ore',
    inputQty: 1,
    outputId: 'crushed_copper',
    outputQty: 2,
  },
  {
    id: 'sag_iron_ore',
    name: 'Crush Iron Ore → 2× Crushed Iron (+Sieve Bonus)',
    modSuite: 'Ender IO & Mekanism',
    inputId: 'iron_ore',
    inputQty: 1,
    outputId: 'crushed_iron',
    outputQty: 2,
  },
  {
    id: 'sag_gold_ore',
    name: 'Crush Gold Ore → 2× Crushed Gold (+Sieve Bonus)',
    modSuite: 'Ender IO & Mekanism',
    inputId: 'gold_ore',
    inputQty: 1,
    outputId: 'crushed_gold',
    outputQty: 2,
  },
  {
    id: 'sag_certus_ore',
    name: 'Crush Certus Quartz Ore → 2× Charged Certus (+Sieve Bonus)',
    modSuite: 'Applied Energistics 2',
    inputId: 'crystal_ore',
    inputQty: 1,
    outputId: 'aether_crystal',
    outputQty: 2,
  },
  {
    id: 'sag_osmium_ore',
    name: 'Crush Osmium/Diamond → 2× Purified Osmium Clump',
    modSuite: 'Mekanism',
    inputId: 'diamond',
    inputQty: 1,
    outputId: 'crushed_osmium',
    outputQty: 2,
  },
  {
    id: 'sag_cobble_sand',
    name: 'Crush Cobblestone → 2× Silica Sand',
    modSuite: 'Ender IO',
    inputId: 'cobblestone',
    inputQty: 1,
    outputId: 'sand',
    outputQty: 2,
  },
];

// Recipes for Ender IO Alloy Smelter / Mekanism Energized Smelter
export const SMELT_RECIPES: SmeltRecipe[] = [
  {
    id: 'smelt_crushed_copper',
    name: 'Smelt Crushed Copper → Copper Ingot',
    modSuite: 'Mekanism & Ender IO',
    inputId: 'crushed_copper',
    inputQty: 1,
    outputId: 'copper_ingot',
    outputQty: 1,
  },
  {
    id: 'smelt_crushed_iron',
    name: 'Smelt Crushed Iron → Refined Iron Ingot',
    modSuite: 'Mekanism & Ender IO',
    inputId: 'crushed_iron',
    inputQty: 1,
    outputId: 'iron_ingot',
    outputQty: 1,
  },
  {
    id: 'smelt_crushed_gold',
    name: 'Smelt Crushed Gold → Gold Ingot',
    modSuite: 'Mekanism & Ender IO',
    inputId: 'crushed_gold',
    inputQty: 1,
    outputId: 'gold_ingot',
    outputQty: 1,
  },
  {
    id: 'smelt_crushed_osmium',
    name: 'Smelt Purified Osmium Clump → Osmium & Diamond Core',
    modSuite: 'Mekanism',
    inputId: 'crushed_osmium',
    inputQty: 1,
    outputId: 'diamond',
    outputQty: 1,
  },
  {
    id: 'smelt_copper_direct',
    name: 'Direct Smelt Raw Copper Ore → Copper Ingot',
    modSuite: 'Vanilla & Thermal',
    inputId: 'copper_ore',
    inputQty: 1,
    outputId: 'copper_ingot',
    outputQty: 1,
  },
  {
    id: 'smelt_iron_direct',
    name: 'Direct Smelt Raw Iron Ore → Iron Ingot',
    modSuite: 'Vanilla & Thermal',
    inputId: 'iron_ore',
    inputQty: 1,
    outputId: 'iron_ingot',
    outputQty: 1,
  },
  {
    id: 'smelt_gold_direct',
    name: 'Direct Smelt Raw Gold Ore → Gold Ingot',
    modSuite: 'Vanilla & Thermal',
    inputId: 'gold_ore',
    inputQty: 1,
    outputId: 'gold_ingot',
    outputQty: 1,
  },
  {
    id: 'alloy_steel_plate',
    name: 'Alloy Infused Steel Plate (2× Iron Ingot + 2× Coal)',
    modSuite: 'Mekanism',
    inputId: 'iron_ingot',
    inputQty: 2,
    secondaryInputId: 'coal',
    secondaryInputQty: 2,
    outputId: 'steel_plate',
    outputQty: 1,
  },
  {
    id: 'alloy_energetic',
    name: 'Alloy Energetic Ingot (Gold Ingot + Charged Certus)',
    modSuite: 'Ender IO',
    inputId: 'gold_ingot',
    inputQty: 1,
    secondaryInputId: 'aether_crystal',
    secondaryInputQty: 1,
    outputId: 'energetic_alloy',
    outputQty: 1,
  },
  {
    id: 'alloy_vibrant',
    name: 'Alloy Vibrant Phase Ingot (Energetic Alloy + Osmium/Diamond)',
    modSuite: 'Ender IO',
    inputId: 'energetic_alloy',
    inputQty: 1,
    secondaryInputId: 'diamond',
    secondaryInputQty: 1,
    outputId: 'vibrant_alloy',
    outputQty: 1,
  },
  {
    id: 'alloy_blazegold',
    name: 'Alloy Just Dire Blazegold (Gold Ingot + 2× Firewood Bundle)',
    modSuite: 'Just Dire Things',
    inputId: 'gold_ingot',
    inputQty: 1,
    secondaryInputId: 'firewood_bundle',
    secondaryInputQty: 2,
    outputId: 'blazegold_ingot',
    outputQty: 1,
  },
  {
    id: 'alloy_certus_processor',
    name: 'Print AE2 Engineering Processor (Charged Certus + Gold)',
    modSuite: 'Applied Energistics 2',
    inputId: 'aether_crystal',
    inputQty: 1,
    secondaryInputId: 'gold_ingot',
    secondaryInputQty: 1,
    outputId: 'certus_processor',
    outputQty: 1,
  },
  {
    id: 'smelt_quartz_glass',
    name: 'Smelt Silica Sand → 2× Quartz Clear Glass',
    modSuite: 'Applied Energistics 2',
    inputId: 'sand',
    inputQty: 1,
    outputId: 'glass',
    outputQty: 2,
  },
];

export interface CraftRecipe {
  id: string;
  name: string;
  modSuite: string;
  category: 'primitive' | 'forestry' | 'mekanism' | 'ae2' | 'powah' | 'augments' | 'building';
  inputs: { itemId: ResourceItemId; qty: number }[];
  outputId: ResourceItemId;
  outputQty: number;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  // Primitive Survival & Hand-Smelting (No Electric Machines Required!)
  {
    id: 'prim_cook_ration',
    name: 'Campfire Cook: 2× Canopy Leaves + 1× Split Firewood → 2× Field Rations (Food)',
    modSuite: 'Minecraft Campfire',
    category: 'primitive',
    inputs: [
      { itemId: 'leaves', qty: 2 },
      { itemId: 'firewood_bundle', qty: 1 },
    ],
    outputId: 'cooked_ration',
    outputQty: 2,
  },
  {
    id: 'prim_smelt_copper',
    name: 'Hand-Smelt: 1× Copper Ore + 1× Coal → 1× Copper Ingot',
    modSuite: 'Minecraft Furnace',
    category: 'primitive',
    inputs: [
      { itemId: 'copper_ore', qty: 1 },
      { itemId: 'coal', qty: 1 },
    ],
    outputId: 'copper_ingot',
    outputQty: 1,
  },
  {
    id: 'prim_smelt_copper_fw',
    name: 'Hand-Smelt: 1× Copper Ore + 1× Split Firewood → 1× Copper Ingot',
    modSuite: 'Minecraft Furnace',
    category: 'primitive',
    inputs: [
      { itemId: 'copper_ore', qty: 1 },
      { itemId: 'firewood_bundle', qty: 1 },
    ],
    outputId: 'copper_ingot',
    outputQty: 1,
  },
  {
    id: 'prim_smelt_iron',
    name: 'Hand-Smelt: 1× Iron Ore + 1× Coal → 1× Iron Ingot',
    modSuite: 'Minecraft Furnace',
    category: 'primitive',
    inputs: [
      { itemId: 'iron_ore', qty: 1 },
      { itemId: 'coal', qty: 1 },
    ],
    outputId: 'iron_ingot',
    outputQty: 1,
  },
  {
    id: 'prim_smelt_iron_fw',
    name: 'Hand-Smelt: 1× Iron Ore + 1× Split Firewood → 1× Iron Ingot',
    modSuite: 'Minecraft Furnace',
    category: 'primitive',
    inputs: [
      { itemId: 'iron_ore', qty: 1 },
      { itemId: 'firewood_bundle', qty: 1 },
    ],
    outputId: 'iron_ingot',
    outputQty: 1,
  },
  {
    id: 'prim_smelt_gold',
    name: 'Hand-Smelt: 1× Gold Ore + 2× Coal → 1× Gold Ingot',
    modSuite: 'Minecraft Furnace',
    category: 'primitive',
    inputs: [
      { itemId: 'gold_ore', qty: 1 },
      { itemId: 'coal', qty: 2 },
    ],
    outputId: 'gold_ingot',
    outputQty: 1,
  },
  {
    id: 'prim_smelt_glass',
    name: 'Hand-Smelt: 2× Silica Sand + 1× Split Firewood → 2× Quartz Glass',
    modSuite: 'Minecraft Furnace',
    category: 'primitive',
    inputs: [
      { itemId: 'sand', qty: 2 },
      { itemId: 'firewood_bundle', qty: 1 },
    ],
    outputId: 'glass',
    outputQty: 2,
  },
  // Forestry & Firewood Core
  {
    id: 'craft_firewood_bundle',
    name: 'Hand-Chop Split Firewood Bundle (×3)',
    modSuite: 'Forestry & Firewood',
    category: 'forestry',
    inputs: [{ itemId: 'wood_log', qty: 1 }],
    outputId: 'firewood_bundle',
    outputQty: 3,
  },
  {
    id: 'craft_firewood_splitter',
    name: 'Firewood Splitter & Sawmill',
    modSuite: 'Forestry & Thermal',
    category: 'forestry',
    inputs: [
      { itemId: 'wood_log', qty: 6 },
      { itemId: 'copper_ingot', qty: 4 },
      { itemId: 'cobblestone', qty: 8 },
    ],
    outputId: 'firewood_splitter',
    outputQty: 1,
  },
  {
    id: 'craft_firewood_boiler',
    name: 'High-Pressure Firewood Boiler',
    modSuite: 'Forestry & Railcraft',
    category: 'forestry',
    inputs: [
      { itemId: 'copper_ingot', qty: 5 },
      { itemId: 'iron_ingot', qty: 2 },
      { itemId: 'brick', qty: 6 },
      { itemId: 'firewood_bundle', qty: 6 },
    ],
    outputId: 'firewood_boiler',
    outputQty: 1,
  },
  {
    id: 'craft_forestry_multifarm',
    name: 'Forestry Arboretum Multifarm',
    modSuite: 'Forestry',
    category: 'forestry',
    inputs: [
      { itemId: 'wood_log', qty: 10 },
      { itemId: 'copper_ingot', qty: 6 },
      { itemId: 'iron_ingot', qty: 4 },
      { itemId: 'glass', qty: 4 },
    ],
    outputId: 'forestry_multifarm',
    outputQty: 1,
  },
  // Ender IO & Mekanism Conduits + Ore Multiplication
  {
    id: 'craft_universal_conduit',
    name: 'Ender IO Universal Conduit (×6)',
    modSuite: 'Ender IO',
    category: 'mekanism',
    inputs: [
      { itemId: 'copper_ingot', qty: 2 },
      { itemId: 'iron_ingot', qty: 1 },
    ],
    outputId: 'power_cable',
    outputQty: 6,
  },
  {
    id: 'craft_sag_mill',
    name: 'Ender IO SAG Mill & Crusher',
    modSuite: 'Ender IO & Mekanism',
    category: 'mekanism',
    inputs: [
      { itemId: 'iron_ingot', qty: 6 },
      { itemId: 'copper_ingot', qty: 4 },
      { itemId: 'cobblestone', qty: 10 },
    ],
    outputId: 'sag_mill',
    outputQty: 1,
  },
  {
    id: 'craft_alloy_smelter',
    name: 'Ender IO Alloy & Energized Smelter',
    modSuite: 'Ender IO & Mekanism',
    category: 'mekanism',
    inputs: [
      { itemId: 'iron_ingot', qty: 6 },
      { itemId: 'copper_ingot', qty: 4 },
      { itemId: 'brick', qty: 8 },
    ],
    outputId: 'alloy_smelter',
    outputQty: 1,
  },
  {
    id: 'craft_digital_miner',
    name: 'Mekanism Digital Miner',
    modSuite: 'Mekanism',
    category: 'mekanism',
    inputs: [
      { itemId: 'steel_plate', qty: 6 },
      { itemId: 'energetic_alloy', qty: 4 },
      { itemId: 'certus_processor', qty: 2 },
      { itemId: 'diamond', qty: 2 },
    ],
    outputId: 'digital_miner',
    outputQty: 1,
  },
  {
    id: 'craft_dire_automator',
    name: 'Just Dire Block Automator',
    modSuite: 'Just Dire Things',
    category: 'mekanism',
    inputs: [
      { itemId: 'iron_ingot', qty: 5 },
      { itemId: 'blazegold_ingot', qty: 2 },
      { itemId: 'cobblestone', qty: 8 },
    ],
    outputId: 'dire_automator',
    outputQty: 1,
  },
  // Applied Energistics 2 & Refined Storage
  {
    id: 'craft_me_controller',
    name: 'AE2 ME Controller & Storage Drive',
    modSuite: 'Applied Energistics 2',
    category: 'ae2',
    inputs: [
      { itemId: 'iron_ingot', qty: 6 },
      { itemId: 'aether_crystal', qty: 4 },
      { itemId: 'certus_processor', qty: 2 },
      { itemId: 'glass', qty: 4 },
    ],
    outputId: 'me_controller',
    outputQty: 1,
  },
  {
    id: 'craft_molecular_assembler',
    name: 'AE2 Molecular Assembler',
    modSuite: 'Applied Energistics 2',
    category: 'ae2',
    inputs: [
      { itemId: 'steel_plate', qty: 3 },
      { itemId: 'certus_processor', qty: 3 },
      { itemId: 'energetic_alloy', qty: 2 },
      { itemId: 'glass', qty: 4 },
    ],
    outputId: 'molecular_assembler',
    outputQty: 1,
  },
  // Powah! & Thermal Expansion Generators
  {
    id: 'craft_solar_array',
    name: 'Solar Panel Array (Weather-Sensitive)',
    modSuite: 'Powah! Solar',
    category: 'powah',
    inputs: [
      { itemId: 'glass', qty: 6 },
      { itemId: 'copper_ingot', qty: 4 },
      { itemId: 'iron_ingot', qty: 4 },
      { itemId: 'coal', qty: 4 },
    ],
    outputId: 'solar_array',
    outputQty: 1,
  },
  {
    id: 'craft_flux_battery',
    name: 'Thermal Flux Capacitor Bank',
    modSuite: 'Thermal Expansion',
    category: 'powah',
    inputs: [
      { itemId: 'copper_ingot', qty: 6 },
      { itemId: 'iron_ingot', qty: 4 },
      { itemId: 'coal', qty: 6 },
    ],
    outputId: 'flux_battery',
    outputQty: 1,
  },
  {
    id: 'craft_powah_reactor',
    name: 'Powah! Thermo & Nitro Reactor',
    modSuite: 'Powah!',
    category: 'powah',
    inputs: [
      { itemId: 'steel_plate', qty: 6 },
      { itemId: 'blazegold_ingot', qty: 4 },
      { itemId: 'vibrant_alloy', qty: 2 },
      { itemId: 'certus_processor', qty: 2 },
    ],
    outputId: 'powah_reactor',
    outputQty: 1,
  },
  // 4 FTB Machine Augment Addons
  {
    id: 'craft_aug_speed_flux',
    name: 'Augment: Flux Speed Overclocker (+55% Speed)',
    modSuite: 'Thermal & Mekanism',
    category: 'augments',
    inputs: [
      { itemId: 'energetic_alloy', qty: 2 },
      { itemId: 'copper_ingot', qty: 3 },
      { itemId: 'firewood_bundle', qty: 4 },
    ],
    outputId: 'aug_speed_flux',
    outputQty: 1,
  },
  {
    id: 'craft_aug_yield_sieve',
    name: 'Augment: Auxiliary Ore Sieve (+1 Bonus Yield)',
    modSuite: 'Ender IO & Mekanism',
    category: 'augments',
    inputs: [
      { itemId: 'steel_plate', qty: 2 },
      { itemId: 'iron_ingot', qty: 3 },
      { itemId: 'aether_crystal', qty: 2 },
    ],
    outputId: 'aug_yield_sieve',
    outputQty: 1,
  },
  {
    id: 'craft_aug_fe_coil',
    name: 'Augment: Efficiency Dynamo Coil (FE Booster)',
    modSuite: 'Thermal & Powah!',
    category: 'augments',
    inputs: [
      { itemId: 'gold_ingot', qty: 3 },
      { itemId: 'copper_ingot', qty: 4 },
    ],
    outputId: 'aug_fe_coil',
    outputQty: 1,
  },
  {
    id: 'craft_aug_me_bus',
    name: 'Augment: ME Auto-Import/Export Bus',
    modSuite: 'Applied Energistics 2',
    category: 'augments',
    inputs: [
      { itemId: 'certus_processor', qty: 2 },
      { itemId: 'power_cable', qty: 4 },
    ],
    outputId: 'aug_me_bus',
    outputQty: 1,
  },
  // Factory Architecture Blocks
  {
    id: 'craft_planks',
    name: 'Treated Wood Planks (×4)',
    modSuite: 'Forestry',
    category: 'building',
    inputs: [{ itemId: 'wood_log', qty: 1 }],
    outputId: 'wood_planks',
    outputQty: 4,
  },
  {
    id: 'craft_factory_casing',
    name: 'Factory Machine Casing (×4)',
    modSuite: 'Mekanism & Chisel',
    category: 'building',
    inputs: [
      { itemId: 'iron_ingot', qty: 1 },
      { itemId: 'stone', qty: 4 },
    ],
    outputId: 'iron_block',
    outputQty: 4,
  },
  {
    id: 'craft_coke_bricks',
    name: 'Coke Oven Bricks (×4)',
    modSuite: 'Railcraft',
    category: 'building',
    inputs: [
      { itemId: 'cobblestone', qty: 2 },
      { itemId: 'sand', qty: 1 },
    ],
    outputId: 'brick',
    outputQty: 4,
  },
  {
    id: 'craft_torches',
    name: 'Glowstone Luminator Torch (×6)',
    modSuite: 'FTB Lighting',
    category: 'building',
    inputs: [
      { itemId: 'wood_planks', qty: 1 },
      { itemId: 'firewood_bundle', qty: 1 },
    ],
    outputId: 'torch',
    outputQty: 6,
  },
  {
    id: 'craft_mob_spawner',
    name: 'Monster Spawner Cage (Night-Only)',
    modSuite: 'Minecraft Dungeon',
    category: 'building',
    inputs: [
      { itemId: 'steel_plate', qty: 2 },
      { itemId: 'iron_ingot', qty: 4 },
      { itemId: 'aether_crystal', qty: 2 },
    ],
    outputId: 'mob_spawner',
    outputQty: 1,
  },
  {
    id: 'craft_chest',
    name: 'Reinforced Storage Chest',
    modSuite: 'Iron Chests',
    category: 'building',
    inputs: [
      { itemId: 'wood_planks', qty: 4 },
      { itemId: 'iron_ingot', qty: 1 },
    ],
    outputId: 'chest',
    outputQty: 1,
  },
  {
    id: 'craft_lever',
    name: 'Redstone Machine Control Lever (×2)',
    modSuite: 'Redstone Control',
    category: 'building',
    inputs: [
      { itemId: 'cobblestone', qty: 1 },
      { itemId: 'wood_planks', qty: 1 },
    ],
    outputId: 'lever',
    outputQty: 2,
  },
  {
    id: 'craft_claim_beacon',
    name: '2-Chunk Territory Claim Beacon (24×12)',
    modSuite: 'FTB Chunks',
    category: 'building',
    inputs: [
      { itemId: 'iron_ingot', qty: 3 },
      { itemId: 'cobblestone', qty: 6 },
    ],
    outputId: 'claim_beacon',
    outputQty: 1,
  },
];

export interface PickaxeTierMeta {
  tier: PickaxeTier;
  name: string;
  harvestPower: number;
  speedMultiplier: number;
  buyPrice: number;
  craftInputs?: { itemId: ResourceItemId; qty: number }[];
  supports3x3Bore: boolean;
  description: string;
}

export const PICKAXE_TIERS: PickaxeTierMeta[] = [
  {
    tier: 'wood',
    name: 'Wooden Pickaxe (Tier 1 Starter)',
    harvestPower: 1,
    speedMultiplier: 1.2,
    buyPrice: 0,
    supports3x3Bore: false,
    description: 'Starter Minecraft wooden tool. Harvests Timber Logs, Dirt, Sand, Stone, Cobblestone, and Coal Ore.',
  },
  {
    tier: 'stone',
    name: 'Stone Pickaxe (Tier 2 — Unlocks Copper & Iron)',
    harvestPower: 2,
    speedMultiplier: 1.8,
    buyPrice: 260,
    craftInputs: [
      { itemId: 'cobblestone', qty: 14 },
      { itemId: 'wood_planks', qty: 6 },
    ],
    supports3x3Bore: false,
    description: 'Crafted from gathered Cobblestone & Wood Planks. Unlocks mining Copper Ore and Iron Ore veins!',
  },
  {
    tier: 'iron',
    name: 'Iron Pickaxe & Mining Laser MK-I (Tier 3 — Gold & Certus)',
    harvestPower: 3,
    speedMultiplier: 2.5,
    buyPrice: 680,
    craftInputs: [
      { itemId: 'iron_ingot', qty: 8 },
      { itemId: 'copper_ingot', qty: 5 },
      { itemId: 'wood_planks', qty: 4 },
    ],
    supports3x3Bore: false,
    description: 'Crafted from smelted Iron & Copper Ingots. Unlocks mining Gold Ore and AE2 Certus Quartz Crystals!',
  },
  {
    tier: 'diamond',
    name: 'Mining Gadget MK-III (Tier 4 — Diamond & 3×3 Tunnel Bore)',
    harvestPower: 4,
    speedMultiplier: 3.6,
    buyPrice: 1650,
    craftInputs: [
      { itemId: 'steel_plate', qty: 4 },
      { itemId: 'energetic_alloy', qty: 3 },
      { itemId: 'aether_crystal', qty: 4 },
      { itemId: 'gold_ingot', qty: 4 },
    ],
    supports3x3Bore: true,
    description: 'Unlocks deep Osmium/Diamond Ore excavation AND 3×3 Tunnel Bore Laser Mode (excavates 9 blocks per pulse)!',
  },
  {
    tier: 'titanium_drill',
    name: 'Just Dire Eclipse Atomic Disassembler (Tier 5 Max)',
    harvestPower: 5,
    speedMultiplier: 5.5,
    buyPrice: 3400,
    craftInputs: [
      { itemId: 'diamond', qty: 5 },
      { itemId: 'vibrant_alloy', qty: 3 },
      { itemId: 'blazegold_ingot', qty: 4 },
      { itemId: 'certus_processor', qty: 3 },
    ],
    supports3x3Bore: true,
    description: 'Ultimate FTB multi-tool combining Mekanism Atomic Disassembler + 3×3 Eclipse Matter Laser.',
  },
];

export interface ArmorTierMeta {
  tier: ArmorTier;
  name: string;
  defense: number;
  bonusMaxHealth: number;
  buyPrice: number;
  description: string;
}

export const ARMOR_TIERS: ArmorTierMeta[] = [
  {
    tier: 'none',
    name: 'Engineer Work Jumpsuit',
    defense: 0,
    bonusMaxHealth: 0,
    buyPrice: 0,
    description: 'Standard Direwolf20 workshop attire.',
  },
  {
    tier: 'leather',
    name: 'Forestry Apiarist & Arborist Harness',
    defense: 0.28,
    bonusMaxHealth: 30,
    buyPrice: 340,
    description: '28% hazard mitigation, +30 Max Health.',
  },
  {
    tier: 'iron',
    name: 'Ender IO Dark Steel Exo-Suit',
    defense: 0.52,
    bonusMaxHealth: 75,
    buyPrice: 880,
    description: '52% hazard mitigation, +75 Max Health.',
  },
  {
    tier: 'titanium',
    name: 'Mekanism MekaSuit Quantum Armor',
    defense: 0.8,
    bonusMaxHealth: 150,
    buyPrice: 2200,
    description: '80% FE-shielded mitigation, +150 Max Health.',
  },
];

export interface WeaponTierMeta {
  tier: WeaponTier;
  name: string;
  attackDamage: number;
  buyPrice: number;
  description: string;
}

export const WEAPON_TIERS: WeaponTierMeta[] = [
  {
    tier: 'fists',
    name: 'Crescent Hammer Wrench',
    attackDamage: 16,
    buyPrice: 0,
    description: 'Thermal Expansion Crescent Hammer for configuring and dismantling your placed machines.',
  },
  {
    tier: 'stone_club',
    name: 'Mekanism Configurator Rod',
    attackDamage: 28,
    buyPrice: 280,
    description: 'Energized multi-conduit tuning rod.',
  },
  {
    tier: 'iron_blade',
    name: 'Ender IO "The Ender" Sword',
    attackDamage: 48,
    buyPrice: 760,
    description: 'Resonant Dark Steel blade.',
  },
  {
    tier: 'aether_cleaver',
    name: 'Redstone Arsenal Flux-Infused Greatsword',
    attackDamage: 88,
    buyPrice: 1850,
    description: 'FE-charged plasma edge.',
  },
];

export const BLOCK_HARDNESS: Record<
  TerrainBlockKind,
  { minPower: number; drop: ResourceItemId | null; xp: number }
> = {
  air: { minPower: 0, drop: null, xp: 0 },
  grass: { minPower: 1, drop: 'grass', xp: 2 },
  dirt: { minPower: 1, drop: 'dirt', xp: 2 },
  sand: { minPower: 1, drop: 'sand', xp: 2 },
  leaves: { minPower: 1, drop: 'leaves', xp: 2 },
  wood_log: { minPower: 1, drop: 'wood_log', xp: 5 },
  wood_planks: { minPower: 1, drop: 'wood_planks', xp: 3 },
  torch: { minPower: 1, drop: 'torch', xp: 1 },
  wood_door: { minPower: 1, drop: 'wood_door', xp: 2 },
  stone: { minPower: 1, drop: 'cobblestone', xp: 4 },
  cobblestone: { minPower: 1, drop: 'cobblestone', xp: 3 },
  brick: { minPower: 1, drop: 'brick', xp: 4 },
  glass: { minPower: 1, drop: 'glass', xp: 2 },
  coal_ore: { minPower: 1, drop: 'coal', xp: 8 },
  copper_ore: { minPower: 2, drop: 'copper_ore', xp: 12 },
  iron_ore: { minPower: 2, drop: 'iron_ore', xp: 16 },
  iron_block: { minPower: 2, drop: 'iron_block', xp: 8 },
  iron_door: { minPower: 2, drop: 'iron_door', xp: 5 },
  chest: { minPower: 1, drop: 'chest', xp: 4 },
  lever: { minPower: 1, drop: 'lever', xp: 2 },
  gold_ore: { minPower: 3, drop: 'gold_ore', xp: 25 },
  crystal_ore: { minPower: 3, drop: 'crystal_ore', xp: 35 },
  diamond_ore: { minPower: 4, drop: 'diamond', xp: 60 },
  mob_spawner: { minPower: 2, drop: 'mob_spawner', xp: 85 },
  bedrock: { minPower: 999, drop: null, xp: 0 },
};

export interface FtbQuestStep {
  id: string;
  age: number;
  title: string;
  modSuite: string;
  objectiveSummary: string;
  guideHint: string;
  rewardCredits: number;
  rewardXp: number;
  rewardItems: { itemId: ResourceItemId; qty: number }[];
  isCompleted: (character: CharacterProfile, world: WorldData) => boolean;
}

export const FTB_QUESTS: FtbQuestStep[] = [
  {
    id: 'quest_age1_timber_stone',
    age: 1,
    title: 'Age 1: Frontier Timber & Quarry Expedition',
    modSuite: 'Minecraft Survival',
    objectiveSummary: 'Walk out and harvest 10× Timber Logs & 16× Cobblestone',
    guideHint: 'Walk off the 9×9 pad into the trees and hills. Left-click trees for Timber Logs and grey rock for Cobblestone.',
    rewardCredits: 90,
    rewardXp: 50,
    rewardItems: [
      { itemId: 'wood_planks', qty: 8 },
      { itemId: 'cooked_ration', qty: 4 },
    ],
    isCompleted: (ch, w) => {
      const logs = (ch.inventory.wood_log || 0) + (w.storageInventory.wood_log || 0);
      const cobble = (ch.inventory.cobblestone || 0) + (w.storageInventory.cobblestone || 0);
      return (logs >= 10 && cobble >= 16) || ch.pickaxeTier !== 'wood';
    },
  },
  {
    id: 'quest_age1_stone_pickaxe',
    age: 1,
    title: 'Age 1: Craft a Stone Pickaxe (Tier 2)',
    modSuite: 'Minecraft Tools',
    objectiveSummary: 'Upgrade to a Stone Pickaxe to unlock Copper & Iron veins',
    guideHint: 'Open the Crafting & Tech Grid (G) → Gadgets & Tools tab, and craft the Stone Pickaxe with 14× Cobblestone + 6× Wood Planks.',
    rewardCredits: 120,
    rewardXp: 75,
    rewardItems: [
      { itemId: 'coal', qty: 6 },
      { itemId: 'torch', qty: 12 },
    ],
    isCompleted: (ch) => ch.pickaxeTier !== 'wood',
  },
  {
    id: 'quest_age2_primitive_smelt',
    age: 2,
    title: 'Age 2: Primitive Metallurgy & Ingot Smelting',
    modSuite: 'Minecraft Furnace',
    objectiveSummary: 'Mine Copper & Iron veins and smelt 6× Copper Ingots & 6× Iron Ingots',
    guideHint: 'Mine orange Copper Ore and red-tan Iron Ore veins in the hills, then hand-smelt them with Coal or Split Firewood in the Crafting tab (G).',
    rewardCredits: 160,
    rewardXp: 110,
    rewardItems: [
      { itemId: 'brick', qty: 8 },
      { itemId: 'firewood_bundle', qty: 8 },
    ],
    isCompleted: (ch, w) => {
      const copper = (ch.inventory.copper_ingot || 0) + (w.storageInventory.copper_ingot || 0);
      const iron = (ch.inventory.iron_ingot || 0) + (w.storageInventory.iron_ingot || 0);
      const myMachines = w.machines.filter((m) => isMachinePlacedByPlayer(m, ch.uid, w.ownerId));
      return (copper >= 6 && iron >= 6) || myMachines.length >= 2;
    },
  },
  {
    id: 'quest_age3_firewood_boiler',
    age: 3,
    title: 'Age 3: First Firewood Power Loop (130 FE/t)',
    modSuite: 'Forestry & Railcraft',
    objectiveSummary: 'Craft & place a Firewood Boiler and a Firewood Splitter in the 3D world',
    guideHint: 'Craft a Firewood Splitter and High-Pressure Firewood Boiler in the Crafting tab (G), place them on your pad, and wire them with Universal Conduits!',
    rewardCredits: 220,
    rewardXp: 160,
    rewardItems: [
      { itemId: 'power_cable', qty: 12 },
      { itemId: 'aug_fe_coil', qty: 1 },
    ],
    isCompleted: (ch, w) => {
      const myMachines = w.machines.filter((m) => isMachinePlacedByPlayer(m, ch.uid, w.ownerId));
      const hasBoiler = myMachines.some((m) => m.kind === 'firewood_boiler' || m.kind === 'coal_generator');
      const hasSplitter = myMachines.some((m) => m.kind === 'firewood_splitter');
      return hasBoiler && hasSplitter;
    },
  },
  {
    id: 'quest_age4_ore_multiplication',
    age: 4,
    title: 'Age 4: Ender IO 2×–5× Ore Multiplication',
    modSuite: 'Ender IO & Mekanism',
    objectiveSummary: 'Craft & place an Ender IO SAG Mill and Alloy Smelter',
    guideHint: 'Connect a SAG Mill and Alloy Smelter to your power grid with Universal Conduits to double every raw ore into 2× Crushed Clumps (+1 per Sieve Augment)!',
    rewardCredits: 300,
    rewardXp: 220,
    rewardItems: [
      { itemId: 'aug_yield_sieve', qty: 1 },
      { itemId: 'cooked_ration', qty: 6 },
    ],
    isCompleted: (ch, w) => {
      const myMachines = w.machines.filter((m) => isMachinePlacedByPlayer(m, ch.uid, w.ownerId));
      const hasSag = myMachines.some((m) => m.kind === 'sag_mill');
      const hasSmelter = myMachines.some((m) => m.kind === 'alloy_smelter' || m.kind === 'electric_smelter');
      return hasSag && hasSmelter;
    },
  },
  {
    id: 'quest_age5_iron_laser_certus',
    age: 5,
    title: 'Age 5: Iron Mining Laser & Deep Certus Quartz',
    modSuite: 'Applied Energistics 2',
    objectiveSummary: 'Equip an Iron Pickaxe (Tier 3+) and acquire 4× Charged Certus Quartz',
    guideHint: 'Craft the Iron Pickaxe & Mining Laser MK-I, then dig underground (Y ≤ -4) to mine Gold Ore and glowing blue AE2 Certus Quartz Ore (crush in SAG Mill for 2× Charged Certus).',
    rewardCredits: 360,
    rewardXp: 280,
    rewardItems: [
      { itemId: 'gold_ingot', qty: 4 },
      { itemId: 'aug_speed_flux', qty: 1 },
    ],
    isCompleted: (ch, w) => {
      const tierPower = getPickaxeMeta(ch.pickaxeTier).harvestPower;
      const certus = (ch.inventory.aether_crystal || 0) + (w.storageInventory.aether_crystal || 0);
      return tierPower >= 3 && certus >= 4;
    },
  },
  {
    id: 'quest_age6_ae2_me_network',
    age: 6,
    title: 'Age 6: Forestry Multifarm & AE2 ME Network',
    modSuite: 'Applied Energistics 2 & Forestry',
    objectiveSummary: 'Place an AE2 ME Controller and a Forestry Arboretum Multifarm',
    guideHint: 'Print AE2 Engineering Processors in your Alloy Smelter, then build an AE2 ME Controller and Forestry Arboretum Multifarm for automated timber and digital storage.',
    rewardCredits: 450,
    rewardXp: 360,
    rewardItems: [
      { itemId: 'aug_me_bus', qty: 2 },
      { itemId: 'steel_plate', qty: 4 },
    ],
    isCompleted: (ch, w) => {
      const myMachines = w.machines.filter((m) => isMachinePlacedByPlayer(m, ch.uid, w.ownerId));
      const hasMe = myMachines.some((m) => m.kind === 'me_controller' || m.kind === 'storage_terminal');
      const hasFarm = myMachines.some((m) => m.kind === 'forestry_multifarm');
      return hasMe && hasFarm;
    },
  },
  {
    id: 'quest_age7_workforce_command',
    age: 7,
    title: 'Age 7: Workforce Command & Territory Claim',
    modSuite: 'FTB Chunks & Dire Workforce',
    objectiveSummary: 'Hire at least 1 Autonomous Worker (1,000 Coins) OR claim a 2-Chunk Territory',
    guideHint: 'Save 1,000 Dire Coins via Trade Contracts or ore sales to hire your first Worker in the Class · Workers · Trade hub, or place a 2-Chunk Claim Beacon.',
    rewardCredits: 520,
    rewardXp: 440,
    rewardItems: [
      { itemId: 'cooked_ration', qty: 10 },
      { itemId: 'energetic_alloy', qty: 3 },
    ],
    isCompleted: (ch, w) => {
      const hasWorker = (ch.hiredWorkers?.length || 0) >= 1;
      const hasClaim = w.claims.some((c) => c.ownerId === ch.uid);
      return hasWorker || hasClaim;
    },
  },
  {
    id: 'quest_age8_tunnel_bore_digital_miner',
    age: 8,
    title: 'Age 8: 3×3 Tunnel Bore & Mekanism Digital Miner',
    modSuite: 'Mekanism & Direwolf20 Gadgets',
    objectiveSummary: 'Place a Mekanism Digital Miner and unlock Tier-4 3×3 Tunnel Bore Laser',
    guideHint: 'Fuse Infused Steel Plates and Energetic Alloy in your Alloy Smelter to craft Mining Gadget MK-III (Tier 4) and deploy a Mekanism Digital Miner.',
    rewardCredits: 750,
    rewardXp: 600,
    rewardItems: [
      { itemId: 'aug_yield_sieve', qty: 2 },
      { itemId: 'blazegold_ingot', qty: 4 },
    ],
    isCompleted: (ch, w) => {
      const tierPower = getPickaxeMeta(ch.pickaxeTier).harvestPower;
      const myMachines = w.machines.filter((m) => isMachinePlacedByPlayer(m, ch.uid, w.ownerId));
      const hasMiner = myMachines.some((m) => m.kind === 'digital_miner' || m.kind === 'auto_miner');
      return tierPower >= 4 && hasMiner;
    },
  },
  {
    id: 'quest_age9_endgame_nitro_reactor',
    age: 9,
    title: 'Age 9: Powah! Nitro Reactor & Eclipse Mastery',
    modSuite: 'Powah! & Just Dire Things',
    objectiveSummary: 'Deploy a Powah! Thermo & Nitro Reactor and an AE2 Molecular Assembler',
    guideHint: 'Alloy Vibrant Phase Ingots (Energetic Alloy + Osmium/Diamond) and Blazegold to construct a Powah! Nitro Reactor (540+ FE/t) and AE2 Molecular Assembler!',
    rewardCredits: 1500,
    rewardXp: 1000,
    rewardItems: [
      { itemId: 'aug_speed_flux', qty: 3 },
      { itemId: 'vibrant_alloy', qty: 4 },
    ],
    isCompleted: (ch, w) => {
      const myMachines = w.machines.filter((m) => isMachinePlacedByPlayer(m, ch.uid, w.ownerId));
      const hasReactor = myMachines.some((m) => m.kind === 'powah_reactor' || m.kind === 'solar_array');
      const hasAssembler = myMachines.some(
        (m) => m.kind === 'molecular_assembler' || m.kind === 'auto_crafter'
      );
      return hasReactor && hasAssembler;
    },
  },
];

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  skinColor: '#e0ac8b',
  shirtColor: '#0284c7',
  pantsColor: '#1e293b',
  hairColor: '#3b2416',
  accentColor: '#38bdf8',
};

export function createFreshWorldPlayerState(): WorldPlayerState {
  // Authentic Minecraft + FTB Survival Start:
  // Players start with a Tier 1 Wooden Pickaxe, 8 torches, 4 rations, and 0 free machines!
  // You must walk out into the 3D world to chop trees, mine stone/coal/ores, upgrade pickaxes, and craft your machines.
  const starterHotbar: (ResourceItemId | null)[] = [
    'torch',
    'cooked_ration',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  return {
    level: 1,
    xp: 0,
    credits: 0,
    health: 100,
    maxHealth: 100,
    hunger: 100,
    maxHunger: 100,
    saturation: 60,
    claimedQuestIds: [],
    pickaxeTier: 'wood',
    armorTier: 'none',
    weaponTier: 'fists',
    miningGadgetMode: 'single_1x1',
    buildingGadgetMode: 'single',
    playerClass: 'engineer',
    hiredWorkers: [],
    inventory: {
      torch: 8,
      cooked_ration: 5,
    },
    hotbar: starterHotbar,
    selectedSlot: 0,
    personalSpawn: null,
  };
}

export function createStarterCharacter(uid: string, displayName: string): CharacterProfile {
  const cleanName = (displayName || 'DireEngineer').trim().slice(0, 28) || 'DireEngineer';
  const freshState = createFreshWorldPlayerState();

  return {
    uid,
    displayName: cleanName,
    characterName: cleanName,
    ...freshState,
    cameraMode: 'first',
    appearance: { ...DEFAULT_APPEARANCE },
    totalBlocksMined: 0,
    totalBlocksPlaced: 0,
    updatedAtMs: Date.now(),
  };
}

export function getPickaxeMeta(tier: PickaxeTier): PickaxeTierMeta {
  return PICKAXE_TIERS.find((p) => p.tier === tier) || PICKAXE_TIERS[0];
}

export function getArmorMeta(tier: ArmorTier): ArmorTierMeta {
  return ARMOR_TIERS.find((a) => a.tier === tier) || ARMOR_TIERS[0];
}

export function getWeaponMeta(tier: WeaponTier): WeaponTierMeta {
  return WEAPON_TIERS.find((w) => w.tier === tier) || WEAPON_TIERS[0];
}

export function getMaxHealthForArmor(tier: ArmorTier, level = 1): number {
  const levelBonus = Math.max(0, (Math.max(1, Math.floor(level)) - 1) * 5);
  return 100 + getArmorMeta(tier).bonusMaxHealth + levelBonus;
}

export const VALID_TERRAIN_BLOCKS = new Set<TerrainBlockKind>([
  'air',
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'wood_log',
  'wood_planks',
  'leaves',
  'sand',
  'brick',
  'glass',
  'iron_block',
  'torch',
  'wood_door',
  'iron_door',
  'chest',
  'lever',
  'coal_ore',
  'copper_ore',
  'iron_ore',
  'gold_ore',
  'crystal_ore',
  'diamond_ore',
  'mob_spawner',
  'bedrock',
]);

export const MACHINE_KINDS = new Set<string>([
  'firewood_splitter',
  'firewood_boiler',
  'forestry_multifarm',
  'powah_reactor',
  'flux_battery',
  'digital_miner',
  'sag_mill',
  'alloy_smelter',
  'me_controller',
  'molecular_assembler',
  'dire_automator',
  'coal_generator',
  'solar_array',
  'battery_bank',
  'auto_miner',
  'electric_smelter',
  'auto_crafter',
  'storage_terminal',
  'claim_beacon',
]);

export const DOOR_KINDS = new Set<TerrainBlockKind>(['wood_door', 'iron_door', 'lever']);
