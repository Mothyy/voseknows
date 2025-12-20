import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowUp, ArrowDown } from "lucide-react";

interface BudgetSummaryItem {
    category_id: string;
    category_name: string;
    parent_id: string | null;
    budget: number;
    actual: number;
}

interface BudgetSummaryProps {
    startDate: Date;
}

export function BudgetSummary({ startDate }: BudgetSummaryProps) {
    const [data, setData] = useState<BudgetSummaryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"monthly" | "cumulative">(
        "monthly",
    );

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                let endpoint = "";

                if (viewMode === "monthly") {
                    // Format date as YYYY-MM-01 for the specific month
                    const monthStr = `${startDate.getFullYear()}-${String(
                        startDate.getMonth() + 1,
                    ).padStart(2, "0")}-01`;
                    endpoint = `/budgets/report?month=${monthStr}`;
                } else {
                    // Format date as YYYY-MM-DD for cumulative start date
                    const dateStr = `${startDate.getFullYear()}-${String(
                        startDate.getMonth() + 1,
                    ).padStart(2, "0")}-${String(startDate.getDate()).padStart(
                        2,
                        "0",
                    )}`;
                    endpoint = `/budgets/summary?startDate=${dateStr}`;
                }

                const response = await apiClient.get<any[]>(endpoint);

                // Normalize data structure since endpoints return slightly different keys
                const normalizedData = response.data.map((item) => ({
                    category_id: item.category_id,
                    category_name: item.category_name,
                    parent_id: item.parent_id,
                    budget: parseFloat(item.budget || item.total_budget || 0),
                    actual: parseFloat(item.actual || item.total_actual || 0),
                }));

                setData(normalizedData);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch budget summary:", err);
                setError("Failed to load budget summary.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [startDate, viewMode]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    const totalBudget = data.reduce((acc, item) => acc + item.budget, 0);
    const totalActual = data.reduce((acc, item) => acc + item.actual, 0);
    // Net Result: Budget - Actual (Positive means under budget/savings, Negative means over budget)
    // Wait, typically Variance = Budget - Actual.
    // If Budget is 100 and Actual is -120 (spending), then 100 - (-120) = 220? No.
    // In this app, expenses seem to be stored as negative numbers based on the transactions data file?
    // Let's check the transaction data... "TRNAMT>-59.69</TRNAMT>". Yes, expenses are negative.
    // Budgets are typically positive targets.
    // So "Remaining" = Budget + Actual (since Actual is negative).
    // Example: Budget 200, Actual -150. Remaining = 50.
    // Example: Budget 200, Actual -250. Remaining = -50.
    const netResult = totalBudget + totalActual;

    return (
        <div className="space-y-6">
            <div className="flex justify-center space-x-4">
                <Button
                    variant={viewMode === "monthly" ? "default" : "outline"}
                    onClick={() => setViewMode("monthly")}
                    size="sm"
                >
                    Monthly View
                </Button>
                <Button
                    variant={viewMode === "cumulative" ? "default" : "outline"}
                    onClick={() => setViewMode("cumulative")}
                    size="sm"
                >
                    Cumulative Since Date
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-10">Loading summary...</div>
            ) : error ? (
                <div className="text-center text-red-500 py-10">{error}</div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {viewMode === "monthly"
                                        ? "Monthly Budget"
                                        : "Total Budget"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(totalBudget)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {viewMode === "monthly"
                                        ? "Monthly Actual"
                                        : "Total Actual"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-muted-foreground">
                                    {formatCurrency(totalActual)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Remaining
                                </CardTitle>
                                {netResult >= 0 ? (
                                    <ArrowUp className="h-4 w-4 text-green-500" />
                                ) : (
                                    <ArrowDown className="h-4 w-4 text-red-500" />
                                )}
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={cn(
                                        "text-2xl font-bold",
                                        netResult >= 0
                                            ? "text-green-600"
                                            : "text-red-600",
                                    )}
                                >
                                    {formatCurrency(netResult)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {netResult >= 0
                                        ? "Under Budget"
                                        : "Over Budget"}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">
                                        Budget
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Actual
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Variance
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((item) => {
                                    const variance = item.budget + item.actual;

                                    return (
                                        <TableRow key={item.category_id}>
                                            <TableCell className="font-medium">
                                                {item.category_name}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(item.budget)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(item.actual)}
                                            </TableCell>
                                            <TableCell
                                                className={cn(
                                                    "text-right font-medium",
                                                    variance >= 0
                                                        ? "text-green-600"
                                                        : "text-red-600",
                                                )}
                                            >
                                                {formatCurrency(variance)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {data.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="h-24 text-center"
                                        >
                                            No data available for this period.
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
