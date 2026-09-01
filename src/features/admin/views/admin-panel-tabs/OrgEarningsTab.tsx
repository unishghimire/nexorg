import React, { useState } from 'react';
import {DollarSign} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const OrgEarningsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { formatCurrency, formatDate, handleReleaseEarnings, tournamentEarnings } = props;
    const [releasingId, setReleasingId] = useState<string | null>(null);
    return (
                <div className="bg-card p-6 rounded-2xl border border-slate-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <DollarSign className="text-brand-500" /> Org Earnings
                            </h2>
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 text-gray-400 text-sm uppercase tracking-wider">
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Tournament</th>
                                    <th className="p-4 font-medium">Organizer</th>
                                    <th className="p-4 font-medium">Total Prize</th>
                                    <th className="p-4 font-medium">Org Share</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {tournamentEarnings.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-400">
                                            No earnings records found.
                                        </td>
                                    </tr>
                                ) : (
                                    tournamentEarnings.map(earning => (
                                        <tr key={earning.id} className="hover:bg-surface/20 transition-colors">
                                            <td className="p-4 text-gray-300">
                                                {formatDate ? formatDate(earning.createdAt) : (earning.createdAt?.toDate ? earning.createdAt.toDate().toLocaleDateString() : 'N/A')}
                                            </td>
                                            <td className="p-4 text-white font-medium">
                                                {earning.tournamentName}
                                            </td>
                                            <td className="p-4 text-gray-300">
                                                {earning.orgName}
                                            </td>
                                            <td className="p-4 text-gray-300">
                                                {formatCurrency(earning.prizePoolTotal)}
                                            </td>
                                            <td className="p-4 text-brand-400 font-bold">
                                                {formatCurrency(earning.orgShare)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    earning.status === 'released' ? 'bg-green-500/20 text-green-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {earning.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                {earning.status === 'pending' && (
                                                    <button type="button"
                                                        onClick={async () => { setReleasingId(earning.id); try { await handleReleaseEarnings(earning); } finally { setReleasingId(null); } }}
                                                        disabled={releasingId === earning.id}
                                                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {releasingId === earning.id ? "Releasing..." : "Release"}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
    );
};
