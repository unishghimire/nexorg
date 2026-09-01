import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const BackButton: React.FC = () => {
    const navigate = useNavigate();

    return (
        <button type="button" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-6 touch-target py-2 font-bold uppercase tracking-widest text-xs"
        >
            <ArrowLeft className="w-4 h-4" /> Back
        </button>
    );
};

export default BackButton;
