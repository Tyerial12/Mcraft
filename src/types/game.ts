export type WorldMode = 'survival' | 'peaceful';
export type WorldAccessMode = 'private' | 'friends' | 'public';
export type CameraMode = 'first' | 'third';

// Keep Firestore schema compatible ('wood' | 'stone' | 'iron' | 'diamond' | 'titanium_drill')
// while representing FTB Direwolf20 Mining Gadgets & Drills in the UI.
export type PickaxeTier = 'wood' | 'stone' | 'iron' | 'diamond' | 'titanium_drill';
export type ArmorTier = 'none' | 'leather' | 'iron' | 'titanium';
export type WeaponTier = 'fists' | 'stone_club' | 'iron_blade' | 'aether_cleaver';

export type MiningGadgetMode = 'single_1x1' | 'bore_3x3';
export type BuildingGadgetMode = 'single' | 'floor_3x3' | 'wall_3x3' | 'line_5';

export type PlayerClassId = 'farmer' | 'lumberjack' | 'engineer' | 'miner';
export type WorkerTask = 'wood' | 'iron' | 'stone' | 'food';

export interface HiredWorker {
  id: string;
  name: string;
  task: WorkerTask;
  ownerId: string;
  ownerName: string;
  active: boolean;
  totalGathered: number;
  hiredAtMs: number;
  hunger?: number;
  starving?: boolean;
}

export interface TradeOffer {
  id: string;
  senderUid: string;
  senderName: string;
  offerItemId: ResourceItemId | 'credits';
  offerQty: number;
  requestItemId: ResourceItemId | 'credits';
  requestQty: number;
  createdAtMs: number;
}

export type AugmentId =
  | 'aug_speed_flux'
  | 'aug_yield_sieve'
  | 'aug_fe_coil'
  | 'aug_me_bus';

export type TerrainBlockKind =
  | 'air'
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'cobblestone'
  | 'wood_log'
  | 'wood_planks'
  | 'leaves'
  | 'sand'
  | 'brick'
  | 'glass'
  | 'iron_block'
  | 'torch'
  | 'wood_door'
  | 'iron_door'
  | 'chest'
  | 'lever'
  | 'coal_ore'
  | 'copper_ore'
  | 'iron_ore'
  | 'gold_ore'
  | 'crystal_ore'
  | 'diamond_ore'
  | 'mob_spawner'
  | 'bedrock';

export type MachineKind =
  | 'firewood_splitter'
  | 'firewood_boiler'
  | 'forestry_multifarm'
  | 'powah_reactor'
  | 'flux_battery'
  | 'digital_miner'
  | 'sag_mill'
  | 'alloy_smelter'
  | 'me_controller'
  | 'molecular_assembler'
  | 'dire_automator'
  // Legacy machine aliases mapped gracefully if loaded from older saves
  | 'coal_generator'
  | 'solar_array'
  | 'battery_bank'
  | 'auto_miner'
  | 'electric_smelter'
  | 'auto_crafter'
  | 'storage_terminal'
  | 'claim_beacon';

