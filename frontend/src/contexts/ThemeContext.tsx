import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode; defaultTheme?: Theme; storageKey?: string }> = ({
    children,
    defaultTheme = "system",
    storageKey = "voseknows-ui-theme",
}) => {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    );
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const root = window.document.documentElement;

        const applyTheme = (currentTheme: Theme, skipTransition: boolean) => {
            if (skipTransition) {
                root.classList.add("no-transitions");
            }

            root.classList.remove("light", "dark");

            if (currentTheme === "system") {
                const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light";
                root.classList.add(systemTheme);
            } else {
                root.classList.add(currentTheme);
            }

            if (skipTransition) {
                // Force a reflow
                void root.offsetHeight;
                root.classList.remove("no-transitions");
            }
        };

        applyTheme(theme, !isLoaded);
        if (!isLoaded) setIsLoaded(true);

        // Add listener for system theme changes
        if (theme === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const handleChange = () => applyTheme("system", false); // Transitions for system changes too? Maybe.

            mediaQuery.addEventListener("change", handleChange);
            return () => mediaQuery.removeEventListener("change", handleChange);
        }
    }, [theme, isLoaded]);

    const value = {
        theme,
        setTheme: (newTheme: Theme) => {
            localStorage.setItem(storageKey, newTheme);
            setTheme(newTheme);
        },
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);

    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }

    return context;
};
