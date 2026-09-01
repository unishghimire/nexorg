import React from 'react';
import { Link } from 'react-router-dom';

interface ProfileLinkProps {
  to: string;
  name: string;
  className?: string;
}

const ProfileLink: React.FC<ProfileLinkProps> = ({ to, name, className = '' }) => {
  if (!to || !name) {
    return <span className="text-gray-500">Not available</span>;
  }

  return (
    <Link 
      to={to} 
      className={`text-brand-400 font-bold hover:text-brand-300 hover:underline transition-colors ${className}`}
    >
      {name}
    </Link>
  );
};

export default ProfileLink;
