import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, ArrowLeft, BarChart3, Download, Users, Building, FileText, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';
import { useCurrentJob } from '@/hooks/useCurrentJob';

interface CandidateResult {
  id: string;
  full_name: string;
  current_title: string;
  current_company: string;
  previous_company: string;
  linkedin_url: string;
  profile_summary: string;
  stage_1_passed: boolean;
  stage_2_passed: boolean;
  filter_reasons: string[];
}

interface FilterStats {
  total_candidates: number;
  stage_1_passed: number;
  stage_2_passed: number;
  final_results: number;
}

const REJECTION_REASON_FILTERS = [
  { value: 'all', label: 'Show all rejections', includes: [] },
  { value: 'blacklisted', label: 'Blacklisted company', includes: ['Blacklisted company'] },
  { value: 'past_candidate', label: 'Past candidate', includes: ['Past candidate'] },
  { value: 'not_relevant', label: 'Not relevant company', includes: ['NotRelevant company'] },
  { value: 'wanted_miss', label: 'Not in wanted companies list', includes: ['Not in wanted companies list', 'Not from target company', 'No target company match'] },
  { value: 'role_duration', label: 'Insufficient role duration', includes: ['Insufficient role duration'] },
  { value: 'missing_terms', label: 'Missing required terms', includes: ['Missing required terms'] },
  { value: 'excluded_terms', label: 'Contains excluded terms', includes: ['Contains excluded terms'] },
  { value: 'excluded_location', label: 'Excluded location detected', includes: ['Excluded location detected'] },
  { value: 'top_uni', label: 'Top university requirement not met', includes: ['Top university requirement not met'] },
] as const;

