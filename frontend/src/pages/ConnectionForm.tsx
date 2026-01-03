import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import apiClient from "@/lib/api";

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
import { Loader2 } from "lucide-react";

// Define the validation schema for the form
const formSchema = z.object({
    provider_slug: z.string({ required_error: "Please select a provider." }),
    institution_name: z.string().min(2, "Institution name is required."),
    api_key: z.string().optional(),
    customer_id: z.string().optional(),
});

type ConnectionFormValues = z.infer<typeof formSchema>;

// Define the shape of a Provider object
type Provider = {
    id: string;
    name: string;
    slug: string;
};

// Define the props for the component
interface ConnectionFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void; // Callback to refresh data
    initialData?: any | null; // Data for editing
}

const ConnectionForm: React.FC<ConnectionFormProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialData
}) => {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(false);

    const form = useForm<ConnectionFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            provider_slug: "",
            institution_name: "",
            api_key: "",
            customer_id: "",
        },
    });

    // Reset form when initialData changes or dialog opens
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                form.reset({
                    provider_slug: initialData.provider_slug,
                    institution_name: initialData.institution_name,
                    api_key: "", // Don't show existing API key for security
                    customer_id: initialData.customer_id || "",
                });
            } else {
                form.reset({
                    provider_slug: "",
                    institution_name: "",
                    api_key: "",
                    customer_id: "",
                });
            }
        }
    }, [isOpen, initialData, form]);

    // Fetch providers when the dialog is opened
    useEffect(() => {
        if (isOpen) {
            const fetchProviders = async () => {
                setLoadingProviders(true);
                try {
                    const response = await apiClient.get<Provider[]>("/data-providers");
                    setProviders(response.data);
                    // Set default provider if not already set and not editing
                    if (!initialData && response.data.length > 0 && !form.getValues("provider_slug")) {
                        form.setValue("provider_slug", response.data[0].slug);
                    }
                } catch (error) {
                    console.error("Failed to fetch providers:", error);
                } finally {
                    setLoadingProviders(false);
                }
            };
            fetchProviders();
        }
    }, [isOpen, initialData, form]);

    const onSubmit = async (values: ConnectionFormValues) => {
        try {
            if (initialData) {
                // Update existing
                await apiClient.put(`/data-providers/connections/${initialData.id}`, values);
            } else {
                // Create new
                await apiClient.post("/data-providers/connections", values);
            }
            onSuccess(); // Trigger data refresh
            onClose(); // Close the dialog
        } catch (error: any) {
            console.error("Failed to save connection:", error);
            const errorMessage = error.response?.data?.error || "An unknown error occurred.";
            form.setError("root", {
                type: "manual",
                message: `Failed to save connection: ${errorMessage}`,
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Edit Connection" : "Link New Account Provider"}</DialogTitle>
                    <DialogDescription>
                        {initialData
                            ? "Update your connection settings. Leave API Key blank to keep the current one."
                            : "Connect to a provider like SISS to automatically sync your accounts."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="provider_slug"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Data Provider</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        value={field.value}
                                        disabled={!!initialData || loadingProviders}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingProviders ? "Loading..." : "Select a provider"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {providers.map((provider) => (
                                                <SelectItem
                                                    key={provider.id}
                                                    value={provider.slug}
                                                >
                                                    {provider.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="institution_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Institution Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., My Bank"
                                            {...field}
                                            autoFocus={!initialData}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="api_key"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>API Key (x-api-key)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder={initialData ? "Leave blank to keep current" : "Enter your API key"}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="customer_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer ID</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Enter your Customer ID"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
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
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                    : initialData ? "Save Changes" : "Create Connection"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default ConnectionForm;
