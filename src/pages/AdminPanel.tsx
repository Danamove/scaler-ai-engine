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
import { Filter, Building2, Users, BookOpen, Key, Plus, Trash2, ArrowLeft, DollarSign, UserCheck, Zap } from 'lucide-react';
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

interface ApiCost {
  id: string;
  function_name: string;
  cost_usd: number;
  tokens_used: number;
  created_at: string;
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
  const [apiCosts, setApiCosts] = useState<ApiCost[]>([]);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  
  // Form states
  const [newTargetCompany, setNewTargetCompany] = useState({ name: '', category: '' });
  const [newNotRelevantCompany, setNewNotRelevantCompany] = useState({ name: '', category: '' });
  const [newSynonym, setNewSynonym] = useState({ canonicalTerm: '', variantTerm: '', category: 'skill' });
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  
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
      const [targetResponse, notRelevantResponse, synonymsResponse, costsResponse, profilesResponse] = await Promise.all([
        supabase.from('target_companies').select('*').order('company_name'),
        supabase.from('not_relevant_companies').select('*').order('company_name'),
        supabase.from('synonyms').select('*').order('canonical_term'),
        supabase.from('api_costs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('profiles').select('*').order('email')
      ]);

      if (targetResponse.data) setTargetCompanies(targetResponse.data);
      if (notRelevantResponse.data) setNotRelevantCompanies(notRelevantResponse.data);
      if (synonymsResponse.data) setSynonyms(synonymsResponse.data);
      if (costsResponse.data) setApiCosts(costsResponse.data);
      if (profilesResponse.data) setUserProfiles(profilesResponse.data);
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="target-companies">Target Companies</TabsTrigger>
            <TabsTrigger value="not-relevant">NotRelevant Companies</TabsTrigger>
            <TabsTrigger value="synonyms">Synonyms</TabsTrigger>
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