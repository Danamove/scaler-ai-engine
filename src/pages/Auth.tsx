import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Filter, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required').optional(),
});

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const navigate = useNavigate();

  // Password recovery state
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Detect Supabase recovery redirect
  useEffect(() => {
    // Check both query string and hash for recovery type
    const queryParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash || '';
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    
    if (queryParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery') {
      setIsRecoveryMode(true);
    }
  }, []);

  const validateForm = () => {
    try {
      const dataToValidate = isSignUp 
        ? { ...formData } 
        : { email: formData.email, password: formData.password };
      
      authSchema.parse(dataToValidate);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (!error) {
          // Success message already shown in hook
          setFormData({ email: '', password: '', fullName: '' });
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (!error) {
          navigate('/dashboard');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePasswordReset = async () => {
    if (!formData.email) {
      setErrors({ email: 'Please enter your email address' });
      return;
    }

    setIsResetting(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      // Use the proper project URL instead of localhost
      const redirectUrl = window.location.hostname === 'localhost' 
        ? 'https://fe15e92e-7210-4079-a610-155d2fdbb2ff.lovableproject.com/auth'
        : `${window.location.origin}/auth`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        setErrors({ general: error.message });
      } else {
        setResetSuccess(true);
        setErrors({});
      }
    } catch (error) {
      setErrors({ general: 'Failed to send reset email' });
    } finally {
      setIsResetting(false);
    }
  };

  const clearRecoveryHash = () => {
    // Clean both hash and query parameters
    const url = new URL(window.location.href);
    
    // Remove recovery-related query parameters
    url.searchParams.delete('type');
    url.searchParams.delete('access_token');
    url.searchParams.delete('refresh_token');
    
    // Remove hash
    url.hash = '';
    
    // Update URL without reload
    history.replaceState(null, '', url.pathname + url.search);
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setIsResetting(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setErrors({ general: error.message });
      } else {
        setErrors({});
        setResetSuccess(true);
        clearRecoveryHash();
        setIsRecoveryMode(false);
        navigate('/dashboard');
      }
    } catch (error) {
      setErrors({ general: 'Failed to update password' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <Filter className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Scaler</h1>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Auth Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">Welcome to Scaler</h2>
            <p className="text-muted-foreground">
              Sign in to access your candidate filtering dashboard
            </p>
          </div>

          <Card className="card-shadow">
            <CardHeader>
              {isRecoveryMode ? (
                <>
                  <CardTitle>Reset your password</CardTitle>
                  <CardDescription>Enter a new password to continue</CardDescription>
                </>
              ) : (
                <Tabs value={isSignUp ? 'signup' : 'signin'} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger 
                      value="signin" 
                      onClick={() => setIsSignUp(false)}
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger 
                      value="signup" 
                      onClick={() => setIsSignUp(true)}
                    >
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </CardHeader>
            <CardContent>
              {isRecoveryMode ? (
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isResetting}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isResetting}
                    />
                    {errors.confirm && (
                      <p className="text-sm text-destructive">{errors.confirm}</p>
                    )}
                  </div>
                  {errors.general && (
                    <p className="text-sm text-destructive text-center">{errors.general}</p>
                  )}
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isResetting}
                    variant="hero"
                  >
                    {isResetting ? 'Updating...' : 'Update Password'}
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm"
                    className="w-full text-sm"
                    onClick={() => { setIsRecoveryMode(false); clearRecoveryHash(); }}
                  >
                    Back to Sign In
                  </Button>
                </form>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {isSignUp && (
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          type="text"
                          placeholder="Enter your full name"
                          value={formData.fullName}
                          onChange={(e) => handleInputChange('fullName', e.target.value)}
                          disabled={loading}
                        />
                        {errors.fullName && (
                          <p className="text-sm text-destructive">{errors.fullName}</p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        disabled={loading}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        disabled={loading}
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>

                    {errors.general && (
                      <p className="text-sm text-destructive text-center">{errors.general}</p>
                    )}

                    {resetSuccess && (
                      <p className="text-sm text-green-600 text-center">
                        Password reset email sent! Check your inbox.
                      </p>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loading || isResetting}
                      variant="hero"
                    >
                      {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                    </Button>

                    {!isSignUp && (
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        className="w-full text-sm"
                        onClick={handlePasswordReset}
                        disabled={isResetting || loading}
                      >
                        {isResetting ? 'Sending...' : 'Forgot Password?'}
                      </Button>
                    )}
                  </form>

                  <div className="mt-6 text-center text-sm text-muted-foreground">
                    {isSignUp ? (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(false)}
                          className="text-primary hover:underline"
                        >
                          Sign in here
                        </button>
                      </>
                    ) : (
                      <>
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(true)}
                          className="text-primary hover:underline"
                        >
                          Sign up here
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;