export type ResourceItemId =
  // Terrain & Building Blocks
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'cobblestone'
  | 'wood_log'
  | 'wood_planks'
  | 'leaves'
  | 'sand'
  | 'brick'
  | 'glass'
  | 'iron_block'
  | 'torch'
  | 'wood_door'
  | 'iron_door'
  | 'chest'
  | 'lever'
  | 'mob_spawner'
  // Raw Ores & Forestry / Firewood Fuels
  | 'coal'
  | 'copper_ore'
  | 'iron_ore'
  | 'gold_ore'
  | 'crystal_ore'
  | 'diamond'
  | 'firewood_bundle'
  | 'sawdust'
  // Mekanism & Ender IO Crushed Ore Clumps
  | 'crushed_copper'
  | 'crushed_iron'
  | 'crushed_gold'
  | 'crushed_osmium'
  // Smelted Ingots, Alloys & AE2 Processors
  | 'copper_ingot'
  | 'iron_ingot'
  | 'gold_ingot'
  | 'aether_crystal'
  | 'steel_plate'
  | 'energetic_alloy'
  | 'vibrant_alloy'
  | 'blazegold_ingot'
  | 'certus_processor'
  // Ender IO Universal Conduit
  | 'power_cable'
  // Machine Augment Addons
  | 'aug_speed_flux'
  | 'aug_yield_sieve'
  | 'aug_fe_coil'
  | 'aug_me_bus'
  // Placeable FTB Direwolf20 Machines
  | 'firewood_splitter'
  | 'firewood_boiler'
  | 'forestry_multifarm'
  | 'powah_reactor'
  | 'flux_battery'
  | 'digital_miner'
  | 'sag_mill'
  | 'alloy_smelter'
  | 'me_controller'
  | 'molecular_assembler'
  | 'dire_automator'
  // Legacy / Consumable items
  | 'coal_generator'
  | 'solar_array'
  | 'battery_bank'
  | 'auto_miner'
  | 'electric_smelter'
  | 'auto_crafter'
  | 'storage_terminal'
  | 'claim_beacon'
  | 'cooked_ration';

export interface CharacterAppearance {
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  accentColor: string;
}

export interface PersonalSpawnPoint {
  x: number;
  y: number;
  z: number;
  claimId: string;
  claimLabel: string;
}

export interface WorldPlayerState {
  level: number;
  xp: number;
  credits: number;
  health: number;
  maxHealth: number;
  hunger?: number;
  maxHunger?: number;
  saturation?: number;
  claimedQuestIds?: string[];
  pickaxeTier: PickaxeTier;
  armorTier: ArmorTier;
  weaponTier: WeaponTier;
  miningGadgetMode?: MiningGadgetMode;
  buildingGadgetMode?: BuildingGadgetMode;
  playerClass?: PlayerClassId;
  hiredWorkers?: HiredWorker[];
  inventory: Partial<Record<ResourceItemId, number>>;
  hotbar: (ResourceItemId | null)[];
  selectedSlot: number;
  personalSpawn?: PersonalSpawnPoint | null;
}

export interface CharacterProfile {
  uid: string;
  displayName: string;
  characterName: string;
  level: number;
  xp: number;
  credits: number;
  health: number;
  maxHealth: number;
  hunger?: number;
  maxHunger?: number;
  saturation?: number;
  claimedQuestIds?: string[];
  pickaxeTier: PickaxeTier;
  armorTier: ArmorTier;
  weaponTier: WeaponTier;
  cameraMode: CameraMode;
  miningGadgetMode?: MiningGadgetMode;
  buildingGadgetMode?: BuildingGadgetMode;
  playerClass?: PlayerClassId;
  hiredWorkers?: HiredWorker[];
  appearance: CharacterAppearance;
  inventory: Partial<Record<ResourceItemId, number>>;
  hotbar: (ResourceItemId | null)[];
  selectedSlot: number;
  totalBlocksMined: number;
  totalBlocksPlaced: number;
  updatedAtMs: number;
}

export interface WorldVoxelDelta {
  x: number;
  y: number;
  z: number;
  kind: TerrainBlockKind;
  open?: boolean;
}

export interface PlacedMachine {
  id: string;
  kind: MachineKind;
  x: number;
  y: number;
  z: number;
  ownerId: string;
  ownerName: string;
  enabled: boolean;
  coalFuelSeconds: number; // Remaining burn seconds for Firewood Boiler / Reactor fuel
  coalBuffer: number; // Queued fuel units (Split Firewood Bundles / Blazegold / Coal)
  storedEnergy: number; // Stored FE
  maxEnergy: number; // Max FE capacity
  selectedRecipeId: string | null;
  progress: number; // 0..100
  augments?: AugmentId[]; // Up to 3 installed FTB Machine Augment Addons
  outputBuffer: Partial<Record<ResourceItemId, number>>;
  mineCursor: number;
}

export type ClaimPermissionKey = 'build' | 'toggleMachines' | 'openChests' | 'useLevers';

