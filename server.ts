import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { DOOR_KINDS, MACHINE_KINDS, VALID_TERRAIN_BLOCKS } from './src/data/catalog.ts';
import {
  canAccessPosition,
  DEFAULT_TRUSTED_PERMISSIONS,
  findClaimAt,
  getClaimAccessError,
  getClaimDimensions,
  isClaimOwner,
  MAX_TRUSTED_FRIENDS,
  sanitizeClaims,
} from './src/engine/claims.ts';
import {
  getTownProtectionError,
  validateNewClaimOutsideSafeZones,
} from './src/engine/safeZones.ts';
import { isWithinWorldBounds, parseVoxelKey, voxelKey } from './src/engine/terrain.ts';
import type {
  ClientWsMessage,
  LiveWorldSummary,
  MultiplayerRoomSnapshot,
  RemotePlayer,
  RoomChatMessage,
  ServerWsMessage,
  WorldData,
} from './src/types/game.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS_PER_WORLD = 8;
const MAX_CHAT_HISTORY = 40;
const ARCHIVE_FILE = path.join(os.tmpdir(), 'aethercraft_v2_host_worlds.json');

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  inviteCode: string | null;
  uid: string | null;
  lastChatMs: number;
}

interface ActiveWorldRoom {
  world: WorldData;
  hostClientId: string;
  players: Map<string, RemotePlayer>;
  chat: RoomChatMessage[];
}

const clients = new Map<string, ConnectedClient>();
const roomsByCode = new Map<string, ActiveWorldRoom>();
const archivedHostWorlds = new Map<string, WorldData>();

function loadArchivedWorlds() {
  try {
    if (!fs.existsSync(ARCHIVE_FILE)) return;
    const raw = fs.readFileSync(ARCHIVE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, WorldData>;
    if (!parsed || typeof parsed !== 'object') return;
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.id === 'string') archivedHostWorlds.set(k, v);
    }
  } catch {
    // Ignore ephemeral read failures
  }
}

function archiveHostWorld(world: WorldData) {
  try {
    if (archivedHostWorlds.has(world.id)) {
      archivedHostWorlds.delete(world.id);
    }
    archivedHostWorlds.set(world.id, { ...world, updatedAtMs: Date.now() });
    while (archivedHostWorlds.size > 40) {
      const oldestKey = archivedHostWorlds.keys().next().value;
      if (oldestKey === undefined) break;
      archivedHostWorlds.delete(oldestKey);
    }
    const obj: Record<string, WorldData> = {};
    for (const [k, v] of archivedHostWorlds.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(obj), 'utf8');
  } catch {
    // Ignore write failures
  }
}

loadArchivedWorlds();

function cleanStr(val: unknown, fallback: string, maxLen: number): string {
  if (typeof val !== 'string') return fallback;
  const s = val.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
  return s || fallback;
}

