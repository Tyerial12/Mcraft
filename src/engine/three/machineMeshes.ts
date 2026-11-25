import * as THREE from 'three';
import { CLAIM_SIZE, getClaimDimensions } from '../claims';
import { normalizeMachineKind } from '../powerGrid';
import type { TownSafeZone } from '../safeZones';
import type { CharacterAppearance, LandClaim12x12, PlacedMachine } from '../../types/game';

/**
 * Shared GPU geometries and materials tracked in SHARED_RESOURCES so disposeObject3D()
 * frees all dynamic per-instance geometries/materials without touching shared pools.
 */
const SHARED_RESOURCES = new WeakSet<THREE.BufferGeometry | THREE.Material>();

function sharedGeo<T extends THREE.BufferGeometry>(geo: T): T {
  SHARED_RESOURCES.add(geo);
  return geo;
}

function sharedMat<T extends THREE.Material>(mat: T): T {
  SHARED_RESOURCES.add(mat);
  return mat;
}

export function disposeObject3D(root: THREE.Object3D): void {
  const disposeMat = (m: THREE.Material) => {
    if (!m || SHARED_RESOURCES.has(m)) return;
    const mapped = m as THREE.MeshBasicMaterial | THREE.SpriteMaterial;
    if (mapped.map instanceof THREE.CanvasTexture) {
      mapped.map.dispose();
    }
    m.dispose();
  };
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh | THREE.Line | THREE.LineSegments | THREE.Sprite;
    if (mesh.geometry && !SHARED_RESOURCES.has(mesh.geometry)) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        disposeMat(m);
      }
    } else if (mat) {
      disposeMat(mat);
    }
  });
}

export function clearGroupAndDispose(group: THREE.Group): void {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const child = group.children[i];
    disposeObject3D(child);
    group.remove(child);
  }
}

// --- Shared Unit Geometries ---
const UNIT_BOX_GEO = sharedGeo(new THREE.BoxGeometry(1, 1, 1));
const UNIT_CYL_8_GEO = sharedGeo(new THREE.CylinderGeometry(1, 1, 1, 8));
const UNIT_CYL_10_GEO = sharedGeo(new THREE.CylinderGeometry(1, 1, 1, 10));
const UNIT_CONE_6_GEO = sharedGeo(new THREE.ConeGeometry(1, 1, 6));
const UNIT_OCTA_GEO = sharedGeo(new THREE.OctahedronGeometry(1, 0));
const UNIT_PLANE_GEO = sharedGeo(new THREE.PlaneGeometry(1, 1));

// --- Shared FTB Industrial Materials ---
const invisibleHitMat = sharedMat(new THREE.MeshBasicMaterial({ visible: false }));
const darkSteelMat = sharedMat(new THREE.MeshStandardMaterial({ color: '#1e2633', roughness: 0.42, metalness: 0.78 }));
const lightSteelMat = sharedMat(new THREE.MeshStandardMaterial({ color: '#8e9bae', roughness: 0.32, metalness: 0.8 }));
const copperMat = sharedMat(new THREE.MeshStandardMaterial({ color: '#c25e2e', roughness: 0.35, metalness: 0.74 }));
const forestryGreenMat = sharedMat(new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.45, metalness: 0.4 }));
const firewoodTimberMat = sharedMat(new THREE.MeshStandardMaterial({ color: '#854d27', roughness: 0.8, metalness: 0.08 }));
const powahRedMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.4,
  })
);
const warningAmberMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    emissive: '#d97706',
    emissiveIntensity: 0.75,
    roughness: 0.3,
    metalness: 0.2,
  })
);
const unpoweredAmberMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#473c2e',
    roughness: 0.7,
    metalness: 0.2,
  })
);
const furnaceGlowMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: '#ea580c',
    emissiveIntensity: 1.25,
    roughness: 0.25,
  })
);
const furnaceOffMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#1b1f27',
    roughness: 0.9,
    metalness: 0.1,
  })
);
const ae2CyanGlowMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#22d3ee',
    emissive: '#06b6d4',
    emissiveIntensity: 1.05,
    roughness: 0.18,
  })
);
const ae2PurpleGlowMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#a855f7',
    emissive: '#9333ea',
    emissiveIntensity: 0.95,
    roughness: 0.22,
  })
);
const terminalScreenOff = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#142029',
    roughness: 0.5,
  })
);
const solarCellOnMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#1d4ed8',
    emissive: '#0284c7',
    emissiveIntensity: 0.42,
    roughness: 0.16,
    metalness: 0.72,
  })
);
const solarCellDimMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#172554',
    roughness: 0.28,
    metalness: 0.62,
  })
);
const claimOwnedCrystalMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#10b981',
    emissive: '#059669',
    emissiveIntensity: 0.95,
    roughness: 0.2,
    metalness: 0.3,
  })
);
const claimLockedCrystalMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 0.95,
    roughness: 0.2,
    metalness: 0.3,
  })
);

// Bundled Ender IO Universal Conduit Materials (FE Red/Amber + ME Cyan + Item Emerald)
const conduitFeOnMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    emissive: '#ea580c',
    emissiveIntensity: 0.85,
    roughness: 0.3,
    metalness: 0.6,
  })
);
const conduitMeOnMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0284c7',
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.5,
  })
);
const conduitItemMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#10b981',
    emissive: '#059669',
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.5,
  })
);
const cableIdleMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.55,
    metalness: 0.65,
  })
);

// Augment Badge Materials
const augSpeedMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 0.9 })
);
const augYieldMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#10b981', emissive: '#059669', emissiveIntensity: 0.9 })
);
const augCoilMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#d97706', emissiveIntensity: 0.9 })
);
const augMeMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.9 })
);

const charEyeMat = sharedMat(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 }));

// Shared Mob Materials
const golemBodyMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#3f2e2b', roughness: 0.82, metalness: 0.3 })
);
const golemTrimMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.75, metalness: 0.45 })
);
const stalkerBodyMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#2b4c3f', roughness: 0.82, metalness: 0.1 })
);
const stalkerShirtMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#1e3a5f', roughness: 0.85, metalness: 0.08 })
);
const stalkerPantsMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#312e81', roughness: 0.85, metalness: 0.08 })
);
const golemEyeMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#f97316',
    emissive: '#ea580c',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  })
);
const stalkerEyeMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  })
);
const mobHurtFlashMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#ff3b3b',
    emissive: '#dc2626',
    emissiveIntensity: 1.15,
    roughness: 0.35,
  })
);
const mobSunburnFlashMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: '#ea580c',
    emissiveIntensity: 1.35,
    roughness: 0.3,
  })
);
const mobHpBgMat = sharedMat(
  new THREE.MeshBasicMaterial({ color: '#090d14', transparent: true, opacity: 0.82 })
);
const mobHpGreenMat = sharedMat(new THREE.MeshBasicMaterial({ color: '#22c55e' }));
const mobHpAmberMat = sharedMat(new THREE.MeshBasicMaterial({ color: '#f59e0b' }));
const mobHpRedMat = sharedMat(new THREE.MeshBasicMaterial({ color: '#ef4444' }));

