import React, { useState, useEffect } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    ReferenceLine,
    Cell,
} from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import apiClient from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BudgetVarianceItem {
    id: string;
    name: string;
    budget: number;
    actual: number; // Usually negative for expenses
    variance?: number; // Calculated on frontend
}

interface WealthItem {
    date: string;
    balance: number;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(amount);
};

const ReportsPage: React.FC = () => {
    // Default to current month
    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

    const [varianceData, setVarianceData] = useState<BudgetVarianceItem[]>([]);
    const [wealthData, setWealthData] = useState<WealthItem[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const startStr = format(startDate, "yyyy-MM-dd");
            const endStr = format(endDate, "yyyy-MM-dd");

            const [varianceRes, wealthRes] = await Promise.all([
                apiClient.get<BudgetVarianceItem[]>(
                    `/reports/budget-variance?startDate=${startStr}&endDate=${endStr}`,
                ),
                apiClient.get<WealthItem[]>(
                    `/reports/wealth?startDate=${startStr}&endDate=${endStr}`,
                ),
            ]);

            // Process variance data to add a 'variance' field for the chart
            // Variance = Budget + Actual (assuming Actual is negative)
            const processedVariance = varianceRes.data
                .map((item) => ({
                    ...item,
                    variance: item.budget + item.actual,
                }))
                .sort((a, b) => a.variance - b.variance);

            setVarianceData(processedVariance);
            setWealthData(wealthRes.data);
        } catch (error) {
            console.error("Failed to fetch reports:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleUpdate = () => {
        fetchReports();
    };

    // Summary Calculations
    const totalBudget = varianceData.reduce(
        (acc, item) => acc + item.budget,
        0,
    );
    const totalActual = varianceData.reduce(
        (acc, item) => acc + item.actual,
        0,
    );
    const netVariance = totalBudget + totalActual;

    return (
        <div className="container mx-auto py-10 px-4 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Reports
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Analyze your financial health and budget performance.
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="start-date" className="text-xs">
                            Start Date
                        </Label>
                        <Input
                            id="start-date"
                            type="date"
                            value={format(startDate, "yyyy-MM-dd")}
                            onChange={(e) =>
                                e.target.value &&
                                setStartDate(new Date(e.target.value))
                            }
                            className="w-[150px]"
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="end-date" className="text-xs">
                            End Date
                        </Label>
                        <Input
                            id="end-date"
                            type="date"
                            value={format(endDate, "yyyy-MM-dd")}
                            onChange={(e) =>
                                e.target.value &&
                                setEndDate(new Date(e.target.value))
                            }
                            className="w-[150px]"
                        />
                    </div>
                    <Button onClick={handleUpdate} disabled={loading}>
                        <RefreshCcw
                            className={cn(
                                "mr-2 h-4 w-4",
                                loading && "animate-spin",
                            )}
                        />
                        Update
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Budget
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
                            Total Spent
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
                            Net Variance
                        </CardTitle>
                        {netVariance >= 0 ? (
                            <ArrowUp className="h-4 w-4 text-green-500" />
                        ) : (
                            <ArrowDown className="h-4 w-4 text-red-500" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div
                            className={cn(
                                "text-2xl font-bold",
                                netVariance >= 0
                                    ? "text-green-600"
                                    : "text-red-600",
                            )}
                        >
                            {formatCurrency(netVariance)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {netVariance >= 0 ? "Under Budget" : "Over Budget"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Category Variance Chart */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Budget Variance by Category</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[500px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={varianceData}
                                    margin={{
                                        top: 5,
                                        right: 30,
                                        left: 40,
                                        bottom: 5,
                                    }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        horizontal={false}
                                    />
                                    <XAxis
                                        type="number"
                                        tickFormatter={(value) => `$${value}`}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={120}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip
                                        formatter={(value: any) =>
                                            formatCurrency(value)
                                        }
                                        cursor={{ fill: "transparent" }}
                                    />
                                    <Legend />
                                    <ReferenceLine x={0} stroke="#666" />
                                    <Bar
                                        dataKey="variance"
                                        name="Variance"
                                        radius={[0, 4, 4, 0]}
                                    >
                                        {varianceData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                    (entry.variance || 0) >= 0
                                                        ? "#22c55e"
                                                        : "#ef4444"
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Wealth Chart */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Total Wealth Growth</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[500px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={wealthData}
                                    margin={{
                                        top: 10,
                                        right: 10,
                                        left: 0,
                                        bottom: 0,
                                    }}
                                >
                                    <defs>
                                        <linearGradient
                                            id="colorBalance"
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="5%"
                                                stopColor="#3b82f6"
                                                stopOpacity={0.8}
                                            />
                                            <stop
                                                offset="95%"
                                                stopColor="#3b82f6"
                                                stopOpacity={0}
                                            />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(str) => {
                                            const date = new Date(str);
                                            return format(date, "MMM d");
                                        }}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        tickFormatter={(value) =>
                                            new Intl.NumberFormat("en-US", {
                                                notation: "compact",
                                                compactDisplay: "short",
                                            }).format(value)
                                        }
                                    />
                                    <Tooltip
                                        formatter={(value: any) =>
                                            formatCurrency(value)
                                        }
                                        labelFormatter={(label) =>
                                            format(new Date(label), "PPP")
                                        }
                                    />
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="balance"
                                        stroke="#3b82f6"
                                        fillOpacity={1}
                                        fill="url(#colorBalance)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ReportsPage;
