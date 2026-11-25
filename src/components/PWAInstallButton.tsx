import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Already running as an installed standalone Android/iOS/Desktop app
  if (isInstalled) {
    return null;
  }

  // Direct one-tap native Android / Chromium install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label={isAndroid ? 'Install Android App' : 'Install App'}
        className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-0 border border-[#10b981]/60 bg-[#10b981]/18 text-[#6ee7b7] hover:bg-[#10b981]/28 hover:border-[#34d399] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-[11px] font-semibold' : 'px-3 py-1.5 text-xs font-semibold'
        }`}
      >
        <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden sm:inline">{isAndroid ? 'Install Android App' : 'Install App'}</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  }

  // Fallback install guide for Android browsers (or iframe previews) and iOS Safari
  const label = isIOS
    ? 'Install on iOS'
    : isAndroid
    ? 'Install Android App'
    : 'Android App';

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        aria-label={label}
        className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-0 border border-[#10b981]/45 bg-[#10b981]/12 text-[#6ee7b7] hover:border-[#10b981] hover:bg-[#10b981]/22 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-[11px] font-medium' : 'px-3 py-1.5 text-xs font-medium'
        }`}
      >
        <Smartphone className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">App</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090c11]/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install AetherCraft App"
        >
          <div className="mc-panel w-full max-w-md p-6 text-[#f3f5f8]">
            <div className="flex items-start justify-between gap-3 border-b border-[#323b49] pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/pwa-192x192.png"
                  alt="AetherCraft app icon"
                  className="w-10 h-10 border border-[#323b49] shrink-0"
                />
                <div>
                  <h3 className="font-display text-base font-bold text-[#f3f5f8]">
                    Install AetherCraft on Android
                  </h3>
                  <p className="text-[11px] text-[#8d9cb0]">
                    Fullscreen standalone app with touch joystick & offline cache
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="p-1 text-[#8d9cb0] hover:text-[#f3f5f8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-2.5 text-xs text-[#cbd5e1] leading-relaxed">
                <p className="font-semibold text-[#f3f5f8]">iPhone / iPad (Safari):</p>
                <p>1. Open this app URL directly in Safari.</p>
                <p>
                  2. Tap the <strong className="text-[#f59e0b]">Share</strong> icon in the bottom toolbar.
                </p>
                <p>
                  3. Scroll down and tap <strong className="text-[#f59e0b]">Add to Home Screen</strong>.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-xs text-[#cbd5e1] leading-relaxed">
                <div className="border border-[#323b49] bg-[#141923] p-3 space-y-1.5">
                  <div className="font-semibold text-[#6ee7b7]">Android (Chrome / Edge / Samsung Internet)</div>
                  <p>1. Open this app URL in Chrome on your Android phone or tablet.</p>
                  <p>
                    2. Tap the browser <strong className="text-[#f59e0b]">⋮ Menu</strong> in the top-right corner.
                  </p>
                  <p>
                    3. Tap <strong className="text-[#f59e0b]">Install app</strong> (or{' '}
                    <strong className="text-[#f59e0b]">Add to Home screen</strong>) and confirm.
                  </p>
                </div>
                <p className="text-[11px] text-[#8d9cb0]">
                  Once installed, AetherCraft launches full-screen from your Android app drawer with an adaptive home-screen icon, dual-thumb touch controls, and cached assets.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full bg-[#f59e0b] py-2 text-xs font-semibold text-[#10141b] hover:bg-[#fbbf24] transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 border border-[#f59e0b]/60 bg-[#171c24] px-3 py-1.5 text-xs font-medium text-[#fde68a] shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
      <span>Offline Mode — Local cached world assets active.</span>
    </div>
  );
};
