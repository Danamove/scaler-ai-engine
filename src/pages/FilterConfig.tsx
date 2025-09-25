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

const FilterConfig = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [config, setConfig] = useState({
    jobId: '',
    minYearsExperience: 0,
    minMonthsCurrentRole: 0,
    excludeTerms: '',
    mustHaveTerms: '',
    requiredTitles: '',
    requireTopUni: false,
  });
  
  const [blacklistCompanies, setBlacklistCompanies] = useState('');
  const [pastCandidates, setPastCandidates] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
    if (!config.jobId.trim()) {
      toast({
        title: "Job ID Required",
        description: "Please enter a Job ID to save the configuration.",
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
          job_id: config.jobId,
          min_years_experience: config.minYearsExperience,
          min_months_current_role: config.minMonthsCurrentRole,
          exclude_terms: config.excludeTerms.split(',').map(t => t.trim()).filter(Boolean),
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
          job_id: config.jobId,
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
          job_id: config.jobId,
          candidate_name: candidate,
        }));

        const { error: candidatesError } = await supabase
          .from('user_past_candidates')
          .upsert(candidatesData);

        if (candidatesError) throw candidatesError;
      }

      toast({
        title: "Configuration Saved!",
        description: `Filter rules for job "${config.jobId}" have been saved successfully.`,
      });

      // Navigate back to dashboard after successful save
      setTimeout(() => navigate('/dashboard'), 1500);

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
            <h1 className="text-2xl font-bold text-foreground">Filterly</h1>
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
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Main Filter Rules */}
            <div className="space-y-6">
              <Card className="card-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Filter className="h-5 w-5 text-primary" />
                    <CardTitle>Basic Filter Rules</CardTitle>
                  </div>
                  <CardDescription>
                    Configure core filtering parameters for Stage 2 filtering
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="jobId">Job ID *</Label>
                    <Input
                      id="jobId"
                      placeholder="e.g. TECH-PM-2024-Q1"
                      value={config.jobId}
                      onChange={(e) => setConfig({...config, jobId: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground">
                      Unique identifier for this filtering job
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minYears">Min Years Experience</Label>
                      <Input
                        id="minYears"
                        type="number"
                        min="0"
                        value={config.minYearsExperience}
                        onChange={(e) => setConfig({...config, minYearsExperience: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minMonths">Min Months in Current Role</Label>
                      <Input
                        id="minMonths"
                        type="number"
                        min="0"
                        value={config.minMonthsCurrentRole}
                        onChange={(e) => setConfig({...config, minMonthsCurrentRole: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="excludeTerms">Exclude Terms</Label>
                    <Textarea
                      id="excludeTerms"
                      placeholder="intern, junior, assistant (comma-separated)"
                      value={config.excludeTerms}
                      onChange={(e) => setConfig({...config, excludeTerms: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground">
                      Candidates with these terms in titles will be filtered out
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mustHave">Must Have Terms</Label>
                    <Textarea
                      id="mustHave"
                      placeholder="senior, manager, lead (comma-separated)"
                      value={config.mustHaveTerms}
                      onChange={(e) => setConfig({...config, mustHaveTerms: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground">
                      Candidates must have at least one of these terms
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="titles">Required Titles</Label>
                    <Textarea
                      id="titles"
                      placeholder="Product Manager, Technical Lead (comma-separated)"
                      value={config.requiredTitles}
                      onChange={(e) => setConfig({...config, requiredTitles: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground">
                      Specific job titles to filter for (with synonyms)
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="topUni"
                      checked={config.requireTopUni}
                      onCheckedChange={(checked) => setConfig({...config, requireTopUni: checked})}
                    />
                    <Label htmlFor="topUni">Require Top University</Label>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User Lists */}
            <div className="space-y-6">
              <Card className="card-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Building className="h-5 w-5 text-accent" />
                    <CardTitle>Blacklist Companies</CardTitle>
                  </div>
                  <CardDescription>
                    Companies to exclude (Stage 1 filtering)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="blacklist">Company Names</Label>
                    <Textarea
                      id="blacklist"
                      placeholder="Company Name 1&#10;Company Name 2&#10;Company Name 3"
                      rows={8}
                      value={blacklistCompanies}
                      onChange={(e) => setBlacklistCompanies(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      One company name per line. Checked against current company only.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-secondary" />
                    <CardTitle>Past Candidates</CardTitle>
                  </div>
                  <CardDescription>
                    Candidates to exclude from this job
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="pastCandidates">Candidate Names</Label>
                    <Textarea
                      id="pastCandidates"
                      placeholder="John Doe&#10;Jane Smith&#10;Mike Johnson"
                      rows={8}
                      value={pastCandidates}
                      onChange={(e) => setPastCandidates(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      One candidate name per line. These will be filtered out.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-center pt-6">
            <Button 
              variant="hero" 
              size="xl" 
              onClick={handleSaveConfig}
              disabled={saving}
            >
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterConfig;