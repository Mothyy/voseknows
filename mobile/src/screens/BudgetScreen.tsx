import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import apiClient from '../lib/api';

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
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MergedBudgetRecord[]>([]);
    const [startDate] = useState(new Date()); // Today
    const viewPeriod = 3;

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

            // Add uncategorized placeholder if needed, simplified here.

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
            console.error("Error fetching budget:", e.response ? e.response.data : e.message);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: MergedBudgetRecord }) => {
        const variance = (item.mtd_actual || 0) - (item.mtd_budget || 0);
        // Assuming Expense: Positive variance is Overspending (Bad = Red)
        // If Budget > Actual -> Green
        // Variance: Actual - Budget. 
        // 100 actual - 50 budget = +50 variance (Red).
        const varColor = variance > 0 ? '#ef4444' : '#10b981';

        return (
            <View style={[styles.row, { paddingLeft: (item.depth || 0) * 16 + 12 }]}>
                <Text style={[styles.cell, styles.name, item.isParent && styles.bold]} numberOfLines={1}>
                    {item.category_name}
                </Text>
                <Text style={[styles.cell, styles.rightAlign]}>${(item.mtd_actual || 0).toFixed(0)}</Text>
                <Text style={[styles.cell, styles.rightAlign, { color: varColor }]}>${variance.toFixed(0)}</Text>
            </View>
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.cell, styles.name, styles.bold]}>Category</Text>
                <Text style={[styles.cell, styles.rightAlign, styles.bold]}>Actual</Text>
                <Text style={[styles.cell, styles.rightAlign, styles.bold]}>Var</Text>
            </View>
            <FlatList
                data={data}
                keyExtractor={item => item.category_id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    row: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center', paddingRight: 12 },
    header: { flexDirection: 'row', padding: 12, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    cell: { flex: 1, fontSize: 14, color: '#0f172a' },
    name: { flex: 2 },
    rightAlign: { textAlign: 'right' },
    bold: { fontWeight: '600' },
});
