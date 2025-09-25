import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';

export interface Job {
  id: string;
  user_id: string;
  job_id: string;
  job_name: string;
  created_at: string;
  updated_at: string;
}

export interface JobStats {
  totalCandidates: number;
  processedCandidates: number;
  finalResults: number;
}

export const useJobManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { getActiveUserId } = useAdminImpersonation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', activeUserId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error: any) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createJob = async (jobId: string, jobName: string): Promise<boolean> => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return false;

    try {
      // Check if job already exists
      const { data: existingJob } = await supabase
        .from('jobs')
        .select('id')
        .eq('user_id', activeUserId)
        .eq('job_id', jobId)
        .maybeSingle();

      if (existingJob) {
        // Job already exists, just update the name and timestamp
        const { error } = await supabase
          .from('jobs')
          .update({ job_name: jobName, updated_at: new Date().toISOString() })
          .eq('user_id', activeUserId)
          .eq('job_id', jobId);

        if (error) throw error;
      } else {
        // Create new job
        const { error } = await supabase
          .from('jobs')
          .insert({
            user_id: activeUserId,
            job_id: jobId,
            job_name: jobName
          });

        if (error) {
          if (error.message.includes('Job quota exceeded')) {
            toast({
              title: "Job Quota Exceeded",
              description: "You have reached the maximum of 10 jobs. Please delete some jobs to add new ones.",
              variant: "destructive",
            });
            return false;
          }
          throw error;
        }
      }

      await fetchJobs();
      return true;
    } catch (error: any) {
      console.error('Error creating job:', error);
      toast({
        title: "Error",
        description: "Failed to create job",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteJob = async (jobId: string): Promise<boolean> => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return false;

    try {
      // Delete all related data in parallel
      await Promise.all([
        supabase.from('raw_data').delete().eq('user_id', activeUserId),
        supabase.from('filtered_results').delete().eq('user_id', activeUserId).eq('job_id', jobId),
        supabase.from('filter_rules').delete().eq('user_id', activeUserId).eq('job_id', jobId),
        supabase.from('user_blacklist').delete().eq('user_id', activeUserId).eq('job_id', jobId),
        supabase.from('user_past_candidates').delete().eq('user_id', activeUserId).eq('job_id', jobId),
        supabase.from('netly_files').delete().eq('user_id', activeUserId).eq('job_id', jobId)
      ]);

      // Delete the job record
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('user_id', activeUserId)
        .eq('job_id', jobId);

      if (error) throw error;

      toast({
        title: "Job Deleted",
        description: "Job and all related data have been deleted successfully.",
      });

      await fetchJobs();
      return true;
    } catch (error: any) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive",
      });
      return false;
    }
  };

  const getJobStats = async (jobId: string): Promise<JobStats> => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) return { totalCandidates: 0, processedCandidates: 0, finalResults: 0 };

    try {
      // Get total candidates for this job from raw_data (this doesn't have job_id, so we get all)
      const { count: totalCandidates } = await supabase
        .from('raw_data')
        .select('*', { count: 'exact' })
        .eq('user_id', activeUserId);

      // Get processed candidates for this job
      const { count: processedCandidates } = await supabase
        .from('filtered_results')
        .select('*', { count: 'exact' })
        .eq('user_id', activeUserId)
        .eq('job_id', jobId);

      // Get final results for this job
      const { count: finalResults } = await supabase
        .from('filtered_results')
        .select('*', { count: 'exact' })
        .eq('user_id', activeUserId)
        .eq('job_id', jobId)
        .eq('stage_1_passed', true)
        .eq('stage_2_passed', true);

      return {
        totalCandidates: totalCandidates || 0,
        processedCandidates: processedCandidates || 0,
        finalResults: finalResults || 0
      };
    } catch (error) {
      console.error('Error fetching job stats:', error);
      return { totalCandidates: 0, processedCandidates: 0, finalResults: 0 };
    }
  };

  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user, getActiveUserId]);

  return {
    jobs,
    loading,
    fetchJobs,
    createJob,
    deleteJob,
    getJobStats
  };
};