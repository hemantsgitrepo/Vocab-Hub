// ---------------------------------------------------------------------------
// Supabase Auth wrappers — every sign-in method the app supports funnels
// through here so screens stay thin. Account state is intentionally separate
// from the offline-first word data: the app remains fully usable with no
// account, per the consent screen's own promise ("no account is required to
// use the core app").
// ---------------------------------------------------------------------------
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabaseClient';

// Completes any pending browser-based auth session when the app regains focus.
WebBrowser.maybeCompleteAuthSession();

/**
 * Providers configured through Supabase's generic OAuth flow (a web consent
 * page opened in an in-app browser tab, then exchanged for a session). Each
 * needs real client credentials added in Supabase Dashboard -> Authentication
 * -> Providers before this will do anything but return a Supabase error.
 */
export type WebOAuthProvider = 'google' | 'github' | 'azure';

const redirectTo = makeRedirectUri({ scheme: 'vocabhub', path: 'auth-callback' });

// ----- Email + Password (traditional auth) ---------------------------------

/**
 * Sign up with email + password. Creates a new account.
 * Works immediately without waiting for email verification.
 */
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: undefined }, // Local app, no email redirect needed
  });
  if (error) throw error;

  // Supabase quietly returns a 200 with no error for a duplicate email (it
  // does this on purpose, to avoid letting an attacker probe which emails
  // are registered) — the only tell is an empty `identities` array on the
  // returned user. Surface that as a real error so the UI can point the
  // user at "sign in" instead of showing a false "account created".
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    const err: any = new Error('An account with that email already exists.');
    err.code = 'user_already_exists';
    throw err;
  }

  return data.session; // May be null if email verification is required
}

/**
 * Sign in with email + password (existing account).
 */
export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data.session;
}

// ----- Email OTP (passwordless) ---------------------------------------------

/**
 * Sends a 6-digit one-time code to the given email — no password anywhere in
 * this flow. `shouldCreateUser: true` means a first-time email doubles as
 * sign-up. NOTE: Requires SMTP configured in Supabase — will fail if emails
 * can't be sent. Use email + password as fallback for local development.
 */
export async function sendEmailOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Verifies the code the user typed in and completes sign-in. */
export async function verifyEmailOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });
  if (error) throw error;
  return data.session;
}

// ----- Web-based OAuth (Google / GitHub / Microsoft Azure AD) ---------------

/**
 * Opens the provider's consent page in an in-app browser tab (not a webview
 * — required so the OS can share cookies/passkeys with the user's real
 * browser), then exchanges the redirect back into a session.
 */
export async function signInWithOAuth(provider: WebOAuthProvider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return an authorization URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') return null; // user backed out, not an error
  if (result.type !== 'success' || !result.url) {
    throw new Error('Sign-in was not completed.');
  }
  return applySessionFromUrl(result.url);
}

async function applySessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

// ----- Apple (native "Sign in with Apple", required for App Store review) ---

export const appleSignInAvailable = Platform.OS === 'ios';

/**
 * Uses the native Apple sheet + Apple's own button component rather than a
 * web redirect — Apple requires the native flow (and its exact button style)
 * on iOS whenever other social sign-in options are offered.
 */
export async function signInWithApple() {
  if (!appleSignInAvailable) throw new Error('Sign in with Apple is only available on iOS.');
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  return data.session;
}

// ----- Sign-out ---------------------------------------------------------------

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
