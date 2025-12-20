export type Transaction = {
  id: string
  date: string
  description: string
  amount: number
  category: "Groceries" | "Utilities" | "Salary" | "Entertainment" | "Uncategorized" | "Transport" | "Dining"
  status: "pending" | "cleared" | "failed"
}

export const transactions: Transaction[] = [
    {
        id: "txn_1",
        date: "2024-07-26",
        description: "Trader Joe's",
        amount: -85.42,
        category: "Groceries",
        status: "cleared",
    },
    {
        id: "txn_2",
        date: "2024-07-25",
        description: "Monthly Salary",
        amount: 5000.0,
        category: "Salary",
        status: "cleared",
    },
    {
        id: "txn_3",
        date: "2024-07-24",
        description: "PG&E Electricity Bill",
        amount: -120.75,
        category: "Utilities",
        status: "cleared",
    },
    {
        id: "txn_4",
        date: "2024-07-23",
        description: "Netflix Subscription",
        amount: -15.99,
        category: "Entertainment",
        status: "cleared",
    },
    {
        id: "txn_5",
        date: "2024-07-22",
        description: "Shell Gas Station",
        amount: -45.5,
        category: "Transport",
        status: "cleared",
    },
    {
        id: "txn_6",
        date: "2024-07-21",
        description: "Starbucks",
        amount: -5.75,
        category: "Dining",
        status: "pending",
    },
    {
        id: "txn_7",
        date: "2024-07-20",
        description: "Amazon.com Purchase",
        amount: -250.0,
        category: "Uncategorized",
        status: "cleared",
    },
    {
        id: "txn_8",
        date: "2024-07-19",
        description: "Cinema Tickets",
        amount: -30.0,
        category: "Entertainment",
        status: "cleared",
    },
    {
        id: "txn_9",
        date: "2024-07-18",
        description: "Whole Foods Market",
        amount: -150.23,
        category: "Groceries",
        status: "cleared",
    },
    {
        id: "txn_10",
        date: "2024-07-17",
        description: "Venmo Payment to Jane",
        amount: -50.0,
        category: "Uncategorized",
        status: "pending",
    },
    {
        id: "txn_11",
        date: "2024-07-16",
        description: "Comcast Internet",
        amount: -80.0,
        category: "Utilities",
        status: "cleared",
    },
    {
        id: "txn_12",
        date: "2024-07-15",
        description: "The Cheesecake Factory",
        amount: -95.6,
        category: "Dining",
        status: "failed",
    },
];
