import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth } from '@/services/lbwService';

interface BackendStatus {
  isOnline: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  retryCount: number;
}

export function useBackendStatus(autoRetryInterval = 30000) {
  const [status, setStatus] = useState<BackendStatus>({
    isOnline: false,
    isChecking: true,
    lastChecked: null,
    retryCount: 0,
  });

  const checkStatus = useCallback(async (isRetry = false) => {
    setStatus(prev => ({ ...prev, isChecking: true }));
    
    try {
      const isOnline = await checkBackendHealth();
      setStatus(prev => ({
        isOnline,
        isChecking: false,
        lastChecked: new Date(),
        retryCount: isRetry && !isOnline ? prev.retryCount + 1 : 0,
      }));
      return isOnline;
    } catch {
      setStatus(prev => ({
        isOnline: false,
        isChecking: false,
        lastChecked: new Date(),
        retryCount: isRetry ? prev.retryCount + 1 : 0,
      }));
      return false;
    }
  }, []);

  const manualRetry = useCallback(() => {
    return checkStatus(true);
  }, [checkStatus]);

  // Initial check
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Auto-retry when offline
  useEffect(() => {
    if (!status.isOnline && !status.isChecking && autoRetryInterval > 0) {
      const timer = setTimeout(() => {
        checkStatus(true);
      }, autoRetryInterval);
      return () => clearTimeout(timer);
    }
  }, [status.isOnline, status.isChecking, autoRetryInterval, checkStatus]);

  return { ...status, checkStatus: manualRetry };
}