const Results = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getActiveUserId, getActiveUserEmail, isImpersonating, impersonatedUser } = useAdminImpersonation();
  const { jobId, loading: jobLoading } = useCurrentJob();
  
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [stats, setStats] = useState<FilterStats>({
    total_candidates: 0,
    stage_1_passed: 0,
    stage_2_passed: 0,
    final_results: 0
  });
  const [loadingResults, setLoadingResults] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rejectionReasonFilter, setRejectionReasonFilter] = useState<string>('all');

  useEffect(() => {
    if (!loading && !jobLoading && !user) {
      navigate('/auth');
    } else if (!loading && !jobLoading && user && jobId) {
      loadResults();
    }
  }, [user, loading, jobLoading, jobId, navigate]);

  const loadResults = async () => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return;

    try {
      setLoadingResults(true);

      const currentJobId = jobId;
      if (!currentJobId) throw new Error('No active job selected');
      console.log(`[Results] Loading results for user ${activeUserId}, job ${currentJobId}`);

      // Get all filtered results with pagination to handle large datasets
      let allResults = [];
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;

      while (hasMore) {
        let query = supabase
          .from('filtered_results')
          .select(`
            *,
            raw_data (
              id,
              full_name,
              current_title,
              current_company,
              previous_company,
              linkedin_url,
              profile_summary
            )
          `)
          .eq('user_id', activeUserId)
          .eq('job_id', currentJobId)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        const { data: resultsPage, error } = await query;

        if (error) throw error;

        if (resultsPage && resultsPage.length > 0) {
          allResults.push(...resultsPage);
          offset += pageSize;
          hasMore = resultsPage.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const filteredResults = allResults;

      // Transform data for display
      const transformedResults: CandidateResult[] = filteredResults?.map((result: any) => ({
        id: result.id,
        full_name: result.raw_data?.full_name || 'N/A',
        current_title: result.raw_data?.current_title || 'N/A',
        current_company: result.raw_data?.current_company || 'N/A',
        previous_company: result.raw_data?.previous_company || 'N/A',
        linkedin_url: result.raw_data?.linkedin_url || '',
        profile_summary: result.raw_data?.profile_summary || '',
        stage_1_passed: result.stage_1_passed,
        stage_2_passed: result.stage_2_passed,
        filter_reasons: result.filter_reasons || []
      })) || [];

      setResults(transformedResults);

      // Get total raw candidates for this job (separate query)
      const { count: rawCandidatesCount } = await supabase
        .from('raw_data')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', activeUserId)
        .eq('job_id', currentJobId);

      console.log(`[Results] Raw candidates: ${rawCandidatesCount}, Filtered results: ${transformedResults.length}`);

      // Calculate stats
      const totalCandidates = rawCandidatesCount || 0;
      const stage1Passed = transformedResults.filter(r => r.stage_1_passed).length;
      const finalResults = transformedResults.filter(r => r.stage_1_passed && r.stage_2_passed).length;
      // Stage 2 passed should be the same as final results since you can only pass stage 2 if you passed stage 1
      const stage2Passed = finalResults;

      setStats({
        total_candidates: totalCandidates,
        stage_1_passed: stage1Passed,
        stage_2_passed: stage2Passed,
        final_results: finalResults
      });

      console.log(`[Results] Stats - Total: ${totalCandidates}, Stage1: ${stage1Passed}, Stage2: ${stage2Passed}, Final: ${finalResults}`);

    } catch (error: any) {
      console.error('Load results error:', error);
      toast({
        title: "Error Loading Results",
        description: error.message || "Failed to load filtering results.",
        variant: "destructive",
      });
    } finally {
      setLoadingResults(false);
    }
  };

  const exportToCSV = (data: CandidateResult[], filename: string, includeRejectionReasons: boolean = false) => {
    const headers = includeRejectionReasons
      ? [
          'Full Name',
          'Current Title', 
          'Current Company',
          'Previous Company',
          'LinkedIn URL',
          'Profile Summary',
          'Rejection Reasons'
        ]
      : [
          'Full Name',
          'Current Title', 
          'Current Company',
          'Previous Company',
          'LinkedIn URL',
          'Profile Summary'
        ];

    const csvContent = [
      headers.join(','),
      ...data.map(row => {
        const baseData = [
          `"${row.full_name}"`,
          `"${row.current_title}"`,
          `"${row.current_company}"`,
          `"${row.previous_company}"`,
          `"${row.linkedin_url}"`,
          `"${row.profile_summary.substring(0, 100)}..."`
        ];
        
        if (includeRejectionReasons) {
          const reasons = row.filter_reasons && row.filter_reasons.length > 0 
            ? row.filter_reasons.join('; ') 
            : 'No specific reason';
          baseData.push(`"${reasons}"`);
        }
        
        return baseData.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return;

    try {
      const { error } = await supabase
        .from('filtered_results')
        .delete()
        .eq('id', candidateId)
        .eq('user_id', activeUserId)
        .eq('job_id', jobId!);

      if (error) throw error;

      // Update local state by removing the deleted candidate
      setResults(prevResults => {
        const newResults = prevResults.filter(r => r.id !== candidateId);
        
        // Update stats based on new results (keep total from raw count)
        const stage1Passed = newResults.filter(r => r.stage_1_passed).length;
        const finalResults = newResults.filter(r => r.stage_1_passed && r.stage_2_passed).length;
        const stage2Passed = finalResults;

        setStats(prev => ({
          ...prev,
          stage_1_passed: stage1Passed,
          stage_2_passed: stage2Passed,
          final_results: finalResults
        }));

        return newResults;
      });

      toast({
        title: "Candidate Deleted",
        description: "The candidate has been removed from your results.",
      });

    } catch (error: any) {
      console.error('Delete candidate error:', error);
      toast({
        title: "Delete Error",
        description: error.message || "Failed to delete candidate.",
        variant: "destructive",
      });
    }
  };

  const handleExport = async (stage: 'stage1' | 'stage2' | 'final' | 'rejected') => {
    setExporting(true);

    try {
      let dataToExport: CandidateResult[] = [];
      let filename = '';
      let includeRejectionReasons = false;
      
      switch (stage) {
        case 'stage1':
          dataToExport = results.filter(r => r.stage_1_passed);
          filename = 'stage_1_results.csv';
          break;
        case 'stage2':
          dataToExport = results.filter(r => r.stage_2_passed);
          filename = 'stage_2_results.csv';
          break;
        case 'final':
          dataToExport = results.filter(r => r.stage_1_passed && r.stage_2_passed);
          filename = 'final_results.csv';
          break;
        case 'rejected':
          dataToExport = results.filter(r => !r.stage_1_passed || !r.stage_2_passed);
          filename = 'rejected_candidates.csv';
          includeRejectionReasons = true;
          break;
      }

      exportToCSV(dataToExport, filename, includeRejectionReasons);

      toast({
        title: "Export Successful",
        description: `${dataToExport.length} candidates exported to ${filename}`,
      });

    } catch (error: any) {
      toast({
        title: "Export Error",
        description: "Failed to export results.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading || jobLoading || loadingResults) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <BarChart3 className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading filtering results...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show getting started message if no data
  if (stats.total_candidates === 0) {
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

        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="h-24 w-24 bg-muted/30 rounded-full flex items-center justify-center mx-auto">
              <BarChart3 className="h-12 w-12 text-muted-foreground" />
            </div>
            
            <div className="space-y-4">
              <h1 className="text-3xl font-bold">No Results Yet</h1>
              <p className="text-xl text-muted-foreground">
                To see filtering results, you need to complete the following steps:
              </p>
            </div>

            <div className="space-y-6 text-left">
              <div className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Upload Raw Data</h3>
                  <p className="text-muted-foreground mb-3">
                    Upload your LinkedIn scraped candidate CSV file to the system.
                  </p>
                  <Link to="/upload">
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4" />
                      Upload Data
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-secondary">2</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Configure Filters</h3>
                  <p className="text-muted-foreground mb-3">
                    Set up your filtering rules for Stage 1 and Stage 2 processing.
                  </p>
                  <Link to="/filter-config">
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4" />
                      Configure Filters
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-accent">3</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Run Filtering Process</h3>
                  <p className="text-muted-foreground mb-3">
                    Execute the filtering logic to process candidates through Stage 1 and Stage 2.
                  </p>
                  <Link to="/process-filter">
                    <Button variant="hero" size="sm">
                      <Users className="h-4 w-4" />
                      Process Candidates
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link to="/dashboard">
                <Button variant="hero">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stage1PassRate = stats.total_candidates > 0 ? (stats.stage_1_passed / stats.total_candidates) * 100 : 0;
  const stage2PassRate = stats.stage_1_passed > 0 ? (stats.stage_2_passed / stats.stage_1_passed) * 100 : 0;
  const finalPassRate = stats.total_candidates > 0 ? (stats.final_results / stats.total_candidates) * 100 : 0;

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
            {isImpersonating && impersonatedUser && (
              <Badge variant="default" className="bg-primary">
                Viewing: {impersonatedUser.email}
              </Badge>
            )}
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
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <div className="h-16 w-16 bg-accent/10 rounded-xl flex items-center justify-center mx-auto">
              <BarChart3 className="h-8 w-8 text-accent" />
            </div>
            <h1 className="text-3xl font-bold">
              {isImpersonating ? `${impersonatedUser?.email}'s Filtering Results` : 'Filtering Results'}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isImpersonating 
                ? `Analysis of ${impersonatedUser?.email}'s candidate filtering process`
                : 'Analysis of your candidate filtering process'}
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="card-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Candidates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{stats.total_candidates}</div>
                <p className="text-xs text-muted-foreground mt-1">Uploaded to system</p>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Stage 1 Passed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-secondary">{stats.stage_1_passed}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <Progress value={stage1PassRate} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground">{stage1PassRate.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Stage 2 Passed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-accent">{stats.stage_2_passed}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <Progress value={stage2PassRate} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground">{stage2PassRate.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Final Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{stats.final_results}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <Progress value={finalPassRate} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground">{finalPassRate.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Tabs */}
          <Card className="card-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Detailed Results</CardTitle>
                  <CardDescription>
                    Browse candidates by filtering stage and export results
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleExport('stage1')}
                    disabled={exporting || stats.stage_1_passed === 0}
                  >
                    <Download className="h-4 w-4" />
                    Export Stage 1
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleExport('final')}
                    disabled={exporting || stats.final_results === 0}
                  >
                    <Download className="h-4 w-4" />
                    Export Final
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleExport('rejected')}
                    disabled={exporting || (stats.total_candidates - stats.final_results) === 0}
                  >
                    <Download className="h-4 w-4" />
                    Export Rejected
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="final" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="stage1">
                    Stage 1 ({stats.stage_1_passed})
                  </TabsTrigger>
                  <TabsTrigger value="stage2">
                    Stage 2 ({stats.stage_2_passed})
                  </TabsTrigger>
                  <TabsTrigger value="final">
                    Final Results ({stats.final_results})
                  </TabsTrigger>
                  <TabsTrigger value="rejected">
                    Rejected ({stats.total_candidates - stats.final_results})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="stage1" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Candidates who passed Stage 1 (Company & Lists filtering)
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleExport('stage1')}
                      disabled={exporting || stats.stage_1_passed === 0}
                    >
                      <Download className="h-4 w-4" />
                      Export Stage 1
                    </Button>
                  </div>
                      <CandidateTable 
                        candidates={results.filter(r => r.stage_1_passed)}
                        showStageInfo={false}
                        onDeleteCandidate={handleDeleteCandidate}
                      />
                </TabsContent>

                <TabsContent value="stage2" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Candidates who passed Stage 2 (User Rules filtering)
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleExport('stage2')}
                      disabled={exporting || stats.stage_2_passed === 0}
                    >
                      <Download className="h-4 w-4" />
                      Export Stage 2
                    </Button>
                  </div>
                      <CandidateTable 
                        candidates={results.filter(r => r.stage_2_passed)}
                        showStageInfo={false}
                        onDeleteCandidate={handleDeleteCandidate}
                      />
                </TabsContent>

                <TabsContent value="final" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Final candidates who passed both Stage 1 and Stage 2
                    </p>
                    <Button 
                      variant="hero" 
                      size="sm"
                      onClick={() => handleExport('final')}
                      disabled={exporting || stats.final_results === 0}
                    >
                      <Download className="h-4 w-4" />
                      Export Final Results
                    </Button>
                  </div>
                  <CandidateTable 
                    candidates={results.filter(r => r.stage_1_passed && r.stage_2_passed)} 
                    showStageInfo={true}
                    onDeleteCandidate={handleDeleteCandidate}
                  />
                </TabsContent>

                <TabsContent value="rejected" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Candidates who were rejected during the filtering process
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleExport('rejected')}
                      disabled={exporting || (stats.total_candidates - stats.final_results) === 0}
                    >
                      <Download className="h-4 w-4" />
                      Export Rejected
                    </Button>
                  </div>
                  
                  {/* Rejection Reason Filter */}
                  <div className="flex items-center space-x-4">
                    <label htmlFor="rejection-filter" className="text-sm font-medium">
                      Filter by rejection reason:
                    </label>
                    <Select value={rejectionReasonFilter} onValueChange={setRejectionReasonFilter}>
                      <SelectTrigger className="w-72">
                        <SelectValue placeholder="Select rejection reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {REJECTION_REASON_FILTERS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <CandidateTable 
                    candidates={results.filter(r => {
                      const isRejected = !r.stage_1_passed || !r.stage_2_passed;
                      if (!isRejected) return false;
                      
                      if (rejectionReasonFilter === 'all') return true;
                      
                      const def = REJECTION_REASON_FILTERS.find(d => d.value === rejectionReasonFilter);
                      if (!def) return true;
                      
                      return r.filter_reasons?.some(reason =>
                        def.includes.some(substr => reason.includes(substr))
                      ) || false;
                    })}
                    showStageInfo={false}
                    showRejectionReasons={true}
                    onDeleteCandidate={handleDeleteCandidate}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface CandidateTableProps {
  candidates: CandidateResult[];
  showStageInfo: boolean;
  showRejectionReasons?: boolean;
  onDeleteCandidate?: (candidateId: string) => void;
}

const CandidateTable = ({ candidates, showStageInfo, showRejectionReasons = false, onDeleteCandidate }: CandidateTableProps) => {
  if (candidates.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No candidates found</h3>
        <p className="text-muted-foreground">
          No candidates passed this filtering stage.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Current Title</TableHead>
            <TableHead>Current Company</TableHead>
            <TableHead>Previous Company</TableHead>
            {showStageInfo && <TableHead>Status</TableHead>}
            {showRejectionReasons && <TableHead>Rejection Reasons</TableHead>}
            <TableHead>LinkedIn</TableHead>
            {onDeleteCandidate && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.id}>
              <TableCell className="font-medium">{candidate.full_name}</TableCell>
              <TableCell>{candidate.current_title}</TableCell>
              <TableCell>{candidate.current_company}</TableCell>
              <TableCell>{candidate.previous_company || 'N/A'}</TableCell>
              {showStageInfo && (
                <TableCell>
                  <div className="flex space-x-1">
                    <Badge variant={candidate.stage_1_passed ? "default" : "destructive"} className="text-xs">
                      S1: {candidate.stage_1_passed ? 'Pass' : 'Fail'}
                    </Badge>
                    <Badge variant={candidate.stage_2_passed ? "default" : "destructive"} className="text-xs">
                      S2: {candidate.stage_2_passed ? 'Pass' : 'Fail'}
                    </Badge>
                  </div>
                </TableCell>
              )}
              {showRejectionReasons && (
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {candidate.filter_reasons && candidate.filter_reasons.length > 0 ? (
                      candidate.filter_reasons.map((reason, index) => (
                        <Badge key={index} variant="destructive" className="text-xs">
                          {reason}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        No specific reason
                      </Badge>
                    )}
                  </div>
                </TableCell>
              )}
              <TableCell>
                {candidate.linkedin_url ? (
                  <Button variant="link" size="sm" asChild className="p-0 h-auto">
                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer">
                      View Profile
                    </a>
                  </Button>
                ) : (
                  'N/A'
                )}
              </TableCell>
              {onDeleteCandidate && (
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {candidate.full_name}? This will remove them from your results and exports. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => onDeleteCandidate(candidate.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default Results;