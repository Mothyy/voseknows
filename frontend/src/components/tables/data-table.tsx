"use client";

import * as React from "react";
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
    RowSelectionState,
    OnChangeFn,
    ExpandedState,
    getExpandedRowModel,
} from "@tanstack/react-table";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ChevronDown, Loader2 } from "lucide-react";
import apiClient from "@/lib/api";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    filterColumnId?: string;
    refreshData?: () => void;
    categories?: any[];
    accounts?: any[];
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: OnChangeFn<RowSelectionState>;
    onSearch?: (value: string) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoading?: boolean;
    totalCount?: number;
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    filterColumnId,
    refreshData,
    categories,
    accounts,
    rowSelection = {},
    onRowSelectionChange,
    onSearch,
    onLoadMore,
    hasMore,
    isLoading,
    totalCount,
    sorting: controlledSorting,
    onSortingChange: setControlledSorting,
    tableId = "data-table", // Default ID
    onTransactionsUpdated,
}: DataTableProps<TData, TValue> & { tableId?: string; onTransactionsUpdated?: (updated: any[]) => void }) {
    const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);

    // ... (rest of the code) ...

    // We need to keep the context lines correct, so I'll just target the function signature and the handleMarkAsTransfer function separately? 
    // No, I can do it in one go if I include enough context, but the file is large. 
    // I already requested lines 64-468.
    // Let's do two edits. One for props, one for handler. 
    // Wait, replace_file_content doesn't support multiple chunks properly if I don't use multi_replace.
    // I will use multi_replace_file_content.


    const sorting = controlledSorting !== undefined ? controlledSorting : internalSorting;
    const setSorting = setControlledSorting !== undefined ? setControlledSorting : setInternalSorting;
    const manualSorting = !!controlledSorting;

    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);

    // Load initial visibility from localStorage
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
        if (typeof window !== "undefined" && tableId) {
            const saved = localStorage.getItem(`voseknows-table-columns-${tableId}`);
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error("Failed to parse saved column visibility", e);
                }
            }
        }
        return {};
    });

    // Save visibility changes to localStorage
    React.useEffect(() => {
        if (tableId) {
            localStorage.setItem(
                `voseknows-table-columns-${tableId}`,
                JSON.stringify(columnVisibility)
            );
        }
    }, [columnVisibility, tableId]);

    const [expanded, setExpanded] = React.useState<ExpandedState>({});

    // Group data by transfer_id
    const groupedData = React.useMemo(() => {
        const groups: Record<string, TData[]> = {};
        const standalone: TData[] = [];
        const processedIds = new Set<string>();

        // First pass: identify groups
        // We assume TData might have transfer_id (as any)
        (data as any[]).forEach((item) => {
            if (item.transfer_id) {
                if (!groups[item.transfer_id]) {
                    groups[item.transfer_id] = [];
                }
                groups[item.transfer_id].push(item);
            } else {
                standalone.push(item);
            }
        });

        const result: TData[] = [...standalone];

        // Process groups -> create parent rows
        Object.keys(groups).forEach((transferId) => {
            const subRows = groups[transferId];
            if (subRows.length > 0) {
                // Create a synthetic parent row
                // We clone the first row to keep types consistent
                // But override specific fields
                const fromTxn = subRows.find((t: any) => Number(t.amount) < 0);
                const toTxn = subRows.find((t: any) => Number(t.amount) > 0);
                let groupDesc = "Transfer Group";
                if (
                    fromTxn &&
                    toTxn &&
                    (fromTxn as any).account &&
                    (toTxn as any).account
                ) {
                    groupDesc = `${(fromTxn as any).account} -> ${(toTxn as any).account
                        }`;
                }

                const first = subRows[0];
                const parentRow = {
                    ...first,
                    id: `group-${transferId}`,
                    description: groupDesc,
                    category: "Transfer",
                    is_transfer: true,
                    amount: 0, // Or sum?
                    subRows: subRows.map(r => ({ ...r, is_transfer: true })), // Ensure children marked as transfer
                };
                result.push(parentRow as unknown as TData);
            }
        });

        // We rely on table sorting to order them correctly mixed with standalone.
        // However, to fix "auto going to the bottom" when unsorted, we manually sort by date DESC default.
        result.sort((a: any, b: any) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
        });

        return result;
    }, [data]);

    // Auto-expand transfer groups
    React.useEffect(() => {
        setExpanded((prev) => {
            if (prev === true) return true;

            const nextExpanded: Record<string, boolean> = {};
            groupedData.forEach((row: any) => {
                if (row.id && String(row.id).startsWith("group-")) {
                    nextExpanded[row.id] = true;
                }
            });

            return { ...nextExpanded, ...prev };
        });
    }, [groupedData]);

    // Track last clicked row for shift-select (passed to columns via meta)
    const lastSelectedRowId = React.useRef<string | null>(null);

    const table = useReactTable({
        data: groupedData,
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            expanded,
        },
        enableRowSelection: true,
        onRowSelectionChange,
        onSortingChange: setSorting,
        onExpandedChange: setExpanded,
        manualSorting,
        getSubRows: (row) => (row as any).subRows,
        getExpandedRowModel: getExpandedRowModel(),

        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getRowId: (row) => (row as any).id,
        meta: {
            refreshData,
            categories,
            accounts,
            lastSelectedRowId,
        },
    });

    const handleMarkAsTransfer = async () => {
        const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
        if (selectedIds.length === 0) return;

        try {
            const response = await apiClient.post("/transactions/bulk-update", {
                transactionIds: selectedIds,
                is_transfer: true,
            });

            if (response.data.updated && onTransactionsUpdated) {
                onTransactionsUpdated(response.data.updated);
                onRowSelectionChange?.({});
            } else if (refreshData) {
                refreshData();
                onRowSelectionChange?.({});
            }
        } catch (error) {
            console.error("Failed to mark as transfer:", error);
            alert("Failed to mark transactions as transfer.");
        }
    };

    const handleRowClick = (row: any, event: React.MouseEvent) => {
        const currentId = row.id;

        // Toggle expansion if applicable and not clicking selection checkbox/actions?
        // Actually, just expanding on click is fine. Selection is handled via checkbox column.
        if (row.getCanExpand()) {
            row.toggleExpanded();
            return; // Don't handle selection logic if toggling group? or do both?
            // User might want to Select the Group.
            // Let's do both if needed, but standard table behavior usually separates select vs expand.
        }

        // Handle Shift Select
        if (event.shiftKey && table.options.meta?.lastSelectedRowId.current !== null) {
            const { rows } = table.getRowModel();
            const lastIndex = rows.findIndex(r => r.id === table.options.meta?.lastSelectedRowId.current);
            const currentIndex = rows.findIndex(r => r.id === currentId);

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);

                const newSelection = { ...rowSelection };
                // Select all in range
                for (let i = start; i <= end; i++) {
                    const rowId = rows[i].id;
                    newSelection[rowId] = true;
                }

                onRowSelectionChange?.(newSelection);

                // Clear text selection explicitly
                window.getSelection()?.removeAllRanges();
            }
        }

        // Always update anchor
        if (table.options.meta?.lastSelectedRowId) {
            table.options.meta.lastSelectedRowId.current = currentId;
        }
    };

    // Observer for infinite scroll
    const observerTarget = React.useRef<HTMLTableRowElement>(null);

    React.useEffect(() => {
        if (!hasMore || isLoading || !onLoadMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onLoadMore();
                }
            },
            { threshold: 0.1, rootMargin: "100px" },
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [hasMore, isLoading, onLoadMore]);

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center gap-4">
                {filterColumnId && (
                    <Input
                        placeholder={`Filter by ${filterColumnId}...`}
                        onChange={(event) => onSearch?.(event.target.value)}
                        className="max-w-sm"
                    />
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto">
                            Columns <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    className="capitalize"
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) =>
                                        column.toggleVisibility(!!value)
                                    }
                                >
                                    {column.id}
                                </DropdownMenuCheckboxItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="rounded-md border">
                <Table className="table-fixed">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                                        {!header.isPlaceholder &&
                                            flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {/* If we have data, show it */}
                        {/* If we have data, show it */}
                        {table.getRowModel().rows.map((row) => {
                            const isTransfer = (row.original as any).is_transfer;
                            return (
                                <ContextMenu key={row.id}>
                                    <ContextMenuTrigger asChild>
                                        <TableRow
                                            data-state={
                                                row.getIsSelected() &&
                                                "selected"
                                            }
                                            className={
                                                isTransfer
                                                    ? "opacity-50 italic cursor-pointer"
                                                    : "cursor-pointer"
                                            }
                                            onClick={(e) => handleRowClick(row, e)}
                                        >
                                            {row.getVisibleCells().map(
                                                (cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(
                                                            cell.column
                                                                .columnDef.cell,
                                                            cell.getContext(),
                                                        )}
                                                    </TableCell>
                                                ),
                                            )}
                                        </TableRow>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                        <ContextMenuItem
                                            onClick={handleMarkAsTransfer}
                                            disabled={
                                                Object.keys(rowSelection)
                                                    .length === 0
                                            }
                                        >
                                            Mark as Transfer
                                        </ContextMenuItem>
                                    </ContextMenuContent>
                                </ContextMenu>
                            );
                        })}

                        {/* Loading skeletons - shown when data is empty OR when loading more */}
                        {isLoading && (
                            <>
                                {Array.from({
                                    length: data.length === 0 ? 10 : 3,
                                }).map((_, i) => (
                                    <TableRow key={`skeleton-${i}`}>
                                        {columns.map((_, j) => (
                                            <TableCell key={`cell-${j}`}>
                                                <Skeleton className="h-6 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </>
                        )}

                        {/* End of results / Empty state */}
                        {!isLoading && data.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}

                        {/* The observer trigger - hidden but present */}
                        <TableRow ref={observerTarget} className="border-0">
                            <TableCell
                                colSpan={columns.length}
                                className="p-0 h-1 border-0"
                            />
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between px-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {Object.keys(rowSelection).length} of{" "}
                    {totalCount || data.length} row(s) selected
                </div>
                {isLoading && data.length > 0 && (
                    <div className="flex items-center text-sm text-muted-foreground animate-pulse">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Fetching more...
                    </div>
                )}
                <div className="text-sm text-muted-foreground">
                    Showing {data.length} {totalCount ? `of ${totalCount}` : ""}{" "}
                    results
                </div>
            </div>
        </div>
    );
}