// Shared 12x12 Claim Border Materials
const claimLineOwnedMat = sharedMat(
  new THREE.LineBasicMaterial({ color: '#10b981', transparent: true, opacity: 0.95 })
);
const claimLineLockedMat = sharedMat(
  new THREE.LineBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.95 })
);
const claimPostOwnedMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#10b981',
    emissive: '#10b981',
    emissiveIntensity: 0.7,
    roughness: 0.25,
    transparent: true,
    opacity: 0.9,
  })
);
const claimPostLockedMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#ef4444',
    emissiveIntensity: 0.7,
    roughness: 0.25,
    transparent: true,
    opacity: 0.9,
  })
);
const claimWallOwnedMat = sharedMat(
  new THREE.MeshBasicMaterial({
    color: '#10b981',
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
const claimWallLockedMat = sharedMat(
  new THREE.MeshBasicMaterial({
    color: '#ef4444',
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);

// Shared Claim Preview Materials
const previewLineValidMat = sharedMat(
  new THREE.LineBasicMaterial({ color: '#34d399', transparent: true, opacity: 0.9 })
);
const previewLineInvalidMat = sharedMat(
  new THREE.LineBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.9 })
);
const previewWallValidMat = sharedMat(
  new THREE.MeshBasicMaterial({
    color: '#34d399',
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
const previewWallInvalidMat = sharedMat(
  new THREE.MeshBasicMaterial({
    color: '#ef4444',
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
const previewPostValidMat = sharedMat(
  new THREE.MeshBasicMaterial({ color: '#34d399', transparent: true, opacity: 0.65 })
);
const previewPostInvalidMat = sharedMat(
  new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.65 })
);

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(UNIT_BOX_GEO, mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(
  r: number,
  h: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  highSeg = false
): THREE.Mesh {
  const mesh = new THREE.Mesh(highSeg ? UNIT_CYL_10_GEO : UNIT_CYL_8_GEO, mat);
  mesh.scale.set(r, h, r);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Builds a composite procedural 3D FTB Direwolf20 machine assembly grounded at bottom-center (y = 0..1).
 */
export function buildMachineMesh(
  machine: PlacedMachine,
  powered: boolean,
  isClaimAccessible = true
): THREE.Group {
  const group = new THREE.Group();
  const normKind = normalizeMachineKind(machine.kind);

  group.userData = {
    interactKind: 'machine',
    machineId: machine.id,
    machineKind: normKind,
    blockX: machine.x,
    blockY: machine.y,
    blockZ: machine.z,
  };

  // Base Mekanism/Thermal dark steel machine chassis plinth
  group.add(box(0.94, 0.14, 0.94, darkSteelMat, 0, 0.07, 0));

  switch (normKind) {
    case 'firewood_splitter': {
      // Saw table bed + timber guides + spinning circular saw blade
      group.add(box(0.86, 0.44, 0.84, copperMat, 0, 0.36, 0));
      group.add(box(0.76, 0.08, 0.74, lightSteelMat, 0, 0.6, 0));
      // Log resting on saw bed
      group.add(box(0.26, 0.24, 0.68, firewoodTimberMat, -0.16, 0.72, 0));
      // Spinning saw blade disc
      const blade = cyl(0.28, 0.05, lightSteelMat, 0.12, 0.74, 0, true);
      blade.rotation.z = Math.PI / 2;
      blade.name = 'spinner';
      group.add(blade);
      group.add(box(0.2, 0.08, 0.2, powered ? warningAmberMat : unpoweredAmberMat, 0.28, 0.66, 0.28));
      break;
    }

    case 'firewood_boiler': {
      const burning = powered && (machine.coalFuelSeconds > 0 || machine.coalBuffer > 0);
      // Firebox base + copper high-pressure steam tank + twin exhaust stacks
      group.add(box(0.86, 0.42, 0.84, darkSteelMat, 0, 0.35, 0));
      group.add(box(0.6, 0.26, 0.08, burning ? furnaceGlowMat : furnaceOffMat, 0, 0.34, 0.4));
      group.add(cyl(0.36, 0.44, copperMat, 0, 0.76, 0, true));
      group.add(cyl(0.1, 0.35, darkSteelMat, -0.22, 1.02, -0.2));
      group.add(cyl(0.1, 0.35, darkSteelMat, 0.22, 1.02, -0.2));
      // Stacked firewood bundle on side rack
      group.add(box(0.16, 0.22, 0.48, firewoodTimberMat, 0.44, 0.32, 0));
      break;
    }

    case 'forestry_multifarm': {
      // Forestry green farm gearbox casing + central miniature arboretum tree + rotating harvester arm
      group.add(box(0.88, 0.42, 0.88, forestryGreenMat, 0, 0.35, 0));
      group.add(box(0.92, 0.08, 0.92, copperMat, 0, 0.56, 0));
      // Miniature sapling trunk & canopy
      group.add(box(0.18, 0.38, 0.18, firewoodTimberMat, 0, 0.76, 0));
      group.add(box(0.46, 0.26, 0.46, forestryGreenMat, 0, 1.0, 0));
      const arm = box(0.76, 0.06, 0.1, lightSteelMat, 0, 0.68, 0);
      arm.name = 'spinner';
      group.add(arm);
      break;
    }

    case 'solar_array': {
      // Composite Photovoltaic Solar Panel Array: base junction box, mast, tilted frame, cell grid & power LED
      group.add(box(0.56, 0.24, 0.56, darkSteelMat, 0, 0.26, 0));
      group.add(cyl(0.1, 0.46, lightSteelMat, 0, 0.56, 0));
      group.add(box(0.28, 0.14, 0.22, copperMat, 0, 0.34, 0.28));
      group.add(
        box(0.12, 0.08, 0.06, powered ? ae2CyanGlowMat : unpoweredAmberMat, 0, 0.36, 0.4)
      );

      // Tilted solar array panel head
      const panelPivot = new THREE.Group();
      panelPivot.position.set(0, 0.82, 0);
      panelPivot.rotation.x = -0.34;

      // Aluminum bezel frame
      panelPivot.add(box(0.92, 0.06, 0.82, lightSteelMat, 0, 0, 0));
      // Deep-blue silicon solar cell bed
      panelPivot.add(box(0.82, 0.04, 0.72, powered ? solarCellOnMat : solarCellDimMat, 0, 0.025, 0));
      // Silver photovoltaic grid busbars
      panelPivot.add(box(0.82, 0.045, 0.03, lightSteelMat, 0, 0.03, -0.18));
      panelPivot.add(box(0.82, 0.045, 0.03, lightSteelMat, 0, 0.03, 0.18));
      panelPivot.add(box(0.03, 0.045, 0.72, lightSteelMat, -0.18, 0.03, 0));
      panelPivot.add(box(0.03, 0.045, 0.72, lightSteelMat, 0.18, 0.03, 0));
      group.add(panelPivot);
      break;
    }

    case 'powah_reactor': {
      // Powah! black/red high-voltage reactor core with glowing red/cyan plasma core
      group.add(box(0.86, 0.78, 0.86, darkSteelMat, 0, 0.52, 0));
      // 4 corner cooling fins
      group.add(box(0.14, 0.86, 0.14, lightSteelMat, -0.38, 0.56, -0.38));
      group.add(box(0.14, 0.86, 0.14, lightSteelMat, 0.38, 0.56, -0.38));
      group.add(box(0.14, 0.86, 0.14, lightSteelMat, -0.38, 0.56, 0.38));
      group.add(box(0.14, 0.86, 0.14, lightSteelMat, 0.38, 0.56, 0.38));
      // Glowing Nitro reactor core windows
      const coreMat = powered ? powahRedMat : unpoweredAmberMat;
      group.add(box(0.54, 0.48, 0.9, coreMat, 0, 0.54, 0));
      group.add(box(0.9, 0.48, 0.54, coreMat, 0, 0.54, 0));
      const crystal = new THREE.Mesh(UNIT_OCTA_GEO, powered ? warningAmberMat : unpoweredAmberMat);
      crystal.scale.setScalar(0.2);
      crystal.position.set(0, 1.04, 0);
      crystal.name = 'spinner';
      group.add(crystal);
      break;
    }

    case 'flux_battery': {
      const chargePct = machine.maxEnergy > 0 ? Math.min(1, machine.storedEnergy / machine.maxEnergy) : 0;
      group.add(box(0.82, 0.7, 0.76, darkSteelMat, 0, 0.49, 0));
      // Red/Amber Thermal Flux cells
      group.add(cyl(0.18, 0.64, copperMat, -0.22, 0.52, 0.05, true));
      group.add(cyl(0.18, 0.64, copperMat, 0.22, 0.52, 0.05, true));
      const barH = Math.max(0.08, 0.52 * chargePct);
      group.add(
        box(0.18, barH, 0.08, chargePct > 0.04 ? warningAmberMat : unpoweredAmberMat, 0, 0.22 + barH / 2, 0.38)
      );
      group.add(box(0.68, 0.08, 0.2, powahRedMat, 0, 0.88, 0));
      break;
    }

    case 'digital_miner': {
      // Mekanism 4-pillar Digital Miner with holographic scanner screen & rotary laser drill
      group.add(box(0.12, 0.82, 0.12, darkSteelMat, -0.36, 0.52, -0.36));
      group.add(box(0.12, 0.82, 0.12, darkSteelMat, 0.36, 0.52, -0.36));
      group.add(box(0.12, 0.82, 0.12, darkSteelMat, -0.36, 0.52, 0.36));
      group.add(box(0.12, 0.82, 0.12, darkSteelMat, 0.36, 0.52, 0.36));
      group.add(box(0.88, 0.18, 0.88, lightSteelMat, 0, 0.88, 0));
      // Front digital monitor
      group.add(box(0.48, 0.24, 0.06, powered ? ae2CyanGlowMat : terminalScreenOff, 0, 0.66, 0.42));
      const drill = new THREE.Mesh(UNIT_CONE_6_GEO, powered ? ae2CyanGlowMat : copperMat);
      drill.scale.set(0.24, 0.64, 0.24);
      drill.rotation.x = Math.PI;
      drill.position.set(0, 0.44, 0);
      drill.name = 'spinner';
      group.add(drill);
      break;
    }

    case 'sag_mill': {
      // Ender IO SAG Mill with dual grinding pistons & top ore hopper
      group.add(box(0.86, 0.64, 0.84, darkSteelMat, 0, 0.46, 0));
      group.add(box(0.64, 0.18, 0.64, lightSteelMat, 0, 0.86, 0));
      // Grinding teeth window
      group.add(box(0.58, 0.28, 0.08, powered ? augYieldMat : furnaceOffMat, 0, 0.48, 0.41));
      const crusherWheel = cyl(0.22, 0.52, lightSteelMat, 0, 0.52, 0, true);
      crusherWheel.rotation.z = Math.PI / 2;
      crusherWheel.name = 'spinner';
      group.add(crusherWheel);
      break;
    }

    case 'alloy_smelter': {
      // Ender IO Alloy Smelter with triple induction blast chambers
      group.add(box(0.86, 0.74, 0.84, darkSteelMat, 0, 0.51, 0));
      group.add(box(0.64, 0.34, 0.08, powered ? furnaceGlowMat : furnaceOffMat, 0, 0.45, 0.41));
      group.add(box(0.08, 0.46, 0.56, copperMat, -0.45, 0.5, 0));
      group.add(box(0.08, 0.46, 0.56, copperMat, 0.45, 0.5, 0));
      group.add(box(0.58, 0.12, 0.58, lightSteelMat, 0, 0.92, 0));
      break;
    }

    case 'me_controller': {
      // Applied Energistics 2 ME Controller & Drive rack with glowing cyan/purple channels
      group.add(box(0.86, 0.86, 0.86, darkSteelMat, 0, 0.57, 0));
      const coreGlow = powered ? ae2CyanGlowMat : terminalScreenOff;
      const accentGlow = powered ? ae2PurpleGlowMat : terminalScreenOff;
      // Crossed AE2 neon channel lines on all faces
      group.add(box(0.22, 0.74, 0.9, coreGlow, 0, 0.57, 0));
      group.add(box(0.9, 0.74, 0.22, coreGlow, 0, 0.57, 0));
      group.add(box(0.9, 0.2, 0.9, accentGlow, 0, 0.57, 0));
      break;
    }

    case 'molecular_assembler': {
      // AE2 Molecular Assembler with translucent-look crafting chamber & bobbing laser head
      group.add(box(0.88, 0.42, 0.88, darkSteelMat, 0, 0.35, 0));
      group.add(box(0.76, 0.06, 0.76, ae2CyanGlowMat, 0, 0.58, 0));
      group.add(box(0.1, 0.38, 0.1, lightSteelMat, -0.36, 0.76, -0.36));
      group.add(box(0.1, 0.38, 0.1, lightSteelMat, 0.36, 0.76, -0.36));
      group.add(box(0.1, 0.38, 0.1, lightSteelMat, -0.36, 0.76, 0.36));
      group.add(box(0.1, 0.38, 0.1, lightSteelMat, 0.36, 0.76, 0.36));
      group.add(box(0.84, 0.08, 0.84, darkSteelMat, 0, 0.94, 0));
      const head = box(0.24, 0.2, 0.24, powered ? ae2PurpleGlowMat : unpoweredAmberMat, 0, 0.78, 0);
      head.name = 'bobber';
      group.add(head);
      break;
    }

    case 'dire_automator': {
      // Just Dire Things Block Automator with Blazegold emitter aperture
      group.add(box(0.84, 0.74, 0.84, darkSteelMat, 0, 0.51, 0));
      group.add(box(0.46, 0.46, 0.08, powered ? warningAmberMat : unpoweredAmberMat, 0, 0.52, 0.41));
      group.add(box(0.66, 0.1, 0.66, copperMat, 0, 0.92, 0));
      break;
    }

    case 'claim_beacon': {
      const crystalMat = isClaimAccessible ? claimOwnedCrystalMat : claimLockedCrystalMat;
      group.add(box(0.68, 0.22, 0.68, darkSteelMat, 0, 0.24, 0));
      group.add(box(0.46, 0.14, 0.46, lightSteelMat, 0, 0.42, 0));
      const crystal = new THREE.Mesh(UNIT_OCTA_GEO, crystalMat);
      crystal.scale.setScalar(0.24);
      crystal.position.set(0, 0.84, 0);
      crystal.name = 'spinner';
      group.add(crystal);
      group.add(box(0.08, 0.42, 0.08, lightSteelMat, -0.26, 0.62, -0.26));
      group.add(box(0.08, 0.42, 0.08, lightSteelMat, 0.26, 0.62, -0.26));
      group.add(box(0.08, 0.42, 0.08, lightSteelMat, -0.26, 0.62, 0.26));
      group.add(box(0.08, 0.42, 0.08, lightSteelMat, 0.26, 0.62, 0.26));
      break;
    }
  }

  // Render installed FTB Machine Augment Addon modules on the side of the machine!
  if (machine.augments && machine.augments.length > 0) {
    for (let i = 0; i < Math.min(3, machine.augments.length); i++) {
      const augId = machine.augments[i];
      const mat =
        augId === 'aug_speed_flux'
          ? augSpeedMat
          : augId === 'aug_yield_sieve'
            ? augYieldMat
            : augId === 'aug_fe_coil'
              ? augCoilMat
              : augMeMat;
      group.add(box(0.08, 0.14, 0.14, mat, -0.46, 0.28 + i * 0.2, -0.22 + i * 0.2));
    }
  }

  // Invisible full-block click proxy
  const hitBox = new THREE.Mesh(UNIT_BOX_GEO, invisibleHitMat);
  hitBox.scale.set(0.98, 1.0, 0.98);
  hitBox.position.set(0, 0.5, 0);
  hitBox.userData = group.userData;
  group.add(hitBox);

  group.position.set(machine.x + 0.5, machine.y, machine.z + 0.5);
  return group;
}

/**
 * Builds an Ender IO Universal Conduit bundle (FE Energy + AE2 ME Data + Item Pipe in a single voxel space).
 */
export function buildPowerCableMesh(
  x: number,
  y: number,
  z: number,
  neighbors: { px: boolean; nx: boolean; py: boolean; ny: boolean; pz: boolean; nz: boolean },
  powered: boolean
): THREE.Group {
  const group = new THREE.Group();
  const feMat = powered ? conduitFeOnMat : cableIdleMat;
  const meMat = powered ? conduitMeOnMat : cableIdleMat;

  group.userData = {
    interactKind: 'cable',
    blockX: x,
    blockY: y,
    blockZ: z,
  };

  // Central Ender IO conduit connector plate
  const hub = new THREE.Mesh(UNIT_BOX_GEO, darkSteelMat);
  hub.scale.set(0.32, 0.32, 0.32);
  hub.position.set(0, 0.5, 0);
  group.add(hub);

  const core = new THREE.Mesh(UNIT_BOX_GEO, feMat);
  core.scale.set(0.22, 0.22, 0.22);
  core.position.set(0, 0.5, 0);
  group.add(core);

  const addBundledArm = (sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    // Primary FE energy pipe
    const feArm = new THREE.Mesh(UNIT_BOX_GEO, feMat);
    feArm.scale.set(sx, sy, sz);
    feArm.position.set(px, py + 0.05, pz);
    group.add(feArm);

    // Parallel AE2 ME data & item conduit strand
    const meArm = new THREE.Mesh(UNIT_BOX_GEO, meMat);
    meArm.scale.set(sx * 0.85, sy * 0.75, sz * 0.85);
    meArm.position.set(px, py - 0.06, pz);
    group.add(meArm);

    const itemArm = new THREE.Mesh(UNIT_BOX_GEO, conduitItemMat);
    itemArm.scale.set(sx * 0.65, sy * 0.65, sz * 0.65);
    itemArm.position.set(px, py, pz + (sx > sz ? 0.06 : 0));
    group.add(itemArm);
  };

  if (neighbors.px) addBundledArm(0.42, 0.1, 0.1, 0.29, 0.5, 0);
  if (neighbors.nx) addBundledArm(0.42, 0.1, 0.1, -0.29, 0.5, 0);
  if (neighbors.py) addBundledArm(0.1, 0.42, 0.1, 0, 0.79, 0);
  if (neighbors.ny) addBundledArm(0.1, 0.42, 0.1, 0, 0.21, 0);
  if (neighbors.pz) addBundledArm(0.1, 0.1, 0.42, 0, 0.5, 0.29);
  if (neighbors.nz) addBundledArm(0.1, 0.1, 0.42, 0, 0.5, -0.29);

  const proxy = new THREE.Mesh(UNIT_BOX_GEO, invisibleHitMat);
  proxy.scale.set(0.65, 0.65, 0.65);
  proxy.position.set(0, 0.5, 0);
  proxy.userData = group.userData;
  group.add(proxy);

  group.position.set(x + 0.5, y, z + 0.5);
  return group;
}

export function buildVoxelCharacterRig(appearance: CharacterAppearance): THREE.Group {
  const root = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: appearance.skinColor, roughness: 0.85 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor, roughness: 0.78 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.9 });
  const accentMat = new THREE.MeshStandardMaterial({ color: appearance.accentColor, roughness: 0.4, metalness: 0.5 });

  const leftLeg = box(0.24, 0.66, 0.24, pantsMat, -0.13, 0.33, 0);
  leftLeg.name = 'leftLeg';
  const rightLeg = box(0.24, 0.66, 0.24, pantsMat, 0.13, 0.33, 0);
  rightLeg.name = 'rightLeg';
  root.add(leftLeg, rightLeg);

  root.add(box(0.52, 0.64, 0.28, shirtMat, 0, 0.98, 0));
  root.add(box(0.55, 0.1, 0.31, accentMat, 0, 0.72, 0));

  const leftArm = box(0.2, 0.62, 0.22, shirtMat, -0.36, 0.98, 0);
  leftArm.name = 'leftArm';
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.36, 1.24, 0);
  rightArmGroup.name = 'rightArm';
  rightArmGroup.add(box(0.2, 0.62, 0.22, shirtMat, 0, -0.26, 0));
  // Held Direwolf20 Mining Gadget Laseremitter
  const gadgetBody = box(0.12, 0.16, 0.38, darkSteelMat, 0, -0.52, 0.22);
  const gadgetCore = box(0.08, 0.08, 0.18, ae2CyanGlowMat, 0, -0.52, 0.42);
  rightArmGroup.add(gadgetBody, gadgetCore);
  root.add(leftArm, rightArmGroup);

  root.add(box(0.46, 0.46, 0.46, skinMat, 0, 1.54, 0));
  root.add(box(0.48, 0.14, 0.48, hairMat, 0, 1.72, 0));
  root.add(box(0.07, 0.07, 0.04, charEyeMat, -0.1, 1.54, 0.23));
  root.add(box(0.07, 0.07, 0.04, charEyeMat, 0.1, 1.54, 0.23));

  return root;
}

export function buildPlayerNameplateSprite(name: string, accentColor = '#22d3ee'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 56;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(11, 16, 26, 0.86)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(10, 8, 236, 40, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 21px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    const label = name.length > 16 ? `${name.slice(0, 15)}…` : name;
    ctx.fillText(label, 128, 29);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.65, 0.36, 1);
  sprite.position.set(0, 2.25, 0);
  sprite.renderOrder = 10;
  return sprite;
}

export interface HostileMobRigParts {
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;
  hpBarGroup: THREE.Group;
  hpBarFill: THREE.Mesh;
  sunFireGroup: THREE.Group;
  tintTargets: Array<{ mesh: THREE.Mesh; baseMat: THREE.Material }>;
}

export function buildHostileMobRig(kind: 'night_stalker' | 'slag_golem'): THREE.Group {
  const root = new THREE.Group();
  const isGolem = kind === 'slag_golem';
  const skinMat = isGolem ? golemBodyMat : stalkerBodyMat;
  const torsoMat = isGolem ? golemTrimMat : stalkerShirtMat;
  const legMat = isGolem ? golemBodyMat : stalkerPantsMat;
  const eyeMat = isGolem ? golemEyeMat : stalkerEyeMat;

  const s = isGolem ? 1.18 : 0.98;
  const tintTargets: Array<{ mesh: THREE.Mesh; baseMat: THREE.Material }> = [];
  const trackMesh = (m: THREE.Mesh, baseMat: THREE.Material) => {
    tintTargets.push({ mesh: m, baseMat });
    return m;
  };

  // Left & Right Legs pivoted at the hip (y = 0.64 * s)
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.15 * s, 0.64 * s, 0);
  const leftLegMesh = trackMesh(
    box(0.24 * s, 0.64 * s, 0.24 * s, legMat, 0, -0.32 * s, 0),
    legMat
  );
  leftLegGroup.add(leftLegMesh);

  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.15 * s, 0.64 * s, 0);
  const rightLegMesh = trackMesh(
    box(0.24 * s, 0.64 * s, 0.24 * s, legMat, 0, -0.32 * s, 0),
    legMat
  );
  rightLegGroup.add(rightLegMesh);

  // Torso
  const torsoMesh = trackMesh(
    box(0.56 * s, 0.68 * s, 0.32 * s, torsoMat, 0, 0.98 * s, 0),
    torsoMat
  );
  root.add(leftLegGroup, rightLegGroup, torsoMesh);

  if (isGolem) {
    // Glowing slag core in chest
    const coreMesh = box(0.24 * s, 0.24 * s, 0.36 * s, furnaceGlowMat, 0, 1.02 * s, 0);
    root.add(coreMesh);
  }

  // Left & Right Arms pivoted at the shoulder (y = 1.24 * s)
  // Default pose extends forward like a Minecraft Zombie / Golem
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.4 * s, 1.24 * s, 0);
  const leftArmSleeve = trackMesh(
    box(0.22 * s, 0.66 * s, 0.22 * s, skinMat, 0, -0.25 * s, 0),
    skinMat
  );
  leftArmGroup.add(leftArmSleeve);
  leftArmGroup.rotation.x = -Math.PI * 0.42;

  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.4 * s, 1.24 * s, 0);
  const rightArmSleeve = trackMesh(
    box(0.22 * s, 0.66 * s, 0.22 * s, skinMat, 0, -0.25 * s, 0),
    skinMat
  );
  rightArmGroup.add(rightArmSleeve);
  rightArmGroup.rotation.x = -Math.PI * 0.42;

  root.add(leftArmGroup, rightArmGroup);

  // Head pivoted at neck (y = 1.32 * s)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.32 * s, 0);
  const headMesh = trackMesh(
    box(0.48 * s, 0.48 * s, 0.48 * s, skinMat, 0, 0.24 * s, 0),
    skinMat
  );
  const leftEye = box(0.11 * s, 0.08 * s, 0.05 * s, eyeMat, -0.11 * s, 0.26 * s, 0.24 * s);
  const rightEye = box(0.11 * s, 0.08 * s, 0.05 * s, eyeMat, 0.11 * s, 0.26 * s, 0.24 * s);
  headGroup.add(headMesh, leftEye, rightEye);
  root.add(headGroup);

  // Sunlight Fire Crown (visible when burning in daytime sunlight like Minecraft Zombies)
  const sunFireGroup = new THREE.Group();
  sunFireGroup.position.set(0, 1.1 * s, 0);
  const flame1 = box(0.65 * s, 0.85 * s, 0.42 * s, furnaceGlowMat, 0, 0.2 * s, 0);
  const flame2 = box(0.38 * s, 0.45 * s, 0.38 * s, warningAmberMat, 0, 0.72 * s, 0);
  sunFireGroup.add(flame1, flame2);
  sunFireGroup.visible = false;
  root.add(sunFireGroup);

  // Floating 3D HP Bar above head
  const hpBarGroup = new THREE.Group();
  hpBarGroup.position.set(0, 2.04 * s, 0);
  const hpBg = box(0.86, 0.11, 0.04, mobHpBgMat, 0, 0, 0);
  const hpBarFill = box(0.8, 0.07, 0.05, mobHpGreenMat, 0, 0, 0.005);
  hpBarGroup.add(hpBg, hpBarFill);
  root.add(hpBarGroup);

  const parts: HostileMobRigParts = {
    headGroup,
    leftArmGroup,
    rightArmGroup,
    leftLegGroup,
    rightLegGroup,
    hpBarGroup,
    hpBarFill,
    sunFireGroup,
    tintTargets,
  };
  root.userData.mobParts = parts;

  return root;
}

export function updateHostileMobRigVisuals(
  rig: THREE.Group,
  params: {
    hp: number;
    maxHp: number;
    hurtActive: boolean;
    sunBurning: boolean;
    cameraPos: THREE.Vector3;
  }
): void {
  const parts = rig.userData.mobParts as HostileMobRigParts | undefined;
  if (!parts) return;

  // Update hurt / sunburn material flash
  for (const item of parts.tintTargets) {
    if (params.hurtActive) {
      item.mesh.material = params.sunBurning ? mobSunburnFlashMat : mobHurtFlashMat;
    } else {
      item.mesh.material = item.baseMat;
    }
  }

  parts.sunFireGroup.visible = params.sunBurning;

  // Update HP bar ratio & color
  const ratio = Math.max(0.02, Math.min(1, params.hp / Math.max(1, params.maxHp)));
  parts.hpBarFill.scale.x = ratio;
  parts.hpBarFill.position.x = -0.4 * (1 - ratio);
  parts.hpBarFill.material =
    ratio > 0.55 ? mobHpGreenMat : ratio > 0.25 ? mobHpAmberMat : mobHpRedMat;

  // Billboard HP bar toward camera
  parts.hpBarGroup.lookAt(params.cameraPos);
}

export interface MobSpawnerRigParts {
  miniMobGroup: THREE.Group;
  coreMesh: THREE.Mesh;
  emberGroup: THREE.Group;
  emberMeshes: THREE.Mesh[];
}

/**
 * Builds a Minecraft-authentic forged-iron Monster Spawner cage with:
 * - Invisible 1x1x1 raycast hitbox
 * - 12 outer iron corner beams + vertical grate bars (open lattice so you see inside)
 * - Glowing ember hearth core at the base
 * - Spinning miniature hostile mob (Night Stalker or Slag Golem) suspended inside
 * - Orbiting/rising ember sparks that flare outward when a mob spawns
 */
export function buildMobSpawnerMesh(
  wx: number,
  wy: number,
  wz: number,
  mobKind: 'night_stalker' | 'slag_golem'
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(wx + 0.5, wy + 0.5, wz + 0.5);
  root.userData = {
    interactKind: 'spawner',
    blockX: wx,
    blockY: wy,
    blockZ: wz,
    blockKind: 'mob_spawner',
    spawnerMobKind: mobKind,
  };

  // Full-block invisible raycast hitbox so mining/hovering any face feels crisp
  const hitBox = new THREE.Mesh(UNIT_BOX_GEO, invisibleHitMat);
  hitBox.userData = {
    interactKind: 'spawner',
    blockX: wx,
    blockY: wy,
    blockZ: wz,
    blockKind: 'mob_spawner',
    spawnerMobKind: mobKind,
  };
  root.add(hitBox);

  // Outer forged-iron cube frame (4 vertical corner posts + 8 top/bottom rim beams)
  const postThickness = 0.11;
  const edge = 0.445;
  const corners: [number, number][] = [
    [-edge, -edge],
    [edge, -edge],
    [-edge, edge],
    [edge, edge],
  ];
  for (const [cx, cz] of corners) {
    const post = box(postThickness, 1.0, postThickness, darkSteelMat, cx, 0, cz);
    post.castShadow = true;
    post.receiveShadow = true;
    root.add(post);
  }

  for (const yOff of [-edge, edge]) {
    const beamN = box(1.0, postThickness, postThickness, darkSteelMat, 0, yOff, -edge);
    const beamS = box(1.0, postThickness, postThickness, darkSteelMat, 0, yOff, edge);
    const beamW = box(postThickness, postThickness, 0.88, darkSteelMat, -edge, yOff, 0);
    const beamE = box(postThickness, postThickness, 0.88, darkSteelMat, edge, yOff, 0);
    root.add(beamN, beamS, beamW, beamE);
  }

  // Open dungeon iron grate bars on all 4 vertical faces + top/bottom crossbars
  const barThick = 0.045;
  for (const offset of [-0.18, 0.18]) {
    // Front & back vertical grate bars
    root.add(box(barThick, 0.82, barThick, lightSteelMat, offset, 0, edge));
    root.add(box(barThick, 0.82, barThick, lightSteelMat, offset, 0, -edge));
    // Left & right vertical grate bars
    root.add(box(barThick, 0.82, barThick, lightSteelMat, edge, 0, offset));
    root.add(box(barThick, 0.82, barThick, lightSteelMat, -edge, 0, offset));
  }
  // Horizontal mid-ring bars around the cage
  root.add(box(0.86, barThick, barThick, darkSteelMat, 0, 0, edge));
  root.add(box(0.86, barThick, barThick, darkSteelMat, 0, 0, -edge));
  root.add(box(barThick, barThick, 0.86, darkSteelMat, edge, 0, 0));
  root.add(box(barThick, barThick, 0.86, darkSteelMat, -edge, 0, 0));

  // Base ember hearth core inside the cage
  const coreMesh = box(0.36, 0.12, 0.36, unpoweredAmberMat, 0, -0.36, 0);
  root.add(coreMesh);

  // Miniature spinning mob suspended inside the iron cage
  const miniMobGroup = new THREE.Group();
  miniMobGroup.position.set(0, -0.14, 0);
  const isGolem = mobKind === 'slag_golem';
  const skinMat = isGolem ? golemBodyMat : stalkerBodyMat;
  const torsoMat = isGolem ? golemTrimMat : stalkerShirtMat;
  const legMat = isGolem ? golemBodyMat : stalkerPantsMat;
  const eyeMat = isGolem ? golemEyeMat : stalkerEyeMat;
  const ms = isGolem ? 0.31 : 0.28;

  // Mini legs, torso, outstretched zombie arms, head + glowing eyes
  miniMobGroup.add(box(0.24 * ms, 0.52 * ms, 0.24 * ms, legMat, -0.14 * ms, 0.26 * ms, 0));
  miniMobGroup.add(box(0.24 * ms, 0.52 * ms, 0.24 * ms, legMat, 0.14 * ms, 0.26 * ms, 0));
  miniMobGroup.add(box(0.56 * ms, 0.64 * ms, 0.3 * ms, torsoMat, 0, 0.82 * ms, 0));
  if (isGolem) {
    miniMobGroup.add(box(0.24 * ms, 0.24 * ms, 0.34 * ms, furnaceGlowMat, 0, 0.86 * ms, 0));
  }
  miniMobGroup.add(box(0.2 * ms, 0.2 * ms, 0.56 * ms, skinMat, -0.38 * ms, 1.0 * ms, 0.22 * ms));
  miniMobGroup.add(box(0.2 * ms, 0.2 * ms, 0.56 * ms, skinMat, 0.38 * ms, 1.0 * ms, 0.22 * ms));
  miniMobGroup.add(box(0.46 * ms, 0.46 * ms, 0.46 * ms, skinMat, 0, 1.36 * ms, 0));
  miniMobGroup.add(box(0.11 * ms, 0.08 * ms, 0.06 * ms, eyeMat, -0.11 * ms, 1.38 * ms, 0.23 * ms));
  miniMobGroup.add(box(0.11 * ms, 0.08 * ms, 0.06 * ms, eyeMat, 0.11 * ms, 1.38 * ms, 0.23 * ms));
  root.add(miniMobGroup);

  // Rising/orbiting 3D ember spark cubes inside the cage
  const emberGroup = new THREE.Group();
  const emberMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const spark = box(
      0.085,
      0.085,
      0.085,
      i % 2 === 0 ? furnaceGlowMat : warningAmberMat,
      0,
      0,
      0
    );
    emberGroup.add(spark);
    emberMeshes.push(spark);
  }
  emberGroup.visible = false;
  root.add(emberGroup);

  const parts: MobSpawnerRigParts = {
    miniMobGroup,
    coreMesh,
    emberGroup,
    emberMeshes,
  };
  root.userData.spawnerParts = parts;
  return root;
}

export function updateMobSpawnerVisuals(
  rig: THREE.Group,
  params: {
    active: boolean;
    spinAngle: number;
    flameBurst: number;
    elapsed: number;
  }
): void {
  const parts = rig.userData.spawnerParts as MobSpawnerRigParts | undefined;
  if (!parts) return;

  parts.miniMobGroup.rotation.y = params.spinAngle;
  parts.miniMobGroup.position.y =
    -0.15 + Math.sin(params.elapsed * (params.active ? 3.8 : 1.4)) * 0.045;

  const isLit = params.active || params.flameBurst > 0;
  parts.coreMesh.material = isLit ? furnaceGlowMat : unpoweredAmberMat;
  parts.emberGroup.visible = isLit;

  if (isLit) {
    const burstExpand = params.flameBurst > 0 ? 1 + params.flameBurst * 1.45 : 1;
    for (let i = 0; i < parts.emberMeshes.length; i++) {
      const spark = parts.emberMeshes[i];
      const phase = params.elapsed * 2.1 + i * 1.57;
      const radius = (0.21 + 0.07 * Math.sin(phase * 1.6)) * burstExpand;
      const heightCycle = ((params.elapsed * 0.9 + i * 0.25) % 1) * 0.72 - 0.34;
      spark.position.set(
        Math.cos(phase) * radius,
        heightCycle + (params.flameBurst > 0 ? params.flameBurst * 0.25 : 0),
        Math.sin(phase) * radius
      );
      const sc = params.flameBurst > 0 ? 1.45 : 0.75 + 0.35 * Math.sin(phase * 2.2);
      spark.scale.set(sc, sc, sc);
      spark.rotation.set(phase, phase * 1.3, 0);
    }
  }
}


const fpSleeveMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.72, metalness: 0.1 })
);
const fpSkinMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#e0a97f', roughness: 0.65, metalness: 0.05 })
);

