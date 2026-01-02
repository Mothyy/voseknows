import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, UserPlus, Mail, Lock, Loader2, ShieldCheck } from "lucide-react";

const RegisterPage: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            return setError("Passwords do not match");
        }

        if (password.length < 8) {
            return setError("Password must be at least 8 characters");
        }

        setIsSubmitting(true);

        try {
            await register(email, password);
            navigate("/");
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to create account. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600" />

            <Card className="w-full max-w-md shadow-2xl border-none ring-1 ring-black/5">
                <CardHeader className="space-y-4 pt-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200 ring-4 ring-blue-50">
                        <Wallet className="h-8 w-8 text-white" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">
                            Create Account
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-base">
                            Start managing your finances with confidence
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
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    className="pl-10 h-11 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Min. 8 characters"
                                    className="pl-10 h-11 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">Confirm Password</Label>
                            <div className="relative group">
                                <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-10 h-11 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4 px-8 pb-10 pt-6">
                        <Button
                            className="w-full h-11 text-base font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 active:scale-[0.98] transition-all"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="mr-2 h-5 w-5" />
                                    Create Account
                                </>
                            )}
                        </Button>

                        <p className="text-center text-sm text-slate-500">
                            Already have an account?{" "}
                            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 underline-offset-4 hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default RegisterPage;
