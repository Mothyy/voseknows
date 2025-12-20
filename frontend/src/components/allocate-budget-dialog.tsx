import { useState, useEffect } from "react";
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
    const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
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
            setBudgets(response.data);
        } catch (error) {
            console.error("Failed to fetch budgets:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAmountChange = (index: number, value: string) => {
        const newBudgets = [...budgets];
        newBudgets[index] = {
            ...newBudgets[index],
            budget_amount: parseFloat(value) || 0,
        };
        setBudgets(newBudgets);
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
                    amount: b.actual,
                }));
            }

            setBudgets((current) =>
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

            // Save for current month and any future months
            for (let i = 0; i <= futureMonths; i++) {
                const targetDate = new Date(month);
                targetDate.setMonth(targetDate.getMonth() + i);
                const targetMonthStr = `${targetDate.getFullYear()}-${String(
                    targetDate.getMonth() + 1,
                ).padStart(2, "0")}-01`;

                budgets.forEach((budget) => {
                    promises.push(
                        apiClient.post("/budgets", {
                            category_id: budget.category_id,
                            month: targetMonthStr,
                            amount: budget.budget_amount,
                        }),
                    );
                });
            }

            await Promise.all(promises);
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to save budgets:", error);
            alert("Failed to save some budgets. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Allocate Budgets</DialogTitle>
                    <DialogDescription>
                        Set budget targets for{" "}
                        {month.toLocaleDateString("default", {
                            month: "long",
                            year: "numeric",
                        })}
                        .
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-2 py-2">
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

                <div className="flex-1 overflow-hidden min-h-0 py-4 border rounded-md">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Category</TableHead>
                                        <TableHead className="w-[150px] text-right">
                                            Budget
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {budgets.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={2}
                                                className="text-center text-muted-foreground"
                                            >
                                                No categories found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        budgets.map((budget, index) => (
                                            <TableRow key={budget.category_id}>
                                                <TableCell className="font-medium">
                                                    {budget.category_name}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={
                                                            budget.budget_amount ||
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            handleAmountChange(
                                                                index,
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="0.00"
                                                        className="text-right h-8"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                    <div className="flex items-center gap-2">
                        <Label
                            htmlFor="future-months"
                            className="text-sm text-muted-foreground whitespace-nowrap"
                        >
                            Also apply to next
                        </Label>
                        <Input
                            id="future-months"
                            type="number"
                            min="0"
                            max="12"
                            className="w-16 h-8"
                            value={futureMonths}
                            onChange={(e) =>
                                setFutureMonths(parseInt(e.target.value) || 0)
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
            </DialogContent>
        </Dialog>
    );
}
