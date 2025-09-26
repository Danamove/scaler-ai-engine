import { useEffect } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { useAdminImpersonation } from "@/hooks/useAdminImpersonation";
import { useActiveJob } from "@/hooks/useActiveJob";
import { FileUpload } from "@/components/FileUpload";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Filter, Database, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Upload = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { activeJob } = useActiveJob();
  const { getActiveUserId, getActiveUserEmail, isImpersonating, impersonatedUser } = useAdminImpersonation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    if (!loading && user && !activeJob) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate, activeJob]);

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

  const handleUploadComplete = (data: any[]) => {
    // Navigate to results or dashboard after successful upload
    navigate('/dashboard');
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
            {isImpersonating && impersonatedUser && (
              <Badge variant="default" className="bg-primary">
                Uploading for: {impersonatedUser.email}
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
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <div className="h-16 w-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
              <Database className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">
              {isImpersonating ? `Upload Data for ${impersonatedUser?.email}` : 'Upload Raw Data'}
              {activeJob && <span className="text-xl text-muted-foreground"> — {activeJob.jobName}</span>}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isImpersonating 
                ? `Upload candidate CSV file for ${impersonatedUser?.email} to start the filtering process`
                : `Upload candidates for ${activeJob?.jobName || 'your job'}`
              }
            </p>
          </div>

          {/* Upload Component */}
          <FileUpload
            title="Upload Candidate Data"
            description={`Upload your LinkedIn scraped candidate CSV file for ${activeJob?.jobName || 'your job'}`}
            acceptedTypes=".csv"
            onUploadComplete={handleUploadComplete}
            userId={getActiveUserId()}
            jobId={activeJob?.jobId}
          />

          {/* Info Card - Simplified */}
          <div className="bg-muted/30 rounded-lg p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold">File Requirements</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your Raw Data CSV file containing LinkedIn scraped candidate information.
                  The system will automatically process and map the data fields.
                </p>
                <div className="text-xs text-muted-foreground">
                  <p>• CSV format only</p>
                  <p>• Maximum file size: 50MB</p>
                  <p>• LinkedIn scraped data structure expected</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;