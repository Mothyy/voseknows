import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { BankScraper, ScraperConfig } from './types';
import path from 'path';
import fs from 'fs';

export class GreaterBankScraper implements BankScraper {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private config: ScraperConfig;
    private exportDir: string;

    constructor(config: ScraperConfig) {
        this.config = config;
        this.exportDir = config.exportPath || path.join(process.cwd(), 'exports');
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }
    }

    async startBrowser() {
        console.log("Launching browser for Greater Bank...");
        this.browser = await chromium.launch({
            headless: this.config.headless !== false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-zygote',
                '--disable-gpu',
                '--window-size=1280,800'
            ]
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            ignoreHTTPSErrors: true,
            acceptDownloads: true,
            locale: 'en-AU',
            timezoneId: 'Australia/Melbourne'
        });

        this.page = await this.context.newPage();
        this.page.setDefaultNavigationTimeout(60000);
        this.page.setDefaultTimeout(30000);
    }

    async login(): Promise<boolean> {
        try {
            if (!this.browser) {
                await this.startBrowser();
            }

            if (!this.page) throw new Error("Page not initialized");

            console.log("Navigating to Greater Bank login...");
            await this.page.goto('https://mb.greater.com.au/MobileBanking/Login', {
                waitUntil: 'domcontentloaded'
            });

            // Wait for form
            await this.page.waitForSelector('form.login-page__form');

            console.log("Filling credentials...");
            await this.page.fill('input[name="Username"]', this.config.username!);
            await this.page.fill('input[name="Password"]', this.config.password!);

            console.log("Submitting login form...");
            const loginButton = await this.page.waitForSelector('button[type="submit"]', { state: 'visible' });
            if (!loginButton) throw new Error("Login button not found");

            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
                loginButton.click()
            ]);

            // Check for error
            const errorElement = await this.page.$('.error-message, .validation-summary-errors');
            if (errorElement) {
                const text = await errorElement.innerText();
                throw new Error(`Login failed: ${text}`);
            }

            console.log("Login action completed. Checking current page...");
            const title = await this.page.title();
            console.log(`Current page title: ${title}`);
            const url = this.page.url();
            console.log(`Current URL: ${url}`);

            if (url.includes('SecondFactorAuthentication')) {
                console.log("2FA required. Please handle 2FA manually or configure automation.");
                // For now, we assume success if we got past login, but might need detailed handling later
            }

            return true;

        } catch (error) {
            console.error("Greater Bank login error:", error);
            if (this.browser) await this.browser.close();
            throw error;
        }
    }

    private accountsDetails: any[] = [];

    async getAccounts(): Promise<string[]> {
        if (!this.page) throw new Error("Not logged in");

        console.log("Fetching accounts list...");

        try {
            // Try to extract from the global state object which is cleaner
            const accounts = await this.page.evaluate(() => {
                // @ts-ignore
                const app = window.App;
                if (app && app.InitialState && app.InitialState.featureModel && Array.isArray(app.InitialState.featureModel.accounts)) {
                    return app.InitialState.featureModel.accounts.map((acc: any) => ({
                        name: acc.name,
                        number: acc.number,
                        id: acc.id,
                        bsb: acc.bsb
                    }));
                }
                return null;
            });

            if (accounts) {
                console.log(`Found ${accounts.length} accounts via App state.`);
                this.accountsDetails = accounts;
                return accounts.map((a: any) => `${a.name} (${a.number})`);
            }

            // Fallback to DOM scraping
            console.log("App state not found, scraping DOM...");
            const domAccounts = await this.page.$$eval('.ob-list-item__parent-anchor', (elements) => {
                return elements.map(el => {
                    const name = el.querySelector('.account-name')?.textContent?.trim() || 'Unknown';
                    const number = el.querySelector('.number')?.textContent?.trim() || '';
                    const href = el.getAttribute('href') || '';
                    // Extract ID from href like /MobileBanking/Transactions/908971188
                    const idMatch = href.match(/Transactions\/(\d+)/);
                    const id = idMatch ? idMatch[1] : '';
                    return { name, number, id, href };
                });
            });

            this.accountsDetails = domAccounts;
            return domAccounts.map(a => `${a.name} (${a.number})`);

        } catch (error) {
            console.error("Error fetching accounts:", error);
            return [];
        }
    }

    async downloadTransactions(days?: number): Promise<boolean> {
        if (!this.page) throw new Error("Not initialized");

        // Ensure accounts are fetched
        if (this.accountsDetails.length === 0) {
            await this.getAccounts();
        }

        if (this.accountsDetails.length === 0) {
            throw new Error("No accounts found to download transactions for.");
        }

        // Ensure export directory exists
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }

        console.log(`Starting transaction download for ${this.accountsDetails.length} accounts...`);

        for (const account of this.accountsDetails) {
            try {
                // Construct URL or find link
                const targetUrl = account.href
                    ? (account.href.startsWith('http') ? account.href : `https://mb.greater.com.au${account.href}`)
                    : `https://mb.greater.com.au/MobileBanking/Transactions/${account.id}`;

                console.log(`Navigating to ${targetUrl}`);
                await this.page.goto(targetUrl, { waitUntil: 'networkidle' });

                // Click the Export button to open the modal
                const exportButtonSelector = 'button[aria-label="Export"]';

                // Wait for the button to be present and visible
                try {
                    await this.page.waitForSelector(exportButtonSelector, { state: 'visible', timeout: 10000 });
                } catch (e) {
                    console.error(`Export button not found for account ${account.name} at ${targetUrl}`);
                    continue; // Skip to next account
                }

                console.log("Opening export modal...");
                await this.page.click(exportButtonSelector);

                const modalSelector = '#modal-export';
                await this.page.waitForSelector(modalSelector, { state: 'visible' });

                // Select QIF explicitly (Backend supports QIF)
                try {
                    // Try waiting for the specific radio button
                    await this.page.waitForSelector('#ExportTo-QIF', { state: 'attached', timeout: 5000 });
                    await this.page.click('#ExportTo-QIF');
                } catch (e) {
                    // Fallback to label if ID not interactable
                    console.log("Could not click #ExportTo-QIF directly, trying label...");
                    const label = await this.page.$('label[for="ExportTo-QIF"]');
                    if (label) await label.click();
                    else throw new Error("Could not find QIF export option");
                }

                // Calculate dates
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - (days || 30));

                const formatDate = (date: Date) => date.toISOString().split('T')[0];

                // Fill date fields
                await this.page.fill('input[name="From"]', formatDate(startDate));
                await this.page.fill('input[name="To"]', formatDate(endDate));

                console.log(`Requesting export from ${formatDate(startDate)} to ${formatDate(endDate)}`);

                // Start download handler BEFORE clicking the final submit
                const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });

                // Click the Export button inside the modal footer
                const submitButtonSelector = `${modalSelector} .modal-footer button[aria-label="Export"]`;
                await this.page.click(submitButtonSelector);

                const download = await downloadPromise;
                const safeName = account.name.replace(/[^a-z0-9]/gi, '_');
                const filename = `Greater_${safeName}_${formatDate(endDate)}.qif`;
                const filePath = path.join(this.exportDir, filename);

                await download.saveAs(filePath);
                console.log(`Successfully downloaded: ${filename}`);

                // Wait a bit before next account
                await this.page.waitForTimeout(2000);

            } catch (err: any) {
                console.error(`Failed to download for ${account.name}:`, err);
                // Don't throw here, try other accounts
            }
        }
        return true;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
    }
}
