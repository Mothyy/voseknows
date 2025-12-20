import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import apiClient from "@/lib/api";
import { Account } from "./Accounts"; // Import the type from the Accounts page

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormDescription,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// Define the validation schema for the form
const formSchema = z.object({
    name: z.string().min(2, {
        message: "Account name must be at least 2 characters.",
    }),
    type: z.enum(["checking", "savings", "credit"], {
        required_error: "Please select an account type.",
    }),
    balance: z.coerce.number().default(0),
    include_in_budget: z.boolean().default(true),
});

type AccountFormValues = z.infer<typeof formSchema>;

// Define the props for the component
interface AccountFormProps {
    account?: Account | null; // The account to edit, if any
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void; // Callback to refresh the data on the parent page
}

const AccountForm: React.FC<AccountFormProps> = ({
    account,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const isEditMode = !!account;

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            type: undefined,
            balance: 0,
            include_in_budget: true,
        },
    });

    // useEffect to populate the form when in edit mode or reset when creating
    useEffect(() => {
        if (isEditMode && account) {
            form.reset({
                name: account.name,
                type: account.type as "checking" | "savings" | "credit",
                balance: account.starting_balance,
                include_in_budget: account.include_in_budget,
            });
        } else {
            form.reset({
                name: "",
                type: undefined,
                balance: 0,
                include_in_budget: true,
            });
        }
    }, [account, isEditMode, form, isOpen]);

    const onSubmit = async (values: AccountFormValues) => {
        try {
            if (isEditMode && account) {
                await apiClient.patch(`/accounts/${account.id}`, values);
            } else {
                // Create new account
                await apiClient.post("/accounts", values);
            }
            onSuccess(); // Trigger data refresh
            onClose(); // Close the dialog
        } catch (error) {
            console.error("Failed to save account:", error);
            form.setError("root", {
                type: "manual",
                message: "Failed to save account. Please try again.",
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {isEditMode ? "Edit Account" : "Create New Account"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? "Make changes to your account here. Click save when you're done."
                            : "Add a new financial account to track transactions."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Account Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Main Checking"
                                            {...field}
                                            autoFocus
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Account Type</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select an account type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="checking">
                                                Checking
                                            </SelectItem>
                                            <SelectItem value="savings">
                                                Savings
                                            </SelectItem>
                                            <SelectItem value="credit">
                                                Credit
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="balance"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Starting Balance</FormLabel>
                                    <FormDescription>
                                        The balance before any imported
                                        transactions.
                                    </FormDescription>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="include_in_budget"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Include in Budget</FormLabel>
                                        <FormDescription>
                                            Include this account's transactions
                                            in your main budget.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        {form.formState.errors.root && (
                            <p className="text-sm font-medium text-destructive">
                                {form.formState.errors.root.message}
                            </p>
                        )}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting
                                    ? "Saving..."
                                    : "Save Account"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default AccountForm;
