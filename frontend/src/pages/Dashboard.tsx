import React, { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";
import apiClient from "@/lib/api";
import { cn } from "@/lib/utils";

const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

interface DashboardData {
    totalSpend: number;
    totalBudget: number;
    variance: number;
    worthOverTime: { name: string; worth: number; budget: number }[];
    categoryVariance: { name: string; variance: number }[];
    netBalances?: { netInBudget: number; netNonBudget: number };
}

const Dashboard: React.FC = () => {
    // ... existing state hooks ...
    const [startMonth, setStartMonth] = React.useState<string>("January");
    const [startYear, setStartYear] = React.useState<number>(currentYear);
    const [endMonth, setEndMonth] = React.useState<string>("December");
    const [endYear, setEndYear] = React.useState<number>(currentYear);

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        const sMonth = monthNames.indexOf(startMonth);
        const sDate = new Date(startYear, sMonth, 1);

        const eMonth = monthNames.indexOf(endMonth);
        const eDate = new Date(endYear, eMonth + 1, 0);

        try {
            const response = await apiClient.get("/dashboard", {
                params: {
                    start: sDate.toISOString().split("T")[0],
                    end: eDate.toISOString().split("T")[0],
                },
            });
            setData(response.data);
        } catch (err) {
            setError("Failed to fetch dashboard data.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleApplyRange = () => {
        fetchData();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
        }).format(amount);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                {/* ... existing Selects ... */}
                <div className="flex items-center space-x-2">
                    <Select value={startMonth} onValueChange={setStartMonth}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Start Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {monthNames.map((month) => (
                                <SelectItem key={month} value={month}>
                                    {month}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={startYear.toString()}
                        onValueChange={(val) => setStartYear(parseInt(val))}
                    >
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Start Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">to</span>
                    <Select value={endMonth} onValueChange={setEndMonth}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="End Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {monthNames.map((month) => (
                                <SelectItem key={month} value={month}>
                                    {month}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={endYear.toString()}
                        onValueChange={(val) => setEndYear(parseInt(val))}
                    >
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="End Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleApplyRange} disabled={loading}>
                        {loading ? "Loading..." : "Apply"}
                    </Button>
                </div>
            </div>

            {error && <p className="text-red-500">{error}</p>}

            <div className="grid gap-4 md:grid-cols-2 mb-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Net Position (Budget)</CardTitle>
                        <CardDescription>Current balance of all 'In Budget' accounts</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className={cn("text-2xl font-bold", (data?.netBalances?.netInBudget ?? 0) < 0 ? "text-red-600" : "text-green-600")}>
                            {loading ? "..." : formatCurrency(data?.netBalances?.netInBudget ?? 0)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Net Position (Non-Budget)</CardTitle>
                        <CardDescription>Current balance of all 'Non Budget' accounts</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className={cn("text-2xl font-bold", (data?.netBalances?.netNonBudget ?? 0) < 0 ? "text-red-600" : "text-green-600")}>
                            {loading ? "..." : formatCurrency(data?.netBalances?.netNonBudget ?? 0)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Total Spend</CardTitle>
                        <CardDescription>
                            From {startMonth} {startYear} to {endMonth}{" "}
                            {endYear}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {loading
                                ? "..."
                                : formatCurrency(data?.totalSpend ?? 0)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Total Budget</CardTitle>
                        <CardDescription>
                            From {startMonth} {startYear} to {endMonth}{" "}
                            {endYear}
                        </CardDescription>
                        .
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {loading
                                ? "..."
                                : formatCurrency(data?.totalBudget ?? 0)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Variance</CardTitle>
                        <CardDescription>
                            From {startMonth} {startYear} to {endMonth}{" "}
                            {endYear}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p
                            className={cn(
                                "text-2xl font-bold",
                                (data?.variance ?? 0) >= 0
                                    ? "text-green-600"
                                    : "text-red-600",
                            )}
                        >
                            {loading
                                ? "..."
                                : formatCurrency(data?.variance ?? 0)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 mt-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Worth Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={data?.worthOverTime ?? []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Area
                                    type="monotone"
                                    dataKey="worth"
                                    stroke="#8884d8"
                                    fill="#8884d8"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="budget"
                                    stroke="#82ca9d"
                                    fill="#82ca9d"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Category Variance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data?.categoryVariance ?? []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="variance" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
