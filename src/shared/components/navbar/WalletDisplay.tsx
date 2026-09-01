import React from 'react';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/utils';

interface WalletDisplayProps {
  balance: number;
  onClick?: () => void;
}

const WalletDisplay: React.FC<WalletDisplayProps> = ({ balance, onClick }) => {
  return (
    <button type="button" 
      onClick={onClick}
      className="flex items-center justify-center h-11 gap-2 bg-gradient-to-r from-brand-900/20 to-purple-900/20 border border-brand-500/30 px-4 rounded-full shadow-lg hover:border-brand-500/50 transition cursor-pointer whitespace-nowrap shrink-0"
    >
      <Wallet className="w-4 h-4 text-brand-400" />
      <span className="text-sm font-black text-white tracking-widest">{formatCurrency(balance)}</span>
    </button>
  );
};

export default WalletDisplay;
