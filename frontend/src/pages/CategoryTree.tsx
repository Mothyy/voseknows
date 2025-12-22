import React from "react";
import { Category } from "./Categories";
import { MoreHorizontal, PlusCircle, ChevronRight, Hash } from "lucide-react";
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

interface CategoryItemProps {
    category: Category;
    isEditMode: boolean;
    onEdit: (category: Category) => void;
    onDelete: (categoryId: string) => void;
    onAddSubCategory: (parentCategory: Category) => void;
    level?: number;
}

const CategoryItem: React.FC<CategoryItemProps> = ({
    category,
    isEditMode,
    onEdit,
    onDelete,
    onAddSubCategory,
    level = 0,
}) => {
    const hasChildren = category.children && category.children.length > 0;

    return (
        <Collapsible defaultOpen={true} className="w-full">
            <div
                className="group flex items-center justify-between min-h-[40px] py-1 px-4 hover:bg-accent/40 rounded-md transition-colors border-b border-border/40 last:border-0"
                style={{ paddingLeft: `${level * 1.5 + 1}rem` }}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {hasChildren ? (
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-accent flex-shrink-0"
                            >
                                <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-90 text-muted-foreground" />
                            </Button>
                        </CollapsibleTrigger>
                    ) : (
                        <Hash className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">
                        {category.name}
                    </span>
                </div>

                {isEditMode && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAddSubCategory(category)}
                            className="h-7 w-7 p-0"
                            title="Add sub-category"
                        >
                            <PlusCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-7 w-7 p-0">
                                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel className="text-xs">
                                    Category Actions
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                    onClick={() => onEdit(category)}
                                >
                                    Edit Details
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

            {hasChildren && (
                <CollapsibleContent className="w-full overflow-hidden">
                    <CategoryTree
                        categories={category.children}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onAddSubCategory={onAddSubCategory}
                        isEditMode={isEditMode}
                        level={level + 1}
                    />
                </CollapsibleContent>
            )}
        </Collapsible>
    );
};

interface CategoryTreeProps {
    categories: Category[];
    onEdit: (category: Category) => void;
    onDelete: (categoryId: string) => void;
    onAddSubCategory: (parentCategory: Category) => void;
    isEditMode: boolean;
    level?: number;
}

const CategoryTree: React.FC<CategoryTreeProps> = ({
    categories,
    onEdit,
    onDelete,
    onAddSubCategory,
    isEditMode,
    level = 0,
}) => {
    return (
        <div className="flex flex-col w-full">
            {categories.map((category) => (
                <CategoryItem
                    key={category.id}
                    category={category}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onAddSubCategory={onAddSubCategory}
                    isEditMode={isEditMode}
                    level={level}
                />
            ))}
        </div>
    );
};

export default CategoryTree;
