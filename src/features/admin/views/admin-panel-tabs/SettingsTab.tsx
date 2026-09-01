import React from 'react';
import {Users, Settings, Megaphone, AlertTriangle} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const SettingsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { handleSaveSettings, isNoticeActive, maintenanceMode, minWithdrawal, notice, orgFormDescription, setIsNoticeActive, setMaintenanceMode, setMinWithdrawal, setNotice, setOrgFormDescription, setSupportEmail, setSupportPhone, siteSettings, supportEmail, supportPhone, toggleOrgForm } = props;
    return (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-8">
                    <div className="border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Settings className="text-brand-500" /> Site Configuration
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-bold">Manage global application settings and support info.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Financial Settings</h3>
                            <div>
                                <label htmlFor="min-withdrawal" className="text-xs text-gray-500 uppercase font-bold mb-1 block">Minimum Withdrawal Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs.</span>
                                    <input 
                                        type="number" 
                                        value={minWithdrawal}
                                        onChange={e => setMinWithdrawal(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-brand-500 focus-visible:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Support Info</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label htmlFor="support-email" className="text-xs text-gray-500 uppercase font-bold mb-1 block">Support Email</label>
                                    <input 
                                        type="email" 
                                        value={supportEmail}
                                        onChange={e => setSupportEmail(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="support-phone" className="text-xs text-gray-500 uppercase font-bold mb-1 block">Support Phone / WhatsApp</label>
                                    <input 
                                        type="text" 
                                        value={supportPhone}
                                        onChange={e => setSupportPhone(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="col-span-full space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Maintenance</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="text-red-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Maintenance Mode</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={maintenanceMode} onChange={e => setMaintenanceMode(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-red-600"></div>
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">When enabled, the entire website will be disabled for normal users. Only Admins can access the site.</p>
                            </div>

                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">System Notice</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Megaphone className="text-brand-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Display Site-wide Notice</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={isNoticeActive} onChange={e => setIsNoticeActive(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-brand-600"></div>
                                    </label>
                                </div>
                                <textarea 
                                    value={notice}
                                    onChange={e => setNotice(e.target.value)}
                                    className="w-full bg-surface border border-gray-700 rounded-lg p-4 text-white focus:border-brand-500 focus-visible:outline-none h-32"
                                    placeholder="Enter notice message here... (e.g. Scheduled maintenance at 10 PM)"
                                />
                            </div>

                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3 pt-4">Organizer Settings</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="text-brand-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Open Organizer Applications</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={siteSettings?.isOrgFormOpen ?? true} onChange={toggleOrgForm} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-brand-600"></div>
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Toggle whether users can apply to become an organization from the contact page.</p>
                                
                                <div className="pt-4 border-t border-gray-800">
                                    <label htmlFor="organizer-form-desc" className="text-[10px] text-gray-500 uppercase font-black mb-2 block tracking-widest">Organizer Form Description</label>
                                    <textarea 
                                        value={orgFormDescription}
                                        onChange={e => setOrgFormDescription(e.target.value)}
                                        className="w-full bg-surface border border-gray-700 rounded-lg p-4 text-white focus:border-brand-500 focus-visible:outline-none h-32 text-sm"
                                        placeholder="Explain the requirements for becoming an organizer..."
                                    />
                                </div>
                            </div>

                            {/* Main Discord Server Integration */}
                            <h3 className="text-sm font-bold text-[#5865F2] uppercase tracking-widest border-l-2 border-[#5865F2] pl-3 pt-4 flex items-center gap-2">
                                Discord Server Multi-Webhook Automation
                            </h3>
                            <DiscordSettingsCard 
                                discordWebhooks={props.discordWebhooks}
                                setDiscordWebhooks={props.setDiscordWebhooks}
                                showToast={props.showToast}
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-800 flex justify-end">
                        <button type="button" 
                            onClick={handleSaveSettings}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-10 py-3 rounded-xl font-bold transition shadow-lg shadow-brand-600/20 uppercase tracking-widest"
                        >
                            Save All Settings
                        </button>
                    </div>
                </div>
    );
};

interface DiscordSettingsCardProps {
    discordWebhooks?: any;
    setDiscordWebhooks?: any;
    showToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const DiscordSettingsCard: React.FC<DiscordSettingsCardProps> = ({ discordWebhooks, setDiscordWebhooks, showToast }) => {
    const [activeTab, setActiveTab] = React.useState<'tournaments' | 'scrims'>('tournaments');
    const [testingCategory, setTestingCategory] = React.useState<string | null>(null);

    const activeWebhooks = discordWebhooks?.[activeTab] || {};
    const isAutoEnabled = discordWebhooks?.autoAnnounce?.[activeTab] ?? true;

    const updateWebhook = (category: string, value: string) => {
        setDiscordWebhooks?.((prev: any) => ({
            ...(prev || {}),
            [activeTab]: {
                ...(prev?.[activeTab] || {}),
                [category]: value,
            }
        }));
    };

    const toggleAutoAnnounce = (enabled: boolean) => {
        setDiscordWebhooks?.((prev: any) => ({
            ...(prev || {}),
            autoAnnounce: {
                ...(prev?.autoAnnounce || {}),
                [activeTab]: enabled,
            }
        }));
    };

    const handleTest = async (category: string, url?: string) => {
        const targetUrl = url?.trim() || activeWebhooks[category]?.trim();
        if (!targetUrl) {
            showToast?.(`Please enter a webhook URL for ${category} first.`, 'warning');
            return;
        }
        setTestingCategory(category);
        showToast?.(`Sending test ping to Discord [${category}]...`, 'info');
        try {
            const { testSpecificDiscordWebhook } = await import('../../../../shared/services/DiscordService');
            const res = await testSpecificDiscordWebhook(activeTab, category as any, targetUrl);
            showToast?.(res.message, res.success ? 'success' : 'error');
        } catch (err: any) {
            showToast?.(err.message || 'Test delivery failed', 'error');
        } finally {
            setTestingCategory(null);
        }
    };

    const categories = [
        {
            key: 'announcement',
            title: activeTab === 'tournaments' ? 'Tournament Announcement Webhook' : 'Scrim Announcement Webhook',
            desc: activeTab === 'tournaments' ? 'Broadcasts when a new tournament is created & opened.' : 'Broadcasts new scrim lobby open for booking.',
            icon: '📢',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #tournament-announcements)'
        },
        {
            key: 'registration',
            title: activeTab === 'tournaments' ? 'Register Announcement Webhook' : 'Scrim Registration Webhook',
            desc: 'Broadcasts player / squad registration alerts and live slot counts.',
            icon: '📝',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #registration-feed)'
        },
        {
            key: 'group',
            title: activeTab === 'tournaments' ? 'Group Draw Webhook' : 'Scrim Lobby / Group Webhook',
            desc: activeTab === 'tournaments' ? 'Broadcasts group stage drawings and team allocations.' : 'Broadcasts confirmed slot list and player allocations.',
            icon: '📋',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #group-draws)'
        },
        {
            key: 'matchSchedule',
            title: activeTab === 'tournaments' ? 'Match Schedule & Room Webhook' : 'Scrim Match Schedule Webhook',
            desc: 'Broadcasts match reminders, countdowns, and room credentials (ID & password).',
            icon: '⏰',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #match-schedule)'
        },
        {
            key: 'result',
            title: activeTab === 'tournaments' ? 'Result Webhook' : 'Scrim Result Webhook',
            desc: 'Broadcasts match scoring, kill tallies, and updated round standings.',
            icon: '📊',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #match-results)'
        },
        {
            key: 'champion',
            title: activeTab === 'tournaments' ? 'Champion Announcement Webhook' : 'Scrim Champion / Winner Webhook',
            desc: 'Broadcasts grand champions, final rankings, and prize distributions.',
            icon: '👑',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #hall-of-champions)'
        },
    ];

    return (
        <div className="bg-dark p-6 rounded-xl border border-gray-800 space-y-6">
            {/* Format Switcher */}
            <div className="flex bg-surface p-1.5 rounded-xl border border-gray-800 gap-1.5">
                <button
                    type="button"
                    onClick={() => setActiveTab('tournaments')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                        activeTab === 'tournaments'
                            ? 'bg-[#5865F2] text-white shadow-md shadow-[#5865F2]/25'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    🏆 Tournaments Webhooks
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('scrims')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                        activeTab === 'scrims'
                            ? 'bg-[#5865F2] text-white shadow-md shadow-[#5865F2]/25'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    🎯 Scrims Webhooks
                </button>
            </div>

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-gray-800">
                <div>
                    <div className="text-xs text-white font-bold uppercase tracking-wide">
                        Automatic {activeTab === 'tournaments' ? 'Tournament' : 'Scrim'} Broadcasts
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                        Automatically dispatch updates across the 6 channels below when lifecycle events occur.
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                    <input 
                        type="checkbox" 
                        checked={isAutoEnabled} 
                        onChange={e => toggleAutoAnnounce(e.target.checked)} 
                        className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-dark peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-[#5865F2]"></div>
                </label>
            </div>

            {/* 6 Granular Webhooks */}
            <div className="space-y-4">
                {categories.map(cat => {
                    const val = activeWebhooks[cat.key] || '';
                    const isConfigured = val.trim().length > 0;
                    const isTesting = testingCategory === cat.key;

                    return (
                        <div key={cat.key} className="p-4 bg-surface rounded-xl border border-gray-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor={`webhook-${activeTab}-${cat.key}`} className="text-xs text-white font-bold uppercase flex items-center gap-2">
                                    <span>{cat.icon}</span>
                                    <span>{cat.title}</span>
                                </label>
                                {isConfigured ? (
                                    <span className="text-[9px] text-green-400 font-black bg-green-950/60 border border-green-500/30 px-2 py-0.5 rounded uppercase">CONFIGURED</span>
                                ) : (
                                    <span className="text-[9px] text-yellow-400 font-black bg-yellow-950/60 border border-yellow-500/30 px-2 py-0.5 rounded uppercase">NOT SET</span>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold">{cat.desc}</p>
                            <div className="flex gap-2 pt-1">
                                <input
                                    id={`webhook-${activeTab}-${cat.key}`}
                                    type="url"
                                    value={val}
                                    onChange={e => updateWebhook(cat.key, e.target.value)}
                                    placeholder={cat.placeholder}
                                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white font-mono text-xs focus:border-[#5865F2] focus-visible:outline-none"
                                />
                                <button
                                    type="button"
                                    disabled={isTesting}
                                    onClick={() => handleTest(cat.key, val)}
                                    className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition shrink-0 flex items-center gap-1.5"
                                >
                                    {isTesting ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        'Test Ping'
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
