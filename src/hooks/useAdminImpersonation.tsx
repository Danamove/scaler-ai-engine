import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

interface ImpersonatedUser {
  email: string;
  user_id: string | null;
}

interface AdminImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  setImpersonatedUser: (user: ImpersonatedUser | null) => void;
  isImpersonating: boolean;
  canImpersonate: boolean;
  getActiveUserId: () => string | null;
  getActiveUserEmail: () => string;
}

const AdminImpersonationContext = createContext<AdminImpersonationContextType | undefined>(undefined);

export const useAdminImpersonation = () => {
  const context = useContext(AdminImpersonationContext);
  if (context === undefined) {
    throw new Error('useAdminImpersonation must be used within an AdminImpersonationProvider');
  }
  return context;
};

interface AdminImpersonationProviderProps {
  children: ReactNode;
}

export const AdminImpersonationProvider = ({ children }: AdminImpersonationProviderProps) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  
  // Check if current user can impersonate others (admin only)
  const canImpersonate = isAdmin;
  
  // Clear impersonation if user is not admin
  useEffect(() => {
    if (!canImpersonate) {
      setImpersonatedUser(null);
    }
  }, [canImpersonate]);

  const getActiveUserId = (): string | null => {
    if (canImpersonate && impersonatedUser?.user_id) {
      return impersonatedUser.user_id;
    }
    return user?.id || null;
  };

  const getActiveUserEmail = (): string => {
    if (canImpersonate && impersonatedUser?.email) {
      return impersonatedUser.email;
    }
    return user?.email || '';
  };

  // Log impersonation actions for audit
  const setImpersonatedUserWithAudit = async (targetUser: ImpersonatedUser | null) => {
    if (canImpersonate && user?.id) {
      try {
        await supabase.from('admin_audit_log').insert({
          admin_user_id: user.id,
          action: targetUser ? 'USER_IMPERSONATION_START' : 'USER_IMPERSONATION_END',
          target_user_id: targetUser?.user_id || impersonatedUser?.user_id,
          details: targetUser ? { email: targetUser.email } : null,
        });
      } catch (error) {
        console.error('Failed to log impersonation action:', error);
      }
    }
    setImpersonatedUser(targetUser);
  };

  const value = {
    impersonatedUser,
    setImpersonatedUser: setImpersonatedUserWithAudit,
    isImpersonating: canImpersonate && !!impersonatedUser,
    canImpersonate,
    getActiveUserId,
    getActiveUserEmail,
  };

  return (
    <AdminImpersonationContext.Provider value={value}>
      {children}
    </AdminImpersonationContext.Provider>
  );
};