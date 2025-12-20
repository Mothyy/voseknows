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
  return Icon ? <Icon className="h-5 w-5" /> : null;
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
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Sidebar Header */}
      <div className="flex h-16 items-center border-b p-4">
        <div
          className={cn(
            "flex items-center gap-2 overflow-hidden",
            isCollapsed && "w-0"
          )}
        >
          <icons.HandCoins className="h-8 w-8 text-primary" />
          <h1 className="whitespace-nowrap text-lg font-bold">VoseKnows</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-grow overflow-y-auto overflow-x-hidden px-4 py-4">
        <Accordion
          type="single"
          collapsible
          defaultValue={getDefaultAccordionValue()}
          className="w-full"
        >
          {navConfig.map((item: NavItem) =>
            item.children ? (
              <AccordionItem key={item.title} value={item.title} className="border-b-0">
                <AccordionTrigger
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:no-underline",
                     isCollapsed && "justify-center"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {getIcon(item.icon)}
                    {!isCollapsed && <span className="truncate">{item.title}</span>}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-4">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={({ isActive }) =>
                        cn(
                          "mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                          isActive && "bg-accent text-accent-foreground",
                          isCollapsed && "justify-center"
                        )
                      }
                    >
                      {getIcon(child.icon)}
                      {!isCollapsed && <span className="truncate">{child.title}</span>}
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
                    "mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground",
                    isCollapsed && "justify-center"
                  )
                }
              >
                {getIcon(item.icon)}
                {!isCollapsed && <span className="truncate">{item.title}</span>}
              </NavLink>
            )
          )}
        </Accordion>
      </nav>

      {/* Collapse Toggle Button */}
      <div className="mt-auto border-t p-4">
        <Button variant="outline" size="icon" className="w-full" onClick={toggleSidebar}>
            {isCollapsed ? <icons.ChevronRight className="h-4 w-4" /> : <icons.ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
