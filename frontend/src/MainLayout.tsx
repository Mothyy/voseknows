import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
import { useEffect } from "react";

const MainLayout: React.FC = () => {
    const { user } = useAuth();
    const { setTheme } = useTheme();

    // Sync theme with user preference ONLY ONCE when they log in
    useEffect(() => {
        if (user?.theme_preference) {
            setTheme(user.theme_preference);
        }
        // We only want to run this once when the user object is first loaded/changed (login)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-7xl mx-auto w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
