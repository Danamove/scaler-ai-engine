import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Filter, ArrowLeft, Database, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { FileUpload } from '@/components/FileUpload';

const Upload = () => {
  const { user, loading } = useAuth();
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
            <h1 className="text-3xl font-bold">Upload Raw Data</h1>
            <p className="text-xl text-muted-foreground">
              Upload your candidate CSV file to start the filtering process
            </p>
          </div>

          {/* Upload Component */}
          <FileUpload
            title="Raw Data CSV"
            description="Upload your LinkedIn scraped candidate data CSV file to start the filtering process"
            onUploadComplete={handleUploadComplete}
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