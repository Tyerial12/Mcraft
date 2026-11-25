import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  Check,
  Coins,
  Cpu,
  Flame,
  Hammer,
  Pause,
  Pickaxe,
  Play,
  Plus,
  Sprout,
  Trash2,
  Trees,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import {
  DIRE_TRADER_DEALS,
  ITEMS,
  PLAYER_CLASSES,
  WORKER_HIRE_COST,
  WORKER_TASK_SPECS,
} from '../data/catalog';
import type {
  CharacterAppearance,
  HiredWorker,
  PlayerClassId,
  RemotePlayer,
  ResourceItemId,
  TradeOffer,
  WorkerTask,
} from '../types/game';

export type ClassWorkersTradeTab = 'class' | 'workers' | 'trade';

const SKIN_PRESETS = ['#f4cbb2', '#e0ac8b', '#c68863', '#8d583a', '#593622', '#fcd9b6'];
const HAIR_PRESETS = ['#1e293b', '#451a03', '#92400e', '#d97706', '#e2e8f0', '#7c2d12'];
const SHIRT_PRESETS = ['#0284c7', '#d97706', '#059669', '#dc2626', '#7c3aed', '#334155', '#0d9488'];
const PANTS_PRESETS = ['#1e293b', '#312e81', '#3f3f46', '#422006', '#0f172a', '#374151'];
const ACCENT_PRESETS = ['#22d3ee', '#10b981', '#f59e0b', '#a855f7', '#f43f5e', '#facc15'];

interface ClassTradeWorkersModalProps {
  initialTab?: ClassWorkersTradeTab;
  characterName: string;
  appearance: CharacterAppearance;
  playerClass: PlayerClassId;
  hiredWorkers: HiredWorker[];
  credits: number;
  playerHunger: number;
  playerMaxHunger: number;
  playerSaturation: number;
  playerHealth: number;
  playerMaxHealth: number;
  inventory: Partial<Record<ResourceItemId, number>>;
  sharedStorage: Partial<Record<ResourceItemId, number>>;
  tradeOffers: TradeOffer[];
  onlinePlayers: RemotePlayer[];
  localUid: string;
  onUpdateCharacterCustomization: (name: string, appearance: CharacterAppearance) => void;
  onSelectClass: (classId: PlayerClassId) => void;
  onHireWorker: (task: WorkerTask) => void;
  onChangeWorkerTask: (workerId: string, task: WorkerTask) => void;
  onToggleWorkerActive: (workerId: string) => void;
  onFeedWorker: (workerId: string) => void;
  onDismissWorker: (workerId: string) => void;
  onEatRation: () => void;
  onQuickCookRation: () => void;
  onExecuteTraderDeal: (dealId: string) => void;
  onCreateTradeOffer: (
    offerItemId: ResourceItemId | 'credits',
    offerQty: number,
    requestItemId: ResourceItemId | 'credits',
    requestQty: number
  ) => void;
  onAcceptTradeOffer: (offerId: string) => void;
  onCancelTradeOffer: (offerId: string) => void;
  onClose: () => void;
}

const TRADEABLE_ITEMS: (ResourceItemId | 'credits')[] = [
  'cooked_ration',
  'wood_log',
  'firewood_bundle',
  'cobblestone',
  'stone',
  'coal',
  'iron_ore',
  'iron_ingot',
  'copper_ingot',
  'gold_ingot',
  'diamond',
  'aether_crystal',
  'chest',
  'lever',
  'claim_beacon',
  'credits',
];

