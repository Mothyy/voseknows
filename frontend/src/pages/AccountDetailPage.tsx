import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "@/lib/api";
import { Account } from "./Accounts"; // Reuse the Account type
import { Transaction } from "@/data/transactions"; // Reuse the Transaction type
import {
    ArrowLeft,
    Trash,
    PieChart as PieChartIcon,
    TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
} from "recharts";

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(amount);
};

const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
];

const AccountDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [account, setAccount] = useState<Account | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categorySummary, setCategorySummary] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const handleDeleteTransactions = async () => {
        if (!id) return;
        if (
            window.confirm(
                "Are you sure you want to delete ALL transactions for this account? This cannot be undone.",
            )
        ) {
            try {
                await apiClient.delete(`/accounts/${id}/transactions`);
                // Refresh data
                const [
                    accountResponse,
                    transactionsResponse,
                    categoryResponse,
                    historyResponse,
                ] = await Promise.all([
                    apiClient.get<Account>(`/accounts/${id}`),
                    apiClient.get<Transaction[]>(
                        `/accounts/${id}/transactions?limit=5`,
                    ),
                    apiClient.get<any[]>(`/accounts/${id}/category-summary`),
                    apiClient.get<any[]>(`/accounts/${id}/history`),
                ]);
                setAccount(accountResponse.data);
                setTransactions(transactionsResponse.data);
                setCategorySummary(categoryResponse.data);
                setHistory(
                    historyResponse.data.map((h: any) => ({
                        date: new Date(h.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                        }),
                        amount: parseFloat(h.amount),
                    })),
                );
            } catch (err) {
                console.error("Failed to delete transactions:", err);
                alert("Failed to delete transactions.");
            }
        }
    };

    useEffect(() => {
        const fetchAccountDetails = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const [
                    accountResponse,
                    transactionsResponse,
                    categoryResponse,
                    historyResponse,
                ] = await Promise.all([
                    apiClient.get<Account>(`/accounts/${id}`),
                    apiClient.get<Transaction[]>(
                        `/accounts/${id}/transactions?limit=5`,
                    ),
                    apiClient.get<any[]>(`/accounts/${id}/category-summary`),
                    apiClient.get<any[]>(`/accounts/${id}/history`),
                ]);
                setAccount(accountResponse.data);
                setTransactions(transactionsResponse.data);
                setCategorySummary(categoryResponse.data);
                setHistory(
                    historyResponse.data.map((h: any) => ({
                        date: new Date(h.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                        }),
                        amount: parseFloat(h.amount),
                    })),
                );
                setError(null);
            } catch (err) {
                console.error("Failed to fetch account details:", err);
                setError(
                    "Failed to load account details. The account may not exist.",
                );
            } finally {
                setLoading(false);
            }
        };

        fetchAccountDetails();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <p className="text-muted-foreground">
                    Loading account details...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto py-10 px-4">
                <Button asChild variant="outline" className="mb-4">
                    <Link to="/accounts">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Accounts
                    </Link>
                </Button>
                <div className="flex items-center justify-center py-10">
                    <p className="text-red-500">{error}</p>
                </div>
            </div>
        );
    }

    if (!account) {
        return null; // Should be handled by error state, but good for type safety
    }

    return (
        <div className="container mx-auto py-10 px-4">
            <div className="mb-6">
                <Button asChild variant="outline" className="mb-4">
                    <Link to="/accounts">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Accounts
                    </Link>
                </Button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {account.name}
                        </h1>
                        <p className="text-muted-foreground capitalize">
                            {account.type} Account
                        </p>
                        <div
                            className={cn(
                                "mt-2 text-4xl font-bold tracking-tight",
                                account.balance >= 0
                                    ? "text-green-600"
                                    : "text-red-600",
                            )}
                        >
                            {formatCurrency(account.balance)}
                        </div>
                    </div>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteTransactions}
                    >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete All Transactions
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <CardTitle>Expenditure History</CardTitle>
                            <CardDescription>
                                Daily spending over time
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={history}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="date"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    formatter={(value: any) => [
                                        formatCurrency(value),
                                        "Spent",
                                    ]}
                                    contentStyle={{
                                        borderRadius: "8px",
                                        border: "none",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                    }}
                                />
                                <Bar
                                    dataKey="amount"
                                    fill="hsl(var(--primary))"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <CardTitle>Spending by Category</CardTitle>
                            <CardDescription>
                                Distribution of expenses
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px] flex flex-col md:flex-row items-center">
                        <div className="w-full h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categorySummary}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categorySummary.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                    COLORS[
                                                        index % COLORS.length
                                                    ]
                                                }
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any) =>
                                            formatCurrency(value)
                                        }
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full space-y-2 mt-4 md:mt-0">
                            {categorySummary.slice(0, 5).map((entry, index) => (
                                <div
                                    key={entry.name}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <div className="flex items-center">
                                        <div
                                            className="w-3 h-3 rounded-full mr-2"
                                            style={{
                                                backgroundColor:
                                                    COLORS[
                                                        index % COLORS.length
                                                    ],
                                            }}
                                        />
                                        <span className="truncate max-w-[120px]">
                                            {entry.name}
                                        </span>
                                    </div>
                                    <span className="font-medium">
                                        {formatCurrency(
                                            parseFloat(entry.value),
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>
                        The last 5 transactions for this account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {transactions.length > 0 ? (
                            transactions.map((tx) => {
                                const amount =
                                    typeof tx.amount === "string"
                                        ? parseFloat(tx.amount)
                                        : tx.amount;
                                return (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between border-b pb-4 last:border-b-0 last:pb-0"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {tx.description}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(
                                                    tx.date,
                                                ).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div
                                            className={cn(
                                                "font-semibold",
                                                amount >= 0
                                                    ? "text-green-600"
                                                    : "text-red-600",
                                            )}
                                        >
                                            {formatCurrency(amount)}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No recent transactions found for this account.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AccountDetailPage;
