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

            // Debug log for credential presence (lengths only)
            console.log(`Filling credentials -> UserLen: ${this.config.username?.length ?? 0}, SecNumLen: ${this.config.securityNumber?.length ?? 0}, PassLen: ${this.config.password?.length ?? 0}`);

            if (!this.config.username || !this.config.securityNumber || !this.config.password) {
                throw new Error("Missing required credentials (calculated length 0 or undefined). Please check connection settings.");
            }

            // Fill Customer Access Number
            await this.fillField('Customer Access Number', 'input#access-number', this.config.username);

            // Fill Security Number
            await this.fillField('Security Number', 'input#securityNumber', this.config.securityNumber);

            // Fill Password
            await this.fillField('Password', 'input#internet-password', this.config.password, true);

            console.log("Clicking login...");
            const loginButton = await this.page.waitForSelector('input#logonButton', { state: 'visible' });
            if (!loginButton) throw new Error("Login button not found");

            // Navigation wait
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
                loginButton.click()
            ]);

            // Check for immediate errors on the resulting page
            const errorSelectors = ['.error-message', '.alert', '.error', '.errormsg', '#error-msg'];
            for (const sel of errorSelectors) {
                const el = await this.page.$(sel);
                if (el && await el.isVisible()) {
                    const text = await el.innerText();
                    throw new Error(`Bank returned error: ${text}`);
                }
            }

            // Verify success by looking for dashboard or handling interstitials
            await this.handlePostLogin();

            // Final check
            if (await this.page.$("#acctSummaryList")) {
                console.log("Login successful - Dashboard found");
                return true;
            } else {
                console.error("Login verification failed - Dashboard not found");
                // Log debugging info
                const title = await this.page.title();
                const url = this.page.url();
                let snippet = "";
                try {
                    const body = await this.page.innerText('body');
                    snippet = body.replace(/\s+/g, ' ').substring(0, 300);
                } catch (e) { }

                throw new Error(`Login failed. Title: ${title}, URL: ${url}, PageText: ${snippet}`);
            }

        } catch (error) {
            console.error("Login failed:", error);
            throw error; // Rethrow to propagate to caller
        }
    }

    private async handlePostLogin() {
        if (!this.page) return;

        console.log("Checking for post-login intermediaries...");
        try {
            // Give it a moment (Bank/Network latency)
            await this.page.waitForLoadState('domcontentloaded');

            // Fast path: Dashboard already there
            if (await this.page.$("#acctSummaryList")) return;

            // Strategy: Look for "Continue", "Remind Me Later", etc.
            const actions = [
                { sel: "input[value='Continue']", name: "Continue Input" },
                { sel: "button:has-text('Continue')", name: "Continue Button" },
                { sel: "button:has-text('Remind me later')", name: "Remind Button" },
                { sel: "a:has-text('Remind me later')", name: "Remind Link" },
                { sel: "#marketing-continue", name: "Marketing Continue" }
            ];

            for (const action of actions) {
                try {
                    const el = await this.page.$(action.sel);
                    if (el && await el.isVisible()) {
                        console.log(`Found interstitial (${action.name}), interacting...`);
                        await el.click();
                        await this.page.waitForLoadState('networkidle');
                        // If dashboard appeared, we are done
                        if (await this.page.$("#acctSummaryList")) {
                            console.log("Dashboard reached after interstitial.");
                            return;
                        }
                    }
                } catch (e) { /* Ignore individual check failures */ }
            }

            // Wait one last time for dashboard
            await this.page.waitForSelector("#acctSummaryList", { timeout: 10000 });

        } catch (e) {
            console.log("Post-login check finished without finding dashboard.");
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

                // Click "All" filter tab using precise selector from HTML
                // STRICT MODE: Throw error if not found, as user requires "All" data.
                const allTabSelector = 'a[href="#transaction-all"]';
                const allTab = this.page.locator(allTabSelector);

                try {
                    await allTab.waitFor({ state: 'visible', timeout: 5000 });
                } catch (e) {
                    throw new Error(`'All' transaction tab not found (selector: ${allTabSelector}). Aborting export to prevent partial data.`);
                }

                console.log("Switching to 'All' filter...");
                await allTab.click();
                await this.page.waitForLoadState("networkidle");

                // Wait for the corresponding panel to become visible
                try {
                    await this.page.waitForSelector('#transaction-all', { state: 'visible', timeout: 10000 });
                    await this.page.waitForTimeout(1000); // Extra buffer for table rendering
                } catch (waitErr) {
                    throw new Error("Clicked 'All' tab but transaction list (#transaction-all) did not appear.");
                }

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
                // RETHROW error so it is caught by ScraperWorker and reported to Frontend
                throw e;
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
