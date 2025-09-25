import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Filter, Upload, Settings, BarChart3, Users, LogOut, FileText, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';

interface DashboardStats {
  totalCandidates: number;
  filterAccuracy: number;
  activeJobs: number;
}

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRestarting, setIsRestarting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalCandidates: 0,
    filterAccuracy: 0,
    activeJobs: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const { getActiveUserId, getActiveUserEmail, isImpersonating, impersonatedUser } = useAdminImpersonation();

  const handleRestart = async () => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return;
    
    const activeUserEmail = getActiveUserEmail();
    const confirmRestart = window.confirm(`Are you sure you want to restart data for ${activeUserEmail}? This action will delete all existing data (CSV files, filtering results, filter settings).`);
    
    if (!confirmRestart) return;
    
    setIsRestarting(true);
    
    try {
      // Delete all user data in parallel
      await Promise.all([
        supabase.from('raw_data').delete().eq('user_id', activeUserId),
        supabase.from('filtered_results').delete().eq('user_id', activeUserId),
        supabase.from('filter_rules').delete().eq('user_id', activeUserId),
        supabase.from('user_blacklist').delete().eq('user_id', activeUserId),
        supabase.from('user_past_candidates').delete().eq('user_id', activeUserId),
        supabase.from('netly_files').delete().eq('user_id', activeUserId)
      ]);
      
      toast({
        title: "Restart completed successfully",
        description: `All data has been deleted for ${activeUserEmail}. You can start fresh.`,
      });
      
      // Navigate to upload page to start fresh
      navigate('/upload');
      
    } catch (error: any) {
      console.error('Restart error:', error);
      toast({
        title: "Restart Error",
        description: error.message || "Failed to delete data.",
        variant: "destructive",
      });
    } finally {
      setIsRestarting(false);
    }
  };

  const fetchDashboardStats = async () => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return;

    setStatsLoading(true);
    try {
      // Fetch total candidates processed
      const { count: totalCandidates } = await supabase
        .from('raw_data')
        .select('*', { count: 'exact' })
        .eq('user_id', activeUserId);

      // Fetch filtered results for accuracy calculation
      const { data: filteredResults } = await supabase
        .from('filtered_results')
        .select('stage_1_passed, stage_2_passed')
        .eq('user_id', activeUserId);

      // Calculate filter accuracy
      let filterAccuracy = 0;
      if (filteredResults && filteredResults.length > 0) {
        const passedCandidates = filteredResults.filter(result => 
          result.stage_1_passed && result.stage_2_passed
        ).length;
        filterAccuracy = Math.round((passedCandidates / filteredResults.length) * 100);
      }

      // Fetch unique job IDs (active jobs)
      const { data: jobIds } = await supabase
        .from('filter_rules')
        .select('job_id')
        .eq('user_id', activeUserId);

      const uniqueJobIds = new Set(jobIds?.map(row => row.job_id) || []);
      const activeJobs = uniqueJobIds.size;

      setStats({
        totalCandidates: totalCandidates || 0,
        filterAccuracy,
        activeJobs
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.email === 'dana@added-value.co.il') {
        setIsAdmin(true);
      }
    };
    
    if (user) {
      checkAdminStatus();
      fetchDashboardStats();
    }
  }, [user, getActiveUserId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Filter className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
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
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">
              {isImpersonating ? `Viewing ${impersonatedUser?.email}'s Data` : 'Welcome back!'}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isImpersonating 
                ? `Manage filtering workflows for ${impersonatedUser?.email}`
                : 'Manage your candidate filtering workflows and access powerful admin tools'
              }
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card className="card-shadow transition-smooth hover:enterprise-shadow cursor-pointer">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Upload Raw Data</CardTitle>
                <CardDescription>
                  Upload candidate CSV files to start filtering
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/upload">
                  <Button variant="default" className="w-full">
                    <Upload className="h-4 w-4" />
                    Upload Files
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="card-shadow transition-smooth hover:enterprise-shadow cursor-pointer">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-2">
                  <Settings className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle className="text-lg">Filter Settings</CardTitle>
                <CardDescription>
                  Configure filtering rules and parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/filter-config">
                  <Button variant="secondary" className="w-full">
                    <Settings className="h-4 w-4" />
                    Configure
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="card-shadow transition-smooth hover:enterprise-shadow cursor-pointer">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center mb-2">
                  <BarChart3 className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-lg">View Results</CardTitle>
                <CardDescription>
                  Analyze filtering results and export data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/results">
                  <Button variant="outline" className="w-full">
                    <BarChart3 className="h-4 w-4" />
                    View Results
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {isAdmin && (
              <Card className="card-shadow transition-smooth hover:enterprise-shadow cursor-pointer">
                <CardHeader className="pb-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Admin Panel</CardTitle>
                  <CardDescription>
                    Manage companies, synonyms, users and API costs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/admin-panel">
                    <Button variant="outline" className="w-full">
                      <Users className="h-4 w-4" />
                      Admin Dashboard
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card className="card-shadow transition-smooth hover:enterprise-shadow cursor-pointer border-destructive/20">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 bg-destructive/10 rounded-lg flex items-center justify-center mb-2">
                  <RotateCcw className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle className="text-lg text-destructive">Restart Project</CardTitle>
                <CardDescription>
                  Clear all data and start fresh
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={handleRestart}
                  disabled={isRestarting}
                >
                  {isRestarting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  {isRestarting ? 'Restarting...' : 'Restart'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity & Stats */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 card-shadow">
              <CardHeader>
                <CardTitle>Recent Filtering Jobs</CardTitle>
                <CardDescription>
                  Your latest candidate filtering operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Senior Developers - Q1 2024</p>
                        <p className="text-sm text-muted-foreground">Uploaded 2 hours ago</p>
                      </div>
                    </div>
                    <Badge variant="secondary">Processing</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-secondary/20 rounded-full flex items-center justify-center">
                        <FileText className="h-4 w-4 text-secondary" />
                      </div>
                      <div>
                        <p className="font-medium">Product Managers - Tech</p>
                        <p className="text-sm text-muted-foreground">Completed yesterday</p>
                      </div>
                    </div>
                    <Badge variant="outline">Completed</Badge>
                  </div>

                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No more recent activities</p>
                    <Link to="/upload">
                      <Button variant="outline">
                        <Upload className="h-4 w-4" />
                        Upload New Data
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>
                  Overview of your filtering performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-primary">
                      {statsLoading ? '...' : stats.totalCandidates.toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Candidates Processed</p>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-secondary">
                      {statsLoading ? '...' : `${stats.filterAccuracy}%`}
                    </div>
                    <p className="text-sm text-muted-foreground">Filter Accuracy</p>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-accent">
                      {statsLoading ? '...' : stats.activeJobs}
                    </div>
                    <p className="text-sm text-muted-foreground">Active Jobs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;