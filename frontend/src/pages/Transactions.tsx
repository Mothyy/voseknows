import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/tables/data-table";
import { columns } from "@/components/tables/columns";
import { Transaction } from "@/data/transactions";
import { Account } from "@/pages/Accounts";
import { Category } from "@/pages/Categories";
import { CategorySelector } from "@/components/category-selector";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Layers } from "lucide-react";
import { RowSelectionState } from "@tanstack/react-table";

interface TransactionResponse {
    data: Transaction[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

const TransactionsPage: React.FC = () => {
    const [data, setData] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // Filters and Search
    const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Pagination
    const [page, setPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Bulk Actions
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [bulkCategoryId, setBulkCategoryId] = useState<string>("");

    const fetchTransactions = async (
        reset: boolean = false,
        currentPage: number = 1,
    ) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: "50",
                search: searchQuery,
            });

            if (selectedAccountId && selectedAccountId !== "all") {
                params.append("accountId", selectedAccountId);
            }
            if (selectedCategoryId && selectedCategoryId !== "all") {
                params.append("categoryId", selectedCategoryId);
            }

            const response = await apiClient.get<TransactionResponse>(
                `/transactions?${params.toString()}`,
            );

            if (reset) {
                setData(response.data.data);
                setRowSelection({});
            } else {
                setData((prev) => [...prev, ...response.data.data]);
            }

            setHasMore(currentPage < response.data.pagination.totalPages);
            setPage(currentPage + 1);
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

    // Initial Data Fetch
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [accRes, catRes] = await Promise.all([
                    apiClient.get<Account[]>("/accounts"),
                    apiClient.get<Category[]>("/categories"),
                ]);
                setAccounts(accRes.data);
                setCategories(catRes.data);
            } catch (err) {
                console.error("Failed to fetch metadata:", err);
            }
        };
        fetchMetadata();
    }, []);

    // Fetch on filter change
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTransactions(true, 1);
        }, 300);
        return () => clearTimeout(timer);
    }, [selectedAccountId, selectedCategoryId, searchQuery]);

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            fetchTransactions(false, page);
        }
    };

    const handleBulkCategorize = async () => {
        if (!bulkCategoryId) return;

        // Map rowSelection indices to transaction IDs
        const selectedIndices = Object.keys(rowSelection).map(Number);
        const selectedIds = selectedIndices
            .map((index) => data[index]?.id)
            .filter(Boolean);

        if (selectedIds.length === 0) return;

        try {
            await apiClient.post("/transactions/bulk-update", {
                transactionIds: selectedIds,
                categoryId:
                    bulkCategoryId === "uncategorized" ? null : bulkCategoryId,
            });
            // Refresh data and clear selection
            setRowSelection({});
            setBulkCategoryId("");
            fetchTransactions(true, 1);
        } catch (err) {
            console.error("Failed to bulk update:", err);
            alert("Failed to update transactions.");
        }
    };

    const renderContent = () => {
        if (loading && data.length === 0) {
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
                data={data}
                filterColumnId="description"
                refreshData={() => fetchTransactions(true, 1)}
                onSearch={setSearchQuery}
                onLoadMore={handleLoadMore}
                hasMore={hasMore}
                isLoading={loading}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
            />
        );
    };

    return (
        <div className="container mx-auto py-10 px-4">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Transactions
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            A list of your recent transactions from the
                            database.
                        </p>
                    </div>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add New Transaction
                    </Button>
                </div>

                <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2">
                        <Select
                            value={selectedAccountId}
                            onValueChange={setSelectedAccountId}
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filter by Account" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Accounts
                                </SelectItem>
                                {accounts.map((account) => (
                                    <SelectItem
                                        key={account.id}
                                        value={account.id}
                                    >
                                        {account.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={selectedCategoryId}
                            onValueChange={setSelectedCategoryId}
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filter by Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Categories
                                </SelectItem>
                                <SelectItem value="uncategorized">
                                    Uncategorized
                                </SelectItem>
                                {categories.map((category) => (
                                    <SelectItem
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {Object.keys(rowSelection).length > 0 && (
                        <div className="flex gap-2 items-center bg-muted p-2 rounded-md">
                            <span className="text-sm text-muted-foreground">
                                {Object.keys(rowSelection).length} selected
                            </span>
                            <div className="w-[250px]">
                                <CategorySelector
                                    categories={categories}
                                    value={bulkCategoryId}
                                    onChange={setBulkCategoryId}
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={handleBulkCategorize}
                                disabled={!bulkCategoryId}
                            >
                                <Layers className="mr-2 h-4 w-4" />
                                Apply
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            {renderContent()}
        </div>
    );
};

export default TransactionsPage;
