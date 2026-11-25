import React, { useState } from 'react';
import { Hammer, X } from 'lucide-react';
import { CRAFT_RECIPES, ITEMS } from '../data/catalog';
import type { CharacterProfile, ResourceItemId } from '../types/game';

interface InventoryDrawerModalProps {
  character: CharacterProfile;
  onAssignHotbar: (slotIndex: number, itemId: ResourceItemId | null) => void;
  onHandCraft: (recipeId: string) => void;
  onClose: () => void;
}

export const InventoryDrawerModal: React.FC<InventoryDrawerModalProps> = ({
  character,
  onAssignHotbar,
  onHandCraft,
  onClose,
}) => {
  const [targetSlot, setTargetSlot] = useState(character.selectedSlot);

  const ownedItems = (Object.entries(character.inventory) as [ResourceItemId, number][])
    .filter(([, qty]) => qty > 0)
    .filter(([id]) => Boolean(ITEMS[id]))
    .sort((a, b) => {
      const catOrder: Record<string, number> = {
        machine: 0,
        augment: 1,
        utility: 2,
        fuel: 3,
        ingot: 4,
        clump: 5,
        ore: 6,
        block: 7,
      };
      const ca = catOrder[ITEMS[a[0]].category] ?? 9;
      const cb = catOrder[ITEMS[b[0]].category] ?? 9;
      if (ca !== cb) return ca - cb;
      return b[1] - a[1];
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-1.5 sm:p-6 safe-pt safe-pb safe-pl safe-pr">
      <div className="w-full max-w-3xl max-h-[94dvh] sm:max-h-[92dvh] mc-panel flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[#323b49] bg-[#171c24] px-3 sm:px-5 py-2.5 sm:py-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-lg font-bold text-[#f3f5f8] truncate">
              Backpack, Hotbar &amp; Crafting
            </h2>
            <p className="text-[11px] sm:text-xs text-[#8d9cb0] truncate">
              Pick a hotbar slot below, then tap any item to assign it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Backpack"
            className="min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 p-1.5 flex items-center justify-center border border-[#323b49] text-[#a3b0c2] hover:text-[#f3f5f8] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hotbar Slot Selector */}
        <div className="shrink-0 border-b border-[#323b49] bg-[#12161d] px-3 sm:px-5 py-2 sm:py-3">
          <div className="text-[11px] font-mono text-[#8d9cb0] mb-1.5 sm:mb-2">
            Editing Hotbar Slot #{targetSlot + 1}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {character.hotbar.map((itemId, idx) => {
              const meta = itemId ? ITEMS[itemId] : null;
              const qty = itemId ? character.inventory[itemId] || 0 : 0;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTargetSlot(idx)}
                  className={`relative w-11 h-11 sm:w-12 sm:h-12 flex flex-col items-center justify-center shrink-0 cursor-pointer ${
                    targetSlot === idx ? 'mc-slot-active' : 'mc-slot'
                  }`}
                >
                  <span className="absolute left-1 top-0.5 font-mono text-[9px] text-[#7c8aa0]">
                    {idx + 1}
                  </span>
                  {meta ? (
                    <>
                      <span
                        className="w-4 h-4 border border-black/40"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-[9px] text-[#d1d9e6] truncate max-w-[42px]">
                        {meta.shortName}
                      </span>
                      <span className="absolute right-1 bottom-0.5 font-mono text-[9px] text-white">
                        {qty}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-[#5b677a]">Empty</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onAssignHotbar(targetSlot, null)}
              className="ml-2 border border-[#323b49] bg-[#171c24] px-2.5 py-1.5 text-xs text-[#9aa8bc] hover:text-[#f3f5f8] cursor-pointer whitespace-nowrap"
            >
              Clear Slot
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-5">
          {/* Backpack Items */}
          <div className="md:col-span-7">
            <div className="text-xs font-semibold text-[#f3f5f8] mb-2.5">
              Backpack Items ({ownedItems.length})
            </div>
            {ownedItems.length === 0 ? (
              <div className="border border-[#323b49] bg-[#171c24] p-6 text-center text-xs text-[#8d9cb0]">
                Mine terrain blocks or purchase machines in the Shop to fill your backpack.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ownedItems.map(([id, qty]) => {
                  const meta = ITEMS[id];
                  const isAssigned = character.hotbar[targetSlot] === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onAssignHotbar(targetSlot, id)}
                      className={`p-2.5 border text-left flex items-center gap-2.5 cursor-pointer transition-colors ${
                        isAssigned
                          ? 'border-[#f59e0b] bg-[#f59e0b]/15'
                          : 'border-[#323b49] bg-[#171c24] hover:border-[#4b586d]'
                      }`}
                    >
                      <span
                        className="w-6 h-6 border border-black/40 shrink-0"
                        style={{
                          backgroundColor: meta.color,
                          boxShadow: `inset -3px -3px 0 ${meta.accentColor}`,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#f3f5f8] truncate">{meta.shortName}</div>
                        <div className="font-mono text-[11px] text-[#f59e0b] tabular-nums">×{qty}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Hand Crafting */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f3f5f8] mb-2.5">
              <Hammer className="w-3.5 h-3.5 text-[#38bdf8]" />
              Quick Hand Crafting
            </div>
            <div className="space-y-2">
              {CRAFT_RECIPES.map((r) => {
                const canCraft = r.inputs.every(
                  (inp) => (character.inventory[inp.itemId] || 0) >= inp.qty
                );
                return (
                  <div
                    key={r.id}
                    className="border border-[#323b49] bg-[#171c24] p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#f3f5f8] truncate">{r.name}</div>
                      <div className="text-[10px] font-mono text-[#8d9cb0]">
                        {r.inputs.map((i) => `${i.qty}× ${ITEMS[i.itemId].shortName}`).join(' + ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canCraft}
                      onClick={() => onHandCraft(r.id)}
                      className="bg-[#38bdf8] px-2.5 py-1 text-[11px] font-semibold text-[#0b1318] hover:bg-[#7dd3fc] disabled:opacity-35 cursor-pointer shrink-0"
                    >
                      Craft
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
