import React, { useEffect, useRef } from 'react';
import { Minimize2 } from 'lucide-react';
import { CLAIM_SIZE, getClaimDimensions, isTrustedFriendOnClaim } from '../engine/claims';
import {
  extractTorchPositions,
  getWorldTowns,
  TORCH_SAFE_RADIUS,
} from '../engine/safeZones';
import {
  CHUNK_SIZE,
  chunkKey,
  getChunkBlockBounds,
  getSurfaceHeight,
  MINIMAP_VIEW_SPAN_XZ,
  worldToChunk,
} from '../engine/terrain';
import type {
  LandClaim12x12,
  PersonalSpawnPoint,
  PlacedMachine,
  RemotePlayer,
  WorldVoxelDelta,
} from '../types/game';

interface VoxelMinimapProps {
  seed: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  localUid: string;
  localDisplayName: string;
  machines: PlacedMachine[];
  claims: LandClaim12x12[];
  voxelDeltas: Record<string, WorldVoxelDelta>;
  remotePlayers: RemotePlayer[];
  activeChunkKeys: string[];
  exploredChunks: string[];
  personalSpawn?: PersonalSpawnPoint | null;
  onMinimize: () => void;
}

const REVEAL_DURATION_MS = 520;
const MAX_CACHED_MINIMAP_TILES = 256;

function getOrRenderChunkTile(
  cache: Map<string, HTMLCanvasElement>,
  seed: number,
  cx: number,
  cz: number
): HTMLCanvasElement | null {
  const key = chunkKey(cx, cz);
  const cached = cache.get(key);
  if (cached) return cached;

  if (cache.size >= MAX_CACHED_MINIMAP_TILES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }

  const bounds = getChunkBlockBounds(cx, cz);
  const tile = document.createElement('canvas');
  tile.width = CHUNK_SIZE;
  tile.height = CHUNK_SIZE;
  const ctx = tile.getContext('2d');
  if (!ctx) return null;

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    const wz = bounds.minZ + lz;
    const az = Math.abs(wz);
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = bounds.minX + lx;
      const ax = Math.abs(wx);
      const isWorkshopPad = ax <= 4 && az <= 4;

      if (wx === 0 && wz === 0) {
        ctx.fillStyle = '#fde68a';
      } else if (isWorkshopPad && (ax === 4 || az === 4)) {
        ctx.fillStyle = '#94a3b8';
      } else if (isWorkshopPad) {
        ctx.fillStyle = (wx + wz) % 2 === 0 ? '#64748b' : '#475569';
      } else {
        const h = getSurfaceHeight(seed, wx, wz);
        const shade = Math.min(255, Math.max(46, 76 + h * 14));
        ctx.fillStyle =
          h <= 0
            ? '#b8a572'
            : `rgb(${Math.round(shade * 0.52)}, ${shade}, ${Math.round(shade * 0.44)})`;
      }
      ctx.fillRect(lx, lz, 1, 1);
    }
  }

  cache.set(key, tile);
  return tile;
}

