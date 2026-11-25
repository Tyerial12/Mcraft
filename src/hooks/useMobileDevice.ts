import { useEffect, useState } from 'react';

export interface MobileDeviceState {
  isTouchDevice: boolean;
  isCompactViewport: boolean;
  isTablet: boolean;
  isPortraitPhone: boolean;
  isLandscapePhone: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

function readMobileState(): MobileDeviceState {
  if (typeof window === 'undefined') {
    return {
      isTouchDevice: false,
      isCompactViewport: false,
      isTablet: false,
      isPortraitPhone: false,
      isLandscapePhone: false,
      viewportWidth: 1280,
      viewportHeight: 720,
    };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints > 0 : false;
  const isTouchDevice = coarse || touchPoints;
  const isPortraitPhone = w < 640;
  const isLandscapePhone = h < 520 && w > h;
  const isTablet = !isPortraitPhone && !isLandscapePhone && (w <= 1180 || (isTouchDevice && w <= 1366));
  const isCompactViewport = w <= 1024 || h < 560;

  return {
    isTouchDevice,
    isCompactViewport,
    isTablet,
    isPortraitPhone,
    isLandscapePhone,
    viewportWidth: w,
    viewportHeight: h,
  };
}

export function useMobileDevice(): MobileDeviceState {
  const [state, setState] = useState<MobileDeviceState>(() => readMobileState());

  useEffect(() => {
    const update = () => setState(readMobileState());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return state;
}
