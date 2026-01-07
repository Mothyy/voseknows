import React, { useState, useEffect } from 'react';
import apiClient from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CategorySelector } from '@/components/category-selector';
import { PlusCircle, Trash2, Edit2, CheckCircle2, XCircle, Zap, Play, X, Plus } from 'lucide-react';
import { Category } from '@/pages/Categories';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';


interface RuleCondition {
    match_type: string;
    match_value: string;
}

interface Rule {
    id: string;
    name: string;
    priority: number;
    conditions: RuleCondition[];
    category_id: string;
    is_active: boolean;
    category_name?: string;
}

const RulesPage = () => {
    const [rules, setRules] = useState<Rule[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Rule | null>(null);
    const [runningRules, setRunningRules] = useState(false);

    // AI Suggestion State
    const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestedRules, setSuggestedRules] = useState<any[]>([]);
    const [selectedSuggestionIndices, setSelectedSuggestionIndices] = useState<Set<number>>(new Set());

    // Form State
    const [formData, setFormData] = useState<{
        name: string;
        priority: number;
        conditions: RuleCondition[];
        category_id: string;
        is_active: boolean;
    }>({
        name: '',
        priority: 0,
        conditions: [{ match_type: 'contains', match_value: '' }],
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

            const cats = catsRes.data;
            setCategories(cats);

            const mappedRules = rulesRes.data.map((r: any) => ({
                ...r,
                category_name: cats.find((c: any) => c.id === r.category_id)?.name || 'Unknown',
                conditions: r.conditions || (r.match_value ? [{ match_type: r.match_type, match_value: r.match_value }] : [])
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
            // Filter empty conditions
            const cleanData = {
                ...formData,
                conditions: formData.conditions.filter(c => c.match_value.trim() !== '')
            };

            if (cleanData.conditions.length === 0) {
                alert("At least one condition is required.");
                return;
            }

            if (editingRule) {
                await apiClient.put(`/rules/${editingRule.id}`, cleanData);
            } else {
                await apiClient.post('/rules', cleanData);
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
            const res = await apiClient.post('/classification/auto-classify', { onlyRules: true });
            const stats = res.data;
            alert(`${stats.message}\nRules Matches: ${stats.classified_rules}\nAI Matches: ${stats.classified_ai || 0}`);
        } catch (err) {
            console.error(err);
            alert("Failed to run rules. See console.");
        } finally {
            setRunningRules(false);
        }
    };

    const handleSuggestRules = async () => {
        setSuggestDialogOpen(true);
        setSuggestLoading(true);
        setSuggestedRules([]);
        try {
            const res = await apiClient.post('/classification/suggest-rules', {});
            setSuggestedRules(res.data.rules || []);
            // Select all by default
            const allIndices = new Set(res.data.rules.map((_: any, i: number) => i));
            setSelectedSuggestionIndices(allIndices);
        } catch (err) {
            console.error(err);
            alert("Failed to generate rules.");
            setSuggestDialogOpen(false);
        } finally {
            setSuggestLoading(false);
        }
    };

    const toggleSuggestion = (index: number) => {
        const newSet = new Set(selectedSuggestionIndices);
        if (newSet.has(index)) newSet.delete(index);
        else newSet.add(index);
        setSelectedSuggestionIndices(newSet);
    };

    const handleCreateSelectedRules = async () => {
        try {
            const rulesToCreate = suggestedRules.filter((_, i) => selectedSuggestionIndices.has(i));
            if (rulesToCreate.length === 0) return;

            await Promise.all(rulesToCreate.map(r => {
                return apiClient.post('/rules', {
                    name: r.name,
                    conditions: r.conditions,
                    category_id: r.category_id,
                    priority: 50,
                    is_active: true
                });
            }));
            setSuggestDialogOpen(false);
            loadData();
            alert(`Created ${rulesToCreate.length} rules.`);
        } catch (err) {
            console.error(err);
            alert("Failed to create some rules.");
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            priority: 0,
            conditions: [{ match_type: 'contains', match_value: '' }],
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
            conditions: rule.conditions.length > 0 ? rule.conditions : [{ match_type: 'contains', match_value: '' }],
            category_id: rule.category_id,
            is_active: rule.is_active
        });
        setIsDialogOpen(true);
    };

    const updateCondition = (index: number, field: keyof RuleCondition, value: string) => {
        const newConditions = [...formData.conditions];
        newConditions[index] = { ...newConditions[index], [field]: value };
        setFormData({ ...formData, conditions: newConditions });
    };

    const addCondition = () => {
        setFormData({
            ...formData,
            conditions: [...formData.conditions, { match_type: 'contains', match_value: '' }]
        });
    };

    const removeCondition = (index: number) => {
        const newConditions = formData.conditions.filter((_, i) => i !== index);
        setFormData({ ...formData, conditions: newConditions });
    };

    const removeSuggestionCondition = (ruleIndex: number, conditionIndex: number) => {
        const newRules = [...suggestedRules];
        const rule = { ...newRules[ruleIndex] };

        // Remove condition
        rule.conditions = rule.conditions.filter((_: any, i: number) => i !== conditionIndex);

        if (rule.conditions.length === 0) {
            // Remove the rule entirely if empty
            newRules.splice(ruleIndex, 1);

            // Adjust selection indices
            const newSelection = new Set<number>();
            selectedSuggestionIndices.forEach(idx => {
                if (idx < ruleIndex) newSelection.add(idx);
                else if (idx > ruleIndex) newSelection.add(idx - 1);
            });
            setSelectedSuggestionIndices(newSelection);
        } else {
            newRules[ruleIndex] = rule;
        }
        setSuggestedRules(newRules);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Automation Rules</h1>
                    <p className="text-muted-foreground">Manage grouped rules to automatically categorize transactions.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSuggestRules} variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                        <Zap className="mr-2 h-4 w-4" /> Suggest with AI
                    </Button>
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
                                    <th className="p-4">Match Conditions</th>
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
                                            <div className="flex flex-wrap gap-1">
                                                {rule.conditions.map((c, i) => (
                                                    <Badge key={i} variant="secondary" className="font-normal text-xs">
                                                        {c.match_type === 'exact' ? '=' : '~'} {c.match_value}
                                                    </Badge>
                                                ))}
                                                {rule.conditions.length === 0 && <span className="text-muted-foreground italic">No conditions</span>}
                                            </div>
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

            {/* Rule Editor Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingRule ? 'Edit Rule' : 'New Rule'}</DialogTitle>
                        <DialogDescription>Define a group of conditions that map to a category.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Rule Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Groceries"
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

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Match Conditions (Any)</Label>
                                <Button size="sm" variant="ghost" onClick={addCondition} className="h-6 text-xs">
                                    <Plus className="h-3 w-3 mr-1" /> Add Condition
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2 bg-slate-50">
                                {formData.conditions.map((condition, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <Select
                                            value={condition.match_type}
                                            onValueChange={v => updateCondition(index, 'match_type', v)}
                                        >
                                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="contains">Contains</SelectItem>
                                                <SelectItem value="exact">Exact</SelectItem>
                                                <SelectItem value="starts_with">Starts With</SelectItem>
                                                <SelectItem value="regex">Regex</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            value={condition.match_value}
                                            onChange={e => updateCondition(index, 'match_value', e.target.value)}
                                            placeholder="Match text..."
                                            className="flex-1"
                                        />
                                        <Button variant="ghost" size="sm" onClick={() => removeCondition(index)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Priority (Lower runs first)</Label>
                                <Input type="number" value={formData.priority} onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!formData.name || !formData.category_id} className="bg-indigo-600 hover:bg-indigo-700">Save Rule</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AI Suggestion Dialog */}
            <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>AI Rule Suggestions</DialogTitle>
                        <DialogDescription>
                            Review suggested rules. Click a badge to remove that condition.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto min-h-[300px]">
                        {suggestLoading ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-4 text-muted-foreground">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                <p>Analyzing all transactions and generating optimized rules...</p>
                                <p className="text-xs text-slate-400">This may take a moment.</p>
                            </div>
                        ) : suggestedRules.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                <p>No suggestions found. Your existing rules might cover everything!</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/50 sticky top-0 z-10 text-muted-foreground font-medium border-b">
                                    <tr>
                                        <th className="p-3 w-10">
                                            <input
                                                type="checkbox"
                                                checked={selectedSuggestionIndices.size === suggestedRules.length}
                                                onChange={() => {
                                                    if (selectedSuggestionIndices.size === suggestedRules.length) setSelectedSuggestionIndices(new Set());
                                                    else setSelectedSuggestionIndices(new Set(suggestedRules.map((_, i) => i)));
                                                }}
                                                className="rounded border-gray-300 text-indigo-600"
                                            />
                                        </th>
                                        <th className="p-3 w-48">Rule Name</th>
                                        <th className="p-3">Matched Descriptions (Conditions)</th>
                                        <th className="p-3 w-40">Category</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {suggestedRules.map((rule, idx) => (
                                        <tr key={idx} className={`hover:bg-slate-50 ${selectedSuggestionIndices.has(idx) ? 'bg-indigo-50/30' : ''}`}>
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSuggestionIndices.has(idx)}
                                                    onChange={() => toggleSuggestion(idx)}
                                                    className="rounded border-gray-300 text-indigo-600"
                                                />
                                            </td>
                                            <td className="p-3 font-medium align-top">
                                                {rule.name}
                                                <div className="text-xs font-normal text-muted-foreground mt-1">
                                                    {rule.reason}
                                                </div>
                                            </td>
                                            <td className="p-3 align-top">
                                                <div className="flex flex-wrap gap-1">
                                                    {rule.conditions && rule.conditions.map((c: any, i: number) => (
                                                        <Badge
                                                            key={i}
                                                            variant="outline"
                                                            className="text-xs bg-white text-slate-700 border-slate-200 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 group transition-colors pr-1"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Prevent row selection
                                                                removeSuggestionCondition(idx, i);
                                                            }}
                                                        >
                                                            {c.value || c.match_value}
                                                            <X className="h-3 w-3 ml-1 text-slate-300 group-hover:text-red-500" />
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-3 align-top">
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                                                    {rule.category_name}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setSuggestDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateSelectedRules} disabled={suggestLoading || selectedSuggestionIndices.size === 0} className="bg-indigo-600 hover:bg-indigo-700">
                            Create {selectedSuggestionIndices.size} Rules
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RulesPage;
