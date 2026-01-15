// NOTE: 전화번호 인증 기능 비활성화 - 항상 인증된 상태로 반환
export function usePhoneVerification() {
  return {
    isVerified: true,
    isLoading: false,
    phoneNumber: null,
    isVerifying: false,
    otpSent: false,
    pendingPhone: '',
    sendOtp: async (_phone: string) => true,
    verifyOtp: async (_otp: string) => true,
    resetOtp: () => {},
    refetch: async () => {},
  };
}
