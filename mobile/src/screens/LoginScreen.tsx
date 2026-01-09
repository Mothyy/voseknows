import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { LIGHT_THEME, SPACING } from '../constants/theme';
import { LogIn } from 'lucide-react-native';

export default function LoginScreen() {
    const { signIn } = useAuth();
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please enter both email and password.');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await signIn(email, password);
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.logoBox}>
                            <LogIn size={32} color={theme.primaryForeground} />
                        </View>
                        <Text style={styles.title}>VoseKnows</Text>
                        <Text style={styles.subtitle}>Sign in to manage your budget</Text>
                    </View>

                    <View style={styles.form}>
                        {error && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="name@example.com"
                                placeholderTextColor={theme.mutedForeground}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor={theme.mutedForeground}
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={theme.primaryForeground} />
                            ) : (
                                <Text style={styles.buttonText}>Sign In</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
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
        justifyContent: 'center',
    },
    content: {
        padding: SPACING.xl,
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xxl,
    },
    logoBox: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.foreground,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: 16,
        color: theme.mutedForeground,
    },
    form: {
        gap: SPACING.lg,
    },
    inputGroup: {
        gap: SPACING.xs,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.foreground,
    },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        paddingHorizontal: SPACING.md,
        backgroundColor: theme.card,
        color: theme.foreground,
        fontSize: 16,
    },
    button: {
        height: 48,
        backgroundColor: theme.primary,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: SPACING.sm,
    },
    buttonText: {
        color: theme.primaryForeground,
        fontSize: 16,
        fontWeight: '600',
    },
    errorBox: {
        backgroundColor: theme.badgeDestructiveBg,
        padding: SPACING.md,
        borderRadius: 8,
        marginBottom: SPACING.sm,
    },
    errorText: {
        color: theme.destructive,
        fontSize: 14,
    },
});
