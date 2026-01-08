import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
import { PlusCircle, Layers, Banknote, Brain } from "lucide-react";
import { BalanceAdjustmentDialog } from "@/components/BalanceAdjustmentDialog";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";
import { SortingState } from "@tanstack/react-table";
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
    const [searchParams, setSearchParams] = useSearchParams();
    const initialAccountId = searchParams.get("accountId") || "all";
    const initialCategoryId = searchParams.get("categoryId") || "all";
    const initialMonth = searchParams.get("month") || "";

    const [data, setData] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // Filters and Search
    const [selectedAccountId, setSelectedAccountId] =
        useState<string>(initialAccountId);
    const [selectedCategoryId, setSelectedCategoryId] =
        useState<string>(initialCategoryId);
    const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [sorting, setSorting] = useState<SortingState>([]);

    // Pagination
    const [page, setPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Bulk Actions
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    // Sync URL parameters to state for deep linking
    useEffect(() => {
        const accountId = searchParams.get("accountId") || "all";
        const categoryId = searchParams.get("categoryId") || "all";
        const month = searchParams.get("month") || "";
        setSelectedAccountId(accountId);
        setSelectedCategoryId(categoryId);
        setSelectedMonth(month);
    }, [searchParams]);

    const handleAccountChange = (value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value === "all") {
            newParams.delete("accountId");
        } else {
            newParams.set("accountId", value);
        }
        setSearchParams(newParams);
    };

    const handleCategoryChange = (value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value === "all") {
            newParams.delete("categoryId");
        } else {
            newParams.set("categoryId", value);
        }
        setSearchParams(newParams);
    };
    const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
    const [showBalanceDialog, setShowBalanceDialog] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchTransactions = async (
        reset: boolean = false,
        currentPage: number = 1,
        filters?: {
            accountId: string;
            categoryId: string;
            search: string;
            month: string;
        },
    ) => {
        const currentAccountId = filters
            ? filters.accountId
            : selectedAccountId;
        const currentCategoryId = filters
            ? filters.categoryId
            : selectedCategoryId;
        const currentMonth = filters ? filters.month : selectedMonth;
        const currentSearchQuery = filters ? filters.search : searchQuery;

        if (reset) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();
        } else {
            if (
                !abortControllerRef.current ||
                abortControllerRef.current.signal.aborted
            ) {
                abortControllerRef.current = new AbortController();
            }
        }

        const signal = abortControllerRef.current.signal;

        try {
            console.log("Fetching transactions...", {
                reset,
                currentPage,
                currentAccountId,
                currentCategoryId,
                currentMonth,
                currentSearchQuery,
            });
            setLoading(true);
            const params: any = {
                page: currentPage,
                limit: 50,
                search: currentSearchQuery,
            };

            if (sorting.length > 0) {
                params.sortBy = sorting[0].id;
                params.sortOrder = sorting[0].desc ? "desc" : "asc";
            }

            if (currentAccountId && currentAccountId !== "all") {
                params.accountId = currentAccountId;
            }
            if (currentCategoryId && currentCategoryId !== "all") {
                params.categoryId = currentCategoryId;
            }
            if (currentMonth) {
                params.month = currentMonth;
            }

            const response = await apiClient.get<TransactionResponse>(
                "/transactions",
                { params, signal },
            );

            console.log("Transactions fetched:", response.data);

            if (reset) {
                setData(response.data.data || []);
                setRowSelection({});
            } else {
                setData((prev) => [...prev, ...(response.data.data || [])]);
            }

            setHasMore(
                response.data.pagination
                    ? currentPage < response.data.pagination.totalPages
                    : false,
            );
            setPage(currentPage + 1);
            setError(null);
        } catch (err: any) {
            if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
                console.log("Request canceled");
                return;
            }
            console.error("Failed to fetch transactions:", err);
            setError(
                "Failed to load transactions. Please check the backend connection.",
            );
        } finally {
            if (!signal.aborted) {
                setLoading(false);
            }
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

                setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
                setCategories(Array.isArray(catRes.data) ? catRes.data : []);
            } catch (err) {
                console.error("Failed to fetch metadata:", err);
            }
        };
        fetchMetadata();
    }, []);

    // Fetch on filter change
    useEffect(() => {
        console.log("Filter changed:", {
            selectedAccountId,
            selectedCategoryId,
            searchQuery,
        });

        // Reset state immediately to prevent stale data display
        setData([]);
        setPage(1);
        setHasMore(true);
        setRowSelection({});
        setLoading(true);

        const timer = setTimeout(() => {
            fetchTransactions(true, 1, {
                accountId: selectedAccountId,
                categoryId: selectedCategoryId,
                month: selectedMonth,
                search: searchQuery,
            });
        }, 300);

        return () => {
            clearTimeout(timer);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [selectedAccountId, selectedCategoryId, selectedMonth, searchQuery, sorting]);

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

    const handleAutoClassify = async () => {
        const confirmMsg = "This will use your configured AI provider to classify uncategorized transactions. Continue?";
        if (!confirm(confirmMsg)) return;

        setLoading(true);
        try {
            const res = await apiClient.post("/classification/auto-classify", {});
            const count = res.data.categorized_count || 0;
            const details = res.data.results || [];

            let msg = `Successfully categorized ${count} transactions.`;
            if (count > 0) {
                msg += `\n\nSample: ${details.slice(0, 3).map((d: any) => `${d.description} -> ${d.category}`).join("\n")}`;
            }
            alert(msg);
            fetchTransactions(true);
        } catch (err: any) {
            console.error("Auto-classify failed:", err);
            const errMsg = err.response?.data?.error || "Classification failed. Ensure you have an AI Integration set up in Settings.";
            alert(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const flatCategories = React.useMemo(() => {
        const flatten = (nodes: Category[], depth = 0): any[] => {
            let flat: any[] = [];
            nodes.forEach((node) => {
                flat.push({
                    id: node.id,
                    name: node.name,
                    displayName:
                        "\u00A0\u00A0".repeat(depth * 2) +
                        (depth > 0 ? "↳ " : "") +
                        node.name,
                });
                if (node.children && node.children.length > 0) {
                    flat.push(...flatten(node.children, depth + 1));
                }
            });
            return flat;
        };
        return flatten(categories);
    }, [categories]);

    const renderContent = () => {
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
                categories={categories}
                accounts={accounts}
                onSearch={setSearchQuery}
                onLoadMore={handleLoadMore}
                hasMore={hasMore}
                isLoading={loading}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                sorting={sorting}
                onSortingChange={setSorting}
            />
        );
    };

    return (
        <div>
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
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleAutoClassify} className="gap-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200">
                            <Brain className="h-4 w-4" />
                            Auto Classify
                        </Button>
                        <Button variant="outline" onClick={() => setShowBalanceDialog(true)}>
                            <Banknote className="mr-2 h-4 w-4" />
                            Adjust Balance
                        </Button>
                        <Button onClick={() => setShowCreateDialog(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add New Transaction
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2">
                        <Select
                            value={selectedAccountId}
                            onValueChange={handleAccountChange}
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filter by Account" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Accounts
                                </SelectItem>
                                {Array.isArray(accounts) &&
                                    accounts.map((account) => (
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
                            onValueChange={handleCategoryChange}
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
                                {flatCategories.map((category: any) => (
                                    <SelectItem
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.displayName}
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
            <BalanceAdjustmentDialog
                open={showBalanceDialog}
                onClose={() => setShowBalanceDialog(false)}
                accounts={accounts}
                initialAccountId={selectedAccountId !== "all" ? selectedAccountId : undefined}
                onSuccess={() => fetchTransactions(true)}
            />
            <TransactionFormDialog
                open={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                accounts={accounts}
                categories={categories}
                initialAccountId={selectedAccountId !== "all" ? selectedAccountId : undefined}
                onSuccess={() => fetchTransactions(true)}
            />
        </div>
    );
};

export default TransactionsPage;
