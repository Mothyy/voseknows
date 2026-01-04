
export interface ScraperAccount {
    name: string;
    number?: string;
}

export interface ScraperResult {
    success: boolean;
    accounts?: string[]; // Keeping as string[] for now to match current frontend expectation
    error?: string;
}

export interface ScraperConfig {
    username?: string;
    password?: string;
    securityNumber?: string;
    headless?: boolean;
    exportPath?: string;
}

export interface BankScraper {
    login(): Promise<boolean>;
    getAccounts(): Promise<string[]>;
    downloadTransactions(days?: number): Promise<boolean>;
    close(): Promise<void>;
}