export function buildFirstPersonToolRig(pickaxeTier: string): THREE.Group {
  const root = new THREE.Group();

  // Voxel Forearm & Hand
  const sleeveMat = fpSleeveMat;
  const skinMat = fpSkinMat;
  const handleMat = firewoodTimberMat;

  const headColor =
    pickaxeTier === 'mining_gadget'
      ? '#38bdf8'
      : pickaxeTier === 'flux_drill'
      ? '#f59e0b'
      : pickaxeTier === 'diamond'
      ? '#22d3ee'
      : pickaxeTier === 'iron'
      ? '#cbd5e1'
      : '#94a3b8';

  const headMat = new THREE.MeshStandardMaterial({
    color: headColor,
    emissive: pickaxeTier === 'mining_gadget' ? '#0284c7' : '#000000',
    emissiveIntensity: pickaxeTier === 'mining_gadget' ? 0.85 : 0,
    roughness: 0.28,
    metalness: 0.75,
  });

  // Forearm angled toward center-front like Minecraft first-person hand
  const armGroup = new THREE.Group();
  const sleeve = box(0.18, 0.36, 0.18, sleeveMat, 0, -0.1, 0.08);
  sleeve.rotation.x = -0.55;
  const fist = box(0.16, 0.18, 0.16, skinMat, 0, 0.04, -0.08);
  fist.rotation.x = -0.55;
  armGroup.add(sleeve, fist);

  // Pickaxe / Sword / Gadget held in fist
  const toolGroup = new THREE.Group();
  toolGroup.position.set(0, 0.08, -0.14);
  toolGroup.rotation.x = -0.35;

  const shaft = box(0.055, 0.56, 0.055, handleMat, 0, 0.18, 0);
  const crossHead = box(0.065, 0.09, 0.38, headMat, 0, 0.42, 0);
  const frontTip = box(0.06, 0.07, 0.12, headMat, 0, 0.38, -0.21);
  const backTip = box(0.06, 0.07, 0.12, headMat, 0, 0.38, 0.21);
  const bladeEdge = box(0.035, 0.28, 0.08, headMat, 0, 0.28, -0.06);

  toolGroup.add(shaft, crossHead, frontTip, backTip, bladeEdge);
  root.add(armGroup, toolGroup);

  return root;
}

