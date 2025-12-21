import { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, Copy, History } from "lucide-react";
import apiClient from "@/lib/api";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface BudgetCategory {
    category_id: string;
    category_name: string;
    parent_id: string | null;
    budget_amount: number;
}

interface AllocateBudgetDialogProps {
    isOpen: boolean;
    onClose: () => void;
    month: Date;
    onSuccess: () => void;
}

export function AllocateBudgetDialog({
    isOpen,
    onClose,
    month,
    onSuccess,
}: AllocateBudgetDialogProps) {
    const [rawBudgets, setRawBudgets] = useState<BudgetCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [futureMonths, setFutureMonths] = useState(0);

    // Format date as YYYY-MM-DD (first day of month)
    const formattedMonth = `${month.getFullYear()}-${String(
        month.getMonth() + 1,
    ).padStart(2, "0")}-01`;

    useEffect(() => {
        if (isOpen) {
            fetchBudgets();
        }
    }, [isOpen, formattedMonth]);

    const fetchBudgets = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get<BudgetCategory[]>(
                `/budgets?month=${formattedMonth}`,
            );
            setRawBudgets(response.data);
        } catch (error) {
            console.error("Failed to fetch budgets:", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Process the flat list into a display-friendly ordered list with depth and parent status.
     * Also calculates auto-summed values for parents.
     */
    const tableData = useMemo(() => {
        const parentIds = new Set(
            rawBudgets.map((b) => b.parent_id).filter(Boolean),
        );

        const getSum = (parentId: string): number => {
            const children = rawBudgets.filter((b) => b.parent_id === parentId);
            return children.reduce((acc, child) => {
                if (parentIds.has(child.category_id)) {
                    return acc + getSum(child.category_id);
                }
                return acc + Number(child.budget_amount || 0);
            }, 0);
        };

        const result: (BudgetCategory & {
            depth: number;
            isParent: boolean;
            displayValue: number;
        })[] = [];

        const addToResult = (parentId: string | null, depth: number) => {
            const level = rawBudgets
                .filter((b) => b.parent_id === parentId)
                .sort((a, b) => a.category_name.localeCompare(b.category_name));

            level.forEach((cat) => {
                const isParent = parentIds.has(cat.category_id);
                result.push({
                    ...cat,
                    depth,
                    isParent,
                    displayValue: isParent
                        ? getSum(cat.category_id)
                        : Number(cat.budget_amount || 0),
                });
                if (isParent) {
                    addToResult(cat.category_id, depth + 1);
                }
            });
        };

        addToResult(null, 0);
        return result;
    }, [rawBudgets]);

    const handleAmountChange = (categoryId: string, value: string) => {
        const amount = parseFloat(value) || 0;
        setRawBudgets((prev) =>
            prev.map((b) =>
                b.category_id === categoryId
                    ? { ...b, budget_amount: amount }
                    : b,
            ),
        );
    };

    const handleCopyPrior = async (source: "budget" | "actual") => {
        const priorMonth = new Date(month);
        priorMonth.setMonth(priorMonth.getMonth() - 1);
        const formattedPrior = `${priorMonth.getFullYear()}-${String(
            priorMonth.getMonth() + 1,
        ).padStart(2, "0")}-01`;

        try {
            setLoading(true);
            let newData: any[] = [];
            if (source === "budget") {
                const response = await apiClient.get<BudgetCategory[]>(
                    `/budgets?month=${formattedPrior}`,
                );
                newData = response.data.map((b) => ({
                    category_id: b.category_id,
                    amount: b.budget_amount,
                }));
            } else {
                const response = await apiClient.get<any[]>(
                    `/budgets/report?month=${formattedPrior}`,
                );
                newData = response.data.map((b: any) => ({
                    category_id: b.category_id,
                    amount: Math.abs(b.actual || 0),
                }));
            }

            setRawBudgets((current) =>
                current.map((cat) => {
                    const match = newData.find(
                        (d) => d.category_id === cat.category_id,
                    );
                    return match
                        ? { ...cat, budget_amount: match.amount }
                        : cat;
                }),
            );
        } catch (error) {
            console.error("Failed to copy prior data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const promises: Promise<any>[] = [];
            const parentIds = new Set(
                rawBudgets.map((b) => b.parent_id).filter(Boolean),
            );

            for (let i = 0; i <= futureMonths; i++) {
                const targetDate = new Date(month);
                targetDate.setMonth(targetDate.getMonth() + i);
                const targetMonthStr = `${targetDate.getFullYear()}-${String(
                    targetDate.getMonth() + 1,
                ).padStart(2, "0")}-01`;

                rawBudgets.forEach((budget) => {
                    if (!parentIds.has(budget.category_id)) {
                        promises.push(
                            apiClient.post("/budgets", {
                                category_id: budget.category_id,
                                month: targetMonthStr,
                                amount: budget.budget_amount,
                            }),
                        );
                    }
                });
            }

            await Promise.all(promises);
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to save budgets:", error);
            alert("Failed to save budgets.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[650px] h-[85vh] flex flex-col p-0 overflow-hidden">
                <div className="p-6 pb-0">
                    <DialogHeader>
                        <DialogTitle>Allocate Budgets</DialogTitle>
                        <DialogDescription>
                            Set targets for{" "}
                            {month.toLocaleDateString("default", {
                                month: "long",
                                year: "numeric",
                            })}
                            . Parents auto-sum their children.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex gap-2 py-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyPrior("budget")}
                            disabled={loading}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Prior Budget
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyPrior("actual")}
                            disabled={loading}
                        >
                            <History className="mr-2 h-4 w-4" />
                            Copy Prior Actuals
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden px-6 pb-4">
                    <div className="h-full border rounded-md overflow-hidden bg-background">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <ScrollArea className="h-full">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="w-[150px] text-right">
                                                Budget
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tableData.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={2}
                                                    className="text-center text-muted-foreground py-10"
                                                >
                                                    No categories found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            tableData.map((budget) => (
                                                <TableRow
                                                    key={budget.category_id}
                                                    className={cn(
                                                        budget.isParent &&
                                                            "bg-muted/30 font-semibold",
                                                    )}
                                                >
                                                    <TableCell
                                                        style={{
                                                            paddingLeft: `${budget.depth * 1.5 + 0.75}rem`,
                                                        }}
                                                        className="py-2"
                                                    >
                                                        {budget.category_name}
                                                    </TableCell>
                                                    <TableCell className="py-1">
                                                        <div className="flex justify-end items-center">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={
                                                                    budget.displayValue ===
                                                                    0
                                                                        ? ""
                                                                        : budget.displayValue.toFixed(
                                                                              2,
                                                                          )
                                                                }
                                                                onChange={(e) =>
                                                                    handleAmountChange(
                                                                        budget.category_id,
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                disabled={
                                                                    budget.isParent
                                                                }
                                                                placeholder="0.00"
                                                                className={cn(
                                                                    "text-right h-8 w-28",
                                                                    budget.isParent &&
                                                                        "bg-transparent border-transparent shadow-none font-bold text-foreground opacity-100",
                                                                )}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        )}
                    </div>
                </div>

                <div className="p-6 pt-0">
                    <DialogFooter className="flex flex-row items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="future-months"
                                className="text-sm text-muted-foreground whitespace-nowrap"
                            >
                                Repeat for next
                            </Label>
                            <Input
                                id="future-months"
                                type="number"
                                min="0"
                                max="12"
                                className="w-16 h-8"
                                value={futureMonths}
                                onChange={(e) =>
                                    setFutureMonths(
                                        parseInt(e.target.value) || 0,
                                    )
                                }
                            />
                            <span className="text-sm text-muted-foreground">
                                months
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={loading || saving}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
