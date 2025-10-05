import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Filter, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const Auth = () => {
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();
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

  // Detect Supabase auth callback and exchange code for a session
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const errorDesc = url.searchParams.get('error_description');
        if (errorDesc) {
          setErrors({ general: decodeURIComponent(errorDesc) });
          return;
        }
        const code = url.searchParams.get('code');
        if (code) {
          const { supabase } = await import('@/integrations/supabase/client');
          setLoading(true);
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setErrors({ general: error.message });
          } else {
            navigate('/dashboard');
          }
        }
      } catch (e) {
        console.error('Auth callback error', e);
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email: formData.email });
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
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Normalize email to match database format
      const normalizedEmail = formData.email.trim().toLowerCase();
      
      // Use secure function to check if email is allowed (doesn't expose email list)
      const { data: isAllowed, error: checkError } = await supabase
        .rpc('is_email_allowed', { check_email: normalizedEmail });

      if (checkError) {
        console.error('Error checking allowed emails:', checkError);
        setErrors({ general: 'Unable to verify email authorization. Please try again.' });
        setLoading(false);
        return;
      }

      if (!isAllowed) {
        setErrors({ general: 'This email is not authorized to register. Please contact your administrator.' });
        setLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/auth`;

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
          data: formData.fullName ? { full_name: formData.fullName } : undefined,
        },
      });

      if (error) {
        setErrors({ general: error.message });
      } else {
        setResetSuccess(true);
        setErrors({});
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
              <CardTitle>Sign in with your email</CardTitle>
              <CardDescription>We’ll email you a one-time sign-in link</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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

                {errors.general && (
                  <p className="text-sm text-destructive text-center">{errors.general}</p>
                )}

                {resetSuccess && (
                  <p className="text-sm text-green-600 text-center">
                    Sign-in link sent! Check your inbox.
                  </p>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                  variant="hero"
                >
                  {loading ? 'Sending...' : 'Send magic link'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;