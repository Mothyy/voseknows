import { query } from '../db';
import axios from 'axios';
import { RuleService } from './ruleService';

interface Category {
    id: string;
    name: string;
}

interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string;
}

export class ClassificationService {
    private ruleService = new RuleService();

    /**
     * Classifies uncategorized transactions using Rules FIRST, then LLM.
     * @param apiKey The API Key for the LLM Provider (optional if only running rules?) 
     *               Currently required by Route, but logic handles missing key gracefully.
     * @param baseUrl The Base URL
     * @param model The Model ID
     * @param userId The User ID to scope transactions and rules
     */
    async classifyUncategorized(apiKey: string, baseUrl: string = 'https://api.openai.com/v1', model: string = 'gpt-3.5-turbo', userId: string, onlyRules: boolean = false) {
        if (!userId) throw new Error("User ID is required");

        // 1. Fetch Categories
        const catResult = await query('SELECT id, name FROM categories WHERE user_id = $1', [userId]);
        const categories = catResult.rows;
        if (categories.length === 0) return { message: "No categories found." };

        // 2. Fetch Uncategorized Transactions
        const txResult = await query('SELECT * FROM transactions WHERE category_id IS NULL AND is_transfer = false AND account_id IN (SELECT id FROM accounts WHERE user_id = $1) LIMIT 100', [userId]);
        const transactions: Transaction[] = txResult.rows;

        if (transactions.length === 0) return { message: "No uncategorized transactions found." };

        console.log(`Processing ${transactions.length} transactions for User ${userId}...`);

        // 3. Apply Rules
        const rules = await this.ruleService.getRules(userId);
        const activeRules = rules.filter(r => r.is_active);

        let ruleMatches = 0;
        const llmCandidates: Transaction[] = [];

        for (const tx of transactions) {
            let matchedRule = null;
            // Find first matching rule (Rules are ordered by priority)
            for (const rule of activeRules) {
                if (this.matchRule(tx.description, rule)) {
                    matchedRule = rule;
                    break;
                }
            }

            if (matchedRule) {
                // Apply Rule
                await query('UPDATE transactions SET category_id = $1 WHERE id = $2', [matchedRule.category_id, tx.id]);
                ruleMatches++;
            } else {
                llmCandidates.push(tx);
            }
        }

        const message = `Classified ${ruleMatches} transactions via Rules.`;

        if (onlyRules) {
            return {
                classified_rules: ruleMatches,
                classified_ai: 0,
                message: `${message} AI skipped (Requested).`
            };
        }

        // 4. LLM Classification
        // If we have no candidates or no API key, stop here.
        if (llmCandidates.length === 0) {
            return {
                classified_rules: ruleMatches,
                classified_ai: 0,
                message: `${message} No remaining transactions for AI.`
            };
        }

        if (!apiKey) {
            return {
                classified_rules: ruleMatches,
                classified_ai: 0,
                message: `${message} AI skipped (Missing API Key).`
            };
        }

        // Limit to 50 for LLM to avoid context window issues
        const batch = llmCandidates.slice(0, 50);
        console.log(`Sending ${batch.length} transactions to LLM...`);

        // Log logic from previous implementation...
        const categoriesList = categories.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');
        const transactionsList = batch.map(t =>
            `TxID: ${t.id} | Desc: "${t.description}" | Amt: ${t.amount} | Date: ${t.date}`
        ).join('\n');

        const systemPrompt = `You are an expert financial classifier. 
Your task is to assign the most appropriate Category ID to each Transaction based on its description and amount.
Return strictly a JSON object with a single key "classifications" containing an array of objects.
Each object must have "transaction_id" and "category_id".
If a transaction cannot be confidently classified, omit it or set category_id to null.
Do not invent new categories. Use ONLY the provided IDs.`;

        const userPrompt = `
Categories:
${categoriesList}

Transactions:
${transactionsList}

Classify these transactions. JSON Output:
`;

        try {
            const cleanUrl = baseUrl.replace(/\/$/, '');
            const payload: any = {
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.1,
            };

            if (model.includes('gpt') || model.includes('json')) {
                payload.response_format = { type: "json_object" };
            }

            const response = await axios.post(`${cleanUrl}/chat/completions`, payload, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const responseContent = response.data.choices[0].message.content;
            console.log("[DEBUG] LLM Response Status:", response.status);
            console.log("[DEBUG] LLM Raw Content Preview:", responseContent.substring(0, 1000));

            let parsed;
            try {
                parsed = JSON.parse(responseContent);
            } catch (e) {
                const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
                else throw new Error("Failed to parse JSON from LLM response");
            }

            const classifications = parsed.classifications || parsed;
            if (!Array.isArray(classifications)) throw new Error("Invalid response format");

            let llmMatches = 0;
            for (const item of classifications) {
                if (item.transaction_id && item.category_id) {
                    // Try to find by ID first
                    let validCat = categories.find(c => c.id === item.category_id);

                    // Fallback: Try to find by Name (case-insensitive) if ID match fails
                    // This handles models that return names like "Groceries" instead of UUIDs
                    if (!validCat) {
                        validCat = categories.find(c => c.name.toLowerCase() === String(item.category_id).toLowerCase());
                    }

                    if (validCat) {
                        await query(
                            'UPDATE transactions SET category_id = $1 WHERE id = $2',
                            [validCat.id, item.transaction_id]
                        );
                        llmMatches++;
                    }
                }
            }

            return {
                classified_rules: ruleMatches,
                classified_ai: llmMatches,
                classified_total: ruleMatches + llmMatches,
                total_processed: transactions.length, // Checked 100
                message: `Classified ${ruleMatches} via Rules, ${llmMatches} via AI.`
            };

        } catch (error: any) {
            console.error("LLM Classification Error:", error.response?.data || error.message);
            // Return what we achieved with rules at least
            return {
                classified_rules: ruleMatches,
                classified_ai: 0,
                message: `Classified ${ruleMatches} via Rules. AI Failed: ${error.message}`
            };
        }
    }

    /**
     * Suggests rules based on distinct descriptions and leaf categories.
     * Process ALL descriptions in batches to provide comprehensive suggestions.
     */
    async suggestRules(apiKey: string, baseUrl: string = 'https://api.openai.com/v1', model: string = 'gpt-3.5-turbo', userId: string) {
        if (!userId) throw new Error("User ID is required");

        // 1. Fetch Leaf Categories
        const catResult = await query('SELECT id, name, parent_id FROM categories WHERE user_id = $1', [userId]);
        const allCats = catResult.rows;

        const parentIds = new Set(allCats.map(c => c.parent_id).filter(id => id));
        const leafCats = allCats.filter(c => !parentIds.has(c.id));

        if (leafCats.length === 0) return { message: "No categories found." };

        // 2. Fetch All Distinct Descriptions
        const descResult = await query(`
            SELECT t.description, COUNT(*) as cnt
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.category_id IS NULL AND t.is_transfer = false AND a.user_id = $1
            GROUP BY t.description
            ORDER BY cnt DESC
            LIMIT 1000
        `, [userId]);

        let descriptions = descResult.rows.map(r => r.description);

        if (descriptions.length === 0) return { message: "No uncategorized transaction descriptions found." };

        // Filter out descriptions covered by rules
        const existingRules = await this.ruleService.getRules(userId);
        const activeRules = existingRules.filter(r => r.is_active);

        descriptions = descriptions.filter(desc => {
            return !activeRules.some(rule => this.matchRule(desc, rule));
        });

        if (descriptions.length === 0) return { message: "All common transactions are already covered by existing rules." };

        console.log(`Generating rules for ${descriptions.length} descriptions in batches...`);

        if (!apiKey) throw new Error("API Key is required for Rule Suggestion");

        // 3. Process in Batches
        const BATCH_SIZE = 50;
        const accumulatedRules: any[] = [];
        const categoriesList = leafCats.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');

        const systemPrompt = `You are an expert financial rule generator.
Create automation rules to categorize transaction descriptions.
GROUP similar descriptions into a SINGLE rule with multiple match conditions.
Example: Rule "Groceries" -> Conditions ["Woolworths", "Coles", "Aldi"].
Use "contains" for partial matches.

Output JSON: { "rules": [ { "name": "Groceries", "category_id": "UUID", "conditions": [ { "match_value": "Woolworths", "match_type": "contains" } ] } ] }
Use ONLY provided Categories.`;

        for (let i = 0; i < descriptions.length; i += BATCH_SIZE) {
            const batch = descriptions.slice(i, i + BATCH_SIZE);
            const descriptionsList = batch.map(d => `- ${d}`).join('\n');

            const userPrompt = `
Leaf Categories:
${categoriesList}

Uncategorized Descriptions:
${descriptionsList}

Generate Grouped Rules JSON:`;

            try {
                const cleanUrl = baseUrl.replace(/\/$/, '');
                const payload: any = {
                    model: model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                };

                const response = await axios.post(`${cleanUrl}/chat/completions`, payload, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });

                const content = response.data.choices[0].message.content;
                const parsed = JSON.parse(content);
                if (parsed.rules && Array.isArray(parsed.rules)) {
                    // Normalize keys immediately
                    const normalized = parsed.rules.map((r: any) => ({
                        ...r,
                        conditions: (r.conditions || []).map((c: any) => ({
                            match_type: c.match_type || c.type || 'contains',
                            match_value: c.match_value || c.value || ''
                        }))
                    }));
                    accumulatedRules.push(...normalized);
                }

            } catch (e) {
                console.error(`Batch ${i} failed`, e);
            }
        }

        // 4. Merge and Deduplicate Rules
        // If multiple batches produced "Groceries", merge their conditions
        const ruleMap = new Map<string, any>();

        for (const rule of accumulatedRules) {
            // Validate category
            const cat = leafCats.find(c => c.id === rule.category_id);
            if (!cat) continue;

            rule.category_name = cat.name;

            if (ruleMap.has(rule.name)) {
                // Merge conditions
                const existing = ruleMap.get(rule.name);
                // Ensure conditions array exists
                const newConds = rule.conditions || [];
                const existingConds = existing.conditions || [];

                // Add unique conditions
                for (const c of newConds) {
                    if (!existingConds.some((ex: any) => ex.match_value === c.match_value)) {
                        existingConds.push(c);
                    }
                }
            } else {
                ruleMap.set(rule.name, rule);
            }
        }

        return { rules: Array.from(ruleMap.values()) };
    }

    private matchRule(description: string, rule: any): boolean {
        // Handle legacy single condition vs new array
        const conditions = rule.conditions && rule.conditions.length > 0
            ? rule.conditions
            : (rule.match_value ? [{ match_type: rule.match_type || 'contains', match_value: rule.match_value }] : []);

        for (const cond of conditions) {
            if (this.matchCondition(description, cond)) return true;
        }
        return false;
    }

    private matchCondition(description: string, cond: any): boolean {
        const desc = description.toLowerCase();
        const val = (cond.match_value || cond.value || '').toLowerCase(); // AI might return 'value' or 'match_value'

        try {
            switch (cond.match_type || cond.type) {
                case 'exact': return desc === val;
                case 'starts_with': return desc.startsWith(val);
                case 'regex': return new RegExp(val, 'i').test(description);
                case 'contains':
                default:
                    return desc.includes(val);
            }
        } catch (e) {
            return false;
        }
    }
}
