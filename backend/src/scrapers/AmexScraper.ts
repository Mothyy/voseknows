// @ts-nocheck
import { PlaywrightCrawler, Configuration } from 'crawlee';
import { BankScraper, ScraperConfig } from './types';
import path from 'path';
import fs from 'fs';

export class AmexScraper implements BankScraper {
    private config: ScraperConfig;
    private exportDir: string;
    private sessionCookies: any[] = [];
    private accountName: string = 'Amex_Card';
    private accountKey: string = '01F03AE8991F41235B5F22D35128589F'; // Default/Fallback

    constructor(config: ScraperConfig) {
        this.config = config;
        this.exportDir = config.exportPath || path.join(process.cwd(), 'exports');
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }
    }

    // No-ops for Interface compatibility (Crawlee manages browser)
    async startBrowser() { }
    async close() { }

    async login(): Promise<boolean> {
        console.log("Starting Login & Download via Crawlee (Stealth Mode + UI Interaction)...");
        let loginSuccess = false;

        // Prevent nodemon restarts by using /tmp storage
        const crawlerConfig = new Configuration({
            storageClientOptions: {
                storageDir: '/tmp/crawlee_storage_' + Date.now()
            },
            persistStorage: false
        });

        const crawler = new PlaywrightCrawler({
            // Use Chrome/Stealth settings
            launchContext: {
                useChrome: false, // Use bundled Chromium
                launchOptions: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            },

            headless: this.config.headless !== false,

            // Session management - Disable disk persistence
            persistCookiesPerSession: false,
            useSessionPool: false,

            // TIMEOUTS
            requestHandlerTimeoutSecs: 300, // 5 minutes (Amex is slow + Retry Loop)

            // Interaction handler
            requestHandler: async ({ page, log }) => {
                log.info(`Processing Page: ${page.url()}`);

                const maxRetries = 3;
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    if (attempt > 1) {
                        log.info(`Refreshing for Login Attempt ${attempt}/${maxRetries}...`);
                        try {
                            await page.reload({ waitUntil: 'domcontentloaded' });
                            await page.waitForTimeout(3000);
                        } catch (e) { }
                    }

                    // --- LOGIN LOGIC ---
                    // 0. Handle Cookie Banners
                    try {
                        const cookieBtn = await page.getByRole('button', { name: /accept|agree|allow/i }).first();
                        if (await cookieBtn.isVisible()) {
                            await cookieBtn.click();
                            await page.waitForTimeout(1000);
                        }
                    } catch (e) { }

                    if (await this.isLoggedIn(page)) {
                        log.info("Already logged in.");
                        loginSuccess = true;
                        break;
                    }

                    // Fill Credentials
                    if (!this.config.username || !this.config.password) throw new Error("Missing credentials");

                    log.info(`Attempt ${attempt}: Filling credentials...`);

                    // 1. Fill User ID
                    let userFilled = false;
                    try {
                        // Try modern accessible selectors first
                        const userInput = page.getByLabel(/User ID|Username|User Name/i).first();
                        if (await userInput.isVisible()) {
                            await userInput.click();
                            await userInput.fill(this.config.username);
                            userFilled = true;
                        }
                    } catch (e) { }

                    if (!userFilled) {
                        // Fallback to old selectors
                        const userSelectors = ['input[id="eliloUserID"]', 'input[type="email"]', 'input[type="text"]', '#lilo_userName'];
                        for (const sel of userSelectors) {
                            try {
                                if (await page.locator(sel).first().isVisible()) {
                                    await page.locator(sel).first().click();
                                    await page.type(sel, this.config.username, { delay: 50 });
                                    userFilled = true;
                                    break;
                                }
                            } catch (e) { }
                        }
                    }

                    // 2. Fill Password
                    let passFilled = false;
                    try {
                        const passInput = page.getByLabel(/Password/i).first();
                        if (await passInput.isVisible()) {
                            await passInput.click();
                            await passInput.fill(this.config.password);
                            passFilled = true;
                        }
                    } catch (e) { }

                    if (!passFilled) {
                        const passSelectors = ['input[id="eliloPassword"]', 'input[type="password"]', '#lilo_password'];
                        for (const sel of passSelectors) {
                            try {
                                if (await page.locator(sel).first().isVisible()) {
                                    await page.locator(sel).first().click();
                                    await page.type(sel, this.config.password, { delay: 50 });
                                    passFilled = true;
                                    break;
                                }
                            } catch (e) { }
                        }
                    }

                    if (!userFilled || !passFilled) {
                        log.warning(`Could not find login fields. User: ${userFilled}, Pass: ${passFilled}`);
                        try { await page.screenshot({ path: path.join(this.exportDir, 'amex_fields_missing.png') }); } catch (e) { }
                    }

                    log.info(`Attempt ${attempt}: Submitting...`);

                    // 3. Submit
                    try {
                        const submitBtn = page.getByRole('button', { name: /Log In|Login|Sign In/i }).first();
                        if (await submitBtn.isVisible()) {
                            await submitBtn.click();
                        } else {
                            // Fallback
                            const altBtn = await page.$('#loginSubmit') || await page.$('button[type="submit"]');
                            if (altBtn) await altBtn.click();
                            else await page.keyboard.press('Enter');
                        }
                    } catch (e) {
                        await page.keyboard.press('Enter');
                    }

                    // Extended Wait for Navigation (20s)
                    try {
                        await page.waitForTimeout(5000); // Give time for submission
                        await page.waitForLoadState('networkidle', { timeout: 20000 });
                        await page.waitForLoadState('domcontentloaded');
                    } catch (e) { }

                    if (await this.isLoggedIn(page)) {
                        log.info("Login Successful!");
                        loginSuccess = true;
                        break;
                    } else {
                        log.warning(`Attempt ${attempt} verification failed. URL: ${page.url()}`);
                        // Check for specific error
                        try {
                            const errEl = await page.locator('.dls-icon-message-wrapper').first();
                            if (await errEl.isVisible()) {
                                const err = await errEl.innerText();
                                log.warning(`Amex UI Error: ${err}`);
                            }
                        } catch (e) { }

                        // Screenshot failure
                        try { await page.screenshot({ path: path.join(this.exportDir, `amex_login_attempt_${attempt}_fail.png`) }); } catch (e) { }
                    }
                }

                if (!loginSuccess) {
                    log.error("All login attempts failed.");
                    try { await page.screenshot({ path: path.join(this.exportDir, 'amex_login_fail.png') }); } catch (e) { }
                    return;
                }

                log.info("Proceeding to UI Download...");

                // --- DOWNLOAD LOGIC (UI) ---
                try {
                    // Check if URL is activity, if not navigate
                    if (!page.url().includes('activity')) {
                        await page.goto('https://global.americanexpress.com/activity/recent', { waitUntil: 'domcontentloaded' });
                        await page.waitForTimeout(5000);
                    }

                    // Click Download Icon
                    log.info("Looking for Download button...");
                    const downloadBtnId = '#action-icon-dls-icon-download-';
                    let downloadBtn = await page.waitForSelector(downloadBtnId, { timeout: 20000 }).catch(() => null);

                    if (!downloadBtn) {
                        // Fallback: Text search
                        try {
                            const span = await page.getByText('Download', { exact: true }).first();
                            downloadBtn = await span.locator('xpath=./../..').first();
                        } catch (e) { }
                    }

                    if (downloadBtn) {
                        await downloadBtn.click({ force: true });
                        log.info("Clicked Download...");

                        // Wait for Modal
                        await page.waitForSelector('label[for*="qif"]', { timeout: 15000 });

                        // Select QIF
                        await page.click('label[for*="qif"]');
                        log.info("Selected QIF");

                        // Click 'Most Recent 90 Days' checkbox if available
                        const recentLabelSelector = 'label[for="axp-activity-download-body-checkbox-options-downloadMostRecent"]';
                        try {
                            const checkboxLabel = await page.waitForSelector(recentLabelSelector, { timeout: 5000 });
                            if (checkboxLabel && await checkboxLabel.isVisible()) {
                                await checkboxLabel.click();
                                log.info("Checked 'Most Recent 90 Days'");
                            }
                        } catch (e) {
                            log.info("'Most Recent 90 Days' checkbox not found or not visible (skipping).");
                        }

                        // Confirm Download
                        const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
                        await page.click('[data-test-id*="download-confirm"]');

                        const download = await downloadPromise;
                        const tempPath = path.join(this.exportDir, 'temp_amex_download.qif');
                        await download.saveAs(tempPath);
                        log.info(`Downloaded file to ${tempPath}`);

                        this.sessionCookies.push({ name: 'download_success', value: 'true' }); // Marker
                    } else {
                        log.error("Download button not found.");
                        try { await page.screenshot({ path: path.join(this.exportDir, 'amex_missing_button.png') }); } catch (e) { }
                    }
                } catch (e: any) {
                    log.error(`UI Download failed: ${e.message}`);
                    try { await page.screenshot({ path: path.join(this.exportDir, 'amex_download_fail.png') }); } catch (e) { }
                }
            },
        }, crawlerConfig);

        // Run the crawler
        await crawler.run(['https://www.americanexpress.com/en-au/account/login']);

        return loginSuccess;
    }

    private async isLoggedIn(page: any): Promise<boolean> {
        try {
            const url = page.url();
            return url.includes('dashboard') || url.includes('activity');
        } catch (e) { return false; }
    }

    async getAccounts(): Promise<string[]> {
        return ['Amex Card'];
    }

    async downloadTransactions(days?: number): Promise<boolean> {
        const tempPath = path.join(this.exportDir, 'temp_amex_download.qif');
        if (fs.existsSync(tempPath)) {
            console.log("Found temp download, processing...");
            const content = fs.readFileSync(tempPath, 'utf-8');

            // UI Download for AU is already DD/MM/YYYY. Do not swap.
            // No Regex needed.

            const finalPath = path.join(this.exportDir, `amex_Amex_Card_${Date.now()}.qif`);
            fs.writeFileSync(finalPath, content);
            fs.unlinkSync(tempPath); // Cleanup

            // Save Debug Copy
            try {
                // exportDir is usually UUID folder, go up one level to exports root
                const debugPath = path.join(this.exportDir, '..', 'debug_amex_latest.qif');
                fs.writeFileSync(debugPath, content);
                console.log(`Debug QIF saved to: ${debugPath}`);
            } catch (e) { console.log("Failed to save debug copy"); }

            console.log(`Final QIF saved to: ${finalPath}`);
            return true;
        }
        console.log("No temp download file found.");
        return false;
    }
}
