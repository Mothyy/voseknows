import React, { useState, useEffect, useMemo } from "react";
import apiClient from "@/lib/api";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    Calendar,
    Target,
    Edit3,
    Save,
    X,
    Loader2,
    Columns,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfYear,
    subMonths,
} from "date-fns";
import { Link } from "react-router-dom";

interface BudgetRecord {
    id: string;
    name: string;
    parent_id: string | null;
    budget: number;
    actual: number;
}

interface MergedBudgetRecord {
    category_id: string;
    category_name: string;
    parent_id: string | null;
    mtd_budget: number;
    mtd_actual: number;
    ytd_budget: number;
    ytd_actual: number;
    depth?: number;
    isParent?: boolean;
    monthlyData?: Record<string, { budget: number; actual: number }>; // key: "YYYY-MM-DD"
}

interface BudgetSummaryProps {
    startDate: Date; // This is the reference date (selected month)
    onRefresh?: () => void;
}

export function BudgetSummary({ startDate, onRefresh }: BudgetSummaryProps) {
    const [mergedData, setMergedData] = useState<MergedBudgetRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"mtd" | "ytd" | "compare">("compare");
    const [viewPeriod, setViewPeriod] = useState(3); // Default to 3 for comparison

    // Inline Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editedBudgets, setEditedBudgets] = useState<Record<string, Record<string, number>>>({}); // categoryId -> monthKey -> amount

    useEffect(() => {
        const fetchData = async () => {
            // Early return if not initialized would go here, but viewMode has default.

            try {
                setLoading(true);

                // 1. Fetch all categories to build the structure
                const catRes = await apiClient.get<any[]>("/categories");
                const allCats: any[] = [];
                const flatten = (nodes: any[]) => {
                    nodes.forEach((n: any) => {
                        allCats.push({ id: n.id, name: n.name, parent_id: n.parent_id });
                        if (n.children) flatten(n.children);
                    });
                };
                flatten(catRes.data);

                const periodCount = viewMode === "compare" ? viewPeriod : 1;
                const mtdStart = format(startOfMonth(subMonths(startDate, periodCount - 1)), "yyyy-MM-dd");
                const mtdEnd = format(endOfMonth(startDate), "yyyy-MM-dd");
                const ytdStart = format(startOfYear(startDate), "yyyy-MM-dd");

                // Initialize merged structure
                const mergedMap = new Map<string, MergedBudgetRecord>(
                    allCats.map((c) => [
                        c.id,
                        {
                            category_id: c.id,
                            category_name: c.name,
                            parent_id: c.parent_id,
                            mtd_budget: 0,
                            mtd_actual: 0,
                            ytd_budget: 0,
                            ytd_actual: 0,
                            monthlyData: {},
                        },
                    ])
                );

                // Add Uncategorised placeholder
                mergedMap.set("00000000-0000-0000-0000-000000000000", {
                    category_id: "00000000-0000-0000-0000-000000000000",
                    category_name: "Uncategorised",
                    parent_id: null,
                    mtd_budget: 0,
                    mtd_actual: 0,
                    ytd_budget: 0,
                    ytd_actual: 0,
                    monthlyData: {},
                });

                if (isEditing) {
                    const res = await apiClient.get<any[]>(
                        `/reports/monthly-comparison?startDate=${mtdStart}&endDate=${mtdEnd}`
                    );

                    const initialEdited: Record<string, Record<string, number>> = {};

                    res.data.forEach((row: any) => {
                        const m = mergedMap.get(row.category_id);
                        if (m) {
                            const monthKey = row.month.split("T")[0];
                            if (!m.monthlyData) m.monthlyData = {};
                            m.monthlyData[monthKey] = {
                                budget: Number(row.budget),
                                actual: Number(row.actual),
                            };

                            if (!initialEdited[row.category_id]) initialEdited[row.category_id] = {};
                            initialEdited[row.category_id][monthKey] = Number(row.budget);

                            // For single month views, we still want these accessible via mtd_budget
                            const currentMonthStart = format(startOfMonth(startDate), "yyyy-MM-dd");
                            if (monthKey === currentMonthStart) {
                                m.mtd_budget = Number(row.budget);
                            }
                        }
                    });

                    setEditedBudgets(initialEdited);
                } else if (viewMode === "compare") {
                    const res = await apiClient.get<any[]>(
                        `/reports/monthly-comparison?startDate=${mtdStart}&endDate=${mtdEnd}`
                    );
                    res.data.forEach((row) => {
                        const m = mergedMap.get(row.category_id);
                        if (m) {
                            const monthKey = row.month.split("T")[0];
                            if (!m.monthlyData) m.monthlyData = {};
                            m.monthlyData[monthKey] = {
                                budget: Number(row.budget),
                                actual: Number(row.actual),
                            };
                            m.mtd_budget += Number(row.budget);
                            m.mtd_actual += Number(row.actual);
                        }
                    });
                } else {
                    const [mtdRes, ytdRes] = await Promise.all([
                        (viewMode === "mtd" || viewMode === "ytd")
                            ? apiClient.get<BudgetRecord[]>(`/reports/budget-variance?startDate=${mtdStart}&endDate=${mtdEnd}`)
                            : Promise.resolve({ data: [] }),
                        viewMode === "ytd"
                            ? apiClient.get<BudgetRecord[]>(`/reports/budget-variance?startDate=${ytdStart}&endDate=${mtdEnd}`)
                            : Promise.resolve({ data: [] }),
                    ]);

                    mtdRes.data.forEach((rec: BudgetRecord) => {
                        const m = mergedMap.get(rec.id);
                        if (m) {
                            m.mtd_budget = Number(rec.budget);
                            m.mtd_actual = Number(rec.actual);
                        }
                    });

                    ytdRes.data.forEach((rec: BudgetRecord) => {
                        const m = mergedMap.get(rec.id);
                        if (m) {
                            m.ytd_budget = Number(rec.budget);
                            m.ytd_actual = Number(rec.actual);
                        }
                    });
                }

                // Convert map to array and build/roll-up tree
                const flatData = Array.from(mergedMap.values());
                const tree = buildTreeData(flatData);

                // Filter out empty rows if not editing
                if (isEditing) {
                    setMergedData(tree);
                } else {
                    const filteredTree = tree.filter(item => {
                        const hasData = item.mtd_budget !== 0 || item.mtd_actual !== 0 ||
                            item.ytd_budget !== 0 || item.ytd_actual !== 0;
                        return hasData;
                    });
                    setMergedData(filteredTree);
                }

                setError(null);
            } catch (err) {
                console.error("Failed to fetch budget summary:", err);
                setError("Failed to load budget summary.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [startDate, viewMode, isEditing, viewPeriod]);

    const buildTreeData = (flatData: MergedBudgetRecord[]) => {
        const parentIds = new Set(flatData.map((b) => b.parent_id).filter(Boolean));

        // Helper to roll up values from children to a specific parent
        const rollUp = (parentId: string): {
            mtd_budget: number;
            mtd_actual: number;
            ytd_budget: number;
            ytd_actual: number;
            monthlyData: Record<string, { budget: number; actual: number }>;
        } => {
            const children = flatData.filter(d => d.parent_id === parentId);
            const totals = {
                mtd_budget: 0,
                mtd_actual: 0,
                ytd_budget: 0,
                ytd_actual: 0,
                monthlyData: {} as Record<string, { budget: number; actual: number }>
            };

            children.forEach(child => {
                let childValues;
                if (parentIds.has(child.category_id)) {
                    // It's a parent, roll up its children first
                    childValues = rollUp(child.category_id);
                    // Update the child object in flatData so it has the rolled up values
                    child.mtd_budget = childValues.mtd_budget;
                    child.mtd_actual = childValues.mtd_actual;
                    child.ytd_budget = childValues.ytd_budget;
                    child.ytd_actual = childValues.ytd_actual;
                    child.monthlyData = childValues.monthlyData;
                } else {
                    // It's a leaf
                    childValues = {
                        mtd_budget: child.mtd_budget,
                        mtd_actual: child.mtd_actual,
                        ytd_budget: child.ytd_budget,
                        ytd_actual: child.ytd_actual,
                        monthlyData: child.monthlyData || {}
                    };
                }

                totals.mtd_budget += childValues.mtd_budget;
                totals.mtd_actual += childValues.mtd_actual;
                totals.ytd_budget += childValues.ytd_budget;
                totals.ytd_actual += childValues.ytd_actual;

                // Merge monthlyData for comparison view
                Object.entries(childValues.monthlyData).forEach(([month, data]) => {
                    if (!totals.monthlyData[month]) {
                        totals.monthlyData[month] = { budget: 0, actual: 0 };
                    }
                    totals.monthlyData[month].budget += data.budget;
                    totals.monthlyData[month].actual += data.actual;
                });
            });

            return totals;
        };

        // First pass: trigger roll-ups starting from top-level parents
        flatData.filter(d => d.parent_id === null).forEach(topCat => {
            if (parentIds.has(topCat.category_id)) {
                const rolled = rollUp(topCat.category_id);
                topCat.mtd_budget = rolled.mtd_budget;
                topCat.mtd_actual = rolled.mtd_actual;
                topCat.ytd_budget = rolled.ytd_budget;
                topCat.ytd_actual = rolled.ytd_actual;
                topCat.monthlyData = rolled.monthlyData;
            }
        });

        const result: MergedBudgetRecord[] = [];
        const addToResult = (parentId: string | null, depth: number) => {
            const level = flatData
                .filter((b) => b.parent_id === parentId)
                .sort((a, b) => a.category_name.localeCompare(b.category_name));

            level.forEach((cat) => {
                const isParent = parentIds.has(cat.category_id);
                result.push({
                    ...cat,
                    depth,
                    isParent,
                });
                if (isParent) {
                    addToResult(cat.category_id, depth + 1);
                }
            });
        };

        addToResult(null, 0);
        return result;
    };

    const handleBudgetChange = (categoryId: string, monthKey: string, value: string) => {
        const amount = parseFloat(value) || 0;
        setEditedBudgets((prev: Record<string, Record<string, number>>) => ({
            ...prev,
            [categoryId]: {
                ...(prev[categoryId] || {}),
                [monthKey]: amount
            }
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const promises: Promise<any>[] = [];
            const parentIds = new Set(mergedData.filter((d: MergedBudgetRecord) => d.isParent).map((d: MergedBudgetRecord) => d.category_id));

            (Object.entries(editedBudgets) as [string, Record<string, number>][]).forEach(([categoryId, monthMap]) => {
                // Only save for non-parent categories (leaves)
                if (!parentIds.has(categoryId)) {
                    (Object.entries(monthMap) as [string, number][]).forEach(([monthKey, amount]) => {
                        promises.push(
                            apiClient.post("/budgets", {
                                category_id: categoryId,
                                month: monthKey,
                                amount: amount,
                            })
                        );
                    });
                }
            });

            await Promise.all(promises);
            setIsEditing(false);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error("Failed to save budgets:", error);
            alert("Failed to save budgets.");
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    const totals = useMemo(() => {
        // When editing, we calculate totals based on edited values for the CURRENTLY SELECTED month
        if (isEditing) {
            const currentMonthStart = format(startOfMonth(startDate), "yyyy-MM-dd");
            const parentIds = new Set(mergedData.filter((d: MergedBudgetRecord) => d.isParent).map((d: MergedBudgetRecord) => d.category_id));
            let mtd_budget = 0;

            (Object.entries(editedBudgets) as [string, Record<string, number>][]).forEach(([catId, monthMap]) => {
                if (!parentIds.has(catId)) {
                    mtd_budget += monthMap[currentMonthStart] || 0;
                }
            });

            return { mtd_budget, mtd_actual: 0, ytd_budget: 0, ytd_actual: 0 };
        }

        return mergedData
            .filter((item: MergedBudgetRecord) => item.parent_id === null) // Only sum top-level categories to avoid double counting
            .reduce(
                (
                    acc: {
                        mtd_budget: number;
                        mtd_actual: number;
                        ytd_budget: number;
                        ytd_actual: number;
                    },
                    item: MergedBudgetRecord,
                ) => ({
                    mtd_budget: acc.mtd_budget + item.mtd_budget,
                    mtd_actual: acc.mtd_actual + item.mtd_actual,
                    ytd_budget: acc.ytd_budget + item.ytd_budget,
                    ytd_actual: acc.ytd_actual + item.ytd_actual,
                }),
                { mtd_budget: 0, mtd_actual: 0, ytd_budget: 0, ytd_actual: 0 },
            );
    }, [mergedData, isEditing, editedBudgets]);

    const mtdVariance = totals.mtd_budget + totals.mtd_actual;
    const ytdVariance = totals.ytd_budget + totals.ytd_actual;

    const monthlyTotals = useMemo<Record<string, { budget: number; actual: number }>>(() => {
        if (viewMode !== "compare") return {};

        const columnTotals: Record<string, { budget: number; actual: number }> = {};

        mergedData
            .filter((item: MergedBudgetRecord) => item.parent_id === null)
            .forEach((item: MergedBudgetRecord) => {
                if (item.monthlyData) {
                    Object.entries(item.monthlyData).forEach(([month, data]) => {
                        if (!columnTotals[month]) columnTotals[month] = { budget: 0, actual: 0 };
                        columnTotals[month].budget += data.budget;
                        columnTotals[month].actual += data.actual;
                    });
                }
            });

        return columnTotals;
    }, [mergedData, viewMode]);

    // Helper to calculate parent sum from edited values for a specific month
    const getLeafSum = (parentId: string, monthKey?: string): number => {
        const mKey = monthKey || format(startOfMonth(startDate), "yyyy-MM-dd");
        const children = mergedData.filter((d: MergedBudgetRecord) => d.parent_id === parentId);
        return children.reduce((acc: number, child: MergedBudgetRecord) => {
            if (child.isParent) {
                return acc + getLeafSum(child.category_id, mKey);
            }
            return acc + (editedBudgets[child.category_id]?.[mKey] || 0);
        }, 0);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-lg border shadow-sm">
                    <Button
                        variant={viewMode === "compare" && !isEditing ? "default" : "ghost"}
                        onClick={() => setViewMode("compare")}
                        disabled={isEditing}
                        size="sm"
                        className="h-8"
                    >
                        <Columns className="mr-2 h-4 w-4" />
                        Comparison
                    </Button>
                    <Button
                        variant={viewMode === "ytd" && !isEditing ? "default" : "ghost"}
                        onClick={() => setViewMode("ytd")}
                        disabled={isEditing}
                        size="sm"
                        className="h-8"
                    >
                        <Target className="mr-2 h-4 w-4" />
                        YTD
                    </Button>

                    {viewMode === "compare" && !isEditing && (
                        <div className="flex items-center border-l ml-1 pl-1">
                            <Select
                                value={viewPeriod.toString()}
                                onValueChange={(val) => setViewPeriod(parseInt(val))}
                            >
                                <SelectTrigger className="h-8 w-[100px] border-none bg-transparent shadow-none focus:ring-0 text-xs font-semibold">
                                    <SelectValue placeholder="Period" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2">2 Mo</SelectItem>
                                    <SelectItem value="3">3 Mo</SelectItem>
                                    <SelectItem value="6">6 Mo</SelectItem>
                                    <SelectItem value="12">12 Mo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {!isEditing ? (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                                setViewMode("compare");
                                setIsEditing(true);
                            }}
                            className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                        >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Edit Budgets
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditing(false)}
                                disabled={saving}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                Save Changes
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <Card key={i}>
                                <CardHeader className="pb-2">
                                    <Skeleton className="h-4 w-[100px]" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-8 w-[120px]" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ) : error ? (
                <div className="text-center text-red-500 py-10">{error}</div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {(viewMode === "mtd" || isEditing) && (
                            <Card className="border-l-4 border-l-blue-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        {isEditing ? "Proposed Budget" : "MTD Status"}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {formatCurrency(isEditing ? totals.mtd_budget : mtdVariance)}
                                    </div>
                                    <p
                                        className={cn(
                                            "text-xs mt-1 font-medium",
                                            mtdVariance >= 0 || isEditing
                                                ? "text-green-600"
                                                : "text-red-600",
                                        )}
                                    >
                                        {isEditing ? "Total Allocation" : mtdVariance >= 0 ? "Under Budget" : "Over Budget"}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {viewMode === "ytd" && !isEditing && (
                            <Card className="border-l-4 border-l-indigo-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        YTD Status
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {formatCurrency(ytdVariance)}
                                    </div>
                                    <p
                                        className={cn(
                                            "text-xs mt-1 font-medium",
                                            ytdVariance >= 0
                                                ? "text-green-600"
                                                : "text-red-600",
                                        )}
                                    >
                                        {ytdVariance >= 0
                                            ? "Under Budget"
                                            : "Over Budget"}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {viewMode === "compare" && !isEditing && (
                            <Card className="border-l-4 border-l-orange-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        Period Variance
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {formatCurrency(mtdVariance)}
                                    </div>
                                    <p
                                        className={cn(
                                            "text-xs mt-1 font-medium",
                                            mtdVariance >= 0
                                                ? "text-green-600"
                                                : "text-red-600",
                                        )}
                                    >
                                        {mtdVariance >= 0 ? "Under Budget" : "Over Budget"}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {!isEditing && (
                            <Card className="bg-muted/20">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        Total Spendings
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {formatCurrency(
                                            viewMode === "ytd"
                                                ? Math.abs(totals.ytd_actual)
                                                : Math.abs(totals.mtd_actual),
                                        )}
                                    </div>
                                    <p className="text-xs mt-1 text-muted-foreground">
                                        {viewMode === "ytd" ? "Total YTD" : viewMode === "mtd" ? "Total MTD" : `Total Last ${viewPeriod} Mo`}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="rounded-md border bg-card overflow-x-auto shadow-sm">
                        <Table className={cn(viewMode === "compare" && "min-w-[1200px]")}>
                            <TableHeader>
                                {viewMode === "compare" && (
                                    <TableRow className="bg-muted/50 border-b-2">
                                        <TableHead className="min-w-[200px]"></TableHead>
                                        {Array.from({ length: viewPeriod }).map((_, i) => {
                                            const monthDate = startOfMonth(subMonths(startDate, viewPeriod - 1 - i));
                                            return (
                                                <TableHead
                                                    key={i}
                                                    colSpan={2}
                                                    className="text-center border-x font-bold text-blue-600 uppercase text-xs"
                                                >
                                                    {format(monthDate, "MMM yyyy")}
                                                </TableHead>
                                            );
                                        })}
                                        <TableHead
                                            colSpan={3}
                                            className="text-center font-bold text-indigo-600 uppercase text-xs"
                                        >
                                            Total Period
                                        </TableHead>
                                    </TableRow>
                                )}
                                {viewMode === "ytd" && !isEditing && (
                                    <TableRow className="bg-muted/50 border-b-2">
                                        <TableHead className="w-1/4"></TableHead>
                                        <TableHead
                                            colSpan={3}
                                            className="text-center border-x font-bold text-blue-600 uppercase text-xs"
                                        >
                                            Month to Date
                                        </TableHead>
                                        <TableHead
                                            colSpan={3}
                                            className="text-center font-bold text-indigo-600 uppercase text-xs"
                                        >
                                            Year to Date
                                        </TableHead>
                                    </TableRow>
                                )}
                                <TableRow>
                                    <TableHead className={cn((isEditing || viewMode === "compare") && "min-w-[200px]")}>Category</TableHead>
                                    {viewMode === "compare" ? (
                                        <>
                                            {Array.from({ length: viewPeriod }).map((_, i) => (
                                                <React.Fragment key={i}>
                                                    <TableHead className="text-right border-l text-[10px] uppercase text-muted-foreground">Budget</TableHead>
                                                    <TableHead className="text-right text-[10px] uppercase text-muted-foreground">Actual</TableHead>
                                                </React.Fragment>
                                            ))}
                                            <TableHead className="text-right border-l font-bold text-indigo-600">Budget</TableHead>
                                            <TableHead className="text-right font-bold text-indigo-600">Actual</TableHead>
                                            <TableHead className="text-right font-bold text-indigo-600">Var</TableHead>
                                        </>
                                    ) : (
                                        <>
                                            {(viewMode === "mtd" || viewMode === "ytd") && (
                                                <>
                                                    <TableHead className="text-right">
                                                        Budget
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Actual
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Variance
                                                    </TableHead>
                                                </>
                                            )}
                                            {viewMode === "ytd" && !isEditing && (
                                                <>
                                                    <TableHead className="text-right border-l">
                                                        Budget
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Actual
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Variance
                                                    </TableHead>
                                                </>
                                            )}
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mergedData.map((item: MergedBudgetRecord) => {
                                    const mtdVar =
                                        item.mtd_budget + item.mtd_actual;
                                    const ytdVar =
                                        item.ytd_budget + item.ytd_actual;

                                    return (
                                        <TableRow
                                            key={item.category_id}
                                            className={cn(
                                                item.isParent && "bg-muted/30 font-semibold"
                                            )}
                                        >
                                            <TableCell
                                                className="font-medium"
                                                style={{ paddingLeft: (isEditing || viewMode === "compare") ? `${(item.depth || 0) * 1.5 + 0.75}rem` : undefined }}
                                            >
                                                {item.category_name}
                                            </TableCell>
                                            {viewMode === "compare" ? (
                                                <>
                                                    {Array.from({ length: viewPeriod }).map((_, i) => {
                                                        const monthDate = startOfMonth(subMonths(startDate, viewPeriod - 1 - i));
                                                        const monthKey = format(monthDate, "yyyy-MM-dd");
                                                        const data = item.monthlyData?.[monthKey] || { budget: 0, actual: 0 };

                                                        return (
                                                            <React.Fragment key={i}>
                                                                <TableCell className="text-right border-l text-xs">
                                                                    {isEditing ? (
                                                                        <div className="flex justify-end">
                                                                            <Input
                                                                                type="number"
                                                                                className={cn(
                                                                                    "w-24 h-7 text-right text-xs p-1",
                                                                                    item.isParent && "bg-transparent border-none shadow-none font-bold"
                                                                                )}
                                                                                value={item.isParent
                                                                                    ? getLeafSum(item.category_id, monthKey).toFixed(2)
                                                                                    : editedBudgets[item.category_id]?.[monthKey] === 0 ? "" : (editedBudgets[item.category_id]?.[monthKey] || 0)
                                                                                }
                                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => !item.isParent && handleBudgetChange(item.category_id, monthKey, e.target.value)}
                                                                                disabled={item.isParent}
                                                                                placeholder="0.00"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        data.budget !== 0 ? formatCurrency(data.budget) : "-"
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs text-muted-foreground">
                                                                    {data.actual !== 0 ? (
                                                                        <Link
                                                                            to={`/transactions?categoryId=${item.category_id === "00000000-0000-0000-0000-000000000000"
                                                                                ? "uncategorized"
                                                                                : item.category_id
                                                                                }&month=${monthKey.substring(0, 7)}`}
                                                                            className="text-blue-600 hover:underline"
                                                                        >
                                                                            {formatCurrency(data.actual)}
                                                                        </Link>
                                                                    ) : (
                                                                        "-"
                                                                    )}
                                                                </TableCell>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    <TableCell className="text-right border-l font-bold">
                                                        {formatCurrency(item.mtd_budget)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        <Link
                                                            to={`/transactions?categoryId=${item.category_id === "00000000-0000-0000-0000-000000000000"
                                                                ? "uncategorized"
                                                                : item.category_id
                                                                }&startDate=${format(startOfMonth(subMonths(startDate, viewPeriod - 1)), "yyyy-MM-dd")}&endDate=${format(endOfMonth(startDate), "yyyy-MM-dd")}`}
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            {formatCurrency(item.mtd_actual)}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell
                                                        className={cn(
                                                            "text-right font-bold",
                                                            mtdVar >= 0 ? "text-green-600" : "text-red-600"
                                                        )}
                                                    >
                                                        {formatCurrency(mtdVar)}
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    {(viewMode === "mtd" || viewMode === "ytd") && (
                                                        <>
                                                            <TableCell className="text-right">
                                                                {formatCurrency(item.mtd_budget)}
                                                            </TableCell>
                                                            <TableCell className="text-right text-muted-foreground">
                                                                <Link
                                                                    to={`/transactions?categoryId=${item.category_id === "00000000-0000-0000-0000-000000000000"
                                                                        ? "uncategorized"
                                                                        : item.category_id
                                                                        }&month=${format(startDate, "yyyy-MM")}`}
                                                                    className="text-blue-600 hover:underline"
                                                                >
                                                                    {formatCurrency(item.mtd_actual)}
                                                                </Link>
                                                            </TableCell>
                                                            <TableCell
                                                                className={cn(
                                                                    "text-right font-medium",
                                                                    mtdVar >= 0
                                                                        ? "text-green-600"
                                                                        : "text-red-600",
                                                                )}
                                                            >
                                                                {formatCurrency(mtdVar)}
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    {viewMode === "ytd" && !isEditing && (
                                                        <>
                                                            <TableCell className="text-right border-l">
                                                                {formatCurrency(item.ytd_budget)}
                                                            </TableCell>
                                                            <TableCell className="text-right text-muted-foreground">
                                                                {formatCurrency(item.ytd_actual)}
                                                            </TableCell>
                                                            <TableCell
                                                                className={cn(
                                                                    "text-right font-medium",
                                                                    ytdVar >= 0
                                                                        ? "text-green-600"
                                                                        : "text-red-600",
                                                                )}
                                                            >
                                                                {formatCurrency(ytdVar)}
                                                            </TableCell>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </TableRow>
                                    );
                                })}
                                {mergedData.length > 0 && !isEditing && (
                                    <TableRow className="bg-muted/50 border-t-2 font-bold select-none">
                                        <TableCell>GRAND TOTAL</TableCell>
                                        {viewMode === "compare" ? (
                                            <>
                                                {Array.from({ length: viewPeriod }).map((_, i) => {
                                                    const monthDate = startOfMonth(subMonths(startDate, viewPeriod - 1 - i));
                                                    const monthKey = format(monthDate, "yyyy-MM-dd");
                                                    const data = monthlyTotals[monthKey] || { budget: 0, actual: 0 };
                                                    return (
                                                        <React.Fragment key={i}>
                                                            <TableCell className="text-right border-l text-xs">
                                                                {formatCurrency(data.budget)}
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs">
                                                                {formatCurrency(data.actual)}
                                                            </TableCell>
                                                        </React.Fragment>
                                                    );
                                                })}
                                                <TableCell className="text-right border-l">
                                                    {formatCurrency(totals.mtd_budget)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link
                                                        to={`/transactions?startDate=${format(startOfMonth(subMonths(startDate, viewPeriod - 1)), "yyyy-MM-dd")}&endDate=${format(endOfMonth(startDate), "yyyy-MM-dd")}`}
                                                        className="text-blue-600 hover:underline"
                                                    >
                                                        {formatCurrency(totals.mtd_actual)}
                                                    </Link>
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        "text-right",
                                                        mtdVariance >= 0 ? "text-green-600" : "text-red-600"
                                                    )}
                                                >
                                                    {formatCurrency(mtdVariance)}
                                                </TableCell>
                                            </>
                                        ) : (
                                            <>
                                                {viewMode === "mtd" && (
                                                    <>
                                                        <TableCell className="text-right">
                                                            {formatCurrency(totals.mtd_budget)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatCurrency(totals.mtd_actual)}
                                                        </TableCell>
                                                        <TableCell
                                                            className={cn(
                                                                "text-right",
                                                                mtdVariance >= 0 ? "text-green-600" : "text-red-600"
                                                            )}
                                                        >
                                                            {formatCurrency(mtdVariance)}
                                                        </TableCell>
                                                    </>
                                                )}
                                                {viewMode === "ytd" && (
                                                    <>
                                                        <TableCell className="text-right border-l">
                                                            {formatCurrency(totals.mtd_budget)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatCurrency(totals.mtd_actual)}
                                                        </TableCell>
                                                        <TableCell
                                                            className={cn(
                                                                "text-right",
                                                                mtdVariance >= 0 ? "text-green-600" : "text-red-600"
                                                            )}
                                                        >
                                                            {formatCurrency(mtdVariance)}
                                                        </TableCell>
                                                        <TableCell className="text-right border-l">
                                                            {formatCurrency(totals.ytd_budget)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatCurrency(totals.ytd_actual)}
                                                        </TableCell>
                                                        <TableCell
                                                            className={cn(
                                                                "text-right",
                                                                ytdVariance >= 0 ? "text-green-600" : "text-red-600"
                                                            )}
                                                        >
                                                            {formatCurrency(ytdVariance)}
                                                        </TableCell>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </TableRow>
                                )}
                                {mergedData.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={
                                                1 +
                                                (viewMode === "compare" ? (viewPeriod * 2 + 3) : 0) +
                                                ((viewMode === "mtd" || isEditing) ? (isEditing ? 1 : 3) : 0) +
                                                (viewMode === "ytd" && !isEditing ? 3 : 0)
                                            }
                                            className="h-24 text-center"
                                        >
                                            No data available for this selection.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </div>
    );
}


