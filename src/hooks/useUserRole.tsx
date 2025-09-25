import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type UserRole = 'admin' | 'user';

interface UseUserRoleReturn {
  role: UserRole | null;
  isAdmin: boolean;
  isLoading: boolean;
  refreshRole: () => Promise<void>;
}

export const useUserRole = (): UseUserRoleReturn => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async () => {
    if (!user?.id) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching user role:', error);
        setRole('user'); // Default to user role
      } else {
        setRole(data?.role || 'user');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setRole('user'); // Default to user role
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRole = async () => {
    setIsLoading(true);
    await fetchUserRole();
  };

  useEffect(() => {
    fetchUserRole();
  }, [user?.id]);

  return {
    role,
    isAdmin: role === 'admin',
    isLoading,
    refreshRole,
  };
};