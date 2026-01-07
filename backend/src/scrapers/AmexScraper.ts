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

                    try { await page.waitForSelector('input[type="password"]', { timeout: 10000 }); } catch (e) { }

                    // Fill User (Slow Type)
                    const userSelectors = ['input[id="eliloUserID"]', 'input[type="email"]', 'input[type="text"]'];
                    for (const sel of userSelectors) {
                        try {
                            if (await page.$(sel)) {
                                await page.click(sel);
                                await page.type(sel, this.config.username, { delay: 100 }); // Human speed
                                break;
                            }
                        } catch (e) { }
                    }

                    // Fill Pass (Slow Type)
                    const passSelectors = ['input[id="eliloPassword"]', 'input[type="password"]'];
                    for (const sel of passSelectors) {
                        try {
                            if (await page.$(sel)) {
                                await page.click(sel);
                                await page.type(sel, this.config.password, { delay: 100 });
                                break;
                            }
                        } catch (e) { }
                    }

                    log.info(`Attempt ${attempt}: Submitting credentials...`);
                    let submitBtn = await page.$('#loginSubmit') || await page.$('button[type="submit"]');
                    if (submitBtn) {
                        try {
                            // Human Move & Click
                            const box = await submitBtn.boundingBox();
                            if (box) {
                                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
                                await page.mouse.down();
                                await page.mouse.up();
                            } else {
                                await submitBtn.click();
                            }
                        } catch (e) {
                            await page.keyboard.press('Enter');
                        }
                    } else {
                        await page.keyboard.press('Enter');
                    }

                    // Extended Wait for Navigation (20s)
                    try {
                        await page.waitForTimeout(5000);
                        await page.waitForLoadState('networkidle', { timeout: 15000 });
                    } catch (e) { }

                    if (await this.isLoggedIn(page)) {
                        log.info("Login Successful!");
                        loginSuccess = true;
                        break;
                    } else {
                        log.warning(`Attempt ${attempt} verification failed.`);
                        // Check for specific error
                        try {
                            const err = await page.$eval('.dls-icon-message-wrapper', (el: any) => el.innerText);
                            if (err) log.warning(`Amex UI Error: ${err}`);
                        } catch (e) { }
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
