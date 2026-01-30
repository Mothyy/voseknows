import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    PlusCircle,
    Landmark,
    CreditCard,
    PiggyBank,
    ShieldCheck,
    ShieldOff,
    Banknote,
    MoreVertical,
    Edit,
    Trash,
    List,
    ArrowRight,
    Archive,
    RotateCcw,
    Upload,
    LayoutGrid,
    Table as TableIcon
} from "lucide-react";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import AccountForm from "./AccountForm";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BalanceAdjustmentDialog } from "@/components/BalanceAdjustmentDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Define the shape of an Account object based on our API
export type Account = {
    id: string;
    name: string;
    type: "checking" | "savings" | "credit" | "loan" | string; // Allow for other types
    balance: number;
    starting_balance: number;
    include_in_budget: boolean;
    is_active?: boolean;
    total_income?: number;
    total_expenses?: number;
    interest_rate?: number;
    interest_start_date?: string;
    interest_type?: "simple" | "compound";
    last_interest_applied_at?: string;
};

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(amount);
};

// Helper to get an icon based on account type
const getAccountIcon = (type: Account["type"]) => {
    switch (type.toLowerCase()) {
        case "checking":
            return <Landmark className="h-6 w-6 text-muted-foreground" />;
        case "savings":
            return <PiggyBank className="h-6 w-6 text-muted-foreground" />;
        case "credit":
            return <CreditCard className="h-6 w-6 text-muted-foreground" />;
        case "loan":
            return <Banknote className="h-6 w-6 text-muted-foreground" />;
        default:
            return <Landmark className="h-6 w-6 text-muted-foreground" />;
    }
};

