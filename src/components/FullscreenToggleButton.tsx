import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useFullscreen } from '../hooks/useFullscreen';

interface FullscreenToggleButtonProps {
  compact?: boolean;
  variant?: 'hub' | 'hud';
  onAfterToggle?: (enteringFullscreen: boolean) => void;
}

export const FullscreenToggleButton: React.FC<FullscreenToggleButtonProps> = ({
  compact = false,
  variant = 'hub',
  onAfterToggle,
}) => {
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const handleClick = async () => {
    const entering = !isFullscreen;
    await toggleFullscreen();
    onAfterToggle?.(entering);
  };

  if (variant === 'hud') {
    return (
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
        title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
        className={`mc-panel min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 px-2 py-1.5 inline-flex items-center justify-center gap-1 text-xs font-medium cursor-pointer transition-colors touch-manipulation whitespace-nowrap shrink-0 ${
          isFullscreen
            ? 'border-[#10b981] text-[#6ee7b7]'
            : 'text-[#a3b0c2] hover:text-[#f3f5f8]'
        }`}
      >
        {isFullscreen ? (
          <Minimize className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
        ) : (
          <Maximize className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
        )}
        <span className="hidden lg:inline">{isFullscreen ? 'Exit Full' : 'Full Screen'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
      title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
      className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-0 border transition-colors cursor-pointer touch-manipulation whitespace-nowrap shrink-0 ${
        isFullscreen
          ? 'border-[#10b981]/60 bg-[#10b981]/18 text-[#6ee7b7] hover:border-[#34d399]'
          : 'border-[#323b49] bg-[#1e242e] text-[#f3f5f8] hover:border-[#f59e0b]'
      } ${compact ? 'px-2.5 py-1.5 text-[11px] font-medium' : 'px-3 py-1.5 text-xs font-medium'}`}
    >
      {isFullscreen ? (
        <Minimize className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
      ) : (
        <Maximize className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
      )}
      <span className="hidden sm:inline">{isFullscreen ? 'Exit Full' : 'Full Screen'}</span>
    </button>
  );
};
