import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, LogIn, Mail, Lock, Loader2 } from "lucide-react";

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as any)?.from?.pathname || "/";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            await login(email, password);
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to login. Please check your credentials.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />

            <Card className="w-full max-w-md shadow-2xl border-none ring-1 ring-black/5">
                <CardHeader className="space-y-4 pt-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
                        <Wallet className="h-8 w-8 text-white" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">
                            Welcome Back
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-base">
                            Enter your credentials to access your dashboard
                        </CardDescription>
                    </div>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-5 px-8">
                        {error && (
                            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Address</Label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-indigo-600" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    className="pl-10 h-11 border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-indigo-600" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-10 h-11 border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4 px-8 pb-10 pt-6">
                        <Button
                            className="w-full h-11 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <LogIn className="mr-2 h-5 w-5" />
                                    Sign In
                                </>
                            )}
                        </Button>

                        <p className="text-center text-sm text-slate-500">
                            Don't have an account?{" "}
                            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 underline-offset-4 hover:underline">
                                Create an account
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default LoginPage;
