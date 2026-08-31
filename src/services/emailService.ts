// ---------------------------------------------------------------------------
// Offline-resilient email queue. Every lifecycle email (welcome, milestone,
// streak, etc) is written to a local WatermelonDB row FIRST, then a send is
// attempted immediately. If the device is offline (or the send otherwise
// fails), the row stays 'pending' and is retried the next time connectivity
// returns — nothing is lost, nothing blocks the UI.
//
// The actual SMTP work happens server-side in the `send-email` Supabase Edge
// Function (see supabase/functions/send-email) — this file only ever talks
// to that function over HTTPS via the Supabase client. No SMTP credentials
// exist anywhere in the app.
// ---------------------------------------------------------------------------
import { Q } from '@nozbe/watermelondb';
import NetInfo from '@react-native-community/netinfo';
import { database, emailQueueCollection } from '../db';
import EmailQueueItem from '../db/models/EmailQueueItem';
import { getNotifyEmail, getNotifyEnabled } from '../db/settings';
import { supabase } from '../lib/supabaseClient';

const MAX_ATTEMPTS = 5;

let flushing = false;
let started = false;

/** Adds an email to the local outbox and immediately tries to send it. */
export async function queueEmail(
  to: string,
  subject: string,
  html: string,
  type: string
): Promise<void> {
  await database.write(() =>
    emailQueueCollection.create((item) => {
      item.toEmail = to.trim();
      item.subject = subject;
      item.html = html;
      item.emailType = type;
      item.status = 'pending';
      item.attempts = 0;
      item.lastError = null;
    })
  );
  // Best-effort immediate attempt — flushQueue() itself is safe to call
  // even with no connectivity, it just leaves the row 'pending'.
  flushQueue();
}

/** Attempts to send every 'pending' row. Safe to call repeatedly/concurrently. */
export async function flushQueue(): Promise<void> {
  if (flushing) return; // a flush is already in progress, this one is redundant
  flushing = true;
  try {
    const pending = await emailQueueCollection
      .query(Q.where('status', 'pending'))
      .fetch();

    for (const item of pending) {
      await attemptSend(item);
    }
  } catch (e) {
    console.error('EMAIL_QUEUE_FLUSH_ERROR', e);
  } finally {
    flushing = false;
  }
}

async function attemptSend(item: EmailQueueItem): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        to: item.toEmail,
        subject: item.subject,
        html: item.html,
        type: item.emailType,
      },
    });
    if (error) throw error;

    await database.write(() =>
      item.update((i) => {
        i.status = 'sent';
        i.sentAt = new Date();
      })
    );
  } catch (e: any) {
    const attempts = item.attempts + 1;
    console.error('EMAIL_SEND_ERROR', item.emailType, attempts, e);
    await database.write(() =>
      item.update((i) => {
        i.attempts = attempts;
        i.lastError = String(e?.message ?? e);
        // Give up after MAX_ATTEMPTS so a permanently-bad row (e.g. an
        // invalid address) doesn't retry forever on every reconnect.
        i.status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      })
    );
  }
}

/**
 * Call once at app startup. Flushes any rows left over from a previous
 * offline session, then wires up a listener so reconnecting to the network
 * automatically retries the queue.
 */
export function startEmailQueue(): void {
  if (started) return;
  started = true;

  flushQueue();

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      flushQueue();
    }
  });
}

// ----- Lifecycle email helpers ----------------------------------------------
// Each of these is a no-op if the user hasn't opted in (Settings -> Account
// -> Email notifications), so callers don't need to check that themselves.

async function targetEmail(): Promise<string | null> {
  const enabled = await getNotifyEnabled();
  if (!enabled) return null;
  const email = await getNotifyEmail();
  return email.trim() || null;
}

const emailShell = (title: string, body: string) => `
<div style="font-family: -apple-system, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  <h1 style="font-size: 20px; margin-bottom: 12px;">${title}</h1>
  <div style="font-size: 15px; line-height: 1.6;">${body}</div>
  <p style="margin-top: 32px; font-size: 12px; color: #888;">— Vocab Hub</p>
</div>`;

export async function sendWelcomeEmail(): Promise<void> {
  const to = await targetEmail();
  if (!to) return;
  await queueEmail(
    to,
    'Welcome to Vocab Hub! 🎉',
    emailShell(
      'Welcome to Vocab Hub!',
      "You're all set. Start adding words and we'll keep you posted on your milestones and streaks."
    ),
    'welcome'
  );
}

export async function sendMilestoneEmail(wordCount: number): Promise<void> {
  const to = await targetEmail();
  if (!to) return;
  await queueEmail(
    to,
    `You've hit ${wordCount} words! 🏆`,
    emailShell(
      `${wordCount} words and counting`,
      `Great progress — you've added ${wordCount} words to your personal dictionary. Keep going!`
    ),
    'milestone'
  );
}

export async function sendStreakEmail(streakDays: number): Promise<void> {
  const to = await targetEmail();
  if (!to) return;
  await queueEmail(
    to,
    `${streakDays}-day streak! 🔥`,
    emailShell(
      `${streakDays} days in a row`,
      `You've kept your daily goal for ${streakDays} days straight. Don't break the chain!`
    ),
    'streak'
  );
}
