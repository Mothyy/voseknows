import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as icons from "lucide-react";
import navConfig from "@/nav.json";

// Define the types for our navigation configuration
type NavItemChild = {
    title: string;
    path: string;
    icon: keyof typeof icons;
};

type NavItem = {
    title: string;
    path?: string;
    icon: keyof typeof icons;
    children?: NavItemChild[];
};

// Helper to get the Lucide icon component from its string name
const getIcon = (name: keyof typeof icons) => {
    const Icon = icons[name] as React.ElementType;
    return Icon ? <Icon className="h-5 w-5 shrink-0" /> : null;
};

export const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    // Determine which accordion item should be open by default
    const getDefaultAccordionValue = () => {
        for (const item of navConfig) {
            if (item.children) {
                for (const child of item.children) {
                    if (location.pathname.startsWith(child.path)) {
                        return item.title;
                    }
                }
            }
        }
        return ""; // Return an empty string if no match is found
    };

    return (
        <div
            className={cn(
                "relative flex h-screen flex-col border-r bg-background transition-all duration-300 ease-in-out",
                isCollapsed ? "w-16" : "w-64",
            )}
        >
            {/* Sidebar Header */}
            <div className="flex h-16 items-center border-b px-4">
                <div
                    className={cn(
                        "flex items-center gap-2 overflow-hidden transition-all duration-300",
                        isCollapsed ? "w-8 justify-center" : "w-auto",
                    )}
                >
                    <icons.HandCoins className="h-8 w-8 shrink-0 text-primary" />
                    <h1
                        className={cn(
                            "whitespace-nowrap text-lg font-bold transition-opacity duration-300",
                            isCollapsed ? "opacity-0 w-0" : "opacity-100",
                        )}
                    >
                        VoseKnows
                    </h1>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-grow overflow-y-auto overflow-x-hidden px-3 py-4">
                <Accordion
                    type="single"
                    collapsible
                    defaultValue={getDefaultAccordionValue()}
                    className="w-full"
                >
                    {(navConfig as NavItem[]).map((item) =>
                        item.children ? (
                            <AccordionItem
                                key={item.title}
                                value={item.title}
                                className="border-b-0"
                            >
                                <AccordionTrigger
                                    className={cn(
                                        "flex w-full items-center rounded-md py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:no-underline transition-all duration-300",
                                        isCollapsed
                                            ? "justify-center px-0 [&>svg]:hidden"
                                            : "justify-between px-3",
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "flex items-center",
                                            !isCollapsed && "gap-3",
                                        )}
                                    >
                                        {getIcon(item.icon)}
                                        {!isCollapsed && (
                                            <span className="truncate">
                                                {item.title}
                                            </span>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pl-4">
                                    {item.children.map((child) => (
                                        <NavLink
                                            key={child.path}
                                            to={child.path}
                                            className={({ isActive }) =>
                                                cn(
                                                    "mt-1 flex items-center rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                                    isActive &&
                                                        "bg-accent text-accent-foreground",
                                                    isCollapsed
                                                        ? "justify-center px-0"
                                                        : "gap-3 px-3",
                                                )
                                            }
                                        >
                                            {getIcon(child.icon)}
                                            {!isCollapsed && (
                                                <span className="truncate">
                                                    {child.title}
                                                </span>
                                            )}
                                        </NavLink>
                                    ))}
                                </AccordionContent>
                            </AccordionItem>
                        ) : (
                            <NavLink
                                key={item.path}
                                to={item.path!}
                                className={({ isActive }) =>
                                    cn(
                                        "mt-1 flex items-center rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                                        isActive &&
                                            "bg-accent text-accent-foreground",
                                        isCollapsed
                                            ? "justify-center px-0"
                                            : "gap-3 px-3",
                                    )
                                }
                            >
                                {getIcon(item.icon)}
                                {!isCollapsed && (
                                    <span className="truncate">
                                        {item.title}
                                    </span>
                                )}
                            </NavLink>
                        ),
                    )}
                </Accordion>
            </nav>

            {/* Collapse Toggle Button */}
            <div className="mt-auto border-t p-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="w-full h-10"
                    onClick={toggleSidebar}
                >
                    {isCollapsed ? (
                        <icons.ChevronRight className="h-5 w-5 text-muted-foreground" />
                    ) : (
                        <icons.ChevronLeft className="h-5 w-5 text-muted-foreground" />
                    )}
                </Button>
            </div>
        </div>
    );
};
