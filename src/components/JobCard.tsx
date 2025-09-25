import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, BarChart3, Filter, Calendar } from 'lucide-react';
import { Job, JobStats, useJobManager } from '@/hooks/useJobManager';
import { Link } from 'react-router-dom';

interface JobCardProps {
  job: Job;
  onDelete: (jobId: string) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onDelete }) => {
  const { getJobStats } = useJobManager();
  const [stats, setStats] = useState<JobStats>({ totalCandidates: 0, processedCandidates: 0, finalResults: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      const jobStats = await getJobStats(job.job_id);
      setStats(jobStats);
      setStatsLoading(false);
    };

    fetchStats();
  }, [job.job_id, getJobStats]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="card-shadow transition-smooth hover:enterprise-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{job.job_name}</CardTitle>
            <CardDescription className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>נוצר {formatDate(job.created_at)}</span>
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>מחיקת משרה</AlertDialogTitle>
                <AlertDialogDescription>
                  האם אתה בטוח שברצונך למחוק את המשרה "{job.job_name}"? 
                  פעולה זו תמחק את כל הנתונים הקשורים למשרה זו ולא ניתן לבטלה.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(job.job_id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  מחק
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {statsLoading ? '...' : stats.totalCandidates}
            </div>
            <p className="text-xs text-muted-foreground">מועמדים כולל</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">
              {statsLoading ? '...' : stats.processedCandidates}
            </div>
            <p className="text-xs text-muted-foreground">עובדו</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">
              {statsLoading ? '...' : stats.finalResults}
            </div>
            <p className="text-xs text-muted-foreground">תוצאות סופיות</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge variant={stats.processedCandidates > 0 ? "default" : "secondary"}>
            {stats.processedCandidates > 0 ? "פעיל" : "ממתין"}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <Link to="/results" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <BarChart3 className="h-4 w-4" />
              תוצאות
            </Button>
          </Link>
          <Link to="/filter-config" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Filter className="h-4 w-4" />
              הגדרות
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};