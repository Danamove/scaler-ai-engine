import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Filter, Upload, Settings, BarChart3, Users, LogOut, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

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
            <h1 className="text-2xl font-bold text-foreground">Filterly</h1>
          </div>
          <div className="flex items-center space-x-4">
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
              Welcome back!
            </h1>
            <p className="text-xl text-muted-foreground">
              Manage your candidate filtering workflows and access powerful admin tools
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
                <CardTitle className="text-lg">View Results</CardTitle>
                <CardDescription>
                  Analyze filtering results and export data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <BarChart3 className="h-4 w-4" />
                  View Results
                </Button>
              </CardContent>
            </Card>

            <Card className="card-shadow transition-smooth hover:enterprise-shadow cursor-pointer">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Admin Panel</CardTitle>
                <CardDescription>
                  Manage built-in lists and system settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <Users className="h-4 w-4" />
                  Admin Tools
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
                    <div className="text-3xl font-bold text-primary">1,247</div>
                    <p className="text-sm text-muted-foreground">Total Candidates Processed</p>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-secondary">89%</div>
                    <p className="text-sm text-muted-foreground">Filter Accuracy</p>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-accent">12</div>
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