const AccountsPage: React.FC = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(
        null,
    );
    const [balancingAccount, setBalancingAccount] = useState<Account | null>(null);
    const [showInactive, setShowInactive] = useState(false);
    const [importAccount, setImportAccount] = useState<Account | null>(null);
    const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
        if (typeof window !== "undefined") {
            return (localStorage.getItem("accounts-view-mode") as "cards" | "table") || "cards";
        }
        return "cards";
    });

    useEffect(() => {
        localStorage.setItem("accounts-view-mode", viewMode);
    }, [viewMode]);

    const handleEdit = (account: Account) => {
        setSelectedAccount(account);
        setIsFormOpen(true);
    };

    const handleToggleActive = async (account: Account) => {
        try {
            await apiClient.patch(`/accounts/${account.id}`, {
                is_active: !(account.is_active !== false) // Toggle boolean
            });
            fetchAccounts();
        } catch (e) {
            console.error(e);
            alert("Failed to update status");
        }
    };

    const handleDeleteTransactions = async (id: string) => {
        if (
            window.confirm(
                "Are you sure you want to delete ALL transactions for this account? This cannot be undone.",
            )
        ) {
            try {
                await apiClient.delete(`/accounts/${id}/transactions`);
                fetchAccounts();
            } catch (err) {
                console.error("Failed to delete transactions:", err);
                alert("Failed to delete transactions.");
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this account?")) {
            try {
                await apiClient.delete(`/accounts/${id}`);
                fetchAccounts();
            } catch (err) {
                console.error("Failed to delete account:", err);
                alert("Failed to delete account.");
            }
        }
    };

    const handleRecalculateInterest = async (id: string) => {
        try {
            await apiClient.post(`/accounts/${id}/recalculate-interest`);
            fetchAccounts();
        } catch (err) {
            console.error("Failed to recalculate interest:", err);
            alert("Failed to recalculate interest.");
        }
    };

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get<Account[]>(`/accounts?showInactive=${showInactive}`);
            setAccounts(response.data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch accounts:", err);
            setError("Failed to load accounts. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, [showInactive]);

    const renderTableView = () => {
        return (
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px]">Account</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead>Budget Status</TableHead>
                            <TableHead className="text-right w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accounts.map((account) => (
                            <TableRow key={account.id} className={cn(account.is_active === false && "opacity-60")}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-3">
                                        {getAccountIcon(account.type)}
                                        <div className="flex flex-col">
                                            <Link
                                                to={`/accounts/${account.id}`}
                                                className="hover:underline font-semibold"
                                            >
                                                {account.name}
                                            </Link>
                                            {account.is_active === false && (
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Inactive</span>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="capitalize">{account.type}</TableCell>
                                <TableCell className={cn(
                                    "text-right font-bold",
                                    account.balance >= 0 ? "text-green-600" : "text-red-600"
                                )}>
                                    {formatCurrency(account.balance)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center text-xs text-muted-foreground">
                                        {account.include_in_budget ? (
                                            <>
                                                <ShieldCheck className="mr-1 h-3.5 w-3.5 text-green-500" />
                                                <span>Included</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldOff className="mr-1 h-3.5 w-3.5 text-red-500" />
                                                <span>Excluded</span>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link to={`/transactions?accountId=${account.id}`}>
                                                    <List className="mr-2 h-4 w-4" /> View Transactions
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleEdit(account)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setBalancingAccount(account)}>
                                                <Banknote className="mr-2 h-4 w-4" /> Reconcile
                                            </DropdownMenuItem>
                                            {account.type === "loan" && (
                                                <DropdownMenuItem onClick={() => handleRecalculateInterest(account.id)}>
                                                    <RotateCcw className="mr-2 h-4 w-4" /> Recalculate Interest
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => handleToggleActive(account)}>
                                                {account.is_active === false ? (
                                                    <><RotateCcw className="mr-2 h-4 w-4" /> Restore</>
                                                ) : (
                                                    <><Archive className="mr-2 h-4 w-4" /> Archive Account</>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => handleDeleteTransactions(account.id)}
                                                className="text-red-600"
                                            >
                                                <Trash className="mr-2 h-4 w-4" /> Delete Transactions
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(account.id)}
                                                className="text-red-600"
                                            >
                                                <Trash className="mr-2 h-4 w-4" /> Delete Account
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-5 w-[150px]" />
                                <Skeleton className="h-6 w-6 rounded-full" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-9 w-[120px] mb-2" />
                                <Skeleton className="h-4 w-[100px]" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex items-center justify-center py-10">
                    <p className="text-red-500">{error}</p>
                </div>
            );
        }
        if (viewMode === "table") {
            return renderTableView();
        }
        return (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                    <Card key={account.id} className={cn("h-full", account.is_active === false && "opacity-60")}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                {getAccountIcon(account.type)}
                                <Link
                                    to={`/accounts/${account.id}`}
                                    className="hover:underline"
                                >
                                    <CardTitle className="text-lg font-medium">
                                        {account.name}
                                    </CardTitle>
                                </Link>
                                {account.is_active === false && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>}
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                    >
                                        <span className="sr-only">
                                            Open menu
                                        </span>
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <Link
                                            to={`/transactions?accountId=${account.id}`}
                                        >
                                            <List className="mr-2 h-4 w-4" />{" "}
                                            View Transactions
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleEdit(account)}
                                    >
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleToggleActive(account)}
                                    >
                                        {account.is_active === false ? (
                                            <>
                                                <RotateCcw className="mr-2 h-4 w-4" /> Restore Account
                                            </>
                                        ) : (
                                            <>
                                                <Archive className="mr-2 h-4 w-4" /> Archive Account
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                    {account.type === "loan" && (
                                        <DropdownMenuItem onClick={() => handleRecalculateInterest(account.id)}>
                                            <RotateCcw className="mr-2 h-4 w-4" /> Recalculate Interest
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() =>
                                            handleDeleteTransactions(account.id)
                                        }
                                        className="text-red-600"
                                    >
                                        <Trash className="mr-2 h-4 w-4" />{" "}
                                        Delete Transactions
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleDelete(account.id)}
                                        className="text-red-600"
                                    >
                                        <Trash className="mr-2 h-4 w-4" />{" "}
                                        Delete Account
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent>
                            <Link to={`/accounts/${account.id}`}>
                                <div
                                    className={cn(
                                        "text-3xl font-bold",
                                        account.balance >= 0
                                            ? "text-green-600"
                                            : "text-red-600",
                                    )}
                                >
                                    {formatCurrency(account.balance)}
                                </div>
                                <p className="text-xs capitalize text-muted-foreground">
                                    {account.type} Account
                                </p>
                                <div className="mt-4 flex items-center text-xs text-muted-foreground">
                                    {account.include_in_budget ? (
                                        <>
                                            <ShieldCheck className="mr-1 h-4 w-4 text-green-500" />
                                            <span>Included in budget</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldOff className="mr-1 h-4 w-4 text-red-500" />
                                            <span>Excluded from budget</span>
                                        </>
                                    )}
                                </div>
                            </Link>
                            <div className="mt-6 pt-4 border-t flex justify-between items-center gap-2">
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                >
                                    <Link
                                        to={`/transactions?accountId=${account.id}`}
                                    >
                                        <List className="mr-2 h-4 w-4" />
                                        Transactions
                                    </Link>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBalancingAccount(account)}
                                    title="Reconcile Balance"
                                    className="px-3"
                                >
                                    <Banknote className="h-4 w-4" />
                                </Button>
                                <Button asChild variant="ghost" size="sm">
                                    <Link to={`/accounts/${account.id}`}>
                                        Details
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))
                }
            </div >
        );
    };

    return (
        <>
            <div>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Accounts
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            An overview of your financial accounts.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowInactive(!showInactive)}
                        >
                            {showInactive ? "Hide Active" : "Show Inactive"}
                        </Button>
                        <div className="flex items-center border rounded-md ml-2 h-10 overflow-hidden">
                            <Button
                                variant={viewMode === "cards" ? "secondary" : "ghost"}
                                size="sm"
                                className="rounded-none px-3"
                                onClick={() => setViewMode("cards")}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === "table" ? "secondary" : "ghost"}
                                size="sm"
                                className="rounded-none px-3"
                                onClick={() => setViewMode("table")}
                            >
                                <TableIcon className="h-4 w-4" />
                            </Button>
                        </div>
                        <ImportTransactionsDialog
                            onUploadSuccess={fetchAccounts}
                        />
                        <Button
                            onClick={() => {
                                setSelectedAccount(null);
                                setIsFormOpen(true);
                            }}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add New Account
                        </Button>
                    </div>
                </div>
                {renderContent()}
            </div>
            <AccountForm
                account={selectedAccount}
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setSelectedAccount(null);
                }}
                onSuccess={fetchAccounts}
            />
            <BalanceAdjustmentDialog
                open={!!balancingAccount}
                onClose={() => setBalancingAccount(null)}
                accounts={accounts}
                initialAccountId={balancingAccount?.id}
                onSuccess={fetchAccounts}
            />
            {/* Controlled dialog for specific account import */}
            <ImportTransactionsDialog
                open={!!importAccount}
                onOpenChange={(open) => !open && setImportAccount(null)}
                initialAccountId={importAccount?.id}
                onUploadSuccess={() => {
                    setImportAccount(null);
                    fetchAccounts();
                }}
            />
        </>
    );
};

export default AccountsPage;
