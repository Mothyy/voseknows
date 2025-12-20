import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import apiClient from "@/lib/api";
import { Category } from "./Categories"; // Import the type from our page component

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

// Define the validation schema for the form
const formSchema = z.object({
    name: z.string().min(2, {
        message: "Category name must be at least 2 characters long.",
    }),
    parent_id: z.string().nullable().optional(),
});

type CategoryFormValues = z.infer<typeof formSchema>;

// Define the props for the component
interface CategoryFormProps {
    category?: Category | null; // The category to edit, if any
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void; // Callback to refresh the data on the parent page
}

const CategoryForm: React.FC<CategoryFormProps> = ({
    category,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const isEditMode = !!(category && category.id);
    const [allCategories, setAllCategories] = useState<Category[]>([]);

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            parent_id: null,
        },
    });

    // Fetch all categories for the parent dropdown when the dialog opens
    useEffect(() => {
        if (isOpen) {
            const fetchAllCategories = async () => {
                try {
                    const response =
                        await apiClient.get<Category[]>("/categories");
                    // The response is a tree, we need to flatten it for the dropdown
                    const flattenCategories = (
                        categories: Category[],
                        currentCategory: Category | null | undefined,
                    ): Category[] => {
                        let flatList: Category[] = [];
                        const traverse = (nodes: Category[], depth = 0) => {
                            for (const node of nodes) {
                                // Exclude the category being edited and its children from the list of potential parents
                                if (
                                    currentCategory &&
                                    currentCategory.id === node.id
                                )
                                    continue;

                                flatList.push({
                                    ...node,
                                    name: `${"— ".repeat(depth)}${node.name}`,
                                });
                                if (node.children) {
                                    traverse(node.children, depth + 1);
                                }
                            }
                        };
                        traverse(categories);
                        return flatList;
                    };
                    setAllCategories(
                        flattenCategories(response.data, category),
                    );
                } catch (err) {
                    console.error("Failed to fetch categories for form", err);
                }
            };
            fetchAllCategories();
        }
    }, [isOpen, category]);

    // useEffect to populate the form when in edit mode or reset when creating
    useEffect(() => {
        if (isOpen) {
            if (category) {
                // Covers both editing a category and adding a new sub-category
                form.reset({
                    name: category.id ? category.name : "", // Name is empty for a new sub-category
                    parent_id: category.parent_id || null,
                });
            } else {
                // Covers adding a new root category
                form.reset({ name: "", parent_id: null });
            }
        }
    }, [category, isOpen, form]);

    const onSubmit = async (values: CategoryFormValues) => {
        try {
            if (isEditMode && category) {
                // Update existing category
                await apiClient.patch(`/categories/${category.id}`, values);
            } else {
                // Create new category - values will include parent_id
                await apiClient.post("/categories", values);
            }
            onSuccess(); // Trigger data refresh
            onClose(); // Close the dialog
        } catch (error) {
            console.error("Failed to save category:", error);
            form.setError("root", {
                type: "manual",
                message: "Failed to save category. Please try again.",
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {isEditMode ? "Edit Category" : "Create New Category"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? "Make changes to your category here. Click save when you're done."
                            : "Add a new category to track your transactions."}
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
                                    <FormLabel>Category Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Groceries"
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
                            name="parent_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Parent Category</FormLabel>
                                    <Select
                                        onValueChange={(value) =>
                                            field.onChange(
                                                value === "_null"
                                                    ? null
                                                    : value,
                                            )
                                        }
                                        value={field.value || "_null"}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a parent (optional)" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="_null">
                                                <em>None (root category)</em>
                                            </SelectItem>
                                            {allCategories.map((cat) => (
                                                <SelectItem
                                                    key={cat.id}
                                                    value={cat.id}
                                                >
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                    ? "Saving..."
                                    : "Save"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default CategoryForm;