export interface TrustedFriendPermissions {
  build: boolean;
  toggleMachines: boolean;
  openChests: boolean;
  useLevers: boolean;
}

export interface TrustedFriend {
  uid: string;
  displayName: string;
  permissions?: TrustedFriendPermissions;
}

export interface LandClaim12x12 {
  id: string;
  ownerId: string;
  ownerName: string;
  label: string;
  minX: number;
  minZ: number;
  sizeX?: number; // Width in blocks (12 = 1 chunk, 24 = 2 chunks)
  sizeZ?: number; // Depth in blocks (12 = 1 chunk, 24 = 2 chunks)
  beaconX: number;
  beaconY: number;
  beaconZ: number;
  trustedFriends: TrustedFriend[];
  createdAtMs: number;
}

export interface WorldData {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  seed: number;
  mode: WorldMode;
  accessMode: WorldAccessMode;
  inviteCode: string;
  invitedUids: string[];
  voxelDeltas: Record<string, WorldVoxelDelta>;
  machines: PlacedMachine[];
  cables: string[];
  storageInventory: Partial<Record<ResourceItemId, number>>; // AE2 / Refined Storage ME Network Digital Storage
  claims: LandClaim12x12[];
  tradeOffers?: TradeOffer[];
  playerStates?: Record<string, WorldPlayerState>;
  exploredChunks?: string[];
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PowerNetworkSummary {
  id: string;
  machineIds: string[];
  cableKeys: string[];
  generationKw: number; // FE/t generated
  demandKw: number; // FE/t demanded
  storedEnergy: number; // FE stored
  maxEnergy: number; // Max FE capacity
  powered: boolean;
  hasMeController?: boolean;
}

export interface PowerGridSnapshot {
  networks: PowerNetworkSummary[];
  machinePowered: Record<string, boolean>;
  machineNetworkId: Record<string, string>;
  cablePowered: Record<string, boolean>;
  totalGenKw: number; // Total FE/t generated
  totalDemandKw: number; // Total FE/t consumed
  totalStoredEnergy: number; // Total FE stored
  totalMaxEnergy: number; // Total FE capacity
  hasOnlineMeNetwork?: boolean;
}

export type WeatherKind = 'clear' | 'light_rain' | 'fog';

export interface WeatherState {
  kind: WeatherKind;
  label: string;
  shortLabel: string;
  solarMultiplier: number;
  boilerFuelBurnMultiplier: number;
  fogNearFactor: number;
  fogFarFactor: number;
  rainIntensity: number;
  msUntilNextChange: number;
  formattedTimeRemaining: string;
}

export interface DayNightState {
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  isNight: boolean;
  cycleProgress?: number;
  sunElevation: number;
  baseSolarEfficiency: number;
  solarEfficiency: number;
  weather: WeatherState;
  skyHex: string;
  fogHex: string;
  sunHex: string;
  ambientIntensity: number;
  sunIntensity: number;
  msUntilNextTransition: number;
  formattedTimeRemaining: string;
  cycleLabel: string;
}

export interface RemotePlayer {
  clientId: string;
  uid: string;
  name: string;
  appearance: CharacterAppearance;
  x: number;
  y: number;
  z: number;
  yaw: number;
  heldItem: ResourceItemId | null;
  pickaxeTier: PickaxeTier;
  armorTier: ArmorTier;
  weaponTier: WeaponTier;
  crouching: boolean;
}

export interface HostileMob {
  id: string;
  kind: 'night_stalker' | 'slag_golem';
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  attackDamage: number;
  velY?: number;
  onGround?: boolean;
  knockbackX?: number;
  knockbackZ?: number;
  hurtTimer?: number;
  attackAnim?: number;
  deathTimer?: number;
  walkPhase?: number;
  wanderAngle?: number;
  wanderTimer?: number;
  sunBurnCooldown?: number;
  attackCooldown?: number;
}

export interface RoomChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  timestampMs: number;
  system?: boolean;
}

