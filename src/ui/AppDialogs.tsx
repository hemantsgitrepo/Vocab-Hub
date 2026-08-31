import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, CheckCircle2, Info, Trash2 } from 'lucide-react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../ThemeContext';

// ---------------------------------------------------------------------------
// App-wide replacements for OS alerts: an animated confirm dialog and a
// toast. Both are driven through context so any screen (or full-screen game
// modal) can call them — the dialog/toast opens its own native Modal layer,
// so it stacks above everything.
// ---------------------------------------------------------------------------

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling: coral header glow + coral confirm button. */
  destructive?: boolean;
}

export interface ToastOptions {
  kind?: 'success' | 'info' | 'error';
  duration?: number;
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, opts?: ToastOptions) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useAppDialogs(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useAppDialogs must be used within DialogProvider');
  return ctx;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

interface ActiveToast {
  id: number;
  message: string;
  kind: 'success' | 'info' | 'error';
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [toastItem, setToastItem] = useState<ActiveToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastId = useRef(0);

  const dialogAnim = useMemo(() => new Animated.Value(0), []);
  const toastAnim = useMemo(() => new Animated.Value(0), []);
  // Extra kind-specific flourish layered on top of the toast's entrance:
  // error toasts get a horizontal shake, success toasts get an icon "pop".
  const toastShake = useMemo(() => new Animated.Value(0), []);
  const toastIconPop = useMemo(() => new Animated.Value(1), []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
        Vibration.vibrate(12);
        dialogAnim.setValue(0);
        Animated.spring(dialogAnim, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }).start();
      }),
    [dialogAnim]
  );

  const dismiss = (ok: boolean) => {
    const current = pending;
    Animated.timing(dialogAnim, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setPending(null);
      current?.resolve(ok);
    });
  };

  const toast = useCallback(
    (message: string, opts?: ToastOptions) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      const item: ActiveToast = {
        id: ++toastId.current,
        message,
        kind: opts?.kind ?? 'success',
      };
      setToastItem(item);
      toastAnim.setValue(0);
      toastShake.setValue(0);
      toastIconPop.setValue(1);
      Animated.spring(toastAnim, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start(() => {
        if (item.kind === 'error') {
          Animated.sequence([
            Animated.timing(toastShake, {
              toValue: 1,
              duration: 45,
              useNativeDriver: true,
            }),
            Animated.timing(toastShake, {
              toValue: -1,
              duration: 90,
              useNativeDriver: true,
            }),
            Animated.timing(toastShake, {
              toValue: 0.6,
              duration: 90,
              useNativeDriver: true,
            }),
            Animated.timing(toastShake, {
              toValue: 0,
              duration: 70,
              useNativeDriver: true,
            }),
          ]).start();
        } else if (item.kind === 'success') {
          Animated.sequence([
            Animated.timing(toastIconPop, {
              toValue: 1.35,
              duration: 130,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.spring(toastIconPop, {
              toValue: 1,
              friction: 4,
              tension: 140,
              useNativeDriver: true,
            }),
          ]).start();
        }
      });
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start(() => {
          setToastItem((t) => (t?.id === item.id ? null : t));
        });
      }, opts?.duration ?? 2600);
    },
    [toastAnim, toastShake, toastIconPop]
  );

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const ToastIcon =
    toastItem?.kind === 'error'
      ? AlertTriangle
      : toastItem?.kind === 'info'
        ? Info
        : CheckCircle2;
  const toastTint =
    toastItem?.kind === 'error'
      ? colors.coral
      : toastItem?.kind === 'info'
        ? colors.violet
        : colors.sage;

  return (
    <DialogContext.Provider value={value}>
      {children}

      {/* ----- Confirm dialog ----- */}
      <Modal
        visible={pending !== null}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => dismiss(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => dismiss(false)}>
          <Pressable onPress={() => {}}>
            <Animated.View
              style={[
                styles.dialog,
                {
                  opacity: dialogAnim,
                  transform: [
                    {
                      scale: dialogAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 1],
                      }),
                    },
                    {
                      translateY: dialogAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [14, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {pending && (
                <>
                  <View
                    style={[
                      styles.dialogIconWrap,
                      {
                        backgroundColor:
                          (pending.destructive ? colors.coral : colors.violet) + '22',
                      },
                    ]}
                  >
                    {pending.destructive ? (
                      <Trash2 size={26} color={colors.coral} />
                    ) : (
                      <Info size={26} color={colors.violet} />
                    )}
                  </View>
                  <Text variant="titleLarge" style={styles.dialogTitle}>
                    {pending.title}
                  </Text>
                  <Text variant="bodyMedium" style={styles.dialogMessage}>
                    {pending.message}
                  </Text>
                  <View style={styles.dialogButtons}>
                    <Pressable
                      onPress={() => dismiss(false)}
                      style={({ pressed }) => [
                        styles.cancelBtn,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <Text variant="titleSmall" style={styles.cancelText}>
                        {pending.cancelLabel ?? 'Cancel'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => dismiss(true)}
                      style={({ pressed }) => [styles.confirmWrap, pressed && styles.btnPressed]}
                    >
                      <LinearGradient
                        colors={
                          pending.destructive
                            ? [colors.coral, colors.red]
                            : [colors.primary, colors.violet]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.confirmBtn}
                      >
                        <Text variant="titleSmall" style={styles.confirmText}>
                          {pending.confirmLabel ?? 'Confirm'}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </>
              )}
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ----- Toast -----
          Wrapped in its own transparent native Modal (not just an absolutely
          positioned View) so it renders in its own OS-level window layer.
          Without this, a toast fired while another screen's own <Modal> is
          open (e.g. the sign-in sheet) would render underneath that native
          modal's surface and be completely invisible — the screen would just
          look like nothing happened. box-none pointerEvents lets touches
          pass through to whatever is behind the toast itself. */}
      <Modal
        visible={toastItem !== null}
        transparent
        statusBarTranslucent
        animationType="none"
        pointerEvents="none"
        onRequestClose={() => {}}
      >
        <View style={styles.toastLayer} pointerEvents="box-none">
          {toastItem && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.toast,
                {
                  borderColor: toastTint + '66',
                  opacity: toastAnim,
                  transform: [
                    {
                      translateY: toastAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [56, 0],
                      }),
                    },
                    {
                      scale: toastAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                      }),
                    },
                    {
                      // Error toasts shake side-to-side once they've landed;
                      // this stays at 0 (no-op) for success/info toasts.
                      translateX: toastShake.interpolate({
                        inputRange: [-1, 0, 1],
                        outputRange: [-8, 0, 8],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Animated.View style={{ transform: [{ scale: toastIconPop }] }}>
                <ToastIcon size={17} color={toastTint} />
              </Animated.View>
              <Text variant="labelLarge" style={styles.toastText} numberOfLines={2}>
                {toastItem.message}
              </Text>
            </Animated.View>
          )}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: '#000000A8',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    },
    dialog: {
      backgroundColor: colors.surface,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 24,
      paddingTop: 26,
      paddingBottom: 20,
      alignItems: 'center',
      minWidth: 300,
      maxWidth: 380,
    },
    dialogIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    dialogTitle: { color: colors.text, fontWeight: '700', textAlign: 'center' },
    dialogMessage: {
      color: colors.muted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 21,
    },
    dialogButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 22,
      alignSelf: 'stretch',
    },
    cancelBtn: {
      flex: 1,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: 12,
      alignItems: 'center',
    },
    cancelText: { color: colors.muted, fontWeight: '700' },
    confirmWrap: { flex: 1 },
    confirmBtn: {
      borderRadius: 18,
      paddingVertical: 13,
      alignItems: 'center',
    },
    confirmText: { color: '#FFFFFF', fontWeight: '800' },
    btnPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    toastLayer: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 24,
      paddingBottom: 96,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      paddingVertical: 12,
      paddingHorizontal: 16,
      shadowColor: '#000000',
      shadowOpacity: 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    toastText: { color: colors.text, flex: 1 },
  });
