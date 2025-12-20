import React from "react";
import { Category } from "./Categories";
import {
    MoreHorizontal,
    PlusCircle,
    ChevronRight,
    GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

// A single draggable and droppable category item
const SortableCategoryItem: React.FC<{
    category: Category;
    isEditMode: boolean;
    onEdit: (category: Category) => void;
    onDelete: (categoryId: string) => void;
    onAddSubCategory: (parentCategory: Category) => void;
}> = ({ category, isEditMode, onEdit, onDelete, onAddSubCategory }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: category.id, disabled: !isEditMode });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const { setNodeRef: droppableRef, isOver } = useDroppable({
        id: category.id,
        disabled: !isEditMode,
    });

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={`rounded-lg ${
                isOver && isEditMode
                    ? "bg-primary/10 ring-2 ring-primary/50"
                    : ""
            }`}
        >
            <Collapsible defaultOpen={true} className="group">
                <div
                    ref={droppableRef}
                    className="flex items-center justify-between p-2"
                >
                    <div className="flex items-center">
                        {isEditMode && (
                            <div {...listeners} className="cursor-grab pr-2">
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                            </div>
                        )}
                        {category.children && category.children.length > 0 && (
                            <CollapsibleTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mr-2 h-6 w-6 p-0"
                                >
                                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                    <span className="sr-only">Toggle</span>
                                </Button>
                            </CollapsibleTrigger>
                        )}
                        <span className="font-medium">{category.name}</span>
                    </div>
                    {isEditMode && (
                        <div className="flex items-center space-x-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onAddSubCategory(category)}
                                title="Add Sub-category"
                                className="h-7 w-7 p-0"
                            >
                                <PlusCircle className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                    >
                                        <span className="sr-only">
                                            Open menu
                                        </span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>
                                        Actions
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                        onClick={() => onEdit(category)}
                                    >
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => onDelete(category.id)}
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>
                {category.children && category.children.length > 0 && (
                    <CollapsibleContent>
                        <div className="pl-6 pt-2 space-y-2">
                            <CategoryTree
                                categories={category.children}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onAddSubCategory={onAddSubCategory}
                                isEditMode={isEditMode}
                            />
                        </div>
                    </CollapsibleContent>
                )}
            </Collapsible>
        </div>
    );
};

interface CategoryTreeProps {
    categories: Category[];
    onEdit: (category: Category) => void;
    onDelete: (categoryId: string) => void;
    onAddSubCategory: (parentCategory: Category) => void;
    isEditMode: boolean;
}

const CategoryTree: React.FC<CategoryTreeProps> = ({
    categories,
    onEdit,
    onDelete,
    onAddSubCategory,
    isEditMode,
}) => {
    const categoryIds = categories.map((c) => c.id);

    return (
        <SortableContext
            items={categoryIds}
            strategy={verticalListSortingStrategy}
            disabled={!isEditMode}
        >
            <div className="space-y-2">
                {categories.map((category) => (
                    <SortableCategoryItem
                        key={category.id}
                        category={category}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onAddSubCategory={onAddSubCategory}
                        isEditMode={isEditMode}
                    />
                ))}
            </div>
        </SortableContext>
    );
};

export default CategoryTree;
