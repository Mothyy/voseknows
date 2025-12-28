import { useState, useEffect, useMemo } from "react";
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
import { cn } from "@/lib/utils";
import { Calendar, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfYear,
} from "date-fns";

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
}

interface BudgetSummaryProps {
    startDate: Date; // This is the reference date (selected month)
}

export function BudgetSummary({ startDate }: BudgetSummaryProps) {
    const [mergedData, setMergedData] = useState<MergedBudgetRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showMTD, setShowMTD] = useState(true);
    const [showYTD, setShowYTD] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!showMTD && !showYTD) {
                setMergedData([]);
                return;
            }

            try {
                setLoading(true);
                const mtdStart = format(startOfMonth(startDate), "yyyy-MM-dd");
                const mtdEnd = format(endOfMonth(startDate), "yyyy-MM-dd");
                const ytdStart = format(startOfYear(startDate), "yyyy-MM-dd");
                const ytdEnd = mtdEnd;

                const fetchMTD = showMTD
                    ? apiClient.get<BudgetRecord[]>(
                        `/reports/budget-variance?startDate=${mtdStart}&endDate=${mtdEnd}`,
                    )
                    : Promise.resolve({ data: [] as BudgetRecord[] });

                const fetchYTD = showYTD
                    ? apiClient.get<BudgetRecord[]>(
                        `/reports/budget-variance?startDate=${ytdStart}&endDate=${ytdEnd}`,
                    )
                    : Promise.resolve({ data: [] as BudgetRecord[] });

                const [mtdRes, ytdRes] = await Promise.all([
                    fetchMTD,
                    fetchYTD,
                ]);

                // Merge the datasets
                const categoriesMap = new Map<string, MergedBudgetRecord>();

                // Build merged structure
                const processRecords = (
                    records: BudgetRecord[],
                    type: "mtd" | "ytd",
                ) => {
                    records.forEach((rec) => {
                        const existing = categoriesMap.get(rec.id);
                        if (existing) {
                            if (type === "mtd") {
                                existing.mtd_budget = Number(rec.budget);
                                existing.mtd_actual = Number(rec.actual);
                            } else {
                                existing.ytd_budget = Number(rec.budget);
                                existing.ytd_actual = Number(rec.actual);
                            }
                        } else {
                            categoriesMap.set(rec.id, {
                                category_id: rec.id,
                                category_name: rec.name,
                                parent_id: (rec as any).parent_id || null, // API usually returns this
                                mtd_budget:
                                    type === "mtd" ? Number(rec.budget) : 0,
                                mtd_actual:
                                    type === "mtd" ? Number(rec.actual) : 0,
                                ytd_budget:
                                    type === "ytd" ? Number(rec.budget) : 0,
                                ytd_actual:
                                    type === "ytd" ? Number(rec.actual) : 0,
                            });
                        }
                    });
                };

                processRecords(mtdRes.data, "mtd");
                processRecords(ytdRes.data, "ytd");

                const sortedData = Array.from(categoriesMap.values()).sort(
                    (a, b) => a.category_name.localeCompare(b.category_name),
                );

                setMergedData(sortedData);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch budget summary:", err);
                setError("Failed to load budget summary.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [startDate, showMTD, showYTD]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    const totals = useMemo(() => {
        return mergedData.reduce(
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
    }, [mergedData]);

    const mtdVariance = totals.mtd_budget + totals.mtd_actual;
    const ytdVariance = totals.ytd_budget + totals.ytd_actual;

    return (
        <div className="space-y-6">
            <div className="flex justify-center items-center gap-2 bg-muted/30 p-1.5 rounded-lg w-fit mx-auto border shadow-sm">
                <Button
                    variant={showMTD ? "default" : "ghost"}
                    onClick={() => setShowMTD(!showMTD)}
                    size="sm"
                    className="h-8"
                >
                    <Calendar className="mr-2 h-4 w-4" />
                    Month to Date
                </Button>
                <Button
                    variant={showYTD ? "default" : "ghost"}
                    onClick={() => setShowYTD(!showYTD)}
                    size="sm"
                    className="h-8"
                >
                    <Target className="mr-2 h-4 w-4" />
                    Year to Date
                </Button>
            </div>

            {loading ? (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
                        {showMTD && (
                            <Card className="border-l-4 border-l-blue-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        MTD Status
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
                                        {mtdVariance >= 0
                                            ? "Under Budget"
                                            : "Over Budget"}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {showYTD && (
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
                        <Card className="bg-muted/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                    Total Spendings
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(
                                        showYTD
                                            ? Math.abs(totals.ytd_actual)
                                            : Math.abs(totals.mtd_actual),
                                    )}
                                </div>
                                <p className="text-xs mt-1 text-muted-foreground">
                                    {showYTD ? "Total YTD" : "Total MTD"}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="rounded-md border bg-card overflow-hidden">
                        <Table>
                            <TableHeader>
                                {showMTD && showYTD && (
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
                                    <TableHead>Category</TableHead>
                                    {showMTD && (
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
                                    {showYTD && (
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mergedData.map((item: MergedBudgetRecord) => {
                                    const mtdVar =
                                        item.mtd_budget + item.mtd_actual;
                                    const ytdVar =
                                        item.ytd_budget + item.ytd_actual;

                                    return (
                                        <TableRow key={item.category_id}>
                                            <TableCell className="font-medium">
                                                {item.category_name}
                                            </TableCell>
                                            {showMTD && (
                                                <>
                                                    <TableCell className="text-right">
                                                        {formatCurrency(
                                                            item.mtd_budget,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {formatCurrency(
                                                            item.mtd_actual,
                                                        )}
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
                                            {showYTD && (
                                                <>
                                                    <TableCell className="text-right border-l">
                                                        {formatCurrency(
                                                            item.ytd_budget,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {formatCurrency(
                                                            item.ytd_actual,
                                                        )}
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
                                        </TableRow>
                                    );
                                })}
                                {mergedData.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={
                                                1 +
                                                (showMTD ? 3 : 0) +
                                                (showYTD ? 3 : 0)
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

