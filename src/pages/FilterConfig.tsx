import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Filter, ArrowLeft, Settings, Users, Building, GraduationCap, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';

const FilterConfig = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getActiveUserId, getActiveUserEmail, isImpersonating, impersonatedUser } = useAdminImpersonation();
  
  const [config, setConfig] = useState({
    jobTitle: '',
    // Stage 1 Filters
    useNotRelevantFilter: false,
    useTargetCompaniesFilter: false,
    // Stage 2 Filters
    minMonthsCurrentRole: 0,
    excludeTerms: '',
    excludeLocationTerms: '',
    mustHaveTerms: '',
    requiredTitles: '',
    requireTopUni: false,
  });
  
  const [blacklistCompanies, setBlacklistCompanies] = useState('');
  const [pastCandidates, setPastCandidates] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Load existing configuration data
  useEffect(() => {
    const loadExistingData = async () => {
      if (!user) return;
      
      setLoadingData(true);
      try {
        // Load filter rules - get the most recent one
        const { data: filterRules, error: filterError } = await supabase
          .from('filter_rules')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (filterError && filterError.code !== 'PGRST116') {
          console.error('Error loading filter rules:', filterError);
        }

        if (filterRules) {
          setHasExistingData(true);
          setConfig({
            jobTitle: filterRules.job_id || '',
            useNotRelevantFilter: filterRules.use_not_relevant_filter || false,
            useTargetCompaniesFilter: filterRules.use_target_companies_filter || false,
            minMonthsCurrentRole: filterRules.min_months_current_role || 0,
            excludeTerms: (filterRules.exclude_terms || []).join(', '),
            excludeLocationTerms: (filterRules.exclude_location_terms || []).join('\n'),
            mustHaveTerms: (filterRules.must_have_terms || []).join(', '),
            requiredTitles: (filterRules.required_titles || []).join(', '),
            requireTopUni: filterRules.require_top_uni || false,
          });

          // Load blacklist companies for this job
          const { data: blacklist } = await supabase
            .from('user_blacklist')
            .select('company_name')
            .eq('user_id', user.id)
            .eq('job_id', filterRules.job_id);
          
          if (blacklist?.length) {
            setBlacklistCompanies(blacklist.map(b => b.company_name).join('\n'));
          }

          // Load past candidates for this job
          const { data: pastCands } = await supabase
            .from('user_past_candidates')
            .select('candidate_name')
            .eq('user_id', user.id)
            .eq('job_id', filterRules.job_id);
          
          if (pastCands?.length) {
            setPastCandidates(pastCands.map(c => c.candidate_name).join('\n'));
          }
        }
      } catch (error) {
        console.error('Error loading existing data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadExistingData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Filter className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleSaveConfig = async () => {
    if (!config.jobTitle.trim()) {
      toast({
        title: "Job Title Required",
        description: "Please enter a Job Title to save the configuration.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Save filter rules
      const { error: filterError } = await supabase
        .from('filter_rules')
        .upsert({
          user_id: user.id,
          job_id: config.jobTitle,
          // Stage 1 settings
          use_not_relevant_filter: config.useNotRelevantFilter,
          use_target_companies_filter: config.useTargetCompaniesFilter,
          // Stage 2 settings
          min_months_current_role: config.minMonthsCurrentRole,
          exclude_terms: config.excludeTerms.split(',').map(t => t.trim()).filter(Boolean),
          exclude_location_terms: config.excludeLocationTerms.split('\n').map(t => t.trim()).filter(Boolean),
          must_have_terms: config.mustHaveTerms.split(',').map(t => t.trim()).filter(Boolean),
          required_titles: config.requiredTitles.split(',').map(t => t.trim()).filter(Boolean),
          require_top_uni: config.requireTopUni,
        });

      if (filterError) throw filterError;

      // Save blacklist companies if provided
      if (blacklistCompanies.trim()) {
        const companies = blacklistCompanies.split('\n').map(c => c.trim()).filter(Boolean);
        const blacklistData = companies.map(company => ({
          user_id: user.id,
          job_id: config.jobTitle,
          company_name: company,
        }));

        const { error: blacklistError } = await supabase
          .from('user_blacklist')
          .upsert(blacklistData);

        if (blacklistError) throw blacklistError;
      }

      // Save past candidates if provided
      if (pastCandidates.trim()) {
        const candidates = pastCandidates.split('\n').map(c => c.trim()).filter(Boolean);
        const candidatesData = candidates.map(candidate => ({
          user_id: user.id,
          job_id: config.jobTitle,
          candidate_name: candidate,
        }));

        const { error: candidatesError } = await supabase
          .from('user_past_candidates')
          .upsert(candidatesData);

        if (candidatesError) throw candidatesError;
      }

      toast({
        title: "Configuration Saved!",
        description: `Filter rules for "${config.jobTitle}" have been saved successfully.`,
      });

      // Mark that we now have existing data
      setHasExistingData(true);

    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Save Error",
        description: error.message || "Failed to save configuration.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Scaler</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">
              {user.email}
            </Badge>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <div className="h-16 w-16 bg-secondary/10 rounded-xl flex items-center justify-center mx-auto">
              <Settings className="h-8 w-8 text-secondary" />
            </div>
            <h1 className="text-3xl font-bold">Filter Configuration</h1>
            <p className="text-xl text-muted-foreground">
              Set up your filtering rules and criteria for candidate screening
            </p>
            {loadingData && (
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                <span>Loading existing configuration...</span>
              </div>
            )}
            {hasExistingData && !loadingData && (
              <Badge variant="secondary" className="mx-auto">
                Loaded existing configuration
              </Badge>
            )}
          </div>

          <div className="grid lg:grid-cols-1 gap-8">
            {/* Stage 1: Company & Lists Filtering */}
            <Card className="card-shadow">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Building className="h-5 w-5 text-primary" />
                  <CardTitle>Stage 1: Company & Lists Filtering</CardTitle>
                </div>
                <CardDescription>
                  Basic filtering based on companies and candidate lists (applied first)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title *</Label>
                  <Input
                    id="jobTitle"
                    placeholder="e.g. Senior Product Manager"
                    value={config.jobTitle}
                    onChange={(e) => setConfig({...config, jobTitle: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Job title for this filtering configuration
                  </p>
                </div>

                <Separator />

                {/* Built-in Lists Options */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="notRelevant"
                        checked={config.useNotRelevantFilter}
                        onCheckedChange={(checked) => setConfig({...config, useNotRelevantFilter: checked})}
                      />
                      <Label htmlFor="notRelevant" className="font-medium">Filter NotRelevant Companies</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Remove candidates from built-in NotRelevant companies list (current + previous company)
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="targetCompanies"
                        checked={config.useTargetCompaniesFilter}
                        onCheckedChange={(checked) => setConfig({...config, useTargetCompaniesFilter: checked})}
                      />
                      <Label htmlFor="targetCompanies" className="font-medium">Filter Target Companies Only</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Keep only candidates from built-in Target companies list (current + previous company)
                    </p>
                  </div>
                </div>

                <Separator />

                {/* User Lists */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="blacklist">Blacklist Companies</Label>
                    <Textarea
                      id="blacklist"
                      placeholder="Company Name 1&#10;Company Name 2&#10;Company Name 3"
                      rows={6}
                      value={blacklistCompanies}
                      onChange={(e) => setBlacklistCompanies(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      One company per line. Checked against <strong>current company only</strong>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pastCandidates">Past Candidates</Label>
                    <Textarea
                      id="pastCandidates"
                      placeholder="John Doe&#10;Jane Smith&#10;Mike Johnson"
                      rows={6}
                      value={pastCandidates}
                      onChange={(e) => setPastCandidates(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      One candidate name per line. These will be filtered out completely.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stage 2: User Rules */}
            <Card className="card-shadow">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-secondary" />
                  <CardTitle>Stage 2: User Rules Filtering</CardTitle>
                </div>
                <CardDescription>
                  Advanced filtering based on experience, skills, and requirements (applied after Stage 1)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minMonths">Minimum Months in Current Role</Label>
                    <Input
                      id="minMonths"
                      type="number"
                      min="0"
                      value={config.minMonthsCurrentRole}
                      onChange={(e) => setConfig({...config, minMonthsCurrentRole: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="excludeLocation">החרגת מיקום</Label>
                    <Textarea
                      id="excludeLocation"
                      placeholder="ירושלים&#10;צפון&#10;באר שבע"
                      rows={4}
                      value={config.excludeLocationTerms}
                      onChange={(e) => setConfig({...config, excludeLocationTerms: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground">
                      מיקומים להחרגה (עיר, אזור) - אחד בכל שורה. בדיקה רק מול מיקום המועמד
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excludeTerms">Exclude List</Label>
                  <Textarea
                    id="excludeTerms"
                    placeholder="intern, junior, assistant (comma-separated)"
                    value={config.excludeTerms}
                    onChange={(e) => setConfig({...config, excludeTerms: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Filter out candidates with these terms in current title (includes synonyms)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mustHave">Must Have List</Label>
                  <Textarea
                    id="mustHave"
                    placeholder="senior, manager, lead (comma-separated)"
                    value={config.mustHaveTerms}
                    onChange={(e) => setConfig({...config, mustHaveTerms: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Candidates must have at least one of these terms (includes synonyms)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="titles">Title Check</Label>
                  <Textarea
                    id="titles"
                    placeholder="Product Manager, Technical Lead (comma-separated)"
                    value={config.requiredTitles}
                    onChange={(e) => setConfig({...config, requiredTitles: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required job titles (includes synonyms)
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="topUni"
                    checked={config.requireTopUni}
                    onCheckedChange={(checked) => setConfig({...config, requireTopUni: checked})}
                  />
                  <Label htmlFor="topUni">Top University Check</Label>
                  <p className="text-sm text-muted-foreground ml-auto">
                    Validate education against built-in Top Universities list
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save Button */}
          <div className="flex justify-center pt-6 space-x-4">
            <Button 
              variant="hero" 
              size="xl" 
              onClick={handleSaveConfig}
              disabled={saving || loadingData}
            >
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
            {hasExistingData && (
              <Link to="/dashboard">
                <Button variant="outline" size="xl">
                  <ArrowLeft className="h-5 w-5" />
                  Back to Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterConfig;