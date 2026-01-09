import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LayoutDashboard, Receipt, Settings as SettingsIcon, Wallet } from 'lucide-react-native';

import BudgetScreen from './src/screens/BudgetScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AccountsScreen from './src/screens/AccountsScreen';
import LoginScreen from './src/screens/LoginScreen';
import { useTheme } from './src/hooks/useTheme';
import { AuthProvider, useAuth } from './src/context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          borderTopColor: theme.border,
          backgroundColor: theme.card,
          paddingTop: 8,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: 4,
        }
      }}
    >
      <Tab.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{
          tabBarLabel: 'Accounts',
          tabBarIcon: ({ color, size }) => (
            <Wallet color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Budget"
        component={BudgetScreen}
        options={{
          tabBarLabel: 'Budget',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{
          tabBarLabel: 'Transactions',
          tabBarIcon: ({ color, size }) => (
            <Receipt color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <SettingsIcon color={color} size={24} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const theme = useTheme();
  const { user, loading } = useAuth();
  const isDark = theme.mode === 'dark';

  const MyNavTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.background,
      card: theme.card,
      text: theme.foreground,
      border: theme.border,
      primary: theme.primary,
    },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={MyNavTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
