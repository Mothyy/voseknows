import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

const MainLayout: React.FC = () => {
    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
