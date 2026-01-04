import React, { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2 } from "lucide-react";

interface AccountSimple {
    id: string;
    name: string;
}

interface BalanceAdjustmentDialogProps {
    open: boolean;
    onClose: () => void;
    accounts: AccountSimple[];
    initialAccountId?: string;
    onSuccess: () => void;
}

export const BalanceAdjustmentDialog: React.FC<BalanceAdjustmentDialogProps> = ({
    open,
    onClose,
    accounts,
    initialAccountId,
    onSuccess
}) => {
    const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId || "");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [targetBalance, setTargetBalance] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ oldBalance: number, newBalance: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setSelectedAccountId(initialAccountId || "");
            setDate(new Date().toISOString().split('T')[0]);
            setTargetBalance("");
            setResult(null);
            setError(null);
        }
    }, [open, initialAccountId]);

    const handleSubmit = async () => {
        if (!selectedAccountId || !date || !targetBalance) return;
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.post(`/accounts/${selectedAccountId}/balance-adjustment`, {
                date,
                targetBalance: parseFloat(targetBalance)
            });
            setResult(res.data);
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to adjust balance");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reconcile Balance</DialogTitle>
                    <DialogDescription>
                        Create an adjustment transaction to match your bank statement.
                    </DialogDescription>
                </DialogHeader>

                {!result ? (
                    <div className="space-y-4 py-4">
                        {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

                        <div className="space-y-2">
                            <Label>Account</Label>
                            <select
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                value={selectedAccountId}
                                onChange={e => setSelectedAccountId(e.target.value)}
                                disabled={!!initialAccountId && initialAccountId !== 'all'}
                            >
                                <option value="">Select Account</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Target Balance</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={targetBalance}
                                    onChange={e => setTargetBalance(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-6 text-center space-y-2">
                        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <h4 className="font-semibold text-lg">Success</h4>
                        <p className="text-muted-foreground text-sm">
                            Balance updated from <strong>${result.oldBalance.toFixed(2)}</strong> to <strong>${result.newBalance.toFixed(2)}</strong>.
                        </p>
                    </div>
                )}

                <DialogFooter>
                    {result ? (
                        <Button onClick={handleClose}>Close</Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading || !selectedAccountId || !targetBalance}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Adjust Balance
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
