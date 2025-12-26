import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 safe-top-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">개인정보 처리방침</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <h1 className="text-xl font-bold">개인정보 처리방침 (커브 · Curve)</h1>
          <p className="text-muted-foreground text-sm">[보수적 확정안 v1.1]</p>

          <p>
            커브(이하 "회사")는 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의 개인정보를 중요하게 보호합니다. 
            본 개인정보 처리방침은 회사가 제공하는 커브(Curve) 모바일 애플리케이션 및 관련 서비스(이하 "서비스") 
            이용과 관련하여 개인정보의 수집·이용·보관·제공·위탁·국외 이전·파기 등에 관한 사항을 안내합니다.
          </p>

          <h2 className="text-lg font-semibold mt-6">1. 개인정보의 처리 목적 및 수집 항목</h2>
          <p>회사는 서비스 제공을 위해 최소한의 개인정보만을 처리합니다.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>회원가입 및 계정 관리:</strong> 이메일(ID), 비밀번호 또는 전화번호(휴대폰 인증)</li>
            <li><strong>프로필(선택):</strong> 커리어 레벨, 관심 포지션, 이직 상태, 희망 지역, 비자 필요 여부, 이직 목표·판단 기준</li>
            <li><strong>서비스 이용 과정:</strong> 채용 공고 링크 및 분석 결과, 공고 상태·우선순위·평가 기록</li>
            <li><strong>사용자 업로드 정보(선택):</strong> 이력서 파일, 경력·프로젝트 등 경험 정보, 맞춤 이력서 결과물</li>
            <li><strong>자동 수집 정보:</strong> 접속 로그, 서비스 이용 기록, 기기 정보(OS/앱 버전), 오류 로그</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">2. 개인정보의 보유 및 이용기간</h2>
          <p>
            회사는 개인정보를 수집·이용 목적이 달성될 때까지 보유·이용하며, 회원 탈퇴 시 지체 없이 파기합니다. 
            다만 관련 법령에 따라 보관이 필요한 경우에는 해당 법령에서 정한 기간 동안 보관할 수 있습니다.
          </p>

          <h2 className="text-lg font-semibold mt-6">3. 만 14세 미만 아동의 개인정보 처리</h2>
          <p>회사는 원칙적으로 만 14세 미만 아동의 회원가입을 허용하지 않습니다.</p>

          <h2 className="text-lg font-semibold mt-6">4. 개인정보 처리의 위탁</h2>
          <p>
            회사는 서비스 제공을 위해 개인정보 처리업무를 외부에 위탁할 수 있으며, 
            위탁 시 관련 법령에 따라 계약을 체결하고 안전하게 관리·감독합니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left border-b border-border">수탁자</th>
                  <th className="px-3 py-2 text-left border-b border-border">위탁 업무 내용</th>
                  <th className="px-3 py-2 text-left border-b border-border">보유·이용기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border-b border-border">Supabase Inc.</td>
                  <td className="px-3 py-2 border-b border-border">데이터베이스 운영, 사용자 인증(Auth), 파일 저장(Storage)</td>
                  <td className="px-3 py-2 border-b border-border">회원 탈퇴 또는 위탁계약 종료 시까지</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold mt-6">5. 개인정보의 국외 이전 (보수적 고지)</h2>
          <p>
            회사는 서비스 제공 및 안정적인 데이터 처리를 위하여 개인정보를 국외에 이전할 수 있습니다. 
            국외 이전이 발생하는 경우, 「개인정보 보호법」에 따라 아래와 같이 고지합니다.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>이전받는 자:</strong> Supabase Inc.</li>
            <li><strong>이전 국가:</strong> 미국 등 Supabase 서버 소재 국가</li>
            <li><strong>연락처:</strong> support@supabase.com</li>
            <li><strong>이전 항목:</strong> 이메일(ID), 서비스 이용 기록, 공고·경험 데이터, 이력서 파일</li>
            <li><strong>이전 목적:</strong> 데이터 저장·관리, 사용자 인증, 서비스 운영</li>
            <li><strong>이전 시기 및 방법:</strong> 회원가입 또는 서비스 이용 시 네트워크를 통한 암호화 전송</li>
            <li><strong>보유·이용기간:</strong> 회원 탈퇴 또는 위탁계약 종료 시까지</li>
            <li><strong>거부 방법:</strong> 서비스 이용 중단 및 회원 탈퇴 요청</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">6. 개인정보의 제3자 제공</h2>
          <p>
            회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 
            다만 이용자가 사전에 동의하거나 법령에 근거한 경우에 한하여 제공할 수 있습니다.
          </p>

          <h2 className="text-lg font-semibold mt-6">7. 정보주체의 권리 및 행사 방법</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>개인정보 열람, 정정·삭제, 처리정지, 동의 철회 요청 가능</li>
            <li>서비스 내 설정 메뉴 또는 이메일 문의를 통해 행사 가능</li>
            <li>개인정보 보호책임자 이메일: sgn04032@hanyang.ac.kr</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">8. 개인정보의 파기 절차 및 방법</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>파기 절차:</strong> 파기 사유 발생 → 내부 검토 → 파기</li>
            <li><strong>파기 방법:</strong> 전자적 파일은 복구 불가능한 방식으로 영구 삭제</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">9. 개인정보의 안전성 확보 조치</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>비밀번호 암호화 저장</li>
            <li>접근 권한 최소화</li>
            <li>보안 점검 및 내부 관리 절차 수립</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">10. 개인정보 보호책임자</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>성명:</strong> 조민주</li>
            <li><strong>직책:</strong> 대표자</li>
            <li><strong>이메일:</strong> sgn04032@hanyang.ac.kr</li>
            <li><strong>주소:</strong> 서울특별시 양천구</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">11. 개인정보 처리방침의 변경</h2>
          <p>
            본 개인정보 처리방침은 법령 또는 서비스 변경에 따라 개정될 수 있으며, 
            변경 시 서비스 내 공지를 통해 안내합니다.
          </p>

          <div className="mt-8 pt-4 border-t border-border text-sm text-muted-foreground">
            <p>공고일자: 2025.01.01</p>
            <p>시행일자: 2025.01.01</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
