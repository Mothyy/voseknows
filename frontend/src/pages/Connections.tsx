import React, { useEffect, useState } from "react";
import {
    Plus,
    RefreshCw,
    Trash2,
    AlertCircle,
    CheckCircle2,
    Link2,
    Database,
    Edit2
} from "lucide-react";
import apiClient from "../lib/api";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import ConnectionForm from "./ConnectionForm";
import { BankConnections } from "../components/BankConnections";

// Define the shape of a Connection object
export type Connection = {
    id: string;
    name: string;
    provider_name: string;
    provider_slug: string;
    status: 'active' | 'error' | 'syncing';
    last_sync: string | null;
    last_error: string | null;
    institution_name: string;
    customer_id: string;
};

const ConnectionsPage: React.FC = () => {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
    const [connectionToEdit, setConnectionToEdit] = useState<Connection | null>(null);

    const fetchConnections = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<Connection[]>("/data-providers/connections");
            setConnections(response.data);
            setError(null);
        } catch (err: any) {
            console.error("Failed to fetch connections:", err);
            setError("Could not load your connections. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnections();
    }, []);

    const handleSync = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            // Update local status to syncing
            setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'syncing' } : c));
            await apiClient.post(`/data-providers/connections/${id}/sync`);
            await fetchConnections();
        } catch (err) {
            console.error("Sync failed:", err);
            await fetchConnections(); // Refresh to get actual error status from server
        }
    };

    const handleDelete = async () => {
        if (!connectionToDelete) return;

        try {
            await apiClient.delete(`/data-providers/connections/${connectionToDelete.id}`);
            setConnections(prev => prev.filter(c => c.id !== connectionToDelete.id));
            setConnectionToDelete(null);
        } catch (err) {
            console.error("Delete failed:", err);
            setError("Failed to delete the connection.");
        }
    };

    const openEditForm = (conn: Connection, e: React.MouseEvent) => {
        e.stopPropagation();
        setConnectionToEdit(conn);
        setIsFormOpen(true);
    };

    const handleFormClose = () => {
        setIsFormOpen(false);
        setConnectionToEdit(null);
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                        Financial Connections
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your bank links and automated data sync providers.
                    </p>
                </div>
                <Button
                    onClick={() => setIsFormOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 shadow-md gap-2"
                >
                    <Plus className="h-4 w-4" /> Link Feed Provider
                </Button>
            </div>

            {error && (
                <Alert variant="destructive" className="animate-in fade-in zoom-in duration-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Automated Bank Scrapers Section (Moved to Top) */}
            <div className="animate-in slide-in-from-bottom-4 duration-500">
                <BankConnections />
            </div>

            {/* Direct Data Feeds (SISS) */}
            {connections.length > 0 && (
                <Card className="border-border shadow-sm overflow-hidden mt-8">
                    <CardHeader className="bg-muted/30 border-b border-border">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Database className="h-5 w-5 text-indigo-500" />
                            Direct Data Feeds
                        </CardTitle>
                        <CardDescription>
                            Active connections to data aggregators like SISS.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {connections.map((conn) => (
                                <div key={conn.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/10 transition-colors gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-1 h-10 w-10 rounded-full flex items-center justify-center shadow-inner ${conn.status === 'error' ? 'bg-red-50 text-red-600' :
                                            conn.status === 'syncing' ? 'bg-indigo-50 text-indigo-600' :
                                                'bg-emerald-50 text-emerald-600'
                                            }`}>
                                            {conn.status === 'syncing' ? <RefreshCw className="h-5 w-5 animate-spin" /> :
                                                conn.status === 'error' ? <AlertCircle className="h-5 w-5" /> :
                                                    <CheckCircle2 className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-foreground">{conn.institution_name}</h4>
                                                <span className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold border border-indigo-100 dark:border-indigo-900/50">
                                                    {conn.provider_name}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                                                {conn.status === 'error' ? (
                                                    <span className="text-red-500 flex items-center gap-1">
                                                        <AlertCircle className="h-3 w-3" /> {conn.last_error || "Connection error"}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 italic">
                                                        Last Synced: {conn.last_sync ? new Date(conn.last_sync).toLocaleString() : "Never"}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => handleSync(conn.id, e)}
                                            disabled={conn.status === 'syncing'}
                                            className="h-9 gap-1.5"
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${conn.status === 'syncing' ? 'animate-spin' : ''}`} />
                                            Sync
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => openEditForm(conn, e)}
                                            className="h-9 w-9 text-muted-foreground hover:text-indigo-600"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setConnectionToDelete(conn);
                                            }}
                                            className="h-9 w-9 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <ConnectionForm
                isOpen={isFormOpen}
                onClose={handleFormClose}
                onSuccess={fetchConnections}
                initialData={connectionToEdit}
            />

            <AlertDialog open={!!connectionToDelete} onOpenChange={(open) => !open && setConnectionToDelete(null)}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Connection?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove the link to <strong>{connectionToDelete?.institution_name}</strong>?
                            This will stop automatic transaction sync but won't delete imported data.
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

export default ConnectionsPage;
