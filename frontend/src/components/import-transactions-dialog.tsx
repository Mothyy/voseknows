import React, { useState, useEffect } from "react";
import { Account } from "@/pages/Accounts";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import apiClient from "@/lib/api";

interface ImportTransactionsDialogProps {
    onUploadSuccess?: () => void;
}

export function ImportTransactionsDialog({
    onUploadSuccess,
}: ImportTransactionsDialogProps) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [format, setFormat] = useState<string>("ofx");
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>("auto");
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            const fetchAccounts = async () => {
                try {
                    const response =
                        await apiClient.get<Account[]>("/accounts");
                    setAccounts(response.data);
                } catch (err) {
                    console.error("Failed to fetch accounts:", err);
                }
            };
            fetchAccounts();
        }
    }, [open]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setSuccessMessage(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError("Please select a file to upload.");
            return;
        }

        setUploading(true);
        setError(null);
        setSuccessMessage(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("format", format);
        if (selectedAccountId && selectedAccountId !== "auto") {
            formData.append("accountId", selectedAccountId);
        }

        try {
            const response = await apiClient.post("/imports", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            const result = response.data.data;
            const totalInserted = result.accounts.reduce(
                (acc: number, curr: any) => acc + curr.inserted,
                0,
            );
            const totalSkipped = result.accounts.reduce(
                (acc: number, curr: any) => acc + curr.skipped,
                0,
            );

            setSuccessMessage(
                `Successfully processed! Inserted: ${totalInserted}, Skipped (duplicates): ${totalSkipped}`,
            );
            setFile(null);

            if (onUploadSuccess) {
                onUploadSuccess();
            }
        } catch (err) {
            console.error("Upload failed", err);
            setError("Failed to upload file. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Transactions
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Import Transactions</DialogTitle>
                    <DialogDescription>
                        Upload a transaction file from your bank.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="account" className="text-right">
                            Account
                        </Label>
                        <Select
                            value={selectedAccountId}
                            onValueChange={setSelectedAccountId}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">
                                    Auto-detect from file
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
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="format" className="text-right">
                            Format
                        </Label>
                        <Select value={format} onValueChange={setFormat}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ofx">OFX / QFX</SelectItem>
                                <SelectItem value="qif">QIF</SelectItem>
                                <SelectItem value="csv" disabled>
                                    CSV (Coming Soon)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="file" className="text-right">
                            File
                        </Label>
                        <Input
                            id="file"
                            type="file"
                            accept={
                                format === "ofx"
                                    ? ".ofx,.qfx"
                                    : format === "qif"
                                      ? ".qif"
                                      : "*"
                            }
                            className="col-span-3"
                            onChange={handleFileChange}
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-500 text-center">
                            {error}
                        </p>
                    )}
                    {successMessage && (
                        <p className="text-sm text-green-600 text-center">
                            {successMessage}
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        type="submit"
                        onClick={handleUpload}
                        disabled={!file || uploading}
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            "Import"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
