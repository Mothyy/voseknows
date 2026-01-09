import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, Platform, RefreshControl, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { XCircle } from 'lucide-react-native';
import apiClient from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import { SPACING, LIGHT_THEME } from '../constants/theme';

interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: string | number;
    category: string;
    account: string;
}

export default function TransactionsScreen() {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const route = useRoute<any>();
    const navigation = useNavigation<any>();

    const { categoryId, accountId, startDate, endDate, title } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params: any = {
                limit: 100,
            };
            if (categoryId) params.categoryId = categoryId;
            if (accountId) params.accountId = accountId;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const res = await apiClient.get<{ data: Transaction[] }>("/transactions", { params });
            // Fix: Access .data.data because backend returns paginated object
            setTransactions(res.data.data);
        } catch (e: any) {
            console.error("Error fetching transactions:", e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [categoryId, startDate, endDate]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const clearFilters = () => {
        navigation.setParams({ categoryId: undefined, startDate: undefined, endDate: undefined, title: undefined });
    };

    const renderItem = ({ item }: { item: Transaction }) => {
        const amount = Number(item.amount);
        const isExpense = amount < 0;

        return (
            <View style={styles.card}>
                <View style={styles.dateBox}>
                    <Text style={styles.dateDay}>{format(new Date(item.date), 'dd')}</Text>
                    <Text style={styles.dateMonth}>{format(new Date(item.date), 'MMM')}</Text>
                </View>
                <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
                    <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
                    <Text style={styles.category}>{item.category || 'Uncategorized'} • {item.account}</Text>
                </View>
                <View>
                    <Text style={[
                        styles.amount,
                        { color: isExpense ? theme.foreground : theme.success }
                    ]}>
                        {amount < 0 ? `-$${Math.abs(amount).toFixed(2)}` : `+$${amount.toFixed(2)}`}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>
                        {title || "Transactions"}
                    </Text>
                    {(categoryId || startDate) && (
                        <TouchableOpacity onPress={clearFilters} style={styles.filterChip}>
                            <Text style={styles.filterText}>Filtering Active</Text>
                            <XCircle size={16} color={theme.primaryForeground} style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    )}
                </View>

                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={transactions}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 80 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 40 }}>
                                <Text style={{ color: theme.mutedForeground }}>No transactions found.</Text>
                            </View>
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
        paddingBottom: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.foreground,
    },
    filterChip: {
        backgroundColor: theme.primary,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterText: {
        color: theme.primaryForeground,
        fontSize: 12,
        fontWeight: '600',
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
    },
    dateBox: {
        backgroundColor: theme.muted,
        borderRadius: 8,
        padding: SPACING.xs,
        alignItems: 'center',
        minWidth: 44,
    },
    dateDay: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.foreground,
    },
    dateMonth: {
        fontSize: 11,
        textTransform: 'uppercase',
        color: theme.mutedForeground,
        fontWeight: '600',
    },
    description: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.foreground,
        marginBottom: 2,
    },
    category: {
        fontSize: 12,
        color: theme.mutedForeground,
    },
    amount: {
        fontSize: 15,
        fontWeight: '700',
    },
});
