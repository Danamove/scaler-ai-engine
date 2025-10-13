import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Filter, Building2, Users, BookOpen, Key, Plus, Trash2, ArrowLeft, DollarSign, UserCheck, Zap, Mail, Edit2, Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';
import { useUserRole } from '@/hooks/useUserRole';

interface Company {
  id: string;
  company_name: string;
  category?: string;
}

interface Synonym {
  id: string;
  canonical_term: string;
  variant_term: string;
  category: string;
}

interface TopUniversity {
  id: string;
  university_name: string;
  country: string;
}

interface ApiCost {
  id: string;
  function_name: string;
  cost_usd: number;
  tokens_used: number;
  created_at: string;
}

interface AllowedEmail {
  id: string;
  email: string;
  added_by?: string;
  notes?: string;
  created_at: string;
}

// Helper function to fetch all rows with pagination
const BATCH_SIZE = 1000;

async function fetchAllRows<T>(table: string, orderBy: string): Promise<T[]> {
  let from = 0;
  let to = BATCH_SIZE - 1;
  const all: T[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(table as any)
      .select('*')
      .order(orderBy)
      .range(from, to);

    if (error) throw error;

    const chunk = (data ?? []) as T[];
    all.push(...chunk);

    if (chunk.length < BATCH_SIZE) break;

    from += BATCH_SIZE;
    to += BATCH_SIZE;
  }

  return all;
}

