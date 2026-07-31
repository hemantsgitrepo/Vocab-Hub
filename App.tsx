import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GraduationCap, Headphones, Home, PlusCircle, Settings } from 'lucide-react-native';
import { ThemeProvider, useAppTheme } from './src/ThemeContext';
import { DialogProvider } from './src/ui/AppDialogs';
import DashboardScreen from './src/screens/DashboardScreen';
import AddWordScreen from './src/screens/AddWordScreen';
import TravelModeScreen from './src/screens/TravelModeScreen';
import QuizScreen from './src/screens/QuizScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function AppShell() {
  const { colors, paperTheme, navTheme, isDark } = useAppTheme();

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <DialogProvider>
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
