"use client";

import * as React from "react";
import { ColumnDef, Row, Table, Column } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, ArrowLeftRight } from "lucide-react";
import apiClient from "@/lib/api";
import type { Transaction } from "@/data/transactions";

import { CategorySelector } from "@/components/category-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";

// A new, self-contained component to handle the logic for the actions dropdown.
// It fetches its own category data and calls an update function passed via table meta.
const TransactionActions: React.FC<{
    row: Row<Transaction>;
    table: Table<Transaction>;
}> = ({ row, table }) => {
    const transaction = row.original;
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [showEditDialog, setShowEditDialog] = React.useState(false);

    // Use the data passed through the table's meta to avoid redundant API calls
    const meta = table.options.meta as any;
    const categories = meta?.categories || [];
    const accounts = meta?.accounts || [];
    const refreshData = meta?.refreshData;

    const handleSetCategory = async (categoryId: string | null) => {
        try {
            await apiClient.patch(`/transactions/${transaction.id}`, {
                category_id: categoryId,
            });
            // If the refresh function was passed, call it to update the table.
            if (refreshData) {
                refreshData();
            }
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Failed to update category:", error);
            // In a real app, you would show a toast notification here.
            alert("Failed to update category.");
        }
    };

    return (
        <>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                            Edit Transaction
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                Change Category
                            </DropdownMenuItem>
                        </DialogTrigger>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Assign Category</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <CategorySelector
                            categories={categories}
                            value={transaction.category_id || "uncategorized"}
                            onChange={(val) =>
                                handleSetCategory(
                                    val === "uncategorized" ? null : val,
                                )
                            }
                        />
                    </div>
                </DialogContent>
            </Dialog>
            <TransactionFormDialog
                open={showEditDialog}
                onClose={() => setShowEditDialog(false)}
                accounts={accounts}
                categories={categories}
                transaction={transaction}
                onSuccess={() => refreshData && refreshData()}
            />
        </>
    );
};

const cycleSort = (column: Column<Transaction, unknown>) => {
    const isSorted = column.getIsSorted();
    if (isSorted === "asc") {
        column.toggleSorting(true); // desc
    } else if (isSorted === "desc") {
        column.clearSorting(); // clear
    } else {
        column.toggleSorting(false); // asc
    }
};