const AdminPanel = () => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { impersonatedUser, setImpersonatedUser, canImpersonate } = useAdminImpersonation();
  
  // State management
  const [targetCompanies, setTargetCompanies] = useState<Company[]>([]);
  const [notRelevantCompanies, setNotRelevantCompanies] = useState<Company[]>([]);
  const [synonyms, setSynonyms] = useState<Synonym[]>([]);
  const [topUniversities, setTopUniversities] = useState<TopUniversity[]>([]);
  const [apiCosts, setApiCosts] = useState<ApiCost[]>([]);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  
  // Form states
  const [newTargetCompany, setNewTargetCompany] = useState({ name: '', category: '' });
  const [bulkTargetCompanies, setBulkTargetCompanies] = useState('');
  const [newNotRelevantCompany, setNewNotRelevantCompany] = useState({ name: '', category: '' });
  const [bulkNotRelevantCompanies, setBulkNotRelevantCompanies] = useState('');
  const [newSynonym, setNewSynonym] = useState({ canonicalTerm: '', variantTerm: '', category: 'skill' });
  const [newTopUniversity, setNewTopUniversity] = useState({ name: '', country: 'Israel' });
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newAllowedEmail, setNewAllowedEmail] = useState({ email: '', notes: '' });
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailData, setEditingEmailData] = useState({ email: '', notes: '' });
  
  const [isLoading, setIsLoading] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!loading && !roleLoading && (!user || !isAdmin)) {
      navigate('/dashboard');
      toast({
        title: "Access Denied",
        description: "Admin access required",
        variant: "destructive",
      });
    }
  }, [user, loading, roleLoading, isAdmin, navigate, toast]);

  // Load data
  useEffect(() => {
    if (user && isAdmin) {
      loadAllData();
    }
  }, [user, isAdmin]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [targetCompaniesData, notRelevantCompaniesData, synonymsData, universitiesData, costsResponse, profilesData, allowedEmailsData] = await Promise.all([
        fetchAllRows<Company>('target_companies', 'company_name'),
        fetchAllRows<Company>('not_relevant_companies', 'company_name'),
        fetchAllRows<Synonym>('synonyms', 'canonical_term'),
        fetchAllRows<TopUniversity>('top_universities', 'university_name'),
        supabase.from('api_costs').select('*').order('created_at', { ascending: false }).limit(100),
        fetchAllRows<any>('profiles', 'email'),
        fetchAllRows<AllowedEmail>('allowed_emails', 'email')
      ]);

      setTargetCompanies(targetCompaniesData);
      setNotRelevantCompanies(notRelevantCompaniesData);
      setSynonyms(synonymsData);
      setTopUniversities(universitiesData);
      if (costsResponse.data) setApiCosts(costsResponse.data);
      setUserProfiles(profilesData);
      setAllowedEmails(allowedEmailsData);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Target Companies Management
  const addTargetCompany = async () => {
    if (!newTargetCompany.name.trim()) return;
    
    try {
      const { error } = await supabase
        .from('target_companies')
        .insert({ 
          company_name: newTargetCompany.name.trim(),
          category: newTargetCompany.category.trim() || null
        });

      if (error) throw error;

      setNewTargetCompany({ name: '', category: '' });
      loadAllData();
      toast({
        title: "Target company added",
        description: `${newTargetCompany.name} added successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding company",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteTargetCompany = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('target_companies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadAllData();
      toast({
        title: "Company deleted",
        description: `${name} removed from target companies`,
      });
    } catch (error: any) {
      toast({
        title: "Error deleting company",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addTargetCompaniesBulk = async () => {
    if (!bulkTargetCompanies.trim()) {
      toast({
        title: "Empty list",
        description: "Please enter at least one company name",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Split by lines, trim each line, remove empty lines
      const companies = bulkTargetCompanies
        .split('\n')
        .map(c => c.trim())
        .filter(Boolean);
      
      // Remove duplicates (case-insensitive)
      const uniqueCompanies = [...new Set(companies.map(c => c.toLowerCase()))]
        .map(c => companies.find(orig => orig.toLowerCase() === c))
        .filter(Boolean) as string[];
      
      if (uniqueCompanies.length === 0) {
        toast({
          title: "No valid companies",
          description: "Please enter at least one company name",
          variant: "destructive",
        });
        return;
      }
      
      // Check for existing companies using fetchAllRows
      const existingCompanies = await fetchAllRows<{ company_name: string }>('target_companies', 'company_name');

      const existingNames = new Set(
        existingCompanies.map(c => c.company_name.toLowerCase())
      );

      const companiesToInsert = uniqueCompanies
        .filter(name => !existingNames.has(name.toLowerCase()))
        .map(name => ({
          company_name: name,
          category: null
        }));

      if (companiesToInsert.length === 0) {
        toast({
          title: "All companies already exist",
          description: "No new companies to add",
        });
        setBulkTargetCompanies('');
        setIsLoading(false);
        return;
      }
      
      const { error } = await supabase
        .from('target_companies')
        .insert(companiesToInsert);
      
      if (error) throw error;
      
      setBulkTargetCompanies('');
      await loadAllData();
      
      const skippedCount = uniqueCompanies.length - companiesToInsert.length;
      const message = skippedCount > 0 
        ? `Added ${companiesToInsert.length} companies (${skippedCount} already existed)`
        : `Successfully added ${companiesToInsert.length} companies`;
      
      toast({
        title: "Companies added",
        description: message,
      });
      
    } catch (error: any) {
      toast({
        title: "Error adding companies",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // NotRelevant Companies Management
  const addNotRelevantCompany = async () => {
    if (!newNotRelevantCompany.name.trim()) return;
    
    try {
      const { error } = await supabase
        .from('not_relevant_companies')
        .insert({ 
          company_name: newNotRelevantCompany.name.trim(),
          category: newNotRelevantCompany.category.trim() || null
        });

      if (error) throw error;

      setNewNotRelevantCompany({ name: '', category: '' });
      loadAllData();
      toast({
        title: "NotRelevant company added",
        description: `${newNotRelevantCompany.name} added successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding company",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteNotRelevantCompany = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('not_relevant_companies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadAllData();
      toast({
        title: "Company deleted",
        description: `${name} removed from not relevant companies`,
      });
    } catch (error: any) {
      toast({
        title: "Error deleting company",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addNotRelevantCompaniesBulk = async () => {
    if (!bulkNotRelevantCompanies.trim()) {
      toast({
        title: "Empty list",
        description: "Please enter at least one company name",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Split by lines, trim each line, remove empty lines
      const companies = bulkNotRelevantCompanies
        .split('\n')
        .map(c => c.trim())
        .filter(Boolean);
      
      // Remove duplicates (case-insensitive)
      const uniqueCompanies = [...new Set(companies.map(c => c.toLowerCase()))]
        .map(c => companies.find(orig => orig.toLowerCase() === c))
        .filter(Boolean) as string[];
      
      if (uniqueCompanies.length === 0) {
        toast({
          title: "No valid companies",
          description: "Please enter at least one company name",
          variant: "destructive",
        });
        return;
      }
      
      // Check for existing companies using fetchAllRows
      const existingCompanies = await fetchAllRows<{ company_name: string }>('not_relevant_companies', 'company_name');

      const existingNames = new Set(
        existingCompanies.map(c => c.company_name.toLowerCase())
      );

      const companiesToInsert = uniqueCompanies
        .filter(name => !existingNames.has(name.toLowerCase()))
        .map(name => ({
          company_name: name,
          category: null
        }));

      if (companiesToInsert.length === 0) {
        toast({
          title: "All companies already exist",
          description: "No new companies to add",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      const { error } = await supabase
        .from('not_relevant_companies')
        .insert(companiesToInsert);
      
      if (error) throw error;
      
      setBulkNotRelevantCompanies('');
      await loadAllData();
      
      toast({
        title: "Companies added",
        description: `Successfully added ${companiesToInsert.length} companies to NotRelevant list`,
      });
      
    } catch (error: any) {
      toast({
        title: "Error adding companies",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Top Universities Management
  const addTopUniversity = async () => {
    if (!newTopUniversity.name.trim()) return;
    
    try {
      const { error } = await supabase
        .from('top_universities')
        .insert({ 
          university_name: newTopUniversity.name.trim(),
          country: newTopUniversity.country.trim()
        });

      if (error) throw error;

      setNewTopUniversity({ name: '', country: 'Israel' });
      loadAllData();
      toast({
        title: "Top university added",
        description: `${newTopUniversity.name} added successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding university",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteTopUniversity = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('top_universities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadAllData();
      toast({
        title: "University deleted",
        description: `${name} removed from top universities`,
      });
    } catch (error: any) {
      toast({
        title: "Error deleting university",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Synonyms Management
  const addSynonym = async () => {
    if (!newSynonym.canonicalTerm.trim() || !newSynonym.variantTerm.trim()) return;
    
    try {
      const { error } = await supabase
        .from('synonyms')
        .insert({ 
          canonical_term: newSynonym.canonicalTerm.trim(),
          variant_term: newSynonym.variantTerm.trim(),
          category: newSynonym.category
        });

      if (error) throw error;

      setNewSynonym({ canonicalTerm: '', variantTerm: '', category: 'skill' });
      loadAllData();
      toast({
        title: "Synonym added",
        description: `${newSynonym.canonicalTerm} ↔ ${newSynonym.variantTerm} added successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding synonym",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteSynonym = async (id: string, canonical: string, variant: string) => {
    if (!confirm(`Are you sure you want to delete "${canonical} ↔ ${variant}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('synonyms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadAllData();
      toast({
        title: "Synonym deleted",
        description: `${canonical} ↔ ${variant} removed`,
      });
    } catch (error: any) {
      toast({
        title: "Error deleting synonym",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // User invitation
  const inviteUser = async () => {
    if (!newUserEmail.trim()) return;
    
    try {
      const { error } = await supabase.auth.admin.inviteUserByEmail(newUserEmail.trim());

      if (error) throw error;

      setNewUserEmail('');
      toast({
        title: "User invited",
        description: `Invitation sent to ${newUserEmail}`,
      });
    } catch (error: any) {
      toast({
        title: "Error inviting user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Allowed Emails Management
  const addAllowedEmail = async () => {
    if (!newAllowedEmail.email.trim()) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAllowedEmail.email.trim())) {
      toast({
        title: "Invalid email format",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    
    setIsAddingEmail(true);
    
    try {
      const normalizedEmail = newAllowedEmail.email.trim().toLowerCase();
      
      // Check if email already exists
      const { data: existingEmails } = await supabase
        .from('allowed_emails')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (existingEmails) {
        toast({
          title: "Email already exists",
          description: `${normalizedEmail} is already in the allowed list. You can edit it below.`,
          variant: "destructive",
        });
        // Highlight the existing email for editing
        setEditingEmailId(existingEmails.id);
        const emailToEdit = allowedEmails.find(e => e.id === existingEmails.id);
        if (emailToEdit) {
          setEditingEmailData({ email: emailToEdit.email, notes: emailToEdit.notes || '' });
        }
        setIsAddingEmail(false);
        return;
      }
      
      const { error } = await supabase
        .from('allowed_emails')
        .insert({ 
          email: normalizedEmail,
          notes: newAllowedEmail.notes.trim() || null,
          added_by: user?.id
        });

      if (error) throw error;

      setNewAllowedEmail({ email: '', notes: '' });
      loadAllData();
      toast({
        title: "Email added",
        description: `${normalizedEmail} is now authorized to register`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAddingEmail(false);
    }
  };

  const startEditingEmail = (emailEntry: AllowedEmail) => {
    setEditingEmailId(emailEntry.id);
    setEditingEmailData({ email: emailEntry.email, notes: emailEntry.notes || '' });
  };

  const cancelEditingEmail = () => {
    setEditingEmailId(null);
    setEditingEmailData({ email: '', notes: '' });
  };

  const saveEditedEmail = async (id: string) => {
    if (!editingEmailData.email.trim()) {
      toast({
        title: "Email required",
        description: "Email address cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editingEmailData.email.trim())) {
      toast({
        title: "Invalid email format",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const normalizedEmail = editingEmailData.email.trim().toLowerCase();
      
      // Check if the new email already exists (excluding current record)
      const { data: existingEmails } = await supabase
        .from('allowed_emails')
        .select('id')
        .eq('email', normalizedEmail)
        .neq('id', id)
        .maybeSingle();
      
      if (existingEmails) {
        toast({
          title: "Email already exists",
          description: `${normalizedEmail} is already in the allowed list`,
          variant: "destructive",
        });
        return;
      }
      
      const { error } = await supabase
        .from('allowed_emails')
        .update({ 
          email: normalizedEmail,
          notes: editingEmailData.notes.trim() || null
        })
        .eq('id', id);

      if (error) throw error;

      setEditingEmailId(null);
      setEditingEmailData({ email: '', notes: '' });
      loadAllData();
      toast({
        title: "Email updated",
        description: `Email updated successfully to ${normalizedEmail}`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating email",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteAllowedEmail = async (id: string, email: string) => {
    // Prevent deleting your own admin email
    if (email.toLowerCase() === user?.email?.toLowerCase()) {
      toast({
        title: "Cannot delete your own email",
        description: "You cannot remove your own admin access",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to remove "${email}" from allowed emails?`)) return;
    
    try {
      const { error } = await supabase
        .from('allowed_emails')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadAllData();
      toast({
        title: "Email removed",
        description: `${email} is no longer authorized to register`,
      });
    } catch (error: any) {
      toast({
        title: "Error deleting email",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Seed recommended synonyms
  const seedRecommendedSynonyms = async () => {
    const recommendedSynonyms = [
      // Core role synonyms
      { canonical_term: 'engineer', variant_term: 'developer', category: 'title' },
      { canonical_term: 'engineer', variant_term: 'programmer', category: 'title' },
      { canonical_term: 'software engineer', variant_term: 'software developer', category: 'title' },
      { canonical_term: 'software engineer', variant_term: 'application developer', category: 'title' },
      
      // Backend synonyms
      { canonical_term: 'backend', variant_term: 'back-end', category: 'title' },
      { canonical_term: 'backend', variant_term: 'server-side', category: 'title' },
      { canonical_term: 'backend engineer', variant_term: 'backend developer', category: 'title' },
      { canonical_term: 'backend engineer', variant_term: 'server-side engineer', category: 'title' },
      
      // Frontend synonyms
      { canonical_term: 'frontend', variant_term: 'front-end', category: 'title' },
      { canonical_term: 'frontend', variant_term: 'client-side', category: 'title' },
      { canonical_term: 'frontend engineer', variant_term: 'frontend developer', category: 'title' },
      { canonical_term: 'frontend engineer', variant_term: 'ui developer', category: 'title' },
      
      // Full stack synonyms
      { canonical_term: 'full stack', variant_term: 'fullstack', category: 'title' },
      { canonical_term: 'full stack', variant_term: 'full-stack', category: 'title' },
      { canonical_term: 'full stack engineer', variant_term: 'fullstack developer', category: 'title' },
      
      // Management synonyms - CRITICAL for exclusions
      { canonical_term: 'manager', variant_term: 'team lead', category: 'title' },
      { canonical_term: 'manager', variant_term: 'team leader', category: 'title' },
      { canonical_term: 'manager', variant_term: 'lead', category: 'title' },
      { canonical_term: 'manager', variant_term: 'head of', category: 'title' },
      { canonical_term: 'manager', variant_term: 'supervisor', category: 'title' },
      { canonical_term: 'manager', variant_term: 'team manager', category: 'title' },
      { canonical_term: 'manager', variant_term: 'engineering manager', category: 'title' },
      { canonical_term: 'manager', variant_term: 'technical lead', category: 'title' },
      { canonical_term: 'manager', variant_term: 'tech lead', category: 'title' },
      { canonical_term: 'manager', variant_term: 'director', category: 'title' },
      
      // Seniority synonyms
      { canonical_term: 'senior', variant_term: 'sr', category: 'title' },
      { canonical_term: 'senior', variant_term: 'sr.', category: 'title' },
      
      // Technology synonyms
      { canonical_term: 'javascript', variant_term: 'js', category: 'skill' },
      { canonical_term: 'javascript', variant_term: 'node.js', category: 'skill' },
      { canonical_term: 'database', variant_term: 'sql', category: 'skill' },
      { canonical_term: 'database', variant_term: 'db', category: 'skill' }
    ];

    try {
      let successCount = 0;
      let duplicateCount = 0;

      for (const synonym of recommendedSynonyms) {
        try {
          const { error } = await supabase
            .from('synonyms')
            .insert([synonym]);

          if (error) {
            if (error.code === '23505') { // Unique constraint violation
              duplicateCount++;
            } else {
              console.error('Error inserting synonym:', error);
            }
          } else {
            successCount++;
          }
        } catch (insertError) {
          console.error('Failed to insert synonym:', insertError);
        }
      }

      await loadAllData(); // Refresh the data

      toast({
        title: "Synonyms seeded",
        description: `Added ${successCount} new synonyms. ${duplicateCount} duplicates skipped.`,
      });

    } catch (error: any) {
      toast({
        title: "Error seeding synonyms",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Filter className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const totalCosts = apiCosts.reduce((sum, cost) => sum + (cost.cost_usd || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div className="flex items-center space-x-2">
              <Filter className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            </div>
          </div>
          <Badge variant="secondary">
            {user.email}
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="target-companies" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="target-companies">Target Companies</TabsTrigger>
            <TabsTrigger value="not-relevant">NotRelevant Companies</TabsTrigger>
            <TabsTrigger value="synonyms">Synonyms</TabsTrigger>
            <TabsTrigger value="top-universities">Top Universities</TabsTrigger>
            <TabsTrigger value="allowed-emails">Allowed Emails</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="impersonate">User Access</TabsTrigger>
            <TabsTrigger value="api-costs">API Costs</TabsTrigger>
          </TabsList>

          {/* Target Companies Tab */}
          <TabsContent value="target-companies" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Target Companies Management
                </CardTitle>
                <CardDescription>
                  Manage the list of companies that are considered targets for filtering
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {/* Single Company Add */}
                  <div>
                    <h4 className="font-medium mb-3">Add Single Company</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="target-company-name">Company Name</Label>
                        <Input
                          id="target-company-name"
                          value={newTargetCompany.name}
                          onChange={(e) => setNewTargetCompany(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Google, Microsoft"
                        />
                      </div>
                      <div>
                        <Label htmlFor="target-company-category">Category (Optional)</Label>
                        <Input
                          id="target-company-category"
                          value={newTargetCompany.category}
                          onChange={(e) => setNewTargetCompany(prev => ({ ...prev, category: e.target.value }))}
                          placeholder="e.g., Tech, Finance"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={addTargetCompany} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Company
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Bulk Companies Add */}
                  <div>
                    <h4 className="font-medium mb-3">Add Multiple Companies (Bulk)</h4>
                    <div className="space-y-2">
                      <Label htmlFor="bulk-target-companies">Paste Company List</Label>
                      <Textarea
                        id="bulk-target-companies"
                        value={bulkTargetCompanies}
                        onChange={(e) => setBulkTargetCompanies(e.target.value)}
                        placeholder="Company Name 1&#10;Company Name 2&#10;Company Name 3&#10;..."
                        rows={8}
                        className="font-mono text-sm"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          One company per line. Duplicates will be removed automatically.
                        </p>
                        <Button 
                          onClick={addTargetCompaniesBulk} 
                          disabled={isLoading || !bulkTargetCompanies.trim()}
                          className="ml-2"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add All Companies
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Current Target Companies ({targetCompanies.length})</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {targetCompanies.map((company) => (
                      <div key={company.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">{company.company_name}</span>
                          {company.category && <Badge variant="outline" className="ml-2">{company.category}</Badge>}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteTargetCompany(company.id, company.company_name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NotRelevant Companies Tab */}
          <TabsContent value="not-relevant" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  NotRelevant Companies Management
                </CardTitle>
                <CardDescription>
                  Manage the list of companies that should be filtered out
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {/* Single Company Add */}
                  <div>
                    <h4 className="font-medium mb-3">Add Single Company</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="not-relevant-company-name">Company Name</Label>
                        <Input
                          id="not-relevant-company-name"
                          value={newNotRelevantCompany.name}
                          onChange={(e) => setNewNotRelevantCompany(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Small Local Company"
                        />
                      </div>
                      <div>
                        <Label htmlFor="not-relevant-company-category">Category (Optional)</Label>
                        <Input
                          id="not-relevant-company-category"
                          value={newNotRelevantCompany.category}
                          onChange={(e) => setNewNotRelevantCompany(prev => ({ ...prev, category: e.target.value }))}
                          placeholder="e.g., Retail, Food"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={addNotRelevantCompany} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Company
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Bulk Companies Add */}
                  <div>
                    <h4 className="font-medium mb-3">Add Multiple Companies (Bulk)</h4>
                    <div className="space-y-2">
                      <Label htmlFor="bulk-not-relevant-companies">Paste Company List</Label>
                      <Textarea
                        id="bulk-not-relevant-companies"
                        value={bulkNotRelevantCompanies}
                        onChange={(e) => setBulkNotRelevantCompanies(e.target.value)}
                        placeholder="Company Name 1&#10;Company Name 2&#10;Company Name 3&#10;..."
                        rows={8}
                        className="font-mono text-sm"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          One company per line. Duplicates will be removed automatically.
                        </p>
                        <Button 
                          onClick={addNotRelevantCompaniesBulk} 
                          disabled={isLoading || !bulkNotRelevantCompanies.trim()}
                          className="ml-2"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add All Companies
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Current NotRelevant Companies ({notRelevantCompanies.length})</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {notRelevantCompanies.map((company) => (
                      <div key={company.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">{company.company_name}</span>
                          {company.category && <Badge variant="outline" className="ml-2">{company.category}</Badge>}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteNotRelevantCompany(company.id, company.company_name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Synonyms Tab */}
          <TabsContent value="synonyms" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Synonyms Management
                    </CardTitle>
                    <CardDescription>
                      Manage synonym mappings for better matching in filtering
                    </CardDescription>
                  </div>
                  <Button onClick={seedRecommendedSynonyms} variant="outline" className="shrink-0">
                    <Zap className="h-4 w-4 mr-2" />
                    Quick Seed Recommended
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="canonical-term">Canonical Term</Label>
                    <Input
                      id="canonical-term"
                      value={newSynonym.canonicalTerm}
                      onChange={(e) => setNewSynonym(prev => ({ ...prev, canonicalTerm: e.target.value }))}
                      placeholder="e.g., Software Engineer"
                    />
                  </div>
                  <div>
                    <Label htmlFor="variant-term">Variant Term</Label>
                    <Input
                      id="variant-term"
                      value={newSynonym.variantTerm}
                      onChange={(e) => setNewSynonym(prev => ({ ...prev, variantTerm: e.target.value }))}
                      placeholder="e.g., Developer"
                    />
                  </div>
                  <div>
                    <Label htmlFor="synonym-category">Category</Label>
                    <Select
                      value={newSynonym.category}
                      onValueChange={(value) => setNewSynonym(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="title">Title</SelectItem>
                        <SelectItem value="skill">Skill</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addSynonym} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Synonym
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Current Synonyms ({synonyms.length})</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {synonyms.map((synonym) => (
                      <div key={synonym.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{synonym.canonical_term}</span>
                          <span className="text-muted-foreground">↔</span>
                          <span className="font-medium">{synonym.variant_term}</span>
                          <Badge variant="outline">{synonym.category}</Badge>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteSynonym(synonym.id, synonym.canonical_term, synonym.variant_term)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Universities Tab */}
          <TabsContent value="top-universities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Top Universities Management
                </CardTitle>
                <CardDescription>
                  Manage the list of top universities for filtering requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="university-name">University Name</Label>
                    <Input
                      id="university-name"
                      value={newTopUniversity.name}
                      onChange={(e) => setNewTopUniversity(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Tel Aviv University, MIT"
                    />
                  </div>
                  <div>
                    <Label htmlFor="university-country">Country</Label>
                    <Select
                      value={newTopUniversity.country}
                      onValueChange={(value) => setNewTopUniversity(prev => ({ ...prev, country: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Israel">Israel</SelectItem>
                        <SelectItem value="United States">United States</SelectItem>
                        <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="Germany">Germany</SelectItem>
                        <SelectItem value="France">France</SelectItem>
                        <SelectItem value="Switzerland">Switzerland</SelectItem>
                        <SelectItem value="Netherlands">Netherlands</SelectItem>
                        <SelectItem value="Denmark">Denmark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addTopUniversity} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add University
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Current Top Universities ({topUniversities.length})</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {topUniversities.map((university) => (
                      <div key={university.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">{university.university_name}</span>
                          <Badge variant="outline" className="ml-2">{university.country}</Badge>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteTopUniversity(university.id, university.university_name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Allowed Emails Tab */}
          <TabsContent value="allowed-emails" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Allowed Emails Management
                </CardTitle>
                <CardDescription>
                  Manage which email addresses are authorized to register for Scaler
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="allowed-email">Email Address</Label>
                    <Input
                      id="allowed-email"
                      type="email"
                      value={newAllowedEmail.email}
                      onChange={(e) => setNewAllowedEmail(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="user@company.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-notes">Notes (Optional)</Label>
                    <Input
                      id="email-notes"
                      value={newAllowedEmail.notes}
                      onChange={(e) => setNewAllowedEmail(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g., Sales team member"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addAllowedEmail} className="w-full" disabled={isAddingEmail}>
                      {isAddingEmail ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Email
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Current Allowed Emails ({allowedEmails.length})</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {allowedEmails.map((emailEntry) => {
                      const isEditing = editingEmailId === emailEntry.id;
                      
                      return (
                        <div 
                          key={emailEntry.id} 
                          className={`p-3 rounded-lg transition-colors ${
                            isEditing ? 'bg-primary/10 border-2 border-primary' : 'bg-muted/50'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Email Address</Label>
                                  <Input
                                    type="email"
                                    value={editingEmailData.email}
                                    onChange={(e) => setEditingEmailData(prev => ({ ...prev, email: e.target.value }))}
                                    className="h-9"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        cancelEditingEmail();
                                      } else if (e.key === 'Enter') {
                                        saveEditedEmail(emailEntry.id);
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Notes (Optional)</Label>
                                  <Input
                                    value={editingEmailData.notes}
                                    onChange={(e) => setEditingEmailData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="h-9"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        cancelEditingEmail();
                                      } else if (e.key === 'Enter') {
                                        saveEditedEmail(emailEntry.id);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={cancelEditingEmail}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => saveEditedEmail(emailEntry.id)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Press ESC to cancel or Enter to save
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">{emailEntry.email}</span>
                                {emailEntry.notes && <Badge variant="outline" className="ml-2">{emailEntry.notes}</Badge>}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEditingEmail(emailEntry)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteAllowedEmail(emailEntry.id, emailEntry.email)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Invite new users and manage API access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Invite New User</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="user-email">Email Address</Label>
                      <Input
                        id="user-email"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="user@company.com"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={inviteUser} className="w-full">
                        <Users className="h-4 w-4 mr-2" />
                        Send Invitation
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Update OpenAI API Key</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="api-key">New API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        placeholder="sk-..."
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          toast({
                            title: "API Key Update",
                            description: "Please use the secrets management in Supabase dashboard to update API keys",
                          });
                        }}
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Update API Key
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Note: API keys should be updated through the Supabase dashboard secrets management for security.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Impersonation Tab */}
          <TabsContent value="impersonate" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  User Data Access
                </CardTitle>
                <CardDescription>
                  Access other users' filtering data and results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {impersonatedUser && (
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-primary">Currently viewing data for:</p>
                        <p className="text-lg font-bold">{impersonatedUser.email}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => setImpersonatedUser(null)}
                      >
                        Stop Viewing
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="font-medium">Select User to View</h4>
                  <div className="grid gap-3">
                    {userProfiles.map((profile) => {
                      const isActive = impersonatedUser?.email === profile.email;
                      
                      return (
                        <div 
                          key={profile.email} 
                          className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                            isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div>
                            <p className="font-medium">{profile.email}</p>
                            <p className="text-sm text-muted-foreground">
                              {profile.full_name || 'Name not set'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant={isActive ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (isActive) {
                                  setImpersonatedUser(null);
                                } else {
                                  setImpersonatedUser({
                                    email: profile.email,
                                    user_id: profile.user_id
                                  });
                                }
                              }}
                            >
                              {isActive ? 'Viewing' : 'View Data'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {impersonatedUser && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium">Quick Actions</h4>
                      <div className="flex flex-wrap gap-2">
                        <Link to="/dashboard">
                          <Button variant="outline" size="sm">
                            View Dashboard
                          </Button>
                        </Link>
                        <Link to="/results">
                          <Button variant="outline" size="sm">
                            View Results
                          </Button>
                        </Link>
                        <Link to="/filter-config">
                          <Button variant="outline" size="sm">
                            Filter Settings
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Costs Tab */}
          <TabsContent value="api-costs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  API Cost Tracking
                </CardTitle>
                <CardDescription>
                  Monitor OpenAI API usage and costs across the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-primary">${totalCosts.toFixed(4)}</div>
                    <p className="text-sm text-muted-foreground">Total API Costs</p>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-secondary">{apiCosts.length}</div>
                    <p className="text-sm text-muted-foreground">Total API Calls</p>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-accent">
                      {apiCosts.reduce((sum, cost) => sum + (cost.tokens_used || 0), 0).toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Tokens Used</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Recent API Calls</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {apiCosts.map((cost) => (
                      <div key={cost.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">{cost.function_name}</span>
                          <p className="text-sm text-muted-foreground">
                            {new Date(cost.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${(cost.cost_usd || 0).toFixed(4)}</div>
                          <div className="text-sm text-muted-foreground">
                            {(cost.tokens_used || 0).toLocaleString()} tokens
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;