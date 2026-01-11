
import { chromium, Browser, BrowserContext, Page, APIRequestContext } from 'playwright';
import { BankScraper, ScraperConfig, ScraperAccount } from './types';
import path from 'path';
import fs from 'fs';

export class WestpacScraper implements BankScraper {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private config: ScraperConfig;
    private exportDir: string;
    private accountsDetails: ScraperAccount[] = [];
    private verificationToken: string | null = null;



    constructor(config: ScraperConfig) {
        this.config = config;
        this.exportDir = config.exportPath || path.join(process.cwd(), 'exports');
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }
    }

    private async startBrowser() {
        console.log("Launching browser for Westpac...");
        this.browser = await chromium.launch({
            headless: this.config.headless !== false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });
        this.page = await this.context.newPage();
    }

    async login(): Promise<boolean> {
        try {
            await this.startBrowser();
            if (!this.page) return false;

            console.log("Navigating to Westpac login...");
            await this.page.goto('https://banking.westpac.com.au/wbc/banking/handler?TAM_OP=login&segment=personal', { timeout: 60000 });

            console.log("Waiting for login inputs...");
            const userInput = await this.page.waitForSelector('#fakeusername, #userID', { timeout: 15000 }).catch(() => null);
            if (!userInput) return false;

            const isFake = await userInput.getAttribute('id') === 'fakeusername';
            if (isFake) {
                await this.page.fill('#fakeusername', this.config.username || '');
            } else {
                await this.page.fill('#userID', this.config.username || '');
            }

            await this.page.fill('#password', this.config.password || '');

            console.log("Submitting credentials...");
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
                this.page.click('#signin, input[type="submit"]').catch(() => this.page!.click('button[type="submit"]'))
            ]);

            console.log("Waiting for landing page...");
            await this.page.waitForSelector('.accounts-summarylistwidget, #header', { timeout: 30000 });

            // CAPTURE CSRF
            this.verificationToken = await this.page.$eval('input[name="__RequestVerificationToken"]', el => (el as HTMLInputElement).value).catch(() => null);
            if (this.verificationToken) console.log("CSRF Token captured.");

            console.log("Login successful.");
            return true;

        } catch (e: any) {
            console.error("Westpac Login Failed:", e.message);
            if (this.page) {
                const p = path.join(this.exportDir, `debug_login_fail_${Date.now()}.png`);
                await this.page.screenshot({ path: p });
                console.log(`Saved screenshot to ${p}`);
            }
            return false;
        }
    }

    async getAccounts(): Promise<(string | ScraperAccount)[]> {
        if (!this.page) throw new Error("Not logged in");

        console.log("Already on Summary Page (from Login), verifying...");
        try {
            await this.page.waitForSelector('[id="Overview.Accounts.List"], .accounts-summarylistwidget, .ui-sortable', { timeout: 30000 });

        } catch (e: any) {
            console.error("Navigation to Summary Page Failed:", e.message);
            console.log("Current URL:", this.page.url());
            const p = path.join(this.exportDir, `debug_summary_fail_${Date.now()}.png`);
            await this.page.screenshot({ path: p });
            console.log(`Saved failure screenshot to ${p}`);
            throw e;
        }

        const accounts = await this.page.$$eval('tbody tr.row-navigatable', (rows: any[]) => {
            return rows.map(row => {
                const nameEl = row.querySelector('.tf-account-detail a span');
                const numberEl = row.querySelector('.tf-account-detail > div > span:last-child');
                const currentBalanceEl = row.querySelector('.balance.current .balance');
                const availableBalanceEl = row.querySelector('.balance.available .balance');

                const guidEl = row.querySelector('[data-accountguid]');
                const id = guidEl ? guidEl.getAttribute('data-accountguid') : null;

                if (!id) console.log(`WARNING: No GUID found for account ${nameEl?.textContent?.trim()}`);

                const parseBalance = (text: string | null | undefined) => {
                    if (!text) return 0;
                    const isNegative = text.toLowerCase().includes('minus') || text.includes('-');
                    const clean = text.replace(/[^0-9.]/g, '');
                    const val = parseFloat(clean) || 0;
                    return isNegative ? -Math.abs(val) : Math.abs(val);
                };

                return {
                    name: nameEl?.textContent?.trim() || "Unknown Account",
                    number: numberEl?.textContent?.trim() || "",
                    id: id || undefined,
                    balance: parseBalance(currentBalanceEl?.textContent),
                    available: parseBalance(availableBalanceEl?.textContent),
                    type: 'BANK',
                    isVirtual: false
                };
            });
        });

        const enrichedAccounts = accounts.map((acc: any) => {
            const lowerName = acc.name.toLowerCase();
            let type = 'BANK';
            if (lowerName.includes('card') || lowerName.includes('visa') || lowerName.includes('mastercard')) type = 'CREDIT';
            if (lowerName.includes('loan') || lowerName.includes('mortgage')) type = 'LOAN';

            console.log(`Discovered Account: ${acc.name} | Number: ${acc.number} | ID (GUID): ${acc.id}`);
            return { ...acc, type } as ScraperAccount;
        });

        this.accountsDetails = enrichedAccounts;
        console.log(`Found ${enrichedAccounts.length} accounts.`);
        return enrichedAccounts;
    }

    async downloadTransactions(days: number = 30): Promise<boolean> {
        if (!this.page) {
            console.error("Cannot download transactions: Missing Page.");
            return false;
        }
        const page = this.page;

        try {
            console.log("Navigating to Exports page...");

            // 0. Hover Over "Overview" to reveal menu (Critical Step from User)
            try {
                const overview = page.getByRole('link', { name: 'Overview' }).first();
                if (await overview.count() > 0 && await overview.isVisible()) {
                    console.log("Hovering over 'Overview' to reveal menu...");
                    await overview.hover();
                    await page.waitForTimeout(1000);
                } else {
                    const overviewText = page.locator('text=Overview').first();
                    if (await overviewText.isVisible()) {
                        await overviewText.hover();
                        await page.waitForTimeout(1000);
                    }
                }
            } catch (e) {
                console.log("Hover over 'Overview' failed.");
            }

            // 1. Click "Exports and reports"
            try {
                await page.waitForTimeout(2000); // Wait for menu hydration

                // Robust Regex Finder
                const exportLink = page.locator('a, button').filter({ hasText: /Exports.*reports/i }).first();

                if (await exportLink.count() > 0 && await exportLink.isVisible()) {
                    await exportLink.click();
                } else {
                    await page.getByRole('link', { name: 'Exports and reports' }).click();
                }
            } catch (e) {
                console.log("Link click failed, forcing navigation to known Export URL...");
                console.log(`Current URL before force: ${page.url()}`);
                await page.goto('https://banking.westpac.com.au/secure/banking/reportsandexports/design');
            }

            await page.waitForLoadState('domcontentloaded');

            // 2. Click "Export Transactions"
            try {
                // Wait for potential dynamic content
                await page.waitForTimeout(2000);
                await page.getByRole('link', { name: /Export Transactions/i }).click({ timeout: 15000 });
            } catch (e) {
                if (await page.getByRole('radio', { name: 'OFX' }).count() === 0) {
                    console.error("Could not find 'Export Transactions' link and OFX radio not found.");
                    throw e;
                }
            }

            // 3. Select OFX
            await page.getByRole('radio', { name: 'OFX' }).check();

            // 4. Select Accounts: ALL
            console.log("Selecting All Accounts...");

            try {
                // User script selector: 'Select accounts optional'
                const accountInput = page.getByRole('textbox', { name: /Select accounts/i });

                if (await accountInput.count() > 0 && await accountInput.isVisible()) {
                    await accountInput.click();
                    await page.waitForTimeout(1000);

                    // User script: Click 'Select dropdown'
                    const selectDropdown = page.getByRole('link', { name: /Select dropdown/i });
                    if (await selectDropdown.isVisible()) {
                        await selectDropdown.click();
                        await page.waitForTimeout(1000);

                        // User script: Click 'All'
                        const allLink = page.getByRole('link', { name: 'All', exact: true });
                        if (await allLink.isVisible()) {
                            await allLink.click();
                            console.log("Selected 'All' via Link.");
                        } else {
                            await page.locator('text=All').first().click();
                        }
                    } else {
                        // Maybe dropdown already open
                        await page.locator('text=All').first().click({ timeout: 2000 }).catch(() => console.log("Could not select 'All' directly"));
                    }

                    // Close dropdown
                    await page.click('body', { position: { x: 0, y: 0 } }).catch(() => { });

                } else {
                    // Check for old dropdown style
                    const dropdown = page.locator('[id*="AccountAccount"]');
                    if (await dropdown.count() > 0) {
                        await dropdown.click();
                        await page.locator('text=All').first().click({ timeout: 3000 }).catch(() => { });
                    } else {
                        console.log("'Select accounts' textbox not found. Creating generic export (Single Account assumption).");
                    }
                }
            } catch (e) {
                console.log("Account selection debug:", e);
            }

            // 5. Date Selection
            console.log("Selecting Date Range...");
            try {
                const dateRangeLink = page.getByRole('link', { name: /Date range/i });
                if (await dateRangeLink.isVisible()) {
                    await dateRangeLink.click();

                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(endDate.getDate() - days);

                    const formatDate = (d: Date) => {
                        const dd = String(d.getDate()).padStart(2, '0');
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const yyyy = d.getFullYear();
                        return `${dd}/${mm}/${yyyy}`;
                    };

                    await page.getByRole('textbox', { name: 'From' }).fill(formatDate(startDate));
                    await page.getByRole('textbox', { name: 'To' }).fill(formatDate(endDate));
                } else {
                    throw new Error("Date range tab not found");
                }

            } catch (err) {
                console.log("Custom date range failed, falling back to Preset: Last 30 days");
                try {
                    const presetLink = page.getByRole('link', { name: /preset range/i });
                    if (await presetLink.isVisible()) await presetLink.click();

                    await page.getByRole('link', { name: /30 days/i }).click();
                } catch (e) {
                    console.log("Preset selection failed. Using default.");
                }
            }

            // 6. Export
            console.log("Initiating Export...");

            // Check for validation errors proactively
            const errorMsg = page.locator('.validation-summary-errors, .field-validation-error');
            if (await errorMsg.isVisible()) {
                console.error("Validation error present BEFORE Export:", await errorMsg.innerText());
            }

            const downloadPromise = page.waitForEvent('download', { timeout: 120000 });

            await page.getByRole('button', { name: 'Export' }).click();

            // ERROR CHECK AFTER CLICK
            try {
                const postClickError = page.locator('.validation-summary-errors').first();
                if (await postClickError.isVisible({ timeout: 5000 })) {
                    const msg = await postClickError.innerText();
                    console.error("Export Failed with Validation Error:", msg);
                    throw new Error("Export Validation Error: " + msg);
                }
            } catch (e: any) {
                if (e.message.includes("Export Validation Error")) throw e;
            }

            const download = await downloadPromise;
            const filename = `WBC_Export_${Date.now()}.ofx`;
            const filePath = path.join(this.exportDir, filename);

            await download.saveAs(filePath);
            console.log(`Saved export to: ${filename}`);

            return true;

        } catch (e: any) {
            console.error("UI Export failed:", e.message);
            const p = path.join(this.exportDir, `debug_export_fail_${Date.now()}.png`);
            if (page) await page.screenshot({ path: p });
            console.log(`Saved export failure screenshot to ${p}`);
            return false;
        }
    }

    async close(): Promise<void> {
        if (this.browser) await this.browser.close();
    }
}
