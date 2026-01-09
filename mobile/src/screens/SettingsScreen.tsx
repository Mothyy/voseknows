import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { LIGHT_THEME } from '../constants/theme';

export default function SettingsScreen() {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);

    return (
        <View style={styles.container}>
            <Text style={styles.text}>Settings</Text>
            <Text style={styles.subText}>Current Mode: {theme.mode}</Text>
        </View>
    );
}

const makeStyles = (theme: typeof LIGHT_THEME) => StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    text: { fontSize: 20, fontWeight: '600', color: theme.foreground },
    subText: { fontSize: 14, color: theme.mutedForeground, marginTop: 8 }
});
