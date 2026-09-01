import Seo from '../../../shared/components/Seo';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function NotFound() {
    return (
        <>
        <Seo
            title="404 - Page Not Found | NexPlay"
            description="The page you are looking for does not exist."
            noindex
        />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
            <Helmet>
                <title>404 - Page Not Found | NexPlay</title>
            </Helmet>
            
            <h1 className="text-8xl font-black text-brand-500 tracking-tighter mb-4" style={{ textShadow: '0 0 40px rgba(139, 92, 246, 0.4)' }}>404</h1>
            <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-6">Page Not Found</h2>
            <p className="text-gray-400 max-w-md mb-8">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>
            <Link to="/" className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-wider transition-colors hover:scale-105 active:scale-95">
                <Home className="w-5 h-5" /> Back to Home
            </Link>
        </div>
        </>
    );
}
