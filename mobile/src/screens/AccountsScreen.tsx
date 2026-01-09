import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, Platform, RefreshControl } from 'react-native';
import { Wallet, RefreshCw } from 'lucide-react-native';
import apiClient from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import { SPACING, LIGHT_THEME } from '../constants/theme';

interface Account {
    id: string;
    name: string;
    type: string;
    balance: string;
}

export default function AccountsScreen() {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const fetchData = async () => {
        try {
            const res = await apiClient.get<Account[]>("/accounts");
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
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderItem = ({ item }: { item: Account }) => {
        const balance = parseFloat(item.balance);
        const isNegative = balance < 0;

        return (
            <View style={styles.card}>
                <View style={styles.iconContainer}>
                    <Wallet size={24} color={theme.primary} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
                    <Text style={styles.accountName}>{item.name}</Text>
                    <Text style={styles.accountType}>{item.type}</Text>
                </View>
                <View>
                    <Text style={[styles.balance, { color: theme.foreground }]}>
                        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                </View>
            </View>
        );
    };

    const totalBalance = accounts.reduce((acc, curr) => acc + parseFloat(curr.balance), 0);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Accounts</Text>
                    <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>Net Worth</Text>
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
        backgroundColor: theme.muted, // secondary bg for contrast with cards
    },
    header: {
        backgroundColor: theme.card,
        padding: SPACING.lg,
        paddingBottom: SPACING.xl,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.foreground,
        marginBottom: SPACING.md,
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
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.muted, // or secondary
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
