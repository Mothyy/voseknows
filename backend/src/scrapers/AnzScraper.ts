import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { BankScraper, ScraperConfig } from './types';
import path from 'path';
import fs from 'fs';

export class AnzScraper implements BankScraper {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private config: ScraperConfig;
    private exportDir: string;
    private accountsDetails: any[] = [];

    // Selectors
    private readonly URL_LOGIN = "https://www.anz.com/INETBANK/bankmain.asp";
    private readonly SEL_USER = "input#customerRegistrationNumber";
    private readonly SEL_PASS = "input#password";
    private readonly SEL_LOGIN_BTN = "button[data-test-id='log-in-btn']";
    private readonly SEL_ACCOUNT_ITEM = "[data-test-id^='list-item-home-screen-list-display']";
    private readonly SEL_ACC_NAME = "[data-test-id='card-name']";
    private readonly SEL_ACC_NUM = "[data-test-id='card-number']";
    private readonly SEL_TAB_TRANSACTIONS = "li[data-testid='Transactions']"; // Note: Python used data-testid
    private readonly SEL_DOWNLOAD_BTN = "button[data-test-id='icon_link']"; // Filter for text 'Download'
    private readonly SEL_DL_DIALOG = "[data-test-id='outer-wrapper']";
    private readonly SEL_DL_CONFIRM = "#footer-primary-button";

    // ANZ-specific hidden format handling needs care