export const columns: ColumnDef<Transaction>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) =>
                    table.toggleAllPageRowsSelected(!!value)
                }
                aria-label="Select all"
            />
        ),
        cell: ({ row, table }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
                onClick={(e) => {
                    const meta = table.options.meta as any;
                    if (!meta?.lastSelectedRowId) return;

                    const { lastSelectedRowId } = meta;
                    const switchRowId = row.id;

                    if (e.shiftKey && lastSelectedRowId.current !== null) {
                        const { rows } = table.getRowModel();
                        const lastIndex = rows.findIndex(r => r.id === lastSelectedRowId.current);
                        const currentIndex = rows.findIndex(r => r.id === switchRowId);

                        if (lastIndex !== -1 && currentIndex !== -1) {
                            const start = Math.min(lastIndex, currentIndex);
                            const end = Math.max(lastIndex, currentIndex);

                            const newSelection = { ...table.getState().rowSelection };
                            for (let i = start; i <= end; i++) {
                                const rowId = rows[i].id;
                                newSelection[rowId] = true;
                            }

                            // 1. Update selection via table handler
                            // Note: useReactTable handles onRowSelectionChange internally if state is controlled
                            // We need to call the updater if possible, or forcing state update may be tricky 
                            // if we don't have direct setRowSelection access exposed via meta.
                            // BUT, table.setRowSelection IS available on table instance!
                            table.setRowSelection(newSelection);

                            // 2. Prevent text selection
                            window.getSelection()?.removeAllRanges();
                        }
                    }

                    lastSelectedRowId.current = switchRowId;
                }}
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "date",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => cycleSort(column)}
                >
                    Date
                    {column.getIsSorted() === "asc" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                    ) : column.getIsSorted() === "desc" ? (
                        <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    )}
                </Button>
            );
        },
        cell: ({ row }) => (
            <div>{new Date(row.getValue("date")).toLocaleDateString()}</div>
        ),
    },
    {
        accessorKey: "description",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => cycleSort(column)}
            >
                Description
                {column.getIsSorted() === "asc" ? (
                    <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                    <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
            </Button>
        ),
        cell: ({ row }) => (
            <div style={{ paddingLeft: `${row.depth * 1.5}rem` }}>
                {row.getValue("description")}
            </div>
        ),
    },
    {
        accessorKey: "account",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => cycleSort(column)}
            >
                Account
                {column.getIsSorted() === "asc" ? (
                    <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                    <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
            </Button>
        ),
        cell: ({ row }) => {
            if (row.getCanExpand()) return null;
            return <div>{row.getValue("account")}</div>;
        },
    },
    {
        accessorKey: "amount",
        header: ({ column }) => (
            <div className="text-right">
                <Button
                    variant="ghost"
                    onClick={() => cycleSort(column)}
                >
                    Amount
                    {column.getIsSorted() === "asc" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                    ) : column.getIsSorted() === "desc" ? (
                        <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    )}
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            const val = row.getValue("amount");
            const amount =
                typeof val === "string" ? parseFloat(val) : Number(val);
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
            }).format(amount);

            return (
                <div
                    className={cn(
                        "text-right font-medium",
                        amount >= 0 ? "text-green-600" : "text-red-600",
                    )}
                >
                    {formatted}
                </div>
            );
        },
    },
    {
        id: "debit",
        accessorFn: (row) => row.amount,
        header: ({ column }) => (
            <div className="text-right">
                <Button
                    variant="ghost"
                    onClick={() => cycleSort(column)}
                    className="text-red-600 hover:text-red-700"
                >
                    Debit
                    {column.getIsSorted() === "asc" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                    ) : column.getIsSorted() === "desc" ? (
                        <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    )}
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            const val = row.getValue("debit");
            const amount = typeof val === "string" ? parseFloat(val) : Number(val);
            if (amount >= 0) return <div className="text-right text-muted-foreground">-</div>;

            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
            }).format(Math.abs(amount));

            return (
                <div className="text-right font-medium text-red-600">
                    {formatted}
                </div>
            );
        },
    },
    {
        id: "credit",
        accessorFn: (row) => row.amount,
        header: ({ column }) => (
            <div className="text-right">
                <Button
                    variant="ghost"
                    onClick={() => cycleSort(column)}
                    className="text-green-600 hover:text-green-700"
                >
                    Credit
                    {column.getIsSorted() === "asc" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                    ) : column.getIsSorted() === "desc" ? (
                        <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    )}
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            const val = row.getValue("credit");
            const amount = typeof val === "string" ? parseFloat(val) : Number(val);
            if (amount <= 0) return <div className="text-right text-muted-foreground">-</div>;

            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
            }).format(amount);

            return (
                <div className="text-right font-medium text-green-600">
                    {formatted}
                </div>
            );
        },
    },
    {
        accessorKey: "is_transfer",
        header: "Transfer",
        cell: ({ row }) => {
            return row.getValue("is_transfer") ? (
                <div className="flex justify-center">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                </div>
            ) : null;
        },
    },
    {
        accessorKey: "balance",
        header: () => <div className="text-right">Balance</div>,
        cell: ({ row }) => {
            if (row.getCanExpand()) return null;
            const val = row.getValue("balance");
            const balance =
                typeof val === "string" ? parseFloat(val) : Number(val);
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
            }).format(balance);

            return (
                <div
                    className={cn(
                        "text-right font-medium",
                        balance >= 0 ? "text-green-600" : "text-red-600",
                    )}
                >
                    {formatted}
                </div>
            );
        },
    },
    {
        accessorKey: "category",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => cycleSort(column)}
            >
                Category
                {column.getIsSorted() === "asc" ? (
                    <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                    <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
            </Button>
        ),
        cell: ({ row }) => {
            return <div>{row.getValue("category") || "Uncategorized"}</div>;
        },
    },
    {
        accessorKey: "status",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => cycleSort(column)}
            >
                Status
                {column.getIsSorted() === "asc" ? (
                    <ArrowUp className="ml-2 h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                    <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
            </Button>
        ),
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            return (
                <div className="flex items-center">
                    <span
                        className={cn(
                            "h-2 w-2 rounded-full mr-2",
                            status === "cleared" && "bg-green-500",
                            status === "pending" && "bg-yellow-500",
                            status === "failed" && "bg-red-500",
                        )}
                    />
                    <span className="capitalize">{status}</span>
                </div>
            );
        },
    },
    {
        id: "actions",
        cell: ({ row, table }) => (
            <TransactionActions row={row} table={table} />
        ),
    },
];
