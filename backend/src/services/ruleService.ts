import { query } from "../db";

export interface Rule {
    id: string;
    user_id: string;
    name: string;
    priority: number;
    match_type: 'contains' | 'exact' | 'starts_with' | 'regex';
    match_value: string;
    category_id: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export class RuleService {
    async getRules(userId: string): Promise<Rule[]> {
        const sql = `SELECT * FROM transaction_rules WHERE user_id = $1 ORDER BY priority ASC, created_at DESC`;
        const { rows } = await query(sql, [userId]);
        return rows;
    }

    async createRule(userId: string, data: Partial<Rule>): Promise<Rule> {
        const sql = `
            INSERT INTO transaction_rules (user_id, name, priority, match_type, match_value, category_id, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const { rows } = await query(sql, [
            userId,
            data.name,
            data.priority || 0,
            data.match_type || 'contains',
            data.match_value,
            data.category_id,
            data.is_active ?? true
        ]);
        return rows[0];
    }

    async updateRule(userId: string, ruleId: string, data: Partial<Rule>): Promise<Rule> {
        const sql = `
            UPDATE transaction_rules 
            SET name = COALESCE($3, name),
                priority = COALESCE($4, priority),
                match_type = COALESCE($5, match_type),
                match_value = COALESCE($6, match_value),
                category_id = COALESCE($7, category_id),
                is_active = COALESCE($8, is_active),
                updated_at = NOW()
            WHERE id = $2 AND user_id = $1
            RETURNING *
        `;
        const { rows } = await query(sql, [
            userId, ruleId,
            data.name, data.priority, data.match_type, data.match_value, data.category_id, data.is_active
        ]);
        return rows[0];
    }

    async deleteRule(userId: string, ruleId: string): Promise<void> {
        await query('DELETE FROM transaction_rules WHERE id = $1 AND user_id = $2', [ruleId, userId]);
    }
}
