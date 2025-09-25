import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface FileUploadProps {
  title: string;
  description: string;
  acceptedTypes?: string;
  onUploadComplete?: (data: any[]) => void;
}

export const FileUpload = ({ 
  title, 
  description, 
  acceptedTypes = ".csv",
  onUploadComplete 
}: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length === headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }

    return data;
  };

  const saveToDatabase = async (data: any[]) => {
    if (!user) return;

    try {
      // Transform data to match our raw_data table structure
      const rawDataRecords = data.map(row => ({
        user_id: user.id,
        full_name: row['Full Name'] || row['Name'] || '',
        current_title: row['Current Title'] || row['Title'] || '',
        current_company: row['Current Company'] || row['Company'] || '',
        previous_company: row['Previous Company'] || '',
        linkedin_url: row['LinkedIn URL'] || row['LinkedIn'] || '',
        profile_summary: row['Profile Summary'] || row['Summary'] || '',
        education: row['Education'] || '',
        years_of_experience: parseInt(row['Years of Experience'] || '0') || 0,
        months_in_current_role: parseInt(row['Months in Current Role'] || '0') || 0,
      }));

      const { error } = await supabase
        .from('raw_data')
        .insert(rawDataRecords);

      if (error) {
        throw error;
      }

      toast({
        title: "Success!",
        description: `Uploaded ${rawDataRecords.length} candidate records to database.`,
      });

      if (onUploadComplete) {
        onUploadComplete(rawDataRecords);
      }
    } catch (error: any) {
      console.error('Database error:', error);
      toast({
        title: "Database Error",
        description: error.message || "Failed to save data to database.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadedFile(file);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const text = await file.text();
      const data = parseCSV(text);

      if (data.length === 0) {
        throw new Error("No valid data found in CSV file");
      }

      setParsedData(data);
      setUploadProgress(95);

      // Save to database
      await saveToDatabase(data);
      setUploadProgress(100);

      toast({
        title: "File Uploaded Successfully!",
        description: `Parsed ${data.length} records from ${file.name}`,
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to process the file.",
        variant: "destructive",
      });
      setUploadedFile(null);
      setParsedData([]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setParsedData([]);
    setUploadProgress(0);
  };

  if (uploadedFile && parsedData.length > 0) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <CardTitle>Upload Complete</CardTitle>
                <CardDescription>
                  Successfully processed {parsedData.length} records
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearUpload}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{uploadedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(uploadedFile.size / 1024).toFixed(1)} KB • {parsedData.length} records
                </p>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Data Preview:</p>
              <div className="bg-muted/30 p-3 rounded border text-xs font-mono max-h-32 overflow-y-auto">
                {Object.keys(parsedData[0] || {}).join(', ')}
              </div>
            </div>

            <Button variant="outline" onClick={clearUpload} className="w-full">
              Upload Another File
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:border-primary hover:bg-primary/5'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileSelect}
        >
          {isUploading ? (
            <div className="space-y-4">
              <div className="h-12 w-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Upload className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploading file...</p>
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-12 w-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">
                  {isDragging ? 'Drop your file here' : 'Click to upload or drag & drop'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Support for CSV files only
                </p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
};