export const VoxelMinimap: React.FC<VoxelMinimapProps> = React.memo(({
  seed,
  playerX,
  playerZ,
  playerYaw,
  localUid,
  localDisplayName,
  machines,
  claims,
  voxelDeltas,
  remotePlayers,
  activeChunkKeys,
  exploredChunks,
  personalSpawn,
  onMinimize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chunkTileCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const cachedSeedRef = useRef<number | null>(null);
  const revealStartRef = useRef<Map<string, number>>(new Map());
  const rafRef = useRef<number>(0);

  // Reset tile cache & reveal map when switching to a different world seed
  useEffect(() => {
    if (cachedSeedRef.current !== seed) {
      chunkTileCacheRef.current.clear();
      revealStartRef.current.clear();
      cachedSeedRef.current = seed;
      for (let i = 0; i < exploredChunks.length; i++) {
        revealStartRef.current.set(exploredChunks[i], 0);
      }
      for (let i = 0; i < activeChunkKeys.length; i++) {
        if (!revealStartRef.current.has(activeChunkKeys[i])) {
          revealStartRef.current.set(activeChunkKeys[i], 0);
        }
      }
    }
  }, [seed, exploredChunks, activeChunkKeys]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      chunkTileCacheRef.current.clear();
      revealStartRef.current.clear();
      cachedSeedRef.current = null;
    };
  }, []);

  // Draw player-centered endless scrolling radar minimap with fog-of-war reveal
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nowInit = performance.now();
    const activeSet = new Set(activeChunkKeys);
    const exploredSet = new Set<string>(exploredChunks);
    for (let i = 0; i < activeChunkKeys.length; i++) {
      exploredSet.add(activeChunkKeys[i]);
    }

    for (const k of exploredSet) {
      if (!revealStartRef.current.has(k)) {
        revealStartRef.current.set(k, nowInit);
      }
    }

    const mapPx = canvas.width;
    const viewSpan = MINIMAP_VIEW_SPAN_XZ; // 96 blocks around player
    const halfSpan = viewSpan * 0.5;
    const viewMinX = playerX - halfSpan;
    const viewMinZ = playerZ - halfSpan;
    const scale = mapPx / viewSpan;
    const chunkPx = CHUNK_SIZE * scale;

    const minChunkX = worldToChunk(viewMinX) - 1;
    const maxChunkX = worldToChunk(playerX + halfSpan) + 1;
    const minChunkZ = worldToChunk(viewMinZ) - 1;
    const maxChunkZ = worldToChunk(playerZ + halfSpan) + 1;

    const drawFrame = (now: number) => {
      ctx.imageSmoothingEnabled = false;

      // 1. Base Unexplored Fog-of-War Layer
      ctx.fillStyle = '#090d14';
      ctx.fillRect(0, 0, mapPx, mapPx);

      // 2. Render visible 12x12 chunks overlapping the player-centered radar window
      let anyAnimating = false;
      for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
          const key = chunkKey(cx, cz);
          const cMinX = cx * CHUNK_SIZE;
          const cMinZ = cz * CHUNK_SIZE;
          const rx = (cMinX - viewMinX) * scale;
          const rz = (cMinZ - viewMinZ) * scale;

          if (!exploredSet.has(key)) {
            // Unexplored chunk mist dots
            ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
            ctx.fillRect(rx + chunkPx * 0.25, rz + chunkPx * 0.3, 2, 2);
            ctx.fillRect(rx + chunkPx * 0.68, rz + chunkPx * 0.65, 2, 2);
          } else {
            const tile = getOrRenderChunkTile(chunkTileCacheRef.current, seed, cx, cz);
            if (tile) {
              const start = revealStartRef.current.get(key) ?? 0;
              let alpha = 1;
              if (start > 0) {
                const t = Math.min(1, Math.max(0, (now - start) / REVEAL_DURATION_MS));
                alpha = 1 - Math.pow(1 - t, 3);
                if (t < 1) {
                  anyAnimating = true;
                } else {
                  revealStartRef.current.set(key, 0);
                }
              }

              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.drawImage(tile, rx, rz, chunkPx + 0.4, chunkPx + 0.4);
              ctx.restore();

              if (!activeSet.has(key)) {
                ctx.fillStyle = `rgba(9, 13, 20, ${(0.54 * alpha).toFixed(3)})`;
                ctx.fillRect(rx, rz, chunkPx + 0.4, chunkPx + 0.4);
              }
            }
          }

          // Subtle 12x12 chunk grid lines
          ctx.strokeStyle = 'rgba(42, 52, 68, 0.36)';
          ctx.lineWidth = 1;
          ctx.strokeRect(rx, rz, chunkPx, chunkPx);
        }
      }

      // 3. Crisp Perimeter Outline around the Active Loaded Chunks
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.58)';
      ctx.lineWidth = 1.25;
      for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
          const key = chunkKey(cx, cz);
          if (!activeSet.has(key)) continue;
          const rx = (cx * CHUNK_SIZE - viewMinX) * scale;
          const rz = (cz * CHUNK_SIZE - viewMinZ) * scale;
          if (!activeSet.has(chunkKey(cx, cz - 1))) {
            ctx.beginPath();
            ctx.moveTo(rx, rz);
            ctx.lineTo(rx + chunkPx, rz);
            ctx.stroke();
          }
          if (!activeSet.has(chunkKey(cx, cz + 1))) {
            ctx.beginPath();
            ctx.moveTo(rx, rz + chunkPx);
            ctx.lineTo(rx + chunkPx, rz + chunkPx);
            ctx.stroke();
          }
          if (!activeSet.has(chunkKey(cx - 1, cz))) {
            ctx.beginPath();
            ctx.moveTo(rx, rz);
            ctx.lineTo(rx, rz + chunkPx);
            ctx.stroke();
          }
          if (!activeSet.has(chunkKey(cx + 1, cz))) {
            ctx.beginPath();
            ctx.moveTo(rx + chunkPx, rz);
            ctx.lineTo(rx + chunkPx, rz + chunkPx);
            ctx.stroke();
          }
        }
      }

      // 4. Town Safe Zones (masked by Fog-of-War)
      const towns = getWorldTowns(seed);
      for (const t of towns) {
        const tk = chunkKey(worldToChunk(t.centerX), worldToChunk(t.centerZ));
        if (!exploredSet.has(tk)) continue;
        const tx = (t.centerX - viewMinX) * scale;
        const tz = (t.centerZ - viewMinZ) * scale;
        const tr = t.radius * scale;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.14)';
        ctx.beginPath();
        ctx.arc(tx, tz, tr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(tx - 2, tz - 2, 4, 4);
      }

      // 5. Placed Torches + 1-Chunk (12-block) Anti-Mob Safe Radius (masked by Fog-of-War)
      const torches = extractTorchPositions(voxelDeltas);
      const torchRadiusPx = TORCH_SAFE_RADIUS * scale;
      for (const tc of torches) {
        const tk = chunkKey(worldToChunk(tc.x), worldToChunk(tc.z));
        if (!exploredSet.has(tk)) continue;
        const tx = (tc.x + 0.5 - viewMinX) * scale;
        const tz = (tc.z + 0.5 - viewMinZ) * scale;
        if (tx < -torchRadiusPx || tx > mapPx + torchRadiusPx || tz < -torchRadiusPx || tz > mapPx + torchRadiusPx) {
          continue;
        }
        ctx.fillStyle = 'rgba(245, 158, 11, 0.13)';
        ctx.beginPath();
        ctx.arc(tx, tz, torchRadiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(tx - 1.2, tz - 1.2, 2.4, 2.4);
      }

      // 6. Exact 2-Chunk (24x12 / 12x24) & 1-Chunk (12x12) Claims (masked by Fog-of-War)
      for (const c of claims) {
        const { sizeX, sizeZ } = getClaimDimensions(c);
        const claimVisited =
          exploredSet.has(chunkKey(worldToChunk(c.minX), worldToChunk(c.minZ))) ||
          exploredSet.has(chunkKey(worldToChunk(c.minX + sizeX - 1), worldToChunk(c.minZ))) ||
          exploredSet.has(chunkKey(worldToChunk(c.minX), worldToChunk(c.minZ + sizeZ - 1))) ||
          exploredSet.has(
            chunkKey(worldToChunk(c.minX + sizeX - 1), worldToChunk(c.minZ + sizeZ - 1))
          );
        if (!claimVisited) continue;

        const ok = isTrustedFriendOnClaim(c, { uid: localUid, displayName: localDisplayName });
        const rx = (c.minX - viewMinX) * scale;
        const rz = (c.minZ - viewMinZ) * scale;
        const rw = sizeX * scale;
        const rh = sizeZ * scale;
        ctx.fillStyle = ok ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.28)';
        ctx.fillRect(rx, rz, rw, rh);
        ctx.strokeStyle = ok ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(rx, rz, rw, rh);
        if (sizeX > CLAIM_SIZE) {
          ctx.beginPath();
          ctx.moveTo(rx + CLAIM_SIZE * scale, rz);
          ctx.lineTo(rx + CLAIM_SIZE * scale, rz + rh);
          ctx.stroke();
        }
        if (sizeZ > CLAIM_SIZE) {
          ctx.beginPath();
          ctx.moveTo(rx, rz + CLAIM_SIZE * scale);
          ctx.lineTo(rx + rw, rz + CLAIM_SIZE * scale);
          ctx.stroke();
        }
      }

      // 7. Machines (only inside explored chunks)
      for (const m of machines) {
        const mk = chunkKey(worldToChunk(m.x), worldToChunk(m.z));
        if (!exploredSet.has(mk)) continue;
        const mx = (m.x - viewMinX) * scale;
        const mz = (m.z - viewMinZ) * scale;
        if (mx < -4 || mx > mapPx + 4 || mz < -4 || mz > mapPx + 4) continue;
        ctx.fillStyle = m.kind === 'claim_beacon' ? '#10b981' : '#f59e0b';
        ctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
      }

      // 8. Remote multiplayer engineers (clamped to radar edge if far away so you can always locate teammates)
      for (const rp of remotePlayers) {
        if (rp.uid === localUid) continue;
        const rawPx = (rp.x - viewMinX) * scale;
        const rawPz = (rp.z - viewMinZ) * scale;
        const px = Math.max(5, Math.min(mapPx - 5, rawPx));
        const pz = Math.max(5, Math.min(mapPx - 5, rawPz));
        ctx.fillStyle = rp.appearance?.shirtColor || '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, pz, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 8.5 Personal Claimed Spawn Marker
      if (personalSpawn) {
        const sk = chunkKey(worldToChunk(personalSpawn.x), worldToChunk(personalSpawn.z));
        if (exploredSet.has(sk)) {
          const sx = Math.max(5, Math.min(mapPx - 5, (personalSpawn.x - viewMinX) * scale));
          const sz = Math.max(5, Math.min(mapPx - 5, (personalSpawn.z - viewMinZ) * scale));
          ctx.save();
          ctx.translate(sx, sz);
          ctx.fillStyle = '#38bdf8';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -4);
          ctx.lineTo(4, 0);
          ctx.lineTo(0, 4);
          ctx.lineTo(-4, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // 9. Local player directional arrow (always centered in the scrolling endless minimap)
      const lx = mapPx * 0.5;
      const lz = mapPx * 0.5;
      ctx.save();
      ctx.translate(lx, lz);
      ctx.rotate(-playerYaw);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.lineTo(3.2, 3.5);
      ctx.lineTo(-3.2, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (anyAnimating) {
        rafRef.current = requestAnimationFrame(drawFrame);
      } else {
        rafRef.current = 0;
      }
    };

    cancelAnimationFrame(rafRef.current);
    drawFrame(nowInit);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [
    seed,
    playerX,
    playerZ,
    playerYaw,
    localUid,
    localDisplayName,
    machines,
    claims,
    voxelDeltas,
    remotePlayers,
    activeChunkKeys,
    exploredChunks,
    personalSpawn,
  ]);

  const exploredCount = new Set([...exploredChunks, ...activeChunkKeys]).size;

  return (
    <div className="hud-glass rounded-xl p-2 select-none w-[152px] sm:w-[172px]">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="font-mono text-[10px] text-[#cbd5e1] tabular-nums">
          X {Math.floor(playerX)} · Z {Math.floor(playerZ)}
        </span>
        <button
          type="button"
          onClick={onMinimize}
          title="Collapse minimap"
          className="p-0.5 text-[#94a3b8] hover:text-white cursor-pointer"
        >
          <Minimize2 className="w-3 h-3" />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={144}
        height={144}
        className="w-full aspect-square rounded-lg border border-white/10 block"
      />
      <div className="mt-1.5 px-0.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-[#94a3b8]">
        <span className="text-[#38bdf8]">∞ Endless</span>
        <span>{exploredCount} Chunks</span>
      </div>
    </div>
  );
});