export interface LiveWorldSummary {
  worldId: string;
  inviteCode: string;
  name: string;
  ownerName: string;
  mode: WorldMode;
  accessMode: WorldAccessMode;
  playerCount: number;
  maxPlayers: number;
  seed: number;
  machineCount?: number;
  playerNames?: string[];
}

export interface MultiplayerRoomSnapshot {
  world: WorldData;
  hostClientId: string;
  players: RemotePlayer[];
  chat: RoomChatMessage[];
}

export type ClientWsMessage =
  | {
      type: 'world:host';
      world: WorldData;
      player: Omit<RemotePlayer, 'clientId'>;
    }
  | {
      type: 'world:join';
      inviteCode: string;
      player: Omit<RemotePlayer, 'clientId'>;
    }
  | { type: 'world:leave' }
  | {
      type: 'player:move';
      x: number;
      y: number;
      z: number;
      yaw: number;
      crouching: boolean;
      heldItem: ResourceItemId | null;
    }
  | { type: 'player:swing' }
  | { type: 'player:laser'; tx: number; ty: number; tz: number }
  | {
      type: 'voxel:set';
      x: number;
      y: number;
      z: number;
      kind: TerrainBlockKind;
      open?: boolean;
    }
  | {
      type: 'voxel:batch';
      deltas: WorldVoxelDelta[];
    }
  | { type: 'door:toggle'; x: number; y: number; z: number }
  | { type: 'cable:place'; x: number; y: number; z: number }
  | { type: 'cable:remove'; x: number; y: number; z: number }
  | { type: 'machine:place'; machine: PlacedMachine }
  | { type: 'machine:remove'; machineId: string }
  | { type: 'machine:update'; machine: PlacedMachine }
  | {
      type: 'storage:update';
      machineId?: string;
      itemId: ResourceItemId;
      delta: number;
    }
  | {
      type: 'storage:sync';
      storageInventory: Partial<Record<ResourceItemId, number>>;
    }
  | {
      type: 'claim:create';
      claim: LandClaim12x12;
      beaconMachine?: PlacedMachine;
    }
  | { type: 'claim:add_trusted'; claimId: string; friend: TrustedFriend }
  | {
      type: 'claim:update_trusted_perms';
      claimId: string;
      friendUid: string;
      permissions: TrustedFriendPermissions;
    }
  | { type: 'claim:remove_trusted'; claimId: string; friendUid: string }
  | { type: 'claim:rename'; claimId: string; label: string }
  | { type: 'claim:delete'; claimId: string }
  | {
      type: 'world:settings';
      name?: string;
      mode?: WorldMode;
      accessMode?: WorldAccessMode;
    }
  | {
      type: 'world:sync_machines';
      machines: PlacedMachine[];
      storageInventory: Partial<Record<ResourceItemId, number>>;
    }
  | { type: 'chat:send'; text: string };

export type ServerWsMessage =
  | { type: 'world:joined'; clientId: string; room: MultiplayerRoomSnapshot }
  | { type: 'world:state'; room: MultiplayerRoomSnapshot }
  | { type: 'world:left' }
  | {
      type: 'player:moved';
      clientId: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
      crouching: boolean;
      heldItem: ResourceItemId | null;
    }
  | { type: 'player:swung'; clientId: string }
  | { type: 'player:laser'; clientId: string; tx: number; ty: number; tz: number }
  | { type: 'voxel:updated'; delta: WorldVoxelDelta }
  | { type: 'voxel:batch_updated'; deltas: WorldVoxelDelta[] }
  | { type: 'cables:updated'; cables: string[] }
  | {
      type: 'machines:updated';
      machines: PlacedMachine[];
      storageInventory?: Partial<Record<ResourceItemId, number>>;
    }
  | {
      type: 'storage:updated';
      storageInventory: Partial<Record<ResourceItemId, number>>;
    }
  | { type: 'claims:updated'; claims: LandClaim12x12[] }
  | { type: 'chat:message'; message: RoomChatMessage }
  | {
      type: 'notice';
      tone: 'info' | 'error' | 'claim_locked';
      message: string;
    };
