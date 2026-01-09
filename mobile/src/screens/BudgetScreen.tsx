import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Platform, SafeAreaView } from 'react-native';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Pencil, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../lib/api';
import { SPACING, LIGHT_THEME } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import BudgetEditModal from '../components/BudgetEditModal';

interface MergedBudgetRecord {
    category_id: string;
    category_name: string;
    parent_id: string | null;
    mtd_budget: number;
    mtd_actual: number;
    monthlyData?: Record<string, { budget: number; actual: number }>;
    depth?: number;
    isParent?: boolean;
}

export default function BudgetScreen() {
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const navigation = useNavigation<any>();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MergedBudgetRecord[]>([]);
    const [startDate, setStartDate] = useState(new Date());
    const viewPeriod = 3;

    // Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editTarget, setEditTarget] = useState<MergedBudgetRecord | null>(null);

    useEffect(() => {
        fetchData();
    }, [startDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const catRes = await apiClient.get<any[]>("/categories");

            const allCats: any[] = [];
            const flattenCats = (nodes: any[]) => {
                nodes.forEach((n: any) => {
                    allCats.push({ id: n.id, name: n.name, parent_id: n.parent_id });
                    if (n.children) flattenCats(n.children);
                });
            };
            flattenCats(catRes.data);

            const mtdStart = format(startOfMonth(subMonths(startDate, viewPeriod - 1)), "yyyy-MM-dd");
            const mtdEnd = format(endOfMonth(startDate), "yyyy-MM-dd");

            const mergedMap = new Map<string, MergedBudgetRecord>(
                allCats.map((c) => [
                    c.id,
                    {
                        category_id: c.id,
                        category_name: c.name,
                        parent_id: c.parent_id,
                        mtd_budget: 0,
                        mtd_actual: 0,
                        monthlyData: {},
                    },
                ])
            );

            const res = await apiClient.get<any[]>(
                `/reports/monthly-comparison?startDate=${mtdStart}&endDate=${mtdEnd}`
            );

            res.data.forEach((row: any) => {
                const m = mergedMap.get(row.category_id);
                if (m) {
                    const monthKey = row.month.split("T")[0];
                    if (!m.monthlyData) m.monthlyData = {};
                    m.monthlyData![monthKey] = {
                        budget: Number(row.budget),
                        actual: Number(row.actual),
                    };
                    m.mtd_budget += Number(row.budget);
                    m.mtd_actual += Number(row.actual);
                }
            });

            // Logic to identify parents
            const flatData = Array.from(mergedMap.values());
            const distinctParentIds = new Set<string>();
            flatData.forEach(d => {
                if (d.parent_id) distinctParentIds.add(d.parent_id);
            });

            const rollUp = (parentId: string) => {
                const children = flatData.filter(d => d.parent_id === parentId);
                const totals = { mtd_budget: 0, mtd_actual: 0, monthlyData: {} as Record<string, { budget: number; actual: number }> };

                children.forEach(child => {
                    let childValues;
                    if (distinctParentIds.has(child.category_id)) {
                        childValues = rollUp(child.category_id);
                        child.mtd_budget = childValues.mtd_budget;
                        child.mtd_actual = childValues.mtd_actual;
                        child.monthlyData = childValues.monthlyData;
                    } else {
                        childValues = {
                            mtd_budget: child.mtd_budget,
                            mtd_actual: child.mtd_actual,
                            monthlyData: child.monthlyData || {}
                        };
                    }
                    totals.mtd_budget += childValues.mtd_budget;
                    totals.mtd_actual += childValues.mtd_actual;

                    if (childValues.monthlyData) {
                        Object.entries(childValues.monthlyData).forEach(([month, d]) => {
                            if (!totals.monthlyData[month]) totals.monthlyData[month] = { budget: 0, actual: 0 };
                            totals.monthlyData[month].budget += d.budget;
                            totals.monthlyData[month].actual += d.actual;
                        });
                    }
                });
                return totals;
            };

            flatData.filter(d => d.parent_id === null).forEach(top => {
                if (distinctParentIds.has(top.category_id)) {
                    const rolled = rollUp(top.category_id);
                    top.mtd_budget = rolled.mtd_budget;
                    top.mtd_actual = rolled.mtd_actual;
                    top.monthlyData = rolled.monthlyData;
                }
            });

            const result: MergedBudgetRecord[] = [];
            const addToResult = (parentId: string | null, depth: number) => {
                const level = flatData.filter(d => d.parent_id === parentId)
                    .sort((a, b) => a.category_name.localeCompare(b.category_name));
                level.forEach(cat => {
                    const isParent = distinctParentIds.has(cat.category_id);
                    result.push({ ...cat, depth, isParent });
                    if (isParent) addToResult(cat.category_id, depth + 1);
                });
            };
            addToResult(null, 0);

            setData(result);
        } catch (e: any) {
            console.error("Error fetching budget:", e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleMonth = (dir: number) => {
        setStartDate(prev => addMonths(prev, dir));
    };

    const handleRowPress = (item: MergedBudgetRecord) => {
        if (isEditing) {
            setEditTarget(item);
        } else {
            // Drill down
            const mtdStart = format(startOfMonth(subMonths(startDate, viewPeriod - 1)), "yyyy-MM-dd");
            const mtdEnd = format(endOfMonth(startDate), "yyyy-MM-dd");

            navigation.navigate('Transactions', {
                categoryId: item.category_id,
                startDate: mtdStart,
                endDate: mtdEnd,
                title: item.category_name,
            });
        }
    };

    const handleSaveBudget = async (amount: number) => {
        if (!editTarget) return;
        const month = format(startDate, 'yyyy-MM-01');

        try {
            await apiClient.post('/budgets', {
                category_id: editTarget.category_id,
                month: month,
                amount: amount
            });
            fetchData();
        } catch (e: any) {
            console.error(e);
            alert("Failed to save budget");
        }
    };

    const renderItem = ({ item }: { item: MergedBudgetRecord }) => {
        const budget = item.mtd_budget || 0;
        const actual = item.mtd_actual || 0;
        const variance = actual - budget;
        const isPositiveVar = variance > 0;
        const varColor = isPositiveVar ? theme.destructive : theme.success;
        const badgeBg = isPositiveVar ? theme.badgeDestructiveBg : theme.badgeSuccessBg;

        const isEditable = isEditing;

        return (
            <TouchableOpacity onPress={() => handleRowPress(item)} activeOpacity={0.7}>
                <View style={[
                    styles.row,
                    item.depth === 0 && styles.rootRow,
                    { paddingLeft: (item.depth || 0) * 12 + 16 },
                    isEditable && styles.editRow
                ]}>
                    <View style={styles.nameCol}>
                        <Text style={[
                            styles.cellText,
                            item.isParent ? styles.parentText : styles.childText
                        ]} numberOfLines={1}>
                            {item.category_name}
                            {isEditable && <Text style={{ fontSize: 10, color: theme.primary }}> ✎</Text>}
                        </Text>
                    </View>

                    <View style={styles.valueCol}>
                        <Text style={styles.amountText}>${actual.toLocaleString()}</Text>
                        {item.isParent && (
                            <Text style={styles.subText}>of ${budget.toLocaleString()}</Text>
                        )}
                    </View>

                    <View style={styles.varCol}>
                        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                            {isPositiveVar ? <TrendingUp size={12} color={varColor} /> : <TrendingDown size={12} color={varColor} />}
                            <Text style={[styles.varText, { color: varColor }]}>
                                {Math.abs(variance).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const Footer = () => {
        // Calculate totals for Top Level items (depth === 0)
        const topLevelItems = data.filter(item => item.depth === 0);
        const totalBudget = topLevelItems.reduce((acc, curr) => acc + (curr.mtd_budget || 0), 0);
        const totalActual = topLevelItems.reduce((acc, curr) => acc + (curr.mtd_actual || 0), 0);

        const variance = totalActual - totalBudget;
        const isPositiveVar = variance > 0;
        const varColor = isPositiveVar ? theme.destructive : theme.success;
        const badgeBg = isPositiveVar ? theme.badgeDestructiveBg : theme.badgeSuccessBg;

        return (
            <View style={styles.footerRow}>
                <View style={[styles.nameCol, { paddingLeft: 16 }]}>
                    <Text style={styles.footerLabel}>Total</Text>
                </View>
                <View style={styles.valueCol}>
                    <Text style={styles.footerAmount}>${totalActual.toLocaleString()}</Text>
                    <Text style={styles.footerSub}>of ${totalBudget.toLocaleString()}</Text>
                </View>
                <View style={styles.varCol}>
                    <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                        {isPositiveVar ? <TrendingUp size={12} color={varColor} /> : <TrendingDown size={12} color={varColor} />}
                        <Text style={[styles.varText, { color: varColor }]}>
                            {Math.abs(variance).toLocaleString()}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const currentMonthKey = format(startDate, 'yyyy-MM-01');

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.headerCard}>
                    <View style={styles.titleRow}>
                        <Text style={styles.headerTitle}>Budget Summary</Text>
                        <TouchableOpacity
                            onPress={() => setIsEditing(!isEditing)}
                            style={[styles.editBtn, isEditing && styles.editBtnActive]}
                        >
                            <Pencil size={18} color={isEditing ? theme.primaryForeground : theme.foreground} />
                            {isEditing && <Text style={{ marginLeft: 4, color: theme.primaryForeground, fontWeight: '600' }}>Done</Text>}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.dateControl}>
                        <TouchableOpacity onPress={() => toggleMonth(-1)} style={styles.iconBtn}>
                            <ArrowLeft size={20} color={theme.foreground} />
                        </TouchableOpacity>
                        <Text style={styles.dateText}>{format(startDate, "MMM yyyy")}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.periodLabel}>Last {viewPeriod} Mo</Text>
                            <TouchableOpacity onPress={() => toggleMonth(1)} style={styles.iconBtn}>
                                <ArrowRight size={20} color={theme.foreground} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {isEditing && (
                    <View style={styles.editBanner}>
                        <Text style={styles.editBannerText}>Tap a category to set budget for {format(startDate, 'MMM')}</Text>
                    </View>
                )}

                <View style={styles.tableHeader}>
                    <Text style={[styles.th, { flex: 4 }]}>CATEGORY</Text>
                    <Text style={[styles.th, { flex: 3, textAlign: 'right' }]}>ACTUAL</Text>
                    <Text style={[styles.th, { flex: 3, textAlign: 'right' }]}>VAR</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={data}
                        keyExtractor={item => item.category_id}
                        renderItem={renderItem}
                        ListFooterComponent={Footer}
                        contentContainerStyle={{ paddingBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            <BudgetEditModal
                visible={!!editTarget}
                onClose={() => setEditTarget(null)}
                onSave={handleSaveBudget}
                categoryName={editTarget?.category_name || ''}
                monthLabel={format(startDate, 'MMMM yyyy')}
                currentAmount={
                    editTarget?.monthlyData?.[currentMonthKey]?.budget || 0
                }
            />
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
        backgroundColor: theme.background,
    },
    headerCard: {
        backgroundColor: theme.card,
        padding: SPACING.lg,
        paddingBottom: SPACING.xl,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        marginBottom: SPACING.sm,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.foreground,
    },
    editBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: theme.muted,
        flexDirection: 'row',
        alignItems: 'center',
    },
    editBtnActive: {
        backgroundColor: theme.primary,
    },
    dateControl: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.muted,
        borderRadius: 8,
        padding: SPACING.xs,
    },
    iconBtn: {
        padding: SPACING.sm,
        backgroundColor: theme.card,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: theme.border,
    },
    dateText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.foreground,
    },
    periodLabel: {
        fontSize: 12,
        color: theme.mutedForeground,
        marginRight: SPACING.sm,
    },
    editBanner: {
        backgroundColor: theme.muted,
        padding: SPACING.xs,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    editBannerText: {
        fontSize: 12,
        color: theme.primary,
        fontWeight: '600',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        backgroundColor: theme.muted,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    th: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.mutedForeground,
        letterSpacing: 0.5,
    },
    row: {
        flexDirection: 'row',
        paddingVertical: SPACING.md,
        paddingRight: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: theme.muted,
        backgroundColor: theme.card,
        alignItems: 'flex-start',
    },
    editRow: {
        backgroundColor: theme.muted,
    },
    rootRow: {
        backgroundColor: theme.card,
    },
    nameCol: {
        flex: 4,
        justifyContent: 'center',
    },
    valueCol: {
        flex: 3,
        alignItems: 'flex-end',
    },
    varCol: {
        flex: 3,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    cellText: {
        fontSize: 15,
        color: theme.foreground,
    },
    parentText: {
        fontWeight: '600',
        color: theme.foreground,
    },
    childText: {
        fontWeight: '400',
        color: theme.mutedForeground,
    },
    amountText: {
        fontSize: 15,
        fontWeight: '500',
        color: theme.foreground,
    },
    subText: {
        fontSize: 11,
        color: theme.mutedForeground,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 12,
        gap: 4,
    },
    varText: {
        fontSize: 12,
        fontWeight: '600',
    },
    // Footer Styles
    footerRow: {
        flexDirection: 'row',
        paddingVertical: SPACING.lg,
        paddingRight: SPACING.lg,
        backgroundColor: theme.card,
        borderTopWidth: 2,
        borderTopColor: theme.border,
        marginTop: -1, // Overlap last divider
    },
    footerLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.foreground,
    },
    footerAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.foreground,
    },
    footerSub: {
        fontSize: 12,
        fontWeight: '500',
        color: theme.mutedForeground,
    },
});
