import React, { useState } from 'react';
import {Users, Search, Trash, Edit, CheckCircle} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const UsersTab: React.FC<AdminPanelTabProps> = (props) => {
    const { formatCurrency, handleSuspendOrg, handleUpdateUserRole, searchQuery, setSearchQuery, users, setSelectedUser } = props;
    const [processingId, setProcessingId] = useState<string | null>(null);
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Users className="text-brand-500" /> Manage Users
                        </h2>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input 
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-brand-500 focus-visible:outline-none"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="text-[10px] text-gray-500 uppercase font-black tracking-widest border-b border-gray-800">
                                    <th className="px-4 py-4">User</th>
                                    <th className="px-4 py-4">Role</th>
                                    <th className="px-4 py-4">Balance</th>
                                    <th className="px-4 py-4">Status</th>
                                    <th className="px-4 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {users
                                    .filter(u => 
                                        (u.username || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                                        (u.email || '').toLowerCase().includes((searchQuery || '').toLowerCase())
                                    )
                                    .map(u => (
                                    <tr key={u.uid} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center border border-brand-500/30">
                                                    <Users className="text-brand-500 w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white">{u.username || 'Unnamed User'}</div>
                                                    <div className="text-[10px] text-gray-500">{u.email || 'No email'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <select 
                                                value={u.role || 'player'}
                                                onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as any)}
                                                className="bg-dark border border-gray-700 rounded-lg px-2 py-2 text-xs text-white focus-visible:outline-none focus:border-brand-500"
                                            >
                                                <option value="player">Player</option>
                                                <option value="organizer">Organizer</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm font-mono font-bold text-white">{formatCurrency(u.balance || 0)}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${u.isBanned ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                                                {u.isBanned ? 'Banned' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button type="button" 
                                                    onClick={() => setSelectedUser(u)}
                                                    className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white rounded-lg transition-colors"
                                                    title="Manage Balance & Role"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button type="button" 
                                                    onClick={() => handleSuspendOrg(u.uid, !u.isBanned)}
                                                    className={`p-2.5 rounded-lg border transition-colors ${
                                                        u.isBanned 
                                                            ? 'bg-green-600/20 text-green-400 border-green-500/30 hover:bg-green-600 hover:text-white' 
                                                            : 'bg-red-600/20 text-red-400 border-red-500/30 hover:bg-red-600 hover:text-white'
                                                    }`}
                                                >
                                                    {u.isBanned ? <CheckCircle className="w-3.5 h-3.5" /> : <Trash className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-500 text-sm">
                                            No registered users found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {users.filter(u => 
                            (u.username || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                            (u.email || '').toLowerCase().includes((searchQuery || '').toLowerCase())
                        ).length === 0 && (
                            <div className="py-12 text-center">
                                <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                                <p className="text-sm text-gray-500 font-bold">No users found.</p>
                            </div>
                        )}
                    </div>
                </div>
    );
};
