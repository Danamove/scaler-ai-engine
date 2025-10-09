import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Filter, Upload, Settings, BarChart3, Users, LogOut, FileText, RotateCcw, Briefcase, Network } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
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
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRestarting, setIsRestarting] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalCandidates: 0,
    filterAccuracy: 0,
    activeJobs: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  
  const { getActiveUserId, getActiveUserEmail, isImpersonating, impersonatedUser } = useAdminImpersonation();

  const handleRestartAll = async () => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return;
    
    const activeUserEmail = getActiveUserEmail();
    const confirmRestart = window.confirm(`Are you sure you want to delete all data for ${activeUserEmail}? This action will delete all files, filtering results and filter settings.`);
    
    if (!confirmRestart) return;
    
    setIsRestarting(true);
    
    try {
      // Delete all user data in parallel
      await Promise.all([
        supabase.from('raw_data').delete().eq('user_id', activeUserId),
        supabase.from('filtered_results').delete().eq('user_id', activeUserId),
        supabase.from('filter_rules').delete().eq('user_id', activeUserId),
        supabase.from('user_blacklist').delete().eq('user_id', activeUserId),
        supabase.from('user_wanted_companies').delete().eq('user_id', activeUserId),
        supabase.from('user_past_candidates').delete().eq('user_id', activeUserId),
        supabase.from('netly_files').delete().eq('user_id', activeUserId),
        supabase.from('jobs').delete().eq('user_id', activeUserId)
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

      setStats({
        totalCandidates: totalCandidates || 0,
        filterAccuracy,
        activeJobs: 1
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
    if (user) {
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
            {isAdmin && (
              <Link to="/admin-panel">
                <Button variant="ghost" size="sm">
                  <Users className="h-4 w-4" />
                  Admin Panel
                </Button>
              </Link>
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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <CardTitle className="text-lg">Process Filter</CardTitle>
                <CardDescription>
                  Run filtering process on uploaded candidates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/process-filter">
                  <Button variant="outline" className="w-full">
                    <Filter className="h-4 w-4" />
                    Process Candidates
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
          </div>

          {/* Network Analysis and Reset Action */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="card-shadow transition-smooth hover:enterprise-shadow cursor-pointer">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Network Analysis</CardTitle>
                <CardDescription>
                  Compare results with your network connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/netly">
                  <Button variant="outline" className="w-full">
                    <Users className="h-4 w-4" />
                    Netly Analysis
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="card-shadow transition-smooth hover:enterprise-shadow cursor-pointer border-destructive/20">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 bg-destructive/10 rounded-lg flex items-center justify-center mb-2">
                  <RotateCcw className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle className="text-lg text-destructive">Reset All Data</CardTitle>
                <CardDescription>
                  Clear all data and start fresh
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      disabled={isRestarting}
                    >
                      {isRestarting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      {isRestarting ? 'Restarting...' : 'Reset All Data'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset All Data</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete all data? 
                        This action will delete all candidates, filtering results and filter settings.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleRestartAll}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Reset All Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>

          {/* Stats Overview */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Overview</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats.totalCandidates}</p>
                <p className="text-sm text-muted-foreground">Total Candidates</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-2xl font-bold text-secondary">{stats.filterAccuracy}%</p>
                <p className="text-sm text-muted-foreground">Filter Accuracy</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-2xl font-bold text-accent">{stats.activeJobs}</p>
                <p className="text-sm text-muted-foreground">Active Session</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;