import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { LIGHT_THEME, SPACING } from '../constants/theme';
import { LogOut, User } from 'lucide-react-native';

export default function SettingsScreen() {
    const { signOut, user } = useAuth();
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Settings</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <View style={styles.iconBox}>
                                <User size={20} color={theme.foreground} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Email</Text>
                                <Text style={styles.value}>{user?.email}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={[styles.section, { marginTop: 'auto', marginBottom: SPACING.xl }]}>
                    <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
                        <LogOut size={20} color={theme.destructive} />
                        <Text style={styles.logoutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const makeStyles = (theme: typeof LIGHT_THEME) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.background,
    },
    container: {
        flex: 1,
        maxWidth: Platform.OS === 'web' ? 600 : '100%',
        alignSelf: 'center',
        width: '100%',
        backgroundColor: theme.muted,
        padding: SPACING.lg,
    },
    header: {
        marginBottom: SPACING.xl,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.foreground,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.mutedForeground,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: theme.card,
        borderRadius: 12,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: theme.border,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.muted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
        color: theme.mutedForeground,
    },
    value: {
        fontSize: 16,
        color: theme.foreground,
        fontWeight: '500',
    },
    logoutBtn: {
        backgroundColor: theme.badgeDestructiveBg,
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACING.sm,
        borderWidth: 1,
        borderColor: 'transparent', // could add border
    },
    logoutText: {
        color: theme.destructive,
        fontSize: 16,
        fontWeight: '600',
    },
});
