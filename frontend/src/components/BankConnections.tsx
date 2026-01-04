import React, { useState, useEffect } from "react";
import apiClient from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Banknote,
    Plus,
    RefreshCw,
    Trash2,
    Calendar,
    Play,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Edit2
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Scraper {
    id: string;
    name: string;
    slug: string;
    description: string;
}

interface Account {
    id: string;
    name: string;
    type: string;
}

interface Connection {
    id: string;
    name: string;
    scraper_id: string;
    scraper_name: string;
    scraper_slug: string;
    status: 'idle' | 'running' | 'error';
    last_run_at: string | null;
    last_error: string | null;
    account_id: string | null;
    target_account_name: string | null;
    date_format: string;
    accounts_map?: Record<string, string>;
}

export const BankConnections: React.FC = () => {
    const [scrapers, setScrapers] = useState<Scraper[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedScraper, setSelectedScraper] = useState("");
    const [connectionName, setConnectionName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    // const [selectedAccountId, setSelectedAccountId] = useState(""); // Deprecated
    const [frequency, setFrequency] = useState("daily");
    const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
    const [securityNumber, setSecurityNumber] = useState("");
    const [accountMapping, setAccountMapping] = useState<Record<string, string>>({});
    const [foundAccounts, setFoundAccounts] = useState<string[]>([]);

    // Dialog state
    const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [scrapersRes, connectionsRes, accountsRes] = await Promise.all([
                apiClient.get("/scrapers"),
                apiClient.get("/scrapers/connections"),
                apiClient.get("/accounts")
            ]);
            setScrapers(scrapersRes.data);
            setConnections(connectionsRes.data);
            setAccounts(accountsRes.data);
        } catch (err: any) {
            console.error("Fetch Data Error:", err);
            setError("Failed to fetch bank connection data. " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Status polling for running connections
    useEffect(() => {
        const hasRunning = connections.some(c => c.status === 'running');
        if (hasRunning) {
            const interval = setInterval(async () => {
                try {
                    const res = await apiClient.get("/scrapers/connections");
                    setConnections(res.data);
                } catch (err) {
                    console.error("Polling error:", err);
                }
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [connections]);

    const handleEdit = (conn: Connection) => {
        setEditingId(conn.id);
        setSelectedScraper(conn.scraper_id);
        setConnectionName(conn.name);
        setUsername(""); // Don't show credentials
        setPassword("");
        // setSelectedAccountId(conn.account_id || "");
        setDateFormat(conn.date_format || "YYYY-MM-DD");
        setAccountMapping(conn.accounts_map || {});
        setFoundAccounts(Object.keys(conn.accounts_map || {}));
        // Also handle metadata
        if (conn.encrypted_metadata && selectedScraperSlug === 'bom') {
            setSecurityNumber(""); // Keep empty for security on edit, but we know it's there
        }
        // Note: frequency would need another GET if we wanted to pre-populate it perfectly, 
        // but for now let's assume default or we could improve the backend GET /connections response to include it.
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingId(null);
        setSelectedScraper("");
        setConnectionName("");
        setUsername("");
        setPassword("");
        // setSelectedAccountId("");
        setFrequency("daily");
        setDateFormat("YYYY-MM-DD");
        setSecurityNumber("");
        setAccountMapping({});
        setFoundAccounts([]);
        setShowForm(false);
    };

    const selectedScraperSlug = scrapers.find(s => s.id === selectedScraper)?.slug;

    const [testResult, setTestResult] = useState<{ success: boolean; accounts?: string[]; error?: string } | null>(null);
    const [testingConnection, setTestingConnection] = useState(false);

    const handleTestConnection = async () => {
        setTestingConnection(true);
        setTestResult(null);
        setError(null);

        const payload = {
            scraper_id: selectedScraper,
            username,
            password,
            metadata: selectedScraperSlug === 'bom' ? { securityNumber } : {}
        };

        try {
            const res = await apiClient.post("/scrapers/connections/test", payload);
            if (res.data.success) {
                setTestResult({ success: true, accounts: res.data.accounts });
                setFoundAccounts(res.data.accounts || []);
            } else {
                setTestResult({ success: false, error: res.data.error || "Unknown error occurred" });
                setError(res.data.error || "Connection test failed");
            }
        } catch (err: any) {
            console.error("Test Connection Error:", err);
            const errorMsg = err.response?.data?.error || err.message;
            setTestResult({ success: false, error: errorMsg });
            setError("Test failed: " + errorMsg);
        } finally {
            setTestingConnection(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            let connId = editingId;
            const payload: any = {
                scraper_id: selectedScraper,
                name: connectionName,
                account_id: null,
                date_format: dateFormat,
                username: username || undefined,
                password: password || undefined,
                metadata: selectedScraperSlug === 'bom' ? { securityNumber } : {},
                accounts_map: accountMapping
            };

            if (editingId) {
                await apiClient.put(`/scrapers/connections/${editingId}`, payload);
            } else {
                const res = await apiClient.post("/scrapers/connections", payload);
                connId = res.data.id;
            }

            // Set frequency and run if connId is available
            if (connId) {
                await apiClient.post(`/scrapers/connections/${connId}/schedule`, {
                    frequency,
                    is_active: true
                });

                if ((window as any).syncAfterSave) {
                    await apiClient.post(`/scrapers/connections/${connId}/run`);
                }
            }

            resetForm();
            fetchData();
        } catch (err: any) {
            console.error("Submit Connection Error:", err);
            setError("Failed to save bank connection: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!connectionToDelete) return;
        try {
            await apiClient.delete(`/scrapers/connections/${connectionToDelete.id}`);
            setConnectionToDelete(null);
            fetchData();
        } catch (err) {
            setError("Failed to delete connection");
        }
    };

    const handleRunScraper = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setError(null);
        try {
            await apiClient.post(`/scrapers/connections/${id}/run`);
            fetchData();
        } catch (err: any) {
            console.error("Run Scraper Error:", err);
            setError("Failed to trigger scraper: " + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-md border-border">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Banknote className="h-5 w-5 text-indigo-600" />
                                Automated Bank Connections
                            </CardTitle>
                            <CardDescription>
                                Connect your bank accounts for automatic transaction syncing.
                            </CardDescription>
                        </div>
                        <Button
                            onClick={() => showForm ? resetForm() : setShowForm(true)}
                            variant={showForm ? "outline" : "default"}
                            className="gap-2"
                        >
                            {showForm ? "Cancel" : <><Plus className="h-4 w-4" /> Add Connection</>}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4 animate-in fade-in zoom-in duration-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {showForm && (
                        <form onSubmit={handleSubmit} className="bg-muted/30 p-6 rounded-lg border border-border mb-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
                            <h3 className="font-semibold text-lg">{editingId ? "Edit Bank Connection" : "New Bank Connection"}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="scraper">Select Bank Scraper</Label>
                                    <select
                                        id="scraper"
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
                                        value={selectedScraper}
                                        onChange={(e) => setSelectedScraper(e.target.value)}
                                        required
                                        disabled={!!editingId}
                                    >
                                        <option value="">Choose a bank...</option>
                                        {scrapers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Connection Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Personal ANZ Savings"
                                        value={connectionName}
                                        onChange={(e) => setConnectionName(e.target.value)}
                                        required
                                    />
                                </div>
                                {/* "Allocate to Local Account" removed as per request - handled by mapping */}
                                <div className="space-y-2">
                                    <Label htmlFor="frequency">Sync Frequency</Label>
                                    <select
                                        id="frequency"
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                                        value={frequency}
                                        onChange={(e) => setFrequency(e.target.value)}
                                        required
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="manual">Manual Only</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="username">Customer Number / Username</Label>
                                    <Input
                                        id="username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder={editingId ? "Leave blank to keep current" : ""}
                                        required={!editingId}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={editingId ? "Leave blank to keep current" : ""}
                                        required={!editingId}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="date_format">Date Format (for parsing)</Label>
                                    <select
                                        id="date_format"
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                                        value={dateFormat}
                                        onChange={(e) => setDateFormat(e.target.value)}
                                        required
                                    >
                                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                                        <option value="DD/MM/YYYY">DD/MM/YYYY (UK/AU)</option>
                                        <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                                    </select>
                                </div>
                                {selectedScraperSlug === 'bom' && (
                                    <div className="space-y-2 animate-in zoom-in duration-200">
                                        <Label htmlFor="security_number">Security Number (PIN)</Label>
                                        <Input
                                            id="security_number"
                                            type="password"
                                            value={securityNumber}
                                            onChange={(e) => setSecurityNumber(e.target.value)}
                                            placeholder={editingId ? "Leave blank to keep current" : "Enter your BOM Security Number"}
                                            required={!editingId}
                                        />
                                    </div>
                                )}

                                {(foundAccounts.length > 0 || Object.keys(accountMapping).length > 0) && (
                                    <div className="space-y-3 pt-4 border-t mt-4 animate-in fade-in slide-in-from-top-2 duration-300 col-span-full">
                                        <div>
                                            <Label className="text-base font-semibold">Account Mapping</Label>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Link the remote accounts found at your bank to your local accounts.
                                            </p>
                                        </div>
                                        <div className="grid gap-4 bg-muted/30 p-4 rounded-lg border border-border">
                                            {(foundAccounts.length > 0 ? foundAccounts : Object.keys(accountMapping)).map(remoteName => (
                                                <div key={remoteName} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 text-xs font-bold border border-indigo-200">
                                                            {remoteName.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-medium truncate" title={remoteName}>
                                                            {remoteName}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 sm:max-w-[250px]">
                                                        <select
                                                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:border-input"
                                                            value={accountMapping[remoteName] || ""}
                                                            onChange={e => setAccountMapping({ ...accountMapping, [remoteName]: e.target.value })}
                                                        >
                                                            <option value="">-- Select Local Account --</option>
                                                            {accounts.map(a => (
                                                                <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row justify-between pt-2 gap-3">
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleTestConnection}
                                            disabled={loading || testingConnection || !selectedScraper || !username || !password}
                                        >
                                            {testingConnection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                            Test Connection
                                        </Button>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button
                                            type="submit"
                                            disabled={loading || testingConnection}
                                            className="px-6 bg-slate-800 hover:bg-slate-900"
                                            onClick={() => (window as any).syncAfterSave = false}
                                        >
                                            {loading && !(window as any).syncAfterSave ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? "Save Changes" : "Link Only"}
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={loading || testingConnection}
                                            className="px-6 bg-indigo-600 hover:bg-indigo-700"
                                            onClick={() => (window as any).syncAfterSave = true}
                                        >
                                            {loading && (window as any).syncAfterSave ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? "Save & Sync" : "Link & Sync Now"}
                                        </Button>
                                    </div>
                                </div>
                                {testResult && (
                                    <div className={`mt-4 p-4 rounded-md border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex items-start gap-3">
                                            {testResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />}
                                            <div>
                                                <h4 className={`font-semibold ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                                                    {testResult.success ? "Connection Successful" : "Test Failed"}
                                                </h4>
                                                {testResult.error && <p className="text-sm text-red-700 mt-1">{testResult.error}</p>}
                                                {testResult.accounts && testResult.accounts.length > 0 && (
                                                    <div className="mt-2 text-sm text-green-800">
                                                        <p className="font-medium mb-1">Found Accounts:</p>
                                                        <ul className="list-disc pl-5 space-y-1">
                                                            {testResult.accounts.map((acct, i) => (
                                                                <li key={i}>{acct}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </form>
                    )}

                    <div className="space-y-4">
                        {connections.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground italic border-2 border-dashed rounded-lg border-border bg-muted/10">
                                <Banknote className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                No automated bank connections yet.
                            </div>
                        ) : (
                            connections.map((conn) => (
                                <div
                                    key={conn.id}
                                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-xl border border-border bg-card hover:shadow-md transition-all gap-4"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-inner ${conn.status === 'error' ? 'bg-red-50 text-red-600' :
                                            conn.status === 'running' ? 'bg-indigo-50 text-indigo-600' :
                                                'bg-emerald-50 text-emerald-600'
                                            }`}>
                                            {conn.status === 'running' ? (
                                                <RefreshCw className="h-6 w-6 animate-spin" />
                                            ) : conn.status === 'error' ? (
                                                <AlertCircle className="h-6 w-6" />
                                            ) : (
                                                <CheckCircle2 className="h-6 w-6" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-foreground text-lg">{conn.name}</h4>
                                                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground uppercase font-medium">
                                                    {conn.scraper_slug}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    Target: <strong className="text-indigo-600 dark:text-indigo-400">
                                                        {conn.accounts_map && Object.keys(conn.accounts_map).length > 0
                                                            ? `${Object.keys(conn.accounts_map).length} Account${Object.keys(conn.accounts_map).length === 1 ? '' : 's'} Mapped`
                                                            : (conn.target_account_name || "Unallocated")
                                                        }
                                                    </strong>
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {conn.last_run_at ? (
                                                        <>Last sync: {new Date(conn.last_run_at).toLocaleString()}</>
                                                    ) : (
                                                        <>Never synced</>
                                                    )}
                                                    {conn.date_format && ` • Format: ${conn.date_format}`}
                                                </p>
                                                {conn.last_error && (
                                                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800 shadow-sm animate-in shake duration-500">
                                                        <div className="flex items-start gap-2">
                                                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                                                                {conn.last_error}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 gap-2 font-medium"
                                            onClick={(e) => handleRunScraper(conn.id, e)}
                                            disabled={conn.status === 'running'}
                                        >
                                            <RefreshCw className={`h-4 w-4 ${conn.status === 'running' ? 'animate-spin' : ''}`} />
                                            Sync Now
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50"
                                            onClick={() => handleEdit(conn)}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                            onClick={() => setConnectionToDelete(conn)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={!!connectionToDelete} onOpenChange={(open) => !open && setConnectionToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Connection?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove the link to <strong>{connectionToDelete?.name}</strong>?
                            This will stop automatic synchronization.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Delete Connection
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
