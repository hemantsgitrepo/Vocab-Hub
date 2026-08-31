import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ArrowLeft, Mail, X } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../ThemeContext';
import { useAppDialogs } from '../../ui/AppDialogs';
import { playSfx } from '../../lib/sfx';
import {
  WebOAuthProvider,
  appleSignInAvailable,
  sendEmailOtp,
  signInWithApple,
  signInWithOAuth,
  signInWithPassword,
  signUpWithPassword,
  verifyEmailOtp,
} from '../../lib/auth';
import { getNotifyEmail, setNotifyEmail, setNotifyEnabled } from '../../db/settings';
import { sendWelcomeEmail } from '../../services/emailService';

// ---------------------------------------------------------------------------
// Optional sign-in sheet. Nothing in the core app requires an account — this
// is reachable from Settings for whoever wants one. Email OTP needs no
// external setup; the OAuth buttons will surface a clear Supabase error until
// their providers are configured with real credentials in the dashboard.
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  onClose: () => void;
}

type AuthMode = 'password' | 'otp';
type OtpStep = 'email' | 'code';

/** Turns Supabase's terse auth error codes into something a user can act on. */
function friendlyAuthError(e: any, isSignUp: boolean): string {
  const code = e?.code as string | undefined;
  const message = (e?.message as string | undefined) ?? '';

  if (code === 'invalid_credentials' || message.includes('Invalid login credentials')) {
    return "No account matches that email and password. If you're new, tap \"Don't have an account? Create one\" below.";
  }
  if (
    code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('already exists')
  ) {
    return 'An account with this email already exists — switched you to "Sign in". Enter your password and tap Sign in.';
  }
  if (code === 'weak_password' || message.includes('Password should be')) {
    return 'That password is too weak. Use at least 6 characters.';
  }
  if (code === 'email_not_confirmed' || message.includes('Email not confirmed')) {
    return 'Confirm your email first (check your inbox), or turn off "Confirm email" in Supabase for local testing.';
  }
  if (message.includes('Network request failed') || message.includes('fetch')) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }
  return message || `${isSignUp ? 'Sign up' : 'Sign in'} failed. Try again.`;
}

const WEB_PROVIDERS: { key: WebOAuthProvider; label: string; initial: string; tint: string }[] = [
  { key: 'google', label: 'Continue with Google', initial: 'G', tint: '#EA4335' },
  { key: 'github', label: 'Continue with GitHub', initial: 'H', tint: '#24292E' },
  { key: 'azure', label: 'Continue with Microsoft', initial: 'M', tint: '#00A4EF' },
];

