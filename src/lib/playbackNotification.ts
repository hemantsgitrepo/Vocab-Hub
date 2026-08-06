// ---------------------------------------------------------------------------
// Foreground-service notification for Travel Mode playback.
//
// Android freezes a backgrounded app's JS timers and is free to kill the
// process outright once it loses foreground status — Samsung's OEM policy is
// especially aggressive — which cuts long listening sessions short. Binding
// playback to a foreground service keeps the process alive for exactly as long
// as audio is running, and gives the user transport controls in the shade and
// on the lock screen.
//
// This is Android's mechanism; on iOS the `audio` background mode in app.json
// already covers continued playback, so these calls are no-ops there.
// ---------------------------------------------------------------------------
import { Platform } from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidForegroundServiceType,
  AndroidImportance,
  AndroidVisibility,
  EventType,
} from 'react-native-notify-kit';

/** Transport controls offered on the notification. */
export type PlaybackAction = 'toggle' | 'next' | 'stop';

const CHANNEL_ID = 'travel-playback';
const NOTIFICATION_ID = 'travel-playback';

const listeners = new Set<(action: PlaybackAction) => void>();

function emit(id: string | undefined) {
  if (id === 'toggle' || id === 'next' || id === 'stop') {
    listeners.forEach((fn) => fn(id));
  }
}

let started = false;

/**
 * Registers the service runner and the notification-action handlers. Must run
 * once at app start — the background handler has to be in place before Android
 * can deliver a press to a backgrounded app.
 */
export function initPlaybackNotification(): void {
  if (started || Platform.OS !== 'android') return;
  started = true;

  // The runner represents the life of the service, so it intentionally never
  // resolves; stopForegroundService() is what ends it.
  notifee.registerForegroundService(() => new Promise<void>(() => {}));

  notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.ACTION_PRESS) emit(detail.pressAction?.id);
  });
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS) emit(detail.pressAction?.id);
  });
}

/** Subscribes to transport-control presses. Returns an unsubscribe function. */
export function onPlaybackAction(handler: (action: PlaybackAction) => void): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

let channel: Promise<string> | null = null;

function ensureChannel(): Promise<string> {
  // LOW importance keeps the persistent notification silent — it must never
  // interrupt the audio it is controlling.
  channel ??= notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Travel Mode playback',
    importance: AndroidImportance.LOW,
    vibration: false,
  });
  return channel;
}

/** Android 13+ hides notifications until POST_NOTIFICATIONS is granted. */
export async function requestPlaybackNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.requestPermission().catch(() => undefined);
}

export interface PlaybackNotificationState {
  /** The word currently being spoken. */
  title: string;
  /** Position within the playlist, e.g. "Word 3 of 20". */
  body: string;
  isPlaying: boolean;
}

/**
 * Shows or updates the playback notification, starting the foreground service
 * on first call. Re-displaying with the same id updates in place.
 */
export async function showPlaybackNotification(
  state: PlaybackNotificationState
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannel();
  } catch {
    channel = null; // let a later attempt retry rather than caching the failure
    return;
  }
  // Never let a notification failure propagate into the playback loop.
  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: state.title,
    body: state.body,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      foregroundServiceTypes: [
        AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
      ],
      category: AndroidCategory.TRANSPORT,
      // Show the word on the lock screen rather than hiding it behind a
      // "contents hidden" placeholder.
      visibility: AndroidVisibility.PUBLIC,
      ongoing: true,
      // Without this every playlist advance would re-alert the shade.
      onlyAlertOnce: true,
      showTimestamp: false,
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: state.isPlaying ? 'Pause' : 'Play', pressAction: { id: 'toggle' } },
        { title: 'Next', pressAction: { id: 'next' } },
        { title: 'Stop', pressAction: { id: 'stop' } },
      ],
    },
  }).catch(() => undefined);
}

/** Tears down the service and its notification when playback ends. */
export async function hidePlaybackNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.stopForegroundService().catch(() => undefined);
  await notifee.cancelNotification(NOTIFICATION_ID).catch(() => undefined);
}
