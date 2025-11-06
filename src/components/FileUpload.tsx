import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Papa from 'papaparse';

interface FileUploadProps {
  title: string;
  description: string;
  acceptedTypes?: string;
  onUploadComplete?: (data: any[]) => void;
  userId?: string;
  jobId?: string;
}

export const FileUpload = ({ 
  title, 
  description, 
  acceptedTypes = ".csv",
  onUploadComplete,
  userId,
  jobId
}: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState('');
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

  // Helper function to normalize values (convert "N/A", "NA", "-", "null" to empty string)
  const normalizeValue = (value: any): string => {
    if (!value) return '';
    const str = String(value).trim();
    const emptyValues = ['n/a', 'na', '-', 'null', 'undefined', 'none'];
    return emptyValues.includes(str.toLowerCase()) ? '' : str;
  };

  // Helper function to get the first non-empty value from multiple possible field names
  const getField = (row: any, candidates: string[]): string => {
    for (const key of candidates) {
      const value = normalizeValue(row[key]);
      if (value) return value;
    }
    return '';
  };

  // Helper function to extract company name from text like "Software Engineer at Google"
  const extractCompanyFromText = (text: string): string => {
    if (!text) return '';
    // Match patterns like "at Company" or "@ Company"
    const match = text.match(/(?:at|@)\s+([^,|\n]+)/i);
    return match ? match[1].trim() : '';
  };

  const parseCSV = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      try {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: 'greedy',
          dynamicTyping: false,
          worker: false,
          transformHeader: (h: string) => h.trim(),
          complete: (results) => {
            const rows = (results.data as any[]).filter((row) =>
              Object.values(row).some((v) => String(v ?? '').trim().length > 0)
            );
            resolve(rows);
          },
          error: (err) => {
            console.error('CSV parsing error:', err);
            reject(err);
          },
        });
      } catch (error) {
        console.error('CSV parsing setup error:', error);
        reject(error);
      }
    });
  };

  const saveToDatabase = async (data: any[]) => {
    const activeUserId = userId || user?.id;
    if (!activeUserId) return;

    const currentJobId = jobId || 'current';

    try {
      console.log('Transforming data for database...');
      setCurrentStep('Transforming candidate data...');
      
      // Transform LinkedIn scraped data to match our raw_data table structure
      const rawDataRecords = data.map((row, index) => {
        if (index % 1000 === 0) {
          console.log(`Transforming record ${index}/${data.length}`);
          setUploadProgress(30 + Math.floor((index / data.length) * 30));
        }
        
        // Calculate years of experience from date ranges if available
        const getYearsFromDateRange = (dateRange: string): number => {
          if (!dateRange || dateRange.includes('Present')) return 0;
          const matches = dateRange.match(/(\d{4})/g);
          if (matches && matches.length >= 2) {
            return parseInt(matches[matches.length - 1]) - parseInt(matches[0]);
          }
          return 0;
        };

        const getCurrentRoleMonths = (dateRange: string): number => {
          if (!dateRange || !dateRange.includes('Present')) return 0;
          const match = dateRange.match(/(\w+)\s+(\d{4})\s*-\s*Present/);
          if (match) {
            const startYear = parseInt(match[2]);
            const currentYear = new Date().getFullYear();
            const startMonth = new Date(`${match[1]} 1, ${startYear}`).getMonth();
            const currentMonth = new Date().getMonth();
            return (currentYear - startYear) * 12 + (currentMonth - startMonth);
          }
          return 0;
        };

        // Extract fields using expanded field name mappings
        const firstName = getField(row, ['firstName', 'first_name', 'First Name', 'givenName', 'given_name']);
        const lastName = getField(row, ['lastName', 'last_name', 'Last Name', 'familyName', 'family_name']);
        const linkedinUrl = getField(row, ['linkedinProfileUrl', 'linkedinUrl', 'LinkedIn URL', 'Profile URL', 'profileUrl', 'linkedIn', 'linkedin', 'url']);
        
        let currentTitle = getField(row, ['linkedinJobTitle', 'linkedinHeadline', 'title', 'jobTitle', 'currentTitle', 'headline', 'position', 'current_position']);
        let currentCompany = getField(row, ['companyName', 'company', 'currentCompany', 'current_company', 'currentEmployer', 'company_current', 'currentCompanyName', 'employer', 'organization']);
        
        const previousCompany = getField(row, ['previousCompanyName', 'previous_company', 'lastCompany', 'pastCompany', 'previousEmployer', 'company_previous', 'priorEmployer']);
        const location = getField(row, ['location', 'currentLocation', 'linkedinJobLocation', 'city', 'region', 'country', 'Location']);
        const skills = getField(row, ['linkedinSkillsLabel', 'linkedinSkills', 'skills', 'Top Skills', 'skillsList']);
        const jobDescription = getField(row, ['linkedinJobDescription', 'jobDescription', 'about', 'summary', 'Description']);
        const degree = getField(row, ['linkedinSchoolDegree', 'degree', 'education_degree', 'linkedinPreviousSchoolDegree']);
        const education = getField(row, ['linkedinSchoolName', 'linkedinPreviousSchoolName', 'schoolName', 'education', 'university']);
        
        const profileSummary = [
          getField(row, ['linkedinDescription', 'profilesummery', 'about', 'summary', 'bio', 'experienceSummary']),
          getField(row, ['technologies']),
          getField(row, ['expertise']),
          getField(row, ['competencies'])
        ].filter(Boolean).join(' ');

        // Smart fallback: extract company from title or summary if missing
        if (!currentCompany) {
          currentCompany = extractCompanyFromText(currentTitle) || extractCompanyFromText(profileSummary);
        }

        // Build full name from first + last if needed
        let fullName = getField(row, ['full_name', 'fullName', 'Full Name', 'name', 'Name']);
        if (!fullName && (firstName || lastName)) {
          fullName = `${firstName} ${lastName}`.trim();
        }

        return {
          user_id: activeUserId,
          job_id: currentJobId,
          full_name: fullName,
          current_title: currentTitle,
          current_company: currentCompany,
          previous_company: previousCompany,
          linkedin_url: linkedinUrl,
          location: location,
          skills: skills,
          job_description: jobDescription,
          degree: degree,
          profile_summary: profileSummary,
          education: education,
          years_of_experience: getYearsFromDateRange(getField(row, ['linkedinJobDateRange', 'dateRange', 'jobDateRange'])),
          months_in_current_role: getCurrentRoleMonths(getField(row, ['linkedinJobDateRange', 'dateRange', 'jobDateRange'])),
        };
      });

      // Quality control: check for missing critical fields
      const missingCriticalFields = rawDataRecords.filter(
        (record) => !record.current_title || !record.current_company
      );
      const missingPercentage = (missingCriticalFields.length / rawDataRecords.length) * 100;

      if (missingPercentage > 20) {
        toast({
          title: "Data Quality Warning",
          description: `${missingCriticalFields.length} of ${rawDataRecords.length} records are missing title or company. Check your CSV column names.`,
          variant: "default",
        });
      }

      // Delete old data for this user+job combination before inserting new data
      console.log(`Deleting existing data for user ${activeUserId}, job ${currentJobId}...`);
      setCurrentStep('Clearing old data...');

      const { error: deleteError } = await supabase
        .from('raw_data')
        .delete()
        .eq('user_id', activeUserId)
        .eq('job_id', currentJobId);

      if (deleteError) {
        console.error('Error deleting old data:', deleteError);
        // Continue anyway - don't block upload
      }

      console.log('Old data cleared, proceeding with new data...');
      console.log('Starting database insert...');
      setCurrentStep('Saving to database...');
      setUploadProgress(60);

      // Insert in small chunks to handle very large files and avoid payload limits
      const total = rawDataRecords.length;
      const chunkSize = 100;
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = rawDataRecords.slice(i, i + chunkSize);
        const { error } = await supabase.from('raw_data').insert(chunk);
        if (error) {
          console.error('Chunk insert error at index', i, error);
          throw error;
        }
        // Update progress smoothly between 60% and 95%
        const progressWithinSave = 60 + Math.floor(((i + chunk.length) / total) * 35);
        setUploadProgress(progressWithinSave);
        setCurrentStep(`Saving batch ${Math.floor(i/chunkSize) + 1}/${Math.ceil(total/chunkSize)}...`);
        console.log(`Saved batch ${Math.floor(i/chunkSize) + 1}/${Math.ceil(total/chunkSize)}`);
        // Tiny delay to prevent rate limiting and keep UI responsive
        await new Promise((res) => setTimeout(res, 50));
      }

      console.log('Database save completed successfully');
      toast({
        title: "Success!",
        description: `Uploaded ${rawDataRecords.length} candidate records to database.`,
      });

      if (onUploadComplete) {
        onUploadComplete(rawDataRecords);
      }
    } catch (error: any) {
      console.error('Database error:', error);
      throw error; // Re-throw so the main handler can catch it
    }
  };

  const handleFileUpload = async (file: File) => {
    console.log('Starting file upload for:', file.name, 'Size:', file.size);
    
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
      console.log('Starting CSV parsing...');
      setCurrentStep('Parsing CSV file...');
      setUploadProgress(10);

      const data = await parseCSV(file);
      console.log('CSV parsed successfully, rows:', data.length);

      if (data.length === 0) {
        throw new Error("No valid data found in CSV file");
      }

      setUploadProgress(30);
      setParsedData(data);
      setCurrentStep('Saving to database...');

      console.log('Starting database save...');
      // Save to database
      await saveToDatabase(data);
      setUploadProgress(100);
      setCurrentStep('Upload complete!');

      toast({
        title: "File Uploaded Successfully!",
        description: `Parsed ${data.length} records from ${file.name}`,
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      setCurrentStep('Upload failed');
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
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">Data Preview (First Row Columns):</p>
              <div className="bg-muted/30 p-3 rounded border text-xs font-mono max-h-32 overflow-y-auto">
                {Object.keys(parsedData[0] || {}).slice(0, 10).join(', ')}
                {Object.keys(parsedData[0] || {}).length > 10 && '...'}
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
            <div className="space-y-6">
              <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto relative">
                <Upload className="h-8 w-8 text-primary" />
                {/* Animated ring */}
                <div className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
              </div>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-base font-medium mb-2">Uploading file...</p>
                  {currentStep && (
                    <p className="text-sm text-muted-foreground">{currentStep}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-full max-w-sm mx-auto h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground max-w-sm mx-auto">
                    <span>{uploadProgress}%</span>
                    <span>Please wait...</span>
                  </div>
                </div>
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