import { BankScraper, ScraperConfig } from '../scrapers/types';
import { BomScraper } from '../scrapers/BomScraper';
import { GreaterBankScraper } from '../scrapers/GreaterBankScraper';

export class ScraperService {
    static getScraper(slug: string, config: ScraperConfig): BankScraper {
        switch (slug.toLowerCase()) {
            case 'bom':
                return new BomScraper(config);
            case 'greater':
                return new GreaterBankScraper(config);
            // Future: case 'anz': return new AnzScraper(config);
            default:
                throw new Error(`Scraper ${slug} not implemented in Node.js yet`);
        }
    }
}
