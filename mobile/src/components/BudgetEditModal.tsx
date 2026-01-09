import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Modal, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { LIGHT_THEME, SPACING } from '../constants/theme';
import { X, Check } from 'lucide-react-native';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSave: (amount: number) => Promise<void>;
    categoryName: string;
    currentAmount: number;
    monthLabel: string;
}

export default function BudgetEditModal({ visible, onClose, onSave, categoryName, currentAmount, monthLabel }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);

    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) {
            setAmount(currentAmount ? currentAmount.toString() : '0');
        }
    }, [visible, currentAmount]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(parseFloat(amount) || 0);
            onClose();
        } catch (e) {
            console.error("Failed to save budget", e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Set Budget</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={24} color={theme.mutedForeground} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        {categoryName} • {monthLabel}
                    </Text>

                    <View style={styles.inputContainer}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <TextInput
                            style={styles.input}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            autoFocus
                            placeholder="0.00"
                            placeholderTextColor={theme.mutedForeground}
                            selectTextOnFocus
                        />
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                            {saving ? (
                                <ActivityIndicator color={theme.primaryForeground} />
                            ) : (
                                <Text style={styles.saveText}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const makeStyles = (theme: typeof LIGHT_THEME) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: SPACING.xl,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.foreground,
    },
    subtitle: {
        fontSize: 14,
        color: theme.mutedForeground,
        marginBottom: SPACING.lg,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: theme.primary,
        marginBottom: SPACING.xl,
        paddingBottom: SPACING.xs,
    },
    currencySymbol: {
        fontSize: 24,
        fontWeight: '600',
        color: theme.mutedForeground,
        marginRight: SPACING.xs,
    },
    input: {
        fontSize: 32,
        fontWeight: '700',
        color: theme.foreground,
        flex: 1,
        padding: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            }
        }) as any,
    },
    actions: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    cancelBtn: {
        flex: 1,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.muted,
    },
    cancelText: {
        fontWeight: '600',
        color: theme.mutedForeground,
    },
    saveBtn: {
        flex: 1,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.primary,
    },
    saveText: {
        fontWeight: '600',
        color: theme.primaryForeground,
    },
});
