import Tts from 'react-native-tts';

// Android's TTS treats rate 0.5 as normal speed.
export const NORMAL_RATE = 0.5;
export const NORMAL_PITCH = 1.0;

let ready: Promise<unknown> | null = null;

/** Resolves once the native TTS engine is usable. Safe to call repeatedly. */
export function initTts(): Promise<unknown> {
  ready ??= Tts.getInitStatus().catch(() => undefined);
  return ready;
}

/**
 * Speaks a single phrase at normal speed, cutting off anything already playing.
 * Rate/pitch are set explicitly because Travel Mode changes the engine defaults.
 */
export async function speakOnce(text: string): Promise<void> {
  if (!text.trim()) return;
  await initTts();
  Tts.stop();
  Tts.setDefaultRate(NORMAL_RATE);
  Tts.setDefaultPitch(NORMAL_PITCH);
  Tts.speak(text.trim());
}
