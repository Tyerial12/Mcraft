import React, { useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  Link2,
  Lock,
  MapPin,
  Navigation,
  Radio,
  Users,
  X,
} from 'lucide-react';
import type { WsConnectionStatus } from '../services/multiplayerClient';
import type { RemotePlayer, WorldAccessMode, WorldData } from '../types/game';

interface MultiplayerModalProps {
  world: WorldData;
  localUid: string;
  isMultiplayer: boolean;
  isHost: boolean;
  connectionStatus: WsConnectionStatus;
  remotePlayers: RemotePlayer[];
  playerPos: { x: number; y: number; z: number };
  onClose: () => void;
  onStartHostingLive: (accessMode: WorldAccessMode) => Promise<void>;
  onUpdateAccessMode: (accessMode: WorldAccessMode) => void;
  onTeleportToPlayer: (player: RemotePlayer) => void;
  onShareLocationInChat: () => void;
  onDisconnectMultiplayer: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  world,
  localUid,
  isMultiplayer,
  isHost,
  connectionStatus,
  remotePlayers,
  playerPos,
  onClose,
  onStartHostingLive,
  onUpdateAccessMode,
  onTeleportToPlayer,
  onShareLocationInChat,
  onDisconnectMultiplayer,
}) => {
  const [selectedStartAccess, setSelectedStartAccess] = useState<WorldAccessMode>(
    world.accessMode === 'private' ? 'friends' : world.accessMode
  );
  const [hostingBusy, setHostingBusy] = useState(false);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(world.inviteCode)}`
      : `?join=${world.inviteCode}`;

  const copyText = async (text: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(kind);
      window.setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // Fallback if clipboard API blocked in iframe
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedType(kind);
      window.setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleGoLive = async () => {
    if (hostingBusy) return;
    setHostingBusy(true);
    try {
      await onStartHostingLive(selectedStartAccess);
    } finally {
      setHostingBusy(false);
    }
  };

  const teammates = remotePlayers.filter((p) => p.uid !== localUid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-1.5 sm:p-5 safe-pt safe-pb safe-pl safe-pr">
      <div className="mc-panel w-full max-w-xl max-h-[94dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden text-[#f3f5f8]">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 sm:gap-3 border-b border-white/10 px-3 sm:px-5 py-2.5 sm:py-4 bg-[#0d121c]">
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#22d3ee] shrink-0" />
              <span className="truncate">Co-op Factory Session</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-[#94a3b8] mt-0.5 truncate">
              {world.name} · Shared AE2 ME Drive, Conduits &amp; 3D Factory Sync
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Multiplayer Panel"
            className="p-1.5 sm:p-2 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/5 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-3 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto overscroll-contain touch-pan-y">
          {!isMultiplayer ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#121826] p-4 space-y-3">
                <div className="text-sm font-semibold text-white">
                  Currently Playing Offline Solo
                </div>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Open this factory to live WebSocket multiplayer without losing your place. Up to 8
                  engineers can build on the same 9×9 workshop, share the AE2 ME Drive, and see each
                  other&apos;s Mining Gadget lasers in real time.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedStartAccess('friends')}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      selectedStartAccess === 'friends'
                        ? 'border-[#22d3ee] bg-[#22d3ee]/12 text-white'
                        : 'border-white/10 bg-[#0d121c] text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Link2 className="w-3.5 h-3.5 text-[#22d3ee]" />
                      Friends Only (Invite Code)
                    </div>
                    <div className="text-[11px] text-[#94a3b8] mt-1">
                      Hidden from public browser. Join via 6-character code or link.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStartAccess('public')}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      selectedStartAccess === 'public'
                        ? 'border-[#10b981] bg-[#10b981]/12 text-white'
                        : 'border-white/10 bg-[#0d121c] text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Globe className="w-3.5 h-3.5 text-[#10b981]" />
                      Public Server Browser
                    </div>
                    <div className="text-[11px] text-[#94a3b8] mt-1">
                      Listed live in the Multiplayer Lobby for anyone to join.
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={hostingBusy}
                  onClick={() => void handleGoLive()}
                  className="w-full mt-2 rounded-lg bg-[#22d3ee] hover:bg-[#38bdf8] disabled:opacity-50 py-2.5 px-4 text-sm font-display font-bold text-[#07131a] inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Radio className="w-4 h-4" />
                  {hostingBusy ? 'Opening Live Server...' : 'Host Live Co-op Session Now'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Live Invite Code & Share Link */}
              <div className="rounded-xl border border-[#22d3ee]/30 bg-[#101827] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#cbd5e1]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        connectionStatus === 'connected'
                          ? 'bg-[#10b981]'
                          : connectionStatus === 'reconnecting'
                            ? 'bg-[#f59e0b]'
                            : 'bg-[#ef4444]'
                      }`}
                    />
                    <span>
                      {connectionStatus === 'connected'
                        ? isHost
                          ? 'Hosting Live Co-op Server'
                          : 'Connected to Live Co-op Server'
                        : connectionStatus === 'reconnecting'
                          ? 'Reconnecting to Server...'
                          : 'Disconnected'}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#94a3b8] tabular-nums">
                    {remotePlayers.length} / 8 Engineers Online
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#0b101a] border border-white/10 px-3.5 py-2.5">
                  <div>
                    <div className="text-[11px] text-[#94a3b8]">Factory Invite Code</div>
                    <div className="font-mono text-xl font-bold tracking-[0.18em] text-[#22d3ee]">
                      {world.inviteCode}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(world.inviteCode, 'code')}
                      className="rounded-lg border border-white/15 bg-[#162033] hover:bg-[#1e2c45] px-3 py-2 text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedType === 'code' ? (
                        <Check className="w-3.5 h-3.5 text-[#10b981]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#22d3ee]" />
                      )}
                      {copiedType === 'code' ? 'Copied' : 'Copy Code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyText(inviteUrl, 'link')}
                      className="rounded-lg bg-[#22d3ee] hover:bg-[#38bdf8] px-3 py-2 text-xs font-semibold text-[#06131a] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedType === 'link' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5" />
                      )}
                      {copiedType === 'link' ? 'Link Copied' : 'Copy Invite Link'}
                    </button>
                  </div>
                </div>

                {isHost && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-[#94a3b8]">Room Visibility</span>
                    <div className="inline-flex rounded-lg bg-[#0b101a] p-1 border border-white/10">
                      {(
                        [
                          { id: 'private', label: 'Private', icon: Lock },
                          { id: 'friends', label: 'Friends', icon: Link2 },
                          { id: 'public', label: 'Public', icon: Globe },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const active = world.accessMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onUpdateAccessMode(opt.id)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors ${
                              active
                                ? 'bg-[#1f2c42] text-white'
                                : 'text-[#94a3b8] hover:text-white'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Connected Engineers Roster */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#cbd5e1]">
                    Engineers in World ({remotePlayers.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      onShareLocationInChat();
                      onClose();
                    }}
                    className="text-xs font-medium text-[#22d3ee] hover:text-[#67e8f9] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Ping My Coords ({Math.floor(playerPos.x)}, {Math.floor(playerPos.z)}) in Chat
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {remotePlayers.map((p) => {
                    const isMe = p.uid === localUid;
                    const isWorldOwner = p.uid === world.ownerId;
                    return (
                      <div
                        key={p.clientId}
                        className="rounded-lg border border-white/10 bg-[#121826] px-3.5 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-7 h-7 rounded-md border border-white/20 shrink-0"
                            style={{ backgroundColor: p.appearance?.shirtColor || '#22d3ee' }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {p.name}
                              {isMe && (
                                <span className="ml-1.5 text-xs font-normal text-[#94a3b8]">
                                  (You)
                                </span>
                              )}
                              {isWorldOwner && (
                                <span className="ml-1.5 text-xs font-mono text-[#f59e0b]">
                                  · Host
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-[#94a3b8] tabular-nums">
                              X {Math.floor(p.x)} · Y {Math.floor(p.y)} · Z {Math.floor(p.z)}
                            </div>
                          </div>
                        </div>

                        {!isMe && (
                          <button
                            type="button"
                            onClick={() => {
                              onTeleportToPlayer(p);
                              onClose();
                            }}
                            className="rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 px-3 py-1.5 text-xs font-semibold text-[#22d3ee] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            Teleport
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {teammates.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 px-4 py-4 text-center text-xs text-[#94a3b8]">
                      Share code <strong className="font-mono text-[#22d3ee]">{world.inviteCode}</strong> or
                      the Invite Link above so friends can join your factory in real time.
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Disconnect / Return Solo */}
              {isHost && (
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-[#94a3b8]">
                    Your factory auto-saves to cloud storage.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onDisconnectMultiplayer();
                      onClose();
                    }}
                    className="rounded-lg border border-white/15 bg-white/5 hover:border-[#ef4444]/60 hover:text-[#fca5a5] px-3 py-1.5 text-xs font-medium text-[#cbd5e1] cursor-pointer"
                  >
                    Switch Back to Offline Solo
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
