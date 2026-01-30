import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as icons from "lucide-react";
import navConfig from "@/nav.json";
import { ThemeToggle } from "./components/ThemeToggle";

// Define the types for our navigation configuration
type NavItem = {
    title: string;
    path: string;
    icon: keyof typeof icons;
};

type NavSection = {
    title: string;
    items: NavItem[];
};

// Helper to get the Lucide icon component from its string name
const getIcon = (name: keyof typeof icons) => {
    const Icon = icons[name] as React.ElementType;
    return Icon ? <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" /> : null;
};

export const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div
            className={cn(
                "relative flex h-screen flex-col border-r bg-card/50 backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-sm",
                isCollapsed ? "w-[72px]" : "w-64",
            )}
        >
            {/* Sidebar Header */}
            <div className="flex h-16 items-center border-b px-4 gap-3 overflow-hidden">
                <div
                    className={cn(
                        "flex items-center gap-3 transition-all duration-500",
                        isCollapsed ? "opacity-0 invisible w-0" : "opacity-100 visible w-full"
                    )}
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                        <icons.HandCoins className="h-5 w-5" />
                    </div>
                    <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent whitespace-nowrap">
                        VoseKnows
                    </h1>
                </div>

                {/* Collapse/Expand Toggle - Positioned for easy access */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-8 w-8 hover:bg-accent/50 transition-all duration-300",
                        isCollapsed ? "mx-auto" : "ml-auto"
                    )}
                    onClick={toggleSidebar}
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? (
                        <icons.PanelLeftOpen className="h-5 w-5 text-muted-foreground" />
                    ) : (
                        <icons.PanelLeftClose className="h-5 w-5 text-muted-foreground" />
                    )}
                </Button>
            </div>

            {/* Navigation Sections */}
            <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-8 scrollbar-none hover:scrollbar-thin transition-all">
                {(navConfig as NavSection[]).map((section) => (
                    <div key={section.title} className="space-y-1">
                        {!isCollapsed && (
                            <h3 className="mb-2 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                {section.title}
                            </h3>
                        )}
                        <div className="space-y-[2px]">
                            {section.items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        cn(
                                            "group flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-primary/10 text-primary shadow-sm"
                                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                                            isCollapsed
                                                ? "justify-center px-0 mx-auto w-10 h-10"
                                                : "gap-3 px-4 mx-1"
                                        )
                                    }
                                    title={isCollapsed ? item.title : ""}
                                >
                                    {getIcon(item.icon)}
                                    {!isCollapsed && (
                                        <span className="truncate flex-1">
                                            {item.title}
                                        </span>
                                    )}
                                    {!isCollapsed && (
                                        <icons.ChevronRight className="h-3 w-3 opacity-0 transition-all duration-200 group-hover:opacity-40 group-hover:translate-x-1" />
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Bottom Section */}
            <div className="mt-auto border-t bg-accent/20 p-3 space-y-3">
                <div className="flex flex-col gap-2">
                    {user && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full h-12 transition-all duration-300 hover:bg-background/80",
                                        isCollapsed ? "justify-center px-0" : "justify-start px-2 gap-3"
                                    )}
                                >
                                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md shadow-primary/20 shrink-0">
                                        {user.email.charAt(0).toUpperCase()}
                                    </div>
                                    {!isCollapsed && (
                                        <div className="flex flex-col items-start overflow-hidden text-left">
                                            <span className="text-xs font-semibold truncate w-full leading-tight">
                                                {user.email.split('@')[0]}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground truncate w-full">
                                                {user.email}
                                            </span>
                                        </div>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isCollapsed ? "center" : "start"} side="right" className="w-56 ml-2">
                                <DropdownMenuLabel>Account Settings</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate("/settings/profile")}>
                                    <icons.User className="mr-2 h-4 w-4" />
                                    <span>My Profile</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate("/settings/preferences")}>
                                    <icons.SlidersHorizontal className="mr-2 h-4 w-4" />
                                    <span>Preferences</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                    <icons.LogOut className="mr-2 h-4 w-4" />
                                    <span>Logout</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Theme Toggle & Appearance */}
                    {!isCollapsed && (
                        <div className="flex items-center justify-between px-2 pt-1 border-t border-border/50">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                                Appearance
                            </span>
                            <ThemeToggle />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
