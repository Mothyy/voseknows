import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/tables/data-table";
import { columns } from "@/components/tables/columns";
import { Transaction } from "@/data/transactions";
import { Account } from "@/pages/Accounts";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PlusCircle } from "lucide-react";

const TransactionsPage: React.FC = () => {
    const [data, setData] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const response =
                await apiClient.get<Transaction[]>("/transactions");
            setData(response.data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch transactions:", err);
            setError(
                "Failed to load transactions. Please check the backend connection.",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
        const fetchAccounts = async () => {
            try {
                const response = await apiClient.get<Account[]>("/accounts");
                setAccounts(response.data);
            } catch (err) {
                console.error("Failed to fetch accounts:", err);
            }
        };
        fetchAccounts();
    }, []);

    const filteredData =
        selectedAccountId && selectedAccountId !== "all"
            ? data.filter((t) => t.account_id === selectedAccountId)
            : data;

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-10">
                    <p className="text-muted-foreground">
                        Loading transactions...
                    </p>
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
            <DataTable
                columns={columns}
                data={filteredData}
                filterColumnId="description"
                refreshData={fetchTransactions}
            />
        );
    };

    return (
        <div className="container mx-auto py-10 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Transactions
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        A list of your recent transactions from the database.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Select
                        value={selectedAccountId}
                        onValueChange={setSelectedAccountId}
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by Account" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Accounts</SelectItem>
                            {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                    {account.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add New Transaction
                    </Button>
                </div>
            </div>
            {renderContent()}
        </div>
    );
};

export default TransactionsPage;
