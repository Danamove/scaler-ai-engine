import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, BarChart3, Filter, Calendar, Users } from 'lucide-react';
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
    return new Date(dateString).toLocaleDateString('en-US', {
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
              <span>Created {formatDate(job.created_at)}</span>
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
                <AlertDialogTitle>Delete Job</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the job "{job.job_name}"? 
                  This action will delete all data related to this job and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(job.job_id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
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
            <p className="text-xs text-muted-foreground">Total Candidates</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">
              {statsLoading ? '...' : stats.processedCandidates}
            </div>
            <p className="text-xs text-muted-foreground">Processed</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">
              {statsLoading ? '...' : stats.finalResults}
            </div>
            <p className="text-xs text-muted-foreground">Final Results</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge variant={stats.processedCandidates > 0 ? "default" : "secondary"}>
            {stats.processedCandidates > 0 ? "Active" : "Waiting"}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <Link to="/results" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <BarChart3 className="h-4 w-4" />
              Results
            </Button>
          </Link>
          <Link to="/netly" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Users className="h-4 w-4" />
              Network
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};