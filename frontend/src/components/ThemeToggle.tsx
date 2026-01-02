import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import apiClient from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const { user } = useAuth();

    const toggleTheme = async () => {
        const nextTheme = theme === "light" ? "dark" : "light";
        setTheme(nextTheme);

        if (user) {
            try {
                await apiClient.post("/settings/theme", { theme: nextTheme });
            } catch (err) {
                console.error("Failed to sync theme to backend:", err);
            }
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
