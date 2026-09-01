import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Trash2, GripVertical, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PrizeDistribution } from '../../../shared/types/types';
import { formatCurrency } from '../../../shared/utils/utils';

interface PrizeDistributionInputProps {
    prizes: PrizeDistribution[];
    onChange: (prizes: PrizeDistribution[]) => void;
    currency: string;
    onCurrencyChange: (currency: string) => void;
    totalPrizePool: number;
}

const CURRENCIES = [
    { code: 'NPR', symbol: 'Rs' },
    { code: 'INR', symbol: '₹' },
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' }
];

export default function PrizeDistributionInput({
    prizes,
    onChange,
    currency,
    onCurrencyChange,
    totalPrizePool
}: PrizeDistributionInputProps) {
    const [error, setError] = useState<string | null>(null);

    const currentTotal = prizes.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const isOverBudget = totalPrizePool > 0 && currentTotal > totalPrizePool;

    useEffect(() => {
        validatePrizes(prizes);
    }, [prizes, totalPrizePool]);

    const validatePrizes = (currentPrizes: PrizeDistribution[]) => {
        if (currentPrizes.some(p => p.amount <= 0)) {
            setError("All prize amounts must be greater than 0");
            return false;
        }
        if (currentPrizes.some(p => !p.label.trim())) {
            setError("All prizes must have a label");
            return false;
        }
        setError(null);
        return true;
    };

    const handleAddPrize = () => {
        const newRank = prizes.length + 1;
        const newPrize: PrizeDistribution = {
            id: `prize-${Date.now()}`,
            rank: newRank,
            label: `${newRank}${getOrdinalSuffix(newRank)}`,
            amount: 0
        };
        onChange([...prizes, newPrize]);
    };

    const handleRemovePrize = (id: string) => {
        const newPrizes = prizes.filter(p => p.id !== id).map((p, index) => ({
            ...p,
            rank: index + 1 // Re-rank after removal
        }));
        onChange(newPrizes);
    };

    const handleUpdatePrize = (id: string, field: keyof PrizeDistribution, value: any) => {
        const newPrizes = prizes.map(p => {
            if (p.id === id) {
                return { ...p, [field]: value };
            }
            return p;
        });
        onChange(newPrizes);
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(prizes);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Update ranks based on new order
        const reRankedItems = items.map((item, index) => ({
            ...item,
            rank: index + 1
        }));

        onChange(reRankedItems);
    };

    const applyTemplate = (type: 'top3' | 'top5' | 'equal') => {
        if (totalPrizePool <= 0) {
            setError("Please set a total prize pool first to use templates");
            return;
        }

        let newPrizes: PrizeDistribution[] = [];
        if (type === 'top3') {
            newPrizes = [
                { id: `prize-${Date.now()}-1`, rank: 1, label: '1st', amount: Math.floor(totalPrizePool * 0.5) },
                { id: `prize-${Date.now()}-2`, rank: 2, label: '2nd', amount: Math.floor(totalPrizePool * 0.3) },
                { id: `prize-${Date.now()}-3`, rank: 3, label: '3rd', amount: totalPrizePool - Math.floor(totalPrizePool * 0.5) - Math.floor(totalPrizePool * 0.3) }
            ];
        } else if (type === 'top5') {
            newPrizes = [
                { id: `prize-${Date.now()}-1`, rank: 1, label: '1st', amount: Math.floor(totalPrizePool * 0.4) },
                { id: `prize-${Date.now()}-2`, rank: 2, label: '2nd', amount: Math.floor(totalPrizePool * 0.25) },
                { id: `prize-${Date.now()}-3`, rank: 3, label: '3rd', amount: Math.floor(totalPrizePool * 0.15) },
                { id: `prize-${Date.now()}-4`, rank: 4, label: '4th', amount: Math.floor(totalPrizePool * 0.1) },
                { id: `prize-${Date.now()}-5`, rank: 5, label: '5th', amount: totalPrizePool - Math.floor(totalPrizePool * 0.4) - Math.floor(totalPrizePool * 0.25) - Math.floor(totalPrizePool * 0.15) - Math.floor(totalPrizePool * 0.1) }
            ];
        } else if (type === 'equal') {
            const count = prizes.length > 0 ? prizes.length : 3;
            const amountPerPerson = Math.floor(totalPrizePool / count);
            newPrizes = Array.from({ length: count }).map((_, i) => ({
                id: `prize-${Date.now()}-${i}`,
                rank: i + 1,
                label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
                amount: i === count - 1 ? totalPrizePool - (amountPerPerson * (count - 1)) : amountPerPerson
            }));
        }
        onChange(newPrizes);
    };

    const getOrdinalSuffix = (i: number) => {
        const j = i % 10, k = i % 100;
        if (j == 1 && k != 11) return "st";
        if (j == 2 && k != 12) return "nd";
        if (j == 3 && k != 13) return "rd";
        return "th";
    };

    return (
        <div className="space-y-4 bg-dark-800 p-4 rounded-xl border border-dark-700">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-200">Prize Distribution</h3>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Currency:</label>
                    <select
                        value={currency}
                        onChange={(e) => onCurrencyChange(e.target.value)}
                        className="bg-dark-700 border border-dark-600 text-white text-xs rounded px-2 py-1 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    >
                        {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Templates */}
            <div className="flex flex-wrap gap-2 mb-4">
                <button type="button" onClick={() => applyTemplate('top3')} className="text-xs bg-dark-700 hover:bg-dark-600 text-gray-300 px-3 py-1.5 rounded-md transition-colors">Top 3 Split</button>
                <button type="button" onClick={() => applyTemplate('top5')} className="text-xs bg-dark-700 hover:bg-dark-600 text-gray-300 px-3 py-1.5 rounded-md transition-colors">Top 5 Split</button>
                <button type="button" onClick={() => applyTemplate('equal')} className="text-xs bg-dark-700 hover:bg-dark-600 text-gray-300 px-3 py-1.5 rounded-md transition-colors">Equal Split</button>
            </div>

            {/* Drag and Drop List */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="prize-list">
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                            {prizes.map((prize, index) => (
                                // @ts-ignore
                                <Draggable key={prize.id} draggableId={prize.id} index={index}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={`flex items-center gap-3 bg-dark-700 p-2 rounded-lg border ${snapshot.isDragging ? 'border-brand-500 shadow-lg shadow-brand-500/20' : 'border-dark-600'}`}
                                        >
                                            <div {...provided.dragHandleProps} className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing p-1">
                                                <GripVertical size={16} />
                                            </div>
                                            
                                            <div className="w-12 text-center font-mono text-xs text-gray-400 bg-dark-800 py-1.5 rounded">
                                                #{prize.rank}
                                            </div>

                                            <input
                                                type="text"
                                                value={prize.label}
                                                onChange={(e) => handleUpdatePrize(prize.id, 'label', e.target.value)}
                                                placeholder="Label (e.g. 1st, MVP)"
                                                className="flex-1 bg-dark-800 border border-dark-600 rounded px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                            />

                                            <div className="relative w-32">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                                                    {CURRENCIES.find(c => c.code === currency)?.symbol || currency}
                                                </span>
                                                <input
                                                    type="number"
                                                    value={prize.amount || ''}
                                                    onChange={(e) => handleUpdatePrize(prize.id, 'amount', Number(e.target.value))}
                                                    placeholder="Amount"
                                                    min="0"
                                                    className="w-full bg-dark-800 border border-dark-600 rounded pl-8 pr-3 py-1.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleRemovePrize(prize.id)}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-1.5 rounded transition-colors"
                                            >
                                                <Trash2 size={16} />
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

            <button
                type="button"
                onClick={handleAddPrize}
                className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-dark-600 rounded-lg text-sm text-gray-400 hover:text-white hover:border-dark-500 hover:bg-dark-700/50 transition-colors"
            >
                <Plus size={16} />
                Add Prize
            </button>

            {/* Summary & Validation */}
            <div className="pt-4 border-t border-dark-700 flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Total Distributed:</span>
                    <span className={`font-mono font-bold ${isOverBudget ? 'text-red-400' : 'text-brand-400'}`}>
                        {formatCurrency(currentTotal, (CURRENCIES.find(c => c.code === currency)?.symbol || currency) + ' ')}
                        {totalPrizePool > 0 && ` / ${formatCurrency(totalPrizePool, '')}`}
                    </span>
                </div>
                
                {isOverBudget && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 p-2 rounded">
                        <AlertCircle size={14} />
                        Distributed amount exceeds total prize pool!
                    </div>
                )}
                
                {error && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 p-2 rounded">
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}

                {!isOverBudget && !error && currentTotal > 0 && currentTotal === totalPrizePool && (
                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 p-2 rounded">
                        <CheckCircle2 size={14} />
                        Perfectly distributed!
                    </div>
                )}
            </div>
        </div>
    );
}
