import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

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

const ALLOWED_USERS = [
  'shiri@added-value.co.il',
  'chen@added-value.co.il', 
  'alex@added-value.co.il',
  'katinka@added-value.co.il',
  'mikaka@added-value.co.il',
  'danana@added-value.co.il',
  'andreas@added-value.co.il',
  'eszterz@added-value.co.il'
];

export const AdminImpersonationProvider = ({ children }: AdminImpersonationProviderProps) => {
  const { user } = useAuth();
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  
  // Check if current user can impersonate others (admin only)
  const canImpersonate = user?.email === 'dana@added-value.co.il';
  
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

  const value = {
    impersonatedUser,
    setImpersonatedUser,
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

export { ALLOWED_USERS };