export function buildMeleeSlashArcMesh(): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.32, 0.62, 18, 1, -Math.PI * 0.4, Math.PI * 0.8);
  const mat = new THREE.MeshBasicMaterial({
    color: '#fef08a',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 25;
  return mesh;
}

export function buildClaimPerimeter12x12(
  claim: LandClaim12x12,
  accessible: boolean,
  getSurfaceY: (x: number, z: number) => number
): THREE.Group {
  const group = new THREE.Group();
  const lineMat = accessible ? claimLineOwnedMat : claimLineLockedMat;
  const postMat = accessible ? claimPostOwnedMat : claimPostLockedMat;
  const wallMat = accessible ? claimWallOwnedMat : claimWallLockedMat;

  const { sizeX, sizeZ } = getClaimDimensions(claim);
  const x0 = claim.minX;
  const x1 = claim.minX + sizeX;
  const z0 = claim.minZ;
  const z1 = claim.minZ + sizeZ;
  const centerX = x0 + sizeX / 2;
  const centerZ = z0 + sizeZ / 2;

  const corners: [number, number][] = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];

  // Add middle chunk-divider posts when the claim spans 2 chunks (24x12 or 12x24)
  if (sizeX === CLAIM_SIZE * 2) {
    corners.push([x0 + CLAIM_SIZE, z0], [x0 + CLAIM_SIZE, z1]);
  } else if (sizeZ === CLAIM_SIZE * 2) {
    corners.push([x0, z0 + CLAIM_SIZE], [x1, z0 + CLAIM_SIZE]);
  }

  let minCornerY = 99;
  let maxCornerY = -99;
  for (const [cx, cz] of corners) {
    const sy = getSurfaceY(cx === x1 ? cx - 1 : cx, cz === z1 ? cz - 1 : cz) + 1;
    if (sy < minCornerY) minCornerY = sy;
    if (sy > maxCornerY) maxCornerY = sy;
    const postH = 8.0;
    const post = new THREE.Mesh(UNIT_BOX_GEO, postMat);
    post.scale.set(0.22, postH, 0.22);
    post.position.set(cx, sy + postH / 2 - 0.5, cz);
    group.add(post);

    const cap = new THREE.Mesh(UNIT_OCTA_GEO, postMat);
    cap.scale.setScalar(0.28);
    cap.position.set(cx, sy + postH - 0.2, cz);
    group.add(cap);
  }

  const wallHeight = Math.max(7, maxCornerY - minCornerY + 7);
  const wallCenterY = minCornerY + wallHeight / 2 - 0.5;
  const northWall = new THREE.Mesh(UNIT_PLANE_GEO, wallMat);
  northWall.scale.set(sizeX, wallHeight, 1);
  northWall.position.set(centerX, wallCenterY, z0);

  const southWall = new THREE.Mesh(UNIT_PLANE_GEO, wallMat);
  southWall.scale.set(sizeX, wallHeight, 1);
  southWall.position.set(centerX, wallCenterY, z1);

  const westWall = new THREE.Mesh(UNIT_PLANE_GEO, wallMat);
  westWall.scale.set(sizeZ, wallHeight, 1);
  westWall.rotation.y = Math.PI / 2;
  westWall.position.set(x0, wallCenterY, centerZ);

  const eastWall = new THREE.Mesh(UNIT_PLANE_GEO, wallMat);
  eastWall.scale.set(sizeZ, wallHeight, 1);
  eastWall.rotation.y = Math.PI / 2;
  eastWall.position.set(x1, wallCenterY, centerZ);

  group.add(northWall, southWall, westWall, eastWall);

  const positions: number[] = [];
  const pushEdge = (ax: number, az: number, bx: number, bz: number, yOffset: number) => {
    const steps = Math.max(CLAIM_SIZE, Math.round(Math.hypot(bx - ax, bz - az)));
    let prevX = 0;
    let prevY = 0;
    let prevZ = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      const sy =
        getSurfaceY(
          Math.min(x1 - 1, Math.max(x0, Math.floor(px))),
          Math.min(z1 - 1, Math.max(z0, Math.floor(pz)))
        ) + 1;
      const py = sy + yOffset;
      if (i > 0) {
        positions.push(prevX, prevY, prevZ, px, py, pz);
      }
      prevX = px;
      prevY = py;
      prevZ = pz;
    }
  };

  for (const yOff of [0.16, 2.6, 5.4]) {
    pushEdge(x0, z0, x1, z0, yOff);
    pushEdge(x1, z0, x1, z1, yOff);
    pushEdge(x1, z1, x0, z1, yOff);
    pushEdge(x0, z1, x0, z0, yOff);
    // Internal 12x12 chunk divider line showing the two 12x12 chunks
    if (sizeX === CLAIM_SIZE * 2) {
      pushEdge(x0 + CLAIM_SIZE, z0, x0 + CLAIM_SIZE, z1, yOff);
    } else if (sizeZ === CLAIM_SIZE * 2) {
      pushEdge(x0, z0 + CLAIM_SIZE, x1, z0 + CLAIM_SIZE, yOff);
    }
  }

  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  group.add(new THREE.LineSegments(railGeo, lineMat));

  return group;
}