export const ClassTradeWorkersModal: React.FC<ClassTradeWorkersModalProps> = ({
  initialTab = 'class',
  characterName,
  appearance,
  playerClass,
  hiredWorkers,
  credits,
  playerHunger,
  playerMaxHunger,
  playerSaturation,
  playerHealth,
  playerMaxHealth,
  inventory,
  sharedStorage,
  tradeOffers,
  onlinePlayers,
  localUid,
  onUpdateCharacterCustomization,
  onSelectClass,
  onHireWorker,
  onChangeWorkerTask,
  onToggleWorkerActive,
  onFeedWorker,
  onDismissWorker,
  onEatRation,
  onQuickCookRation,
  onExecuteTraderDeal,
  onCreateTradeOffer,
  onAcceptTradeOffer,
  onCancelTradeOffer,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ClassWorkersTradeTab>(initialTab);
  const [nameDraft, setNameDraft] = useState<string>(characterName);
  const [appDraft, setAppDraft] = useState<CharacterAppearance>({ ...appearance });
  const [offerItemId, setOfferItemId] = useState<ResourceItemId | 'credits'>('wood_log');
  const [offerQty, setOfferQty] = useState<number>(10);
  const [requestItemId, setRequestItemId] = useState<ResourceItemId | 'credits'>('cooked_ration');
  const [requestQty, setRequestQty] = useState<number>(4);

  const getItemCount = (id: ResourceItemId): number =>
    (inventory[id] || 0) + (sharedStorage[id] || 0);

  const totalFoodRations = getItemCount('cooked_ration');
  const canQuickCook = getItemCount('leaves') >= 2 && getItemCount('firewood_bundle') >= 1;
  const activeClassSpec =
    PLAYER_CLASSES.find((c) => c.id === playerClass) || PLAYER_CLASSES[2];

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

  const renderTaskIcon = (task: WorkerTask) => {
    switch (task) {
      case 'wood':
        return <Trees className="w-4 h-4 text-[#fbbf24]" />;
      case 'iron':
        return <Pickaxe className="w-4 h-4 text-[#38bdf8]" />;
      case 'stone':
        return <Hammer className="w-4 h-4 text-[#94a3b8]" />;
      case 'food':
        return <Utensils className="w-4 h-4 text-[#34d399]" />;
    }
  };

  const hungerDrumsticks = Math.round((playerHunger / Math.max(1, playerMaxHunger)) * 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-1.5 sm:p-6 safe-pt safe-pb safe-pl safe-pr">
      <div className="w-full max-w-4xl max-h-[94dvh] sm:max-h-[92dvh] mc-panel flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#323b49] bg-[#171c24] px-3 sm:px-5 py-2.5 sm:py-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-lg font-bold text-[#f3f5f8] truncate">
              <span className="sm:hidden">Class · Workers · Trade</span>
              <span className="hidden sm:inline">
                Character Customizer · Player Class · Hired Workers (1,000 Coins) · Trade
              </span>
            </h2>
            <p className="hidden sm:block text-xs text-[#8d9cb0]">
              Customize your 3D character appearance, choose your specialist class bonus, hire &amp; feed workers, and trade goods.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 p-1.5 flex items-center justify-center border border-[#323b49] text-[#a3b0c2] hover:text-[#f3f5f8] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Telemetry Bar: Active Class + Dire Coins + Food Rations + Hunger Status */}
        <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 border-b border-[#323b49] bg-[#12161d] px-3 sm:px-5 py-2 text-[11px] sm:text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 border font-semibold"
              style={{
                borderColor: activeClassSpec.accentColor,
                color: activeClassSpec.accentColor,
                backgroundColor: `${activeClassSpec.accentColor}1a`,
              }}
            >
              {renderClassIcon(activeClassSpec.id)}
              <span className="hidden sm:inline">Class: </span>
              {activeClassSpec.name}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[#fbbf24]">
              <Coins className="w-3.5 h-3.5" />
              {credits.toLocaleString()}
              <span className="hidden sm:inline"> Dire Coins</span>
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[#34d399]">
              <Utensils className="w-3.5 h-3.5" />
              {totalFoodRations}
              <span className="sm:hidden"> Rations</span>
              <span className="hidden sm:inline"> Field Rations (Player &amp; Worker Food)</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-mono text-[10px] sm:text-[11px] text-[#cbd5e1]">
              Food: {Math.round(playerHunger)}/{playerMaxHunger}
              <span className="hidden sm:inline"> ({hungerDrumsticks}/10 Shanks) · Sat: {Math.round(playerSaturation)}%</span>
            </span>
            <button
              type="button"
              onClick={onEatRation}
              disabled={totalFoodRations <= 0 || (playerHunger >= playerMaxHunger && playerHealth >= playerMaxHealth)}
              className="inline-flex items-center gap-1 bg-[#10b981] disabled:opacity-40 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-[#08130e] hover:bg-[#34d399] cursor-pointer"
            >
              <Utensils className="w-3 h-3" />
              Eat ({totalFoodRations})
            </button>
            <button
              type="button"
              onClick={onQuickCookRation}
              disabled={!canQuickCook}
              title="Cook 2× Energized Field Rations from 2 Canopy Leaves + 1 Split Firewood"
              className="inline-flex items-center gap-1 border border-[#f59e0b]/70 bg-[#f59e0b]/15 disabled:opacity-40 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-[#fcd34d] hover:bg-[#f59e0b]/25 cursor-pointer"
            >
              <Flame className="w-3 h-3" />
              Cook 2×
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto no-scrollbar border-b border-[#323b49] bg-[#141922] px-2 sm:px-5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('class')}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'class'
                ? 'border-[#10b981] text-[#34d399] bg-[#10b981]/10'
                : 'border-transparent text-[#8d9cb0] hover:text-[#f3f5f8]'
            }`}
          >
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="sm:hidden">Class &amp; Rig</span>
            <span className="hidden sm:inline">1. Character &amp; Class ({activeClassSpec.name})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workers')}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'workers'
                ? 'border-[#fbbf24] text-[#fcd34d] bg-[#fbbf24]/10'
                : 'border-transparent text-[#8d9cb0] hover:text-[#f3f5f8]'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="sm:hidden">Workers ({hiredWorkers.length})</span>
            <span className="hidden sm:inline">2. Hire &amp; Feed Workers ({hiredWorkers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('trade')}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'trade'
                ? 'border-[#38bdf8] text-[#7dd3fc] bg-[#38bdf8]/10'
                : 'border-transparent text-[#8d9cb0] hover:text-[#f3f5f8]'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="sm:hidden">Trade ({DIRE_TRADER_DEALS.length})</span>
            <span className="hidden sm:inline">3. Trade Exchange ({DIRE_TRADER_DEALS.length} Contracts)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-3 sm:p-5">
          {activeTab === 'class' && (
            <div className="space-y-5">
              {/* Live In-Game Character Appearance & Name Customizer */}
              <div className="border border-[#323b49] bg-[#171c24] p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Voxel Avatar Preview */}
                    <div className="w-14 h-16 border border-white/20 bg-[#0b0f17] flex flex-col items-center justify-center p-1 shrink-0">
                      <div
                        className="w-5 h-1.5"
                        style={{ backgroundColor: appDraft.hairColor }}
                      />
                      <div
                        className="w-5 h-4 flex items-center justify-center"
                        style={{ backgroundColor: appDraft.skinColor }}
                      >
                        <div
                          className="w-3.5 h-1"
                          style={{ backgroundColor: appDraft.accentColor }}
                        />
                      </div>
                      <div
                        className="w-7 h-4"
                        style={{ backgroundColor: appDraft.shirtColor }}
                      />
                      <div
                        className="w-5 h-3"
                        style={{ backgroundColor: appDraft.pantsColor }}
                      />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-[#f3f5f8]">
                        Customize Your 3D Voxel Character
                      </h3>
                      <p className="text-xs text-[#8d9cb0]">
                        Update your display name, skin, hair, tunic, trousers, and visor colors in real time.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCharacterCustomization(
                        nameDraft.trim() || characterName,
                        appDraft
                      )
                    }
                    className="bg-[#10b981] hover:bg-[#34d399] px-3.5 py-2 text-xs font-bold text-[#08130e] cursor-pointer"
                  >
                    Save Character Appearance
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-2 border-t border-[#262e3c]">
                  <div>
                    <label className="block text-[#cbd5e1] font-medium mb-1">Display Name</label>
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      maxLength={28}
                      className="w-full border border-[#323b49] bg-[#0f131a] px-2.5 py-1.5 text-white focus:outline-none focus:border-[#22d3ee]"
                    />
                  </div>

                  <div>
                    <span className="block text-[#cbd5e1] font-medium mb-1">Skin Tone</span>
                    <div className="flex flex-wrap gap-1.5">
                      {SKIN_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAppDraft({ ...appDraft, skinColor: c })}
                          className={`w-6 h-6 border-2 cursor-pointer ${
                            appDraft.skinColor === c ? 'border-white scale-110' : 'border-black/40'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[#cbd5e1] font-medium mb-1">Hair Color</span>
                    <div className="flex flex-wrap gap-1.5">
                      {HAIR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAppDraft({ ...appDraft, hairColor: c })}
                          className={`w-6 h-6 border-2 cursor-pointer ${
                            appDraft.hairColor === c ? 'border-white scale-110' : 'border-black/40'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[#cbd5e1] font-medium mb-1">Tunic / Jumpsuit</span>
                    <div className="flex flex-wrap gap-1.5">
                      {SHIRT_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAppDraft({ ...appDraft, shirtColor: c })}
                          className={`w-6 h-6 border-2 cursor-pointer ${
                            appDraft.shirtColor === c ? 'border-white scale-110' : 'border-black/40'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[#cbd5e1] font-medium mb-1">Trousers Color</span>
                    <div className="flex flex-wrap gap-1.5">
                      {PANTS_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAppDraft({ ...appDraft, pantsColor: c })}
                          className={`w-6 h-6 border-2 cursor-pointer ${
                            appDraft.pantsColor === c ? 'border-white scale-110' : 'border-black/40'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[#cbd5e1] font-medium mb-1">Visor &amp; Accent</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ACCENT_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAppDraft({ ...appDraft, accentColor: c })}
                          className={`w-6 h-6 border-2 cursor-pointer ${
                            appDraft.accentColor === c ? 'border-white scale-110' : 'border-black/40'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Player Class Selection Cards */}
              <div className="border border-[#323b49] bg-[#171c24] p-3.5 text-xs text-[#cbd5e1]">
                Select your character&apos;s specialization class below. Each class grants permanent
                special bonuses tailored to farming &amp; food survival, forestry &amp; firewood, factory
                engineering, or deep-vein ore mining. You can switch your class at any time.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLAYER_CLASSES.map((cls) => {
                  const isSelected = cls.id === playerClass;
                  return (
                    <div
                      key={cls.id}
                      className={`border p-4 flex flex-col justify-between transition-colors ${
                        isSelected
                          ? 'border-[#10b981] bg-[#10b981]/12'
                          : 'border-[#323b49] bg-[#171c24] hover:border-[#4b586d]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="p-2 border"
                              style={{
                                borderColor: cls.accentColor,
                                color: cls.accentColor,
                                backgroundColor: `${cls.accentColor}1a`,
                              }}
                            >
                              {renderClassIcon(cls.id)}
                            </span>
                            <div>
                              <h3 className="font-display text-base font-bold text-[#f3f5f8]">
                                {cls.name}
                              </h3>
                              <p
                                className="text-xs font-medium"
                                style={{ color: cls.accentColor }}
                              >
                                {cls.tagline}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 bg-[#10b981] px-2.5 py-1 text-[10px] font-mono font-bold text-[#08130e]">
                              <Check className="w-3 h-3" />
                              ACTIVE CLASS
                            </span>
                          )}
                        </div>

                        <ul className="mt-3 space-y-1.5 border-t border-[#262e3c] pt-3">
                          {cls.bonuses.map((bonus, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs text-[#cbd5e1]"
                            >
                              <span
                                className="mt-1 w-1.5 h-1.5 shrink-0"
                                style={{ backgroundColor: cls.accentColor }}
                              />
                              <span>{bonus}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#262e3c]">
                        <button
                          type="button"
                          onClick={() => onSelectClass(cls.id)}
                          disabled={isSelected}
                          className={`w-full py-2 text-xs font-semibold cursor-pointer transition-colors ${
                            isSelected
                              ? 'border border-[#10b981]/50 bg-[#10b981]/20 text-[#34d399] cursor-default'
                              : 'bg-[#1e242e] border border-[#323b49] text-[#f3f5f8] hover:border-[#10b981] hover:bg-[#10b981] hover:text-[#08130e]'
                          }`}
                        >
                          {isSelected
                            ? `Currently Playing as ${cls.name}`
                            : `Select ${cls.name} Class`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'workers' && (
            <div className="space-y-5">
              {/* Minecraft Hunger & Worker Food Upkeep Explanation Card */}
              <div className="border border-[#323b49] bg-[#171c24] p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="font-display font-bold text-[#34d399] flex items-center gap-1.5">
                    <Utensils className="w-4 h-4" />
                    Minecraft-Style Player Food & Saturation
                  </div>
                  <p className="text-[#9aa8bc] leading-relaxed">
                    • <strong>Natural Health Regen (≥18/20 Hunger · 9+ Shanks)</strong>: When your
                    hunger bar is nearly full, you rapidly regenerate HP using Saturation/Hunger.
                    <br />• <strong>Low Hunger Sprint Penalty (≤6/20 · ≤3 Shanks)</strong>: You move
                    slower and stop regenerating health.
                    <br />• <strong>0% Starvation</strong>: At 0 hunger, you take periodic starvation
                    damage until you eat a Field Ration (<kbd className="font-mono">R</kbd> or{' '}
                    <strong>Eat Food</strong>).
                  </p>
                </div>
                <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-[#262e3c] pt-3 md:pt-0 md:pl-4">
                  <div className="font-display font-bold text-[#fbbf24] flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Worker Hiring (1,000 Dire Coins) & Food Upkeep
                  </div>
                  <p className="text-[#9aa8bc] leading-relaxed">
                    • Each Hired Worker costs <strong>1,000 Dire Coins</strong> and gathers resources
                    every 4 seconds into your ME Network / Backpack.
                    <br />• <strong>Workers Need Food</strong>: Wood, Iron, and Stone workers consume{' '}
                    <strong>1× Field Ration every 4 cycles</strong> (25% stamina per cycle). If food
                    runs out, they pause until fed!
                    <br />• <strong>Self-Sustaining Tip</strong>: Hire a <strong>Farm Food</strong>{' '}
                    worker (+2 Field Rations/cycle) to keep your entire workforce and yourself fed!
                  </p>
                </div>
              </div>

              {/* Hire New Worker Cards (1,000 Dire Coins each) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#f3f5f8]">
                    Hire New Autonomous Worker ({WORKER_HIRE_COST.toLocaleString()} Dire Coins each)
                  </span>
                  <span className="font-mono text-xs text-[#fbbf24]">
                    Your Balance: {credits.toLocaleString()} Dire Coins
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {WORKER_TASK_SPECS.map((spec) => {
                    const canAfford = credits >= WORKER_HIRE_COST;
                    return (
                      <div
                        key={spec.task}
                        className="border border-[#323b49] bg-[#171c24] p-3.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[#f3f5f8]">
                              {renderTaskIcon(spec.task)}
                              {spec.label}
                            </span>
                            <span className="font-mono text-[10px] text-[#fbbf24] border border-[#fbbf24]/40 bg-[#fbbf24]/10 px-1.5 py-0.5">
                              {WORKER_HIRE_COST} Coins
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11px] text-[#8d9cb0]">{spec.description}</p>
                          <div className="mt-2 font-mono text-[10px] text-[#34d399]">
                            {spec.task === 'food'
                              ? 'Self-Fed · Produces +2 Food Rations/cycle'
                              : 'Requires 1 Food Ration every 4 cycles'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onHireWorker(spec.task)}
                          disabled={!canAfford}
                          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-[#fbbf24] disabled:opacity-40 py-1.5 text-xs font-bold text-[#08130e] hover:bg-[#fcd34d] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Hire ({WORKER_HIRE_COST} Coins)
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Hired Workers Roster */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#f3f5f8]">
                    Your Hired Workers ({hiredWorkers.length})
                  </span>
                  <span className="font-mono text-xs text-[#34d399]">
                    Available Food Stockpile: {totalFoodRations} Field Rations
                  </span>
                </div>

                {hiredWorkers.length === 0 ? (
                  <div className="border border-[#323b49] bg-[#171c24] p-6 text-center text-xs text-[#8d9cb0]">
                    You haven&apos;t hired any workers yet. Earn <strong>1,000 Dire Coins</strong> by
                    completing quests, selling ingots, or trading below, then hire workers to gather
                    Wood, Iron, Stone, or Farm Food!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hiredWorkers.map((w) => {
                      const workerHunger = w.hunger ?? 100;
                      const isStarving = Boolean(w.starving) || workerHunger <= 0;
                      return (
                        <div
                          key={w.id}
                          className={`border p-3 flex flex-wrap items-center justify-between gap-3 ${
                            isStarving
                              ? 'border-[#ef4444]/80 bg-[#ef4444]/10'
                              : 'border-[#323b49] bg-[#171c24]'
                          }`}
                        >
                          <div className="min-w-[190px]">
                            <div className="flex items-center gap-2">
                              {renderTaskIcon(w.task)}
                              <span className="font-display text-sm font-bold text-[#f3f5f8]">
                                {w.name}
                              </span>
                              <span
                                className={`font-mono text-[10px] px-1.5 py-0.5 ${
                                  isStarving
                                    ? 'bg-[#ef4444]/25 text-[#fca5a5] border border-[#ef4444]/50'
                                    : w.active
                                    ? 'bg-[#10b981]/20 text-[#34d399]'
                                    : 'bg-[#64748b]/20 text-[#94a3b8]'
                                }`}
                              >
                                {isStarving
                                  ? 'HUNGRY — NEEDS FOOD!'
                                  : w.active
                                  ? 'WORKING'
                                  : 'PAUSED'}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[11px] font-mono text-[#8d9cb0]">
                              <span>Gathered: {w.totalGathered} items</span>
                              <span
                                className={
                                  workerHunger <= 25 ? 'text-[#ef4444]' : 'text-[#34d399]'
                                }
                              >
                                Food Stamina: {Math.round(workerHunger)}%
                              </span>
                            </div>
                            {/* Worker Food Stamina Bar */}
                            <div className="mt-1.5 w-44 h-1.5 bg-[#0f131a] border border-[#262e3c] overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  workerHunger <= 25
                                    ? 'bg-[#ef4444]'
                                    : workerHunger <= 50
                                    ? 'bg-[#f59e0b]'
                                    : 'bg-[#10b981]'
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, workerHunger))}%` }}
                              />
                            </div>
                          </div>

                          {/* Task Assignment Switcher (Wood / Iron / Stone / Food) */}
                          <div className="flex flex-wrap items-center gap-1">
                            {WORKER_TASK_SPECS.map((spec) => (
                              <button
                                key={spec.task}
                                type="button"
                                onClick={() => onChangeWorkerTask(w.id, spec.task)}
                                className={`px-2.5 py-1 text-[11px] font-mono border cursor-pointer transition-colors ${
                                  w.task === spec.task
                                    ? 'border-[#10b981] bg-[#10b981]/20 text-[#34d399] font-bold'
                                    : 'border-[#323b49] bg-[#10141b] text-[#94a3b8] hover:text-white'
                                }`}
                              >
                                {spec.label}
                              </button>
                            ))}
                          </div>

                          {/* Worker Controls: Feed Ration / Pause / Dismiss */}
                          <div className="flex items-center gap-1.5">
                            {(isStarving || workerHunger < 100) && w.task !== 'food' && (
                              <button
                                type="button"
                                onClick={() => onFeedWorker(w.id)}
                                disabled={totalFoodRations <= 0}
                                title="Feed 1 Field Ration to restore 100% Worker Food Stamina"
                                className="inline-flex items-center gap-1 bg-[#10b981] disabled:opacity-40 px-2.5 py-1 text-xs font-semibold text-[#08130e] hover:bg-[#34d399] cursor-pointer"
                              >
                                <Utensils className="w-3 h-3" />
                                Feed
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onToggleWorkerActive(w.id)}
                              className="inline-flex items-center gap-1 border border-[#323b49] bg-[#10141b] px-2.5 py-1 text-xs text-[#f3f5f8] hover:border-[#38bdf8] cursor-pointer"
                            >
                              {w.active ? (
                                <>
                                  <Pause className="w-3 h-3" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" />
                                  Resume
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDismissWorker(w.id)}
                              title="Dismiss worker"
                              className="p-1.5 border border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/15 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'trade' && (
            <div className="space-y-6">
              {/* Section 1: Instant Dire Caravan Trader Deals */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-[#f3f5f8]">
                    Dire Caravan Merchant Contracts (Instant Barter & Coin Exchange)
                  </h3>
                  <p className="text-xs text-[#8d9cb0]">
                    Trade surplus Wood, Stone, Iron, or Dire Coins for Field Rations, Ores, and
                    Factory Components.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {DIRE_TRADER_DEALS.map((deal) => {
                    const haveCost =
                      deal.costItemId === 'credits'
                        ? credits
                        : getItemCount(deal.costItemId);
                    const canAfford = haveCost >= deal.costQty;
                    const costName =
                      deal.costItemId === 'credits'
                        ? 'Dire Coins'
                        : ITEMS[deal.costItemId]?.name || deal.costItemId;
                    const rewardName =
                      deal.rewardItemId === 'credits'
                        ? 'Dire Coins'
                        : ITEMS[deal.rewardItemId]?.name || deal.rewardItemId;

                    return (
                      <div
                        key={deal.id}
                        className="border border-[#323b49] bg-[#171c24] p-3.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="font-display text-sm font-bold text-[#f3f5f8]">
                            {deal.title}
                          </div>
                          <div className="mt-2 space-y-1 text-xs font-mono">
                            <div className="text-[#fca5a5]">
                              Give: {deal.costQty}× {costName}{' '}
                              <span className="text-[#8d9cb0]">(Have: {haveCost})</span>
                            </div>
                            <div className="text-[#34d399]">
                              Receive: +{deal.rewardQty}× {rewardName}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onExecuteTraderDeal(deal.id)}
                          disabled={!canAfford}
                          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-[#38bdf8] disabled:opacity-40 py-1.5 text-xs font-bold text-[#08131a] hover:bg-[#7dd3fc] cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          Trade Now
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Multiplayer Co-op Player-to-Player Trade Board */}
              <div className="border-t border-[#323b49] pt-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#f3f5f8]">
                      Multiplayer Co-op Player Trade Board ({tradeOffers.length} Active Offers)
                    </h3>
                    <p className="text-xs text-[#8d9cb0]">
                      Post a trade offer for other players in this world or accept a teammate&apos;s
                      listed trade.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#38bdf8]">
                    Online Players in World: {onlinePlayers.length}
                  </span>
                </div>

                {/* Create Player Trade Offer Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (offerQty <= 0 || requestQty <= 0) return;
                    onCreateTradeOffer(offerItemId, offerQty, requestItemId, requestQty);
                  }}
                  className="border border-[#323b49] bg-[#171c24] p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] text-[#8d9cb0] mb-1">You Offer</label>
                    <select
                      value={offerItemId}
                      onChange={(e) =>
                        setOfferItemId(e.target.value as ResourceItemId | 'credits')
                      }
                      className="w-full border border-[#323b49] bg-[#10141b] px-2.5 py-1.5 text-xs text-[#f3f5f8]"
                    >
                      {TRADEABLE_ITEMS.map((id) => (
                        <option key={id} value={id}>
                          {id === 'credits' ? 'Dire Coins' : ITEMS[id]?.name || id} (Have:{' '}
                          {id === 'credits' ? credits : getItemCount(id)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] text-[#8d9cb0] mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={offerQty}
                      onChange={(e) => setOfferQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full border border-[#323b49] bg-[#10141b] px-2 py-1.5 text-xs font-mono text-[#f3f5f8]"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] text-[#8d9cb0] mb-1">You Request</label>
                    <select
                      value={requestItemId}
                      onChange={(e) =>
                        setRequestItemId(e.target.value as ResourceItemId | 'credits')
                      }
                      className="w-full border border-[#323b49] bg-[#10141b] px-2.5 py-1.5 text-xs text-[#f3f5f8]"
                    >
                      {TRADEABLE_ITEMS.map((id) => (
                        <option key={id} value={id}>
                          {id === 'credits' ? 'Dire Coins' : ITEMS[id]?.name || id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] text-[#8d9cb0] mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={requestQty}
                      onChange={(e) => setRequestQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full border border-[#323b49] bg-[#10141b] px-2 py-1.5 text-xs font-mono text-[#f3f5f8]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full bg-[#10b981] py-1.5 text-xs font-bold text-[#08130e] hover:bg-[#34d399] cursor-pointer"
                    >
                      Post Trade
                    </button>
                  </div>
                </form>

                {/* Open Trade Offers List */}
                {tradeOffers.length === 0 ? (
                  <div className="border border-[#323b49] bg-[#171c24] p-4 text-center text-xs text-[#8d9cb0]">
                    No open player trade offers in this world yet. Post an offer above to trade with
                    co-op players!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tradeOffers.map((offer) => {
                      const isMine = offer.senderUid === localUid;
                      const offerLabel =
                        offer.offerItemId === 'credits'
                          ? 'Dire Coins'
                          : ITEMS[offer.offerItemId]?.name || offer.offerItemId;
                      const reqLabel =
                        offer.requestItemId === 'credits'
                          ? 'Dire Coins'
                          : ITEMS[offer.requestItemId]?.name || offer.requestItemId;
                      const myHave =
                        offer.requestItemId === 'credits'
                          ? credits
                          : getItemCount(offer.requestItemId);
                      const canAccept = !isMine && myHave >= offer.requestQty;

                      return (
                        <div
                          key={offer.id}
                          className="border border-[#323b49] bg-[#171c24] p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-[#38bdf8]">
                              {offer.senderName}
                            </span>{' '}
                            offers{' '}
                            <span className="font-mono font-bold text-[#34d399]">
                              {offer.offerQty}× {offerLabel}
                            </span>{' '}
                            for{' '}
                            <span className="font-mono font-bold text-[#fbbf24]">
                              {offer.requestQty}× {reqLabel}
                            </span>
                          </div>
                          <div>
                            {isMine ? (
                              <button
                                type="button"
                                onClick={() => onCancelTradeOffer(offer.id)}
                                className="border border-[#ef4444]/50 px-2.5 py-1 text-xs text-[#fca5a5] hover:bg-[#ef4444]/15 cursor-pointer"
                              >
                                Cancel & Refund
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onAcceptTradeOffer(offer.id)}
                                disabled={!canAccept}
                                className="bg-[#10b981] disabled:opacity-40 px-3 py-1 text-xs font-bold text-[#08130e] hover:bg-[#34d399] cursor-pointer"
                              >
                                Accept Trade
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
