import React, { useState, useEffect } from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
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
// Assume ConnectionForm will be created
import ConnectionForm from "./ConnectionForm";
// Define the shape of a Connection object
export type Connection = {
    id: string;
    institution_name: string;
    provider_name: string;
    provider_slug: string;
    last_sync_at: string | null;
};

const ConnectionsPage: React.FC = () => {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(
        null,
    );

    const fetchConnections = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get<Connection[]>(
                "/data-providers/connections",
            );
            setConnections(response.data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch connections:", err);
            setError("Failed to load connections. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnections();
    }, []);

    const handleSync = async (connectionId: string) => {
        try {
            await apiClient.post(
                `/data-providers/connections/${connectionId}/sync`,
            );
            fetchConnections(); // Refresh the list to show the new sync time
        } catch (error) {
            console.error("Failed to sync connection:", error);
            alert("Failed to sync. Check the console for more details.");
        }
    };

    const handleDelete = async (_connectionId: string) => {
        try {
            // We don't have a DELETE endpoint yet, but this is how it would work
            // await apiClient.delete(`/data-providers/connections/${connectionId}`);
            alert("Deleting connections is not yet implemented.");
            setIsConfirmingDelete(null);
            // fetchConnections();
        } catch (error) {
            console.error("Failed to delete connection:", error);
            alert("Failed to delete. Check the console for more details.");
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <p className="text-muted-foreground">Loading connections...</p>
            );
        }
        if (error) {
            return <p className="text-red-500">{error}</p>;
        }
        if (connections.length === 0) {
            return (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <h3 className="text-lg font-semibold">
                        No Connections Found
                    </h3>
                    <p className="text-muted-foreground mt-2">
                        Get started by linking an account from a data provider.
                    </p>
                    <Button
                        className="mt-4"
                        onClick={() => setIsFormOpen(true)}
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Link New Account
                    </Button>
                </div>
            );
        }
        return (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {connections.map((conn) => (
                    <Card key={conn.id}>
                        <CardHeader>
                            <CardTitle>{conn.institution_name}</CardTitle>
                            <CardDescription>
                                Provider: {conn.provider_name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Last Synced:{" "}
                                {conn.last_sync_at
                                    ? new Date(
                                          conn.last_sync_at,
                                      ).toLocaleString()
                                    : "Never"}
                            </p>
                            <div className="flex justify-end space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSync(conn.id)}
                                >
                                    Sync Now
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                        setIsConfirmingDelete(conn.id)
                                    }
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <>
            <div className="container mx-auto py-10 px-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Connections
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage your linked financial data providers.
                        </p>
                    </div>
                    {connections.length > 0 && (
                        <Button onClick={() => setIsFormOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Link New Account
                        </Button>
                    )}
                </div>
                {renderContent()}
            </div>

            {/* We will create this form next */}
            <ConnectionForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={fetchConnections}
            />

            <AlertDialog
                open={!!isConfirmingDelete}
                onOpenChange={() => setIsConfirmingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the connection. This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (isConfirmingDelete) {
                                    handleDelete(isConfirmingDelete);
                                }
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default ConnectionsPage;
