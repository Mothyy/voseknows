import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "@/lib/api";
import { Account } from "./Accounts"; // Reuse the Account type
import { Transaction } from "@/data/transactions"; // Reuse the Transaction type
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const AccountDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountDetails = async () => {
      if (!id) return;
      try {
        setLoading(true);
        // NOTE: These API endpoints will need to be created on the backend.
        const [accountResponse, transactionsResponse] = await Promise.all([
          apiClient.get<Account>(`/accounts/${id}`),
          // Fetch the 5 most recent transactions for this account
          apiClient.get<Transaction[]>(`/accounts/${id}/transactions?limit=5`),
        ]);
        setAccount(accountResponse.data);
        setTransactions(transactionsResponse.data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch account details:", err);
        setError("Failed to load account details. The account may not exist.");
      } finally {
        setLoading(false);
      }
    };

    fetchAccountDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-muted-foreground">Loading account details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Button asChild variant="outline" className="mb-4">
          <Link to="/accounts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Accounts
          </Link>
        </Button>
        <div className="flex items-center justify-center py-10">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return null; // Should be handled by error state, but good for type safety
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-6">
        <Button asChild variant="outline" className="mb-4">
          <Link to="/accounts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Accounts
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{account.name}</h1>
        <p className="text-muted-foreground capitalize">{account.type} Account</p>
        <div
          className={cn(
            "mt-2 text-4xl font-bold tracking-tight",
            account.balance >= 0 ? "text-green-600" : "text-red-600"
          )}
        >
          {formatCurrency(account.balance)}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            The last 5 transactions for this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "font-semibold",
                      tx.amount >= 0 ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {formatCurrency(tx.amount)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No recent transactions found for this account.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountDetailPage;
