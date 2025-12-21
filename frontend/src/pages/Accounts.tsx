import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    PlusCircle,
    Landmark,
    CreditCard,
    PiggyBank,
    ShieldCheck,
    MoreVertical,
    Edit,
    Trash,
} from "lucide-react";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import AccountForm from "./AccountForm";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Define the shape of an Account object based on our API
export type Account = {
    id: string;
    name: string;
    type: "checking" | "savings" | "credit" | string; // Allow for other types
    balance: number;
    starting_balance: number;
    include_in_budget: boolean;
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

    const handleEdit = (account: Account) => {
        setSelectedAccount(account);
        setIsFormOpen(true);
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

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get<Account[]>("/accounts");
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
    }, []);

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
        return (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                    <Card key={account.id} className="h-full">
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
                                    <DropdownMenuItem
                                        onClick={() => handleEdit(account)}
                                    >
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleDelete(account.id)}
                                        className="text-red-600"
                                    >
                                        <Trash className="mr-2 h-4 w-4" />{" "}
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <Link to={`/accounts/${account.id}`}>
                            <CardContent>
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
                                {account.include_in_budget && (
                                    <div className="mt-4 flex items-center text-xs text-muted-foreground">
                                        <ShieldCheck className="mr-1 h-4 w-4 text-green-500" />
                                        <span>Included in budget</span>
                                    </div>
                                )}
                            </CardContent>
                        </Link>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <>
            <div className="container mx-auto py-10 px-4">
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
        </>
    );
};

export default AccountsPage;
