import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useActiveJob } from '@/hooks/useActiveJob';
import { useJobManager } from '@/hooks/useJobManager';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';

interface CurrentJobState {
  jobId: string | null;
  jobName: string;
}

// Helper function to validate UUID format
const isValidUUID = (str: string | null | undefined): boolean => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export const useCurrentJob = () => {
  const [searchParams] = useSearchParams();
  const { activeJob, setActiveJob, clearActiveJob, loading: activeJobLoading } = useActiveJob();
  const { createJob } = useJobManager();
  const { getActiveUserId } = useAdminImpersonation();

  const [state, setState] = useState<CurrentJobState>({ jobId: null, jobName: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolveJob = async () => {
      const userId = getActiveUserId();
      if (!userId) {
        setLoading(false);
        return;
      }

      // 1) URL param takes precedence (but only if valid UUID)
      const paramJob = searchParams.get('job');
      if (paramJob && isValidUUID(paramJob)) {
        try {
          const { data: jobRow } = await supabase
            .from('jobs')
            .select('job_name')
            .eq('user_id', userId)
            .eq('job_id', paramJob)
            .maybeSingle();

          if (jobRow) {
            // Job exists in database
            setState({ jobId: paramJob, jobName: jobRow.job_name });
            setActiveJob({ jobId: paramJob, jobName: jobRow.job_name });
          } else {
            // Create job for this valid UUID
            const newName = `Session ${paramJob.slice(0, 6)}`;
            await createJob(paramJob, newName);
            setState({ jobId: paramJob, jobName: newName });
            setActiveJob({ jobId: paramJob, jobName: newName });
          }
        } finally {
          setLoading(false);
        }
        return;
      } else if (paramJob && !isValidUUID(paramJob)) {
        // Invalid UUID in URL, ignore it and continue to next resolution step
        console.warn('Invalid job UUID in URL parameter, ignoring:', paramJob);
      }

      // 2) Local storage active job (sanitize invalid UUIDs)
      if (activeJob?.jobId) {
        if (!isValidUUID(activeJob.jobId)) {
          console.warn('Invalid jobId in localStorage, clearing:', activeJob.jobId);
          clearActiveJob();
          // Don't return, continue to next resolution step
        } else {
          setState({ jobId: activeJob.jobId, jobName: activeJob.jobName || '' });
          setLoading(false);
          return;
        }
      }

      // 3) Latest job from jobs table
      const { data: latestJob } = await supabase
        .from('jobs')
        .select('job_id, job_name')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestJob) {
        // Validate that job_id is a proper UUID
        if (!isValidUUID(latestJob.job_id)) {
          console.warn('Found invalid job_id, creating new job:', latestJob.job_id);
          // Create new job instead of using invalid one
          const newJobId = crypto.randomUUID();
          const newName = `Session ${new Date().toLocaleDateString()}`;
          await createJob(newJobId, newName);
          setActiveJob({ jobId: newJobId, jobName: newName });
          setState({ jobId: newJobId, jobName: newName });
          setLoading(false);
          return;
        }
        
        setState({ jobId: latestJob.job_id, jobName: latestJob.job_name });
        setActiveJob({ jobId: latestJob.job_id, jobName: latestJob.job_name });
        setLoading(false);
        return;
      }

      // 4) Fallback to latest filter_rules if any
      const { data: latestRule } = await supabase
        .from('filter_rules')
        .select('job_id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let resolvedJobId = latestRule?.job_id as string | undefined;
      
      // Validate resolved job_id and ensure it's a proper UUID
      if (!resolvedJobId || !isValidUUID(resolvedJobId)) {
        resolvedJobId = crypto.randomUUID();
      }
      const newName = `Session ${new Date().toLocaleDateString()}`;

      // Create a job record to make it explicit
      await createJob(resolvedJobId, newName);
      setActiveJob({ jobId: resolvedJobId, jobName: newName });
      setState({ jobId: resolvedJobId, jobName: newName });
      setLoading(false);
    };

    if (!activeJobLoading) {
      resolveJob();
    }
  }, [searchParams, activeJob?.jobId, activeJobLoading, getActiveUserId]);

  return {
    jobId: state.jobId,
    jobName: state.jobName,
    loading,
    setActiveJob,
    clearActiveJob,
  };
};