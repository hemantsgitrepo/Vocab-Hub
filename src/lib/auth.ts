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
export type WebOAuthProvider = 'google' | 'github' | 'azure' | 'apple';

const redirectTo = makeRedirectUri({ scheme: 'vocabhub', path: 'auth-callback' });

// ----- Email + Password (traditional auth) ---------------------------------

/**
 * Is this mobile number already attached to another account? Answered by a
 * SECURITY DEFINER function in Postgres, so it can say yes/no without
 * exposing whose account holds it. Checked before signUp so a duplicate
 * surfaces as a friendly message instead of a raw database error.
 */
export async function isMobileTaken(mobile: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_mobile_taken', {
    p_mobile: mobile.trim(),
  });
  if (error) throw error;
  return data === true;
}

/** Same idea for email — checked before the sign-up OTP goes out. */
export async function isEmailTaken(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_email_taken', {
    p_email: email.trim(),
  });
  if (error) throw error;
  return data === true;
}

export interface Profile {
  id: string;
  full_name: string | null;
  mobile_number: string | null;
  email: string | null;
}

/** The signed-in user's profile row, or null if there isn't one yet. */
export async function fetchProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const id = userData.user?.id;
  if (!id) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, mobile_number, email')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

/**
 * Fills in the details an OAuth sign-up can't collect (mobile number, and a
 * name if the provider didn't supply one). Writes to both the profile row
 * and the auth user's metadata so either source reads the same.
 */
export async function completeProfile(fullName: string, mobileNumber: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const id = userData.user?.id;
  if (!id) throw new Error('You are not signed in.');

  // Upsert, not update: accounts created before the profile trigger existed
  // have no row yet, and an UPDATE against nothing silently succeeds — which
  // would leave them stuck on the setup screen forever.
  const { error: profileError } = await supabase.from('profiles').upsert({
    id,
    full_name: fullName.trim(),
    mobile_number: mobileNumber.trim(),
    email: userData.user?.email ?? null,
  });
  if (profileError) throw profileError;

  const { error: userError } = await supabase.auth.updateUser({
    data: { full_name: fullName.trim(), mobile_number: mobileNumber.trim() },
  });
  if (userError) throw userError;
}

/**
 * Finishes an OTP-verified sign-up: the account already exists at this point
 * (verifying the code created and signed them in), so this sets the password
 * they chose and records their name and mobile number.
 */
export async function finalizeOtpSignUp(
  password: string,
  fullName: string,
  mobileNumber: string
): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password,
    data: { full_name: fullName.trim(), mobile_number: mobileNumber.trim() },
  });
  if (error) throw error;

  // The profile row was created by the trigger at OTP-verification time,
  // before any of these details existed — fill them in now. Upsert covers
  // the case where no row exists at all (pre-trigger accounts).
  const { data: userData } = await supabase.auth.getUser();
  const id = userData.user?.id;
  if (!id) return;
  const { error: profileError } = await supabase.from('profiles').upsert({
    id,
    full_name: fullName.trim(),
    mobile_number: mobileNumber.trim(),
    email: userData.user?.email ?? null,
  });
  if (profileError) throw profileError;
}

/**
 * Sign up with email + password. Creates a new account.
 * Works immediately without waiting for email verification.
 *
 * `fullName` and `mobileNumber` ride along as user metadata; a Postgres
 * trigger copies them into `public.profiles`, where mobile_number carries a
 * UNIQUE constraint so one number can't back two accounts.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  fullName?: string,
  mobileNumber?: string
) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: undefined, // Local app, no email redirect needed
      data: {
        full_name: fullName?.trim() || undefined,
        mobile_number: mobileNumber?.trim() || undefined,
      },
    },
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

/**
 * Sets a new password for the currently-authenticated user. Used by the
 * "Forgot password" flow: verify an email OTP first (which signs the user
 * back in even without knowing their old password), then call this to set
 * a new one.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
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

// ----- Account deletion ---------------------------------------------------------

/**
 * Permanently deletes the signed-in user's account and profile row via the
 * delete-account Edge Function — the service_role key it needs can never live
 * in this app. On success, also signs out locally so nothing keeps trying to
 * use the now-deleted session. Caller is responsible for clearing local
 * WatermelonDB data (words, streak, etc.) since that lives on-device and this
 * function only touches the server side.
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  if (data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  // The account is gone server-side; drop the local session too so the app
  // doesn't keep holding a token for a user that no longer exists.
  await supabase.auth.signOut();
}
