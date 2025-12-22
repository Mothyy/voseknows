"use client";

import * as React from "react";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import apiClient from "@/lib/api";
import type { Transaction } from "@/data/transactions";
import type { Category } from "@/pages/Categories";

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

// A new, self-contained component to handle the logic for the actions dropdown.
// It fetches its own category data and calls an update function passed via table meta.
const TransactionActions: React.FC<{
    row: Row<Transaction>;
    table: Table<Transaction>;
}> = ({ row, table }) => {
    const transaction = row.original;
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    // Use the data passed through the table's meta to avoid redundant API calls
    const meta = table.options.meta as any;
    const categories = meta?.categories || [];
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
                    <DropdownMenuItem
                        onClick={() =>
                            navigator.clipboard.writeText(transaction.id)
                        }
                    >
                        Copy transaction ID
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
    );
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
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
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
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === "asc")
                    }
                >
                    Date
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => (
            <div>{new Date(row.getValue("date")).toLocaleDateString()}</div>
        ),
    },
    {
        accessorKey: "description",
        header: "Description",
    },
    {
        accessorKey: "account",
        header: "Account",
    },
    {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
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
        accessorKey: "balance",
        header: () => <div className="text-right">Balance</div>,
        cell: ({ row }) => {
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
        header: "Category",
        cell: ({ row }) => {
            return <div>{row.getValue("category") || "Uncategorized"}</div>;
        },
    },
    {
        accessorKey: "status",
        header: "Status",
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
