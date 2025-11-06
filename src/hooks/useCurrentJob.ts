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

export const useCurrentJob = () => {
  const [searchParams] = useSearchParams();
  const { activeJob, setActiveJob, loading: activeJobLoading } = useActiveJob();
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

      // 1) URL param takes precedence
      const paramJob = searchParams.get('job');
      if (paramJob) {
        try {
          const { data: jobRow } = await supabase
            .from('jobs')
            .select('job_name')
            .eq('user_id', userId)
            .eq('job_id', paramJob)
            .maybeSingle();

          const name = jobRow?.job_name || `Session ${paramJob.slice(0, 6)}`;
          setState({ jobId: paramJob, jobName: name });
          setActiveJob({ jobId: paramJob, jobName: name });
        } finally {
          setLoading(false);
        }
        return;
      }

      // 2) Local storage active job
      if (activeJob?.jobId) {
        setState({ jobId: activeJob.jobId, jobName: activeJob.jobName || '' });
        setLoading(false);
        return;
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
      if (!resolvedJobId) {
        resolvedJobId = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}`;
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
  };
};