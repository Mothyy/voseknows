import { query } from "../db";

export interface RuleCondition {
    match_type: 'contains' | 'exact' | 'starts_with' | 'regex';
    match_value: string;
}

export interface Rule {
    id: string;
    user_id: string;
    name: string;
    priority: number;
    match_type?: string; // Deprecated
    match_value?: string; // Deprecated
    conditions: RuleCondition[];
    category_id: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export class RuleService {
    async getRules(userId: string): Promise<Rule[]> {
        const sql = `SELECT * FROM transaction_rules WHERE user_id = $1 ORDER BY priority ASC, created_at DESC`;
        const { rows } = await query(sql, [userId]);
        // Parse conditions if string (pg might do it automatically for JSONB, but usually yes)
        // Ensure legacy rows work by filling conditions if empty? 
        // Migration handled it, but let's be safe.
        return rows.map(row => ({
            ...row,
            conditions: row.conditions || (row.match_value ? [{ match_type: row.match_type, match_value: row.match_value }] : [])
        }));
    }

    async createRule(userId: string, data: Partial<Rule>): Promise<Rule> {
        // Ensure conditions exist
        const conditions = data.conditions && data.conditions.length > 0
            ? JSON.stringify(data.conditions)
            : JSON.stringify([{ match_type: data.match_type || 'contains', match_value: data.match_value || '' }]);

        const sql = `
            INSERT INTO transaction_rules (user_id, name, priority, conditions, category_id, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const { rows } = await query(sql, [
            userId,
            data.name,
            data.priority || 0,
            conditions,
            data.category_id,
            data.is_active ?? true
        ]);
        return rows[0];
    }

    async updateRule(userId: string, ruleId: string, data: Partial<Rule>): Promise<Rule> {
        const conditions = data.conditions ? JSON.stringify(data.conditions) : null;

        const sql = `
            UPDATE transaction_rules 
            SET name = COALESCE($3, name),
                priority = COALESCE($4, priority),
                conditions = COALESCE($5, conditions),
                category_id = COALESCE($6, category_id),
                is_active = COALESCE($7, is_active),
                updated_at = NOW()
            WHERE id = $2 AND user_id = $1
            RETURNING *
        `;
        const { rows } = await query(sql, [
            userId, ruleId,
            data.name, data.priority, conditions, data.category_id, data.is_active
        ]);
        return rows[0];
    }

    async deleteRule(userId: string, ruleId: string): Promise<void> {
        await query('DELETE FROM transaction_rules WHERE id = $1 AND user_id = $2', [ruleId, userId]);
    }
}
