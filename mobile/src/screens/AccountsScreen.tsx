import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, Platform, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Wallet, RefreshCw, Filter } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import { SPACING, LIGHT_THEME } from '../constants/theme';

interface Account {
    id: string;
    name: string;
    type: string;
    balance: string;
    is_active?: boolean;
}

export default function AccountsScreen() {
    const theme = useTheme();
    const navigation = useNavigation<any>();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [showInactive, setShowInactive] = useState(false);

    const fetchData = async () => {
        try {
            const res = await apiClient.get<Account[]>(`/accounts?showInactive=${showInactive}`);
            setAccounts(res.data);
        } catch (e: any) {
            console.error("Error fetching accounts:", e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [showInactive]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleLongPress = (account: Account) => {
        Alert.alert(
            "Manage Account",
            `Options for ${account.name}`,
            [
                {
                    text: account.is_active === false ? "Restore Account" : "Archive (Hide) Account",
                    style: account.is_active === false ? "default" : "destructive",
                    onPress: async () => {
                        try {
                            await apiClient.patch(`/accounts/${account.id}`, {
                                is_active: !(account.is_active !== false)
                            });
                            fetchData();
                        } catch (e) {
                            Alert.alert("Error", "Failed to update account status.");
                        }
                    }
                },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const renderItem = ({ item }: { item: Account }) => {
        const balance = parseFloat(item.balance);

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => handleLongPress(item)}
                style={[styles.card, item.is_active === false && styles.inactiveCard]}
            >
                <View style={styles.iconContainer}>
                    <Wallet size={24} color={theme.primary} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
                    <Text style={[styles.accountName, item.is_active === false && styles.inactiveText]}>{item.name}</Text>
                    <Text style={styles.accountType}>{item.type} {item.is_active === false && "(Inactive)"}</Text>
                </View>
                <View>
                    <Text style={[styles.balance, { color: theme.foreground }, item.is_active === false && styles.inactiveText]}>
                        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    // Filter for Net Worth calculation? Usually Net Worth includes everything, but if inactive accounts are "closed"...
    // The user said "show... transactions from the past".
    // Usually Net Worth should include closed accounts if they have a balance? 
    // Or maybe exclude them. I'll include them in the total calculation displayed, regardless of visibility?
    // Actually, if I fetch with showInactive=false, I won't have the data to sum them.
    // So distinct behavior: 
    // If showInactive=false, Net Worth only reflects active.
    // If showInactive=true, Net Worth reflects all.
    const totalBalance = accounts.reduce((acc, curr) => acc + parseFloat(curr.balance), 0);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <Text style={styles.headerTitle}>Accounts</Text>
                        <TouchableOpacity onPress={() => setShowInactive(!showInactive)} style={styles.filterBtn}>
                            <Filter size={20} color={showInactive ? theme.primary : theme.mutedForeground} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>Net Worth {showInactive && "(All)"}</Text>
                        <Text style={styles.totalAmount}>${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={accounts}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 80 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                    />
                )}
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
    },
    header: {
        backgroundColor: theme.card,
        padding: SPACING.lg,
        paddingBottom: SPACING.xl,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.foreground,
    },
    filterBtn: {
        padding: 8,
    },
    totalContainer: {
        backgroundColor: theme.primary,
        borderRadius: 12,
        padding: SPACING.lg,
        alignItems: 'center',
    },
    totalLabel: {
        color: theme.primaryForeground,
        fontSize: 14,
        opacity: 0.8,
        marginBottom: 4,
    },
    totalAmount: {
        color: theme.primaryForeground,
        fontSize: 32,
        fontWeight: '700',
    },
    card: {
        backgroundColor: theme.card,
        borderRadius: 12,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    inactiveCard: {
        opacity: 0.6,
        backgroundColor: theme.muted,
    },
    inactiveText: {
        color: theme.mutedForeground,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.muted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    accountName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.foreground,
    },
    accountType: {
        fontSize: 12,
        color: theme.mutedForeground,
        textTransform: 'capitalize',
    },
    balance: {
        fontSize: 16,
        fontWeight: '700',
    },
});
