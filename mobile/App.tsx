import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LayoutDashboard, Receipt, Settings as SettingsIcon, Wallet } from 'lucide-react-native';

import BudgetScreen from './src/screens/BudgetScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AccountsScreen from './src/screens/AccountsScreen';
import { useTheme } from './src/hooks/useTheme';

const Tab = createBottomTabNavigator();

export default function App() {
  const theme = useTheme();
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

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={MyNavTheme}>
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
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
