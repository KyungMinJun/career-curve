import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoImage from '@/assets/logo.png';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ChatTabProps {
  onNavigateToBoard: () => void;
}

const JOB_URL_KEYWORDS = ['career', 'careers', 'job', 'jobs', 'recruit', 'recruiting', 'hire', 'hiring', 'position', 'vacancy', 'opening', 'apply', 'talent', 'greenhouse', 'lever', 'workable', 'ashbyhq'];

function isLikelyJobUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return JOB_URL_KEYWORDS.some(keyword => lowerUrl.includes(keyword));
}

export function ChatTab({ onNavigateToBoard }: ChatTabProps) {
  const [inputValue, setInputValue] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [noContentDialogOpen, setNoContentDialogOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, addMessage, updateMessage, addJobPosting, jobPostings } = useData();

  // Check if URL was already shared
  const findExistingJobByUrl = (url: string) => {
    return jobPostings.find((job) => job.sourceUrl === url);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const isUrl = (text: string) => {
    try {
      new URL(text);
      return true;
    } catch {
      return text.match(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i);
    }
  };

  const analyzeJobUrl = async (url: string): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('analyze-job', {
      body: { url }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Failed to analyze job posting');
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to analyze job posting');
    }

    return data.data;
  };

  const processJobUrl = async (url: string) => {
    // Add processing message
    const processingMsgId = await addMessage({
      type: 'assistant',
      content: '공고를 정리하고 있어요…',
      isProcessing: true,
      createdAt: new Date(),
    });

    if (!processingMsgId) {
      toast.error('메시지 추가 중 오류가 발생했습니다');
      return;
    }

    try {
      // Call the edge function to analyze the job posting
      const jobData = await analyzeJobUrl(url);
      
      // Create job posting from analyzed data
      const newJobId = await addJobPosting({
        companyName: jobData.companyName || '회사명 확인 필요',
        title: jobData.title || '채용 공고',
        status: 'reviewing',
        priority: 0,
        position: jobData.position || '미정',
        minExperience: jobData.minExperience,
        workType: jobData.workType,
        location: jobData.location,
        visaSponsorship: jobData.visaSponsorship,
        summary: jobData.summary || '공고 내용을 확인해주세요.',
        companyScore: typeof jobData.companyScore === 'number' ? jobData.companyScore : undefined,
        fitScore: typeof jobData.fitScore === 'number' ? jobData.fitScore : undefined,
        keyCompetencies: jobData.keyCompetencies || [],
        sourceUrl: url,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update processing message
      updateMessage(processingMsgId, {
        content: `✅ 보드에 추가됨\n\n${jobData.companyName} - ${jobData.title}`,
        isProcessing: false,
        jobPostingId: newJobId,
      });

      toast.success('공고가 분석되어 보드에 추가되었습니다');

    } catch (error: any) {
      console.error('Error analyzing job:', error);
      
      // Check if this is a "no content" error
      if (error?.message?.includes('추출할 수 없습니다') || error?.message?.includes('noContent')) {
        setPendingUrl(url);
        setNoContentDialogOpen(true);
        updateMessage(processingMsgId, {
          content: '공고 내용을 가져올 수 없습니다.',
          isProcessing: false,
        });
        return;
      }
      
      // Update to error message
      updateMessage(processingMsgId, {
        content: '❌ 공고 분석에 실패했습니다. 링크를 확인하거나 공고 내용을 직접 붙여넣어 주세요.',
        isProcessing: false,
      });

      toast.error(error instanceof Error ? error.message : '공고 분석 실패');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    await addMessage({
      type: 'user' as const,
      content: inputValue,
      createdAt: new Date(),
    });

    const isLink = isUrl(inputValue.trim());
    const urlToAnalyze = inputValue.trim();
    setInputValue('');

    if (isLink) {
      // Check if this URL was already shared
      const existingJob = findExistingJobByUrl(urlToAnalyze);
      if (existingJob) {
        setPendingUrl(urlToAnalyze);
        setDuplicateDialogOpen(true);
        return;
      }

      // Check if it looks like a job URL
      if (!isLikelyJobUrl(urlToAnalyze)) {
        setPendingUrl(urlToAnalyze);
        setConfirmDialogOpen(true);
        return;
      }

      await processJobUrl(urlToAnalyze);
    } else {
      // Regular text message
      setTimeout(async () => {
        await addMessage({
          type: 'assistant',
          content: '공고 링크를 붙여넣으시면 자동으로 분석해서 보드에 정리해드릴게요.',
          createdAt: new Date(),
        });
      }, 500);
    }
  };

  const handleConfirmJobUrl = async () => {
    setConfirmDialogOpen(false);
    if (pendingUrl) {
      await processJobUrl(pendingUrl);
      setPendingUrl(null);
    }
  };

  const handleCancelJobUrl = async () => {
    setConfirmDialogOpen(false);
    await addMessage({
      type: 'assistant',
      content: '취소되었습니다. 채용 공고 링크를 붙여넣어 주세요.',
      createdAt: new Date(),
    });
    setPendingUrl(null);
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateDialogOpen(false);
    if (pendingUrl) {
      await processJobUrl(pendingUrl);
      setPendingUrl(null);
    }
  };

  const handleDuplicateCancel = async () => {
    setDuplicateDialogOpen(false);
    await addMessage({
      type: 'assistant',
      content: '추가가 취소되었습니다.',
      createdAt: new Date(),
    });
    setPendingUrl(null);
  };

  const handleNoContentConfirm = async () => {
    setNoContentDialogOpen(false);
    if (pendingUrl) {
      // Add a minimal job posting with just the URL
      const newJobId = await addJobPosting({
        companyName: '수동 입력 필요',
        title: '공고 내용 확인 필요',
        status: 'reviewing',
        priority: 0,
        position: '미정',
        summary: '공고 내용을 직접 확인하고 입력해주세요.',
        keyCompetencies: [],
        sourceUrl: pendingUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      await addMessage({
        type: 'assistant',
        content: '공고가 보드에 추가되었습니다. 공고 정보를 직접 입력해주세요.',
        jobPostingId: newJobId,
        createdAt: new Date(),
      });
      
      toast.success('공고가 추가되었습니다. 정보를 직접 입력해주세요.');
      setPendingUrl(null);
    }
  };

  const handleNoContentCancel = async () => {
    setNoContentDialogOpen(false);
    await addMessage({
      type: 'assistant',
      content: '추가가 취소되었습니다.',
      createdAt: new Date(),
    });
    setPendingUrl(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 pb-2 bg-background safe-top-lg shrink-0">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Logo" className="w-6 h-6 object-contain" />
          <h1 className="text-xl font-bold text-foreground">채팅</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          공고를 넣는 순간, 정리가 시작됩니다
        </p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 scrollbar-hide min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.type === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2',
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border card-shadow'
              )}
            >
              <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {message.isProcessing && (
                  <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
                )}
                {message.content}
              </p>
              
              {/* CTA for processed job posting */}
              {message.jobPostingId && !message.isProcessing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 -ml-2 text-primary hover:text-primary/80 p-2 h-auto"
                  onClick={onNavigateToBoard}
                >
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  보드에서 보기
                </Button>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 pb-24 pt-2 border-t border-border bg-background shrink-0">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="공고 링크를 붙여넣거나 질문하세요"
            className="flex-1 bg-secondary rounded-full px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full w-9 h-9 shrink-0"
            disabled={!inputValue.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>

      {/* Non-job URL Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              공고가 아닌 링크일 수 있습니다
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 링크는 채용 공고가 아닌 것으로 보입니다. 계속 공고 등록을 진행하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelJobUrl}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmJobUrl}>계속 진행</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate URL Confirmation Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              이전에 공유한 적 있는 링크입니다
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 링크는 이미 보드에 추가된 공고입니다. 다시 추가하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDuplicateCancel}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicateConfirm}>추가</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No Content Confirmation Dialog */}
      <AlertDialog open={noContentDialogOpen} onOpenChange={setNoContentDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              공고 내용을 가져올 수 없습니다
            </AlertDialogTitle>
            <AlertDialogDescription>
              해당 페이지가 마감되었거나 접근할 수 없는 상태입니다. 그래도 공고를 추가하고 직접 정보를 입력하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleNoContentCancel}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleNoContentConfirm}>직접 입력하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