export function buildClaimPreview12x12(
  minX: number,
  minZ: number,
  valid: boolean,
  getSurfaceY: (x: number, z: number) => number,
  sizeX: number = CLAIM_SIZE * 2,
  sizeZ: number = CLAIM_SIZE
): THREE.Group {
  const group = new THREE.Group();
  const lineMat = valid ? previewLineValidMat : previewLineInvalidMat;
  const wallMat = valid ? previewWallValidMat : previewWallInvalidMat;
  const postMat = valid ? previewPostValidMat : previewPostInvalidMat;

  const x0 = minX;
  const x1 = minX + sizeX;
  const z0 = minZ;
  const z1 = minZ + sizeZ;
  const sy = getSurfaceY(minX + Math.floor(sizeX / 2), minZ + Math.floor(sizeZ / 2)) + 1;

  const corners: [number, number][] = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  if (sizeX === CLAIM_SIZE * 2) {
    corners.push([x0 + CLAIM_SIZE, z0], [x0 + CLAIM_SIZE, z1]);
  } else if (sizeZ === CLAIM_SIZE * 2) {
    corners.push([x0, z0 + CLAIM_SIZE], [x1, z0 + CLAIM_SIZE]);
  }
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(UNIT_BOX_GEO, postMat);
    post.scale.set(0.16, 5.5, 0.16);
    post.position.set(cx, sy + 2.5, cz);
    group.add(post);
  }

  const yLo = sy + 0.25;
  const yHi = sy + 4.75;
  const segList: number[] = [
    x0, yLo, z0, x1, yLo, z0,
    x1, yLo, z0, x1, yLo, z1,
    x1, yLo, z1, x0, yLo, z1,
    x0, yLo, z1, x0, yLo, z0,
    x0, yHi, z0, x1, yHi, z0,
    x1, yHi, z0, x1, yHi, z1,
    x1, yHi, z1, x0, yHi, z1,
    x0, yHi, z1, x0, yHi, z0,
  ];
  if (sizeX === CLAIM_SIZE * 2) {
    const xm = x0 + CLAIM_SIZE;
    segList.push(xm, yLo, z0, xm, yLo, z1, xm, yHi, z0, xm, yHi, z1);
  } else if (sizeZ === CLAIM_SIZE * 2) {
    const zm = z0 + CLAIM_SIZE;
    segList.push(x0, yLo, zm, x1, yLo, zm, x0, yHi, zm, x1, yHi, zm);
  }
  const segs = new Float32Array(segList);
  const outlineGeo = new THREE.BufferGeometry();
  outlineGeo.setAttribute('position', new THREE.BufferAttribute(segs, 3));
  group.add(new THREE.LineSegments(outlineGeo, lineMat));

  const floorPlane = new THREE.Mesh(UNIT_PLANE_GEO, wallMat);
  floorPlane.scale.set(sizeX, sizeZ, 1);
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.set(x0 + sizeX / 2, sy + 0.12, z0 + sizeZ / 2);
  group.add(floorPlane);

  return group;
}

