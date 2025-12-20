import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/tables/data-table";
import { columns } from "@/components/tables/columns";
import { Transaction } from "@/data/transactions";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

const TransactionsPage: React.FC = () => {
    const [data, setData] = useState<Transaction[]>([]);
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
    }, []);

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
        <DataTable
            columns={columns}
            data={data}
            filterColumnId="description"
        />;
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
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add New Transaction
                </Button>
            </div>
            {renderContent()}
        </div>
    );
};

export default TransactionsPage;
