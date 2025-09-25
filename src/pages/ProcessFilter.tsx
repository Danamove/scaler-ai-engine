import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Filter, ArrowLeft, Play, CheckCircle, XCircle, Users, Building } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProcessStats {
  totalCandidates: number;
  processed: number;
  stage1Passed: number;
  stage2Passed: number;
  finalResults: number;
}

const ProcessFilter = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<ProcessStats>({
    totalCandidates: 0,
    processed: 0,
    stage1Passed: 0,
    stage2Passed: 0,
    finalResults: 0
  });
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (user) {
      loadInitialStats();
    }
  }, [user, loading, navigate]);

  const loadInitialStats = async () => {
    if (!user) return;

    try {
      // Get total candidates
      const { count: totalCandidates } = await supabase
        .from('raw_data')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats(prev => ({ ...prev, totalCandidates: totalCandidates || 0 }));
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const processFiltering = async () => {
    if (!user || processing) return;

    console.log('Starting filtering process...');
    setProcessing(true);
    setProgress(0);
    setCurrentStep('Initializing...');

    try {
      // Get candidates and filter rules
      console.log('Loading data...');
      setCurrentStep('Loading data...');
      setProgress(10);

      const { data: candidates, error: candidatesError } = await supabase
        .from('raw_data')
        .select('*')
        .eq('user_id', user.id);

      if (candidatesError) {
        console.error('Error loading candidates:', candidatesError);
        throw candidatesError;
      }

      const { data: filterRulesArray, error: filterRulesError } = await supabase
        .from('filter_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      const filterRules = filterRulesArray?.[0];

      if (filterRulesError) {
        console.error('Error loading filter rules:', filterRulesError);
        throw filterRulesError;
      }

      if (!candidates || !filterRules) {
        throw new Error('Missing candidates or filter configuration');
      }

      console.log(`Found ${candidates.length} candidates and filter rules:`, filterRules);

      // Get built-in lists if needed
      setCurrentStep('Loading built-in lists...');
      setProgress(20);

      const { data: notRelevantCompanies } = await supabase
        .from('not_relevant_companies')
        .select('company_name');

      const { data: targetCompanies } = await supabase
        .from('target_companies')
        .select('company_name');

      // Get user lists
      const { data: blacklistCompanies } = await supabase
        .from('user_blacklist')
        .select('company_name')
        .eq('user_id', user.id)
        .eq('job_id', filterRules.job_id);

      const { data: pastCandidates } = await supabase
        .from('user_past_candidates')
        .select('candidate_name')
        .eq('user_id', user.id)
        .eq('job_id', filterRules.job_id);

      console.log('Loaded lists:', {
        notRelevantCompanies: notRelevantCompanies?.length || 0,
        targetCompanies: targetCompanies?.length || 0,
        blacklistCompanies: blacklistCompanies?.length || 0,
        pastCandidates: pastCandidates?.length || 0
      });

      // Clear existing results for this job
      const { error: deleteError } = await supabase
        .from('filtered_results')
        .delete()
        .eq('user_id', user.id)
        .eq('job_id', filterRules.job_id);

      if (deleteError) {
        console.error('Error clearing previous results:', deleteError);
      }

      setCurrentStep('Processing candidates...');
      setProgress(30);

      let stage1Passed = 0;
      let stage2Passed = 0;
      let finalResults = 0;

      const results = [];

      console.log('Starting candidate processing...');

      // Process each candidate
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        let stage1Pass = true;
        let stage2Pass = true;
        const filterReasons = [];

        // STAGE 1: Company & Lists Filtering
        
        // Check blacklist (current company only)
        const blacklist = blacklistCompanies?.map(b => b.company_name.toLowerCase()) || [];
        if (blacklist.includes(candidate.current_company?.toLowerCase())) {
          stage1Pass = false;
          filterReasons.push('Blacklisted company');
        }

        // Check past candidates
        const pastCandidateNames = pastCandidates?.map(p => p.candidate_name.toLowerCase()) || [];
        if (pastCandidateNames.includes(candidate.full_name?.toLowerCase())) {
          stage1Pass = false;
          filterReasons.push('Past candidate');
        }

        // Check NotRelevant companies (if enabled)
        if (filterRules.use_not_relevant_filter && stage1Pass) {
          const notRelevantList = notRelevantCompanies?.map(c => c.company_name.toLowerCase()) || [];
          const currentCompany = candidate.current_company?.toLowerCase();
          const previousCompany = candidate.previous_company?.toLowerCase();
          
          if (notRelevantList.includes(currentCompany) || notRelevantList.includes(previousCompany)) {
            stage1Pass = false;
            filterReasons.push('NotRelevant company');
          }
        }

        // Check Target companies (if enabled)
        if (filterRules.use_target_companies_filter && stage1Pass) {
          const targetList = targetCompanies?.map(c => c.company_name.toLowerCase()) || [];
          const currentCompany = candidate.current_company?.toLowerCase();
          const previousCompany = candidate.previous_company?.toLowerCase();
          
          if (!targetList.includes(currentCompany) && !targetList.includes(previousCompany)) {
            stage1Pass = false;
            filterReasons.push('Not in target companies');
          }
        }

        if (stage1Pass) stage1Passed++;

        // STAGE 2: User Rules Filtering (only if passed Stage 1)
        if (stage1Pass) {
          // Check minimum experience
          if (candidate.years_of_experience < filterRules.min_years_experience) {
            stage2Pass = false;
            filterReasons.push(`Less than ${filterRules.min_years_experience} years experience`);
          }

          // Check minimum months in current role
          if (candidate.months_in_current_role < filterRules.min_months_current_role) {
            stage2Pass = false;
            filterReasons.push(`Less than ${filterRules.min_months_current_role} months in current role`);
          }

          // Check exclude terms
          if (filterRules.exclude_terms && filterRules.exclude_terms.length > 0) {
            const currentTitle = candidate.current_title?.toLowerCase() || '';
            const hasExcludedTerm = filterRules.exclude_terms.some((term: string) => 
              currentTitle.includes(term.toLowerCase())
            );
            if (hasExcludedTerm) {
              stage2Pass = false;
              filterReasons.push('Contains excluded term');
            }
          }

          // Check must have terms
          if (filterRules.must_have_terms && filterRules.must_have_terms.length > 0) {
            const profileText = `${candidate.current_title} ${candidate.profile_summary}`.toLowerCase();
            const hasMustHaveTerm = filterRules.must_have_terms.some((term: string) => 
              profileText.includes(term.toLowerCase())
            );
            if (!hasMustHaveTerm) {
              stage2Pass = false;
              filterReasons.push('Missing required terms');
            }
          }

          // Check required titles
          if (filterRules.required_titles && filterRules.required_titles.length > 0) {
            const currentTitle = candidate.current_title?.toLowerCase() || '';
            const hasRequiredTitle = filterRules.required_titles.some((title: string) => 
              currentTitle.includes(title.toLowerCase())
            );
            if (!hasRequiredTitle) {
              stage2Pass = false;
              filterReasons.push('Title not in required list');
            }
          }

          // Check top university requirement
          if (filterRules.require_top_uni) {
            const { data: topUniversities } = await supabase
              .from('top_universities')
              .select('university_name');

            const topUniList = topUniversities?.map(u => u.university_name.toLowerCase()) || [];
            const candidateEducation = candidate.education?.toLowerCase() || '';
            
            const hasTopUni = topUniList.some(uni => candidateEducation.includes(uni));
            if (!hasTopUni) {
              stage2Pass = false;
              filterReasons.push('Not from top university');
            }
          }

          if (stage2Pass) stage2Passed++;
        }

        if (stage1Pass && stage2Pass) finalResults++;

        // Create result record
        results.push({
          user_id: user.id,
          job_id: filterRules.job_id,
          raw_data_id: candidate.id,
          stage_1_passed: stage1Pass,
          stage_2_passed: stage2Pass,
          filter_reasons: filterReasons
        });

        // Update progress every 100 candidates
        if (i % 100 === 0 || i === candidates.length - 1) {
          const progressPercent = 30 + ((i + 1) / candidates.length) * 60;
          setProgress(progressPercent);
          setStats(prev => ({
            ...prev,
            processed: i + 1,
            stage1Passed,
            stage2Passed,
            finalResults
          }));
          console.log(`Processed ${i + 1}/${candidates.length} candidates. Stage1: ${stage1Passed}, Stage2: ${stage2Passed}, Final: ${finalResults}`);
        }
      }

      // Save results to database
      console.log('Saving results to database...');
      setCurrentStep('Saving results...');
      setProgress(95);

      const { error } = await supabase
        .from('filtered_results')
        .insert(results);

      if (error) {
        console.error('Error saving results:', error);
        throw error;
      }

      setProgress(100);
      setCurrentStep('Completed!');
      setCompleted(true);

      console.log(`Filtering completed! Final stats: Stage1: ${stage1Passed}, Stage2: ${stage2Passed}, Final: ${finalResults}`);

      toast({
        title: "Filtering Complete!",
        description: `Processed ${candidates.length} candidates. ${finalResults} final results.`,
      });

    } catch (error: any) {
      console.error('Processing error:', error);
      toast({
        title: "Processing Error",
        description: error.message || "Failed to process filtering.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

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
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <div className="h-16 w-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
              <Play className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Process Filtering</h1>
            <p className="text-xl text-muted-foreground">
              Run the filtering algorithm on your candidate data
            </p>
          </div>

          {/* Stats Card */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Processing Status</CardTitle>
              <CardDescription>
                Current progress of the filtering process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{stats.totalCandidates}</div>
                  <p className="text-sm text-muted-foreground">Total Candidates</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-secondary">{stats.processed}</div>
                  <p className="text-sm text-muted-foreground">Processed</p>
                </div>
              </div>

              {processing && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {currentStep}
                  </p>
                </div>
              )}

              {stats.processed > 0 && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-lg font-bold text-secondary">{stats.stage1Passed}</div>
                    <p className="text-xs text-muted-foreground">Stage 1 Passed</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-accent">{stats.stage2Passed}</div>
                    <p className="text-xs text-muted-foreground">Stage 2 Passed</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{stats.finalResults}</div>
                    <p className="text-xs text-muted-foreground">Final Results</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4">
            {!completed ? (
              <Button 
                variant="hero" 
                size="xl" 
                onClick={processFiltering}
                disabled={processing || stats.totalCandidates === 0}
                className="w-full"
              >
                {processing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    Start Filtering Process
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2 text-secondary">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Filtering completed successfully!</span>
                </div>
                <Link to="/results">
                  <Button variant="hero" size="xl" className="w-full">
                    View Results
                  </Button>
                </Link>
              </div>
            )}

            {stats.totalCandidates === 0 && (
              <div className="text-center space-y-4 p-6 bg-muted/30 rounded-lg">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="font-semibold mb-2">No Data to Process</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please upload candidate data first before running the filtering process.
                  </p>
                  <Link to="/upload">
                    <Button variant="outline">
                      Upload Raw Data
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessFilter;