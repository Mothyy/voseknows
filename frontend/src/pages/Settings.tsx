import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Key,
    Clock,
    User,
    Trash2,
    Copy,
    Plus,
    ShieldCheck,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    Activity
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "../contexts/ThemeContext";
import { Sun, Moon, Monitor, Laptop } from "lucide-react";

interface APIKey {
    id: string;
    name: string;
    key_hint: string;
    created_at: string;
    last_used_at: string | null;
}

const SettingsPage: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const { theme, setTheme } = useTheme();
    const [timeoutMinutes, setTimeoutMinutes] = useState<number>(user?.session_timeout_minutes || 60);
    const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
    const [newKeyName, setNewKeyName] = useState("");
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    const fetchSettings = async () => {
        try {
            const res = await apiClient.get("/settings");
            setApiKeys(res.data.apiKeys);
            setTimeoutMinutes(res.data.user.session_timeout_minutes);
        } catch (err) {
            console.error("Failed to fetch settings", err);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const updateTimeout = async () => {
        setLoading(true);
        try {
            await apiClient.post("/settings/timeout", { minutes: timeoutMinutes });
            setSuccessMsg("Session timeout updated successfully");
            await refreshUser();
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const generateApiKey = async () => {
        if (!newKeyName) return;
        setLoading(true);
        try {
            const res = await apiClient.post("/settings/api-keys", { name: newKeyName });
            setGeneratedKey(res.data.key);
            setNewKeyName("");
            fetchSettings();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const deleteApiKey = async (id: string) => {
        try {
            await apiClient.delete(`/settings/api-keys/${id}`);
            fetchSettings();
        } catch (err) {
            console.error(err);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSuccessMsg("Copied to clipboard!");
        setTimeout(() => setSuccessMsg(""), 2000);
    };

    return (
        <div className="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8 text-indigo-600" />
                    Security Settings
                </h1>
                <p className="text-muted-foreground mt-2">Manage your account security, session persistence, and developer access.</p>
            </div>

            {successMsg && (
                <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900 animate-in zoom-in duration-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="font-medium">{successMsg}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-8 md:grid-cols-2">
                {/* Session Timeout Settings */}
                <Card className="shadow-md border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-indigo-600" />
                            Session Timeout
                        </CardTitle>
                        <CardDescription>
                            Define how long you stay logged in before a new login is required.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="timeout">Minutes until auto-logout</Label>
                            <Input
                                id="timeout"
                                type="number"
                                value={timeoutMinutes}
                                onChange={(e) => setTimeoutMinutes(parseInt(e.target.value))}
                                className="h-11"
                            />
                        </div>
                        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 border-dashed">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <AlertDescription className="text-xs">
                                Shorter timeouts are more secure but less convenient for frequent use.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                    <CardFooter className="bg-muted/50 border-t border-border py-3">
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 w-full"
                            onClick={updateTimeout}
                            disabled={loading}
                        >
                            Save Preferences
                        </Button>
                    </CardFooter>
                </Card>

                {/* Profile Overview */}
                <Card className="shadow-md border-border flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-indigo-600" />
                            Account Profile
                        </CardTitle>
                        <CardDescription>
                            Your current identity in the system.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
                            {user?.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-lg text-foreground">{user?.email}</p>
                            <p className="text-muted-foreground text-sm">Protected by Industry Standard Encryption</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Appearance Settings */}
            <Card className="shadow-md border-border overflow-hidden">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                        <Laptop className="h-5 w-5 text-indigo-600" />
                        Appearance
                    </CardTitle>
                    <CardDescription>
                        Customize how the interface looks on your device.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button
                            onClick={async () => {
                                setTheme("light");
                                try {
                                    await apiClient.post("/settings/theme", { theme: "light" });
                                } catch (err) {
                                    console.error("Failed to save theme preference:", err);
                                }
                            }}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                                theme === "light"
                                    ? "bg-indigo-50/50 border-indigo-600 ring-2 ring-indigo-600/10"
                                    : "bg-background border-border hover:border-indigo-200"
                            )}
                        >
                            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                <Sun className="h-6 w-6" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-sm">Light</p>
                                <p className="text-[10px] text-muted-foreground">Classic brightness</p>
                            </div>
                        </button>

                        <button
                            onClick={async () => {
                                setTheme("dark");
                                try {
                                    await apiClient.post("/settings/theme", { theme: "dark" });
                                } catch (err) {
                                    console.error("Failed to save theme preference:", err);
                                }
                            }}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                                theme === "dark"
                                    ? "bg-indigo-950/20 dark:bg-indigo-950/40 border-indigo-600 ring-2 ring-indigo-600/10"
                                    : "bg-background border-border hover:border-indigo-200"
                            )}
                        >
                            <div className="h-12 w-12 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300">
                                <Moon className="h-6 w-6" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-sm">Dark</p>
                                <p className="text-[10px] text-muted-foreground">Easy on the eyes</p>
                            </div>
                        </button>

                        <button
                            onClick={async () => {
                                setTheme("system");
                                try {
                                    await apiClient.post("/settings/theme", { theme: "system" });
                                } catch (err) {
                                    console.error("Failed to save theme preference:", err);
                                }
                            }}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                                theme === "system"
                                    ? "bg-muted border-indigo-600 ring-2 ring-indigo-600/10"
                                    : "bg-background border-border hover:border-indigo-200"
                            )}
                        >
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                <Monitor className="h-6 w-6" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-sm">System</p>
                                <p className="text-[10px] text-muted-foreground">Sync with device</p>
                            </div>
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* API Key Management */}
            <Card className="shadow-md border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5 text-indigo-600" />
                        Developer API Keys
                    </CardTitle>
                    <CardDescription>
                        Use API keys to access your data from external scripts and services.
                        Keys are stored as secure SHA-256 hashes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* New Key Form */}
                    <div className="flex gap-3 items-end">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="keyName">New Key Name</Label>
                            <Input
                                id="keyName"
                                placeholder="e.g. My Personal Script"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                className="h-11"
                            />
                        </div>
                        <Button
                            className="h-11 bg-indigo-600 hover:bg-indigo-700 px-6 font-semibold"
                            onClick={generateApiKey}
                            disabled={!newKeyName || loading}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Generate Key
                        </Button>
                    </div>

                    {generatedKey && (
                        <Alert className="bg-card text-foreground border border-border shadow-xl animate-in slide-in-from-top-4 duration-300">
                            <Key className="h-4 w-4 text-emerald-400" />
                            <div className="w-full flex flex-col gap-2">
                                <AlertTitle className="text-emerald-400 font-bold">New Secret Key Generated!</AlertTitle>
                                <AlertDescription>
                                    <p className="text-muted-foreground text-xs mb-2">
                                        Copy this key now. We store only a cryptographic hash, so you will never be able to see this value again.
                                    </p>
                                    <div className="flex items-center gap-2 bg-muted p-3 rounded-lg border border-border">
                                        <code className="flex-1 font-mono text-foreground break-all">{generatedKey}</code>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-foreground hover:bg-muted"
                                            onClick={() => copyToClipboard(generatedKey)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-2 border border-border hover:bg-muted hover:text-foreground text-muted-foreground h-8 text-[10px]"
                                        onClick={() => setGeneratedKey(null)}
                                    >
                                        I have saved it securely
                                    </Button>
                                </AlertDescription>
                            </div>
                        </Alert>
                    )}

                    {/* Existing Keys List */}
                    <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted border-b border-border text-muted-foreground font-medium">
                                <tr>
                                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                                    <th className="text-left py-3 px-4 font-semibold">Hint</th>
                                    <th className="text-left py-3 px-4 font-semibold">Created</th>
                                    <th className="text-left py-3 px-4 font-semibold">Last Used</th>
                                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {apiKeys.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-muted-foreground italic">
                                            No API keys generated yet.
                                        </td>
                                    </tr>
                                ) : (
                                    apiKeys.map((key) => (
                                        <tr key={key.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="py-3 px-4 font-medium text-foreground">{key.name}</td>
                                            <td className="py-3 px-4"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{key.key_hint}</code></td>
                                            <td className="py-3 px-4 text-muted-foreground flex items-center gap-1.5">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(key.created_at), "MMM d, yyyy")}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {key.last_used_at ? (
                                                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium whitespace-nowrap">
                                                        <Activity className="h-3 w-3" />
                                                        {format(new Date(key.last_used_at), "MMM d, HH:mm")}
                                                    </div>
                                                ) : (
                                                    "Never used"
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                                                    onClick={() => deleteApiKey(key.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SettingsPage;
