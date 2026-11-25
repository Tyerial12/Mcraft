import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Cpu,
  Flame,
  Globe,
  Layers,
  Link2,
  LogIn,
  LogOut,
  Palette,
  Pickaxe,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Sprout,
  Trash2,
  Trees,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { getPickaxeMeta, PLAYER_CLASSES } from '../data/catalog';
import { fetchLivePublicWorlds } from '../services/multiplayerClient';
import { FullscreenToggleButton } from './FullscreenToggleButton';
import { PWAInstallButton } from './PWAInstallButton';
import type {
  CharacterAppearance,
  CharacterProfile,
  LiveWorldSummary,
  PlayerClassId,
  WorldAccessMode,
  WorldData,
  WorldMode,
} from '../types/game';

interface AuthHubProps {
  authLoading: boolean;
  isSignedIn: boolean;
  userEmail: string | null;
  authError: string | null;
  character: CharacterProfile | null;
  myWorlds: WorldData[];
  worldsLoading: boolean;
  initialInviteCode?: string;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSaveCharacter: (updated: CharacterProfile) => Promise<void>;
  onCreateWorld: (params: {
    name: string;
    seed: number;
    mode: WorldMode;
    accessMode: WorldAccessMode;
  }) => Promise<WorldData | null>;
  onDeleteWorld: (worldId: string) => Promise<void>;
  onUpdateWorldAccess: (world: WorldData, mode: WorldMode, accessMode: WorldAccessMode) => Promise<void>;
  onLaunchWorld: (world: WorldData, hostMultiplayer: boolean) => void;
  onJoinByCode: (inviteCode: string) => void;
}

const SKIN_PRESETS = ['#f4cbb2', '#e0ac8b', '#c68863', '#8d583a', '#593622', '#fcd9b6'];
const HAIR_PRESETS = ['#1e293b', '#451a03', '#92400e', '#d97706', '#e2e8f0', '#7c2d12'];
const SHIRT_PRESETS = ['#0284c7', '#d97706', '#059669', '#dc2626', '#7c3aed', '#334155', '#0d9488'];
const PANTS_PRESETS = ['#1e293b', '#312e81', '#3f3f46', '#422006', '#0f172a', '#374151'];
const ACCENT_PRESETS = ['#22d3ee', '#10b981', '#f59e0b', '#a855f7', '#f43f5e', '#facc15'];

type HubTab = 'factories' | 'multiplayer' | 'engineer';

