import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BLOCK_HARDNESS, DOOR_KINDS, getPickaxeMeta } from '../../data/catalog';
import {
  computeClaimOrigin12x12,
  findClaimAt,
  getClaimDimensions,
  isTrustedFriendOnClaim,
} from '../claims';
import {
  CHUNK_SIZE,
  chunkKey,
  getBaseVoxel,
  getChunkBlockBounds,
  getClosestChunkKeys,
  getNaturalSpawnerNear,
  getSurfaceHeight,
  isWithinWorldBounds,
  MAX_ACTIVE_CHUNKS,
  parseChunkKey,
  parseVoxelKey,
  voxelKey,
  WORLD_MAX_XZ,
  WORLD_MAX_Y,
  WORLD_MIN_XZ,
  WORLD_MIN_Y,
  worldToChunk,
} from '../terrain';
import {
  evaluateSpawnSafety,
  extractTorchPositions,
  findTownAt,
  getWorldTowns,
  isProtectedByTorch,
  validateNewClaimOutsideSafeZones,
  type TorchCoord,
  type TownSafeZone,
} from '../safeZones';
import {
  buildClaimPerimeter12x12,
  buildClaimPreview12x12,
  buildFirstPersonToolRig,
  buildHostileMobRig,
  buildLeverMesh,
  buildMachineMesh,
  buildMeleeSlashArcMesh,
  buildMobSpawnerMesh,
  buildPersonalSpawnMarker,
  buildPlayerNameplateSprite,
  buildPowerCableMesh,
  buildTownSafeZoneVisual,
  buildVoxelCharacterRig,
  clearGroupAndDispose,
  disposeObject3D,
  updateHostileMobRigVisuals,
  updateMobSpawnerVisuals,
  type HostileMobRigParts,
} from './machineMeshes';
import { createVoxelMaterialLibrary, type VoxelMaterialLibrary } from './textures';
import type {
  CameraMode,
  CharacterAppearance,
  DayNightState,
  HostileMob,
  LandClaim12x12,
  PersonalSpawnPoint,
  PickaxeTier,
  PlacedMachine,
  PowerGridSnapshot,
  RemotePlayer,
  TerrainBlockKind,
  WorldMode,
  WorldVoxelDelta,
} from '../../types/game';

export type MobSpawnerStatus =
  | 'active'
  | 'daylight'
  | 'out_of_range'
  | 'torch_suppressed'
  | 'mob_cap'
  | 'creative_peaceful';

export interface HoverTarget {
  kind: 'block' | 'machine' | 'cable' | 'mob';
  x: number;
  y: number;
  z: number;
  placeX?: number;
  placeY?: number;
  placeZ?: number;
  blockKind?: TerrainBlockKind;
  machineId?: string;
  mobId?: string;
  spawnerStatus?: MobSpawnerStatus;
  spawnerMobKind?: 'night_stalker' | 'slag_golem';
}

export interface VoxelEngineCallbacks {
  onPlayerMove: (x: number, y: number, z: number, yaw: number, crouching: boolean) => void;
  onActiveChunksChanged?: (activeChunkKeys: string[]) => void;
  onMineBlock: (x: number, y: number, z: number, kind: TerrainBlockKind) => void;
  onPlaceAt: (x: number, y: number, z: number) => void;
  onClickMachine: (machineId: string) => void;
  onToggleDoor: (x: number, y: number, z: number) => void;
  onOpenChest?: (x: number, y: number, z: number) => void;
  onLockedClaimBump?: (claim: LandClaim12x12) => void;
  onRemoveCable: (x: number, y: number, z: number) => void;
  onRemoveMachine: (machineId: string) => void;
  onStrikeMob: (mobId: string) => void;
  onPlayerDamaged: (damage: number, sourceName: string) => void;
  onHoverChanged: (target: HoverTarget | null) => void;
  onWebglContextLost?: () => void;
}

interface RemoteRigEntry {
  group: THREE.Group;
  targetPos: THREE.Vector3;
  targetYaw: number;
  appearanceKey: string;
}

interface AnimatedMachineNode {
  machineId: string;
  machineKind: string;
  root: THREE.Object3D;
  spinner: THREE.Object3D | null;
  bobber: THREE.Object3D | null;
}

interface ChunkInstancedEntry {
  mesh: THREE.InstancedMesh;
  kind: TerrainBlockKind;
  coords: [number, number, number][];
}

interface ChunkVoxelData {
  cx: number;
  cz: number;
  key: string;
  minX: number;
  minZ: number;
  heights: Int8Array; // 12 * 12 = 144
  baseVoxels: Uint8Array; // 12 * 12 * 37 = 5328
  liveVoxels: Uint8Array; // 12 * 12 * 37 = 5328
  doorOpen: Set<number>;
  lastUsed: number;
}

interface LoadedSpawnerEntry {
  key: string;
  x: number;
  y: number;
  z: number;
  mobKind: 'night_stalker' | 'slag_golem';
  mesh: THREE.Group;
  cooldown: number;
  maxCooldown: number;
  spinAngle: number;
  flameBurstTimer: number;
  isActive: boolean;
  status: MobSpawnerStatus;
}

interface LoadedChunkMesh {
  cx: number;
  cz: number;
  key: string;
  group: THREE.Group;
  instancedMeshes: ChunkInstancedEntry[];
  doorMeshes: THREE.Object3D[];
  spawnerEntries: LoadedSpawnerEntry[];
}

// Compact integer mapping for O(1) Uint8Array per-chunk voxel caches
const BLOCK_KINDS: readonly TerrainBlockKind[] = [
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
];

const BLOCK_KIND_TO_ID: Record<TerrainBlockKind, number> = (() => {
  const map = {} as Record<TerrainBlockKind, number>;
  for (let i = 0; i < BLOCK_KINDS.length; i++) {
    map[BLOCK_KINDS[i]] = i;
  }
  return map;
})();

const ID_AIR = BLOCK_KIND_TO_ID.air;
const ID_GLASS = BLOCK_KIND_TO_ID.glass;
const ID_TORCH = BLOCK_KIND_TO_ID.torch;
const ID_WOOD_DOOR = BLOCK_KIND_TO_ID.wood_door;
const ID_IRON_DOOR = BLOCK_KIND_TO_ID.iron_door;
const ID_CHEST = BLOCK_KIND_TO_ID.chest;
const ID_LEVER = BLOCK_KIND_TO_ID.lever;
const ID_MOB_SPAWNER = BLOCK_KIND_TO_ID.mob_spawner;

const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE; // 144
const GRID_HEIGHT = WORLD_MAX_Y - WORLD_MIN_Y + 1; // 37
const CHUNK_VOLUME = CHUNK_AREA * GRID_HEIGHT; // 5328
const MAX_CACHED_CHUNK_DATA = 24;
const CHUNKS_BUILT_PER_FRAME = 2;

function isTransparentId(id: number): boolean {
  return (
    id === ID_AIR ||
    id === ID_GLASS ||
    id === ID_TORCH ||
    id === ID_WOOD_DOOR ||
    id === ID_IRON_DOOR ||
    id === ID_LEVER ||
    id === ID_MOB_SPAWNER
  );
}

function packLocalSurface(lx: number, lz: number): number {
  return lz * CHUNK_SIZE + lx;
}

function packLocalVoxel(lx: number, gy: number, lz: number): number {
  return gy * CHUNK_AREA + lz * CHUNK_SIZE + lx;
}