function sendMsg(client: ConnectedClient, msg: ServerWsMessage) {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(room: ActiveWorldRoom, msg: ServerWsMessage, excludeClientId?: string) {
  const raw = JSON.stringify(msg);
  for (const cid of room.players.keys()) {
    if (excludeClientId && cid === excludeClientId) continue;
    const c = clients.get(cid);
    if (c && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(raw);
    }
  }
}

function pushSystemChat(room: ActiveWorldRoom, text: string) {
  const message: RoomChatMessage = {
    id: `sys_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
    senderUid: 'system',
    senderName: 'World Server',
    text,
    timestampMs: Date.now(),
    system: true,
  };
  room.chat = [...room.chat.slice(-(MAX_CHAT_HISTORY - 1)), message];
  broadcastRoom(room, { type: 'chat:message', message });
}

function serializeRoom(room: ActiveWorldRoom): MultiplayerRoomSnapshot {
  return {
    world: room.world,
    hostClientId: room.hostClientId,
    players: Array.from(room.players.values()),
    chat: room.chat,
  };
}

function removeClientFromRoom(client: ConnectedClient) {
  if (!client.inviteCode) return;
  const room = roomsByCode.get(client.inviteCode);
  client.inviteCode = null;
  if (!room) return;

  const leaving = room.players.get(client.id);
  const wasHost = room.hostClientId === client.id;

  // Always archive host world automatically when host leaves or closes connection
  if (wasHost) {
    archiveHostWorld(room.world);
  }

  room.players.delete(client.id);

  if (room.players.size === 0) {
    archiveHostWorld(room.world);
    roomsByCode.delete(room.world.inviteCode);
    return;
  }

  if (wasHost) {
    const nextHost = room.players.keys().next().value;
    if (nextHost) room.hostClientId = nextHost;
    pushSystemChat(room, `Host ${leaving?.name || 'Builder'} exited — world state auto-saved.`);
  } else if (leaving) {
    pushSystemChat(room, `${leaving.name} left the world.`);
  }

  broadcastRoom(room, { type: 'world:state', room: serializeRoom(room) });
}

function handleWsMessage(client: ConnectedClient, rawData: string) {
  let msg: ClientWsMessage;
  try {
    msg = JSON.parse(rawData) as ClientWsMessage;
  } catch {
    return;
  }
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

  if (msg.type === 'world:host') {
    removeClientFromRoom(client);
    const w = msg.world;
    if (!w || typeof w.id !== 'string' || typeof w.inviteCode !== 'string') return;
    const code = cleanStr(w.inviteCode, 'WORLD1', 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const playerUid = cleanStr(msg.player?.uid, client.id, 128);
    client.uid = playerUid;

    const sanitizedWorld: WorldData = {
      ...w,
      name: cleanStr(w.name, 'Industrial Frontier', 48),
      ownerName: cleanStr(w.ownerName, 'Builder', 64),
      inviteCode: code,
      mode: w.mode === 'peaceful' ? 'peaceful' : 'survival',
      accessMode:
        w.accessMode === 'public' || w.accessMode === 'friends' ? w.accessMode : 'private',
      claims: sanitizeClaims(w.claims),
      machines: Array.isArray(w.machines) ? w.machines.slice(0, 120) : [],
      cables: Array.isArray(w.cables) ? w.cables.slice(0, 500) : [],
      voxelDeltas: w.voxelDeltas && typeof w.voxelDeltas === 'object' ? w.voxelDeltas : {},
      storageInventory: w.storageInventory && typeof w.storageInventory === 'object' ? w.storageInventory : {},
    };

    const hostPlayer: RemotePlayer = {
      ...msg.player,
      clientId: client.id,
      uid: playerUid,
      name: cleanStr(msg.player?.name, 'Builder', 32),
    };

    const room: ActiveWorldRoom = {
      world: sanitizedWorld,
      hostClientId: client.id,
      players: new Map([[client.id, hostPlayer]]),
      chat: [],
    };

    roomsByCode.set(code, room);
    client.inviteCode = code;
    sendMsg(client, { type: 'world:joined', clientId: client.id, room: serializeRoom(room) });
    const modeLabel = sanitizedWorld.mode === 'peaceful' ? 'CREATIVE' : 'FTB TECH';
    pushSystemChat(
      room,
      `${hostPlayer.name} opened "${sanitizedWorld.name}" (${modeLabel} · Code ${code}).`
    );
    return;
  }

  if (msg.type === 'world:join') {
    const code = cleanStr(msg.inviteCode, '', 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = roomsByCode.get(code);
    if (!room) {
      sendMsg(client, {
        type: 'notice',
        tone: 'error',
        message: `No live world found for invite code "${code}". Ask the host to open their world.`,
      });
      return;
    }

    const playerUid = cleanStr(msg.player?.uid, client.id, 128);
    if (room.world.accessMode === 'private' && room.world.ownerId !== playerUid) {
      sendMsg(client, {
        type: 'notice',
        tone: 'error',
        message: `"${room.world.name}" is set to Private (Solo). Ask the host to switch it to Friends or Public.`,
      });
      return;
    }

    if (!room.players.has(client.id) && room.players.size >= MAX_PLAYERS_PER_WORLD) {
      sendMsg(client, {
        type: 'notice',
        tone: 'error',
        message: `World "${room.world.name}" is full (${MAX_PLAYERS_PER_WORLD} players max).`,
      });
      return;
    }

    removeClientFromRoom(client);
    client.uid = playerUid;
    client.inviteCode = code;

    const joiner: RemotePlayer = {
      ...msg.player,
      clientId: client.id,
      uid: playerUid,
      name: cleanStr(msg.player?.name, 'Builder', 32),
    };
    room.players.set(client.id, joiner);

    sendMsg(client, { type: 'world:joined', clientId: client.id, room: serializeRoom(room) });
    broadcastRoom(room, { type: 'world:state', room: serializeRoom(room) }, client.id);
    pushSystemChat(room, `${joiner.name} joined the world.`);
    return;
  }

  if (msg.type === 'world:leave') {
    removeClientFromRoom(client);
    sendMsg(client, { type: 'world:left' });
    return;
  }

  // Remaining messages require an active room
  if (!client.inviteCode) return;
  const room = roomsByCode.get(client.inviteCode);
  if (!room) return;
  const player = room.players.get(client.id);
  if (!player) return;

  const identity = { uid: player.uid, displayName: player.name };

  switch (msg.type) {
    case 'player:move': {
      player.x = Number.isFinite(msg.x) ? msg.x : player.x;
      player.y = Number.isFinite(msg.y) ? msg.y : player.y;
      player.z = Number.isFinite(msg.z) ? msg.z : player.z;
      player.yaw = Number.isFinite(msg.yaw) ? msg.yaw : player.yaw;
      player.crouching = Boolean(msg.crouching);
      player.heldItem = msg.heldItem ?? null;
      broadcastRoom(
        room,
        {
          type: 'player:moved',
          clientId: client.id,
          x: player.x,
          y: player.y,
          z: player.z,
          yaw: player.yaw,
          crouching: player.crouching,
          heldItem: player.heldItem,
        },
        client.id
      );
      break;
    }

    case 'player:swing': {
      broadcastRoom(room, { type: 'player:swung', clientId: client.id }, client.id);
      break;
    }

    case 'player:laser': {
      const tx = Number(msg.tx);
      const ty = Number(msg.ty);
      const tz = Number(msg.tz);
      if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(tz)) break;
      broadcastRoom(room, { type: 'player:laser', clientId: client.id, tx, ty, tz }, client.id);
      break;
    }

    case 'voxel:batch': {
      if (!Array.isArray(msg.deltas) || msg.deltas.length === 0) return;
      const accepted: typeof msg.deltas = [];
      for (const d of msg.deltas.slice(0, 32)) {
        const bx = Math.floor(Number(d.x));
        const by = Math.floor(Number(d.y));
        const bz = Math.floor(Number(d.z));
        if (!isWithinWorldBounds(bx, by, bz) || !VALID_TERRAIN_BLOCKS.has(d.kind)) continue;
        const lockErr = getClaimAccessError(
          room.world.claims,
          bx,
          bz,
          identity,
          d.kind === 'air' ? 'mine blocks here' : 'build here',
          'build'
        );
        if (lockErr) continue;
        const key = voxelKey(bx, by, bz);
        const delta = DOOR_KINDS.has(d.kind)
          ? { x: bx, y: by, z: bz, kind: d.kind, open: Boolean(d.open) }
          : { x: bx, y: by, z: bz, kind: d.kind };
        room.world.voxelDeltas[key] = delta;
        accepted.push(delta);
      }
      if (accepted.length > 0) {
        broadcastRoom(room, { type: 'voxel:batch_updated', deltas: accepted }, client.id);
      }
      break;
    }

    case 'voxel:set': {
      const bx = Math.floor(Number(msg.x));
      const by = Math.floor(Number(msg.y));
      const bz = Math.floor(Number(msg.z));
      if (!isWithinWorldBounds(bx, by, bz) || !VALID_TERRAIN_BLOCKS.has(msg.kind)) return;
      const townErr = getTownProtectionError(
        room.world.seed,
        bx,
        bz,
        msg.kind === 'air' ? 'mine blocks' : 'build'
      );
      if (townErr) {
        sendMsg(client, { type: 'notice', tone: 'claim_locked', message: townErr });
        sendMsg(client, { type: 'world:state', room: serializeRoom(room) });
        return;
      }
      const lockErr = getClaimAccessError(
        room.world.claims,
        bx,
        bz,
        identity,
        msg.kind === 'air' ? 'mine blocks here' : 'build here',
        'build'
      );
      if (lockErr) {
        sendMsg(client, { type: 'notice', tone: 'claim_locked', message: lockErr });
        sendMsg(client, { type: 'world:state', room: serializeRoom(room) });
        return;
      }
      const key = voxelKey(bx, by, bz);
      const delta = DOOR_KINDS.has(msg.kind)
        ? { x: bx, y: by, z: bz, kind: msg.kind, open: Boolean(msg.open) }
        : { x: bx, y: by, z: bz, kind: msg.kind };
      room.world.voxelDeltas[key] = delta;
      broadcastRoom(room, { type: 'voxel:updated', delta });
      break;
    }

    case 'door:toggle': {
      const bx = Math.floor(Number(msg.x));
      const by = Math.floor(Number(msg.y));
      const bz = Math.floor(Number(msg.z));
      const key = voxelKey(bx, by, bz);
      const existing = room.world.voxelDeltas[key];
      if (!existing || !DOOR_KINDS.has(existing.kind)) return;
      const lockErr = getClaimAccessError(
        room.world.claims,
        bx,
        bz,
        identity,
        'open this door',
        'useLevers'
      );
      if (lockErr) {
        sendMsg(client, { type: 'notice', tone: 'claim_locked', message: lockErr });
        return;
      }
      const next = { ...existing, open: !existing.open };
      room.world.voxelDeltas[key] = next;
      broadcastRoom(room, { type: 'voxel:updated', delta: next });
      break;
    }

    case 'cable:place': {
      const bx = Math.floor(Number(msg.x));
      const by = Math.floor(Number(msg.y));
      const bz = Math.floor(Number(msg.z));
      if (!isWithinWorldBounds(bx, by, bz)) return;
      const townErr = getTownProtectionError(room.world.seed, bx, bz, 'wire power cables');
      if (townErr) {
        sendMsg(client, { type: 'notice', tone: 'claim_locked', message: townErr });
        sendMsg(client, { type: 'cables:updated', cables: room.world.cables });
        return;
      }
      const lockErr = getClaimAccessError(
        room.world.claims,
        bx,
        bz,
        identity,
        'wire power cables here',
        'build'
      );
      if (lockErr) {
        sendMsg(client, { type: 'notice', tone: 'claim_locked', message: lockErr });
        sendMsg(client, { type: 'cables:updated', cables: room.world.cables });
        return;
      }
      const key = voxelKey(bx, by, bz);
      if (!room.world.cables.includes(key) && room.world.cables.length < 500) {
        room.world.cables = [...room.world.cables, key];
      }
      broadcastRoom(room, { type: 'cables:updated', cables: room.world.cables });
      break;
    }

    case 'cable:remove': {
      const bx = Math.floor(Number(msg.x));
      const by = Math.floor(Number(msg.y));
      const bz = Math.floor(Number(msg.z));
      const lockErr = getClaimAccessError(
        room.world.claims,
        bx,
        bz,
        identity,
        'remove power cables here',
        'build'
      );
      if (lockErr) {
        sendMsg(client, { type: 'notice', tone: 'claim_locked', message: lockErr });
        sendMsg(client, { type: 'cables:updated', cables: room.world.cables });
        return;
      }
      const key = voxelKey(bx, by, bz);
      room.world.cables = room.world.cables.filter((c) => c !== key);
      broadcastRoom(room, { type: 'cables:updated', cables: room.world.cables });
      break;
    }

    case 'machine:place': {
      const m = msg.machine;
      if (!m || !MACHINE_KINDS.has(m.kind)) return;
      const bx = Math.floor(Number(m.x));
      const by = Math.floor(Number(m.y));
      const bz = Math.floor(Number(m.z));
      if (!isWithinWorldBounds(bx, by, bz)) return;
      const townErr = getTownProtectionError(room.world.seed, bx, bz, 'place machines');
      if (townErr) {
        sendMsg(client, { type: 'notice', tone: 'claim_locked', message: townErr });
        sendMsg(client, { type: 'machines:updated', machines: room.world.machines });
        return;
      }
      const lockErr = getClaimAccessError(
        room.world.claims,
        bx,
        bz,
        identity,
        'place machines here',
        'build'
      );
      if (lockErr) {
        sendMsg(client, { type: 'notice', tone: 'claim_locked', message: lockErr });
        sendMsg(client, { type: 'machines:updated', machines: room.world.machines });
        return;
      }
      if (!room.world.machines.some((e) => e.id === m.id) && room.world.machines.length < 120) {
        room.world.machines = [
          ...room.world.machines,
          { ...m, x: bx, y: by, z: bz, ownerId: player.uid, ownerName: player.name },
        ];
      }
      broadcastRoom(room, { type: 'machines:updated', machines: room.world.machines });
      break;
    }

    case 'machine:remove': {
      const target = room.world.machines.find((m) => m.id === msg.machineId);
      if (!target) return;
      const isMachinePlacer =
        target.ownerId === player.uid ||
        (target.ownerId === 'system' && room.world.ownerId === player.uid);
      const claimAtMachine = findClaimAt(room.world.claims, target.x, target.z);
      const hasClaimBuildPerm =
        Boolean(claimAtMachine) &&
        canAccessPosition(room.world.claims, target.x, target.z, identity, 'build');
      if (!isMachinePlacer && !hasClaimBuildPerm) {
        sendMsg(client, {
          type: 'notice',
          tone: 'claim_locked',
          message: `Locked: Only ${target.ownerName || 'the player who placed this machine'} (or Trusted Friends with Build permission) can dismantle this machine.`,
        });
        sendMsg(client, { type: 'machines:updated', machines: room.world.machines });
        return;
      }
      room.world.machines = room.world.machines.filter((m) => m.id !== msg.machineId);
      broadcastRoom(room, { type: 'machines:updated', machines: room.world.machines });
      break;
    }

    case 'machine:update': {
      const incoming = msg.machine;
      const existing = room.world.machines.find((m) => m.id === incoming?.id);
      if (!existing) return;
      const isMachinePlacer =
        existing.ownerId === player.uid ||
        (existing.ownerId === 'system' && room.world.ownerId === player.uid);
      const claimAtMachine = findClaimAt(room.world.claims, existing.x, existing.z);
      const hasClaimMachinePerm =
        Boolean(claimAtMachine) &&
        canAccessPosition(room.world.claims, existing.x, existing.z, identity, 'toggleMachines');
      if (!isMachinePlacer && !hasClaimMachinePerm) {
        sendMsg(client, {
          type: 'notice',
          tone: 'claim_locked',
          message: `Locked: Only ${existing.ownerName || 'the player who placed this machine'} (or Trusted Friends with Toggle Machines permission) can control this machine.`,
        });
        sendMsg(client, { type: 'machines:updated', machines: room.world.machines });
        return;
      }
      room.world.machines = room.world.machines.map((m) =>
        m.id === existing.id
          ? {
              ...existing,
              enabled: Boolean(incoming.enabled),
              coalFuelSeconds: Math.max(0, Math.min(10000, Number(incoming.coalFuelSeconds) || 0)),
              coalBuffer: Math.max(0, Math.min(500, Math.floor(Number(incoming.coalBuffer) || 0))),
              selectedRecipeId: incoming.selectedRecipeId ?? existing.selectedRecipeId,
              augments: Array.isArray(incoming.augments) ? incoming.augments.slice(0, 3) : existing.augments,
              outputBuffer: incoming.outputBuffer || existing.outputBuffer,
            }
          : m
      );
      broadcastRoom(room, { type: 'machines:updated', machines: room.world.machines });
      break;
    }

    case 'storage:update': {
      if (msg.machineId) {
        const terminal = room.world.machines.find((m) => m.id === msg.machineId);
        if (terminal) {
          const lockErr = getClaimAccessError(
            room.world.claims,
            terminal.x,
            terminal.z,
            identity,
            'access this Storage Terminal',
            'openChests'
          );
          if (lockErr) {
            sendMsg(client, { type: 'notice', tone: 'claim_locked', message: lockErr });
            return;
          }
        }
      }
      const delta = Math.trunc(Number(msg.delta) || 0);
      if (!msg.itemId || delta === 0) return;
      const curr = room.world.storageInventory[msg.itemId] || 0;
      const next = Math.max(0, curr + delta);
      if (next === 0) delete room.world.storageInventory[msg.itemId];
      else room.world.storageInventory[msg.itemId] = next;
      broadcastRoom(room, {
        type: 'storage:updated',
        storageInventory: room.world.storageInventory,
      });
      break;
    }

    case 'storage:sync': {
      if (msg.storageInventory && typeof msg.storageInventory === 'object') {
        room.world.storageInventory = msg.storageInventory;
        broadcastRoom(
          room,
          {
            type: 'storage:updated',
            storageInventory: room.world.storageInventory,
          },
          client.id
        );
      }
      break;
    }

    case 'claim:create': {
      const c = msg.claim;
      if (!c) return;
      const { sizeX, sizeZ } = getClaimDimensions(c);
      const err = validateNewClaimOutsideSafeZones(
        room.world.claims,
        player.uid,
        Math.floor(c.minX),
        Math.floor(c.minZ),
        room.world.seed,
        sizeX,
        sizeZ
      );
      if (err) {
        sendMsg(client, { type: 'notice', tone: 'error', message: err });
        sendMsg(client, { type: 'claims:updated', claims: room.world.claims });
        sendMsg(client, { type: 'machines:updated', machines: room.world.machines });
        return;
      }
      const newClaim = {
        ...c,
        ownerId: player.uid,
        ownerName: player.name,
        minX: Math.floor(c.minX),
        minZ: Math.floor(c.minZ),
        sizeX,
        sizeZ,
        label: cleanStr(c.label, `${player.name}'s ${sizeX}×${sizeZ} Claim`, 36),
        trustedFriends: [],
        createdAtMs: Date.now(),
      };
      room.world.claims = [...room.world.claims, newClaim];
      if (msg.beaconMachine && !room.world.machines.some((m) => m.id === msg.beaconMachine!.id)) {
        room.world.machines = [
          ...room.world.machines,
          { ...msg.beaconMachine, ownerId: player.uid, ownerName: player.name },
        ];
        broadcastRoom(room, { type: 'machines:updated', machines: room.world.machines });
      }
      broadcastRoom(room, { type: 'claims:updated', claims: room.world.claims });
      pushSystemChat(room, `${player.name} claimed a ${sizeX}×${sizeZ} territory ("${newClaim.label}").`);
      break;
    }

    case 'claim:add_trusted': {
      const claim = room.world.claims.find((c) => c.id === msg.claimId);
      if (!claim) return;
      if (!isClaimOwner(claim, identity)) {
        sendMsg(client, {
          type: 'notice',
          tone: 'claim_locked',
          message: 'Only the claim creator can add Trusted Friends to this claim.',
        });
        return;
      }
      const friendName = cleanStr(msg.friend?.displayName, '', 32);
      const friendUid = cleanStr(msg.friend?.uid, '', 128);
      if (!friendName && !friendUid) return;
      if (claim.trustedFriends.length >= MAX_TRUSTED_FRIENDS) return;
      const exists = claim.trustedFriends.some(
        (f) =>
          (friendUid && f.uid === friendUid) ||
          (friendName && f.displayName.toLowerCase() === friendName.toLowerCase())
      );
      if (!exists) {
        const rawPerms = msg.friend?.permissions;
        claim.trustedFriends = [
          ...claim.trustedFriends,
          {
            uid: friendUid,
            displayName: friendName || friendUid.slice(0, 12),
            permissions: rawPerms
              ? {
                  toggleMachines: Boolean(rawPerms.toggleMachines),
                  build: Boolean(rawPerms.build),
                  openChests: Boolean(rawPerms.openChests),
                  useLevers: Boolean(rawPerms.useLevers),
                }
              : { ...DEFAULT_TRUSTED_PERMISSIONS },
          },
        ];
      }
      broadcastRoom(room, { type: 'claims:updated', claims: room.world.claims });
      pushSystemChat(room, `${player.name} added ${friendName || friendUid} as a Trusted Friend on "${claim.label}".`);
      break;
    }

    case 'claim:update_trusted_perms': {
      const claim = room.world.claims.find((c) => c.id === msg.claimId);
      if (!claim) return;
      if (!isClaimOwner(claim, identity)) {
        sendMsg(client, {
          type: 'notice',
          tone: 'claim_locked',
          message: 'Only the claim creator can edit Trusted Friend permissions.',
        });
        return;
      }
      const rawPerms = msg.permissions;
      if (!rawPerms || typeof rawPerms !== 'object') return;
      const nextPerms = {
        toggleMachines: Boolean(rawPerms.toggleMachines),
        build: Boolean(rawPerms.build),
        openChests: Boolean(rawPerms.openChests),
        useLevers: Boolean(rawPerms.useLevers),
      };
      claim.trustedFriends = claim.trustedFriends.map((f) => {
        const match =
          f.uid === msg.friendUid ||
          f.displayName.toLowerCase() === String(msg.friendUid || '').toLowerCase();
        return match ? { ...f, permissions: nextPerms } : f;
      });
      broadcastRoom(room, { type: 'claims:updated', claims: room.world.claims });
      break;
    }

    case 'claim:remove_trusted': {
      const claim = room.world.claims.find((c) => c.id === msg.claimId);
      if (!claim) return;
      if (!isClaimOwner(claim, identity)) {
        sendMsg(client, {
          type: 'notice',
          tone: 'claim_locked',
          message: 'Only the claim creator can remove Trusted Friends.',
        });
        return;
      }
      claim.trustedFriends = claim.trustedFriends.filter(
        (f) =>
          f.uid !== msg.friendUid &&
          f.displayName.toLowerCase() !== msg.friendUid.toLowerCase()
      );
      broadcastRoom(room, { type: 'claims:updated', claims: room.world.claims });
      break;
    }

    case 'claim:rename': {
      const claim = room.world.claims.find((c) => c.id === msg.claimId);
      if (!claim || !isClaimOwner(claim, identity)) return;
      claim.label = cleanStr(msg.label, claim.label, 36);
      broadcastRoom(room, { type: 'claims:updated', claims: room.world.claims });
      break;
    }

    case 'claim:delete': {
      const claim = room.world.claims.find((c) => c.id === msg.claimId);
      if (!claim) return;
      if (!isClaimOwner(claim, identity)) {
        sendMsg(client, {
          type: 'notice',
          tone: 'claim_locked',
          message: 'Only the claim creator can unclaim this 12×12 area.',
        });
        return;
      }
      room.world.claims = room.world.claims.filter((c) => c.id !== msg.claimId);
      room.world.machines = room.world.machines.filter(
        (m) => !(m.kind === 'claim_beacon' && m.x === claim.beaconX && m.z === claim.beaconZ)
      );
      broadcastRoom(room, { type: 'claims:updated', claims: room.world.claims });
      broadcastRoom(room, { type: 'machines:updated', machines: room.world.machines });
      break;
    }

    case 'world:settings': {
      if (room.hostClientId !== client.id && room.world.ownerId !== player.uid) return;
      if (msg.name) room.world.name = cleanStr(msg.name, room.world.name, 48);
      if (msg.mode === 'survival' || msg.mode === 'peaceful') room.world.mode = msg.mode;
      if (msg.accessMode === 'private' || msg.accessMode === 'friends' || msg.accessMode === 'public') {
        room.world.accessMode = msg.accessMode;
      }
      broadcastRoom(room, { type: 'world:state', room: serializeRoom(room) });
      break;
    }

    case 'world:sync_machines': {
      // Only the room host syncs periodic 1Hz machine simulation updates
      if (room.hostClientId !== client.id) return;
      if (Array.isArray(msg.machines)) {
        room.world.machines = msg.machines.slice(0, 120);
      }
      if (msg.storageInventory && typeof msg.storageInventory === 'object') {
        room.world.storageInventory = msg.storageInventory;
      }
      broadcastRoom(
        room,
        {
          type: 'machines:updated',
          machines: room.world.machines,
          storageInventory: room.world.storageInventory,
        },
        client.id
      );
      break;
    }

    case 'chat:send': {
      const now = Date.now();
      if (now - client.lastChatMs < 400) return;
      client.lastChatMs = now;
      const text = cleanStr(msg.text, '', 180);
      if (!text) return;
      const chatMsg: RoomChatMessage = {
        id: `c_${now}_${crypto.randomBytes(2).toString('hex')}`,
        senderUid: player.uid,
        senderName: player.name,
        text,
        timestampMs: now,
      };
      room.chat = [...room.chat.slice(-(MAX_CHAT_HISTORY - 1)), chatMsg];
      broadcastRoom(room, { type: 'chat:message', message: chatMsg });
      break;
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeWorlds: roomsByCode.size });
  });

  app.get('/api/worlds/live', (_req, res) => {
    const worlds: LiveWorldSummary[] = [];
    for (const room of roomsByCode.values()) {
      if (room.world.accessMode !== 'public') continue;
      worlds.push({
        worldId: room.world.id,
        inviteCode: room.world.inviteCode,
        name: room.world.name,
        ownerName: room.world.ownerName,
        mode: room.world.mode,
        accessMode: room.world.accessMode,
        playerCount: room.players.size,
        maxPlayers: MAX_PLAYERS_PER_WORLD,
        seed: room.world.seed,
        machineCount: room.world.machines.length,
        playerNames: Array.from(room.players.values()).map((p) => p.name),
      });
    }
    res.json({ worlds });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const noopWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let pathname = '/';
    try {
      const parsed = new URL(req.url || '/', 'http://localhost');
      pathname = parsed.pathname;
    } catch {
      pathname = (req.url || '/').split('?')[0];
    }

    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      // Cleanly accept any stray Vite client WebSocket upgrade so the browser
      // never logs "Error: WebSocket closed without opened".
      noopWss.handleUpgrade(req, socket, head, (ws) => {
        try {
          ws.send(JSON.stringify({ type: 'connected' }));
        } catch {
          // Ignore send errors on dummy HMR socket
        }
      });
    }
  });

  wss.on('connection', (ws) => {
    const clientId = `p_${crypto.randomBytes(5).toString('hex')}`;
    const client: ConnectedClient = {
      id: clientId,
      ws,
      inviteCode: null,
      uid: null,
      lastChatMs: 0,
    };
    clients.set(clientId, client);

    ws.on('message', (data) => {
      handleWsMessage(client, data.toString());
    });

    const cleanupSocket = () => {
      removeClientFromRoom(client);
      clients.delete(clientId);
    };

    ws.on('close', cleanupSocket);
    ws.on('error', cleanupSocket);
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    process.env.DISABLE_HMR = 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AetherCraft Voxel Sandbox server listening on http://localhost:${PORT}`);
  });
}

void startServer();
