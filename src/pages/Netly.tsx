import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Filter, ArrowLeft, Network, Upload, Users, FileText, Trash2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';
import { FileUpload } from '@/components/FileUpload';
import Papa from 'papaparse';

interface FilteredCandidate {
  id: string;
  full_name: string;
  current_title: string;
  current_company: string;
  linkedin_url: string;
  stage_1_passed: boolean;
  stage_2_passed: boolean;
}

interface NetworkConnection {
  name: string;
  title: string;
  company: string;
  relationship: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
}

interface NetworkMatch {
  candidate: FilteredCandidate;
  connections: NetworkConnection[];
  matchScore: number;
}

const Netly = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getActiveUserId, getActiveUserEmail, isImpersonating, impersonatedUser } = useAdminImpersonation();
  
  const [filteredCandidates, setFilteredCandidates] = useState<FilteredCandidate[]>([]);
  const [networkData, setNetworkData] = useState<NetworkConnection[]>([]);
  const [matches, setMatches] = useState<NetworkMatch[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadFilteredCandidates();
    }
  }, [user]);

  const loadFilteredCandidates = async () => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return;

    setIsLoadingCandidates(true);
    try {
      // Get candidates that passed both filtering stages
      const { data: results, error } = await supabase
        .from('filtered_results')
        .select(`
          id,
          stage_1_passed,
          stage_2_passed,
          raw_data!inner(
            id,
            full_name,
            current_title,
            current_company,
            linkedin_url
          )
        `)
        .eq('user_id', activeUserId)
        .eq('stage_1_passed', true)
        .eq('stage_2_passed', true);

      if (error) throw error;

      const candidates = results?.map(result => ({
        id: result.raw_data.id,
        full_name: result.raw_data.full_name,
        current_title: result.raw_data.current_title,
        current_company: result.raw_data.current_company,
        linkedin_url: result.raw_data.linkedin_url,
        stage_1_passed: result.stage_1_passed,
        stage_2_passed: result.stage_2_passed
      })) || [];

      setFilteredCandidates(candidates);
    } catch (error: any) {
      console.error('Error loading filtered candidates:', error);
      toast({
        title: "Error",
        description: "Failed to load filtered candidates",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const parseNetworkFile = (file: File): Promise<NetworkConnection[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h: string) => h.trim(),
        complete: (results) => {
          try {
            const connections = (results.data as any[])
              .filter(row => Object.values(row).some(v => String(v ?? '').trim().length > 0))
              .map(row => {
                // Look for LinkedIn URL in various common field names
                const linkedinUrl = row.linkedinProfileUrl || row.linkedinUrl || row['LinkedIn URL'] || 
                                   row.profileUrl || row.linkedin_profile_url || row['Profile URL'] || 
                                   row.linkedIn || row.linkedin || '';
                
                return {
                  name: `${row.firstName || ''} ${row.lastName || ''}`.trim(),
                  title: row.title || row.jobTitle || '',
                  company: row.company || row.companyName || '',
                  relationship: row.relationship || row.connectionType || 'Connection',
                  email: row.email || '',
                  phone: row.phone || row.phoneNumber || '',
                  linkedin_url: linkedinUrl || ''
                };
              });
            resolve(connections);
          } catch (error) {
            reject(error);
          }
        },
        error: reject
      });
    });
  };

  const handleNetworkUpload = async (file: File) => {
    try {
      const connections = await parseNetworkFile(file);
      setNetworkData(connections);
      
      toast({
        title: "Network File Uploaded",
        description: `Loaded ${connections.length} network connections`,
      });

      // Automatically analyze matches
      analyzeMatches(connections);
    } catch (error: any) {
      toast({
        title: "Upload Error",
        description: "Failed to parse network file",
        variant: "destructive",
      });
    }
  };

  const analyzeMatches = (connections: NetworkConnection[] = networkData) => {
    setIsAnalyzing(true);
    
    try {
      console.log(`Starting analysis with ${filteredCandidates.length} candidates and ${connections.length} network connections`);
      const foundMatches: NetworkMatch[] = [];

      filteredCandidates.forEach(candidate => {
        const candidateConnections: NetworkConnection[] = [];

        connections.forEach(connection => {
          let isMatch = false;
          let matchType = '';

          // Normalize names for exact matching
          const candidateName = candidate.full_name.toLowerCase().trim();
          const connectionName = connection.name.toLowerCase().trim();
          
          // Normalize LinkedIn URLs for matching
          const candidateLinkedIn = candidate.linkedin_url?.toLowerCase().trim() || '';
          const connectionLinkedIn = connection.linkedin_url?.toLowerCase().trim() || '';

          // Match by exact full name
          if (candidateName && connectionName && candidateName === connectionName) {
            isMatch = true;
            matchType = 'Name';
          }
          
          // Match by LinkedIn URL (if both exist and are the same)
          if (!isMatch && candidateLinkedIn && connectionLinkedIn && 
              candidateLinkedIn === connectionLinkedIn) {
            isMatch = true;
            matchType = 'LinkedIn URL';
          }

          // Only add connection if there's an exact match
          if (isMatch) {
            candidateConnections.push(connection);
            console.log(`Match found: ${candidate.full_name} <-> ${connection.name} (${matchType})`);
          }
        });

        // Only add candidates that have exact matches
        if (candidateConnections.length > 0) {
          foundMatches.push({
            candidate,
            connections: candidateConnections,
            matchScore: candidateConnections.length // Simple count of matches
          });
        }
      });

      // Sort by number of connections (highest first)
      foundMatches.sort((a, b) => b.connections.length - a.connections.length);
      setMatches(foundMatches);

      console.log(`Analysis complete: ${foundMatches.length} exact matches found out of ${filteredCandidates.length} candidates`);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${foundMatches.length} candidates with exact network matches out of ${filteredCandidates.length} filtered candidates`,
      });
    } catch (error) {
      console.error('Network analysis error:', error);
      toast({
        title: "Analysis Error",
        description: "Failed to analyze network matches",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearNetworkData = () => {
    setNetworkData([]);
    setMatches([]);
    toast({
      title: "Network Data Cleared",
      description: "You can now upload a new network file",
    });
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
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {isImpersonating ? `Network Analysis for ${impersonatedUser?.email}` : 'Network Analysis'}
                </h1>
                <p className="text-xl text-muted-foreground">
                  Compare filtered candidates with your network connections
                </p>
              </div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="card-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Filtered Candidates</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-2">
                  {isLoadingCandidates ? '...' : filteredCandidates.length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Candidates who passed both filtering stages
                </p>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-2">
                  <Network className="h-5 w-5 text-secondary" />
                  <CardTitle className="text-lg">Network Connections</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-secondary mb-2">
                  {networkData.length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Uploaded network connections
                </p>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <CardTitle className="text-lg">Matches Found</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-accent mb-2">
                  {matches.length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Candidates with network connections
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Upload Section */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle>Network File Upload</CardTitle>
                  <CardDescription>
                    Upload a CSV file with your network connections
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {networkData.length === 0 ? (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                        <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground mb-4">
                          Upload your network connections CSV file
                        </p>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleNetworkUpload(file);
                          }}
                          className="hidden"
                          id="network-upload"
                        />
                        <label htmlFor="network-upload">
                          <Button asChild>
                            <span>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Network File
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-medium">Network file loaded</p>
                            <p className="text-sm text-muted-foreground">
                              {networkData.length} connections
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={clearNetworkData}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleNetworkUpload(file);
                          }}
                          className="hidden"
                          id="network-reupload"
                        />
                        <label htmlFor="network-reupload">
                          <Button variant="outline" className="w-full" asChild>
                            <span>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Different File
                            </span>
                          </Button>
                        </label>
                        
                        <Button 
                          variant="outline" 
                          className="w-full" 
                          onClick={() => analyzeMatches()}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Re-analyze Matches
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Results Section */}
            <div className="lg:col-span-2">
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle>Network Matches</CardTitle>
                  <CardDescription>
                    Candidates from your filtered results who have connections in your network
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {matches.length === 0 ? (
                    <div className="text-center py-12">
                      <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No matches found yet</h3>
                      <p className="text-muted-foreground">
                        {networkData.length === 0 
                          ? "Upload a network file to find matching candidates"
                          : "No candidates match your network connections"
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {matches.map((match, index) => (
                        <div key={match.candidate.id} className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-lg">{match.candidate.full_name}</h3>
                              <p className="text-muted-foreground">{match.candidate.current_title}</p>
                              <p className="text-sm text-muted-foreground">{match.candidate.current_company}</p>
                              {match.candidate.linkedin_url && (
                                <a 
                                  href={match.candidate.linkedin_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                                >
                                  LinkedIn Profile
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">
                                {match.connections.length} connection{match.connections.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-medium mb-2">Network Connections ({match.connections.length})</h4>
                            <div className="space-y-2">
                              {match.connections.map((connection, connIndex) => (
                                 <div key={connIndex} className="bg-muted/30 rounded p-3">
                                   <div className="flex items-start justify-between">
                                     <div className="flex-1">
                                       <p className="font-medium">{connection.name}</p>
                                       <p className="text-sm text-muted-foreground">{connection.title}</p>
                                       <p className="text-sm text-muted-foreground">{connection.company}</p>
                                       {connection.linkedin_url && (
                                         <a 
                                           href={connection.linkedin_url} 
                                           target="_blank" 
                                           rel="noopener noreferrer"
                                           className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                                         >
                                           LinkedIn Profile
                                           <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                           </svg>
                                         </a>
                                       )}
                                     </div>
                                     <Badge variant="secondary" className="text-xs">
                                       {connection.relationship}
                                     </Badge>
                                   </div>
                                   {(connection.email || connection.phone) && (
                                     <div className="mt-2 text-xs text-muted-foreground">
                                       {connection.email && <p>Email: {connection.email}</p>}
                                       {connection.phone && <p>Phone: {connection.phone}</p>}
                                     </div>
                                   )}
                                 </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Netly;