// Reusable math scratchpad (zero GC allocations in animation & raycast loops)
const _dummy = new THREE.Object3D();
const _vForward = new THREE.Vector3();
const _vRight = new THREE.Vector3();
const _vCamTarget = new THREE.Vector3();
const _vCamPos = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _hitNormal = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class VoxelWorldEngine {
  private container: HTMLElement;
  private callbacks: VoxelEngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private lowLagMode = false;
  private materials: VoxelMaterialLibrary;

  private sunLight: THREE.DirectionalLight;
  private sunOffset = new THREE.Vector3(24, 38, 18);
  private lastShadowSnapX = Number.NaN;
  private lastShadowSnapZ = Number.NaN;
  private hemiLight: THREE.HemisphereLight;
  private pmremTex: THREE.Texture | null = null;
  private bgColor = new THREE.Color('#7eb8e8');
  private fogObj = new THREE.Fog('#9ac9ee', 17, 33);
  private targetBgColor = new THREE.Color('#7eb8e8');
  private targetFogColor = new THREE.Color('#9ac9ee');
  private targetSunColor = new THREE.Color('#fff4d6');
  private targetSunIntensity = 1.38;
  private targetHemiIntensity = 0.82;
  private weatherFogNearFactor = 1.0;
  private weatherFogFarFactor = 1.0;
  private targetRainIntensity = 0;
  private currentRainOpacity = 0;
  private weatherKind: DayNightState['weather']['kind'] = 'clear';
  private rainLines: THREE.LineSegments;
  private rainPositions: Float32Array;
  private rainSpeeds: Float32Array;
  private readonly rainMaxDrops = 260;

  private terrainGroup = new THREE.Group();
  private machinesGroup = new THREE.Group();
  private cablesGroup = new THREE.Group();
  private claimsGroup = new THREE.Group();
  private townsGroup = new THREE.Group();
  private personalSpawnGroup = new THREE.Group();
  private claimPreviewGroup = new THREE.Group();
  private remotePlayersGroup = new THREE.Group();
  private mobsGroup = new THREE.Group();
  private playerRig: THREE.Group;
  private playerRightArm: THREE.Object3D | null = null;
  private fpHandGroup: THREE.Group;
  private slashArcMesh: THREE.Mesh;
  private slashArcTimer = 0;
  private hurtCameraTimer = 0;

  private holdingClaimBeacon = false;
  private claimPreviewSizeX = 24;
  private claimPreviewSizeZ = 12;
  private bonusHarvestPower = 0;
  private hungerExhausted = false;
  private lastLockedBumpMs = 0;
  private lastPreviewOriginKey = '';
  private inputPaused = false;
  private tabHidden = false;

  private highlightBox: THREE.LineSegments;
  private laserBeamLine: THREE.Line;
  private laserBeamTimer = 0;
  private remoteLaserLines = new Map<string, { line: THREE.Line; timer: number }>();
  private unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  private doorBoxGeo = new THREE.BoxGeometry(0.96, 1.0, 0.2);
  private torchBoxGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);

  // Lazy 12x12 chunk streaming state (strictly <= MAX_ACTIVE_CHUNKS = 12 rendered)
  private chunkDataCache = new Map<string, ChunkVoxelData>();
  private loadedChunks = new Map<string, LoadedChunkMesh>();
  private instancedEntryLookup = new WeakMap<THREE.Object3D, ChunkInstancedEntry>();
  private activeChunkKeys: string[] = [];
  private activeChunkSet = new Set<string>();
  private chunkBuildQueue: string[] = [];
  private lastChunkEvalX = Number.NaN;
  private lastChunkEvalZ = Number.NaN;
  private lastRayChunkKey = '';
  private deltasByChunk = new Map<string, WorldVoxelDelta[]>();
  private prevDeltasSnapshot: Record<string, WorldVoxelDelta> = {};

  private rayTargets: THREE.Object3D[] = [];
  private animatedMachines: AnimatedMachineNode[] = [];
  private machineCoordSet = new Set<string>();
  private lastMachinesVisualSig = '';

  // World data mirror
  private seed = 1001;
  private worldMode: WorldMode = 'survival';
  private deltas: Record<string, WorldVoxelDelta> = {};
  private torchPositions: TorchCoord[] = [];
  private towns: TownSafeZone[] = [];
  private machines: PlacedMachine[] = [];
  private cables: string[] = [];
  private claims: LandClaim12x12[] = [];
  private grid: PowerGridSnapshot | null = null;
  private localUid = '';
  private localDisplayName = '';
  private showClaimBorders = true;
  private cameraMode: CameraMode = 'first';
  private pickaxeTier: PickaxeTier = 'wood';

  // Player kinematics
  private playerPos = new THREE.Vector3(0.5, 4, 0.5);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private yaw = 0;
  private pitch = -0.22;
  private onGround = false;
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0 };
  private touchCrouching = false;
  private isDraggingLook = false;
  private activePointerId: number | null = null;
  private isPointerLocked = false;
  private pointerDownPos = { x: 0, y: 0 };
  private lastPointerPos = { x: 0, y: 0 };
  private dragMoved = false;
  private longPressTimer: number | null = null;
  private longPressTriggered = false;
  private lastMoveBroadcast = 0;
  private lastSentPos = { x: Number.NaN, y: Number.NaN, z: Number.NaN, yaw: Number.NaN, crouching: false };
  private lastRaycastTime = 0;
  private currentHover: HoverTarget | null = null;
  private swingAnim = 0;
  private walkCyclePhase = 0;
  private currentEyeHeight = 1.62;

  // Remote players & Survival night mobs
  private remoteRigs = new Map<string, RemoteRigEntry>();
  private mobs: HostileMob[] = [];
  private mobMeshes = new Map<string, THREE.Group>();
  private isNight = false;
  private lastMobSpawnCheck = 0;
  private spawnerLookup = new Map<string, LoadedSpawnerEntry>();
  private lastMobAttackMs = 0;

  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private elapsed = 0;
  private frameId = 0;
  private pendingSync: WebGLSync | null = null;
  private disposed = false;

  constructor(
    container: HTMLElement,
    appearance: CharacterAppearance,
    callbacks: VoxelEngineCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.scene = new THREE.Scene();
    this.scene.background = this.bgColor;
    this.scene.fog = this.fogObj;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(68, w / h, 0.1, 54);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    // Cap DPR at 1.5 in normal mode (up to 44% less GPU fill rate on Retina/4K with sharp voxel art)
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Procedural studio environment map (mandatory PBR reflections)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.pmremTex = pmrem.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    this.scene.environment = this.pmremTex;
    pmrem.dispose();

    // Balanced warm sun + cool hemisphere fill
    this.hemiLight = new THREE.HemisphereLight('#c7e4ff', '#3a4635', 0.8);
    this.scene.add(this.hemiLight);

    // Tight player-following shadow frustum (512x512 = 4x fewer shadow texels than 1024x1024)
    this.sunLight = new THREE.DirectionalLight('#fff4d6', 1.35);
    this.sunLight.position.copy(this.sunOffset);
    this.sunLight.castShadow = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      this.sunLight.shadow.mapSize.set(512, 512);
      this.sunLight.shadow.camera.left = -20;
      this.sunLight.shadow.camera.right = 20;
      this.sunLight.shadow.camera.top = 20;
      this.sunLight.shadow.camera.bottom = -20;
      this.sunLight.shadow.camera.near = 4;
      this.sunLight.shadow.camera.far = 92;
      this.sunLight.shadow.bias = -0.0008;
      this.sunLight.shadow.normalBias = 0.035;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const maxAniso = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.materials = createVoxelMaterialLibrary(maxAniso);

    this.scene.add(
      this.terrainGroup,
      this.machinesGroup,
      this.cablesGroup,
      this.claimsGroup,
      this.townsGroup,
      this.personalSpawnGroup,
      this.claimPreviewGroup,
      this.remotePlayersGroup,
      this.mobsGroup
    );

    // Local player voxel rig (visible in 3rd-person view)
    this.playerRig = buildVoxelCharacterRig(appearance);
    this.playerRightArm = this.playerRig.getObjectByName('rightArm') ?? null;
    this.playerRig.visible = false;
    this.scene.add(this.playerRig);

    // First-person held tool/weapon viewmodel & melee slash arc attached to camera
    this.scene.add(this.camera);
    this.fpHandGroup = buildFirstPersonToolRig(this.pickaxeTier);
    this.fpHandGroup.position.set(0.42, -0.34, -0.56);
    this.fpHandGroup.rotation.set(0.08, -0.24, 0.05);
    this.camera.add(this.fpHandGroup);

    this.slashArcMesh = buildMeleeSlashArcMesh();
    this.slashArcMesh.position.set(0, -0.02, -0.78);
    this.slashArcMesh.visible = false;
    this.camera.add(this.slashArcMesh);

    // Minecraft-style crisp block selection wireframe (dispose temp box immediately)
    const tempBox = new THREE.BoxGeometry(1.015, 1.015, 1.015);
    const edges = new THREE.EdgesGeometry(tempBox);
    tempBox.dispose();
    this.highlightBox = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.95 })
    );
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);

    // Direwolf20 Mining Gadget 3D Laser Beam
    const laserGeo = new THREE.BufferGeometry();
    laserGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const laserMat = new THREE.LineBasicMaterial({
      color: '#22d3ee',
      transparent: true,
      opacity: 0.95,
    });
    this.laserBeamLine = new THREE.Line(laserGeo, laserMat);
    this.laserBeamLine.visible = false;
    this.laserBeamLine.frustumCulled = false;
    this.scene.add(this.laserBeamLine);

    // Single-draw-call 3D Light Rain streak field (follows player seamlessly with zero per-frame allocations)
    this.rainPositions = new Float32Array(this.rainMaxDrops * 6);
    this.rainSpeeds = new Float32Array(this.rainMaxDrops);
    for (let i = 0; i < this.rainMaxDrops; i++) {
      const rx = (Math.random() - 0.5) * 26;
      const ry = Math.random() * 18;
      const rz = (Math.random() - 0.5) * 26;
      const idx = i * 6;
      this.rainPositions[idx] = rx;
      this.rainPositions[idx + 1] = ry;
      this.rainPositions[idx + 2] = rz;
      this.rainPositions[idx + 3] = rx + 0.08;
      this.rainPositions[idx + 4] = ry - 0.62;
      this.rainPositions[idx + 5] = rz + 0.04;
      this.rainSpeeds[i] = 13.5 + Math.random() * 5.5;
    }
    const rainGeo = new THREE.BufferGeometry();
    const rainAttr = new THREE.BufferAttribute(this.rainPositions, 3);
    rainAttr.setUsage(THREE.DynamicDrawUsage);
    rainGeo.setAttribute('position', rainAttr);
    const rainMat = new THREE.LineBasicMaterial({
      color: '#cfe8ff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.rainLines.visible = false;
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);

    this.applyPerformanceSettings();
    this.bindEvents();
    this.startLoop();
  }

  private applyPerformanceSettings() {
    const low = this.lowLagMode || this.isSoftwareGl;
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 1.5));
    const shadowsOn = !low;
    if (this.renderer.shadowMap.enabled !== shadowsOn) {
      this.renderer.shadowMap.enabled = shadowsOn;
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.sunLight.castShadow = shadowsOn;

    // Tight chunk-horizon fog & camera far plane smoothly mask the 12-chunk frontier
    const baseNear = low ? 13 : 17;
    const baseFar = low ? 26 : 33;
    this.fogObj.near = Math.max(3.5, baseNear * this.weatherFogNearFactor);
    this.fogObj.far = Math.max(this.fogObj.near + 8, baseFar * this.weatherFogFarFactor);
    const activeRainDrops = low ? 110 : this.rainMaxDrops;
    this.rainLines.geometry.setDrawRange(0, activeRainDrops * 2);
    this.camera.far = low ? 42 : 54;
    this.camera.updateProjectionMatrix();
  }

  public setLowLagMode(enabled: boolean) {
    if (this.lowLagMode === enabled) return;
    this.lowLagMode = enabled;
    this.applyPerformanceSettings();
  }

  // --- Lazy 12x12 Chunk Data Cache (chunks never generate until player approaches) ---

  private rebuildDeltasByChunkIndex() {
    this.deltasByChunk.clear();
    this.torchPositions = extractTorchPositions(this.deltas);
    for (const key in this.deltas) {
      const d = this.deltas[key];
      if (!isWithinWorldBounds(d.x, d.y, d.z)) continue;
      const ck = chunkKey(worldToChunk(d.x), worldToChunk(d.z));
      let arr = this.deltasByChunk.get(ck);
      if (!arr) {
        arr = [];
        this.deltasByChunk.set(ck, arr);
      }
      arr.push(d);
    }
  }

  private applyDeltasToChunkData(data: ChunkVoxelData) {
    data.liveVoxels.set(data.baseVoxels);
    data.doorOpen.clear();
    const list = this.deltasByChunk.get(data.key);
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const lx = d.x - data.minX;
      const lz = d.z - data.minZ;
      const gy = d.y - WORLD_MIN_Y;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || gy < 0 || gy >= GRID_HEIGHT) {
        continue;
      }
      const idx = packLocalVoxel(lx, gy, lz);
      const id = BLOCK_KIND_TO_ID[d.kind] ?? ID_AIR;
      data.liveVoxels[idx] = id;
      if ((id === ID_WOOD_DOOR || id === ID_IRON_DOOR || id === ID_LEVER) && d.open) {
        data.doorOpen.add(idx);
      }
    }
  }

  private getOrCreateChunkData(cx: number, cz: number): ChunkVoxelData {
    const key = chunkKey(cx, cz);
    const existing = this.chunkDataCache.get(key);
    if (existing) {
      existing.lastUsed = performance.now();
      return existing;
    }

    const bounds = getChunkBlockBounds(cx, cz);
    const heights = new Int8Array(CHUNK_AREA);
    const baseVoxels = new Uint8Array(CHUNK_VOLUME);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = bounds.minZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = bounds.minX + lx;
        const surf = getSurfaceHeight(this.seed, wx, wz);
        heights[packLocalSurface(lx, lz)] = surf;
        const maxBaseY = Math.min(WORLD_MAX_Y, surf + 9);
        for (let y = WORLD_MIN_Y; y <= maxBaseY; y++) {
          const gy = y - WORLD_MIN_Y;
          baseVoxels[packLocalVoxel(lx, gy, lz)] =
            BLOCK_KIND_TO_ID[getBaseVoxel(this.seed, wx, y, wz)];
        }
      }
    }

    const liveVoxels = new Uint8Array(CHUNK_VOLUME);
    const data: ChunkVoxelData = {
      cx,
      cz,
      key,
      minX: bounds.minX,
      minZ: bounds.minZ,
      heights,
      baseVoxels,
      liveVoxels,
      doorOpen: new Set<number>(),
      lastUsed: performance.now(),
    };
    this.applyDeltasToChunkData(data);
    this.chunkDataCache.set(key, data);
    this.evictStaleChunkData();
    return data;
  }

  private evictStaleChunkData() {
    while (this.chunkDataCache.size > MAX_CACHED_CHUNK_DATA) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, data] of this.chunkDataCache.entries()) {
        if (this.activeChunkSet.has(k)) continue;
        if (data.lastUsed < oldestTime) {
          oldestTime = data.lastUsed;
          oldestKey = k;
        }
      }
      if (!oldestKey) break;
      this.chunkDataCache.delete(oldestKey);
    }
  }

  private getSurfaceYCached(x: number, z: number): number {
    const ix = Math.max(WORLD_MIN_XZ, Math.min(WORLD_MAX_XZ, Math.floor(x)));
    const iz = Math.max(WORLD_MIN_XZ, Math.min(WORLD_MAX_XZ, Math.floor(z)));
    const cx = worldToChunk(ix);
    const cz = worldToChunk(iz);
    const cached = this.chunkDataCache.get(chunkKey(cx, cz));
    if (cached) {
      return cached.heights[packLocalSurface(ix - cached.minX, iz - cached.minZ)];
    }
    return getSurfaceHeight(this.seed, ix, iz);
  }

  private getVoxelIdAtWorld(wx: number, wy: number, wz: number): number {
    if (wy < WORLD_MIN_Y || wy > WORLD_MAX_Y) return ID_AIR;
    if (wx < WORLD_MIN_XZ || wx > WORLD_MAX_XZ || wz < WORLD_MIN_XZ || wz > WORLD_MAX_XZ) {
      return ID_AIR;
    }
    const cx = worldToChunk(wx);
    const cz = worldToChunk(wz);
    const data = this.getOrCreateChunkData(cx, cz);
    return data.liveVoxels[packLocalVoxel(wx - data.minX, wy - WORLD_MIN_Y, wz - data.minZ)];
  }

  public getVoxelKindAt(wx: number, wy: number, wz: number): TerrainBlockKind {
    return BLOCK_KINDS[this.getVoxelIdAtWorld(Math.floor(wx), Math.floor(wy), Math.floor(wz))] || 'air';
  }

  public pulseMiningLaser(tx: number, ty: number, tz: number) {
    const posAttr = this.laserBeamLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const rightX = Math.cos(this.yaw) * 0.28;
    const rightZ = -Math.sin(this.yaw) * 0.28;
    const fwdX = -Math.sin(this.yaw) * 0.35;
    const fwdZ = -Math.cos(this.yaw) * 0.35;
    const startX = this.playerPos.x + rightX + fwdX;
    const startY = this.playerPos.y + 1.36;
    const startZ = this.playerPos.z + rightZ + fwdZ;
    posAttr.setXYZ(0, startX, startY, startZ);
    posAttr.setXYZ(1, tx + 0.5, ty + 0.5, tz + 0.5);
    posAttr.needsUpdate = true;
    this.laserBeamLine.visible = true;
    this.laserBeamTimer = 0.16;
  }

  public pulseRemoteLaser(clientId: string, tx: number, ty: number, tz: number) {
    const rigEntry = this.remoteRigs.get(clientId);
    if (!rigEntry) return;
    let entry = this.remoteLaserLines.get(clientId);
    if (!entry) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.scene.add(line);
      entry = { line, timer: 0 };
      this.remoteLaserLines.set(clientId, entry);
    }
    const pos = rigEntry.group.position;
    const posAttr = entry.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, pos.x, pos.y + 1.32, pos.z);
    posAttr.setXYZ(1, tx + 0.5, ty + 0.5, tz + 0.5);
    posAttr.needsUpdate = true;
    entry.line.visible = true;
    entry.timer = 0.22;
  }

  private isNeighborTransparent(
    localData: ChunkVoxelData,
    lx: number,
    gy: number,
    lz: number
  ): boolean {
    if (gy < 0 || gy >= GRID_HEIGHT) return true;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return isTransparentId(localData.liveVoxels[packLocalVoxel(lx, gy, lz)]);
    }

    const wx = localData.minX + lx;
    const wz = localData.minZ + lz;
    const wy = WORLD_MIN_Y + gy;
    if (wx < WORLD_MIN_XZ || wx > WORLD_MAX_XZ || wz < WORLD_MIN_XZ || wz > WORLD_MAX_XZ) {
      return wy > getSurfaceHeight(this.seed, Math.max(WORLD_MIN_XZ, Math.min(WORLD_MAX_XZ, wx)), Math.max(WORLD_MIN_XZ, Math.min(WORLD_MAX_XZ, wz)));
    }

    const ncx = worldToChunk(wx);
    const ncz = worldToChunk(wz);
    const neighborKey = chunkKey(ncx, ncz);
    const neighborData = this.chunkDataCache.get(neighborKey);
    if (neighborData) {
      return isTransparentId(
        neighborData.liveVoxels[packLocalVoxel(wx - neighborData.minX, gy, wz - neighborData.minZ)]
      );
    }

    // Neighbor chunk is NOT loaded yet: never eagerly generate its terrain!
    // Expose frontier faces near/above surface so chunk edges stay clean; cull deep underground solid faces.
    const nSurf = getSurfaceHeight(this.seed, wx, wz);
    return wy >= nSurf - 1;
  }

  // --- Chunk Mesh Building & Disposal (Zero GPU Memory Leaks) ---

  private resolveSpawnerMobKind(wx: number, wy: number, wz: number): 'night_stalker' | 'slag_golem' {
    const sp = getNaturalSpawnerNear(this.seed, wx, wz);
    if (sp && sp.x === wx && sp.y === wy && sp.z === wz) {
      return sp.mobKind;
    }
    const h = Math.abs(Math.imul(wx, 374761393) ^ Math.imul(wz, 668265263) ^ Math.imul(wy, 1442695041));
    return h % 3 === 0 ? 'slag_golem' : 'night_stalker';
  }

  private createLoadedSpawnerEntry(wx: number, wy: number, wz: number): LoadedSpawnerEntry {
    const key = voxelKey(wx, wy, wz);
    const mobKind = this.resolveSpawnerMobKind(wx, wy, wz);
    const mesh = buildMobSpawnerMesh(wx, wy, wz, mobKind);
    const entry: LoadedSpawnerEntry = {
      key,
      x: wx,
      y: wy,
      z: wz,
      mobKind,
      mesh,
      cooldown: 3.5,
      maxCooldown: 10,
      spinAngle: ((wx * 13 + wz * 29) & 15) * 0.4,
      flameBurstTimer: 0,
      isActive: false,
      status: 'daylight',
    };
    this.spawnerLookup.set(key, entry);
    return entry;
  }

  private disposeLoadedChunk(key: string) {
    const chunk = this.loadedChunks.get(key);
    if (!chunk) return;
    for (let i = 0; i < chunk.instancedMeshes.length; i++) {
      const entry = chunk.instancedMeshes[i];
      this.instancedEntryLookup.delete(entry.mesh);
      chunk.group.remove(entry.mesh);
      entry.mesh.dispose();
    }
    chunk.instancedMeshes.length = 0;
    for (let i = 0; i < chunk.doorMeshes.length; i++) {
      const obj = chunk.doorMeshes[i];
      if (obj instanceof THREE.Group) {
        chunk.group.remove(obj);
        disposeObject3D(obj);
      }
    }
    chunk.doorMeshes.length = 0;
    for (let i = 0; i < chunk.spawnerEntries.length; i++) {
      const sp = chunk.spawnerEntries[i];
      chunk.group.remove(sp.mesh);
      disposeObject3D(sp.mesh);
      this.spawnerLookup.delete(sp.key);
    }
    chunk.spawnerEntries.length = 0;
    chunk.group.clear();
    this.terrainGroup.remove(chunk.group);
    this.loadedChunks.delete(key);
  }

  private clearAllLoadedChunks() {
    for (const key of Array.from(this.loadedChunks.keys())) {
      this.disposeLoadedChunk(key);
    }
    this.chunkBuildQueue.length = 0;
  }

  private buildChunkMesh(key: string) {
    const parsed = parseChunkKey(key);
    if (!parsed) return;
    const { cx, cz } = parsed;

    // Dispose prior version if rebuilding after block mine/place
    if (this.loadedChunks.has(key)) {
      this.disposeLoadedChunk(key);
    }

    const data = this.getOrCreateChunkData(cx, cz);
    const live = data.liveVoxels;
    const buckets: [number, number, number][][] = Array.from(
      { length: BLOCK_KINDS.length },
      () => []
    );
    const group = new THREE.Group();
    const doorMeshes: THREE.Object3D[] = [];
    const spawnerEntries: LoadedSpawnerEntry[] = [];

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = data.minZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = data.minX + lx;
        const surf = data.heights[packLocalSurface(lx, lz)];
        const maxScanY = Math.min(WORLD_MAX_Y, surf + 9);

        for (let y = WORLD_MIN_Y; y <= maxScanY; y++) {
          const gy = y - WORLD_MIN_Y;
          const idx = packLocalVoxel(lx, gy, lz);
          const id = live[idx];
          if (id === ID_AIR) continue;

          if (id === ID_WOOD_DOOR || id === ID_IRON_DOOR) {
            const isOpen = data.doorOpen.has(idx);
            const kind = BLOCK_KINDS[id];
            const doorMat = this.materials.getMaterial(kind);
            const doorMesh = new THREE.Mesh(this.doorBoxGeo, doorMat);
            doorMesh.position.set(
              wx + (isOpen ? 0.14 : 0.5),
              y + 0.5,
              wz + (isOpen ? 0.84 : 0.5)
            );
            doorMesh.rotation.y = isOpen ? Math.PI / 2 : 0;
            doorMesh.castShadow = true;
            doorMesh.receiveShadow = true;
            doorMesh.userData = {
              interactKind: 'door',
              blockX: wx,
              blockY: y,
              blockZ: wz,
              blockKind: kind,
            };
            group.add(doorMesh);
            doorMeshes.push(doorMesh);
            continue;
          }

          if (id === ID_LEVER) {
            const isOpen = data.doorOpen.has(idx);
            const leverGroup = buildLeverMesh(wx, y, wz, isOpen);
            group.add(leverGroup);
            doorMeshes.push(leverGroup);
            continue;
          }

          if (id === ID_MOB_SPAWNER) {
            const spEntry = this.createLoadedSpawnerEntry(wx, y, wz);
            group.add(spEntry.mesh);
            spawnerEntries.push(spEntry);
            continue;
          }

          const exposed =
            this.isNeighborTransparent(data, lx + 1, gy, lz) ||
            this.isNeighborTransparent(data, lx - 1, gy, lz) ||
            this.isNeighborTransparent(data, lx, gy + 1, lz) ||
            this.isNeighborTransparent(data, lx, gy - 1, lz) ||
            this.isNeighborTransparent(data, lx, gy, lz + 1) ||
            this.isNeighborTransparent(data, lx, gy, lz - 1);
          if (!exposed) continue;

          buckets[id].push([wx, y, wz]);
        }
      }
    }

    // High-altitude player-placed blocks above surf + 9 inside this chunk
    const chunkDeltas = this.deltasByChunk.get(key);
    if (chunkDeltas) {
      for (let i = 0; i < chunkDeltas.length; i++) {
        const delta = chunkDeltas[i];
        if (delta.kind === 'air') continue;
        const lx = delta.x - data.minX;
        const lz = delta.z - data.minZ;
        if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
        const surf = data.heights[packLocalSurface(lx, lz)];
        if (delta.y <= surf + 9) continue;

        if (delta.kind === 'lever') {
          const isOpen = Boolean(delta.open);
          const leverGroup = buildLeverMesh(delta.x, delta.y, delta.z, isOpen);
          group.add(leverGroup);
          doorMeshes.push(leverGroup);
        } else if (DOOR_KINDS.has(delta.kind)) {
          const isOpen = Boolean(delta.open);
          const doorMat = this.materials.getMaterial(delta.kind);
          const doorMesh = new THREE.Mesh(this.doorBoxGeo, doorMat);
          doorMesh.position.set(
            delta.x + (isOpen ? 0.14 : 0.5),
            delta.y + 0.5,
            delta.z + (isOpen ? 0.84 : 0.5)
          );
          doorMesh.rotation.y = isOpen ? Math.PI / 2 : 0;
          doorMesh.castShadow = true;
          doorMesh.receiveShadow = true;
          doorMesh.userData = {
            interactKind: 'door',
            blockX: delta.x,
            blockY: delta.y,
            blockZ: delta.z,
            blockKind: delta.kind,
          };
          group.add(doorMesh);
          doorMeshes.push(doorMesh);
        } else if (delta.kind === 'mob_spawner') {
          const spEntry = this.createLoadedSpawnerEntry(delta.x, delta.y, delta.z);
          group.add(spEntry.mesh);
          spawnerEntries.push(spEntry);
        } else {
          const id = BLOCK_KIND_TO_ID[delta.kind];
          if (id !== undefined && id !== ID_AIR) {
            buckets[id].push([delta.x, delta.y, delta.z]);
          }
        }
      }
    }

    const instancedMeshes: ChunkInstancedEntry[] = [];
    for (let id = 1; id < buckets.length; id++) {
      const coords = buckets[id];
      if (coords.length === 0) continue;
      const kind = BLOCK_KINDS[id];
      const mat = this.materials.getMaterial(kind);
      const geo = id === ID_TORCH ? this.torchBoxGeo : this.unitBoxGeo;
      const inst = new THREE.InstancedMesh(geo, mat, coords.length);
      inst.castShadow = id !== ID_TORCH && id !== ID_GLASS;
      inst.receiveShadow = true;
      inst.userData = { interactKind: 'terrain', blockKind: kind, chunkKey: key };

      const yOff = id === ID_TORCH ? 0.34 : 0.5;
      for (let i = 0; i < coords.length; i++) {
        const [bx, by, bz] = coords[i];
        _dummy.position.set(bx + 0.5, by + yOff, bz + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        inst.setMatrixAt(i, _dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
      const entry: ChunkInstancedEntry = { mesh: inst, kind, coords };
      instancedMeshes.push(entry);
      this.instancedEntryLookup.set(inst, entry);
    }

    this.terrainGroup.add(group);
    this.loadedChunks.set(key, {
      cx,
      cz,
      key,
      group,
      instancedMeshes,
      doorMeshes,
      spawnerEntries,
    });
  }

  /**
   * Streams the strictly 12 closest 12x12 chunks around the player.
   * Immediately unloads & disposes distant chunks outside the 12-chunk window.
   */
  private updateActiveChunks(immediate: boolean) {
    const px = this.playerPos.x;
    const pz = this.playerPos.z;
    if (
      !immediate &&
      !Number.isNaN(this.lastChunkEvalX) &&
      Math.hypot(px - this.lastChunkEvalX, pz - this.lastChunkEvalZ) < 1.5
    ) {
      return;
    }
    this.lastChunkEvalX = px;
    this.lastChunkEvalZ = pz;

    const desiredKeys = getClosestChunkKeys(px, pz, MAX_ACTIVE_CHUNKS);
    const desiredSet = new Set(desiredKeys);
    const setChanged =
      desiredKeys.length !== this.activeChunkKeys.length ||
      desiredKeys.some((k) => !this.activeChunkSet.has(k));

    if (!setChanged && !immediate) {
      // Still check if player crossed into a new center chunk for tighter raycast targets
      const curCenterKey = chunkKey(worldToChunk(px), worldToChunk(pz));
      if (curCenterKey !== this.lastRayChunkKey) {
        this.rebuildRayTargets();
      }
      return;
    }

    this.activeChunkKeys = desiredKeys;
    this.activeChunkSet = desiredSet;

    // 1. Unload & dispose any chunks outside the active 12-chunk window immediately
    let unloadedAny = false;
    for (const loadedKey of Array.from(this.loadedChunks.keys())) {
      if (!desiredSet.has(loadedKey)) {
        this.disposeLoadedChunk(loadedKey);
        unloadedAny = true;
      }
    }

    // 2. Queue missing chunks (closest-first order from getClosestChunkKeys)
    const missing: string[] = [];
    for (let i = 0; i < desiredKeys.length; i++) {
      const k = desiredKeys[i];
      if (!this.loadedChunks.has(k)) {
        missing.push(k);
      }
    }

    if (immediate) {
      this.chunkBuildQueue.length = 0;
      for (let i = 0; i < missing.length; i++) {
        this.buildChunkMesh(missing[i]);
      }
    } else {
      this.chunkBuildQueue = missing;
    }

    // 3. Cull distant machines, cables, and claim borders outside the 12 active chunks
    this.applyActiveChunkCulling();

    if (immediate || unloadedAny || setChanged) {
      this.rebuildRayTargets();
    }

    if (setChanged || immediate) {
      this.callbacks.onActiveChunksChanged?.(desiredKeys);
    }
  }

  private processChunkBuildQueue() {
    if (this.chunkBuildQueue.length === 0) return;
    let built = 0;
    while (built < CHUNKS_BUILT_PER_FRAME && this.chunkBuildQueue.length > 0) {
      const key = this.chunkBuildQueue.shift()!;
      if (!this.activeChunkSet.has(key)) continue;
      if (this.loadedChunks.has(key)) continue;
      this.buildChunkMesh(key);
      built++;
    }
    if (built > 0) {
      this.rebuildRayTargets();
    }
  }

  /**
   * Incrementally rebuilds ONLY the 1-2 active chunks touched by recent voxel edits
   * instead of rebuilding the entire world on every block mine/place.
   */
  private applyIncrementalDeltaChanges() {
    const affectedChunks = new Set<string>();
    const prev = this.prevDeltasSnapshot;
    const next = this.deltas;

    const markVoxelChunk = (d: WorldVoxelDelta) => {
      if (!isWithinWorldBounds(d.x, d.y, d.z)) return;
      const cx = worldToChunk(d.x);
      const cz = worldToChunk(d.z);
      affectedChunks.add(chunkKey(cx, cz));
      const lx = d.x - cx * CHUNK_SIZE;
      const lz = d.z - cz * CHUNK_SIZE;
      if (lx === 0) affectedChunks.add(chunkKey(cx - 1, cz));
      if (lx === CHUNK_SIZE - 1) affectedChunks.add(chunkKey(cx + 1, cz));
      if (lz === 0) affectedChunks.add(chunkKey(cx, cz - 1));
      if (lz === CHUNK_SIZE - 1) affectedChunks.add(chunkKey(cx, cz + 1));
    };

    for (const k in next) {
      const nd = next[k];
      const pd = prev[k];
      if (!pd || pd.kind !== nd.kind || Boolean(pd.open) !== Boolean(nd.open)) {
        markVoxelChunk(nd);
      }
    }
    for (const k in prev) {
      if (!(k in next)) {
        markVoxelChunk(prev[k]);
      }
    }

    this.prevDeltasSnapshot = next;
    this.rebuildDeltasByChunkIndex();

    if (affectedChunks.size === 0) return;

    let rebuiltMesh = false;
    for (const ck of affectedChunks) {
      const cached = this.chunkDataCache.get(ck);
      if (cached) {
        this.applyDeltasToChunkData(cached);
      }
      if (this.loadedChunks.has(ck) && this.activeChunkSet.has(ck)) {
        this.buildChunkMesh(ck);
        rebuiltMesh = true;
      }
    }

    if (rebuiltMesh) {
      this.rebuildRayTargets();
    }
  }

  private applyActiveChunkCulling() {
    for (let i = 0; i < this.machinesGroup.children.length; i++) {
      const child = this.machinesGroup.children[i];
      const ck = child.userData.chunkKey as string | undefined;
      child.visible = !ck || this.activeChunkSet.has(ck);
    }
    for (let i = 0; i < this.cablesGroup.children.length; i++) {
      const child = this.cablesGroup.children[i];
      const ck = child.userData.chunkKey as string | undefined;
      child.visible = !ck || this.activeChunkSet.has(ck);
    }
    for (let i = 0; i < this.claimsGroup.children.length; i++) {
      const child = this.claimsGroup.children[i];
      const keys = child.userData.claimChunkKeys as string[] | undefined;
      child.visible = !keys || keys.some((k) => this.activeChunkSet.has(k));
    }
    for (let i = 0; i < this.townsGroup.children.length; i++) {
      const child = this.townsGroup.children[i];
      const keys = child.userData.townChunkKeys as string[] | undefined;
      child.visible = !keys || keys.some((k) => this.activeChunkSet.has(k));
    }
    for (let i = 0; i < this.personalSpawnGroup.children.length; i++) {
      const child = this.personalSpawnGroup.children[i];
      const ck = child.userData.chunkKey as string | undefined;
      child.visible = !ck || this.activeChunkSet.has(ck);
    }
  }

  private rebuildMachineCoordIndex() {
    this.machineCoordSet.clear();
    for (const m of this.machines) {
      if (isWithinWorldBounds(m.x, m.y, m.z)) {
        this.machineCoordSet.add(voxelKey(m.x, m.y, m.z));
      }
    }
  }

  /**
   * Distance-culled raycasting: only test visible machines/cables and loaded chunks
   * within Chebyshev chunk distance <= 1 of the player (covers 100% of reach distance).
   */
  private rebuildRayTargets() {
    this.rayTargets.length = 0;
    const pcx = worldToChunk(this.playerPos.x);
    const pcz = worldToChunk(this.playerPos.z);
    this.lastRayChunkKey = chunkKey(pcx, pcz);

    for (let i = 0; i < this.machinesGroup.children.length; i++) {
      const child = this.machinesGroup.children[i];
      if (child.visible) this.rayTargets.push(child);
    }
    for (let i = 0; i < this.cablesGroup.children.length; i++) {
      const child = this.cablesGroup.children[i];
      if (child.visible) this.rayTargets.push(child);
    }
    for (const chunk of this.loadedChunks.values()) {
      if (Math.abs(chunk.cx - pcx) > 1 || Math.abs(chunk.cz - pcz) > 1) continue;
      for (let i = 0; i < chunk.doorMeshes.length; i++) {
        this.rayTargets.push(chunk.doorMeshes[i]);
      }
      for (let i = 0; i < chunk.spawnerEntries.length; i++) {
        this.rayTargets.push(chunk.spawnerEntries[i].mesh);
      }
      for (let i = 0; i < chunk.instancedMeshes.length; i++) {
        this.rayTargets.push(chunk.instancedMeshes[i].mesh);
      }
    }
  }

  private updateShadowTarget() {
    if (!this.sunLight.castShadow) return;
    const snapX = Math.floor(this.playerPos.x / 2) * 2;
    const snapZ = Math.floor(this.playerPos.z / 2) * 2;
    if (snapX === this.lastShadowSnapX && snapZ === this.lastShadowSnapZ) return;
    this.lastShadowSnapX = snapX;
    this.lastShadowSnapZ = snapZ;
    this.sunLight.target.position.set(snapX, 2, snapZ);
    this.sunLight.position.set(
      snapX + this.sunOffset.x,
      this.sunOffset.y,
      snapZ + this.sunOffset.z
    );
    this.sunLight.target.updateMatrixWorld();
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    const dom = this.renderer.domElement;
    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    dom.addEventListener('contextmenu', this.onContextMenu);
    dom.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onPointerLockChange = () => {
    this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (this.isPointerLocked) {
      this.isDraggingLook = false;
    }
  };

  public togglePointerLock() {
    const dom = this.renderer.domElement;
    try {
      if (document.pointerLockElement === dom) {
        document.exitPointerLock?.();
      } else {
        dom.requestPointerLock?.();
      }
    } catch {
      // Gracefully ignore if browser/iframe blocks pointer lock; drag-look & arrow keys always work
    }
  }

  private onVisibilityChange = () => {
    this.tabHidden = document.hidden;
    if (this.tabHidden) {
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
      this.frameId = 0;
    } else if (!this.disposed && this.frameId === 0) {
      this.clock.getDelta();
      this.scheduleNextTick();
    }
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onWebglContextLost?.();
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault();
    }
    this.keys.add(e.code);
    if (e.code === 'KeyE' && !this.inputPaused) {
      this.triggerPrimaryInteract();
    } else if (e.code === 'KeyF' && !this.inputPaused) {
      this.togglePointerLock();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.inputPaused) return;
    // When in free Pointer-Lock mouse-look mode, clicks act immediately at the center crosshair
    if (this.isPointerLocked) {
      const target = this.raycastCenter();
      if (!target) return;
      if (e.button === 2) {
        this.handleSecondaryAction(target);
      } else if (e.button === 0) {
        this.handlePrimaryClickTarget(target);
      }
      return;
    }

    // Multi-touch safety on Android/iPad: keep tracking the primary look finger if already dragging
    if (this.isDraggingLook && this.activePointerId !== null) return;

    this.isDraggingLook = true;
    this.activePointerId = e.pointerId;
    this.dragMoved = false;
    this.longPressTriggered = false;
    this.clearLongPressTimer();
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.lastPointerPos = { x: e.clientX, y: e.clientY };

    // On touch devices (phones & tablets), holding finger steady for 420ms triggers secondary action (place block / open machine console)
    if (e.pointerType === 'touch') {
      const downX = e.clientX;
      const downY = e.clientY;
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTimer = null;
        if (this.isDraggingLook && !this.dragMoved && !this.inputPaused) {
          const target = this.raycastFromClient(downX, downY) ?? this.raycastCenter();
          if (target) {
            this.longPressTriggered = true;
            this.handleSecondaryAction(target);
          }
        }
      }, 420);
    }

    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic or unsupported pointer capture
    }
  };

  private clearLongPressTimer() {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.inputPaused) return;

    // Free Pointer-Lock mouse look (instant 1:1 Minecraft feel)
    if (this.isPointerLocked) {
      const lockSens = 0.0036;
      this.yaw -= (e.movementX || 0) * lockSens;
      this.pitch = Math.max(-1.48, Math.min(1.45, this.pitch - (e.movementY || 0) * lockSens));
      return;
    }

    if (!this.isDraggingLook) {
      if (this.cameraMode === 'third' && e.pointerType === 'mouse') {
        this.updateHoverFromClient(e.clientX, e.clientY);
      }
      return;
    }

    // Multi-touch safety on Android/iPad: ignore movement from thumbstick or secondary fingers
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

    const dx = e.clientX - this.lastPointerPos.x;
    const dy = e.clientY - this.lastPointerPos.y;
    this.lastPointerPos = { x: e.clientX, y: e.clientY };
    const moveThreshold = e.pointerType === 'touch' ? 9 : 5;
    if (Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y) > moveThreshold) {
      this.dragMoved = true;
      this.clearLongPressTimer();
    }
    // Snappy, responsive look sensitivity (smooth on both desktop mouse and tablet/mobile touch)
    const sensX = e.pointerType === 'touch' ? 0.0075 : 0.0098;
    const sensY = e.pointerType === 'touch' ? 0.0068 : 0.0088;
    this.yaw -= dx * sensX;
    this.pitch = Math.max(-1.48, Math.min(1.45, this.pitch - dy * sensY));
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (this.activePointerId === e.pointerId) {
      this.clearLongPressTimer();
      this.isDraggingLook = false;
      this.activePointerId = null;
    }
  };

  private isSneaking(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchCrouching;
  }

  private triggerSwingAnimation(withSlashArc = false) {
    this.swingAnim = 1;
    if (withSlashArc) {
      this.slashArcTimer = 0.24;
      this.slashArcMesh.visible = true;
      this.slashArcMesh.rotation.z = (Math.random() - 0.5) * 0.7;
    }
  }

  private findClosestMobInMeleeCone(maxDist = 3.7): HostileMob | null {
    if (this.mobs.length === 0) return null;
    const lookX = -Math.sin(this.yaw);
    const lookZ = -Math.cos(this.yaw);
    let best: HostileMob | null = null;
    let bestDist = maxDist;
    for (const mob of this.mobs) {
      if ((mob.deathTimer ?? 0) > 0 || mob.hp <= 0) continue;
      const dx = mob.x - this.playerPos.x;
      const dz = mob.z - this.playerPos.z;
      const dy = Math.abs(mob.y - this.playerPos.y);
      if (dy > 2.4) continue;
      const dist = Math.hypot(dx, dz);
      if (dist > bestDist) continue;
      if (dist > 0.85) {
        const dot = (dx / dist) * lookX + (dz / dist) * lookZ;
        if (dot < 0.45) continue; // ~63 deg half-cone in front of player
      }
      bestDist = dist;
      best = mob;
    }
    return best;
  }

  private handlePrimaryClickTarget(target: HoverTarget) {
    if (target.kind === 'mob' && target.mobId) {
      this.triggerSwingAnimation(true);
      this.callbacks.onStrikeMob(target.mobId);
      return;
    }
    // If a hostile mob is directly in front of the player within melee reach, prioritize striking it
    const nearbyMob = this.findClosestMobInMeleeCone(3.1);
    if (nearbyMob && target.kind === 'block') {
      this.triggerSwingAnimation(true);
      this.callbacks.onStrikeMob(nearbyMob.id);
      return;
    }

    if (target.kind === 'machine' && target.machineId) {
      if (this.isSneaking()) {
        this.triggerSwingAnimation(false);
        this.callbacks.onRemoveMachine(target.machineId);
      } else {
        this.callbacks.onClickMachine(target.machineId);
      }
    } else if (target.kind === 'cable') {
      this.triggerSwingAnimation(false);
      this.callbacks.onRemoveCable(target.x, target.y, target.z);
    } else if (target.kind === 'block' && target.blockKind) {
      if (target.blockKind === 'chest' && !this.isSneaking()) {
        this.callbacks.onOpenChest?.(target.x, target.y, target.z);
      } else if (DOOR_KINDS.has(target.blockKind) && !this.isSneaking()) {
        this.callbacks.onToggleDoor(target.x, target.y, target.z);
      } else {
        this.triggerSwingAnimation(false);
        this.pulseMiningLaser(target.x, target.y, target.z);
        this.callbacks.onMineBlock(target.x, target.y, target.z, target.blockKind);
      }
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    this.clearLongPressTimer();
    if (!this.isDraggingLook) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    if (this.activePointerId === e.pointerId) {
      try {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }
      this.activePointerId = null;
    }
    this.isDraggingLook = false;
    if (this.dragMoved || this.longPressTriggered || this.inputPaused) return;

    const target = this.raycastFromClient(e.clientX, e.clientY);
    if (!target) {
      // Swinging in air or striking nearby mob in front cone
      const coneMob = this.findClosestMobInMeleeCone(3.6);
      if (coneMob) {
        this.triggerSwingAnimation(true);
        this.callbacks.onStrikeMob(coneMob.id);
      } else {
        this.triggerSwingAnimation(false);
      }
      return;
    }

    if (e.button === 2) {
      this.handleSecondaryAction(target);
    } else if (e.button === 0) {
      this.handlePrimaryClickTarget(target);
    }
  };

  private handleSecondaryAction(target: HoverTarget) {
    if (target.kind === 'machine' && target.machineId) {
      this.callbacks.onClickMachine(target.machineId);
      return;
    }
    if (target.kind === 'block' && target.blockKind === 'chest') {
      this.callbacks.onOpenChest?.(target.x, target.y, target.z);
      return;
    }
    if (target.kind === 'block' && target.blockKind && DOOR_KINDS.has(target.blockKind)) {
      this.callbacks.onToggleDoor(target.x, target.y, target.z);
      return;
    }
    if (target.placeX !== undefined && target.placeY !== undefined && target.placeZ !== undefined) {
      const px = Math.floor(this.playerPos.x);
      const py = Math.floor(this.playerPos.y);
      const pz = Math.floor(this.playerPos.z);
      if (target.placeX === px && target.placeZ === pz) {
        // Allow pillar-jumping out of 1-block holes if player jumped at least 0.55 blocks above target.placeY
        if (target.placeY === py) {
          if (this.playerPos.y < target.placeY + 0.55) {
            return;
          }
          this.playerPos.y = Math.max(this.playerPos.y, target.placeY + 1);
          this.playerVel.y = Math.max(0, this.playerVel.y);
        } else if (target.placeY === py + 1) {
          return;
        }
      }
      this.swingAnim = 1;
      this.callbacks.onPlaceAt(target.placeX, target.placeY, target.placeZ);
    }
  }

  public setInputPaused(paused: boolean) {
    this.inputPaused = paused;
    if (paused) {
      this.isDraggingLook = false;
      this.keys.clear();
      if (this.isPointerLocked && document.pointerLockElement === this.renderer.domElement) {
        try {
          document.exitPointerLock?.();
        } catch {
          // Ignore exit errors
        }
      }
    }
  }

  public triggerMineCenter() {
    const target = this.raycastCenter();
    if (target?.kind === 'mob' && target.mobId) {
      this.triggerSwingAnimation(true);
      this.callbacks.onStrikeMob(target.mobId);
      return;
    }
    // Check melee sweep cone for nearby hostile mobs (great for mobile/tablet & fast combat)
    const coneMob = this.findClosestMobInMeleeCone(3.7);
    if (coneMob) {
      this.triggerSwingAnimation(true);
      this.callbacks.onStrikeMob(coneMob.id);
      return;
    }

    if (!target) {
      this.triggerSwingAnimation(false);
      return;
    }
    if (target.kind === 'machine' && target.machineId) {
      this.triggerSwingAnimation(false);
      this.callbacks.onRemoveMachine(target.machineId);
    } else if (target.kind === 'cable') {
      this.triggerSwingAnimation(false);
      this.callbacks.onRemoveCable(target.x, target.y, target.z);
    } else if (target.kind === 'block' && target.blockKind) {
      this.triggerSwingAnimation(false);
      this.pulseMiningLaser(target.x, target.y, target.z);
      this.callbacks.onMineBlock(target.x, target.y, target.z, target.blockKind);
    }
  }

  public triggerAttackSwipe(): boolean {
    const target = this.raycastCenter();
    if (target?.kind === 'mob' && target.mobId) {
      this.triggerSwingAnimation(true);
      this.callbacks.onStrikeMob(target.mobId);
      return true;
    }
    const coneMob = this.findClosestMobInMeleeCone(3.9);
    if (coneMob) {
      this.triggerSwingAnimation(true);
      this.callbacks.onStrikeMob(coneMob.id);
      return true;
    }
    this.triggerSwingAnimation(true);
    return false;
  }

  public triggerPlaceCenter() {
    const target = this.raycastCenter();
    if (!target) return;
    this.handleSecondaryAction(target);
  }

  public triggerPrimaryInteract() {
    const target = this.raycastCenter();
    if (!target) return;
    if (target.kind === 'machine' && target.machineId) {
      if (this.isSneaking()) {
        this.triggerSwingAnimation(false);
        this.callbacks.onRemoveMachine(target.machineId);
      } else {
        this.callbacks.onClickMachine(target.machineId);
      }
    } else if (target.kind === 'block' && target.blockKind === 'chest') {
      this.callbacks.onOpenChest?.(target.x, target.y, target.z);
    } else if (target.kind === 'block' && target.blockKind && DOOR_KINDS.has(target.blockKind)) {
      this.callbacks.onToggleDoor(target.x, target.y, target.z);
    }
  }

  public triggerJump() {
    if (this.onGround) {
      this.playerVel.y = 7.4;
      this.onGround = false;
    }
  }

  public setTouchMove(x: number, y: number) {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  public setTouchCrouch(crouching: boolean) {
    this.touchCrouching = crouching;
  }

  public isTouchCrouching(): boolean {
    return this.touchCrouching;
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    this.playerRig.visible = mode === 'third';
    this.fpHandGroup.visible = mode === 'first';
  }

  public setPickaxeTier(tier: PickaxeTier) {
    if (this.pickaxeTier === tier) return;
    this.pickaxeTier = tier;
    this.camera.remove(this.fpHandGroup);
    disposeObject3D(this.fpHandGroup);
    this.fpHandGroup = buildFirstPersonToolRig(tier);
    this.fpHandGroup.position.set(0.42, -0.34, -0.56);
    this.fpHandGroup.rotation.set(0.08, -0.24, 0.05);
    this.fpHandGroup.visible = this.cameraMode === 'first';
    this.camera.add(this.fpHandGroup);
  }

  public setShowClaimBorders(show: boolean) {
    this.showClaimBorders = show;
    this.claimsGroup.visible = show;
  }

  public setHoldingClaimBeacon(holding: boolean) {
    if (this.holdingClaimBeacon === holding) return;
    this.holdingClaimBeacon = holding;
    if (!holding) {
      clearGroupAndDispose(this.claimPreviewGroup);
      this.lastPreviewOriginKey = '';
    } else {
      this.updateClaimPreview(this.currentHover);
    }
  }

  public setClaimPreviewSize(sizeX: number, sizeZ: number) {
    if (this.claimPreviewSizeX === sizeX && this.claimPreviewSizeZ === sizeZ) return;
    this.claimPreviewSizeX = sizeX;
    this.claimPreviewSizeZ = sizeZ;
    this.lastPreviewOriginKey = '';
    if (this.holdingClaimBeacon) {
      this.updateClaimPreview(this.currentHover);
    }
  }

  public setBonusHarvestPower(bonus: number) {
    this.bonusHarvestPower = bonus;
  }

  public setHungerExhausted(exhausted: boolean) {
    this.hungerExhausted = exhausted;
  }

  public triggerHurtCameraShake() {
    this.hurtCameraTimer = 0.28;
  }

  private updateClaimPreview(hit: HoverTarget | null) {
    if (!this.holdingClaimBeacon) {
      if (this.claimPreviewGroup.children.length > 0) {
        clearGroupAndDispose(this.claimPreviewGroup);
        this.lastPreviewOriginKey = '';
      }
      return;
    }
    const cx = hit?.placeX ?? Math.floor(this.playerPos.x);
    const cz = hit?.placeZ ?? Math.floor(this.playerPos.z);
    const { minX, minZ } = computeClaimOrigin12x12(
      cx,
      cz,
      this.claimPreviewSizeX,
      this.claimPreviewSizeZ
    );
    const valid =
      validateNewClaimOutsideSafeZones(
        this.claims,
        this.localUid,
        minX,
        minZ,
        this.seed,
        this.claimPreviewSizeX,
        this.claimPreviewSizeZ
      ) === null;
    const key = `${minX},${minZ},${this.claimPreviewSizeX},${this.claimPreviewSizeZ},${valid ? 1 : 0}`;
    if (key === this.lastPreviewOriginKey) return;
    this.lastPreviewOriginKey = key;
    clearGroupAndDispose(this.claimPreviewGroup);
    this.claimPreviewGroup.add(
      buildClaimPreview12x12(
        minX,
        minZ,
        valid,
        (x, z) => this.getSurfaceYCached(x, z),
        this.claimPreviewSizeX,
        this.claimPreviewSizeZ
      )
    );
  }

  public setLocalIdentity(uid: string, displayName: string) {
    if (this.localUid === uid && this.localDisplayName === displayName) return;
    this.localUid = uid;
    this.localDisplayName = displayName;
    if (this.activeChunkKeys.length > 0) {
      this.rebuildClaims();
    }
  }

  public getPlayerPosition(): { x: number; y: number; z: number; yaw: number } {
    return {
      x: this.playerPos.x,
      y: this.playerPos.y,
      z: this.playerPos.z,
      yaw: this.yaw,
    };
  }

  public teleportTo(x: number, y: number, z: number) {
    this.playerPos.set(x, y, z);
    this.playerVel.set(0, 0, 0);
    this.lastChunkEvalX = Number.NaN;
    this.lastShadowSnapX = Number.NaN;
    this.updateActiveChunks(true);
    this.updateShadowTarget();
  }

  public setPersonalSpawnMarker(spawn: PersonalSpawnPoint | null) {
    clearGroupAndDispose(this.personalSpawnGroup);
    if (!spawn) return;
    const marker = buildPersonalSpawnMarker(spawn.x, spawn.y, spawn.z);
    const ck = chunkKey(worldToChunk(spawn.x), worldToChunk(spawn.z));
    marker.userData.chunkKey = ck;
    marker.visible = this.activeChunkSet.size === 0 || this.activeChunkSet.has(ck);
    this.personalSpawnGroup.add(marker);
  }

  public updateAppearance(appearance: CharacterAppearance) {
    this.scene.remove(this.playerRig);
    disposeObject3D(this.playerRig);
    this.playerRig = buildVoxelCharacterRig(appearance);
    this.playerRightArm = this.playerRig.getObjectByName('rightArm') ?? null;
    this.playerRig.visible = this.cameraMode === 'third';
    this.scene.add(this.playerRig);
  }

  public updateDayNight(state: DayNightState) {
    this.isNight = state.isNight;
    this.weatherKind = state.weather.kind;
    this.targetBgColor.set(state.skyHex);
    this.targetFogColor.set(state.fogHex);
    this.targetSunColor.set(state.sunHex);
    this.targetSunIntensity = state.sunIntensity;
    this.targetHemiIntensity = state.ambientIntensity;
    this.weatherFogNearFactor = state.weather.fogNearFactor;
    this.weatherFogFarFactor = state.weather.fogFarFactor;
    this.targetRainIntensity = state.weather.rainIntensity;
    const angle = state.sunElevation * Math.PI * 0.48;
    this.sunOffset.set(Math.cos(angle) * 26, Math.max(12, Math.sin(angle) * 40), 18);
    this.lastShadowSnapX = Number.NaN;
    this.updateShadowTarget();
  }

  public loadWorld(params: {
    seed: number;
    mode: WorldMode;
    deltas: Record<string, WorldVoxelDelta>;
    machines: PlacedMachine[];
    cables: string[];
    claims: LandClaim12x12[];
    grid: PowerGridSnapshot;
    spawnX?: number;
    spawnY?: number;
    spawnZ?: number;
    resetPlayerPos?: boolean;
  }) {
    this.seed = params.seed;
    this.worldMode = params.mode;
    this.deltas = params.deltas;
    this.prevDeltasSnapshot = params.deltas;
    this.machines = params.machines;
    this.cables = params.cables;
    this.claims = params.claims;
    this.grid = params.grid;
    this.lastMachinesVisualSig = '';

    this.clearAllLoadedChunks();
    this.chunkDataCache.clear();
    this.activeChunkKeys = [];
    this.activeChunkSet.clear();
    this.lastChunkEvalX = Number.NaN;
    this.lastChunkEvalZ = Number.NaN;
    this.lastShadowSnapX = Number.NaN;

    this.rebuildDeltasByChunkIndex();
    this.towns = getWorldTowns(this.seed);

    if (params.resetPlayerPos) {
      const sx = params.spawnX ?? 0.5;
      const sz = params.spawnZ ?? 0.5;
      const sy = params.spawnY ?? this.getSurfaceYCached(Math.floor(sx), Math.floor(sz)) + 2;
      this.playerPos.set(sx, sy, sz);
      this.playerVel.set(0, 0, 0);
      this.lastSentPos.x = Number.NaN;
      this.clearMobs();
    }

    // Build ONLY the 12 closest 12x12 chunks around spawn immediately
    this.updateActiveChunks(true);
    this.rebuildMachinesAndCables(true);
    this.rebuildClaims();
    this.rebuildTowns();
    this.applyActiveChunkCulling();
    this.rebuildRayTargets();
    this.updateShadowTarget();
  }

  public syncWorldState(params: {
    mode: WorldMode;
    deltas: Record<string, WorldVoxelDelta>;
    machines: PlacedMachine[];
    cables: string[];
    claims: LandClaim12x12[];
    grid: PowerGridSnapshot;
    terrainDirty: boolean;
    machinesDirty: boolean;
    claimsDirty: boolean;
  }) {
    this.worldMode = params.mode;
    this.deltas = params.deltas;
    this.machines = params.machines;
    this.cables = params.cables;
    this.claims = params.claims;
    this.grid = params.grid;

    if (this.worldMode === 'peaceful' && this.mobs.length > 0) {
      this.clearMobs();
    }
    let rayTargetsChanged = false;
    if (params.terrainDirty) {
      this.applyIncrementalDeltaChanges();
    }
    if (params.machinesDirty) {
      if (this.rebuildMachinesAndCables(false)) {
        this.applyActiveChunkCulling();
        rayTargetsChanged = true;
      }
    }
    if (params.claimsDirty) {
      this.rebuildClaims();
      this.applyActiveChunkCulling();
    }
    if (rayTargetsChanged) {
      this.rebuildRayTargets();
    }
  }

  public syncRemotePlayers(players: RemotePlayer[], localUid: string) {
    const activeIds = new Set<string>();
    for (const p of players) {
      if (p.uid === localUid) continue;
      activeIds.add(p.clientId);
      const appKey = `${p.name}|${p.appearance.skinColor}|${p.appearance.shirtColor}|${p.appearance.pantsColor}|${p.appearance.hairColor}|${p.appearance.accentColor}`;
      const existing = this.remoteRigs.get(p.clientId);
      if (existing && existing.appearanceKey === appKey) {
        existing.targetPos.set(p.x, p.y, p.z);
        existing.targetYaw = p.yaw;
      } else {
        if (existing) {
          this.remotePlayersGroup.remove(existing.group);
          disposeObject3D(existing.group);
        }
        const rig = buildVoxelCharacterRig(p.appearance);
        const nameplate = buildPlayerNameplateSprite(p.name, p.appearance.shirtColor || '#22d3ee');
        rig.add(nameplate);
        rig.position.set(p.x, p.y, p.z);
        rig.rotation.y = p.yaw;
        this.remotePlayersGroup.add(rig);
        this.remoteRigs.set(p.clientId, {
          group: rig,
          targetPos: new THREE.Vector3(p.x, p.y, p.z),
          targetYaw: p.yaw,
          appearanceKey: appKey,
        });
      }
    }
    for (const [id, entry] of this.remoteRigs.entries()) {
      if (!activeIds.has(id)) {
        this.remotePlayersGroup.remove(entry.group);
        disposeObject3D(entry.group);
        this.remoteRigs.delete(id);
        const beam = this.remoteLaserLines.get(id);
        if (beam) {
          beam.line.geometry.dispose();
          (beam.line.material as THREE.Material).dispose();
          this.scene.remove(beam.line);
          this.remoteLaserLines.delete(id);
        }
      }
    }
  }

  public damageMob(mobId: string, damage: number): { killed: boolean; mobName: string } | null {
    const mob = this.mobs.find((m) => m.id === mobId);
    if (!mob || (mob.deathTimer ?? 0) > 0) return null;
    mob.hp = Math.max(0, mob.hp - damage);
    mob.hurtTimer = 0.34;

    // Minecraft-style directional knockback away from the player + upward hop
    const dx = mob.x - this.playerPos.x;
    const dz = mob.z - this.playerPos.z;
    const dist = Math.max(0.01, Math.hypot(dx, dz));
    const kbStrength = mob.kind === 'slag_golem' ? 5.2 : 7.8;
    mob.knockbackX = (dx / dist) * kbStrength;
    mob.knockbackZ = (dz / dist) * kbStrength;
    mob.velY = 4.2;
    mob.onGround = false;

    if (mob.hp <= 0) {
      // Trigger Minecraft sideways death tumble animation (0.42s) before removal
      mob.deathTimer = 0.001;
      return { killed: true, mobName: mob.name };
    }
    return { killed: false, mobName: mob.name };
  }

  private clearMobs() {
    this.mobs = [];
    for (const m of this.mobMeshes.values()) {
      this.mobsGroup.remove(m);
      disposeObject3D(m);
    }
    this.mobMeshes.clear();
  }

  private computeMachinesVisualSignature(): string {
    let sig = `m:${this.machines.length}|c:${this.cables.length}|`;
    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i];
      const powered = this.grid?.machinePowered[m.id] ? 1 : 0;
      const burning = (m.kind === 'coal_generator' || m.kind === 'firewood_boiler' || m.kind === 'powah_reactor') && (m.coalFuelSeconds > 0 || m.coalBuffer > 0) ? 1 : 0;
      const chargeBucket =
        (m.kind === 'battery_bank' || m.kind === 'flux_battery') && m.maxEnergy > 0
          ? Math.round((m.storedEnergy / m.maxEnergy) * 8)
          : 0;
      const augSig = m.augments ? m.augments.join(',') : '';
      let claimFlag = 1;
      if (m.kind === 'claim_beacon') {
        const matching = this.claims.find((c) => c.beaconX === m.x && c.beaconZ === m.z);
        if (matching) {
          claimFlag = isTrustedFriendOnClaim(matching, {
            uid: this.localUid,
            displayName: this.localDisplayName,
          })
            ? 1
            : 0;
        }
      }
      sig += `${m.id}:${m.kind}:${m.x},${m.y},${m.z}:${powered}:${burning}:${chargeBucket}:${claimFlag}:${augSig};`;
    }
    for (let i = 0; i < this.cables.length; i++) {
      const ck = this.cables[i];
      const cp = this.grid?.cablePowered[ck] ? 1 : 0;
      sig += `${ck}:${cp};`;
    }
    return sig;
  }

  /**
   * Rebuilds 3D machine & cable assemblies ONLY when their visual state actually changed.
   * Returns true if a rebuild occurred.
   */
  private rebuildMachinesAndCables(force: boolean): boolean {
    this.rebuildMachineCoordIndex();
    const sig = this.computeMachinesVisualSignature();
    if (!force && sig === this.lastMachinesVisualSig) {
      return false;
    }
    this.lastMachinesVisualSig = sig;

    clearGroupAndDispose(this.machinesGroup);
    clearGroupAndDispose(this.cablesGroup);
    this.animatedMachines.length = 0;

    const machineCoords = new Set<string>();
    const cableSet = new Set(this.cables);

    for (const m of this.machines) {
      machineCoords.add(voxelKey(m.x, m.y, m.z));
      const powered = Boolean(this.grid?.machinePowered[m.id]);
      let claimAccessible = true;
      if (m.kind === 'claim_beacon') {
        const matchingClaim = this.claims.find((c) => c.beaconX === m.x && c.beaconZ === m.z);
        if (matchingClaim) {
          claimAccessible = isTrustedFriendOnClaim(matchingClaim, {
            uid: this.localUid,
            displayName: this.localDisplayName,
          });
        }
      }
      const mesh = buildMachineMesh(m, powered, claimAccessible);
      const ck = chunkKey(worldToChunk(m.x), worldToChunk(m.z));
      mesh.userData.chunkKey = ck;
      mesh.visible = this.activeChunkSet.has(ck);
      this.machinesGroup.add(mesh);

      const spinner = mesh.getObjectByName('spinner') ?? null;
      const bobber = mesh.getObjectByName('bobber') ?? null;
      if (spinner || bobber) {
        this.animatedMachines.push({
          machineId: m.id,
          machineKind: m.kind,
          root: mesh,
          spinner,
          bobber,
        });
      }
    }

    const connects = (x: number, y: number, z: number) => {
      const k = voxelKey(x, y, z);
      return cableSet.has(k) || machineCoords.has(k);
    };

    for (const ck of this.cables) {
      const p = parseVoxelKey(ck);
      if (!p) continue;
      const powered = Boolean(this.grid?.cablePowered[ck]);
      const mesh = buildPowerCableMesh(
        p.x,
        p.y,
        p.z,
        {
          px: connects(p.x + 1, p.y, p.z),
          nx: connects(p.x - 1, p.y, p.z),
          py: connects(p.x, p.y + 1, p.z),
          ny: connects(p.x, p.y - 1, p.z),
          pz: connects(p.x, p.y, p.z + 1),
          nz: connects(p.x, p.y, p.z - 1),
        },
        powered
      );
      const chunkK = chunkKey(worldToChunk(p.x), worldToChunk(p.z));
      mesh.userData.chunkKey = chunkK;
      mesh.visible = this.activeChunkSet.has(chunkK);
      this.cablesGroup.add(mesh);
    }

    return true;
  }

  private rebuildClaims() {
    clearGroupAndDispose(this.claimsGroup);
    this.claimsGroup.visible = this.showClaimBorders;
    for (const claim of this.claims) {
      const accessible = isTrustedFriendOnClaim(claim, {
        uid: this.localUid,
        displayName: this.localDisplayName,
      });
      const border = buildClaimPerimeter12x12(claim, accessible, (x, z) =>
        this.getSurfaceYCached(x, z)
      );
      const { sizeX, sizeZ } = getClaimDimensions(claim);
      const cMinX = worldToChunk(claim.minX);
      const cMaxX = worldToChunk(claim.minX + sizeX - 1);
      const cMinZ = worldToChunk(claim.minZ);
      const cMaxZ = worldToChunk(claim.minZ + sizeZ - 1);
      const touched = new Set<string>();
      for (let cz = cMinZ; cz <= cMaxZ; cz++) {
        for (let cx = cMinX; cx <= cMaxX; cx++) {
          touched.add(chunkKey(cx, cz));
        }
      }
      const keys = Array.from(touched);
      border.userData.claimChunkKeys = keys;
      border.visible = keys.some((k) => this.activeChunkSet.has(k));
      this.claimsGroup.add(border);
    }
  }

  private rebuildTowns() {
    clearGroupAndDispose(this.townsGroup);
    for (const town of this.towns) {
      const visual = buildTownSafeZoneVisual(town, (x, z) => this.getSurfaceYCached(x, z));
      const cMinX = worldToChunk(town.centerX - town.radius);
      const cMaxX = worldToChunk(town.centerX + town.radius);
      const cMinZ = worldToChunk(town.centerZ - town.radius);
      const cMaxZ = worldToChunk(town.centerZ + town.radius);
      const touched = new Set<string>();
      for (let cz = cMinZ; cz <= cMaxZ; cz++) {
        for (let cx = cMinX; cx <= cMaxX; cx++) {
          touched.add(chunkKey(cx, cz));
        }
      }
      const keys = Array.from(touched);
      visual.userData.townChunkKeys = keys;
      visual.visible = keys.some((k) => this.activeChunkSet.has(k));
      this.townsGroup.add(visual);
    }
  }

  private raycastCenter(): HoverTarget | null {
    _ndc.set(0, 0);
    return this.performRaycast(_ndc);
  }

  private raycastFromClient(clientX: number, clientY: number): HoverTarget | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    _ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    return this.performRaycast(_ndc);
  }

  private updateHoverFromClient(clientX: number, clientY: number) {
    const now = performance.now();
    const interval = this.lowLagMode ? 120 : 70;
    if (now - this.lastRaycastTime < interval) return;
    this.lastRaycastTime = now;
    const hit = this.raycastFromClient(clientX, clientY);
    this.applyHoverVisual(hit);
  }

  private applyHoverVisual(hit: HoverTarget | null) {
    const changed =
      !this.currentHover !== !hit ||
      this.currentHover?.x !== hit?.x ||
      this.currentHover?.y !== hit?.y ||
      this.currentHover?.z !== hit?.z ||
      this.currentHover?.kind !== hit?.kind ||
      this.currentHover?.spawnerStatus !== hit?.spawnerStatus;

    this.currentHover = hit;
    if (hit && hit.kind !== 'mob') {
      this.highlightBox.visible = true;
      this.highlightBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlightBox.visible = false;
    }

    if (changed) {
      this.callbacks.onHoverChanged(hit);
    }
    if (this.holdingClaimBeacon) {
      this.updateClaimPreview(hit);
    }
  }

  private performRaycast(ndc: THREE.Vector2): HoverTarget | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    this.raycaster.far = this.cameraMode === 'first' ? 7.5 : 13.5;

    // 1. Check hostile mobs first in Survival
    if (this.mobsGroup.children.length > 0) {
      const mobHits = this.raycaster.intersectObjects(this.mobsGroup.children, true);
      if (mobHits.length > 0) {
        let obj: THREE.Object3D | null = mobHits[0].object;
        while (obj && !obj.userData.mobId) obj = obj.parent;
        if (obj?.userData.mobId) {
          return {
            kind: 'mob',
            mobId: obj.userData.mobId,
            x: Math.floor(obj.position.x),
            y: Math.floor(obj.position.y),
            z: Math.floor(obj.position.z),
          };
        }
      }
    }

    // 2. Check distance-culled rayTargets (only immediate chunks + visible machines/cables)
    const hits = this.raycaster.intersectObjects(this.rayTargets, true);
    if (hits.length === 0) return null;

    const first = hits[0];
    if (first.face?.normal) {
      _hitNormal.copy(first.face.normal).transformDirection(first.object.matrixWorld).round();
    } else {
      _hitNormal.set(0, 1, 0);
    }

    let cur: THREE.Object3D | null = first.object;
    while (cur) {
      if (cur.userData?.interactKind === 'machine') {
        const bx = cur.userData.blockX as number;
        const by = cur.userData.blockY as number;
        const bz = cur.userData.blockZ as number;
        return {
          kind: 'machine',
          machineId: cur.userData.machineId as string,
          x: bx,
          y: by,
          z: bz,
          placeX: bx + _hitNormal.x,
          placeY: by + _hitNormal.y,
          placeZ: bz + _hitNormal.z,
        };
      }
      if (cur.userData?.interactKind === 'cable') {
        const bx = cur.userData.blockX as number;
        const by = cur.userData.blockY as number;
        const bz = cur.userData.blockZ as number;
        return {
          kind: 'cable',
          x: bx,
          y: by,
          z: bz,
          placeX: bx + _hitNormal.x,
          placeY: by + _hitNormal.y,
          placeZ: bz + _hitNormal.z,
        };
      }
      if (cur.userData?.interactKind === 'door') {
        const bx = cur.userData.blockX as number;
        const by = cur.userData.blockY as number;
        const bz = cur.userData.blockZ as number;
        return {
          kind: 'block',
          blockKind: cur.userData.blockKind as TerrainBlockKind,
          x: bx,
          y: by,
          z: bz,
          placeX: bx + _hitNormal.x,
          placeY: by + _hitNormal.y,
          placeZ: bz + _hitNormal.z,
        };
      }
      if (cur.userData?.interactKind === 'spawner') {
        const bx = cur.userData.blockX as number;
        const by = cur.userData.blockY as number;
        const bz = cur.userData.blockZ as number;
        const spEntry = this.spawnerLookup.get(voxelKey(bx, by, bz));
        return {
          kind: 'block',
          blockKind: 'mob_spawner',
          x: bx,
          y: by,
          z: bz,
          placeX: bx + _hitNormal.x,
          placeY: by + _hitNormal.y,
          placeZ: bz + _hitNormal.z,
          spawnerStatus: spEntry?.status ?? (this.isNight ? 'out_of_range' : 'daylight'),
          spawnerMobKind:
            spEntry?.mobKind ??
            (cur.userData.spawnerMobKind as 'night_stalker' | 'slag_golem' | undefined) ??
            'night_stalker',
        };
      }
      cur = cur.parent;
    }

    // O(1) Instanced terrain hit lookup
    if (first.instanceId !== undefined) {
      const entry = this.instancedEntryLookup.get(first.object);
      if (entry) {
        const coord = entry.coords[first.instanceId];
        if (coord) {
          const [bx, by, bz] = coord;
          const actualKind = isWithinWorldBounds(bx, by, bz)
            ? BLOCK_KINDS[this.getVoxelIdAtWorld(bx, by, bz)]
            : entry.kind;
          return {
            kind: 'block',
            blockKind: actualKind,
            x: bx,
            y: by,
            z: bz,
            placeX: bx + _hitNormal.x,
            placeY: by + _hitNormal.y,
            placeZ: bz + _hitNormal.z,
          };
        }
      }
    }

    return null;
  }

  private isBlockedAt(x: number, y: number, z: number): boolean {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (bx < WORLD_MIN_XZ || bx > WORLD_MAX_XZ || bz < WORLD_MIN_XZ || bz > WORLD_MAX_XZ) {
      return true;
    }
    if (by < WORLD_MIN_Y) return true;
    if (by > WORLD_MAX_Y) return false;
    if (this.machineCoordSet.has(voxelKey(bx, by, bz))) return true;

    const cx = worldToChunk(bx);
    const cz = worldToChunk(bz);
    const data = this.getOrCreateChunkData(cx, cz);
    const idx = packLocalVoxel(bx - data.minX, by - WORLD_MIN_Y, bz - data.minZ);
    const id = data.liveVoxels[idx];
    if (id === ID_AIR || id === ID_TORCH || id === ID_LEVER) return false;
    if ((id === ID_WOOD_DOOR || id === ID_IRON_DOOR) && data.doorOpen.has(idx)) return false;
    return true;
  }

  private isFootprintBlockedAt(x: number, y: number, z: number, r: number): boolean {
    return (
      this.isBlockedAt(x, y, z) ||
      this.isBlockedAt(x + r, y, z + r) ||
      this.isBlockedAt(x + r, y, z - r) ||
      this.isBlockedAt(x - r, y, z + r) ||
      this.isBlockedAt(x - r, y, z - r)
    );
  }

  private getLockedClaimAt(x: number, z: number): LandClaim12x12 | null {
    if (!this.localUid && !this.localDisplayName) return null;
    const claim = findClaimAt(this.claims, x, z);
    if (!claim) return null;
    if (
      isTrustedFriendOnClaim(claim, {
        uid: this.localUid,
        displayName: this.localDisplayName,
      })
    ) {
      return null;
    }
    return claim;
  }

  private updatePhysics(dt: number) {
    const crouching = !this.inputPaused && this.isSneaking();
    // Minecraft hunger rule: when hunger drops to <= 3 drumsticks (<= 30%), sprinting/fast movement is disabled
    const moveSpeed = crouching ? 3.2 : this.hungerExhausted && this.worldMode === 'survival' ? 4.1 : 6.1;

    let forwardInput = 0;
    let strafeInput = 0;
    if (!this.inputPaused) {
      if (this.keys.has('KeyW')) forwardInput += 1;
      if (this.keys.has('KeyS')) forwardInput -= 1;
      if (this.keys.has('KeyD')) strafeInput += 1;
      if (this.keys.has('KeyA')) strafeInput -= 1;
      forwardInput += -this.touchMove.y;
      strafeInput += this.touchMove.x;

      // Crisp, fast Arrow-key camera look (left/right/up/down)
      const keyLookYawSpeed = 2.7;
      const keyLookPitchSpeed = 2.2;
      if (this.keys.has('ArrowLeft')) this.yaw += keyLookYawSpeed * dt;
      if (this.keys.has('ArrowRight')) this.yaw -= keyLookYawSpeed * dt;
      if (this.keys.has('ArrowUp')) {
        this.pitch = Math.min(1.45, this.pitch + keyLookPitchSpeed * dt);
      }
      if (this.keys.has('ArrowDown')) {
        this.pitch = Math.max(-1.48, this.pitch - keyLookPitchSpeed * dt);
      }
    }

    const inputLen = Math.hypot(forwardInput, strafeInput);
    if (inputLen > 1) {
      forwardInput /= inputLen;
      strafeInput /= inputLen;
    }

    _vForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _vRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveX = (_vForward.x * forwardInput + _vRight.x * strafeInput) * moveSpeed * dt;
    const moveZ = (_vForward.z * forwardInput + _vRight.z * strafeInput) * moveSpeed * dt;

    // Slim 0.42-block width (r = 0.21) so the character easily fits inside any 1x1 block hole
    // without catching on walls or triggering phantom auto-step jumps.
    const r = 0.21;
    const currentlyUnderOneBlockCeiling = this.isFootprintBlockedAt(
      this.playerPos.x,
      this.playerPos.y + 1.05,
      this.playerPos.z,
      r
    );

    const nextX = this.playerPos.x + moveX;
    const lockedClaimX = this.getLockedClaimAt(nextX, this.playerPos.z);
    if (lockedClaimX) {
      const nowMs = performance.now();
      if (nowMs - this.lastLockedBumpMs > 2200) {
        this.lastLockedBumpMs = nowMs;
        this.callbacks.onLockedClaimBump?.(lockedClaimX);
      }
    }
    const blockedX =
      Boolean(lockedClaimX) ||
      this.isFootprintBlockedAt(nextX, this.playerPos.y + 0.12, this.playerPos.z, r) ||
      this.isFootprintBlockedAt(nextX, this.playerPos.y + 0.78, this.playerPos.z, r) ||
      (!crouching &&
        !currentlyUnderOneBlockCeiling &&
        this.isFootprintBlockedAt(nextX, this.playerPos.y + 1.45, this.playerPos.z, r));
    if (!blockedX) {
      this.playerPos.x = nextX;
    }

    const nextZ = this.playerPos.z + moveZ;
    const lockedClaimZ = this.getLockedClaimAt(this.playerPos.x, nextZ);
    if (lockedClaimZ) {
      const nowMs = performance.now();
      if (nowMs - this.lastLockedBumpMs > 2200) {
        this.lastLockedBumpMs = nowMs;
        this.callbacks.onLockedClaimBump?.(lockedClaimZ);
      }
    }
    const blockedZ =
      Boolean(lockedClaimZ) ||
      this.isFootprintBlockedAt(this.playerPos.x, this.playerPos.y + 0.12, nextZ, r) ||
      this.isFootprintBlockedAt(this.playerPos.x, this.playerPos.y + 0.78, nextZ, r) ||
      (!crouching &&
        !currentlyUnderOneBlockCeiling &&
        this.isFootprintBlockedAt(this.playerPos.x, this.playerPos.y + 1.45, nextZ, r));
    if (!blockedZ) {
      this.playerPos.z = nextZ;
    }

    // 1x1 Vertical Hole Drop-In Assist: ONLY when the cell directly below the player's feet is an enclosed hole
    // (open center surrounded by at least 2 adjacent solid rim blocks) and the player is not jumping upward,
    // gently guide their footprint away from the rim so they drop cleanly into the 1-block shaft.
    if (this.playerVel.y <= 0.1) {
      const cellX = Math.floor(this.playerPos.x);
      const cellZ = Math.floor(this.playerPos.z);
      const belowY = Math.floor(this.playerPos.y - 0.08);
      const holeCenterOpen =
        !this.isBlockedAt(cellX + 0.5, belowY + 0.5, cellZ + 0.5) &&
        !this.isBlockedAt(cellX + 0.5, this.playerPos.y + 0.25, cellZ + 0.5);
      if (
        holeCenterOpen &&
        this.isFootprintBlockedAt(this.playerPos.x, belowY + 0.5, this.playerPos.z, r)
      ) {
        let rimCount = 0;
        if (this.isBlockedAt(cellX + 1.5, belowY + 0.5, cellZ + 0.5)) rimCount++;
        if (this.isBlockedAt(cellX - 0.5, belowY + 0.5, cellZ + 0.5)) rimCount++;
        if (this.isBlockedAt(cellX + 0.5, belowY + 0.5, cellZ + 1.5)) rimCount++;
        if (this.isBlockedAt(cellX + 0.5, belowY + 0.5, cellZ - 0.5)) rimCount++;
        if (rimCount >= 2) {
          const targetCenterX = cellX + 0.5;
          const targetCenterZ = cellZ + 0.5;
          const pull = Math.min(1, dt * 12);
          this.playerPos.x += (targetCenterX - this.playerPos.x) * pull;
          this.playerPos.z += (targetCenterZ - this.playerPos.z) * pull;
        }
      }
    }

    // If player is somehow already inside a locked claim (e.g. owner just placed claim or removed them from Trusted list), smoothly eject them outside the nearest border
    const insideLocked = this.getLockedClaimAt(this.playerPos.x, this.playerPos.z);
    if (insideLocked) {
      const { sizeX, sizeZ } = getClaimDimensions(insideLocked);
      const dLeft = Math.abs(this.playerPos.x - insideLocked.minX);
      const dRight = Math.abs(insideLocked.minX + sizeX - this.playerPos.x);
      const dNorth = Math.abs(this.playerPos.z - insideLocked.minZ);
      const dSouth = Math.abs(insideLocked.minZ + sizeZ - this.playerPos.z);
      const minD = Math.min(dLeft, dRight, dNorth, dSouth);
      if (minD === dLeft) this.playerPos.x = insideLocked.minX - 0.55;
      else if (minD === dRight) this.playerPos.x = insideLocked.minX + sizeX + 0.55;
      else if (minD === dNorth) this.playerPos.z = insideLocked.minZ - 0.55;
      else this.playerPos.z = insideLocked.minZ + sizeZ + 0.55;
      const nowMs = performance.now();
      if (nowMs - this.lastLockedBumpMs > 2200) {
        this.lastLockedBumpMs = nowMs;
        this.callbacks.onLockedClaimBump?.(insideLocked);
      }
    }

    // Detect if the player is inside a 1-block-tall opening (ceiling block right above the 1-block gap)
    const inOneBlockHole = this.isFootprintBlockedAt(
      this.playerPos.x,
      this.playerPos.y + 1.05,
      this.playerPos.z,
      r
    );

    if (!this.inputPaused && this.keys.has('Space') && this.onGround) {
      this.playerVel.y = 7.4;
      this.onGround = false;
    }
    this.playerVel.y = Math.max(-22, this.playerVel.y - 20 * dt);
    const nextY = this.playerPos.y + this.playerVel.y * dt;

    if (this.playerVel.y <= 0) {
      if (this.isFootprintBlockedAt(this.playerPos.x, nextY, this.playerPos.z, r)) {
        this.playerPos.y = Math.floor(nextY) + 1;
        this.playerVel.y = 0;
        this.onGround = true;
      } else {
        this.playerPos.y = nextY;
        this.onGround = false;
      }
    } else {
      const headHeight = inOneBlockHole ? 0.85 : crouching ? 1.38 : 1.72;
      if (this.isFootprintBlockedAt(this.playerPos.x, nextY + headHeight, this.playerPos.z, r)) {
        this.playerVel.y = 0;
      } else {
        this.playerPos.y = nextY;
      }
    }

    if (this.playerPos.y < WORLD_MIN_Y + 1) {
      const safeY = this.getSurfaceYCached(Math.floor(this.playerPos.x), Math.floor(this.playerPos.z)) + 2;
      this.playerPos.y = safeY;
      this.playerVel.y = 0;
    }

    // Stream 12x12 chunks lazily & keep shadow frustum centered on player
    this.updateActiveChunks(false);
    this.updateShadowTarget();

    this.playerRig.position.copy(this.playerPos);
    this.playerRig.rotation.y = this.yaw + Math.PI;
    const targetScaleY = inOneBlockHole ? 0.54 : crouching ? 0.84 : 1;
    this.playerRig.scale.set(
      1,
      THREE.MathUtils.lerp(this.playerRig.scale.y, targetScaleY, Math.min(1, dt * 16)),
      1
    );

    // Advance walking bob phase when moving
    if (inputLen > 0.05 && this.onGround) {
      this.walkCyclePhase += dt * (crouching || inOneBlockHole ? 6.5 : 10.5);
    } else {
      this.walkCyclePhase += dt * 1.6;
    }

    if (this.swingAnim > 0) {
      this.swingAnim = Math.max(0, this.swingAnim - dt * 4.8);
    }
    const swingWave = Math.sin(this.swingAnim * Math.PI);
    if (this.playerRightArm) {
      this.playerRightArm.rotation.x = -swingWave * 1.45;
      this.playerRightArm.rotation.z = -swingWave * 0.28;
    }

    // First-person held tool viewmodel animation (idle breathing + walk bob + Minecraft chop/sweep arc)
    if (this.fpHandGroup.visible) {
      const bobX = Math.cos(this.walkCyclePhase) * (inputLen > 0.05 ? 0.024 : 0.004);
      const bobY = Math.abs(Math.sin(this.walkCyclePhase)) * (inputLen > 0.05 ? 0.028 : 0.006);
      const sneakDrop = crouching || inOneBlockHole ? -0.04 : 0;

      this.fpHandGroup.position.set(
        0.42 + bobX - swingWave * 0.16,
        -0.34 - bobY + sneakDrop - swingWave * 0.08,
        -0.56 - swingWave * 0.18
      );
      this.fpHandGroup.rotation.set(
        0.08 - swingWave * 1.25,
        -0.24 + swingWave * 0.55,
        0.05 + swingWave * 0.42
      );
    }

    // 3D melee slash arc fade-out
    if (this.slashArcTimer > 0) {
      this.slashArcTimer = Math.max(0, this.slashArcTimer - dt);
      const slashRatio = this.slashArcTimer / 0.24;
      const mat = this.slashArcMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.sin(slashRatio * Math.PI) * 0.85;
      const sc = 0.75 + (1 - slashRatio) * 0.65;
      this.slashArcMesh.scale.set(sc, sc, 1);
      if (this.slashArcTimer === 0) {
        this.slashArcMesh.visible = false;
      }
    }

    if (this.hurtCameraTimer > 0) {
      this.hurtCameraTimer = Math.max(0, this.hurtCameraTimer - dt);
    }
    const hurtRoll = this.hurtCameraTimer > 0 ? Math.sin((this.hurtCameraTimer / 0.28) * Math.PI) * 0.065 : 0;

    const targetEyeHeight = inOneBlockHole ? 0.76 : crouching ? 1.32 : 1.62;
    this.currentEyeHeight = THREE.MathUtils.lerp(
      this.currentEyeHeight,
      targetEyeHeight,
      Math.min(1, dt * 16)
    );
    const eyeY = this.playerPos.y + this.currentEyeHeight;
    if (this.cameraMode === 'first') {
      this.camera.position.set(this.playerPos.x, eyeY, this.playerPos.z);
      // Direct YXZ Euler rotation: zero look latency & clean up/down range + subtle hurt roll when hit
      this.camera.rotation.set(this.pitch, this.yaw, hurtRoll);
    } else {
      const dist = 5.4;
      _vCamPos.set(
        this.playerPos.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist,
        eyeY + 1.2 - Math.sin(this.pitch) * 3.0,
        this.playerPos.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist
      );
      // Instant orbital camera follow (no sluggish trailing behind mouse turns)
      this.camera.position.copy(_vCamPos);
      _vCamTarget.set(this.playerPos.x, eyeY + 0.1, this.playerPos.z);
      this.camera.lookAt(_vCamTarget);
    }

    // Only emit movement callback when player actually moved/rotated (eliminates idle React re-renders)
    const now = performance.now();
    if (now - this.lastMoveBroadcast > 110) {
      const rx = Math.round(this.playerPos.x * 100) / 100;
      const ry = Math.round(this.playerPos.y * 100) / 100;
      const rz = Math.round(this.playerPos.z * 100) / 100;
      const ryaw = Math.round(this.yaw * 100) / 100;
      const moved =
        Number.isNaN(this.lastSentPos.x) ||
        Math.abs(rx - this.lastSentPos.x) > 0.03 ||
        Math.abs(ry - this.lastSentPos.y) > 0.03 ||
        Math.abs(rz - this.lastSentPos.z) > 0.03 ||
        Math.abs(ryaw - this.lastSentPos.yaw) > 0.03 ||
        crouching !== this.lastSentPos.crouching;

      if (moved) {
        this.lastMoveBroadcast = now;
        this.lastSentPos.x = rx;
        this.lastSentPos.y = ry;
        this.lastSentPos.z = rz;
        this.lastSentPos.yaw = ryaw;
        this.lastSentPos.crouching = crouching;
        this.callbacks.onPlayerMove(rx, ry, rz, ryaw, crouching);
      }
    }
  }

  private hasSolidRoofAbove(wx: number, wy: number, wz: number): boolean {
    const maxCheck = Math.min(WORLD_MAX_Y, wy + 12);
    for (let y = wy + 2; y <= maxCheck; y++) {
      const id = this.getVoxelIdAtWorld(wx, y, wz);
      if (!isTransparentId(id)) return true;
    }
    return false;
  }

  private findDarkCaveFloor(wx: number, wz: number, nearY: number): number | null {
    const minY = Math.max(WORLD_MIN_Y + 1, Math.floor(nearY) - 5);
    const maxY = Math.min(WORLD_MAX_Y - 2, Math.floor(nearY) + 4);
    for (let y = minY; y <= maxY; y++) {
      const floorId = this.getVoxelIdAtWorld(wx, y - 1, wz);
      const feetId = this.getVoxelIdAtWorld(wx, y, wz);
      const headId = this.getVoxelIdAtWorld(wx, y + 1, wz);
      if (
        !isTransparentId(floorId) &&
        feetId === ID_AIR &&
        headId === ID_AIR &&
        this.hasSolidRoofAbove(wx, y, wz)
      ) {
        return y;
      }
    }
    return null;
  }

  private removeMobById(mobId: string) {
    this.mobs = this.mobs.filter((m) => m.id !== mobId);
    const mesh = this.mobMeshes.get(mobId);
    if (mesh) {
      this.mobsGroup.remove(mesh);
      disposeObject3D(mesh);
      this.mobMeshes.delete(mobId);
    }
  }

  private updateSurvivalMobs(dt: number) {
    if (this.worldMode !== 'survival') {
      if (this.mobs.length > 0) this.clearMobs();
      return;
    }

    const now = performance.now();

    // 1. Evaluate safe zones & daytime sunlight burning for existing mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      if ((mob.deathTimer ?? 0) > 0) continue;

      const mx = Math.floor(mob.x);
      const my = Math.floor(mob.y);
      const mz = Math.floor(mob.z);
      const surf = this.getSurfaceYCached(mx, mz);
      const inTown = Boolean(findTownAt(this.towns, mob.x, mob.z));
      const inClaim = Boolean(findClaimAt(this.claims, mob.x, mob.z));
      const inTorchZone = isProtectedByTorch(this.torchPositions, mob.x, mob.z);

      // Mobs that wander into a claimed 12x12 base, town, or torch sanctuary evaporate immediately
      if (inTown || inClaim || inTorchZone) {
        this.removeMobById(mob.id);
        continue;
      }

      // Minecraft-authentic Sunlight Burning: during clear/foggy daytime (!this.isNight && not raining), exposed mobs catch fire!
      const sunlit =
        !this.isNight &&
        this.weatherKind !== 'light_rain' &&
        my >= surf &&
        !this.hasSolidRoofAbove(mx, my, mz);
      if (sunlit) {
        mob.sunBurnCooldown = (mob.sunBurnCooldown ?? 0) - dt;
        if ((mob.sunBurnCooldown ?? 0) <= 0) {
          mob.sunBurnCooldown = 0.55;
          mob.hp = Math.max(0, mob.hp - 12);
          mob.hurtTimer = 0.26;
          if (mob.hp <= 0) {
            mob.deathTimer = 0.001;
          }
        }
      }
    }

    // 2. Hostile Mobs ONLY spawn at NIGHT in Survival Mode outside claims and torch sanctuaries
    if (this.isNight && now - this.lastMobSpawnCheck > 3800 && this.mobs.length < 5) {
      this.lastMobSpawnCheck = now;

      for (let attempt = 0; attempt < 12; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 9 + Math.random() * 11;
        const sx = Math.max(
          WORLD_MIN_XZ + 2,
          Math.min(WORLD_MAX_XZ - 2, Math.round(this.playerPos.x + Math.cos(angle) * dist))
        );
        const sz = Math.max(
          WORLD_MIN_XZ + 2,
          Math.min(WORLD_MAX_XZ - 2, Math.round(this.playerPos.z + Math.sin(angle) * dist))
        );

        // Never spawn outside currently loaded 12 chunks
        if (!this.activeChunkSet.has(chunkKey(worldToChunk(sx), worldToChunk(sz)))) {
          continue;
        }

        const surf = this.getSurfaceYCached(sx, sz);
        const sy = surf + 1;
        const hasRoof = this.hasSolidRoofAbove(sx, sy, sz);

        const safety = evaluateSpawnSafety({
          x: sx + 0.5,
          y: sy,
          z: sz + 0.5,
          surfaceY: surf,
          hasSolidRoof: hasRoof,
          isNight: this.isNight,
          towns: this.towns,
          claims: this.claims,
          torches: this.torchPositions,
        });
        if (!safety.canSpawn) continue;

        const kind = Math.random() > 0.68 ? 'slag_golem' : 'night_stalker';
        this.spawnHostileMob(kind, sx + 0.5, sy, sz + 0.5);
        break;
      }
    }

    const playerSafe =
      Boolean(findTownAt(this.towns, this.playerPos.x, this.playerPos.z)) ||
      Boolean(findClaimAt(this.claims, this.playerPos.x, this.playerPos.z)) ||
      isProtectedByTorch(this.torchPositions, this.playerPos.x, this.playerPos.z);

    // 3. Update each mob's Minecraft AI, gravity, step-jumping, knockback, attack swing & death tumble
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      const mesh = this.mobMeshes.get(mob.id);

      // Handle Minecraft-style sideways death tumble animation
      if ((mob.deathTimer ?? 0) > 0) {
        mob.deathTimer = (mob.deathTimer ?? 0) + dt;
        const progress = Math.min(1, (mob.deathTimer ?? 0) / 0.42);
        if (mesh) {
          mesh.rotation.z = progress * (Math.PI * 0.48);
          const sc = 1 - progress * 0.25;
          mesh.scale.set(sc, sc, sc);
          updateHostileMobRigVisuals(mesh, {
            hp: 0,
            maxHp: mob.maxHp,
            hurtActive: true,
            sunBurning: !this.isNight,
            cameraPos: this.camera.position,
          });
        }
        if ((mob.deathTimer ?? 0) >= 0.42) {
          this.removeMobById(mob.id);
        }
        continue;
      }

      if ((mob.hurtTimer ?? 0) > 0) {
        mob.hurtTimer = Math.max(0, (mob.hurtTimer ?? 0) - dt);
      }
      if ((mob.attackAnim ?? 0) > 0) {
        mob.attackAnim = Math.max(0, (mob.attackAnim ?? 0) - dt * 2.4);
      }
      if ((mob.attackCooldown ?? 0) > 0) {
        mob.attackCooldown = Math.max(0, (mob.attackCooldown ?? 0) - dt);
      }

      const dx = this.playerPos.x - mob.x;
      const dz = this.playerPos.z - mob.z;
      const dist = Math.hypot(dx, dz);

      let moveDirX = 0;
      let moveDirZ = 0;
      let moveSpd = 0;
      const aggroRange = 17.5;

      if (!playerSafe && dist <= aggroRange) {
        // Aggro chase state: lock onto player
        const targetYaw = Math.atan2(dx, dz);
        mob.yaw = targetYaw;
        if (dist > 1.38) {
          moveDirX = dx / Math.max(0.01, dist);
          moveDirZ = dz / Math.max(0.01, dist);
          moveSpd = mob.kind === 'slag_golem' ? 2.25 : 3.25;
        } else if (Math.abs(this.playerPos.y - mob.y) < 1.95 && (mob.attackCooldown ?? 0) <= 0) {
          // Strike player with animated melee windup + downward slam!
          mob.attackCooldown = mob.kind === 'slag_golem' ? 1.35 : 1.05;
          mob.attackAnim = 1.0;
          this.hurtCameraTimer = 0.28;
          this.callbacks.onPlayerDamaged(mob.attackDamage, mob.name);
        }
      } else {
        // Idle wandering state (like Minecraft mobs outside aggro range)
        mob.wanderTimer = (mob.wanderTimer ?? 0) - dt;
        if ((mob.wanderTimer ?? 0) <= 0) {
          mob.wanderTimer = 2.0 + Math.random() * 3.0;
          // 65% chance to stroll in a new direction, 35% chance to pause and look around
          mob.wanderAngle = Math.random() < 0.65 ? Math.random() * Math.PI * 2 : Number.NaN;
        }
        if (!Number.isNaN(mob.wanderAngle ?? Number.NaN)) {
          const wa = mob.wanderAngle ?? 0;
          mob.yaw = wa;
          moveDirX = Math.sin(wa);
          moveDirZ = Math.cos(wa);
          moveSpd = mob.kind === 'slag_golem' ? 0.95 : 1.35;
        }
      }

      // Apply horizontal movement + decaying knockback velocity
      const kbX = mob.knockbackX ?? 0;
      const kbZ = mob.knockbackZ ?? 0;
      mob.knockbackX = kbX * Math.exp(-10 * dt);
      mob.knockbackZ = kbZ * Math.exp(-10 * dt);

      const stepX = (moveDirX * moveSpd + kbX) * dt;
      const stepZ = (moveDirZ * moveSpd + kbZ) * dt;
      const nx = mob.x + stepX;
      const nz = mob.z + stepZ;

      const entersSafe =
        Boolean(findTownAt(this.towns, nx, nz)) ||
        Boolean(findClaimAt(this.claims, nx, nz)) ||
        isProtectedByTorch(this.torchPositions, nx, nz);

      if (!entersSafe) {
        const blockedLow = this.isBlockedAt(nx, mob.y + 0.35, nz);
        const blockedHigh = this.isBlockedAt(nx, mob.y + 1.35, nz);
        if (!blockedLow && !blockedHigh) {
          mob.x = nx;
          mob.z = nz;
        } else if (
          blockedLow &&
          !blockedHigh &&
          !this.isBlockedAt(nx, mob.y + 2.35, nz) &&
          (mob.onGround ?? true)
        ) {
          // Minecraft 1-block terrain step jump!
          mob.velY = 6.6;
          mob.onGround = false;
          mob.x = mob.x + stepX * 0.45;
          mob.z = mob.z + stepZ * 0.45;
        } else if (!Number.isNaN(mob.wanderAngle ?? Number.NaN)) {
          // Turn around if wandering into a wall
          mob.wanderAngle = (mob.wanderAngle ?? 0) + Math.PI * 0.75;
        }
      }

      // Vertical gravity & ground collision
      mob.velY = Math.max(-20, (mob.velY ?? 0) - 19 * dt);
      const nextY = mob.y + mob.velY * dt;
      if (mob.velY <= 0) {
        if (this.isBlockedAt(mob.x, nextY, mob.z)) {
          mob.y = Math.floor(nextY) + 1;
          mob.velY = 0;
          mob.onGround = true;
        } else {
          mob.y = nextY;
          mob.onGround = false;
        }
      } else {
        if (this.isBlockedAt(mob.x, nextY + 1.8, mob.z)) {
          mob.velY = 0;
        } else {
          mob.y = nextY;
        }
      }

      // Keep above world floor
      const surfHere = this.getSurfaceYCached(Math.floor(mob.x), Math.floor(mob.z));
      if (mob.y < WORLD_MIN_Y + 1) {
        mob.y = surfHere + 1;
        mob.velY = 0;
        mob.onGround = true;
      }

      // Animate articulated limbs (walk cycle + melee attack swing + hurt flash + HP bar)
      if (mesh) {
        mesh.position.set(mob.x, mob.y, mob.z);
        mesh.rotation.y = mob.yaw;

        const parts = mesh.userData.mobParts as HostileMobRigParts | undefined;
        if (parts) {
          const isMoving = moveSpd > 0.1;
          if (isMoving) {
            mob.walkPhase = (mob.walkPhase ?? 0) + dt * (moveSpd * 3.1);
          }
          const walkSin = isMoving ? Math.sin(mob.walkPhase ?? 0) : 0;
          const legAmp = mob.kind === 'slag_golem' ? 0.55 : 0.78;
          parts.leftLegGroup.rotation.x = walkSin * legAmp;
          parts.rightLegGroup.rotation.x = -walkSin * legAmp;

          // Zombie/Golem raised arms + dramatic overhead slam when attacking
          const baseArmPitch = -Math.PI * 0.42;
          const atk = mob.attackAnim ?? 0;
          // Wind up slightly above head then slam down toward player
          const attackSwingOffset =
            atk > 0.65
              ? -((1 - atk) / 0.35) * 0.95
              : atk > 0
              ? Math.sin((atk / 0.65) * Math.PI) * 1.15
              : 0;

          parts.leftArmGroup.rotation.x = baseArmPitch - walkSin * 0.18 + attackSwingOffset;
          parts.rightArmGroup.rotation.x = baseArmPitch + walkSin * 0.18 + attackSwingOffset;

          // Subtle head look pitch toward player when chasing
          if (!playerSafe && dist <= aggroRange) {
            const dy = this.playerPos.y - mob.y;
            parts.headGroup.rotation.x = Math.max(-0.45, Math.min(0.45, -Math.atan2(dy, Math.max(1, dist))));
          } else {
            parts.headGroup.rotation.x = 0;
          }
        }

        const mx = Math.floor(mob.x);
        const my = Math.floor(mob.y);
        const mz = Math.floor(mob.z);
        const sunlit =
          !this.isNight &&
          this.weatherKind !== 'light_rain' &&
          my >= surfHere &&
          !this.hasSolidRoofAbove(mx, my, mz);
        updateHostileMobRigVisuals(mesh, {
          hp: mob.hp,
          maxHp: mob.maxHp,
          hurtActive: (mob.hurtTimer ?? 0) > 0,
          sunBurning: sunlit,
          cameraPos: this.camera.position,
        });
      }
    }
  }

  private animateWorld(dt: number, elapsed: number) {
    // Skip cosmetic machine animations in Low-Lag mode or when culled outside active 12 chunks
    if (!this.lowLagMode) {
      for (let i = 0; i < this.animatedMachines.length; i++) {
        const node = this.animatedMachines[i];
        if (!node.root.visible) continue;
        const powered = Boolean(this.grid?.machinePowered[node.machineId]);
        if (node.spinner && (powered || node.machineKind === 'claim_beacon')) {
          const isFastDrill =
            node.machineKind === 'auto_miner' || node.machineKind === 'digital_miner';
          node.spinner.rotation.y += dt * (isFastDrill ? 7.5 : 2.2);
        }
        if (node.bobber && powered) {
          node.bobber.position.y = 0.78 + Math.sin(elapsed * 5) * 0.06;
        }
      }
    }

    // Smooth remote players interpolation
    const alpha = 1 - Math.exp(-10 * dt);
    for (const entry of this.remoteRigs.values()) {
      entry.group.position.lerp(entry.targetPos, alpha);
      entry.group.rotation.y = THREE.MathUtils.lerp(entry.group.rotation.y, entry.targetYaw + Math.PI, alpha);
    }

    if (this.laserBeamTimer > 0) {
      this.laserBeamTimer = Math.max(0, this.laserBeamTimer - dt);
      if (this.laserBeamTimer === 0) {
        this.laserBeamLine.visible = false;
      }
    }
    for (const beam of this.remoteLaserLines.values()) {
      if (beam.timer > 0) {
        beam.timer = Math.max(0, beam.timer - dt);
        if (beam.timer === 0) {
          beam.line.visible = false;
        }
      }
    }

    // Smoothly damp sky, fog density, lighting & 3D light rain particles
    this.updateWeatherAtmosphere(dt);

    // Keep center hover indicator fresh in first-person when not paused by a modal
    if (this.cameraMode === 'first' && !this.isDraggingLook && !this.inputPaused) {
      const now = performance.now();
      const rayInterval = this.lowLagMode ? 155 : 95;
      if (now - this.lastRaycastTime > rayInterval) {
        this.lastRaycastTime = now;
        this.applyHoverVisual(this.raycastCenter());
      }
    }
  }

  private updateWeatherAtmosphere(dt: number) {
    const colorAlpha = 1 - Math.exp(-2.2 * dt);
    this.bgColor.lerp(this.targetBgColor, colorAlpha);
    this.fogObj.color.lerp(this.targetFogColor, colorAlpha);
    this.sunLight.color.lerp(this.targetSunColor, colorAlpha);
    this.sunLight.intensity = THREE.MathUtils.damp(
      this.sunLight.intensity,
      this.targetSunIntensity,
      2.4,
      dt
    );
    this.hemiLight.intensity = THREE.MathUtils.damp(
      this.hemiLight.intensity,
      this.targetHemiIntensity,
      2.4,
      dt
    );

    const low = this.lowLagMode || this.isSoftwareGl;
    const baseNear = low ? 13 : 17;
    const baseFar = low ? 26 : 33;
    const desiredNear = Math.max(3.5, baseNear * this.weatherFogNearFactor);
    const desiredFar = Math.max(desiredNear + 8, baseFar * this.weatherFogFarFactor);
    this.fogObj.near = THREE.MathUtils.damp(this.fogObj.near, desiredNear, 2.2, dt);
    this.fogObj.far = THREE.MathUtils.damp(this.fogObj.far, desiredFar, 2.2, dt);

    const targetOpacity = this.targetRainIntensity * 0.44;
    this.currentRainOpacity = THREE.MathUtils.damp(this.currentRainOpacity, targetOpacity, 2.8, dt);
    const rainMat = this.rainLines.material as THREE.LineBasicMaterial;
    rainMat.opacity = this.currentRainOpacity;
    const showRain = this.currentRainOpacity > 0.015;
    this.rainLines.visible = showRain;

    if (showRain) {
      const activeDrops = low ? 110 : this.rainMaxDrops;
      const px = this.playerPos.x;
      const py = this.playerPos.y;
      const pz = this.playerPos.z;
      const minY = py - 2.5;
      const maxY = py + 15.5;
      const halfSpan = 13;
      const span = halfSpan * 2;
      const pos = this.rainPositions;

      for (let i = 0; i < activeDrops; i++) {
        const idx = i * 6;
        let x = pos[idx];
        let y = pos[idx + 1] - this.rainSpeeds[i] * dt;
        let z = pos[idx + 2];

        // Wrap horizontally into a 26x26 box around the moving player
        let dx = x - px;
        let dz = z - pz;
        if (dx > halfSpan) x -= span * Math.ceil((dx - halfSpan) / span);
        else if (dx < -halfSpan) x += span * Math.ceil((-halfSpan - dx) / span);
        if (dz > halfSpan) z -= span * Math.ceil((dz - halfSpan) / span);
        else if (dz < -halfSpan) z += span * Math.ceil((-halfSpan - dz) / span);

        if (y < minY || y > maxY + 3) {
          y = maxY - Math.random() * 2.5;
          x = px + (Math.random() - 0.5) * span;
          z = pz + (Math.random() - 0.5) * span;
        }

        // Keep raindrops slightly clear of immediate camera face (< 1.1m) for clean visibility
        dx = x - px;
        dz = z - pz;
        if (dx * dx + dz * dz < 1.25) {
          x += dx >= 0 ? 1.4 : -1.4;
        }

        pos[idx] = x;
        pos[idx + 1] = y;
        pos[idx + 2] = z;
        pos[idx + 3] = x + 0.08;
        pos[idx + 4] = y - 0.62;
        pos[idx + 5] = z + 0.04;
      }

      const attr = this.rainLines.geometry.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      this.pendingSync = sync;
      gl.flush();
      const poll = () => {
        if (this.disposed || this.tabHidden) {
          if (this.pendingSync) {
            gl.deleteSync(this.pendingSync);
            this.pendingSync = null;
          }
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          if (this.pendingSync === sync) this.pendingSync = null;
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 85);
    }
  }

  private tick = () => {
    if (this.disposed || this.tabHidden) {
      this.frameId = 0;
      return;
    }
    const dt = Math.min(0.08, this.clock.getDelta());
    this.elapsed += dt;

    this.updatePhysics(dt);
    this.processChunkBuildQueue();
    this.updateMobSpawners(dt);
    this.updateSurvivalMobs(dt);
    this.animateWorld(dt, this.elapsed);
    this.renderer.render(this.scene, this.camera);

    this.scheduleNextTick();
  };

  private spawnHostileMob(
    kind: 'night_stalker' | 'slag_golem',
    x: number,
    y: number,
    z: number
  ): HostileMob {
    const mob: HostileMob = {
      id: `mob_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      kind,
      name: kind === 'slag_golem' ? 'Slag Golem' : 'Night Stalker',
      x,
      y,
      z,
      yaw: Math.random() * Math.PI * 2,
      hp: kind === 'slag_golem' ? 90 : 50,
      maxHp: kind === 'slag_golem' ? 90 : 50,
      attackDamage: kind === 'slag_golem' ? 16 : 10,
      velY: 0,
      onGround: true,
      knockbackX: 0,
      knockbackZ: 0,
      hurtTimer: 0,
      attackAnim: 0,
      deathTimer: 0,
      walkPhase: Math.random() * Math.PI * 2,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 1.5 + Math.random() * 2.5,
      sunBurnCooldown: 0,
      attackCooldown: 0,
    };
    const rig = buildHostileMobRig(kind);
    rig.position.set(mob.x, mob.y, mob.z);
    rig.userData.mobId = mob.id;
    this.mobsGroup.add(rig);
    this.mobs.push(mob);
    this.mobMeshes.set(mob.id, rig);
    return mob;
  }

  /**
   * Checks whether the local player or any connected multiplayer player is within
   * Minecraft's authentic 16-block 3D activation sphere of a Mob Spawner.
   */
  private isAnyPlayerWithinSpawnerRange(cx: number, cy: number, cz: number, radius = 16): boolean {
    const r2 = radius * radius;
    const ldx = this.playerPos.x - cx;
    const ldy = this.playerPos.y + 0.9 - cy;
    const ldz = this.playerPos.z - cz;
    if (ldx * ldx + ldy * ldy + ldz * ldz <= r2) {
      return true;
    }
    for (const remote of this.remoteRigs.values()) {
      const rdx = remote.targetPos.x - cx;
      const rdy = remote.targetPos.y + 0.9 - cy;
      const rdz = remote.targetPos.z - cz;
      if (rdx * rdx + rdy * rdy + rdz * rdz <= r2) {
        return true;
      }
    }
    return false;
  }

  /**
   * Classic Minecraft dungeon torching: any Torch placed within 5.5 blocks (3D)
   * or a claimed 12x12 base / Town Sanctuary suppresses the spawner.
   */
  private isSpawnerSuppressed(sx: number, sy: number, sz: number): boolean {
    const cx = sx + 0.5;
    const cy = sy + 0.5;
    const cz = sz + 0.5;
    if (findTownAt(this.towns, cx, cz) || findClaimAt(this.claims, cx, cz)) {
      return true;
    }
    const maxTorchDistSq = 5.5 * 5.5;
    for (let i = 0; i < this.torchPositions.length; i++) {
      const t = this.torchPositions[i];
      const dx = t.x + 0.5 - cx;
      const dy = t.y + 0.5 - cy;
      const dz = t.z + 0.5 - cz;
      if (dx * dx + dy * dy + dz * dz <= maxTorchDistSq) {
        return true;
      }
    }
    return false;
  }

  /**
   * Updates all loaded Mob Spawner blocks each frame:
   * - Animates the miniature spinning mob & ember sparks
   * - Enforces Night-Only Survival activation, 16-block player proximity,
   *   5.5-block Torch/Safe-Zone suppression, and Minecraft's 9x9x9 local mob cap (max 4 nearby / 10 global)
   * - Spawns 1–2 hostile mobs into open 2-high air spots on solid blocks within an 8x3x8 volume around the cage
   */
  private updateMobSpawners(dt: number) {
    if (this.spawnerLookup.size === 0) return;

    const MAX_LOCAL_MOBS = 4;
    const MAX_GLOBAL_MOBS = 10;
    const LOCAL_CAP_RADIUS_SQ = 9 * 9;

    for (const entry of this.spawnerLookup.values()) {
      if (entry.flameBurstTimer > 0) {
        entry.flameBurstTimer = Math.max(0, entry.flameBurstTimer - dt);
      }

      const cx = entry.x + 0.5;
      const cy = entry.y + 0.5;
      const cz = entry.z + 0.5;

      let status: MobSpawnerStatus;
      let active = false;

      if (this.worldMode !== 'survival') {
        status = 'creative_peaceful';
      } else if (this.isSpawnerSuppressed(entry.x, entry.y, entry.z)) {
        status = 'torch_suppressed';
      } else if (!this.isNight) {
        status = 'daylight';
      } else if (!this.isAnyPlayerWithinSpawnerRange(cx, cy, cz, 16)) {
        status = 'out_of_range';
      } else {
        // Check Minecraft's 9-block local mob cap and global performance cap
        let nearbyMobs = 0;
        for (let i = 0; i < this.mobs.length; i++) {
          const m = this.mobs[i];
          if ((m.deathTimer ?? 0) > 0) continue;
          const dx = m.x - cx;
          const dy = m.y - cy;
          const dz = m.z - cz;
          if (dx * dx + dy * dy + dz * dz <= LOCAL_CAP_RADIUS_SQ) {
            nearbyMobs++;
          }
        }
        if (nearbyMobs >= MAX_LOCAL_MOBS || this.mobs.length >= MAX_GLOBAL_MOBS) {
          status = 'mob_cap';
        } else {
          status = 'active';
          active = true;
        }
      }

      entry.status = status;
      entry.isActive = active;

      if (active) {
        entry.cooldown -= dt;
        // Authentic Minecraft spin acceleration: mini-mob spins faster and faster as spawn timer hits 0!
        const progress = 1 - Math.max(0, Math.min(1, entry.cooldown / Math.max(1, entry.maxCooldown)));
        const spinSpeed = 1.6 + progress * progress * 14.5;
        entry.spinAngle += spinSpeed * dt;

        if (entry.cooldown <= 0) {
          const spawnCount = Math.random() < 0.45 ? 2 : 1;
          let spawned = 0;

          for (let n = 0; n < spawnCount; n++) {
            if (this.mobs.length >= MAX_GLOBAL_MOBS) break;

            for (let attempt = 0; attempt < 16; attempt++) {
              const dx = Math.floor(Math.random() * 9) - 4; // [-4..+4]
              const dz = Math.floor(Math.random() * 9) - 4; // [-4..+4]
              const dy = Math.floor(Math.random() * 3) - 1; // [-1..+1]
              if (dx === 0 && dz === 0 && dy === 0) continue;

              const sx = entry.x + dx;
              const sy = entry.y + dy;
              const sz = entry.z + dz;
              if (!isWithinWorldBounds(sx, sy, sz) || sy <= WORLD_MIN_Y || sy >= WORLD_MAX_Y - 1) {
                continue;
              }
              if (!this.activeChunkSet.has(chunkKey(worldToChunk(sx), worldToChunk(sz)))) {
                continue;
              }

              // Require solid floor underneath and 2-block-tall open space for the mob
              const floorBlocked = this.isBlockedAt(sx + 0.5, sy - 0.5, sz + 0.5);
              const feetClear = !this.isBlockedAt(sx + 0.5, sy + 0.25, sz + 0.5);
              const headClear = !this.isBlockedAt(sx + 0.5, sy + 1.25, sz + 0.5);
              if (!floorBlocked || !feetClear || !headClear) continue;

              // Never spawn inside a player claim, town sanctuary, or torch light zone
              if (
                findTownAt(this.towns, sx + 0.5, sz + 0.5) ||
                findClaimAt(this.claims, sx + 0.5, sz + 0.5) ||
                isProtectedByTorch(this.torchPositions, sx + 0.5, sz + 0.5)
              ) {
                continue;
              }

              // Avoid spawning directly on top of the local player
              if (
                Math.hypot(this.playerPos.x - (sx + 0.5), this.playerPos.z - (sz + 0.5)) < 1.8
              ) {
                continue;
              }

              this.spawnHostileMob(entry.mobKind, sx + 0.5, sy, sz + 0.5);
              spawned++;
              break;
            }
          }

          if (spawned > 0) {
            entry.flameBurstTimer = 0.75;
            entry.maxCooldown = 8 + Math.random() * 6;
            entry.cooldown = entry.maxCooldown;
          } else {
            // Retry shortly if all candidate spots were temporarily obstructed
            entry.cooldown = 2.5;
          }
        }
      } else {
        // Gentle idle spin when dormant (daylight, out of range, or suppressed)
        entry.spinAngle += 0.55 * dt;
        // Reset initial activation delay when player leaves range or daytime resets it
        if (status === 'daylight' || status === 'out_of_range' || status === 'torch_suppressed') {
          entry.cooldown = Math.min(entry.cooldown, 3.5);
          if (entry.cooldown < 2.0) entry.cooldown = 3.5;
        }
      }

      updateMobSpawnerVisuals(entry.mesh, {
        active,
        spinAngle: entry.spinAngle,
        flameBurst: entry.flameBurstTimer / 0.75,
        elapsed: this.elapsed,
      });
    }
  }

  private scheduleNextTick() {
    if (this.disposed || this.tabHidden) {
      this.frameId = 0;
      return;
    }
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private startLoop() {
    this.tabHidden = document.hidden;
    if (!this.tabHidden) {
      this.tick();
    }
  }

  public canMineKind(kind: TerrainBlockKind): { ok: boolean; reason?: string } {
    if (kind === 'bedrock') return { ok: false, reason: 'Bedrock is indestructible.' };
    const info = BLOCK_HARDNESS[kind];
    const pick = getPickaxeMeta(this.pickaxeTier);
    if (pick.harvestPower + this.bonusHarvestPower < info.minPower) {
      return {
        ok: false,
        reason: `Requires Tier ${info.minPower} Pickaxe (upgrade in Equipment Shop or choose Miner class).`,
      };
    }
    return { ok: true };
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.frameId = 0;

    if (this.pendingSync) {
      try {
        const gl = this.renderer.getContext() as WebGL2RenderingContext;
        gl.deleteSync(this.pendingSync);
      } catch {
        // Ignore sync cleanup errors
      }
      this.pendingSync = null;
    }

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('contextmenu', this.onContextMenu);
    dom.removeEventListener('webglcontextlost', this.onContextLost);

    this.clearAllLoadedChunks();
    this.chunkDataCache.clear();
    this.deltasByChunk.clear();
    this.rayTargets.length = 0;
    this.animatedMachines.length = 0;

    clearGroupAndDispose(this.machinesGroup);
    clearGroupAndDispose(this.cablesGroup);
    clearGroupAndDispose(this.claimsGroup);
    clearGroupAndDispose(this.townsGroup);
    clearGroupAndDispose(this.personalSpawnGroup);
    clearGroupAndDispose(this.claimPreviewGroup);
    clearGroupAndDispose(this.remotePlayersGroup);
    clearGroupAndDispose(this.mobsGroup);
    this.remoteRigs.clear();
    this.mobMeshes.clear();

    disposeObject3D(this.playerRig);
    this.scene.remove(this.playerRig);

    this.clearLongPressTimer();
    disposeObject3D(this.fpHandGroup);
    this.camera.remove(this.fpHandGroup);
    this.slashArcMesh.geometry.dispose();
    (this.slashArcMesh.material as THREE.Material).dispose();
    this.camera.remove(this.slashArcMesh);
    this.scene.remove(this.camera);

    this.highlightBox.geometry.dispose();
    (this.highlightBox.material as THREE.Material).dispose();
    this.scene.remove(this.highlightBox);

    this.rainLines.geometry.dispose();
    (this.rainLines.material as THREE.Material).dispose();
    this.scene.remove(this.rainLines);

    this.laserBeamLine.geometry.dispose();
    (this.laserBeamLine.material as THREE.Material).dispose();
    this.scene.remove(this.laserBeamLine);
    for (const beam of this.remoteLaserLines.values()) {
      beam.line.geometry.dispose();
      (beam.line.material as THREE.Material).dispose();
      this.scene.remove(beam.line);
    }
    this.remoteLaserLines.clear();

    this.unitBoxGeo.dispose();
    this.doorBoxGeo.dispose();
    this.torchBoxGeo.dispose();
    this.materials.dispose();
    this.pmremTex?.dispose();
    this.pmremTex = null;

    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
