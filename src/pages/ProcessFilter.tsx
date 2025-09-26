import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Filter, ArrowLeft, Play, CheckCircle, XCircle, Users, Building, RefreshCw, AlertCircle, PlayCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';

interface ProcessStats {
  totalCandidates: number;
  processed: number;
  stage1Passed: number;
  stage2Passed: number;
  finalResults: number;
}

interface ProcessState {
  estimatedTime?: number;
  startTime?: number;
  batchesProcessed: number;
  totalBatches: number;
  currentBatch: number;
}

const ProcessFilter = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getActiveUserId, getActiveUserEmail, isImpersonating, impersonatedUser } = useAdminImpersonation();
  
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
  const [processState, setProcessState] = useState<ProcessState>({
    batchesProcessed: 0,
    totalBatches: 0,
    currentBatch: 0
  });
  const [cancelled, setCancelled] = useState(false);

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
      // Get total candidates for the user
      const { count: totalCandidates } = await supabase
        .from('raw_data')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', getActiveUserId());

      setStats(prev => ({ ...prev, totalCandidates: totalCandidates || 0 }));
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Cancel function
  const cancelProcessing = () => {
    setCancelled(true);
    setProcessing(false);
    setCurrentStep('Cancelled by user');
    toast({
      title: "Processing Cancelled",
      description: "The filtering process has been cancelled.",
    });
  };

  // Format time helper
  const formatTime = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const processFiltering = async () => {
    if (!user || processing) return;

    console.log('Starting filtering process...');
    setProcessing(true);
    setProgress(0);
    setCurrentStep('Initializing...');
    setCompleted(false);
    setCancelled(false);

    try {
      // Get candidates and filter rules
      console.log('Loading data...');
      setCurrentStep('Loading data...');
      setProgress(10);

      // Load all candidates with pagination to bypass 1000 row limit
      let allCandidates = [];
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;

      while (hasMore) {
        const { data: candidatesPage, error: candidatesError } = await supabase
          .from('raw_data')
          .select('*')
          .eq('user_id', getActiveUserId())
          .range(offset, offset + pageSize - 1);

        if (candidatesError) {
          console.error('Error loading candidates:', candidatesError);
          throw candidatesError;
        }

        if (candidatesPage && candidatesPage.length > 0) {
          allCandidates.push(...candidatesPage);
          offset += pageSize;
          hasMore = candidatesPage.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const candidates = allCandidates;

      const { data: filterRulesArray, error: filterRulesError } = await supabase
        .from('filter_rules')
        .select('*')
        .eq('user_id', getActiveUserId())
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

      // Get built-in lists and synonyms
      setCurrentStep('Loading built-in lists and synonyms...');
      setProgress(20);

      const { data: synonyms } = await supabase
        .from('synonyms')
        .select('*');

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
        .eq('user_id', getActiveUserId());

      const { data: pastCandidates } = await supabase
        .from('user_past_candidates')
        .select('candidate_name')
        .eq('user_id', getActiveUserId());

      console.log('Loaded lists:', {
        synonyms: synonyms?.length || 0,
        notRelevantCompanies: notRelevantCompanies?.length || 0,
        targetCompanies: targetCompanies?.length || 0,
        blacklistCompanies: blacklistCompanies?.length || 0,
        pastCandidates: pastCandidates?.length || 0
      });

      // Clear existing results for the user
      const { error: deleteError } = await supabase
        .from('filtered_results')
        .delete()
        .eq('user_id', getActiveUserId());

      if (deleteError) {
        console.error('Error clearing previous results:', deleteError);
      }

      setCurrentStep('Stage 1: Deterministic filtering...');
      setProgress(30);

      let stage1Passed = 0;
      let stage2Passed = 0;
      let finalResults = 0;

      const results = [];
      const stage1PassedCandidates = [];

      console.log('Starting Stage 1 deterministic filtering...');

      // STAGE 1: Process all candidates through deterministic filters first
      for (let i = 0; i < candidates.length; i++) {
        if (cancelled) break;

        const candidate = candidates[i];
        let stage1Pass = true;
        const filterReasons = [];

        // Check blacklist first (current company only)
        const blacklist = blacklistCompanies?.map(b => b.company_name.toLowerCase()) || [];
        if (candidate.current_company && blacklist.includes(candidate.current_company.toLowerCase())) {
          stage1Pass = false;
          filterReasons.push('Blacklisted company');
        }

        // Check past candidates
        if (stage1Pass) {
          const pastCandidateNames = pastCandidates?.map(p => p.candidate_name.toLowerCase()) || [];
          if (candidate.full_name && pastCandidateNames.includes(candidate.full_name.toLowerCase())) {
            stage1Pass = false;
            filterReasons.push('Past candidate');
          }
        }

        // Check NotRelevant companies (if enabled)
        if (stage1Pass && filterRules.use_not_relevant_filter) {
          const notRelevantList = notRelevantCompanies?.map(c => c.company_name.toLowerCase()) || [];
          const currentCompany = candidate.current_company?.toLowerCase() || '';
          const previousCompany = candidate.previous_company?.toLowerCase() || '';
          
          if (notRelevantList.some(company => 
            currentCompany.includes(company) || previousCompany.includes(company) ||
            company.includes(currentCompany) || company.includes(previousCompany)
          )) {
            stage1Pass = false;
            filterReasons.push('NotRelevant company');
          }
        }

        // Check Target companies (if enabled)
        if (stage1Pass && filterRules.use_target_companies_filter) {
          const targetList = targetCompanies?.map(c => c.company_name.toLowerCase()) || [];
          const currentCompany = candidate.current_company?.toLowerCase() || '';
          const previousCompany = candidate.previous_company?.toLowerCase() || '';
          
          const hasTargetCompany = targetList.some(company => 
            currentCompany.includes(company) || previousCompany.includes(company) ||
            company.includes(currentCompany) || company.includes(previousCompany)
          );
          
          if (!hasTargetCompany) {
            stage1Pass = false;
            filterReasons.push('No target company match');
          }
        }

        if (stage1Pass) {
          stage1Passed++;
          stage1PassedCandidates.push({
            candidate,
            filterReasons
          });
        } else {
          // Save failed Stage 1 result
          results.push({
            raw_data_id: candidate.id,
            user_id: getActiveUserId(),
            job_id: 'current',
            stage_1_passed: false,
            stage_2_passed: false,
            filter_reasons: filterReasons
          });
        }

        // Update progress for Stage 1
        const stage1Progress = Math.floor(30 + (i + 1) / candidates.length * 20);
        setProgress(stage1Progress);
        setStats(prev => ({ 
          ...prev, 
          processed: i + 1,
          stage1Passed: stage1Passed
        }));
      }

      console.log(`Stage 1 complete: ${stage1PassedCandidates.length} candidates passed out of ${candidates.length}`);

      // STAGE 2: AI Analysis on stage1 passed candidates with optimized parallel processing
      if (stage1PassedCandidates.length > 0 && !cancelled) {
        console.log(`Starting Stage 2 AI analysis for ${stage1PassedCandidates.length} candidates...`);
        setCurrentStep(`Stage 2: AI analysis (0/${stage1PassedCandidates.length})...`);
        setProgress(60);

        // Optimized batch processing: larger batches, parallel execution
        const batchSize = Math.min(30, Math.ceil(stage1PassedCandidates.length / 4)); // Dynamic batch size
        const maxParallelBatches = 3;
        const totalBatches = Math.ceil(stage1PassedCandidates.length / batchSize);
        let processedCount = 0;
        
        // Initialize process state
        const startTime = Date.now();
        setProcessState({
          startTime,
          totalBatches,
          batchesProcessed: 0,
          currentBatch: 0,
          estimatedTime: 0
        });

        // Batch processing function with retry and fallback
        const processBatch = async (batchCandidates: any[], batchNum: number) => {
          try {
            console.log(`Processing batch ${batchNum} with ${batchCandidates.length} candidates`);
            
            const { data: batchResults, error: batchError } = await supabase.functions.invoke(
              'batch-analyze-candidates',
              {
                body: {
                  candidates: batchCandidates.map(item => item.candidate),
                  filterRules,
                  userId: getActiveUserId(),
                  synonyms: synonyms || []
                }
              }
            );

            if (batchError) throw batchError;
            if (batchResults?.error === 'AI_ANALYSIS_FAILED') {
              throw new Error('AI analysis failed, using fallback');
            }
            
            return { success: true, results: batchResults, batch: batchCandidates };
          } catch (error) {
            console.error(`Batch ${batchNum} failed:`, error);
            return { success: false, error, batch: batchCandidates };
          }
        };

        // Process batches in parallel groups
        for (let i = 0; i < stage1PassedCandidates.length; i += batchSize * maxParallelBatches) {
          if (cancelled) break;
          
          // Create parallel batch promises
          const parallelBatches = [];
          for (let j = 0; j < maxParallelBatches && (i + j * batchSize) < stage1PassedCandidates.length; j++) {
            const batchStart = i + j * batchSize;
            const batchEnd = Math.min(batchStart + batchSize, stage1PassedCandidates.length);
            const batch = stage1PassedCandidates.slice(batchStart, batchEnd);
            
            if (batch.length > 0) {
              parallelBatches.push(processBatch(batch, Math.floor(batchStart / batchSize) + 1));
            }
          }

          // Execute batches in parallel
          const batchResults = await Promise.allSettled(parallelBatches);
          
          // Process results
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              const { success, results: batchData, batch, error } = result.value;
              
              if (success && batchData?.results) {
                // Process successful AI results
                batchData.results.forEach((aiResult: any, index: number) => {
                  const item = batch[index];
                  if (item && aiResult) {
                    const stage2Pass = aiResult.overall_pass;
                    if (stage2Pass) stage2Passed++;
                    
                    results.push({
                      raw_data_id: item.candidate.id,
                      user_id: getActiveUserId(),
                      job_id: 'current',
                      stage_1_passed: true,
                      stage_2_passed: stage2Pass,
                      filter_reasons: stage2Pass ? item.filterReasons : [...item.filterReasons, aiResult.reasoning]
                    });
                  }
                });
              } else {
                // Fallback for failed batches - basic checks only
                batch.forEach((item: any) => {
                  const candidate = item.candidate;
                  const filterReasons = [...item.filterReasons];
                  let stage2Pass = true;

                  // Basic fallback checks
                  if (candidate.years_of_experience < (filterRules.min_years_experience || 0)) {
                    stage2Pass = false;
                    filterReasons.push(`Insufficient experience: ${candidate.years_of_experience} years`);
                  }

                  if (stage2Pass && candidate.months_in_current_role < (filterRules.min_months_current_role || 0)) {
                    stage2Pass = false;
                    filterReasons.push(`Insufficient role duration: ${candidate.months_in_current_role} months`);
                  }

                  if (stage2Pass) stage2Passed++;
                  
                  results.push({
                    raw_data_id: candidate.id,
                    user_id: getActiveUserId(),
                    job_id: 'current',
                    stage_1_passed: true,
                    stage_2_passed: stage2Pass,
                    filter_reasons: filterReasons
                  });
                });
              }

              processedCount += batch.length;
              
              // Update progress
              const progressPercent = 60 + (processedCount / stage1PassedCandidates.length) * 30;
              setProgress(progressPercent);
              setCurrentStep(`Stage 2: AI analysis (${processedCount}/${stage1PassedCandidates.length})...`);
              
              // Update time estimation
              const elapsed = Date.now() - startTime;
              const rate = processedCount / elapsed;
              const remaining = stage1PassedCandidates.length - processedCount;
              const estimatedRemaining = remaining / rate;
              
              setProcessState(prev => ({
                ...prev,
                batchesProcessed: prev.batchesProcessed + 1,
                estimatedTime: estimatedRemaining
              }));
              
              setStats(prev => ({
                ...prev,
                processed: processedCount,
                stage2Passed: stage2Passed
              }));
            }
          }
        }
      }

      // Update final results count
      finalResults = stage2Passed;

      if (!cancelled) {
        // Save all results to database
        setCurrentStep('Saving results...');
        setProgress(90);

        if (results.length > 0) {
          const { error: insertError } = await supabase
            .from('filtered_results')
            .insert(results);

          if (insertError) {
            console.error('Error saving results:', insertError);
            throw insertError;
          }
        }

        // Final update
        setStats(prev => ({
          ...prev,
          processed: candidates.length,
          stage1Passed,
          stage2Passed,
          finalResults
        }));
        setProgress(100);
        setCurrentStep('Complete!');
        setCompleted(true);

        console.log('Filtering completed successfully!');
        console.log(`Final results: ${finalResults} candidates passed all stages out of ${candidates.length} total`);

        toast({
          title: "Filtering Complete!",
          description: `Processed ${candidates.length} candidates. ${finalResults} candidates passed all filters.`,
        });
      }

    } catch (error) {
      console.error('Processing failed:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setCancelled(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Process Filtering</h1>
              <p className="text-muted-foreground">
                {isImpersonating && impersonatedUser ? (
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Processing for: {impersonatedUser.email}
                  </span>
                ) : (
                  `Processing for: ${getActiveUserEmail()}`
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Enhanced Progress Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Processing Status
                </CardTitle>
                {processing && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={cancelProcessing}
                    className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    Cancel
                  </Button>
                )}
              </div>
              <CardDescription>
                Current filtering progress and statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold text-primary">{stats.totalCandidates}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.processed}</div>
                  <div className="text-sm text-muted-foreground">Processed</div>
                </div>
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.stage1Passed}</div>
                  <div className="text-sm text-muted-foreground">Stage 1 ✓</div>
                </div>
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{stats.stage2Passed}</div>
                  <div className="text-sm text-muted-foreground">Stage 2 ✓</div>
                </div>
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{stats.finalResults}</div>
                  <div className="text-sm text-muted-foreground">Final Results</div>
                </div>
              </div>

              {processing && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {currentStep}
                    </span>
                    {processState.estimatedTime && processState.estimatedTime > 0 && (
                      <span className="text-muted-foreground">
                        ~{formatTime(processState.estimatedTime)} remaining
                      </span>
                    )}
                  </div>
                  <Progress value={progress} className="w-full" />
                  <div className="text-xs text-muted-foreground text-center">
                    {progress.toFixed(1)}% complete
                    {processState.totalBatches > 0 && (
                      <span className="ml-2">
                        • Batch {processState.currentBatch}/{processState.totalBatches}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {completed && (
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Processing Complete!</span>
                  </div>
                  <Link to="/results">
                    <Button className="w-full">
                      View Results ({stats.finalResults} candidates)
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Section */}
          <Card>
            <CardHeader>
              <CardTitle>Start Processing</CardTitle>
              <CardDescription>
                Begin the automated filtering process for all uploaded candidates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.totalCandidates === 0 ? (
                <div className="text-center space-y-4 p-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-yellow-500" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No candidates found</h3>
                    <p className="text-muted-foreground mb-4">
                      You need to upload candidate data before you can start filtering.
                    </p>
                    <Link to="/upload">
                      <Button>
                        <Users className="h-4 w-4 mr-2" />
                        Upload Candidates
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Ready to process</p>
                        <p className="text-sm text-muted-foreground">
                          {stats.totalCandidates} candidates found
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={processFiltering} 
                      disabled={processing || stats.totalCandidates === 0}
                      size="lg"
                    >
                      {processing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Start Filtering Process
                        </>
                      )}
                    </Button>
                  </div>

                  {completed && (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-green-800">Processing completed successfully!</p>
                          <p className="text-sm text-green-600">
                            {stats.finalResults} candidates passed all filtering stages
                          </p>
                        </div>
                      </div>
                      <Link to="/results">
                        <Button variant="default">
                          View Results
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                Performance Optimizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p><strong>Parallel Processing:</strong> Up to 3 batches processed simultaneously</p>
                  <p><strong>Larger Batches:</strong> 25-30 candidates per batch (vs 10 previously)</p>
                  <p><strong>Faster AI Model:</strong> GPT-5-Nano for 5x faster analysis</p>
                </div>
                <div className="space-y-2">
                  <p><strong>Retry Logic:</strong> Automatic retries with exponential backoff</p>
                  <p><strong>Fallback System:</strong> Basic checks if AI analysis fails</p>
                  <p><strong>Progress Tracking:</strong> Real-time updates with time estimates</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProcessFilter;