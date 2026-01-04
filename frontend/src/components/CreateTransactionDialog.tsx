import React, { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { CategorySelector } from "@/components/category-selector";
import { Account } from "@/pages/Accounts";
import { Category } from "@/pages/Categories";

interface CreateTransactionDialogProps {
    open: boolean;
    onClose: () => void;
    accounts: Account[];
    categories: Category[];
    initialAccountId?: string;
    onSuccess: () => void;
}

export const CreateTransactionDialog: React.FC<CreateTransactionDialogProps> = ({
    open,
    onClose,
    accounts,
    categories,
    initialAccountId,
    onSuccess,
}) => {
    const [accountId, setAccountId] = useState(initialAccountId || "");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [categoryId, setCategoryId] = useState<string>("uncategorized");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setAccountId(initialAccountId !== "all" ? initialAccountId || "" : "");
            setDate(new Date().toISOString().split("T")[0]);
            setDescription("");
            setAmount("");
            setCategoryId("uncategorized");
            setError(null);
        }
    }, [open, initialAccountId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await apiClient.post("/transactions", {
                account_id: accountId,
                date,
                description,
                amount: parseFloat(amount),
                category_id: categoryId === "uncategorized" ? null : categoryId,
                status: "pending",
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Failed to create transaction:", err);
            setError(err.response?.data?.error || "Failed to create transaction");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Transaction</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    {error && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="account">Account</Label>
                        <select
                            id="account"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            required
                        >
                            <option value="" disabled>Select an account</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Grocery Store"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="-50.00"
                            required
                        />
                        <p className="text-xs text-muted-foreground">Negative for expense, positive for income.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <CategorySelector
                            categories={categories}
                            value={categoryId}
                            onChange={setCategoryId}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Transaction
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
