// Game sound effects, built on expo-audio. The four WAVs in assets/sfx are
// synthesized in-house (no licensing baggage) and total ~60 KB.
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { getGameSounds } from '../db/settings';

export type Sfx = 'tap' | 'success' | 'error' | 'fanfare';

const SOURCES: Record<Sfx, number> = {
  tap: require('../../assets/sfx/tap.wav'),
  success: require('../../assets/sfx/success.wav'),
  error: require('../../assets/sfx/error.wav'),
  fanfare: require('../../assets/sfx/fanfare.wav'),
};

let players: Record<Sfx, AudioPlayer> | null = null;
let enabled = true;
let loaded = false;

/** Load players and the user's sound preference. Call once, e.g. on arcade mount. */
export async function initSfx(): Promise<void> {
  enabled = await getGameSounds();
  if (!players) {
    players = {
      tap: createAudioPlayer(SOURCES.tap),
      success: createAudioPlayer(SOURCES.success),
      error: createAudioPlayer(SOURCES.error),
      fanfare: createAudioPlayer(SOURCES.fanfare),
    };
  }
  loaded = true;
}

/** Flip the in-memory switch immediately (Settings toggle calls this). */
export function setSfxEnabled(value: boolean): void {
  enabled = value;
}

export function playSfx(name: Sfx): void {
  if (!enabled) return;
  if (!loaded) {
    // First call before init finished — fire and forget.
    initSfx().then(() => playSfx(name)).catch(() => {});
    return;
  }
  try {
    const p = players![name];
    p.seekTo(0);
    p.play();
  } catch {
    // Never let audio failures break gameplay.
  }
}
