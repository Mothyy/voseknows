import React, { useState, useEffect } from 'react';
import apiClient from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CategorySelector } from '@/components/category-selector';
import { PlusCircle, Trash2, Edit2, CheckCircle2, XCircle, Zap, Play } from 'lucide-react';
import { Category } from '@/pages/Categories';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Rule {
    id: string;
    name: string;
    priority: number;
    match_type: string;
    match_value: string;
    category_id: string;
    is_active: boolean;
    category_name?: string; // Optional for display
}

const RulesPage = () => {
    const [rules, setRules] = useState<Rule[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Rule | null>(null);
    const [runningRules, setRunningRules] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        priority: 0,
        match_type: 'contains',
        match_value: '',
        category_id: '',
        is_active: true
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rulesRes, catsRes] = await Promise.all([
                apiClient.get('/rules'),
                apiClient.get('/categories')
            ]);

            // Map category names
            const cats = catsRes.data;
            setCategories(cats);

            const mappedRules = rulesRes.data.map((r: any) => ({
                ...r,
                category_name: cats.find((c: any) => c.id === r.category_id)?.name || 'Unknown'
            }));

            setRules(mappedRules);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (editingRule) {
                await apiClient.put(`/rules/${editingRule.id}`, formData);
            } else {
                await apiClient.post('/rules', formData);
            }
            loadData();
            setIsDialogOpen(false);
            setEditingRule(null);
            resetForm();
        } catch (err) {
            console.error("Failed to save", err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this rule?")) return;
        try {
            await apiClient.delete(`/rules/${id}`);
            loadData();
        } catch (err) { console.error(err); }
    };

    const handleRunRules = async () => {
        setRunningRules(true);
        try {
            const res = await apiClient.post('/classification/auto-classify', {});
            const stats = res.data;
            alert(`${stats.message}\nRules Matches: ${stats.classified_rules}\nAI Matches: ${stats.classified_ai || 0}`);
        } catch (err) {
            console.error(err);
            alert("Failed to run rules. See console.");
        } finally {
            setRunningRules(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            priority: 0,
            match_type: 'contains',
            match_value: '',
            category_id: '',
            is_active: true
        });
    };

    const openNewRule = () => {
        setEditingRule(null);
        resetForm();
        setIsDialogOpen(true);
    };

    const openEditRule = (rule: Rule) => {
        setEditingRule(rule);
        setFormData({
            name: rule.name,
            priority: rule.priority,
            match_type: rule.match_type,
            match_value: rule.match_value,
            category_id: rule.category_id,
            is_active: rule.is_active
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Automation Rules</h1>
                    <p className="text-muted-foreground">Manage rules to automatically categorize transactions based on description matches.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleRunRules} variant="secondary" disabled={runningRules}>
                        <Play className="mr-2 h-4 w-4" />
                        {runningRules ? 'Running...' : 'Run Rules Now'}
                    </Button>
                    <Button onClick={openNewRule} className="bg-indigo-600 hover:bg-indigo-700">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Rule
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardContent className="p-0 text-sm">
                    <div className="overflow-auto">
                        <table className="w-full text-left">
                            <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                                <tr>
                                    <th className="p-4 w-20">Priority</th>
                                    <th className="p-4">Rule Name</th>
                                    <th className="p-4">Condition</th>
                                    <th className="p-4">Assigns Category</th>
                                    <th className="p-4 w-24">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="p-4 font-mono text-muted-foreground">{rule.priority}</td>
                                        <td className="p-4 font-medium">{rule.name}</td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold uppercase bg-blue-50 text-blue-700 mr-2 border border-blue-100">
                                                {rule.match_type.replace('_', ' ')}
                                            </span>
                                            <span className="font-mono text-slate-700">{rule.match_value}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-slate-100 px-2 py-1 rounded-full text-xs font-medium border border-slate-200 shadow-sm">
                                                {rule.category_name || rule.category_id}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {rule.is_active ?
                                                <span className="text-emerald-600 flex items-center gap-1 text-xs font-medium"><CheckCircle2 className="h-3 w-3" /> Active</span> :
                                                <span className="text-slate-400 flex items-center gap-1 text-xs font-medium"><XCircle className="h-3 w-3" /> Inactive</span>
                                            }
                                        </td>
                                        <td className="p-4 text-right space-x-1">
                                            <Button variant="ghost" size="sm" onClick={() => openEditRule(rule)} className="h-8 w-8 p-0"><Edit2 className="h-4 w-4 text-slate-500" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)} className="h-8 w-8 p-0 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                        </td>
                                    </tr>
                                ))}
                                {rules.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Zap className="h-8 w-8 text-slate-300" />
                                                <p>No rules found. Create a rule to automate your categorization.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRule ? 'Edit Rule' : 'New Rule'}</DialogTitle>
                        <DialogDescription>Define a condition and an action.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Rule Name</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Woolworths Groceries"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Match Type</Label>
                                <Select value={formData.match_type} onValueChange={v => setFormData({ ...formData, match_type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="contains">Contains</SelectItem>
                                        <SelectItem value="exact">Exact Match</SelectItem>
                                        <SelectItem value="starts_with">Starts With</SelectItem>
                                        <SelectItem value="regex">Regex</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Priority (Lower runs first)</Label>
                                <Input type="number" value={formData.priority} onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Value to Match</Label>
                            <Input
                                value={formData.match_value}
                                onChange={e => setFormData({ ...formData, match_value: e.target.value })}
                                placeholder="Text to search for..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Assign Category</Label>
                            <CategorySelector
                                categories={categories}
                                value={formData.category_id}
                                onChange={(val) => setFormData({ ...formData, category_id: val })}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!formData.name || !formData.match_value || !formData.category_id} className="bg-indigo-600 hover:bg-indigo-700">Save Rule</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RulesPage;
