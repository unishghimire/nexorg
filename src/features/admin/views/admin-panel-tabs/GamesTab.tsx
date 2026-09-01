import React from 'react';
import {Trash, Edit, Plus, Trophy} from 'lucide-react';

import { AdminPanelTabProps } from './types';
import ScoringConfigModal from '../../components/ScoringConfigModal';

export const GamesTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, NEXPLAY_LOGO, editingGame, formatGameName, gameLogo, gameModes, gameName, games, handleDeleteGame, handleSaveGame, handleSaveScoring, isGameModalOpen, isScoringModalOpen, isPublished, openEditGame, setEditingGame, setGameLogo, setGameModes, setGameName, setIsGameModalOpen, setIsPublished, uploading, handlePasteGame, handleDropGame, handleDragOverGame, processAndUploadGame, scoringModalGame, setScoringModalGame, setIsScoringModalOpen } = props;
    return (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Game Management</h2>
                        <button type="button" 
                            onClick={() => {
                                setEditingGame(null);
                                setGameName('');
                                setGameLogo('');
                                setGameModes('');
                                setIsPublished(true);
                                setIsGameModalOpen(true);
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Game
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {games.map(game => (
                            <div key={game.id} className="bg-card p-4 rounded-xl border border-gray-800 flex items-center gap-4">
                                <img src={game.logoUrl || undefined} className="w-16 h-16 object-cover rounded-lg border border-gray-700" alt={formatGameName(game.name)} loading="lazy" />
                                <div className="flex-grow">
                                    <h3 className="font-bold text-white">{formatGameName(game.name)}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2 h-2 rounded-full ${game.isPublished ? 'bg-green-500' : 'bg-surface'}`}></span>
                                        <span className="text-[10px] text-gray-500 uppercase font-bold">{game.isPublished ? 'Published' : 'Draft'}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1 truncate w-32">
                                        {game.modes.join(', ')}
                                    </div>
                                    {(game as any).scoring?.enabled && (
                                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[8px] font-bold uppercase">
                                            <Trophy className="w-2 h-2" /> Scoring v{(game as any).scoring?.scoringVersion || 1}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button type="button" onClick={() => openEditGame(game)} className="text-blue-400 hover:text-white" title="Edit Game"><Edit className="w-4 h-4" /></button>
                                    <button type="button"
                                        onClick={() => { setScoringModalGame(game); setIsScoringModalOpen(true); }}
                                        className="text-amber-400 hover:text-white"
                                        title="Scoring Settings"
                                    >
                                        <Trophy className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => handleDeleteGame(game.id)} className="text-red-400 hover:text-white" title="Delete Game"><Trash className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isGameModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingGame ? 'Edit Game' : 'Add Game'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="game-name" className="text-xs text-gray-500 uppercase font-bold mb-1 block">Game Name</label>
                                        <input 
                                            type="text" 
                                            value={gameName}
                                            onChange={(e) => setGameName(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none"
                                            placeholder="e.g. PUBG Mobile"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Logo/Banner (Paste, Drop or Click to Select)</label>
                                        <div 
                                            onPaste={handlePasteGame}
                                            onDrop={handleDropGame}
                                            onDragOver={handleDragOverGame}
                                            onClick={() => document.getElementById('game-logo-file-input')?.click()}
                                            className={`relative w-full aspect-video rounded-xl border-2 border-dashed transition-colors flex items-center justify-center overflow-hidden group cursor-pointer ${uploading ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                                        >
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <img 
                                                        src={gameLogo || DEFAULT_BANNER || undefined} 
                                                        alt="Game Logo Preview" 
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                                        onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                        referrerPolicy="no-referrer" loading="lazy" />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                                        <Plus className="w-8 h-8 text-white" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <input 
                                            id="game-logo-file-input"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    processAndUploadGame(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <div className="mt-2">
                                            <input 
                                                type="text" 
                                                value={gameLogo}
                                                onChange={(e) => setGameLogo(e.target.value)}
                                                className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none text-sm"
                                                placeholder="Or paste image URL..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="game-modes" className="text-xs text-gray-500 uppercase font-bold mb-1 block">Game Modes (Comma separated)</label>
                                        <textarea 
                                            value={gameModes}
                                            onChange={(e) => setGameModes(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none h-24"
                                            placeholder="Battle Royale, Ranked, Arcade..."
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            id="isPublished"
                                            checked={isPublished}
                                            onChange={(e) => setIsPublished(e.target.checked)}
                                            className="w-4 h-4 accent-brand-500"
                                        />
                                        <label htmlFor="isPublished" className="text-sm text-gray-300 font-bold uppercase">Published (Visible to users)</label>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="button" 
                                        onClick={() => setIsGameModalOpen(false)}
                                        className="flex-1 bg-surface hover:bg-surface text-white py-3 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button type="button" 
                                        onClick={handleSaveGame}
                                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        {editingGame ? 'Update' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                {isScoringModalOpen && scoringModalGame && (
                    <ScoringConfigModal
                        isOpen={isScoringModalOpen}
                        onClose={() => { setIsScoringModalOpen(false); setScoringModalGame(null); }}
                        gameName={scoringModalGame.name}
                        gameId={scoringModalGame.id}
                        currentScoring={(scoringModalGame as any).scoring || null}
                        onSave={handleSaveScoring}
                    />
                )}
                </div>
    );
};