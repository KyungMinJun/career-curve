import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 safe-top-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">이용약관</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <h1 className="text-xl font-bold">이용약관 (커브 · Curve)</h1>
          <p className="text-muted-foreground text-sm">[확정본 v1.1]</p>

          <p>
            본 약관은 조민주(이하 "회사")가 제공하는 커브(Curve) 모바일 애플리케이션 및 관련 서비스 
            (이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
          </p>

          <h2 className="text-lg font-semibold mt-6">제1조 (용어의 정의)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>"서비스"란 회사가 제공하는 커브(Curve) 이직·커리어 관리 모바일 애플리케이션 및 그와 관련된 기능 일체를 의미합니다.</li>
            <li>"이용자"란 본 약관에 따라 회사와 이용계약을 체결하고 서비스를 이용하는 자를 의미합니다.</li>
            <li>"회원"이란 이메일(ID) 및 비밀번호 또는 전화번호 인증을 통해 회원가입을 완료한 자를 의미합니다.</li>
            <li>"콘텐츠"란 회원이 서비스에 입력, 업로드, 생성하는 채용 공고, 이력서, 경력 정보, 텍스트, 파일 등 일체의 정보를 의미합니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제2조 (약관의 효력 및 변경)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>본 약관은 회원가입 과정에서 이용자가 본 약관에 동의함으로써 효력이 발생합니다.</li>
            <li>회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 개정할 수 있습니다.</li>
            <li>약관이 변경되는 경우 회사는 변경 내용과 적용 일자를 명시하여 서비스 내 공지 또는 기타 합리적인 방법으로 사전 안내합니다.</li>
            <li>이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 회원 탈퇴를 요청할 수 있습니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제3조 (이용계약의 체결)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>이용계약은 이용자가 약관에 동의하고 회원가입을 신청한 후 회사가 이를 승낙함으로써 체결됩니다.</li>
            <li>회사는 기술적·운영상 필요에 따라 회원가입 신청을 승낙하지 않거나 사후에 이용계약을 해지할 수 있습니다.</li>
            <li>회사는 원칙적으로 만 14세 미만 아동의 회원가입을 허용하지 않습니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제4조 (서비스의 제공)</h2>
          <p>회사는 다음과 같은 서비스를 제공합니다.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>채용 공고 입력 및 자동 분석·구조화 서비스</li>
            <li>이직 보드(칸반/표)를 통한 이직 진행 상태 관리</li>
            <li>경력·경험 관리 및 공고별 맞춤 이력서 생성 기능</li>
          </ul>
          <p className="text-sm">회사는 서비스의 전부 또는 일부를 무료로 제공하며, 향후 유료 기능이 추가될 수 있습니다.</p>

          <h2 className="text-lg font-semibold mt-6">제5조 (서비스의 변경 및 중단)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>회사는 운영상·기술상 필요에 따라 서비스의 내용, 제공 방식, 제공 시간을 변경할 수 있습니다.</li>
            <li>회사는 시스템 점검, 장애, 불가항력 등의 사유가 있는 경우 서비스 제공을 일시적으로 중단할 수 있습니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제6조 (회원의 의무)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>회원은 관계 법령, 본 약관, 서비스 이용 안내 및 공지사항을 준수해야 합니다.</li>
            <li>회원은 타인의 권리 또는 개인정보를 침해하거나 부정한 방법으로 서비스를 이용해서는 안 됩니다.</li>
            <li>회원은 서비스에 입력·업로드한 콘텐츠의 정확성 및 적법성에 대해 책임을 부담합니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제7조 (콘텐츠의 권리 및 이용)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>회원이 서비스에 업로드하거나 생성한 콘텐츠의 저작권은 회원에게 귀속됩니다.</li>
            <li>회사는 서비스 제공 및 개선을 위해 필요한 범위 내에서 해당 콘텐츠를 이용할 수 있습니다.</li>
            <li>회사는 법령에 따른 경우를 제외하고 회원의 콘텐츠를 제3자에게 제공하지 않습니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제8조 (지식재산권)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>서비스에 포함된 회사의 상표, 디자인, UI, 소프트웨어 및 기타 지식재산권은 회사에 귀속됩니다.</li>
            <li>이용자는 회사의 사전 서면 동의 없이 이를 복제, 배포, 수정, 2차적 저작물로 작성할 수 없습니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제9조 (개인정보 보호)</h2>
          <p>
            회사는 개인정보 보호법 등 관계 법령을 준수하며, 개인정보의 처리에 관하여는 별도의 개인정보 처리방침을 따릅니다.
          </p>

          <h2 className="text-lg font-semibold mt-6">제10조 (계약 해지 및 회원 탈퇴)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>회원은 언제든지 서비스 내 설정 메뉴를 통해 이용계약을 해지(회원 탈퇴)할 수 있습니다.</li>
            <li>회원 탈퇴 시 회원의 개인정보는 개인정보 처리방침에 따라 처리됩니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제11조 (면책조항)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>회사는 서비스를 통해 제공되는 정보가 회원의 채용 결과, 합격 여부 또는 커리어 성과를 보장하지 않습니다.</li>
            <li>회사는 회원이 서비스에 입력하거나 업로드한 정보의 정확성, 신뢰성에 대해 책임을 지지 않습니다.</li>
            <li>회사는 무료로 제공되는 서비스와 관련하여 법령에 특별한 규정이 없는 한 책임을 부담하지 않습니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제12조 (분쟁 해결 및 준거법)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>회사는 이용자 간 분쟁은 성실히 협의하여 해결합니다.</li>
            <li>본 약관과 서비스 이용에 관한 분쟁에 대해서는 대한민국 법을 준거법으로 합니다.</li>
            <li>관할 법원은 민사소송법에 따른 관할 법원으로 합니다.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">제13조 (기타)</h2>
          <p>본 약관에서 정하지 아니한 사항과 본 약관의 해석에 관하여는 관계 법령 및 일반 상관례에 따릅니다.</p>

          <div className="mt-8 pt-4 border-t border-border text-sm text-muted-foreground">
            <p>공고일자: 2025.01.01</p>
            <p>시행일자: 2025.01.01</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Terms;
