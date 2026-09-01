import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

const ScrollToTop: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const { pathname } = useLocation();

    // Automatically scroll to top on page navigation
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <button
            type="button"
            aria-label="Scroll to top"
            onClick={scrollToTop}
            tabIndex={isVisible ? 0 : -1}
            className={`fixed bottom-8 right-8 bg-brand-600 text-white p-3 rounded-full shadow-lg transition-opacity duration-300 z-[90] ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            <ArrowUp className="w-6 h-6" />
        </button>
    );
};

export default ScrollToTop;