export const AuthHub: React.FC<AuthHubProps> = ({
  authLoading,
  isSignedIn,
  userEmail,
  authError,
  character,
  myWorlds,
  worldsLoading,
  initialInviteCode = '',
  onSignInGoogle,
  onSignOut,
  onSaveCharacter,
  onCreateWorld,
  onDeleteWorld,
  onUpdateWorldAccess,
  onLaunchWorld,
  onJoinByCode,
}) => {
  const [activeTab, setActiveTab] = useState<HubTab>(() =>
    initialInviteCode ? 'multiplayer' : 'factories'
  );
  const [newWorldName, setNewWorldName] = useState('VeinForge Frontier Prime');
  const [newWorldSeed, setNewWorldSeed] = useState(() => Math.floor(Math.random() * 89999) + 10000);
  const [newWorldMode, setNewWorldMode] = useState<WorldMode>('survival');
  const [newWorldAccess, setNewWorldAccess] = useState<WorldAccessMode>('friends');
  const [creatingWorld, setCreatingWorld] = useState(false);

  const [inviteCodeInput, setInviteCodeInput] = useState(initialInviteCode);
  const [liveWorlds, setLiveWorlds] = useState<LiveWorldSummary[]>([]);
  const [loadingLiveWorlds, setLoadingLiveWorlds] = useState(false);

  const [charNameInput, setCharNameInput] = useState(character?.characterName || '');
  const [selectedClass, setSelectedClass] = useState<PlayerClassId>(
    character?.playerClass || 'engineer'
  );
  const [appearanceInput, setAppearanceInput] = useState<CharacterAppearance | null>(
    character?.appearance || null
  );
  const [savingRig, setSavingRig] = useState(false);
  const [rigSavedNotice, setRigSavedNotice] = useState(false);

  useEffect(() => {
    if (initialInviteCode) {
      setInviteCodeInput(initialInviteCode);
      setActiveTab('multiplayer');
    }
  }, [initialInviteCode]);

  useEffect(() => {
    if (character) {
      setCharNameInput(character.characterName);
      setSelectedClass(character.playerClass || 'engineer');
      setAppearanceInput({ ...character.appearance });
    }
  }, [character?.uid, character?.playerClass]);

  const refreshLiveWorlds = useCallback(async () => {
    setLoadingLiveWorlds(true);
    try {
      const list = await fetchLivePublicWorlds();
      setLiveWorlds(list);
    } finally {
      setLoadingLiveWorlds(false);
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    void refreshLiveWorlds();
    const timer = window.setInterval(() => {
      void refreshLiveWorlds();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [isSignedIn, refreshLiveWorlds]);

  const handleSaveCharEdit = async (e?: React.FormEvent, overrideClass?: PlayerClassId) => {
    if (e) e.preventDefault();
    if (!character || !appearanceInput || savingRig) return;
    const nextClass = overrideClass || selectedClass;
    setSavingRig(true);
    try {
      await onSaveCharacter({
        ...character,
        characterName: charNameInput.trim().slice(0, 28) || character.characterName,
        playerClass: nextClass,
        appearance: appearanceInput,
      });
      setRigSavedNotice(true);
      window.setTimeout(() => setRigSavedNotice(false), 2200);
    } finally {
      setSavingRig(false);
    }
  };

  const handleCreateAndPlay = async (hostMultiplayer: boolean) => {
    if (creatingWorld) return;
    setCreatingWorld(true);
    try {
      const effectiveAccess: WorldAccessMode =
        hostMultiplayer && newWorldAccess === 'private' ? 'friends' : newWorldAccess;
      const world = await onCreateWorld({
        name: newWorldName.trim() || 'VeinForge Frontier Prime',
        seed: Number(newWorldSeed) || 20260,
        mode: newWorldMode,
        accessMode: effectiveAccess,
      });
      if (world) {
        onLaunchWorld(world, hostMultiplayer);
      }
    } finally {
      setCreatingWorld(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inviteCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleaned) return;
    onJoinByCode(cleaned);
  };

  const renderClassIcon = (id: PlayerClassId) => {
    switch (id) {
      case 'farmer':
        return <Sprout className="w-4 h-4" />;
      case 'lumberjack':
        return <Trees className="w-4 h-4" />;
      case 'engineer':
        return <Cpu className="w-4 h-4" />;
      case 'miner':
        return <Pickaxe className="w-4 h-4" />;
    }
  };

  const activeClassSpec =
    PLAYER_CLASSES.find((c) => c.id === selectedClass) || PLAYER_CLASSES[2];

  return (
    <div className="h-dvh w-full bg-[#0b0f17] text-[#f3f5f8] flex flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y safe-pt safe-pb safe-pl safe-pr">
      {/* Responsive Top Bar: 3-zone single row on md+, clean 2-row layout on mobile phones */}
      <header className="w-full border-b border-white/10 bg-[#0d121c]/95 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-13 sm:h-16 flex items-center justify-between gap-2 sm:gap-6">
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-display text-sm sm:text-lg font-bold tracking-tight text-white truncate">
              VeinForge: Voxel Frontier
            </div>
            <span className="hidden lg:inline-block text-[11px] font-mono text-[#22d3ee] shrink-0">
              · Endless World
            </span>
          </div>

          {isSignedIn && (
            <nav className="hidden md:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('factories')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === 'factories'
                    ? 'bg-white/10 text-white'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                My Worlds
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('multiplayer');
                  void refreshLiveWorlds();
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'multiplayer'
                    ? 'bg-[#22d3ee]/18 text-[#22d3ee]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Multiplayer
                {liveWorlds.length > 0 && (
                  <span className="font-mono text-[11px] text-[#34d399]">
                    ({liveWorlds.length})
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('engineer')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'engineer'
                    ? 'bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/40'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                Character &amp; Class
              </button>
            </nav>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <FullscreenToggleButton variant="hub" />
            <PWAInstallButton />
            {isSignedIn && (
              <button
                type="button"
                onClick={() => void onSignOut()}
                title={userEmail ? `Sign out (${userEmail})` : 'Sign Out'}
                className="rounded-lg border border-white/12 bg-white/5 hover:border-[#ef4444]/60 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[#e2e8f0] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Full-Width 3-Tab Bar (Fits 100% cleanly on narrow phones) */}
        {isSignedIn && (
          <nav className="md:hidden border-t border-white/8 px-2.5 py-1.5 grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('factories')}
              className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold text-center truncate transition-colors cursor-pointer ${
                activeTab === 'factories'
                  ? 'bg-white/12 text-white'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              My Worlds
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('multiplayer');
                void refreshLiveWorlds();
              }}
              className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 truncate transition-colors cursor-pointer ${
                activeTab === 'multiplayer'
                  ? 'bg-[#22d3ee]/18 text-[#22d3ee]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <Users className="w-3 h-3 shrink-0" />
              <span className="truncate">
                Co-op{liveWorlds.length > 0 ? ` (${liveWorlds.length})` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('engineer')}
              className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 truncate transition-colors cursor-pointer ${
                activeTab === 'engineer'
                  ? 'bg-[#10b981]/20 text-[#34d399]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <Palette className="w-3 h-3 shrink-0" />
              <span className="truncate">Class &amp; Rig</span>
            </button>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto flex-1 px-3 sm:px-6 py-4 sm:py-8">
        {!isSignedIn ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4 sm:py-8">
            <div className="lg:col-span-7 space-y-5">
              <div className="text-xs font-mono text-[#22d3ee]">
                VeinForge: Voxel Frontier · Endless 3D Survival, Classes &amp; Co-op Automation
              </div>
              <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.12] text-white">
                Explore an Endless Voxel World, Choose Your Class &amp; Automate Together.
              </h1>
              <p className="text-sm sm:text-base text-[#94a3b8] leading-relaxed max-w-2xl">
                Customize your voxel character, pick your class (Farmer, Lumberjack, Engineer, or
                Miner), claim 2-chunk territories with granular Trusted Friend permissions, hire
                workers for 1,000 Coins, and build automated factories across an endless 3D world.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 text-xs">
                <div className="rounded-xl border border-white/10 bg-[#111723] p-4 space-y-1.5">
                  <div className="font-semibold text-[#f59e0b] flex items-center gap-1.5">
                    <Flame className="w-4 h-4" />
                    4 Classes &amp; Hired Workers
                  </div>
                  <p className="text-[#94a3b8] leading-relaxed">
                    Specialize as Farmer, Lumberjack, Engineer, or Miner and hire autonomous workers
                    with food upkeep.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#111723] p-4 space-y-1.5">
                  <div className="font-semibold text-[#10b981] flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    Endless World &amp; 2-Chunk Claims
                  </div>
                  <p className="text-[#94a3b8] leading-relaxed">
                    Explore infinite procedural terrain, dungeon spawners, and lock down 2-chunk
                    bases with per-friend permissions.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#111723] p-4 space-y-1.5">
                  <div className="font-semibold text-[#22d3ee] flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Live Co-op Servers
                  </div>
                  <p className="text-[#94a3b8] leading-relaxed">
                    Host public or invite-code sessions with shared storage drives, player trade
                    boards, and team chat.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="mc-panel p-6 sm:p-7 space-y-5">
                <div className="space-y-1.5">
                  <h2 className="font-display text-xl font-bold text-white">
                    Frontier Cloud Sign-In
                  </h2>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">
                    Sign in with Google to customize your character &amp; class, save your endless
                    worlds to Firestore, or join a friend&apos;s server.
                  </p>
                </div>

                {initialInviteCode && (
                  <div className="rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-3.5 py-2.5 text-xs text-[#bae6fd]">
                    Invite code <strong className="font-mono text-white">{initialInviteCode}</strong>{' '}
                    detected — sign in to join right away.
                  </div>
                )}

                {authError && (
                  <div className="rounded-lg border border-[#ef4444]/60 bg-[#ef4444]/10 p-3 text-xs text-[#fca5a5]">
                    {authError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => void onSignInGoogle()}
                  className="w-full rounded-xl bg-[#22d3ee] hover:bg-[#38bdf8] disabled:opacity-50 py-3 px-4 font-display font-bold text-sm text-[#06131a] inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  {authLoading ? 'Connecting Account...' : 'Sign In with Google'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Quick Character & Class Summary Bar on Worlds Tab */}
            {activeTab === 'factories' && character && appearanceInput && (
              <div className="mb-6 rounded-xl border border-white/12 bg-[#111723] p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {/* Mini Voxel Avatar Preview */}
                  <div className="w-12 h-12 rounded-xl border border-white/20 bg-[#0b0f17] flex flex-col items-center justify-center p-1 shrink-0">
                    <div
                      className="w-4 h-1.5 rounded-t-sm"
                      style={{ backgroundColor: appearanceInput.hairColor }}
                    />
                    <div
                      className="w-4 h-3.5 relative flex items-center justify-center"
                      style={{ backgroundColor: appearanceInput.skinColor }}
                    >
                      <div
                        className="w-3 h-1"
                        style={{ backgroundColor: appearanceInput.accentColor }}
                      />
                    </div>
                    <div
                      className="w-5 h-3"
                      style={{ backgroundColor: appearanceInput.shirtColor }}
                    />
                    <div
                      className="w-4 h-2"
                      style={{ backgroundColor: appearanceInput.pantsColor }}
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-bold text-white">
                        {character.characterName}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-bold border"
                        style={{
                          borderColor: activeClassSpec.accentColor,
                          color: activeClassSpec.accentColor,
                          backgroundColor: `${activeClassSpec.accentColor}1a`,
                        }}
                      >
                        {renderClassIcon(activeClassSpec.id)}
                        {activeClassSpec.name} Class
                      </span>
                    </div>
                    <div className="text-xs text-[#94a3b8] mt-0.5">
                      {activeClassSpec.tagline} · Per-World Progression (Level, Coins &amp; Workers reset in New Worlds)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('engineer')}
                  className="rounded-lg border border-[#10b981]/50 bg-[#10b981]/15 hover:bg-[#10b981]/25 px-3.5 py-2 text-xs font-semibold text-[#34d399] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Customize Character &amp; Class
                </button>
              </div>
            )}

            {/* TAB 1: MY WORLDS (Create & Launch Solo or Host Co-op) */}
            {activeTab === 'factories' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Create New World Panel */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="mc-panel p-5 space-y-4">
                    <div>
                      <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#10b981]" />
                        New Endless VeinForge World
                      </h2>
                      <p className="text-xs text-[#94a3b8] mt-0.5">
                        Explore an endless procedural voxel world, gather resources with your class
                        bonuses, claim 2-chunk territories, and automate machines.
                      </p>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-[#cbd5e1] font-medium mb-1">World Name</label>
                        <input
                          type="text"
                          value={newWorldName}
                          onChange={(e) => setNewWorldName(e.target.value)}
                          maxLength={40}
                          className="w-full rounded-lg border border-white/12 bg-[#0b0f17] px-3 py-2 text-white focus:outline-none focus:border-[#22d3ee]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#cbd5e1] font-medium mb-1">World Seed</label>
                          <input
                            type="number"
                            value={newWorldSeed}
                            onChange={(e) => setNewWorldSeed(Number(e.target.value))}
                            className="w-full rounded-lg border border-white/12 bg-[#0b0f17] px-3 py-2 font-mono text-white focus:outline-none focus:border-[#22d3ee]"
                          />
                        </div>
                        <div>
                          <label className="block text-[#cbd5e1] font-medium mb-1">Visibility</label>
                          <select
                            value={newWorldAccess}
                            onChange={(e) => setNewWorldAccess(e.target.value as WorldAccessMode)}
                            className="w-full rounded-lg border border-white/12 bg-[#0b0f17] px-2.5 py-2 text-white focus:outline-none focus:border-[#22d3ee]"
                          >
                            <option value="friends">Friends (Code)</option>
                            <option value="public">Public Browser</option>
                            <option value="private">Private Solo</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#cbd5e1] font-medium mb-1">Gameplay Mode</label>
                        <select
                          value={newWorldMode}
                          onChange={(e) => setNewWorldMode(e.target.value as WorldMode)}
                          className="w-full rounded-lg border border-white/12 bg-[#0b0f17] px-3 py-2 text-white focus:outline-none focus:border-[#22d3ee]"
                        >
                          <option value="survival">Survival Progression (Hunger, Mobs, Classes &amp; Tech)</option>
                          <option value="peaceful">Creative Sandbox (Infinite Resources &amp; Tech)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={creatingWorld}
                        onClick={() => void handleCreateAndPlay(false)}
                        className="rounded-lg border border-white/15 bg-white/6 hover:bg-white/12 disabled:opacity-50 py-2.5 px-3 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {creatingWorld ? 'Creating...' : 'Create & Play Solo'}
                      </button>
                      <button
                        type="button"
                        disabled={creatingWorld}
                        onClick={() => void handleCreateAndPlay(true)}
                        className="rounded-lg bg-[#22d3ee] hover:bg-[#38bdf8] disabled:opacity-50 py-2.5 px-3 text-xs font-display font-bold text-[#06131a] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        {creatingWorld ? 'Creating...' : 'Create & Host Co-op'}
                      </button>
                    </div>
                  </div>

                  {/* Quick Jump to Multiplayer */}
                  <div className="rounded-xl border border-[#22d3ee]/25 bg-[#101827] p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Have a Friend&apos;s Invite Code?
                      </div>
                      <div className="text-[11px] text-[#94a3b8] mt-0.5">
                        {liveWorlds.length > 0
                          ? `${liveWorlds.length} public server${liveWorlds.length === 1 ? '' : 's'} live right now`
                          : 'Join a friend’s world or browse public co-op servers.'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('multiplayer')}
                      className="rounded-lg border border-[#22d3ee]/50 bg-[#22d3ee]/12 hover:bg-[#22d3ee]/22 px-3 py-2 text-xs font-semibold text-[#22d3ee] whitespace-nowrap cursor-pointer"
                    >
                      Open Lobby
                    </button>
                  </div>
                </div>

                {/* Saved Cloud Worlds List */}
                <div className="lg:col-span-7">
                  <div className="mc-panel p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-[#22d3ee]" />
                        Saved Cloud Worlds ({myWorlds.length})
                      </h2>
                      <span className="text-xs text-[#94a3b8]">Endless Procedural Terrain · Synced</span>
                    </div>

                    {worldsLoading ? (
                      <div className="py-10 text-center text-xs text-[#94a3b8]">
                        Loading your saved worlds...
                      </div>
                    ) : myWorlds.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/12 py-10 px-4 text-center text-xs text-[#94a3b8]">
                        No worlds saved yet. Create your first endless VeinForge world on the left to
                        play solo or host a live co-op session.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {myWorlds.map((w) => {
                          const meCount = Object.values(w.storageInventory || {}).reduce(
                            (a, b) => a + (b || 0),
                            0
                          );
                          return (
                            <div
                              key={w.id}
                              className="rounded-xl border border-white/10 bg-[#121826] p-4 space-y-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-display text-sm font-bold text-white truncate">
                                    {w.name}
                                  </div>
                                  <div className="text-xs text-[#94a3b8] font-mono mt-0.5 tabular-nums">
                                    Code <span className="text-[#22d3ee]">{w.inviteCode}</span> · Seed{' '}
                                    {w.seed} · {w.machines.length} Machines · {w.cables.length}{' '}
                                    Conduits · {meCount} Stored Items
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => void onDeleteWorld(w.id)}
                                  title="Delete World"
                                  aria-label="Delete World"
                                  className="p-1.5 rounded-lg text-[#64748b] hover:text-[#ef4444] hover:bg-white/5 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/8">
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={w.mode}
                                    onChange={(e) =>
                                      void onUpdateWorldAccess(
                                        w,
                                        e.target.value as WorldMode,
                                        w.accessMode
                                      )
                                    }
                                    aria-label="World Mode"
                                    className="rounded-lg border border-white/12 bg-[#0b0f17] px-2.5 py-1.5 text-xs text-[#e2e8f0]"
                                  >
                                    <option value="survival">Survival</option>
                                    <option value="peaceful">Creative</option>
                                  </select>

                                  <select
                                    value={w.accessMode}
                                    onChange={(e) =>
                                      void onUpdateWorldAccess(
                                        w,
                                        w.mode,
                                        e.target.value as WorldAccessMode
                                      )
                                    }
                                    aria-label="Multiplayer Visibility"
                                    className="rounded-lg border border-white/12 bg-[#0b0f17] px-2.5 py-1.5 text-xs text-[#e2e8f0]"
                                  >
                                    <option value="private">Private</option>
                                    <option value="friends">Friends Code</option>
                                    <option value="public">Public Server</option>
                                  </select>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onLaunchWorld(w, false)}
                                    className="rounded-lg border border-white/15 bg-white/6 hover:bg-white/12 px-3 py-1.5 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                    Solo
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const hostWorld =
                                        w.accessMode === 'private'
                                          ? { ...w, accessMode: 'friends' as WorldAccessMode }
                                          : w;
                                      if (w.accessMode === 'private') {
                                        void onUpdateWorldAccess(w, w.mode, 'friends');
                                      }
                                      onLaunchWorld(hostWorld, true);
                                    }}
                                    className="rounded-lg bg-[#22d3ee] hover:bg-[#38bdf8] px-3.5 py-1.5 text-xs font-semibold text-[#06131a] inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Radio className="w-3.5 h-3.5" />
                                    Host Co-op
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MULTIPLAYER SERVER BROWSER & JOIN BY CODE */}
            {activeTab === 'multiplayer' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Join by Invite Code */}
                <div className="lg:col-span-5 space-y-4">
                  <form onSubmit={handleJoinSubmit} className="mc-panel p-5 space-y-4">
                    <div>
                      <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-[#22d3ee]" />
                        Join Friend&apos;s World by Code
                      </h2>
                      <p className="text-xs text-[#94a3b8] mt-0.5">
                        Enter a 6-character invite code shared by a host to jump directly into their
                        live 3D world session.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-[#cbd5e1]">
                        Invite Code
                      </label>
                      <input
                        type="text"
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                        placeholder="e.g. A7K9P2"
                        maxLength={12}
                        className="w-full rounded-lg border border-white/15 bg-[#0b0f17] px-3.5 py-2.5 font-mono text-base tracking-[0.2em] text-[#22d3ee] placeholder-[#475569] uppercase focus:outline-none focus:border-[#22d3ee]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!inviteCodeInput.trim()}
                      className="w-full rounded-lg bg-[#22d3ee] hover:bg-[#38bdf8] disabled:opacity-40 py-2.5 px-4 font-display font-bold text-sm text-[#06131a] inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      Join Live World
                    </button>
                  </form>

                  <div className="rounded-xl border border-white/10 bg-[#111723] p-4 space-y-2 text-xs">
                    <div className="font-semibold text-white">How Co-op Sync Works</div>
                    <ul className="space-y-1.5 text-[#94a3b8]">
                      <li>• Up to 8 players share one real-time endless 3D world via WebSockets.</li>
                      <li>• Claim 2-chunk territories and configure per-friend permissions (Machines, Build, Chests, Levers).</li>
                      <li>• Post item &amp; coin trades on the Co-op Trade Board and team chat in real time.</li>
                    </ul>
                  </div>
                </div>

                {/* Live Public Servers Browser */}
                <div className="lg:col-span-7">
                  <div className="mc-panel p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                          <Globe className="w-4 h-4 text-[#10b981]" />
                          Live Public VeinForge Servers ({liveWorlds.length})
                        </h2>
                        <p className="text-xs text-[#94a3b8] mt-0.5">
                          Auto-refreshes every 6 seconds from the live multiplayer server.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshLiveWorlds()}
                        disabled={loadingLiveWorlds}
                        className="rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-medium text-[#e2e8f0] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${loadingLiveWorlds ? 'animate-spin' : ''}`}
                        />
                        Refresh
                      </button>
                    </div>

                    {liveWorlds.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/12 py-12 px-5 text-center space-y-3">
                        <div className="text-sm font-semibold text-white">
                          No Public Servers Open Right Now
                        </div>
                        <p className="text-xs text-[#94a3b8] max-w-sm mx-auto">
                          Switch to My Worlds and click &ldquo;Host Co-op&rdquo; with visibility
                          set to Public Server to start one immediately.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('factories')}
                          className="rounded-lg bg-[#10b981] hover:bg-[#34d399] px-4 py-2 text-xs font-semibold text-[#06130e] cursor-pointer"
                        >
                          Host a Public World
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {liveWorlds.map((srv) => (
                          <div
                            key={srv.inviteCode}
                            className="rounded-xl border border-white/10 bg-[#121826] p-4 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" />
                                <span className="font-display text-sm font-bold text-white truncate">
                                  {srv.name}
                                </span>
                                <span className="font-mono text-xs text-[#22d3ee]">
                                  {srv.inviteCode}
                                </span>
                              </div>
                              <div className="text-xs text-[#94a3b8] font-mono tabular-nums">
                                Host {srv.ownerName} ·{' '}
                                {srv.mode === 'peaceful' ? 'Creative' : 'Survival'} ·{' '}
                                {srv.playerCount}/{srv.maxPlayers} Players
                                {typeof srv.machineCount === 'number'
                                  ? ` · ${srv.machineCount} Machines`
                                  : ''}
                              </div>
                              {srv.playerNames && srv.playerNames.length > 0 && (
                                <div className="text-[11px] text-[#64748b] truncate">
                                  Online: {srv.playerNames.join(', ')}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={srv.playerCount >= srv.maxPlayers}
                              onClick={() => onJoinByCode(srv.inviteCode)}
                              className="rounded-lg bg-[#10b981] hover:bg-[#34d399] disabled:opacity-40 px-4 py-2 text-xs font-semibold text-[#06130e] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <Play className="w-3.5 h-3.5" />
                              {srv.playerCount >= srv.maxPlayers ? 'Full' : 'Join Server'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CHARACTER CUSTOMIZER & PLAYER CLASS SELECTION */}
            {activeTab === 'engineer' && character && appearanceInput && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Voxel Character Appearance Customizer */}
                <form
                  onSubmit={(e) => void handleSaveCharEdit(e)}
                  className="lg:col-span-5 mc-panel p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Live 2D Voxel Character Rig Preview */}
                      <div className="w-16 h-20 rounded-xl border border-white/20 bg-[#0b0f17] flex flex-col items-center justify-center p-1.5 shrink-0">
                        <div
                          className="w-6 h-2 rounded-t-sm"
                          style={{ backgroundColor: appearanceInput.hairColor }}
                        />
                        <div
                          className="w-6 h-5 relative flex items-center justify-center"
                          style={{ backgroundColor: appearanceInput.skinColor }}
                        >
                          <div
                            className="w-4 h-1.5"
                            style={{ backgroundColor: appearanceInput.accentColor }}
                          />
                        </div>
                        <div
                          className="w-8 h-5 rounded-sm"
                          style={{ backgroundColor: appearanceInput.shirtColor }}
                        />
                        <div
                          className="w-6 h-4"
                          style={{ backgroundColor: appearanceInput.pantsColor }}
                        />
                      </div>
                      <div>
                        <h2 className="font-display text-base font-bold text-white">
                          {charNameInput || character.characterName}
                        </h2>
                        <div className="font-mono text-xs text-[#22d3ee]">
                          {activeClassSpec.name} Class · {activeClassSpec.title}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs pt-2 border-t border-white/10">
                    <div>
                      <label className="block text-[#cbd5e1] font-medium mb-1">
                        Character Display Name
                      </label>
                      <input
                        type="text"
                        value={charNameInput}
                        onChange={(e) => setCharNameInput(e.target.value)}
                        maxLength={28}
                        className="w-full rounded-lg border border-white/12 bg-[#0b0f17] px-3 py-2 text-white focus:outline-none focus:border-[#22d3ee]"
                      />
                    </div>

                    <div>
                      <span className="block text-[#cbd5e1] font-medium mb-1.5">Skin Tone</span>
                      <div className="flex flex-wrap gap-2">
                        {SKIN_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setAppearanceInput({ ...appearanceInput, skinColor: c })}
                            className={`w-7 h-7 rounded-lg border-2 cursor-pointer transition-transform ${
                              appearanceInput.skinColor === c
                                ? 'border-white scale-110'
                                : 'border-black/40'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[#cbd5e1] font-medium mb-1.5">Hair Color</span>
                      <div className="flex flex-wrap gap-2">
                        {HAIR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setAppearanceInput({ ...appearanceInput, hairColor: c })}
                            className={`w-7 h-7 rounded-lg border-2 cursor-pointer transition-transform ${
                              appearanceInput.hairColor === c
                                ? 'border-white scale-110'
                                : 'border-black/40'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[#cbd5e1] font-medium mb-1.5">
                        Jumpsuit / Tunic Color
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SHIRT_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setAppearanceInput({ ...appearanceInput, shirtColor: c })}
                            className={`w-7 h-7 rounded-lg border-2 cursor-pointer transition-transform ${
                              appearanceInput.shirtColor === c
                                ? 'border-white scale-110'
                                : 'border-black/40'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[#cbd5e1] font-medium mb-1.5">Trousers Color</span>
                      <div className="flex flex-wrap gap-2">
                        {PANTS_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setAppearanceInput({ ...appearanceInput, pantsColor: c })}
                            className={`w-7 h-7 rounded-lg border-2 cursor-pointer transition-transform ${
                              appearanceInput.pantsColor === c
                                ? 'border-white scale-110'
                                : 'border-black/40'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[#cbd5e1] font-medium mb-1.5">
                        Visor &amp; Trim Accent Color
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {ACCENT_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              setAppearanceInput({ ...appearanceInput, accentColor: c })
                            }
                            className={`w-7 h-7 rounded-lg border-2 cursor-pointer transition-transform ${
                              appearanceInput.accentColor === c
                                ? 'border-white scale-110'
                                : 'border-black/40'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-[#10b981]">
                      {rigSavedNotice ? 'Character & Class saved to cloud!' : ''}
                    </span>
                    <button
                      type="submit"
                      disabled={savingRig}
                      className="rounded-lg bg-[#10b981] hover:bg-[#34d399] disabled:opacity-50 px-4 py-2 text-xs font-semibold text-[#06130e] cursor-pointer"
                    >
                      {savingRig ? 'Saving...' : 'Save Character & Class'}
                    </button>
                  </div>
                </form>

                {/* Right Column: Choose Your Player Class (Farmer, Lumberjack, Engineer, Miner) */}
                <div className="lg:col-span-7 mc-panel p-5 space-y-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#f59e0b]" />
                      Choose Your Character Class &amp; Special Bonuses
                    </h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">
                      Each class unlocks special passive bonuses in the endless world. Click any
                      class below to select and save it.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {PLAYER_CLASSES.map((cls) => {
                      const isSelected = cls.id === selectedClass;
                      return (
                        <div
                          key={cls.id}
                          onClick={() => {
                            setSelectedClass(cls.id);
                            void handleSaveCharEdit(undefined, cls.id);
                          }}
                          className={`rounded-xl border p-4 flex flex-col justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-[#10b981] bg-[#10b981]/12'
                              : 'border-white/10 bg-[#121826] hover:border-white/25'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="p-2 rounded-lg border"
                                  style={{
                                    borderColor: cls.accentColor,
                                    color: cls.accentColor,
                                    backgroundColor: `${cls.accentColor}1a`,
                                  }}
                                >
                                  {renderClassIcon(cls.id)}
                                </span>
                                <div>
                                  <div className="font-display text-sm font-bold text-white">
                                    {cls.name}
                                  </div>
                                  <div
                                    className="text-[11px] font-medium"
                                    style={{ color: cls.accentColor }}
                                  >
                                    {cls.title}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="inline-flex items-center gap-1 rounded bg-[#10b981] px-2 py-0.5 text-[10px] font-mono font-bold text-[#06130e]">
                                  <Check className="w-3 h-3" />
                                  ACTIVE
                                </span>
                              )}
                            </div>

                            <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 text-[11px] text-[#cbd5e1]">
                              {cls.bonuses.map((b, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span
                                    className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: cls.accentColor }}
                                  />
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClass(cls.id);
                              void handleSaveCharEdit(undefined, cls.id);
                            }}
                            className={`mt-3 w-full rounded-lg py-1.5 text-xs font-semibold cursor-pointer ${
                              isSelected
                                ? 'bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/40'
                                : 'bg-white/8 text-white hover:bg-[#10b981] hover:text-[#06130e]'
                            }`}
                          >
                            {isSelected ? `Selected: ${cls.name}` : `Choose ${cls.name} Class`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
