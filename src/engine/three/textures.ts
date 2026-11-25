import * as THREE from 'three';
import type { TerrainBlockKind } from '../../types/game';

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function makePixelTexture(
  draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void,
  seed: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, seededRand(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function fillNoise(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  baseHex: string,
  variance: number
) {
  const base = new THREE.Color(baseHex);
  const br = Math.round(base.r * 255);
  const bg = Math.round(base.g * 255);
  const bb = Math.round(base.b * 255);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const delta = Math.round((rand() - 0.5) * 2 * variance);
      const r = Math.max(0, Math.min(255, br + delta));
      const g = Math.max(0, Math.min(255, bg + delta));
      const b = Math.max(0, Math.min(255, bb + delta));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawOreSpecks(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  oreHex: string,
  highlightHex: string
) {
  fillNoise(ctx, rand, '#6d737d', 16);
  const clusters = [
    [3, 4],
    [10, 3],
    [6, 10],
    [12, 11],
    [4, 13],
    [11, 7],
  ];
  for (const [cx, cy] of clusters) {
    ctx.fillStyle = oreHex;
    ctx.fillRect(cx, cy, 2, 2);
    ctx.fillRect(cx + (rand() > 0.5 ? 1 : -1), cy, 1, 2);
    ctx.fillStyle = highlightHex;
    ctx.fillRect(cx, cy, 1, 1);
  }
}

export interface VoxelMaterialLibrary {
  getMaterial: (kind: TerrainBlockKind) => THREE.Material | THREE.Material[];
  dispose: () => void;
}

export function createVoxelMaterialLibrary(maxAnisotropy: number): VoxelMaterialLibrary {
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const trackTex = (t: THREE.CanvasTexture) => {
    textures.push(t);
    return t;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const grassTop = trackTex(
    makePixelTexture((ctx, rand) => fillNoise(ctx, rand, '#599f44', 18), 101, maxAnisotropy)
  );
  const dirtTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#7e5a3b', 16);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#5c4028' : '#96704e';
        ctx.fillRect(Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1);
      }
    }, 102, maxAnisotropy)
  );
  const grassSide = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#7e5a3b', 16);
      for (let x = 0; x < 16; x++) {
        const overhang = 3 + Math.floor(rand() * 3);
        for (let y = 0; y < overhang; y++) {
          ctx.fillStyle = y === 0 ? '#62ab4c' : '#4d8d3b';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }, 103, maxAnisotropy)
  );
  const stoneTex = trackTex(
    makePixelTexture((ctx, rand) => fillNoise(ctx, rand, '#787f8a', 15), 104, maxAnisotropy)
  );
  const cobbleTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#6b727d', 20);
      ctx.fillStyle = '#474e57';
      for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
      for (let x = 0; x < 16; x += 5) ctx.fillRect(x, 0, 1, 16);
    }, 105, maxAnisotropy)
  );
  const woodLogSide = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#68482c', 12);
      for (let x = 0; x < 16; x += 3) {
        ctx.fillStyle = '#4d331d';
        ctx.fillRect(x, 0, 1, 16);
      }
    }, 106, maxAnisotropy)
  );
  const woodLogTop = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#b68c5a', 10);
      ctx.strokeStyle = '#68482c';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 14, 14);
      ctx.strokeStyle = '#8b6239';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, 8, 8);
    }, 107, maxAnisotropy)
  );
  const planksTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#ba8d58', 12);
      ctx.fillStyle = '#835c33';
      for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
      ctx.fillRect(7, 0, 1, 4);
      ctx.fillRect(12, 4, 1, 4);
      ctx.fillRect(4, 8, 1, 4);
      ctx.fillRect(10, 12, 1, 4);
    }, 108, maxAnisotropy)
  );
  const leavesTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#417c34', 22);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#2b5922' : '#5aa049';
        ctx.fillRect(Math.floor(rand() * 15), Math.floor(rand() * 15), 2, 1);
      }
    }, 109, maxAnisotropy)
  );
  const sandTex = trackTex(
    makePixelTexture((ctx, rand) => fillNoise(ctx, rand, '#d7c58c', 14), 110, maxAnisotropy)
  );
  const brickTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#9a493a', 14);
      ctx.fillStyle = '#c8bfb0';
      for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * 4;
        ctx.fillRect((off + 0) % 16, row * 4, 1, 4);
        ctx.fillRect((off + 8) % 16, row * 4, 1, 4);
      }
    }, 111, maxAnisotropy)
  );
  const glassTex = trackTex(
    makePixelTexture((ctx) => {
      ctx.fillStyle = '#b4e4f4';
      ctx.fillRect(0, 0, 16, 16);
      ctx.strokeStyle = '#6893a8';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 14, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, 3, 2, 2);
      ctx.fillRect(5, 5, 1, 1);
      ctx.fillRect(11, 10, 2, 1);
    }, 112, maxAnisotropy)
  );
  const ironBlockTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#b6c0ce', 8);
      ctx.strokeStyle = '#6f7c8e';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 14, 14);
      ctx.fillStyle = '#8b97a8';
      ctx.fillRect(3, 3, 1, 1);
      ctx.fillRect(12, 3, 1, 1);
      ctx.fillRect(3, 12, 1, 1);
      ctx.fillRect(12, 12, 1, 1);
    }, 113, maxAnisotropy)
  );
  const woodDoorTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#8e5f36', 10);
      ctx.strokeStyle = '#57361a';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 14, 14);
      ctx.fillStyle = '#6c4524';
      ctx.fillRect(4, 3, 8, 4);
      ctx.fillRect(4, 9, 8, 4);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(12, 8, 2, 2);
    }, 114, maxAnisotropy)
  );
  const ironDoorTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#9aa7b8', 8);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 14, 14);
      ctx.fillStyle = '#334155';
      ctx.fillRect(4, 3, 8, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(12, 8, 2, 2);
    }, 115, maxAnisotropy)
  );
  const coalOreTex = trackTex(
    makePixelTexture((ctx, rand) => drawOreSpecks(ctx, rand, '#1d2128', '#3c424d'), 116, maxAnisotropy)
  );
  const copperOreTex = trackTex(
    makePixelTexture((ctx, rand) => drawOreSpecks(ctx, rand, '#c26532', '#f0945d'), 117, maxAnisotropy)
  );
  const ironOreTex = trackTex(
    makePixelTexture((ctx, rand) => drawOreSpecks(ctx, rand, '#c5a282', '#ebd2bc'), 118, maxAnisotropy)
  );
  const goldOreTex = trackTex(
    makePixelTexture((ctx, rand) => drawOreSpecks(ctx, rand, '#eab308', '#fef08a'), 119, maxAnisotropy)
  );
  const crystalOreTex = trackTex(
    makePixelTexture((ctx, rand) => drawOreSpecks(ctx, rand, '#0284c7', '#7dd3fc'), 120, maxAnisotropy)
  );
  const diamondOreTex = trackTex(
    makePixelTexture((ctx, rand) => drawOreSpecks(ctx, rand, '#06b6d4', '#a5f3fc'), 121, maxAnisotropy)
  );
  const bedrockTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#252930', 22);
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = '#0f1216';
        ctx.fillRect(Math.floor(rand() * 14), Math.floor(rand() * 14), 2, 2);
      }
    }, 122, maxAnisotropy)
  );
  const spawnerTex = trackTex(
    makePixelTexture((ctx) => {
      ctx.fillStyle = '#0c1118';
      ctx.fillRect(0, 0, 16, 16);
      // Dark forged iron cage border & crossbars
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 14, 14);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(7, 1, 2, 14);
      ctx.fillRect(1, 7, 14, 2);
      // Subtle ember glow in cage openings
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(3, 3, 3, 3);
      ctx.fillRect(10, 3, 3, 3);
      ctx.fillRect(3, 10, 3, 3);
      ctx.fillRect(10, 10, 3, 3);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(4, 4, 1, 1);
      ctx.fillRect(11, 11, 1, 1);
    }, 123, maxAnisotropy)
  );
  const chestTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#a86b32', 12);
      ctx.strokeStyle = '#3b2310';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 14, 14);
      // Horizontal lid seam
      ctx.fillStyle = '#241408';
      ctx.fillRect(1, 6, 14, 2);
      // Golden front lock latch
      ctx.fillStyle = '#facc15';
      ctx.fillRect(7, 5, 2, 4);
    }, 124, maxAnisotropy)
  );
  const leverTex = trackTex(
    makePixelTexture((ctx, rand) => {
      fillNoise(ctx, rand, '#5c6470', 14);
      ctx.strokeStyle = '#2d333b';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 14, 14);
      ctx.fillStyle = '#1e242b';
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(7, 5, 2, 6);
    }, 125, maxAnisotropy)
  );

  const std = (map: THREE.Texture, roughness = 0.88, metalness = 0.05) =>
    trackMat(new THREE.MeshStandardMaterial({ map, roughness, metalness }));

  const grassTopMat = std(grassTop, 0.92, 0.02);
  const grassSideMat = std(grassSide, 0.92, 0.02);
  const dirtMat = std(dirtTex, 0.95, 0.02);
  const woodSideMat = std(woodLogSide, 0.9, 0.02);
  const woodTopMat = std(woodLogTop, 0.88, 0.02);

  const matMap: Record<Exclude<TerrainBlockKind, 'air'>, THREE.Material | THREE.Material[]> = {
    grass: [grassSideMat, grassSideMat, grassTopMat, dirtMat, grassSideMat, grassSideMat],
    dirt: dirtMat,
    stone: std(stoneTex, 0.88, 0.04),
    cobblestone: std(cobbleTex, 0.9, 0.04),
    wood_log: [woodSideMat, woodSideMat, woodTopMat, woodTopMat, woodSideMat, woodSideMat],
    wood_planks: std(planksTex, 0.82, 0.04),
    leaves: std(leavesTex, 0.9, 0.0),
    sand: std(sandTex, 0.94, 0.02),
    brick: std(brickTex, 0.84, 0.05),
    glass: trackMat(
      new THREE.MeshStandardMaterial({
        map: glassTex,
        transparent: true,
        opacity: 0.52,
        roughness: 0.16,
        metalness: 0.12,
        depthWrite: false,
      })
    ),
    iron_block: std(ironBlockTex, 0.35, 0.72),
    torch: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        emissive: '#ea580c',
        emissiveIntensity: 0.9,
        roughness: 0.4,
      })
    ),
    wood_door: std(woodDoorTex, 0.78, 0.08),
    iron_door: std(ironDoorTex, 0.32, 0.78),
    chest: std(chestTex, 0.72, 0.14),
    lever: std(leverTex, 0.65, 0.35),
    coal_ore: std(coalOreTex, 0.86, 0.08),
    copper_ore: std(copperOreTex, 0.78, 0.22),
    iron_ore: std(ironOreTex, 0.76, 0.26),
    gold_ore: std(goldOreTex, 0.68, 0.42),
    crystal_ore: trackMat(
      new THREE.MeshStandardMaterial({
        map: crystalOreTex,
        emissive: '#0284c7',
        emissiveIntensity: 0.25,
        roughness: 0.55,
        metalness: 0.25,
      })
    ),
    diamond_ore: trackMat(
      new THREE.MeshStandardMaterial({
        map: diamondOreTex,
        emissive: '#06b6d4',
        emissiveIntensity: 0.28,
        roughness: 0.48,
        metalness: 0.35,
      })
    ),
    mob_spawner: trackMat(
      new THREE.MeshStandardMaterial({
        map: spawnerTex,
        emissive: '#9a3412',
        emissiveIntensity: 0.35,
        roughness: 0.42,
        metalness: 0.72,
      })
    ),
    bedrock: std(bedrockTex, 0.96, 0.05),
  };

  return {
    getMaterial: (kind) => (kind === 'air' ? matMap.stone : matMap[kind]),
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
