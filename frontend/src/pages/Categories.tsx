import React, { useState, useEffect } from "react";
import { PlusCircle, Edit, ListTree } from "lucide-react";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CategoryForm from "./CategoryForm";
import CategoryTree from "./CategoryTree";

export type Category = {
    id: string;
    name: string;
    parent_id: string | null;
    children: Category[];
};

const CategoriesPage: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(
        null,
    );
    const [isEditMode, setIsEditMode] = useState(false);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get<Category[]>("/categories");
            setCategories(response.data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch categories:", err);
            setError("Failed to load categories. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleAddNew = () => {
        setSelectedCategory(null);
        setIsFormOpen(true);
    };

    const handleEdit = (category: Category) => {
        setSelectedCategory(category);
        setIsFormOpen(true);
    };

    const handleAddSubCategory = (parentCategory: Category) => {
        setSelectedCategory({
            id: "",
            name: "",
            parent_id: parentCategory.id,
            children: [],
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (categoryId: string) => {
        if (
            window.confirm(
                "Are you sure you want to delete this category? This will affect any transactions assigned to it.",
            )
        ) {
            try {
                await apiClient.delete(`/categories/${categoryId}`);
                fetchCategories();
            } catch (err) {
                console.error("Failed to delete category:", err);
                setError("Failed to delete category. It might be in use.");
            }
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Categories
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your spending categories and hierarchy.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={isEditMode ? "default" : "outline"}
                        onClick={() => setIsEditMode(!isEditMode)}
                        className="min-w-[140px]"
                    >
                        <Edit className="mr-2 h-4 w-4" />
                        {isEditMode ? "Exit Edit Mode" : "Manage List"}
                    </Button>
                    <Button onClick={handleAddNew}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Root Category
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 rounded-lg border border-destructive/20 text-center">
                    <p className="text-destructive font-medium mb-4">{error}</p>
                    <Button variant="outline" onClick={fetchCategories}>
                        Try Again
                    </Button>
                </div>
            ) : categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-lg text-center bg-muted/30">
                    <ListTree className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-medium">No categories found</h3>
                    <p className="text-muted-foreground mb-6">
                        Create a hierarchy to better track your spending.
                    </p>
                    <Button onClick={handleAddNew}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create First Category
                    </Button>
                </div>
            ) : (
                <div className="bg-card rounded-lg border shadow-sm overflow-hidden p-2">
                    <CategoryTree
                        categories={categories}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onAddSubCategory={handleAddSubCategory}
                        isEditMode={isEditMode}
                    />
                </div>
            )}

            <CategoryForm
                category={selectedCategory}
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={fetchCategories}
            />
        </div>
    );
};

export default CategoriesPage;
