import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface ActiveJobData {
  jobId: string;
  jobName: string;
}

export const useActiveJob = () => {
  const { user } = useAuth();
  const [activeJob, setActiveJob] = useState<ActiveJobData | null>(null);
  const [loading, setLoading] = useState(true);

  const getStorageKey = () => {
    return user?.id ? `activeJob_${user.id}` : null;
  };

  useEffect(() => {
    const loadActiveJob = () => {
      const storageKey = getStorageKey();
      if (!storageKey) {
        setLoading(false);
        return;
      }

      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setActiveJob(parsed);
        } catch (error) {
          console.error('Failed to parse active job from localStorage:', error);
          localStorage.removeItem(storageKey);
        }
      }
      setLoading(false);
    };

    loadActiveJob();
  }, [user?.id]);

  const setActiveJobData = (jobData: ActiveJobData | null) => {
    const storageKey = getStorageKey();
    if (!storageKey) return;

    setActiveJob(jobData);
    if (jobData) {
      localStorage.setItem(storageKey, JSON.stringify(jobData));
    } else {
      localStorage.removeItem(storageKey);
    }
  };

  const clearActiveJob = () => {
    setActiveJobData(null);
  };

  return {
    activeJob,
    setActiveJob: setActiveJobData,
    clearActiveJob,
    loading
  };
};