import React, { createContext, useContext, useState, useEffect } from "react";
import apiClient from "../lib/api";

interface User {
    id: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, pass: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Check session on mount
    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        try {
            const res = await apiClient.get<User>("/auth/me");
            setUser(res.data);
        } catch (e) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email: string, pass: string) => {
        const res = await apiClient.post<User>("/auth/login", { email, password: pass });
        setUser(res.data);
    };

    const signOut = async () => {
        try {
            await apiClient.post("/auth/logout");
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
