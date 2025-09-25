import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Filter, ArrowLeft, DollarSign, Activity, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ApiCost {
  id: string;
  user_id: string;
  function_name: string;
  tokens_used: number;
  cost_usd: number;
  created_at: string;
}

interface CostSummary {
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  todayCost: number;
}

const AdminCosts = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [costs, setCosts] = useState<ApiCost[]>([]);
  const [summary, setSummary] = useState<CostSummary>({
    totalCost: 0,
    totalTokens: 0,
    totalCalls: 0,
    todayCost: 0
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCosts();
    }
  }, [user]);

  const fetchCosts = async () => {
    try {
      const { data: costs, error } = await supabase
        .from('api_costs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setCosts(costs || []);
      
      // Calculate summary
      const totalCost = costs?.reduce((sum, cost) => sum + Number(cost.cost_usd || 0), 0) || 0;
      const totalTokens = costs?.reduce((sum, cost) => sum + (cost.tokens_used || 0), 0) || 0;
      const totalCalls = costs?.length || 0;
      
      const today = new Date().toDateString();
      const todayCost = costs?.filter(cost => 
        new Date(cost.created_at).toDateString() === today
      ).reduce((sum, cost) => sum + Number(cost.cost_usd || 0), 0) || 0;

      setSummary({
        totalCost,
        totalTokens,
        totalCalls,
        todayCost
      });

    } catch (error: any) {
      console.error('Error fetching costs:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch API costs.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Filter className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading admin costs...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Scaler Admin</h1>
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
        <div className="space-y-8">
          {/* Page Header */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">API Cost Tracking</h1>
            <p className="text-xl text-muted-foreground">
              Monitor OpenAI API usage and costs across all users
            </p>
          </div>

          {/* Cost Summary Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="card-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All time API usage
                </p>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Today's Cost</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.todayCost)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Today's usage
                </p>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(summary.totalTokens)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tokens consumed
                </p>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">API Calls</CardTitle>
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(summary.totalCalls)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total requests
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cost Details Table */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Recent API Usage</CardTitle>
              <CardDescription>
                Detailed breakdown of API calls and costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Function</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No API costs recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      costs.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell>
                            {new Date(cost.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {cost.function_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {cost.user_id.substring(0, 8)}...
                          </TableCell>
                          <TableCell>{formatNumber(cost.tokens_used || 0)}</TableCell>
                          <TableCell>{formatCurrency(Number(cost.cost_usd || 0))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminCosts;