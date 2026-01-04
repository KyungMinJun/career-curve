import { useEffect, useState, useCallback } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface FingerprintResult {
  fingerprint: string | null;
  isLoading: boolean;
  isSuspicious: boolean;
  otherAccountCount: number;
}

export function useDeviceFingerprint(): FingerprintResult {
  const { user } = useAuth();
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuspicious, setIsSuspicious] = useState(false);
  const [otherAccountCount, setOtherAccountCount] = useState(0);

  const initFingerprint = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const visitorId = result.visitorId;
      setFingerprint(visitorId);

      // Save fingerprint to database
      await supabase.from('device_fingerprints').upsert({
        user_id: user.id,
        fingerprint: visitorId,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,fingerprint',
        ignoreDuplicates: false,
      });

      // Check for abuse patterns
      const { data: abuseCheck } = await supabase
        .rpc('check_fingerprint_abuse', { fp: visitorId });

      if (abuseCheck && typeof abuseCheck === 'object' && !Array.isArray(abuseCheck)) {
        const checkResult = abuseCheck as { is_suspicious?: boolean; other_account_count?: number };
        setIsSuspicious(checkResult.is_suspicious || false);
        setOtherAccountCount(checkResult.other_account_count || 0);
      }
    } catch (error) {
      console.error('Fingerprint error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    initFingerprint();
  }, [initFingerprint]);

  return {
    fingerprint,
    isLoading,
    isSuspicious,
    otherAccountCount,
  };
}
