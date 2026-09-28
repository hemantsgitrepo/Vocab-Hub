import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
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
import { ArrowLeft, Eye, EyeOff, Mail, Phone, User, X } from 'lucide-react-native';
import { AppColors } from '../../theme';
import { useAppTheme } from '../../ThemeContext';
import { AppleLogo, GoogleLogo } from '../../ui/BrandLogos';
import { useAppDialogs } from '../../ui/AppDialogs';
import { playSfx } from '../../lib/sfx';
import {
  WebOAuthProvider,
  appleSignInAvailable,
  completeProfile,
  finalizeOtpSignUp,
  isEmailTaken,
  isMobileTaken,
  sendEmailOtp,
  signInWithApple,
  signInWithOAuth,
  signInWithPassword,
  signOut,
  updatePassword,
  verifyEmailOtp,
} from '../../lib/auth';
import { getNotifyEmail, setNotifyEmail, setNotifyEnabled } from '../../db/settings';
import { sendWelcomeEmail } from '../../services/emailService';
import { useSession } from '../../hooks';

// ---------------------------------------------------------------------------
// Optional sign-in sheet. Nothing in the core app requires an account — this
// is reachable from Settings for whoever wants one. Email OTP needs no
// external setup; the OAuth buttons will surface a clear Supabase error until
// their providers are configured with real credentials in the dashboard.
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Renders as a plain full screen instead of a dismissible modal, with no
   * close button — used as the mandatory sign-in gate at app start, where
   * there is nothing to go back to.
   */
  standalone?: boolean;
  /**
   * Signed in (via Google/Apple) but the profile is missing details we only
   * collect in our own sign-up form. Opens straight into "finish signing up"
   * with the provider's email locked in.
   */
  completingProfile?: boolean;
  /** Called once a completing-profile submit succeeds, so the gate re-checks. */
  onProfileCompleted?: () => void;
}

type AuthMode = 'password' | 'otp';
type OtpStep = 'email' | 'code' | 'newPassword';

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

// Icon-only pills, so the row stays balanced whichever providers are shown.

