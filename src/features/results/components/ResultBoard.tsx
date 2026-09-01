import { Trophy } from 'lucide-react';
import { ManualResult, ResultTemplateConfig } from '../../../shared/types/types';

interface ResultBoardProps {
    results: ManualResult[];
    config: ResultTemplateConfig;
}

export default function ResultBoard({ results, config }: ResultBoardProps) {
    const sortedResults = [...results].sort((a, b) => a.rank - b.rank);

    if (results.length === 0) {
        return <div className="text-center text-gray-500 py-20 font-bold">No results available yet.</div>;
    }

    if (config.template === 'classic') {
        return (
            <div className="bg-dark-900 rounded-2xl border border-gray-800 overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                    <thead className="bg-dark-800 border-b border-gray-800">
                        <tr>
                            {config.showFields.rank && <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-20 text-center">Rank</th>}
                            {config.showFields.team && <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest">Team / Player</th>}
                            {config.showFields.score && <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest text-right">Score</th>}
                            {config.showFields.status && <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest text-right">Status</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {sortedResults.map((res, i) => (
                            <tr key={res.id} className="hover:bg-white/5 transition-colors">
                                {config.showFields.rank && (
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${i === 0 ? 'bg-yellow-500/20 text-yellow-500' : i === 1 ? 'bg-gray-300/20 text-gray-300' : i === 2 ? 'bg-amber-600/20 text-amber-500' : 'bg-dark text-gray-400'}`}>
                                            {res.rank}
                                        </span>
                                    </td>
                                )}
                                {config.showFields.team && <td className="p-4 font-bold text-white">{res.team}</td>}
                                {config.showFields.score && <td className="p-4 font-black text-brand-400 text-right">{res.score}</td>}
                                {config.showFields.status && (
                                    <td className="p-4 text-right">
                                        <span className={`text-xs font-black uppercase px-2 py-1 rounded-md ${res.status === 'Winner' ? 'bg-green-500/20 text-green-500' : res.status === 'Eliminated' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                            {res.status}
                                        </span>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (config.template === 'esports') {
        return (
            <div className="space-y-3">
                {sortedResults.map((res, i) => (
                    <div 
                        key={res.id} 
                        className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-dark-800 to-dark-900 p-1 flex items-center pr-6"
                        style={{ borderColor: i === 0 ? config.theme.primaryColor : undefined }}
                    >
                        {i === 0 && (
                            <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(90deg, ${config.theme.primaryColor}, transparent)` }} />
                        )}
                        <div className="relative z-10 flex items-center gap-4 w-full">
                            {config.showFields.rank && (
                                <div className="w-16 h-14 flex items-center justify-center bg-black/50 rounded-lg font-black text-2xl italic" style={{ color: i === 0 ? config.theme.primaryColor : '#fff' }}>
                                    #{res.rank}
                                </div>
                            )}
                            {config.showFields.team && (
                                <div className="flex-1 font-black text-xl text-white uppercase tracking-wider italic">
                                    {res.team}
                                </div>
                            )}
                            {config.showFields.score && (
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">PTS</div>
                                    <div className="font-black text-2xl" style={{ color: config.theme.primaryColor }}>{res.score}</div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (config.template === 'highlight') {
        const winner = sortedResults[0];
        const others = sortedResults.slice(1);
        return (
            <div className="space-y-6">
                {winner && (
                    <div className="relative rounded-3xl overflow-hidden border-2" style={{ borderColor: config.theme.primaryColor }}>
                        <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at center, ${config.theme.primaryColor}, transparent)` }} />
                        <div className="relative z-10 p-10 text-center">
                            <Trophy className="w-16 h-16 mx-auto mb-4" style={{ color: config.theme.primaryColor }} />
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">{winner.team}</h2>
                            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: config.theme.primaryColor }}>CHAMPIONS • {winner.score} PTS</p>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {others.map(res => (
                        <div key={res.id} className="bg-dark-800 p-4 rounded-2xl border border-gray-800 flex justify-between items-center">
                            <div>
                                <div className="text-xs text-gray-500 font-black uppercase">Rank {res.rank}</div>
                                <div className="text-white font-bold text-lg">{res.team}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-brand-400 font-black text-xl">{res.score}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (config.template === 'compact') {
        return (
            <div className="space-y-2">
                {sortedResults.map((res, i) => (
                    <div key={res.id} className="bg-surface p-3 rounded-xl border border-gray-800 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {config.showFields.rank && (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-dark text-gray-400'}`}>
                                    {res.rank}
                                </div>
                            )}
                            {config.showFields.team && <div className="font-bold text-white">{res.team}</div>}
                        </div>
                        <div className="flex items-center gap-3">
                            {config.showFields.status && (
                                <div className="text-[10px] uppercase font-black text-gray-500">{res.status}</div>
                            )}
                            {config.showFields.score && (
                                <div className="font-black text-lg" style={{ color: config.theme.primaryColor }}>{res.score}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Default fallback or 'custom'
    return (
        <div className="bg-dark-900 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-white font-black mb-4 uppercase tracking-widest text-sm">Results</h3>
            <div className="space-y-2">
                {sortedResults.map((res) => (
                    <div key={res.id} className="flex justify-between p-3 border-b border-gray-800 last:border-0 hover:bg-white/5 transition-colors">
                        <div className="flex gap-4">
                            {config.showFields.rank && <span className="font-mono text-gray-500 w-6">#{res.rank}</span>}
                            {config.showFields.team && <span className="text-white font-bold">{res.team}</span>}
                        </div>
                        <div className="flex gap-4 text-right">
                            {config.showFields.score && <span style={{ color: config.theme.primaryColor }} className="font-mono font-bold">{res.score} pts</span>}
                            {config.showFields.status && <span className="text-xs uppercase bg-dark-800 px-2 py-1 rounded text-gray-400">{res.status}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
