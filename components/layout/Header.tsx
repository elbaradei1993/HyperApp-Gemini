import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import GlobalSearch from '../search/GlobalSearch';
import { UserIcon } from '../ui/Icons';

const Header: React.FC = () => {
  const { user } = useContext(AuthContext) || {};
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Ignore "No rows found" error
        console.error('Error fetching profile avatar:', error.message);
      } else if (data) {
        setAvatarUrl(data.avatar_url);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const ProfileIcon = () => {
    if (loading) {
      return <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>;
    }
    
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt="User profile avatar"
          className="w-8 h-8 rounded-full object-cover border-2 border-gray-600 hover:border-brand-accent transition-colors"
        />
      );
    }

    return (
      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center border-2 border-gray-500 hover:border-brand-accent transition-colors">
        <UserIcon className="w-5 h-5 text-gray-300" />
      </div>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-brand-secondary/70 backdrop-blur-md border-b border-brand-accent/20 shadow-lg z-50 h-16">
      <div className="max-w-md mx-auto px-4 h-full flex justify-between items-center">
        <h1 className="text-xl font-bold text-text-primary">HyperAPP</h1>
        <div className="flex items-center space-x-4">
          <GlobalSearch />
          {user && (
            <Link to="/profile" aria-label="View Profile">
              <ProfileIcon />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;