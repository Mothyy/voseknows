import React, { useState, useEffect } from "react";
import { PlusCircle, Edit } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDroppable,
} from "@dnd-kit/core";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CategoryForm from "./CategoryForm"; // Import the new form component
import CategoryTree from "./CategoryTree";

// Define the shape of a Category object based on our API
export type Category = {
    id: string;
    name: string;
    parent_id: string | null;
    children: Category[];
};

const CategoriesPage: React.FC = () => {
    // State for categories, loading, and errors
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // State for managing the form dialog
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(
        null,
    );
    const [isEditMode, setIsEditMode] = useState(false);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor),
    );
    const { setNodeRef: rootDroppableRef, isOver: isOverRoot } = useDroppable({
        id: "root-droppable-area",
        disabled: !isEditMode,
    });

    // Function to fetch categories from the backend
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

    // Fetch data when the component mounts
    useEffect(() => {
        fetchCategories();
    }, []);

    const handleAddNew = () => {
        setSelectedCategory(null); // Ensure we're in "create" mode
        setIsFormOpen(true);
    };

    const handleEdit = (category: Category) => {
        setSelectedCategory(category); // Set the category to edit
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
        if (window.confirm("Are you sure you want to delete this category?")) {
            try {
                await apiClient.delete(`/categories/${categoryId}`);
                fetchCategories(); // Refresh the list after deletion
            } catch (err) {
                console.error("Failed to delete category:", err);
                setError("Failed to delete category. It might be in use.");
            }
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || !isEditMode) {
            return;
        }

        const activeId = active.id.toString();
        const newParentId =
            over.id === "root-droppable-area" ? null : over.id.toString();

        if (active.id === newParentId) {
            return; // Can't drop on itself
        }

        // Find the original parent to prevent unnecessary updates
        const findCategory = (
            nodes: Category[],
            id: string,
        ): Category | null => {
            for (const node of nodes) {
                if (node.id === id) return node;
                const found = findCategory(node.children, id);
                if (found) return found;
            }
            return null;
        };
        const draggedCategory = findCategory(categories, activeId);

        // Prevent dropping a category into one of its own descendants
        const isDescendant = (node: Category, id: string): boolean => {
            if (node.id === id) return true;
            if (!node.children) return false;
            return node.children.some((child) => isDescendant(child, id));
        };

        if (newParentId !== null && draggedCategory) {
            if (isDescendant(draggedCategory, newParentId)) {
                console.error(
                    "Cannot move a category into its own descendant.",
                );
                // Optionally, show a user-facing error message here
                return;
            }
        }

        if (draggedCategory?.parent_id === newParentId) {
            return; // Parent hasn't changed
        }
        const originalCategories = categories;

        // Helper to find and update the category in the tree
        const updateTree = (
            nodes: Category[],
            id: string,
            newParentId: string | null,
        ): { newTree: Category[]; movedCategory: Category | null } => {
            let movedCategory: Category | null = null;

            // First, find and remove the category from its old place
            const findAndRemove = (
                items: Category[],
                itemId: string,
            ): Category[] => {
                const newItems = [];
                for (const item of items) {
                    if (item.id === itemId) {
                        movedCategory = { ...item };
                    } else {
                        const newChildren = findAndRemove(
                            item.children,
                            itemId,
                        );
                        newItems.push({ ...item, children: newChildren });
                    }
                }
                return newItems;
            };
            let treeWithoutCategory = findAndRemove(nodes, id);

            if (!movedCategory) return { newTree: nodes, movedCategory: null };

            (movedCategory as Category).parent_id = newParentId;

            // Now, add the category to its new parent
            const findAndAdd = (
                items: Category[],
                itemToAdd: Category,
                parentId: string | null,
            ): Category[] => {
                if (parentId === null) {
                    return [...items, itemToAdd];
                }
                return items.map((item) => {
                    if (item.id === parentId) {
                        return {
                            ...item,
                            children: [...item.children, itemToAdd],
                        };
                    }
                    return {
                        ...item,
                        children: findAndAdd(
                            item.children,
                            itemToAdd,
                            parentId,
                        ),
                    };
                });
            };

            const newTree = findAndAdd(
                treeWithoutCategory,
                movedCategory,
                newParentId,
            );
            return { newTree, movedCategory };
        };

        const { newTree } = updateTree(categories, activeId, newParentId);
        setCategories(newTree);

        try {
            // We only support reparenting for now, not reordering
            await apiClient.patch(`/categories/${activeId}`, {
                parent_id: newParentId,
            });
            // Refetch to get correct sort orders and confirm state
            fetchCategories();
        } catch (err) {
            console.error("Failed to update category parent:", err);
            setCategories(originalCategories); // Revert on error
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center p-2">
                            <Skeleton className="mr-2 h-6 w-6 rounded-md" />
                            <Skeleton className="h-4 w-[200px]" />
                        </div>
                    ))}
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex items-center justify-center py-10">
                    <p className="text-red-500">{error}</p>
                </div>
            );
        }
        return (
            <CategoryTree
                categories={categories}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddSubCategory={handleAddSubCategory}
                isEditMode={isEditMode}
            />
        );
    };

    return (
        <>
            <div className="container mx-auto py-10 px-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Categories
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Create and manage your transaction categories.
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant={isEditMode ? "default" : "outline"}
                            onClick={() => setIsEditMode(!isEditMode)}
                        >
                            <Edit className="mr-2 h-4 w-4" />
                            {isEditMode ? "Done" : "Edit"}
                        </Button>
                        {isEditMode && (
                            <Button onClick={handleAddNew}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add New Category
                            </Button>
                        )}
                    </div>
                </div>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <div
                        ref={rootDroppableRef}
                        className={`min-h-[100px] rounded-lg border-2 border-dashed p-4 transition-colors ${
                            isEditMode
                                ? isOverRoot
                                    ? "border-primary bg-primary/10"
                                    : "border-muted-foreground/30"
                                : "border-transparent"
                        }`}
                    >
                        {renderContent()}
                    </div>
                </DndContext>
            </div>
            <CategoryForm
                category={selectedCategory}
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={fetchCategories}
            />
        </>
    );
};

export default CategoriesPage;
