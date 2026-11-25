import type { DayNightState, WeatherKind, WeatherState } from '../types/game.ts';

/**
 * Real-life 6-hour Day / 6-hour Night cycle (12-hour full cycle),
 * anchored to each world's creation timestamp so EVERY newly created world
 * starts at crisp, sunny Daylight with 6 full hours before first nightfall.
 */
export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

/**
 * Deterministic world-synced weather windows:
 * - First 90s of a brand-new world stay Clear so players spawn under sunny skies.
 * - Thereafter, weather rolls every 150 seconds (2m 30s) deterministically from
 *   (worldSeed, windowIndex) so all multiplayer clients share identical weather.
 */
export const WEATHER_GRACE_MS = 90 * 1000;
export const WEATHER_WINDOW_MS = 150 * 1000;

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatWeatherDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function hashWeatherRoll(seed: number, windowIndex: number): number {
  let h = (Math.imul(seed | 0, 374761393) ^ Math.imul(windowIndex + 17, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h % 10000) / 10000;
}

function resolveRawWeatherKind(seed: number, windowIndex: number): WeatherKind {
  const r = hashWeatherRoll(seed, windowIndex);
  // ~54% Clear Skies, ~25% Light Rain, ~21% Dense Fog
  if (r < 0.54) return 'clear';
  if (r < 0.79) return 'light_rain';
  return 'fog';
}

function blendHexColors(baseHex: string, tintHex: string, factor: number): string {
  const t = Math.max(0, Math.min(1, factor));
  const b = parseInt(baseHex.replace('#', ''), 16);
  const c = parseInt(tintHex.replace('#', ''), 16);
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const cr = (c >> 16) & 255;
  const cg = (c >> 8) & 255;
  const cb = c & 255;
  const rr = Math.round(br + (cr - br) * t);
  const rg = Math.round(bg + (cg - bg) * t);
  const rb = Math.round(bb + (cb - bb) * t);
  return `#${((1 << 24) | (rr << 16) | (rg << 8) | rb).toString(16).slice(1)}`;
}

export function getWeatherState(
  nowMs: number = Date.now(),
  worldCreatedAtMs?: number,
  worldSeed: number = 1001
): WeatherState {
  const elapsedMs =
    typeof worldCreatedAtMs === 'number' && Number.isFinite(worldCreatedAtMs)
      ? Math.max(0, nowMs - worldCreatedAtMs)
      : 0;

  let kind: WeatherKind = 'clear';
  let msUntilNextChange = WEATHER_GRACE_MS;

  if (elapsedMs < WEATHER_GRACE_MS) {
    kind = 'clear';
    msUntilNextChange = WEATHER_GRACE_MS - elapsedMs;
  } else {
    const postGrace = elapsedMs - WEATHER_GRACE_MS;
    const windowIndex = Math.floor(postGrace / WEATHER_WINDOW_MS);
    const windowOffset = postGrace % WEATHER_WINDOW_MS;
    msUntilNextChange = WEATHER_WINDOW_MS - windowOffset;

    const currentRoll = resolveRawWeatherKind(worldSeed, windowIndex);
    // Prevent 3 consecutive inclement windows so skies always clear periodically
    if (
      currentRoll !== 'clear' &&
      windowIndex >= 2 &&
      resolveRawWeatherKind(worldSeed, windowIndex - 1) !== 'clear' &&
      resolveRawWeatherKind(worldSeed, windowIndex - 2) !== 'clear'
    ) {
      kind = 'clear';
    } else {
      kind = currentRoll;
    }
  }

  if (kind === 'light_rain') {
    return {
      kind: 'light_rain',
      label: 'Light Rain',
      shortLabel: 'Rain',
      solarMultiplier: 0.4,
      boilerFuelBurnMultiplier: 1.35,
      fogNearFactor: 0.72,
      fogFarFactor: 0.76,
      rainIntensity: 0.72,
      msUntilNextChange,
      formattedTimeRemaining: formatWeatherDuration(msUntilNextChange),
    };
  }

  if (kind === 'fog') {
    return {
      kind: 'fog',
      label: 'Dense Fog',
      shortLabel: 'Fog',
      solarMultiplier: 0.55,
      boilerFuelBurnMultiplier: 1.2,
      fogNearFactor: 0.34,
      fogFarFactor: 0.46,
      rainIntensity: 0,
      msUntilNextChange,
      formattedTimeRemaining: formatWeatherDuration(msUntilNextChange),
    };
  }

  return {
    kind: 'clear',
    label: 'Clear Skies',
    shortLabel: 'Clear',
    solarMultiplier: 1.0,
    boilerFuelBurnMultiplier: 1.0,
    fogNearFactor: 1.0,
    fogFarFactor: 1.0,
    rainIntensity: 0,
    msUntilNextChange,
    formattedTimeRemaining: formatWeatherDuration(msUntilNextChange),
  };
}

export function getDayNightState(
  nowMs: number = Date.now(),
  worldCreatedAtMs?: number,
  worldSeed: number = 1001
): DayNightState {
  // Anchor cycle to world creation time so every newly created world starts at bright Day.
  // If no world timestamp is given yet, default to fresh morning Day (elapsed = 0).
  const elapsedMs =
    typeof worldCreatedAtMs === 'number' && Number.isFinite(worldCreatedAtMs)
      ? Math.max(0, nowMs - worldCreatedAtMs)
      : 0;

  const weather = getWeatherState(nowMs, worldCreatedAtMs, worldSeed);

  const cycleNumber = Math.floor(elapsedMs / TWELVE_HOURS_MS);
  const cyclePos = elapsedMs % TWELVE_HOURS_MS;
  const isNight = cyclePos >= SIX_HOURS_MS;
  const phaseElapsed = isNight ? cyclePos - SIX_HOURS_MS : cyclePos;
  const progress = phaseElapsed / SIX_HOURS_MS; // 0..1 within current 6h window
  const msUntilNextTransition = SIX_HOURS_MS - phaseElapsed;

  let phase: DayNightState['phase'] = isNight ? 'night' : 'day';
  // On a brand-new world's very first day (cycleNumber === 0), skip dim dawn so it starts immediately in bright Day.
  if (!isNight && cycleNumber > 0 && progress < 0.08) phase = 'dawn';
  else if (!isNight && progress > 0.9) phase = 'dusk';

  let baseSolarEfficiency = 0;
  let sunElevation = 0.14;
  let skyHex = '#0d1526';
  let fogHex = '#111c33';
  let sunHex = '#8fb4e8';
  let ambientIntensity = 0.34;
  let sunIntensity = 0.42;
  let cycleLabel = `Night · Dawn in ${formatDuration(msUntilNextTransition)}`;

  if (phase === 'day') {
    const sunArc = Math.sin(progress * Math.PI);
    baseSolarEfficiency = Math.max(0.65, Math.min(1, 0.55 + sunArc * 0.5));
    sunElevation = 0.45 + sunArc * 0.55;
    skyHex = '#7eb8e8';
    fogHex = '#9ac9ee';
    sunHex = '#fff4d6';
    ambientIntensity = 0.82;
    sunIntensity = 1.38;
    cycleLabel = `Day · Night in ${formatDuration(msUntilNextTransition)}`;
  } else if (phase === 'dawn' || phase === 'dusk') {
    baseSolarEfficiency = 0.45;
    sunElevation = 0.24;
    skyHex = '#d98a54';
    fogHex = '#c97e58';
    sunHex = '#ffbe7d';
    ambientIntensity = 0.58;
    sunIntensity = 0.96;
    cycleLabel = `${phase === 'dawn' ? 'Dawn' : 'Dusk'} · ${formatDuration(msUntilNextTransition)}`;
  }

  // Apply weather atmosphere tinting and lighting attenuation
  if (weather.kind === 'light_rain') {
    const rainSky = isNight ? '#0e1726' : '#6f849c';
    const rainFog = isNight ? '#152236' : '#859bb3';
    skyHex = blendHexColors(skyHex, rainSky, isNight ? 0.65 : 0.72);
    fogHex = blendHexColors(fogHex, rainFog, isNight ? 0.7 : 0.76);
    sunHex = blendHexColors(sunHex, '#b8cde0', 0.55);
    sunIntensity = Number((sunIntensity * 0.52).toFixed(2));
    ambientIntensity = Number((ambientIntensity * 0.82).toFixed(2));
  } else if (weather.kind === 'fog') {
    const fogSky = isNight ? '#1b2638' : '#b4c5d4';
    const fogMist = isNight ? '#223047' : '#c4d2de';
    skyHex = blendHexColors(skyHex, fogSky, isNight ? 0.7 : 0.78);
    fogHex = blendHexColors(fogHex, fogMist, isNight ? 0.75 : 0.84);
    sunHex = blendHexColors(sunHex, '#dbe4ec', 0.5);
    sunIntensity = Number((sunIntensity * 0.6).toFixed(2));
    ambientIntensity = Number((ambientIntensity * 0.9).toFixed(2));
  }

  const solarEfficiency = Number((baseSolarEfficiency * weather.solarMultiplier).toFixed(3));

  return {
    phase,
    isNight,
    sunElevation,
    baseSolarEfficiency,
    solarEfficiency,
    weather,
    skyHex,
    fogHex,
    sunHex,
    ambientIntensity,
    sunIntensity,
    msUntilNextTransition,
    formattedTimeRemaining: formatDuration(msUntilNextTransition),
    cycleLabel,
  };
}
