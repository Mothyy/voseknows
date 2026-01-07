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
    async classifyUncategorized(apiKey: string, baseUrl: string = 'https://api.openai.com/v1', model: string = 'gpt-3.5-turbo', userId: string) {
        if (!userId) throw new Error("User ID is required");

        // 1. Fetch Categories (User Scoped)
        const catResult = await query('SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name', [userId]);
        const categories = catResult.rows;

        if (categories.length === 0) return { message: "No categories found for this user." };

        // 2. Fetch Uncategorized Transactions (User Scoped) – Limit 100 to allow room for rules + LLM batch
        const txnResult = await query(`
            SELECT t.id, t.description, t.amount, t.date 
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.category_id IS NULL AND a.user_id = $1
            ORDER BY t.date DESC 
            LIMIT 100
        `, [userId]);

        const transactions = txnResult.rows;
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

        // 4. LLM Classification
        // If we have no candidates or no API key, stop here.
        if (llmCandidates.length === 0) {
            return { classified: ruleMatches, message: `${message} No remaining transactions for AI.` };
        }

        if (!apiKey) {
            return { classified: ruleMatches, message: `${message} AI skipped (Missing API Key).` };
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
                error: `AI Failed: ${error.message}. Rules were applied.`
            };
        }
    }

    private matchRule(description: string, rule: any): boolean {
        const desc = description.toLowerCase();
        const val = rule.match_value.toLowerCase();

        try {
            switch (rule.match_type) {
                case 'exact': return desc === val;
                case 'starts_with': return desc.startsWith(val);
                case 'regex': return new RegExp(rule.match_value, 'i').test(description);
                case 'contains':
                default:
                    return desc.includes(val);
            }
        } catch (e) {
            console.error("Rule match error", e);
            return false;
        }
    }
}