    constructor(config: ScraperConfig) {
        this.config = config;
        this.exportDir = config.exportPath || path.join(process.cwd(), 'exports');
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }
    }

    async startBrowser() {
        console.log("Launching browser for ANZ...");
        this.browser = await chromium.launch({
            headless: this.config.headless !== false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-zygote',
                '--disable-gpu'
            ],
            slowMo: 100
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        });

        this.context.setDefaultTimeout(60000); // 60s
        this.page = await this.context.newPage();

        // Stealth scripts
        await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });
    }

    async login(): Promise<boolean> {
        if (!this.page) await this.startBrowser();
        if (!this.page) throw new Error("Browser not initialized");

        try {
            console.log(`Navigating to ${this.URL_LOGIN}`);
            await this.page.goto(this.URL_LOGIN, { waitUntil: 'networkidle' });

            // Check if login form is visible
            await this.page.waitForSelector(this.SEL_USER, { state: 'visible', timeout: 30000 });

            console.log("Filling credentials...");
            await this.page.fill(this.SEL_USER, this.config.username || "");
            await this.page.fill(this.SEL_PASS, this.config.password || "");

            console.log("Clicking login...");
            const btn = await this.page.waitForSelector(this.SEL_LOGIN_BTN);
            await btn.click();

            // Wait for navigation
            await this.page.waitForLoadState('networkidle');

            // Verification
            // Check if we are on dashboard (look for account list)
            try {
                await this.page.waitForSelector(this.SEL_ACCOUNT_ITEM, { timeout: 20000 });
                console.log("Login successful, accounts found.");
                return true;
            } catch (e) {
                // Check for errors
                const content = await this.page.content();
                if (content.toLowerCase().includes("error") || content.toLowerCase().includes("invalid")) {
                    console.error("Login failed with error message on page.");
                } else {
                    console.error("Login timeout - could not navigate to dashboard.");
                }
                return false;
            }

        } catch (e) {
            console.error("Login Error:", e);
            if (this.config.headless === false) {
                await this.page.screenshot({ path: path.join(this.exportDir, 'debug_anz_login_fail.png') });
            }
            return false;
        }
    }

    async getAccounts(): Promise<string[]> {
        if (!this.page) throw new Error("Not initialized");

        try {
            console.log("Fetching accounts...");
            // Ensure we are on home
            if (!this.page.url().includes('bankmain')) {
                await this.page.goto(this.URL_LOGIN, { waitUntil: 'networkidle' });
            }

            await this.page.waitForSelector(this.SEL_ACCOUNT_ITEM, { state: 'visible' });

            // Extract details
            const domAccounts = await this.page.$$eval(this.SEL_ACCOUNT_ITEM, (elements: any[], args: { nameSel: string, numSel: string }) => {
                return elements.map((el: any) => {
                    const nameEl = el.querySelector(args.nameSel);
                    const numEl = el.querySelector(args.numSel);
                    const name = nameEl ? nameEl.innerText.trim() : "Unknown";
                    const number = numEl ? numEl.innerText.trim() : "000";
                    return { name, number };
                });
            }, { nameSel: this.SEL_ACC_NAME, numSel: this.SEL_ACC_NUM });

            this.accountsDetails = domAccounts; // Cache for download step
            console.log(`Found ${domAccounts.length} accounts.`);

            return domAccounts.map((a: any) => `${a.name} (${a.number})`);

        } catch (error) {
            console.error("Error fetching accounts:", error);
            return [];
        }
    }

    async downloadTransactions(days?: number): Promise<boolean> {
        if (!this.page) throw new Error("Not initialized");

        // Ensure cache
        if (this.accountsDetails.length === 0) {
            await this.getAccounts();
        }

        if (this.accountsDetails.length === 0) {
            console.error("No accounts to download.");
            return false;
        }

        console.log(`Starting download for ${this.accountsDetails.length} accounts...`);
        const endDate = new Date();
        const formatDate = (date: Date) => date.toISOString().split('T')[0];

        // Loop using Index to handle navigation resets
        for (let i = 0; i < this.accountsDetails.length; i++) {
            try {
                // Navigate Home ensures fresh state
                console.log(`Navigating Home for Account ${i + 1}...`);
                await this.page.goto(this.URL_LOGIN, { waitUntil: 'networkidle' });
                await this.page.waitForSelector(this.SEL_ACCOUNT_ITEM);

                // Get Account Elements again (references stale after nav)
                const accountElements = await this.page.$$(this.SEL_ACCOUNT_ITEM);
                if (i >= accountElements.length) {
                    console.error(`Index ${i} out of bounds (found ${accountElements.length})`);
                    continue;
                }

                const account = accountElements[i];
                const accDetails = this.accountsDetails[i];
                const safeName = `${accDetails.name}_${accDetails.number}`.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');

                console.log(`Processing ${accDetails.name} (${accDetails.number})...`);

                // Click Account
                await account.click();
                await this.page.waitForLoadState('networkidle');

                // Go to Transactions Tab
                try {
                    const tab = await this.page.waitForSelector(this.SEL_TAB_TRANSACTIONS, { timeout: 10000 });
                    await tab.scrollIntoViewIfNeeded();
                    await tab.click();
                    await this.page.waitForLoadState('networkidle');
                } catch (e) {
                    console.warn("Could not find transactions tab, maybe already there?");
                }

                // Wait for Download Button
                try {
                    // Find button with text "Download"
                    // Playwright selector: button[data-test-id='icon_link']:has-text('Download')
                    const dlBtn = await this.page.waitForSelector("button[data-test-id='icon_link']:has-text('Download')", { timeout: 10000 });
                    await dlBtn.click();
                } catch (e) {
                    console.error(`Download button missing for ${accDetails.name}`);
                    continue;
                }

                // Wait for Dialog
                await this.page.waitForSelector(this.SEL_DL_DIALOG, { state: 'visible' });
                console.log("Download dialog open.");

                // Select Format: Quicken (OFX)
                // Use JS hack as per Python reference if standard select fails
                const setFormatSuccess = await this.page.evaluate(() => {
                    const select = document.querySelector("select[id^='select-search-software-dropdown']") as HTMLSelectElement;
                    if (select) {
                        select.value = 'Quicken(OFX)';
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                    return false;
                });

                if (!setFormatSuccess) {
                    // Fallback: Click dropdown
                    console.log("JS set failed, trying UI click...");
                    try {
                        const dropdown = await this.page.waitForSelector("#drop-down-search-software-dropdown-field", { timeout: 3000 });
                        await dropdown.click();
                        await this.page.click("#select-search-software-dropdown-result-3"); // Quicken OFX
                    } catch (e) { console.error("UI select failed", e); }
                }

                // Prepare Download
                const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });

                // Click Confirm
                await this.page.click(this.SEL_DL_CONFIRM);

                const download = await downloadPromise;
                const filename = `ANZ_${safeName}_${formatDate(endDate)}.ofx`; // Note: OFX
                const filePath = path.join(this.exportDir, filename);

                await download.saveAs(filePath);
                console.log(`Saved: ${filename}`);

                // Pause slightly
                await this.page.waitForTimeout(1000);

            } catch (accError) {
                console.error(`Failed to process account ${i}:`, accError);
            }
        }

        return true;
    }

    async close() {
        if (this.browser) await this.browser.close();
        this.browser = null;
    }
}
