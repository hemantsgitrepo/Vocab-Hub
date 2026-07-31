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
      Animated.spring(toastAnim, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
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
    [toastAnim]
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

      {/* ----- Toast ----- */}
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
              ],
            },
          ]}
        >
          <ToastIcon size={17} color={toastTint} />
          <Text variant="labelLarge" style={styles.toastText} numberOfLines={2}>
            {toastItem.message}
          </Text>
        </Animated.View>
      )}
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
    toast: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 96,
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
