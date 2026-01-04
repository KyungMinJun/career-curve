import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface PhoneVerificationState {
  isVerified: boolean;
  isLoading: boolean;
  phoneNumber: string | null;
}

export function usePhoneVerification() {
  const { user } = useAuth();
  const [state, setState] = useState<PhoneVerificationState>({
    isVerified: false,
    isLoading: true,
    phoneNumber: null,
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string>('');

  // Fetch verification status
  const checkVerificationStatus = useCallback(async () => {
    if (!user) {
      setState({ isVerified: false, isLoading: false, phoneNumber: null });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('phone_verified, phone_verified_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.phone_verified) {
        // Get phone number from phone_verifications table
        const { data: phoneData } = await supabase
          .from('phone_verifications')
          .select('phone_number')
          .eq('user_id', user.id)
          .maybeSingle();

        setState({
          isVerified: true,
          isLoading: false,
          phoneNumber: phoneData?.phone_number || null,
        });
      } else {
        setState({ isVerified: false, isLoading: false, phoneNumber: null });
      }
    } catch (error) {
      console.error('Error checking phone verification:', error);
      setState({ isVerified: false, isLoading: false, phoneNumber: null });
    }
  }, [user]);

  useEffect(() => {
    checkVerificationStatus();
  }, [checkVerificationStatus]);

  // Send OTP
  const sendOtp = useCallback(async (phone: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다');
      return false;
    }

    // Format phone number (Korean format)
    const formattedPhone = phone.startsWith('+82') 
      ? phone 
      : `+82${phone.replace(/^0/, '')}`;

    setIsVerifying(true);
    try {
      // Check if phone is already used by another account
      const { data: isAvailable } = await supabase
        .rpc('check_phone_available', { phone: formattedPhone });

      if (!isAvailable) {
        toast.error('이미 다른 계정에서 사용 중인 전화번호입니다.');
        return false;
      }

      // Send OTP via Supabase Phone Auth
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        console.error('OTP send error:', error);
        toast.error('인증번호 발송에 실패했습니다');
        return false;
      }

      setPendingPhone(formattedPhone);
      setOtpSent(true);
      toast.success('인증번호가 발송되었습니다');
      return true;
    } catch (error) {
      console.error('Send OTP error:', error);
      toast.error('인증번호 발송 중 오류가 발생했습니다');
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [user]);

  // Verify OTP
  const verifyOtp = useCallback(async (otp: string) => {
    if (!user || !pendingPhone) {
      toast.error('전화번호 정보가 없습니다');
      return false;
    }

    setIsVerifying(true);
    try {
      // Verify the OTP
      const { error } = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        console.error('OTP verification error:', error);
        toast.error('인증번호가 올바르지 않습니다');
        return false;
      }

      // Complete phone verification in our DB
      const { data: success } = await supabase
        .rpc('complete_phone_verification', { phone: pendingPhone });

      if (!success) {
        toast.error('이미 다른 계정에서 사용 중인 전화번호입니다.');
        return false;
      }

      setState({
        isVerified: true,
        isLoading: false,
        phoneNumber: pendingPhone,
      });
      setOtpSent(false);
      setPendingPhone('');
      toast.success('전화번호 인증이 완료되었습니다');
      return true;
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast.error('인증 중 오류가 발생했습니다');
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [user, pendingPhone]);

  // Reset OTP state
  const resetOtp = useCallback(() => {
    setOtpSent(false);
    setPendingPhone('');
  }, []);

  return {
    ...state,
    isVerifying,
    otpSent,
    pendingPhone,
    sendOtp,
    verifyOtp,
    resetOtp,
    refetch: checkVerificationStatus,
  };
}