/**
 * Builds a 3D Redstone Machine Control Lever block with a cobblestone plinth
 * and a pivoting switch handle that tilts & glows red when switched ON.
 */
export function buildLeverMesh(
  wx: number,
  wy: number,
  wz: number,
  isOn: boolean
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(wx + 0.5, wy, wz + 0.5);
  root.userData = {
    interactKind: 'door',
    blockX: wx,
    blockY: wy,
    blockZ: wz,
    blockKind: 'lever',
    leverOn: isOn,
  };

  // Invisible click hitbox covering the switch area
  const hitBox = box(0.68, 0.72, 0.68, invisibleHitMat, 0, 0.36, 0);
  hitBox.userData = {
    interactKind: 'door',
    blockX: wx,
    blockY: wy,
    blockZ: wz,
    blockKind: 'lever',
    leverOn: isOn,
  };
  root.add(hitBox);

  // Stone switch housing plate
  const basePlate = box(0.46, 0.16, 0.58, darkSteelMat, 0, 0.08, 0);
  const slotGroove = box(0.12, 0.18, 0.36, lightSteelMat, 0, 0.12, 0);
  root.add(basePlate, slotGroove);

  // Pivoting lever arm + redstone tip
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.15, 0);
  pivot.rotation.x = isOn ? 0.58 : -0.58;
  const shaft = box(0.09, 0.44, 0.09, firewoodTimberMat, 0, 0.2, 0);
  const tip = box(
    0.16,
    0.14,
    0.16,
    isOn ? powahRedMat : unpoweredAmberMat,
    0,
    0.44,
    0
  );
  pivot.add(shaft, tip);
  root.add(pivot);

  return root;
}