export default function SignInScreen({
  visible,
  onClose,
  standalone = false,
  completingProfile = false,
  onProfileCompleted,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const dialogs = useAppDialogs();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<AuthMode>('password'); // Password works locally; OTP needs SMTP
  // Defaults to login: Google/Apple sit here so a returning user can just
  // tap straight in, and a new user is one tap away from "Create one".
  const [isSignUp, setIsSignUp] = useState(false);
  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  // True when the OTP flow was reached via "Forgot password?" rather than
  // the OTP tab directly — changes copy and what happens after the code
  // verifies (set a new password, instead of just signing in).
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  // Sign-up only: collected once at account creation.
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Sign-up is two steps now: details -> emailed OTP -> account created.
  const [signUpStep, setSignUpStep] = useState<'details' | 'verify'>('details');
  const [signUpCode, setSignUpCode] = useState('');

  const { session } = useSession();

  // completingProfile is reached already signed in (via Google/Apple) — pull
  // in whatever the provider gave us so the user isn't asked to retype it,
  // and so the email field (locked below) doesn't render empty.
  useEffect(() => {
    if (!completingProfile || !session) return;
    setEmail(session.user.email ?? '');
    const metaName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name;
    if (metaName) setFullName(metaName);
  }, [completingProfile, session]);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<WebOAuthProvider | 'apple' | null>(null);

  const reset = () => {
    setMode('password');
    setOtpStep('email');
    setIsPasswordReset(false);
    setEmail('');
    setPassword('');
    setCode('');
    setNewPassword('');
    setFullName('');
    setMobile('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSignUpStep('details');
    setSignUpCode('');
    setIsSignUp(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  // ----- Password (email + password sign-up/login) -----

  /** Finishing an OAuth sign-up — only the missing details are asked for. */
  const submitProfileCompletion = async () => {
    const nameTrimmed = fullName.trim();
    const mobileDigits = mobile.replace(/\D/g, '');
    if (nameTrimmed.length < 2) {
      dialogs.toast('Enter your full name.', { kind: 'error' });
      return;
    }
    if (mobileDigits.length < 10) {
      dialogs.toast('Enter a valid mobile number (at least 10 digits).', { kind: 'error' });
      return;
    }

    setSending(true);
    try {
      if (await isMobileTaken(mobileDigits)) {
        dialogs.toast('This mobile number is already registered with another account.', {
          kind: 'error',
        });
        return;
      }
      await completeProfile(nameTrimmed, mobileDigits);
      dialogs.toast("You're all set.", { kind: 'success' });
      onProfileCompleted?.();
    } catch (e: any) {
      console.error('PROFILE_COMPLETE_ERROR', e);
      dialogs.toast(friendlyAuthError(e, true), { kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  /** Step 1 of sign-up: validate everything, then email a verification code. */
  const startSignUp = async () => {
    const emailTrimmed = email.trim();
    const nameTrimmed = fullName.trim();
    const mobileDigits = mobile.replace(/\D/g, '');

    if (nameTrimmed.length < 2) {
      dialogs.toast('Enter your full name.', { kind: 'error' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      dialogs.toast('Enter a valid email address.', { kind: 'error' });
      return;
    }
    if (mobileDigits.length < 10) {
      dialogs.toast('Enter a valid mobile number (at least 10 digits).', { kind: 'error' });
      return;
    }
    if (password.length < 6) {
      dialogs.toast('Password must be at least 6 characters.', { kind: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      dialogs.toast("Passwords don't match.", { kind: 'error' });
      return;
    }

    setSending(true);
    try {
      // Both checked before any account exists, so duplicates fail cleanly
      // instead of leaving a half-created user behind.
      if (await isEmailTaken(emailTrimmed)) {
        dialogs.toast('This email is already registered — sign in instead.', { kind: 'error' });
        setIsSignUp(false);
        return;
      }
      if (await isMobileTaken(mobileDigits)) {
        dialogs.toast('This mobile number is already registered with another account.', {
          kind: 'error',
        });
        return;
      }
      await sendEmailOtp(emailTrimmed);
      setSignUpStep('verify');
      dialogs.toast(`Verification code sent to ${emailTrimmed}.`, { kind: 'success' });
    } catch (e: any) {
      console.error('SIGNUP_OTP_ERROR', e);
      dialogs.toast(friendlyAuthError(e, true), { kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  /** Step 2 of sign-up: the code proves the email, then the account is set up. */
  const verifySignUp = async () => {
    if (signUpCode.trim().length < 6) {
      dialogs.toast('Enter the 6-digit code from your email.', { kind: 'error' });
      return;
    }
    const emailTrimmed = email.trim();
    const mobileDigits = mobile.replace(/\D/g, '');

    setVerifying(true);
    try {
      // Verifying the code both creates the account and signs them in; the
      // password and details they chose are applied straight after.
      const session = await verifyEmailOtp(emailTrimmed, signUpCode);
      if (!session) {
        dialogs.toast("That code didn't work. Check it and try again.", { kind: 'error' });
        return;
      }
      await finalizeOtpSignUp(password, fullName.trim(), mobileDigits);

      dialogs.toast('Email verified — your account is ready.', { kind: 'success' });
      // First-time convenience: default the notification email to the one
      // they just verified, then send the welcome email.
      const existingNotifyEmail = await getNotifyEmail();
      if (!existingNotifyEmail) {
        await setNotifyEmail(emailTrimmed);
        await setNotifyEnabled(true);
      }
      sendWelcomeEmail().catch((e) => console.error('WELCOME_EMAIL_ERROR', e));
      close();
    } catch (e: any) {
      console.error('SIGNUP_VERIFY_ERROR', e);
      dialogs.toast(friendlyAuthError(e, true), { kind: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const submitSignIn = async () => {
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
      const session = await signInWithPassword(emailTrimmed, password);
      if (session) {
        dialogs.toast("You're signed in.", { kind: 'success' });
        close();
      }
    } catch (e: any) {
      console.error('PASSWORD_AUTH_ERROR', e);
      dialogs.toast(friendlyAuthError(e, false), { kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  const submitPassword = () => {
    if (completingProfile) return submitProfileCompletion();
    if (!isSignUp) return submitSignIn();
    return signUpStep === 'details' ? startSignUp() : verifySignUp();
  };

  // ----- Forgot password (reuses the OTP flow to re-authenticate, then
  // lets the user set a new password) -----

  const startForgotPassword = () => {
    setIsPasswordReset(true);
    setMode('otp');
    setOtpStep('email');
    // Carry over whatever email they'd already typed in the password form.
  };

  /** Backs out of "Forgot password" to plain sign-in — the header back
   * arrow and the hardware back button both route through this. */
  const cancelPasswordReset = () => {
    setIsPasswordReset(false);
    setMode('password');
    setIsSignUp(false);
    setOtpStep('email');
    setCode('');
    setNewPassword('');
  };

  // In the mandatory standalone gate there's no navigation stack to pop, so
  // Android's hardware back button exits the app by default — including
  // mid "Forgot password", where that's surprising. Intercept it there and
  // treat it the same as tapping the header's back arrow; everywhere else,
  // fall through to the normal (app-exiting) behaviour.
  useEffect(() => {
    if (!standalone) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isPasswordReset) {
        cancelPasswordReset();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [standalone, isPasswordReset]);

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
        if (isPasswordReset) {
          // Verifying the code already signed them back in — now let them
          // pick a new password instead of closing the sheet.
          setOtpStep('newPassword');
        } else {
          dialogs.toast("You're signed in.", { kind: 'success' });
          close();
        }
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

  const submitNewPassword = async () => {
    if (newPassword.length < 6) {
      dialogs.toast('Password must be at least 6 characters.', { kind: 'error' });
      return;
    }
    setVerifying(true);
    try {
      await updatePassword(newPassword);
      dialogs.toast('Password updated — you\'re signed in.', { kind: 'success' });
      close();
    } catch (e: any) {
      console.error('PASSWORD_UPDATE_ERROR', e);
      dialogs.toast(e?.message ?? 'Could not update your password. Try again.', {
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
      // iOS gets Apple's native sheet (which Apple requires there); Android
      // has no native Apple auth, so it goes through the same web OAuth flow
      // as the other providers.
      const session = appleSignInAvailable
        ? await signInWithApple()
        : await signInWithOAuth('apple');
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

  const body = (
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
            {mode === 'otp' && otpStep !== 'newPassword' ? (
              <Pressable
                onPress={() => {
                  // At the email step there's nowhere further back except
                  // out of the OTP flow entirely (whether that flow was
                  // "Forgot password" or the plain "Email OTP" tab); past
                  // that, back goes to re-entering the email.
                  if (otpStep === 'email') {
                    if (isPasswordReset) cancelPasswordReset();
                    else setMode('password');
                    return;
                  }
                  setOtpStep('email');
                }}
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
                  ? isPasswordReset
                    ? 'Reset password'
                    : 'Sign in with OTP'
                  : otpStep === 'code'
                    ? 'Enter your code'
                    : 'Set a new password'}
            </Text>
            {standalone ? (
              // Mandatory gate: nothing to close back to.
              <View style={styles.closeBtn} />
            ) : (
              <Pressable
                onPress={close}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.closeBtn}
              >
                <X size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {mode === 'password' ? (
              // PASSWORD MODE (email + password) — fields always visible;
              // a link at the bottom toggles between create-account and sign-in
              // so nothing is hidden behind an extra tap.
              <>
                <Text variant="bodyMedium" style={styles.hint}>
                  {completingProfile
                    ? 'Almost there — we just need a few details to finish setting up your account.'
                    : isSignUp
                      ? signUpStep === 'details'
                        ? "Create your account to get started. We'll email you a code to verify your address."
                        : `Enter the 6-digit code we sent to ${email.trim()} to finish creating your account.`
                      : 'Welcome back. Sign in to continue.'}
                </Text>

                {/* Sign-up step 2 is just the emailed code. */}
                {isSignUp && signUpStep === 'verify' && !completingProfile ? (
                  <TextInput
                    mode="outlined"
                    label="6-digit code"
                    value={signUpCode}
                    onChangeText={setSignUpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.input}
                    editable={!verifying}
                  />
                ) : (
                  <>
                    {(isSignUp || completingProfile) && (
                      <TextInput
                        mode="outlined"
                        label="Full name"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                        autoComplete="name"
                        left={
                          <TextInput.Icon icon={() => <User size={20} color={colors.primary} />} />
                        }
                        style={styles.input}
                        editable={!sending}
                      />
                    )}

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
                      // Locked when it came from the OAuth provider.
                      editable={!sending && !completingProfile}
                    />

                    {(isSignUp || completingProfile) && (
                      <TextInput
                        mode="outlined"
                        label="Mobile number"
                        value={mobile}
                        onChangeText={setMobile}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        left={
                          <TextInput.Icon icon={() => <Phone size={20} color={colors.primary} />} />
                        }
                        style={styles.input}
                        editable={!sending}
                      />
                    )}

                    {/* An OAuth account already has its own credential —
                        there's no password for us to set here. */}
                    {!completingProfile && (
                      <TextInput
                        mode="outlined"
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        right={
                          <TextInput.Icon
                            icon={() =>
                              showPassword ? (
                                <EyeOff size={20} color={colors.muted} />
                              ) : (
                                <Eye size={20} color={colors.muted} />
                              )
                            }
                            onPress={() => setShowPassword((v) => !v)}
                            forceTextInputFocus={false}
                          />
                        }
                        style={styles.input}
                        editable={!sending}
                      />
                    )}

                    {isSignUp && !completingProfile && (
                      <TextInput
                        mode="outlined"
                        label="Confirm password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        right={
                          <TextInput.Icon
                            icon={() =>
                              showConfirmPassword ? (
                                <EyeOff size={20} color={colors.muted} />
                              ) : (
                                <Eye size={20} color={colors.muted} />
                              )
                            }
                            onPress={() => setShowConfirmPassword((v) => !v)}
                            forceTextInputFocus={false}
                          />
                        }
                        style={styles.input}
                        editable={!sending}
                        error={confirmPassword.length > 0 && confirmPassword !== password}
                      />
                    )}
                  </>
                )}

                <Pressable
                  onPress={submitPassword}
                  disabled={sending || verifying}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.primaryBtnWrap, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.violet]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtn}
                  >
                    {sending || verifying ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text variant="titleMedium" style={styles.primaryBtnText}>
                        {completingProfile
                          ? 'Finish setup'
                          : !isSignUp
                            ? 'Sign in'
                            : signUpStep === 'details'
                              ? 'Send verification code'
                              : 'Verify & create account'}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>

                {/* Escape hatch: this screen has no back/close button, so a
                    wrong-account sign-in (or someone who just isn't ready to
                    finish setup right now) needs a way out other than being
                    stuck here. */}
                {completingProfile && (
                  <Pressable
                    onPress={async () => {
                      try {
                        await signOut();
                      } catch (e) {
                        console.error('SIGN_OUT_ERROR', e);
                        dialogs.toast('Could not sign out. Try again.', { kind: 'error' });
                      }
                    }}
                    disabled={sending}
                    style={styles.resendBtn}
                  >
                    <Text variant="labelLarge" style={styles.resendText}>
                      Not you? Sign out
                    </Text>
                  </Pressable>
                )}

                {/* Step 2 of sign-up: resend, or go back and fix a typo'd email. */}
                {isSignUp && signUpStep === 'verify' && !completingProfile && (
                  <>
                    <Pressable onPress={startSignUp} disabled={sending} style={styles.resendBtn}>
                      <Text variant="labelLarge" style={styles.resendText}>
                        {sending ? 'Resending…' : 'Resend code'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setSignUpStep('details')}
                      disabled={sending || verifying}
                      style={styles.forgotBtn}
                    >
                      <Text variant="labelMedium" style={styles.forgotText}>
                        Change details
                      </Text>
                    </Pressable>
                  </>
                )}

                {!completingProfile && signUpStep === 'details' && (
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
                )}

                {!isSignUp && !completingProfile && (
                  <Pressable
                    onPress={startForgotPassword}
                    disabled={sending}
                    style={styles.forgotBtn}
                  >
                    <Text variant="labelMedium" style={styles.forgotText}>
                      Forgot password?
                    </Text>
                  </Pressable>
                )}
              </>
            ) : (
              // OTP MODE (email + 6-digit code)
              <>
                {otpStep === 'email' ? (
                  <>
                    <Text variant="bodyMedium" style={styles.hint}>
                      {isPasswordReset
                        ? "Enter your account's email and we'll send a code to verify it's you, then you can set a new password."
                        : 'A magic link will be sent to your email. Requires SMTP configured in Supabase.'}
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
                ) : otpStep === 'code' ? (
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
                ) : (
                  // newPassword — reached only via Forgot password, after the
                  // code verified. They're already signed back in at this point.
                  <>
                    <Text variant="bodyMedium" style={styles.hint}>
                      Code verified. Choose a new password for your account.
                    </Text>

                    <TextInput
                      mode="outlined"
                      label="New password"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      style={styles.input}
                      editable={!verifying}
                    />

                    <Pressable
                      onPress={submitNewPassword}
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
                            Save new password
                          </Text>
                        )}
                      </LinearGradient>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {/* Hidden mid-reset, mid-profile-completion, and on the sign-up
                form — each of those is a single focused task, and Google/Apple
                sign-up is handled from the sign-in side instead. */}
            {!isPasswordReset && !completingProfile && !(mode === 'password' && isSignUp) && (
              <>
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

                <View style={styles.oauthRow}>
                  <Pressable
                    onPress={() => doOAuth('google')}
                    disabled={oauthBusy !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Google"
                    style={({ pressed }) => [styles.oauthPill, pressed && styles.pressed]}
                  >
                    {oauthBusy === 'google' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <GoogleLogo size={22} />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={doApple}
                    disabled={oauthBusy !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Apple"
                    style={({ pressed }) => [styles.oauthPill, pressed && styles.pressed]}
                  >
                    {oauthBusy === 'apple' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      // Apple's mark inverts on dark rather than taking a colour.
                      <AppleLogo size={22} color={isDark ? '#FFFFFF' : '#000000'} />
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
  );

  // Gate mode renders inline (nothing to dismiss); Settings still opens it
  // as a dismissible modal.
  if (standalone) return body;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      {body}
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
    forgotBtn: { marginTop: 4, alignItems: 'center', padding: 8 },
    forgotText: { color: colors.muted, fontWeight: '600' },
    tabRow: { flexDirection: 'row', gap: 8, marginVertical: 16 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
    tabActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    tabText: { color: colors.muted, fontWeight: '600', textAlign: 'center' },
    tabTextActive: { color: colors.primary },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.muted },
    oauthRow: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
    oauthPill: {
      flex: 1,
      maxWidth: 132,
      height: 52,
      borderRadius: 26,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
