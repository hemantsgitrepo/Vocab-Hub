import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GraduationCap, Headphones, Home, PlusCircle, Settings } from 'lucide-react-native';
import { View } from 'react-native';
import { ThemeProvider, useAppTheme } from './src/ThemeContext';
import { DialogProvider } from './src/ui/AppDialogs';
import { UnlockProvider } from './src/ui/UnlockProvider';
import { useConsent, useOnboarding, useProfile, useSession } from './src/hooks';
import DashboardScreen from './src/screens/DashboardScreen';
import AddWordScreen from './src/screens/AddWordScreen';
import TravelModeScreen from './src/screens/TravelModeScreen';
import QuizScreen from './src/screens/QuizScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ConsentScreen from './src/screens/ConsentScreen';
import SignInScreen from './src/screens/auth/SignInScreen';
import { startEmailQueue } from './src/services/emailService';

const Tab = createBottomTabNavigator();

function AppShell() {
  const { colors, paperTheme, navTheme, isDark } = useAppTheme();
  const [consented, giveConsent] = useConsent();
  const [onboarded, completeOnboarding] = useOnboarding();
  const { session, loading: sessionLoading } = useSession();
  const {
    complete: profileComplete,
    loading: profileLoading,
    refresh: refreshProfile,
  } = useProfile();

  // Drains any emails queued while offline, and keeps retrying on reconnect.
  // Starting this doesn't depend on consent/onboarding — it's a passive
  // background drain, not a new prompt or data collection surface.
  useEffect(() => {
    startEmailQueue();
  }, []);

  // Hold on a themed blank until the stored flags (and the restored auth
  // session) resolve, so returning users never see the consent gate, the
  // carousel, or the sign-in screen flash before they're dismissed.
  if (consented === null || onboarded === null || sessionLoading || (session && profileLoading)) {
    return (
      <PaperProvider theme={paperTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={{ flex: 1, backgroundColor: colors.background }} />
      </PaperProvider>
    );
  }

  // Non-bypassable: Terms + Privacy must be accepted before onboarding or the
  // app itself is reachable.
  if (!consented) {
    return (
      <PaperProvider theme={paperTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ConsentScreen onAccept={giveConsent} />
      </PaperProvider>
    );
  }

  if (!onboarded) {
    return (
      <PaperProvider theme={paperTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <OnboardingScreen onDone={completeOnboarding} />
      </PaperProvider>
    );
  }

  // Mandatory sign-in gate: the app is unreachable without an account.
  // No skip, no close — signing in (or creating an account) is the only way
  // forward. Once a session exists, useSession re-renders straight past this.
  //
  // A Google/Apple sign-in creates the account without ever asking for a
  // mobile number, so those users land on the same screen in
  // "finish signing up" mode until their profile has one.
  if (!session || (!profileLoading && !profileComplete)) {
    return (
      <PaperProvider theme={paperTheme}>
        <StatusBar style="light" />
        <DialogProvider>
          <SignInScreen
            standalone
            visible
            completingProfile={!!session && !profileComplete}
            onProfileCompleted={refreshProfile}
            onClose={() => {}}
          />
        </DialogProvider>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <DialogProvider>
        <UnlockProvider>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.muted,
            tabBarHideOnKeyboard: true,
            // No fixed height — bottom-tabs adds the safe-area inset itself.
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopWidth: 0,
              paddingTop: 8,
              elevation: 16,
              shadowColor: '#000000',
              shadowOpacity: 0.12,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: -4 },
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
          }}
        >
          <Tab.Screen
            name="Home"
            component={DashboardScreen}
            options={{
              tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="Add"
            component={AddWordScreen}
            options={{
              tabBarIcon: ({ color, size }) => <PlusCircle color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="Travel"
            component={TravelModeScreen}
            options={{
              tabBarIcon: ({ color, size }) => <Headphones color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="Quiz"
            component={QuizScreen}
            options={{
              tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} />,
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
            }}
          />
        </Tab.Navigator>
        </UnlockProvider>
        </DialogProvider>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