export function buildTownSafeZoneVisual(
  _town: TownSafeZone,
  _getSurfaceY: (x: number, z: number) => number
): THREE.Group {
  return new THREE.Group();
}

const spawnPadBaseMat = sharedMat(
  new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.45, metalness: 0.65 })
);
const spawnPadGlowMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0ea5e9',
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.2,
  })
);
const spawnPadCoreMat = sharedMat(
  new THREE.MeshStandardMaterial({
    color: '#a7f3d0',
    emissive: '#10b981',
    emissiveIntensity: 1.6,
    roughness: 0.15,
  })
);
const spawnPadRingLineMat = sharedMat(
  new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.9 })
);

export function buildPersonalSpawnMarker(x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const baseY = Math.floor(y);

  const padBase = new THREE.Mesh(UNIT_BOX_GEO, spawnPadBaseMat);
  padBase.scale.set(0.92, 0.08, 0.92);
  padBase.position.set(0, 0.04, 0);
  group.add(padBase);

  const innerRing = new THREE.Mesh(UNIT_BOX_GEO, spawnPadGlowMat);
  innerRing.scale.set(0.62, 0.09, 0.62);
  innerRing.position.set(0, 0.048, 0);
  group.add(innerRing);

  const centerCore = new THREE.Mesh(UNIT_BOX_GEO, spawnPadCoreMat);
  centerCore.scale.set(0.32, 0.1, 0.32);
  centerCore.position.set(0, 0.055, 0);
  group.add(centerCore);

  const offsets: [number, number][] = [
    [-0.42, -0.42],
    [0.42, -0.42],
    [0.42, 0.42],
    [-0.42, 0.42],
  ];
  for (let i = 0; i < offsets.length; i++) {
    const [ox, oz] = offsets[i];
    const pin = new THREE.Mesh(UNIT_BOX_GEO, spawnPadBaseMat);
    pin.scale.set(0.1, 0.24, 0.1);
    pin.position.set(ox, 0.12, oz);
    group.add(pin);

    const gem = new THREE.Mesh(UNIT_OCTA_GEO, spawnPadGlowMat);
    gem.scale.setScalar(0.08);
    gem.position.set(ox, 0.28, oz);
    group.add(gem);
  }

  const segments = 20;
  const ringVerts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    ringVerts.push(
      Math.cos(a0) * 0.68, 0.14, Math.sin(a0) * 0.68,
      Math.cos(a1) * 0.68, 0.14, Math.sin(a1) * 0.68
    );
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringVerts, 3));
  group.add(new THREE.LineSegments(ringGeo, spawnPadRingLineMat));

  group.position.set(Math.floor(x) + 0.5, baseY, Math.floor(z) + 0.5);
  return group;
}