export default function SignInScreen({ visible, onClose }: Props) {
  const { colors, isDark } = useAppTheme();
  const dialogs = useAppDialogs();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<AuthMode>('password'); // Password works locally; OTP needs SMTP
  const [isSignUp, setIsSignUp] = useState(true);
  const [otpStep, setOtpStep] = useState<OtpStep>('email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<WebOAuthProvider | 'apple' | null>(null);

  const reset = () => {
    setMode('password');
    setOtpStep('email');
    setEmail('');
    setPassword('');
    setCode('');
    setIsSignUp(true);
  };

  const close = () => {
    reset();
    onClose();
  };

  // ----- Password (email + password sign-up/login) -----

  const submitPassword = async () => {
    const emailTrimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      dialogs.toast('Enter a valid email address.', { kind: 'error' });
      return;
    }
    if (password.length < 6) {
      dialogs.toast('Password must be at least 6 characters.', { kind: 'error' });
      return;
    }

    setSending(true);
    try {
      if (isSignUp) {
        const session = await signUpWithPassword(emailTrimmed, password);
        if (session) {
          dialogs.toast('Account created — you\'re signed in.', { kind: 'success' });
          // First-time convenience: if the user never set a notification
          // email, default it to the one they just signed up with and turn
          // notifications on, then send the welcome email. Both are silent
          // no-ops if they'd already configured this themselves.
          const existingNotifyEmail = await getNotifyEmail();
          if (!existingNotifyEmail) {
            await setNotifyEmail(emailTrimmed);
            await setNotifyEnabled(true);
          }
          sendWelcomeEmail().catch((e) => console.error('WELCOME_EMAIL_ERROR', e));
          close();
        } else {
          // Supabase created the user but is waiting on email confirmation
          // (Authentication -> Providers -> Email -> "Confirm email" toggle).
          dialogs.toast(
            'Account created. Check your email to confirm it, or turn off "Confirm email" in Supabase for local testing.',
            { kind: 'info' }
          );
        }
      } else {
        const session = await signInWithPassword(emailTrimmed, password);
        if (session) {
          dialogs.toast("You're signed in.", { kind: 'success' });
          close();
        }
      }
    } catch (e: any) {
      console.error('PASSWORD_AUTH_ERROR', e);
      dialogs.toast(friendlyAuthError(e, isSignUp), { kind: 'error' });
      // Trying to create an account that already exists — switch the toggle
      // to sign-in for them so all that's left is re-tapping the button.
      if (isSignUp && e?.code === 'user_already_exists') {
        setIsSignUp(false);
      }
    } finally {
      setSending(false);
    }
  };

  // ----- OTP (email + 6-digit code) -----

  const sendCode = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      dialogs.toast('Enter a valid email address.', { kind: 'error' });
      return;
    }
    setSending(true);
    try {
      await sendEmailOtp(trimmed);
      setOtpStep('code');
      dialogs.toast(`Code sent to ${trimmed}.`, { kind: 'success' });
    } catch (e: any) {
      console.error('OTP_SEND_ERROR', e);
      dialogs.toast(e?.message ?? 'Could not send the code. Try again.', { kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (code.trim().length < 6) {
      dialogs.toast('Enter the 6-digit code from your email.', { kind: 'error' });
      return;
    }
    setVerifying(true);
    try {
      const session = await verifyEmailOtp(email, code);
      if (session) {
        dialogs.toast("You're signed in.", { kind: 'success' });
        close();
      }
    } catch (e: any) {
      console.error('OTP_VERIFY_ERROR', e);
      dialogs.toast(e?.message ?? "That code didn't work. Check it and try again.", {
        kind: 'error',
      });
    } finally {
      setVerifying(false);
    }
  };

  const doOAuth = async (provider: WebOAuthProvider) => {
    setOauthBusy(provider);
    try {
      const session = await signInWithOAuth(provider);
      if (session) {
        dialogs.toast("You're signed in.", { kind: 'success' });
        close();
      }
    } catch (e: any) {
      console.error('OAUTH_ERROR', provider, e);
      dialogs.toast(
        e?.message ?? `Couldn't sign in with that provider. It may not be configured yet.`,
        { kind: 'error' }
      );
    } finally {
      setOauthBusy(null);
    }
  };

  const doApple = async () => {
    setOauthBusy('apple');
    try {
      const session = await signInWithApple();
      if (session) {
        dialogs.toast("You're signed in.", { kind: 'success' });
        close();
      }
    } catch (e: any) {
      // User cancelling the native sheet throws too — don't show that as an error.
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      console.error('APPLE_SIGNIN_ERROR', e);
      dialogs.toast(e?.message ?? 'Sign in with Apple failed.', { kind: 'error' });
    } finally {
      setOauthBusy(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <LinearGradient
            colors={[colors.primary, colors.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            {mode === 'otp' && otpStep !== 'email' ? (
              <Pressable
                onPress={() => setOtpStep('email')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={styles.backBtn}
              >
                <ArrowLeft size={18} color="#FFFFFF" />
              </Pressable>
            ) : (
              <View style={styles.backBtn} />
            )}
            <Text variant="titleLarge" style={styles.heroTitle}>
              {mode === 'password'
                ? isSignUp
                  ? 'Create account'
                  : 'Sign in'
                : otpStep === 'email'
                  ? 'Sign in with OTP'
                  : 'Enter your code'}
            </Text>
            <Pressable
              onPress={close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <X size={18} color="#FFFFFF" />
            </Pressable>
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {mode === 'password' ? (
              // PASSWORD MODE (email + password) — fields always visible;
              // a link at the bottom toggles between create-account and sign-in
              // so nothing is hidden behind an extra tap.
              <>
                <Text variant="bodyMedium" style={styles.hint}>
                  Signing in is optional — your words stay on this device either
                  way. An account just lets us reach you about your progress.
                </Text>

                <TextInput
                  mode="outlined"
                  label="Email address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  left={<TextInput.Icon icon={() => <Mail size={20} color={colors.primary} />} />}
                  style={styles.input}
                  editable={!sending}
                />

                <TextInput
                  mode="outlined"
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.input}
                  editable={!sending}
                />

                <Pressable
                  onPress={submitPassword}
                  disabled={sending}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.primaryBtnWrap, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.violet]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtn}
                  >
                    {sending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text variant="titleMedium" style={styles.primaryBtnText}>
                        {isSignUp ? 'Create account' : 'Sign in'}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={() => setIsSignUp(!isSignUp)}
                  disabled={sending}
                  style={styles.resendBtn}
                >
                  <Text variant="labelLarge" style={styles.resendText}>
                    {isSignUp
                      ? 'Already have an account? Sign in'
                      : "Don't have an account? Create one"}
                  </Text>
                </Pressable>
              </>
            ) : (
              // OTP MODE (email + 6-digit code)
              <>
                {otpStep === 'email' ? (
                  <>
                    <Text variant="bodyMedium" style={styles.hint}>
                      A magic link will be sent to your email. Requires SMTP
                      configured in Supabase.
                    </Text>

                    <TextInput
                      mode="outlined"
                      label="Email address"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      left={
                        <TextInput.Icon
                          icon={() => <Mail size={20} color={colors.primary} />}
                        />
                      }
                      style={styles.input}
                      editable={!sending}
                    />

                    <Pressable
                      onPress={sendCode}
                      disabled={sending}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.primaryBtnWrap,
                        pressed && styles.pressed,
                      ]}
                    >
                      <LinearGradient
                        colors={[colors.primary, colors.violet]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryBtn}
                      >
                        {sending ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text variant="titleMedium" style={styles.primaryBtnText}>
                            Send code
                          </Text>
                        )}
                      </LinearGradient>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text variant="bodyMedium" style={styles.hint}>
                      We sent a 6-digit code to {email}. It expires shortly, so enter
                      it soon.
                    </Text>

                    <TextInput
                      mode="outlined"
                      label="6-digit code"
                      value={code}
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={styles.input}
                      editable={!verifying}
                    />

                    <Pressable
                      onPress={verifyCode}
                      disabled={verifying}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.primaryBtnWrap,
                        pressed && styles.pressed,
                      ]}
                    >
                      <LinearGradient
                        colors={[colors.primary, colors.violet]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryBtn}
                      >
                        {verifying ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text variant="titleMedium" style={styles.primaryBtnText}>
                            Verify &amp; continue
                          </Text>
                        )}
                      </LinearGradient>
                    </Pressable>

                    <Pressable
                      onPress={sendCode}
                      disabled={sending}
                      style={styles.resendBtn}
                    >
                      <Text variant="labelLarge" style={styles.resendText}>
                        {sending ? 'Resending…' : 'Resend code'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {/* Auth method tabs */}
            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setMode('password')}
                style={[styles.tab, mode === 'password' && styles.tabActive]}
              >
                <Text
                  variant="labelLarge"
                  style={[
                    styles.tabText,
                    mode === 'password' && styles.tabTextActive,
                  ]}
                >
                  Email + Password
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('otp')}
                style={[styles.tab, mode === 'otp' && styles.tabActive]}
              >
                <Text
                  variant="labelLarge"
                  style={[styles.tabText, mode === 'otp' && styles.tabTextActive]}
                >
                  Email OTP
                </Text>
              </Pressable>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text variant="labelMedium" style={styles.dividerText}>
                or continue with
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {WEB_PROVIDERS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => doOAuth(p.key)}
                disabled={oauthBusy !== null}
                accessibilityRole="button"
                style={({ pressed }) => [styles.oauthBtn, pressed && styles.pressed]}
              >
                <View style={[styles.oauthBadge, { backgroundColor: p.tint }]}>
                  <Text style={styles.oauthBadgeText}>{p.initial}</Text>
                </View>
                <Text variant="titleSmall" style={styles.oauthText}>
                  {p.label}
                </Text>
                {oauthBusy === p.key && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </Pressable>
            ))}

            {appleSignInAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={
                  isDark
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={16}
                style={styles.appleBtn}
                onPress={doApple}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 16,
    },
    heroTitle: { color: '#FFFFFF', fontWeight: '800' },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#FFFFFF26',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { padding: 20, paddingBottom: 40 },
    hint: { color: colors.muted, lineHeight: 20, marginBottom: 18 },
    input: { marginBottom: 16 },
    primaryBtnWrap: { marginTop: 4 },
    primaryBtn: { borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '800' },
    secondaryBtnWrap: { marginTop: 10, borderRadius: 18, borderWidth: 1.5, borderColor: colors.primary, paddingVertical: 14 },
    secondaryBtnText: { color: colors.primary, fontWeight: '800', textAlign: 'center' },
    pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
    resendBtn: { marginTop: 16, alignItems: 'center', padding: 8 },
    resendText: { color: colors.primary, fontWeight: '700' },
    tabRow: { flexDirection: 'row', gap: 8, marginVertical: 16 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
    tabActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    tabText: { color: colors.muted, fontWeight: '600', textAlign: 'center' },
    tabTextActive: { color: colors.primary },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.muted },
    oauthBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 13,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    oauthBadge: {
      width: 22,
      height: 22,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    oauthBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
    oauthText: { color: colors.text, flex: 1 },
    appleBtn: { height: 48, marginTop: 2 },
  });
