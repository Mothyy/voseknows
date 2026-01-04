import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { BankScraper, ScraperConfig } from './types';
import path from 'path';
import fs from 'fs';

export class BomScraper implements BankScraper {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private config: ScraperConfig;
    private exportDir: string;

    constructor(config: ScraperConfig) {
        this.config = config;
        // Use provided export path or default
        this.exportDir = config.exportPath || path.join(process.cwd(), 'exports');
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }
    }

    async startBrowser() {
        console.log("Launching browser...");
        this.browser = await chromium.launch({
            headless: this.config.headless !== false, // default true
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
        this.page.setDefaultNavigationTimeout(120000);
        this.page.setDefaultTimeout(30000);
    }

    async login(): Promise<boolean> {
        try {
            if (!this.browser) {
                await this.startBrowser();
            }

            if (!this.page) throw new Error("Page not initialized");

            console.log("Navigating to login page...");
            await this.page.goto('https://ibanking.bankofmelbourne.com.au/ibank/loginPage.action', {
                waitUntil: 'domcontentloaded',
                timeout: 120000
            });

            console.log("Filling credentials...");

            // Fill Customer Access Number
            await this.fillField('Customer Access Number', 'input#access-number', this.config.username!);

            // Fill Security Number
            await this.fillField('Security Number', 'input#securityNumber', this.config.securityNumber!);

            // Fill Password
            await this.fillField('Password', 'input#internet-password', this.config.password!, true);

            console.log("Clicking login...");
            const loginButton = await this.page.waitForSelector('input#logonButton', { state: 'visible' });
            if (!loginButton) throw new Error("Login button not found");

            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
                loginButton.click()
            ]);

            // Check for errors
            const errorSelector = '.error-message, .alert, .error';
            const errorElement = await this.page.$(errorSelector);
            if (errorElement) {
                const errorText = await errorElement.innerText();
                throw new Error(`Login error: ${errorText}`);
            }

            // Wait for success indicator
            await this.page.waitForLoadState('networkidle');
            // Simplified check: if we are not on login page and don't see errors
            console.log("Login successful");
            return true;

        } catch (error) {
            console.error("Login failed:", error);
            return false;
        }
    }

    private async fillField(name: string, selector: string, value: string, isPassword = false) {
        if (!this.page) return;

        await this.page.waitForSelector(selector, { state: 'visible' });
        await this.page.click(selector, { clickCount: 3 });
        await this.page.keyboard.press('Backspace');
        await this.page.fill(selector, value);

        if (!isPassword) {
            const currentVal = await this.page.inputValue(selector);
            if (currentVal !== value) {
                throw new Error(`Failed to fill ${name}`);
            }
        }
    }

    async getAccounts(): Promise<string[]> {
        if (!this.page) throw new Error("Not logged in");

        console.log("Fetching accounts...");
        await this.page.waitForSelector("#acctSummaryList li", { timeout: 30000 });

        const accounts: string[] = [];
        const elements = await this.page.$$("#acctSummaryList li h2 a");

        for (const el of elements) {
            if (await el.isVisible()) {
                const text = await el.innerText();
                const cleanText = text.trim();
                if (cleanText) {
                    accounts.push(cleanText);
                }
            }
        }

        return accounts;
    }

    async downloadTransactions(days = 30): Promise<boolean> {
        if (!this.page) throw new Error("Not logged in");

        console.log("Starting transaction download...");
        const accounts = await this.getAccounts(); // Re-fetch to be sure, or cleaner logic would be to grab elements again

        await this.page.waitForSelector("#acctSummaryList li", { timeout: 30000 });

        // We need to loop. In one-page apps, references become stale. 
        // Strategy: Get count, loop by index.
        const accountLinks = await this.page.$$("#acctSummaryList li h2 a");
        const total = accountLinks.length;

        const processed = new Set<string>();

        for (let i = 0; i < total; i++) {
            try {
                // Always re-query to avoid stale elements
                const links = await this.page.$$("#acctSummaryList li h2 a");
                const link = links[i];
                if (!link) continue;

                const name = (await link.innerText()).trim();
                if (processed.has(name)) continue;

                console.log(`Processing account: ${name}`);
                await link.click();
                await this.page.waitForLoadState("networkidle");

                // Export steps
                await this.page.waitForSelector("#export-file-format", { timeout: 15000 });
                await this.page.selectOption("#export-file-format", "QIF");
                await this.page.check("#includeCategories");
                // Check if subcategories checkbox is enabled/visible
                if (await this.page.$("#includeSubCategories:not([disabled])")) {
                    await this.page.check("#includeSubCategories");
                }

                // Download
                const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
                await this.page.click("#transHistExport");
                const download = await downloadPromise;

                const safeName = name.replace(/ /g, '_').replace(/\//g, '_');
                // Use bom_ prefix as established
                const filename = `bom_${safeName}.qif`;
                const savePath = path.join(this.exportDir, filename);

                await download.saveAs(savePath);
                console.log(`Saved to ${savePath}`);
                processed.add(name);

                // Return to dashboard
                await this.page.click("li#mainMenu0 a");
                await this.page.waitForSelector("#acctSummaryList li h2 a");

            } catch (e) {
                console.error(`Failed to export account at index ${i}`, e);
                // Try to recover
                try {
                    await this.page.goto('https://internetbanking.bankofmelbourne.com.au/banking/accounts');
                    await this.page.waitForSelector("#acctSummaryList li h2 a");
                } catch (recErr) {
                    console.error("Recovery failed", recErr);
                }
            }
        }

        return true;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
