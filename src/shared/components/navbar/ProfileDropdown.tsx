import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ProfileDropdownProps {
  username: string;
  avatarUrl?: string;
  onLogout: () => void;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ username, avatarUrl, onLogout }) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${username}'s profile menu`}
        className="flex items-center justify-center h-11 gap-2 text-sm font-medium text-gray-300 hover:text-white transition bg-surface/50 px-3 md:px-4 rounded-full border border-gray-700 whitespace-nowrap shrink-0"
      >
        <div className="w-6 h-6 shrink-0 bg-brand-700 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-gray-800 overflow-hidden">
          {avatarUrl ? <img src={avatarUrl || undefined} className="w-full h-full object-cover" alt="" loading="lazy" /> : username[0].toUpperCase()}
        </div>
        <span className="hidden md:block truncate max-w-[80px] font-bold">{username}</span>
        <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-card border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-[60]" role="menu">
          <Link to="/dashboard" onClick={() => setIsOpen(false)} role="menuitem" className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-surface hover:text-white transition">
            <User className="w-4 h-4" aria-hidden="true" /> Dashboard
          </Link>
          <Link to="/profile" onClick={() => setIsOpen(false)} role="menuitem" className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-surface hover:text-white transition">
            <User className="w-4 h-4" aria-hidden="true" /> View Profile
          </Link>

          {(profile?.role === 'organizer' || profile?.role === 'admin') && (
            <Link to="/organizer" onClick={() => setIsOpen(false)} role="menuitem" className="flex items-center gap-2 px-4 py-3 text-sm text-brand-400 hover:bg-surface hover:text-brand-300 transition">
              <Plus className="w-4 h-4" aria-hidden="true" /> Organizer Panel
            </Link>
          )}

          {profile?.role === 'admin' && (
            <Link to="/admin" onClick={() => setIsOpen(false)} role="menuitem" className="flex items-center gap-2 px-4 py-3 text-sm text-purple-400 hover:bg-surface hover:text-purple-300 transition border-b border-gray-800">
              <Settings className="w-4 h-4" aria-hidden="true" /> Admin Panel
            </Link>
          )}

          <button type="button" onClick={() => { onLogout(); setIsOpen(false); }} role="menuitem" className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-surface hover:text-red-300 transition">
            <LogOut className="w-4 h-4" aria-hidden="true" /> Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
