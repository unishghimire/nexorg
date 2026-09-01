import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Plus, Trash2, Settings, LayoutTemplate, Eye, Trophy, Users, Star, Medal, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ManualResult, ResultTemplateConfig } from '../../../shared/types/types';
import ResultBoard from './ResultBoard';

interface ManualResultManagerProps {
    results: ManualResult[];
    onChange: (results: ManualResult[]) => void;
    templateConfig: ResultTemplateConfig;
    onTemplateChange: (config: ResultTemplateConfig) => void;
    presets?: { id: string; name: string; config: ResultTemplateConfig }[];
    onSavePreset?: (name: string, config: ResultTemplateConfig) => void;
}

const TEMPLATES = [
    { id: 'classic', name: 'Classic Leaderboard', icon: Users },
    { id: 'esports', name: 'Esports Card Style', icon: Trophy },
    { id: 'highlight', name: 'Highlight Winner', icon: Star },
    { id: 'compact', name: 'Mobile Compact', icon: Medal },
];

import { useNotification } from '../../../shared/context/NotificationContext';

export default function ManualResultManager({ results, onChange, templateConfig, onTemplateChange, presets = [], onSavePreset }: ManualResultManagerProps) {
    const { showToast } = useNotification();
    const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'settings'>('edit');
    const [autoRank, setAutoRank] = useState(true);
    const [presetName, setPresetName] = useState('');

    const validateResults = () => {
        const errors: string[] = [];
        const teams = new Set();
        const ranks = new Set();

        results.forEach((res, index) => {
            if (!res.team.trim()) {
                errors.push(`Row ${index + 1}: Team name is required.`);
            } else if (teams.has(res.team.trim().toLowerCase())) {
                errors.push(`Row ${index + 1}: Duplicate team name "${res.team}".`);
            }
            teams.add(res.team.trim().toLowerCase());

            if (ranks.has(res.rank)) {
                errors.push(`Row ${index + 1}: Duplicate rank "${res.rank}".`);
            }
            ranks.add(res.rank);

            if (isNaN(res.score)) {
                errors.push(`Row ${index + 1}: Score must be a number.`);
            }
        });

        return errors;
    };

    const errors = validateResults();

    const handleAddResult = () => {
        const nextRank = results.length + 1;
        onChange([...results, {
            id: `res-${Date.now()}`,
            team: '',
            rank: nextRank,
            score: 0,
            status: 'Qualified'
        }]);
    };

    const handleRemoveResult = (index: number) => {
        const newResults = results.filter((_, i) => i !== index);
        if (autoRank) {
            newResults.forEach((r, i) => r.rank = i + 1);
        }
        onChange(newResults);
    };

    const handleResultChange = (index: number, field: keyof ManualResult, value: any) => {
        const newResults = [...results];
        newResults[index] = { ...newResults[index], [field]: value };
        
        if (field === 'score' && autoRank) {
            // Sort by score descending and update ranks
            newResults.sort((a, b) => b.score - a.score);
            newResults.forEach((r, i) => r.rank = i + 1);
        }
        
        onChange(newResults);
    };

    const onDragEnd = (result: any) => {
        if (!result.destination) return;

        const items = Array.from(results);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        if (autoRank) {
            items.forEach((item, index) => {
                item.rank = index + 1;
            });
        }

        onChange(items);
    };

    const handleBulkPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        const newResults: ManualResult[] = lines.map((line, index) => {
            // Try to parse CSV or TSV (Team, Score, Status)
            const parts = line.split(/[\t,]/).map(p => p.trim());
            return {
                id: `res-${Date.now()}-${index}`,
                team: parts[0] || `Team ${index + 1}`,
                score: parseInt(parts[1]) || 0,
                status: parts[2] || 'Qualified',
                rank: index + 1
            };
        });

        if (autoRank) {
            newResults.sort((a, b) => b.score - a.score);
            newResults.forEach((r, i) => r.rank = i + 1);
        }

        onChange([...results, ...newResults]);
    };

    return (
        <div className="bg-dark rounded-2xl border border-gray-800 overflow-hidden flex flex-col h-[600px]">
            {/* Header Tabs */}
            <div className="flex border-b border-gray-800 bg-dark-900/50 p-2 gap-2">
                <button type="button" 
                    onClick={() => setActiveTab('edit')}
                    className={`flex-1 py-2 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'edit' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <Settings className="w-4 h-4" /> Edit Data
                </button>
                <button type="button" 
                    onClick={() => setActiveTab('preview')}
                    className={`flex-1 py-2 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'preview' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <Eye className="w-4 h-4" /> Preview
                </button>
                <button type="button" 
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 py-2 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'settings' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <LayoutTemplate className="w-4 h-4" /> Templates
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'edit' && (
                        <motion.div 
                            key="edit"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="absolute inset-0 flex flex-col p-4"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-white font-black uppercase tracking-widest">Results Data</h3>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={autoRank} 
                                            onChange={(e) => setAutoRank(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-700 text-brand-500 focus:ring-brand-500 bg-dark"
                                        />
                                        <span className="text-xs text-gray-400 font-bold uppercase">Auto-Rank by Score</span>
                                    </label>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" 
                                        onClick={handleAddResult}
                                        className="bg-brand-600/20 text-brand-500 hover:bg-brand-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Row
                                    </button>
                                </div>
                            </div>

                            <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                                <Settings className="w-5 h-5 text-brand-500 shrink-0" />
                                <p className="text-xs text-gray-400 font-medium">
                                    You can paste data from Excel/Sheets directly here! (Format: Team, Score, Status)
                                </p>
                                <input 
                                    type="text" 
                                    onPaste={handleBulkPaste} 
                                    placeholder="Click here and Ctrl+V to paste bulk data"
                                    className="flex-1 bg-dark border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-brand-500 focus-visible:outline-none"
                                />
                            </div>

                            {errors.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                                    <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">Validation Errors</h4>
                                    <ul className="list-disc list-inside text-xs text-red-400 space-y-1">
                                        {errors.map((err, i) => <li key={i}>{err}</li>)}
                                    </ul>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                <DragDropContext onDragEnd={onDragEnd}>
                                    <Droppable droppableId="results-list">
                                        {(provided) => (
                                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                                {results.map((res, index) => (
                                                    // @ts-ignore
                                                    <Draggable key={res.id} draggableId={res.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`flex items-center gap-3 bg-surface p-3 rounded-xl border transition-colors ${snapshot.isDragging ? 'border-brand-500 shadow-lg shadow-brand-500/20' : 'border-gray-800'}`}
                                                            >
                                                                <div {...provided.dragHandleProps} className="text-gray-600 hover:text-white transition-colors cursor-grab active:cursor-grabbing">
                                                                    <GripVertical className="w-5 h-5" />
                                                                </div>
                                                                
                                                                <div className="w-16">
                                                                    <input 
                                                                        type="number" 
                                                                        value={res.rank}
                                                                        onChange={(e) => handleResultChange(index, 'rank', parseInt(e.target.value) || 0)}
                                                                        disabled={autoRank}
                                                                        className="w-full bg-dark border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-center text-brand-400 font-black disabled:opacity-50 focus-visible:outline-none focus:border-brand-500"
                                                                    />
                                                                </div>

                                                                <div className="flex-1">
                                                                    <input 
                                                                        type="text" 
                                                                        value={res.team}
                                                                        onChange={(e) => handleResultChange(index, 'team', e.target.value)}
                                                                        placeholder="Team / Player Name"
                                                                        className="w-full bg-dark border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold focus-visible:outline-none focus:border-brand-500"
                                                                    />
                                                                </div>

                                                                <div className="w-24">
                                                                    <input 
                                                                        type="number" 
                                                                        value={res.score}
                                                                        onChange={(e) => handleResultChange(index, 'score', parseInt(e.target.value) || 0)}
                                                                        placeholder="Score"
                                                                        className="w-full bg-dark border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold focus-visible:outline-none focus:border-brand-500"
                                                                    />
                                                                </div>

                                                                <div className="w-32">
                                                                    <select 
                                                                        value={res.status}
                                                                        onChange={(e) => handleResultChange(index, 'status', e.target.value)}
                                                                        className="w-full bg-dark border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold focus-visible:outline-none focus:border-brand-500 appearance-none"
                                                                    >
                                                                        <option value="Winner">Winner</option>
                                                                        <option value="Qualified">Qualified</option>
                                                                        <option value="Eliminated">Eliminated</option>
                                                                        <option value="Disqualified">Disqualified</option>
                                                                    </select>
                                                                </div>

                                                                <button type="button" 
                                                                    onClick={() => handleRemoveResult(index)}
                                                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                                {results.length === 0 && (
                                    <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-2xl">
                                        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-400 font-bold">No results added yet.</p>
                                        <button type="button" onClick={handleAddResult} className="mt-4 text-brand-500 font-black uppercase text-xs hover:underline">Add First Row</button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'settings' && (
                        <motion.div 
                            key="settings"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="absolute inset-0 p-4 overflow-y-auto custom-scrollbar"
                        >
                            <h3 className="text-white font-black uppercase tracking-widest mb-6">Display Templates</h3>
                            
                            {presets.length > 0 && (
                                <div className="mb-8">
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Your Saved Presets</h4>
                                    <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                                        {presets.map(preset => (
                                            <button
                                                key={preset.id}
                                                onClick={() => onTemplateChange(preset.config)}
                                                className="bg-dark border border-brand-500/30 hover:border-brand-500 text-brand-400 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors"
                                            >
                                                {preset.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                                {TEMPLATES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => onTemplateChange({ ...templateConfig, template: t.id as any })}
                                        className={`p-4 rounded-2xl border text-left transition-colors flex items-center gap-4 ${templateConfig.template === t.id ? 'bg-brand-600/20 border-brand-500 shadow-[0_0_15px_rgba(var(--brand-primary-rgb),0.2)]' : 'bg-surface border-gray-800 hover:border-gray-600'}`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${templateConfig.template === t.id ? 'bg-brand-500 text-white' : 'bg-dark text-gray-500'}`}>
                                            <t.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className={`font-black ${templateConfig.template === t.id ? 'text-white' : 'text-gray-300'}`}>{t.name}</h4>
                                            <p className="text-xs text-gray-500 font-medium mt-1">Select this style for the final display.</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <h3 className="text-white font-black uppercase tracking-widest mb-4">Customization</h3>
                            <div className="bg-surface p-5 rounded-2xl border border-gray-800 space-y-4">
                                <div>
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Primary Accent Color</label>
                                    <div className="flex gap-3">
                                        {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => onTemplateChange({ ...templateConfig, theme: { ...templateConfig.theme, primaryColor: color } })}
                                                className={`w-8 h-8 rounded-full border-2 transition-colors ${templateConfig.theme.primaryColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                        <input 
                                            type="color" 
                                            value={templateConfig.theme.primaryColor}
                                            onChange={(e) => onTemplateChange({ ...templateConfig, theme: { ...templateConfig.theme, primaryColor: e.target.value } })}
                                            className="w-8 h-8 rounded-full overflow-hidden cursor-pointer border-0 p-0"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Visible Fields</label>
                                    <div className="flex flex-wrap gap-4">
                                        {Object.entries(templateConfig.showFields).map(([field, isVisible]) => (
                                            <label key={field} className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isVisible}
                                                    onChange={(e) => onTemplateChange({ 
                                                        ...templateConfig, 
                                                        showFields: { ...templateConfig.showFields, [field]: e.target.checked } 
                                                    })}
                                                    className="w-4 h-4 rounded border-gray-700 text-brand-500 focus:ring-brand-500 bg-dark"
                                                />
                                                <span className="text-sm text-gray-300 font-bold capitalize">{field}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {onSavePreset && (
                                    <div className="pt-4 border-t border-gray-800">
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Save as Preset</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={presetName}
                                                onChange={(e) => setPresetName(e.target.value)}
                                                placeholder="Preset Name"
                                                className="flex-1 bg-dark border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus-visible:outline-none"
                                            />
                                            <button type="button" 
                                                onClick={() => {
                                                    if (presetName.trim()) {
                                                        onSavePreset(presetName.trim(), templateConfig);
                                                        showToast('Preset saved successfully', 'success');
                                                        setPresetName('');
                                                    }
                                                }}
                                                disabled={!presetName.trim()}
                                                className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                                            >
                                                <Save className="w-4 h-4" /> Save
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'preview' && (
                        <motion.div 
                            key="preview"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="absolute inset-0 p-4 overflow-y-auto custom-scrollbar bg-black"
                        >
                            <ResultBoard results={results} config={templateConfig} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
