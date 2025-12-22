export type Transaction = {
    id: string;
    date: string;
    description: string;
    amount: number | string;
    balance: number | string;
    status: "pending" | "cleared" | "failed";
    account: string;
    category: string | null;
    account_id: string;
    category_id: string | null;
};

export const transactions: Transaction[] = [];
