// ponytail: single source of truth for the production domain — used by Seo, sitemap, and JSON-LD
export const BASE_URL = 'https://www.nexplayorg.app';

export const NEXPLAY_LOGO = '/logo.png';
export const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=User&background=6d28d9&color=fff';
export const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2670&h=400';
export const DEFAULT_TEAM_LOGO = 'https://ui-avatars.com/api/?name=Team&background=1f2937&color=cbd5e1';

export const PRESET_AVATARS = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber&backgroundColor=1a1a1a',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Mecha&backgroundColor=1a1a1a',
    'https://api.dicebear.com/7.x/pixel-art/svg?seed=Viper&backgroundColor=1a1a1a',
    'https://api.dicebear.com/7.x/pixel-art/svg?seed=Wraith&backgroundColor=1a1a1a',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Dragon&backgroundColor=1a1a1a',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Knight&backgroundColor=1a1a1a'
];

export const PRESET_TEAM_LOGOS = [
    // Neon Rings (Sci-Fi Portals)
    'https://api.dicebear.com/7.x/rings/svg?seed=Alpha&backgroundColor=0a0a0a&ringColor=ff0055',
    'https://api.dicebear.com/7.x/rings/svg?seed=Bravo&backgroundColor=0a0a0a&ringColor=00ffcc',
    'https://api.dicebear.com/7.x/rings/svg?seed=Charlie&backgroundColor=0a0a0a&ringColor=7700ff',
    'https://api.dicebear.com/7.x/rings/svg?seed=Delta&backgroundColor=0a0a0a&ringColor=ffaa00',
    // Abstract Neon Shapes
    'https://api.dicebear.com/7.x/shapes/svg?seed=Echo&backgroundColor=0a0a0a&shape1Color=ff0055',
    'https://api.dicebear.com/7.x/shapes/svg?seed=Foxtrot&backgroundColor=0a0a0a&shape1Color=00ffcc',
    'https://api.dicebear.com/7.x/shapes/svg?seed=Golf&backgroundColor=0a0a0a&shape1Color=7700ff',
    'https://api.dicebear.com/7.x/shapes/svg?seed=Hotel&backgroundColor=0a0a0a&shape1Color=ffaa00',
    // Space Invader Identicons
    'https://api.dicebear.com/7.x/identicon/svg?seed=India&backgroundColor=0a0a0a&rowColor=ff0055',
    'https://api.dicebear.com/7.x/identicon/svg?seed=Juliet&backgroundColor=0a0a0a&rowColor=00ffcc',
    'https://api.dicebear.com/7.x/identicon/svg?seed=Kilo&backgroundColor=0a0a0a&rowColor=7700ff',
    'https://api.dicebear.com/7.x/identicon/svg?seed=Lima&backgroundColor=0a0a0a&rowColor=ffaa00'
];

export const PRESET_PLAYER_BANNERS = [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQcTs560ovHJ8zuSCSxBISUa6n_P8U7gBuOWA&s',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop', // Esports Arena
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2071&auto=format&fit=crop', // Gaming Setup
    'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=2070&auto=format&fit=crop', // Controller Neon
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=2165&auto=format&fit=crop', // Abstract Tech
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop' // Retro Gaming
];

export const PRESET_TOURNAMENT_BANNERS = [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop', // Esports Arena
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2071&auto=format&fit=crop', // Gaming Setup
    'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=2070&auto=format&fit=crop', // Controller Neon
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=2165&auto=format&fit=crop', // Abstract Tech
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop', // Retro Gaming
    'https://images.unsplash.com/photo-1616565433290-7603b51e0e85?q=80&w=2070&auto=format&fit=crop', // Cyberpunk City
    'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?q=80&w=2070&auto=format&fit=crop', // Abstract Blue
    'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop', // Abstract Purple
    'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=2187&auto=format&fit=crop' // Abstract Dark
];

export const GAME_MAPS: Record<string, string[]> = {
    'free fire': ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NeXTerra'],
    'free fire max': ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NeXTerra'],
    'pubg mobile': ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Livik', 'Nusa'],
    'pubg': ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Taego', 'Deston', 'Rondo'],
    'bgmi': ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Livik', 'Nusa'],
    'cod mobile': ['Crash', 'Crossfire', 'Killhouse', 'Nuketown', 'Firing Range', 'Isolated', 'Blackout'],
    'valorant': ['Ascent', 'Bind', 'Haven', 'Split', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss'],
    'mobile legends': ['Imperial Sanctuary', 'Celestial Palace', 'Western Expanse'],
};

/**
 * Returns the official maps for any supported game safely with fuzzy/case-insensitive fallback.
 */
export function getMapsForGame(gameName?: string): string[] {
    if (!gameName) return GAME_MAPS['free fire'];
    const norm = gameName.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    
    if (GAME_MAPS[norm]) return GAME_MAPS[norm];

    if (norm.includes('free fire') || norm.includes('freefire') || norm.includes('ff')) {
        return GAME_MAPS['free fire'];
    }
    if (norm.includes('bgmi')) {
        return GAME_MAPS['bgmi'];
    }
    if (norm.includes('pubg')) {
        return GAME_MAPS['pubg mobile'];
    }
    if (norm.includes('cod') || norm.includes('call of duty')) {
        return GAME_MAPS['cod mobile'];
    }
    if (norm.includes('val') || norm.includes('valorant')) {
        return GAME_MAPS['valorant'];
    }
    if (norm.includes('mlbb') || norm.includes('mobile legend')) {
        return GAME_MAPS['mobile legends'];
    }

    // Default fallback to Free Fire maps for esports on this platform
    return GAME_MAPS['free fire'];
}
