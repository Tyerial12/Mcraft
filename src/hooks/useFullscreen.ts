import { useCallback, useEffect, useState } from 'react';

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const SYNC_EVENT = 'aethercraft-immersive-sync';
let sharedFallbackImmersive = false;

function getNativeFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

function isNativeFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  const el = document.documentElement as FullscreenElement;
  return Boolean(
    (doc.fullscreenEnabled ?? true) &&
      (typeof el.requestFullscreen === 'function' ||
        typeof el.webkitRequestFullscreen === 'function')
  );
}

function notifyResizeSoon() {
  window.setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 80);
  window.setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 260);
}

export function useFullscreen() {
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(() =>
    Boolean(getNativeFullscreenElement())
  );
  const [fallbackImmersive, setFallbackImmersive] = useState<boolean>(
    () => sharedFallbackImmersive
  );

  useEffect(() => {
    const onNativeChange = () => {
      const active = Boolean(getNativeFullscreenElement());
      setIsNativeFullscreen(active);
      if (!active && sharedFallbackImmersive) {
        sharedFallbackImmersive = false;
        setFallbackImmersive(false);
      }
      notifyResizeSoon();
    };

    const onSync = () => {
      setFallbackImmersive(sharedFallbackImmersive);
    };

    document.addEventListener('fullscreenchange', onNativeChange);
    document.addEventListener('webkitfullscreenchange', onNativeChange);
    window.addEventListener(SYNC_EVENT, onSync);

    return () => {
      document.removeEventListener('fullscreenchange', onNativeChange);
      document.removeEventListener('webkitfullscreenchange', onNativeChange);
      window.removeEventListener(SYNC_EVENT, onSync);
    };
  }, []);

  const setSharedFallback = useCallback((next: boolean) => {
    sharedFallbackImmersive = next;
    setFallbackImmersive(next);
    window.dispatchEvent(new Event(SYNC_EVENT));
    notifyResizeSoon();
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = document.documentElement as FullscreenElement;
    if (isNativeFullscreenSupported()) {
      try {
        if (typeof el.requestFullscreen === 'function') {
          await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          await el.webkitRequestFullscreen();
        }
        // Confirm native fullscreen actually engaged (iframes / iOS may silently ignore)
        if (getNativeFullscreenElement()) {
          setIsNativeFullscreen(true);
          notifyResizeSoon();
          return true;
        }
      } catch {
        // Fall back to immersive full-viewport mode when browser/iframe blocks native fullscreen
      }
    }
    setSharedFallback(true);
    return true;
  }, [setSharedFallback]);

  const exitFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    if (getNativeFullscreenElement()) {
      try {
        if (typeof doc.exitFullscreen === 'function') {
          await doc.exitFullscreen();
        } else if (typeof doc.webkitExitFullscreen === 'function') {
          await doc.webkitExitFullscreen();
        }
      } catch {
        // Ignore exit errors
      }
    }
    setIsNativeFullscreen(false);
    setSharedFallback(false);
  }, [setSharedFallback]);

  const toggleFullscreen = useCallback(async () => {
    if (isNativeFullscreen || fallbackImmersive) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isNativeFullscreen, fallbackImmersive, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen: isNativeFullscreen || fallbackImmersive,
    isNativeFullscreen,
    isFallbackImmersive: fallbackImmersive,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
