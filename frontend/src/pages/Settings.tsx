import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Key,
    Clock,
    User,
    Trash2,
    Copy,
    Plus,
    ShieldCheck,
    CheckCircle2,
    Calendar,
    Activity,
    Sun,
    Moon,
    Monitor,
    Brain,
    Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { useTheme } from "../contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface APIKey {
    id: string;
    name: string;
    key_hint: string;
    created_at: string;
    last_used_at: string | null;
}

interface Integration {
    id: string;
    provider: string;
    model: string;
    is_active: boolean;
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

    // AI Integration State
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [llmProvider, setLlmProvider] = useState("openai");
    const [llmKey, setLlmKey] = useState("");
    const [llmModel, setLlmModel] = useState("gpt-4o");

    const fetchSettings = async () => {
        try {
            const res = await apiClient.get("/settings");
            setApiKeys(res.data.apiKeys);
            setTimeoutMinutes(res.data.user.session_timeout_minutes);
        } catch (err) {
            console.error("Failed to fetch settings", err);
        }
    };

    const fetchIntegrations = async () => {
        try {
            const res = await apiClient.get("/integrations/llm");
            setIntegrations(res.data);
        } catch (err) {
            console.error("Failed to fetch integrations", err);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchIntegrations();
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

    const saveIntegration = async () => {
        if (!llmKey && !llmModel) return;
        setLoading(true);
        try {
            await apiClient.post("/integrations/llm", {
                provider: llmProvider,
                apiKey: llmKey,
                model: llmModel
            });
            setSuccessMsg("Integration saved successfully");
            setLlmKey(""); // Clear key for security
            fetchIntegrations();
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const deleteIntegration = async (provider: string) => {
        if (!confirm("Are you sure you want to remove this integration?")) return;
        try {
            await apiClient.delete(`/integrations/llm/${provider}`);
            fetchIntegrations();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your account preferences and security.</p>
            </div>

            {successMsg && (
                <Alert className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{successMsg}</AlertDescription>
                </Alert>
            )}

            {/* Account Profile Card */}
            <Card className="shadow-md border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-indigo-600" />
                        Account Profile
                    </CardTitle>
                    <CardDescription>
                        Details about your user account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-slate-500">Email Address</Label>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{user?.email}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-slate-500">Account ID</Label>
                            <p className="font-mono text-xs text-slate-400 truncate">{user?.id}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Session Security Card */}
            <Card className="shadow-md border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-indigo-600" />
                        Security & Session
                    </CardTitle>
                    <CardDescription>
                        Configure how long your session stays active.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row md:items-end gap-4 max-w-md">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="timeout" className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Session Timeout (minutes)
                            </Label>
                            <Input
                                id="timeout"
                                type="number"
                                value={timeoutMinutes}
                                onChange={(e) => setTimeoutMinutes(parseInt(e.target.value))}
                                min={5}
                                max={1440}
                                className="h-11"
                            />
                        </div>
                        <Button
                            onClick={updateTimeout}
                            className="h-11 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
                            disabled={loading}
                        >
                            Update
                        </Button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                        Minimum 5 minutes, maximum 1440 minutes (24 hours).
                    </p>
                </CardContent>
            </Card>

            {/* Appearance Card */}
            <Card className="shadow-md border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sun className="h-5 w-5 text-indigo-600" />
                        Appearance
                    </CardTitle>
                    <CardDescription>
                        Personalize the look and feel of your dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button
                            onClick={() => setTheme("light")}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                                theme === "light" ? "border-indigo-600 bg-indigo-50/50" : "border-transparent bg-muted/30 hover:bg-muted/50"
                            )}
                        >
                            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                <Sun className="h-6 w-6" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-sm">Light</p>
                                <p className="text-[10px] text-muted-foreground">Standard brightness</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setTheme("dark")}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                                theme === "dark" ? "border-indigo-600 bg-indigo-50/50" : "border-transparent bg-muted/30 hover:bg-muted/50"
                            )}
                        >
                            <div className="h-12 w-12 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-100">
                                <Moon className="h-6 w-6" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-sm">Dark</p>
                                <p className="text-[10px] text-muted-foreground">Easy on the eyes</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setTheme("system")}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                                theme === "system" ? "border-indigo-600 bg-indigo-50/50" : "border-transparent bg-muted/30 hover:bg-muted/50"
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

            {/* AI Integrations */}
            <Card className="shadow-md border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-indigo-600" />
                        AI Integrations
                    </CardTitle>
                    <CardDescription>
                        Configure AI providers to enable smart transaction classification.
                        Your API keys are stored securely.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="provider">Provider</Label>
                            <select
                                id="provider"
                                className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={llmProvider}
                                onChange={(e) => setLlmProvider(e.target.value)}
                            >
                                <option value="openai">OpenAI (ChatGPT)</option>
                                <option value="gemini">Google Gemini</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="api_key">API Key</Label>
                            <Input
                                id="api_key"
                                type="password"
                                placeholder="sk-..."
                                value={llmKey}
                                onChange={(e) => setLlmKey(e.target.value)}
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="model">Model ID (Optional)</Label>
                            <Input
                                id="model"
                                placeholder="gpt-4o"
                                value={llmModel}
                                onChange={(e) => setLlmModel(e.target.value)}
                                className="h-11"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            onClick={saveIntegration}
                            className="bg-indigo-600 hover:bg-indigo-700"
                            disabled={!llmKey || loading}
                        >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Save Integration
                        </Button>
                    </div>

                    {/* List Configured Integrations */}
                    <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted border-b border-border text-muted-foreground font-medium">
                                <tr>
                                    <th className="text-left py-3 px-4 font-semibold">Provider</th>
                                    <th className="text-left py-3 px-4 font-semibold">Model</th>
                                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {integrations.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-muted-foreground italic">
                                            No AI integrations configured.
                                        </td>
                                    </tr>
                                ) : (
                                    integrations.map((integ) => (
                                        <tr key={integ.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="py-3 px-4 font-medium capitalize">{integ.provider}</td>
                                            <td className="py-3 px-4 text-muted-foreground">{integ.model || 'Default'}</td>
                                            <td className="py-3 px-4">
                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium flex items-center w-fit gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Active
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                                                    onClick={() => deleteIntegration(integ.provider)}
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
