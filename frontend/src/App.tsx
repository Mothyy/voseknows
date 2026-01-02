import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import MainLayout from "./MainLayout";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Categories from "./pages/Categories";
import Budget from "./pages/Budget";
import AccountsPage from "@/pages/Accounts";
import AccountDetailPage from "@/pages/AccountDetailPage";
import ConnectionsPage from "@/pages/Connections";
import ReportsPage from "@/pages/Reports";
import SettingsPage from "@/pages/Settings";

// A simple placeholder for other pages
const GenericPage = ({ title }: { title: string }) => (
    <div className="p-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">
            This page is under construction.
        </p>
    </div>
);

import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";

function App() {
    return (
        <ThemeProvider defaultTheme="system" storageKey="voseknows-ui-theme">
            <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />

                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <MainLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<Dashboard />} />
                            <Route path="transactions" element={<Transactions />} />
                            <Route path="accounts" element={<AccountsPage />} />
                            <Route
                                path="accounts/:id"
                                element={<AccountDetailPage />}
                            />
                            <Route path="categories" element={<Categories />} />
                            <Route path="budgets" element={<Budget />} />
                            <Route path="reports" element={<ReportsPage />} />
                            <Route
                                path="settings/profile"
                                element={<SettingsPage />}
                            />
                            <Route
                                path="settings/preferences"
                                element={<SettingsPage />}
                            />
                            <Route path="connections" element={<ConnectionsPage />} />
                            <Route
                                path="*"
                                element={<GenericPage title="404 - Not Found" />}
                            />
                        </Route>
                    </Routes>
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
