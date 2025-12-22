import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJobStore } from '@/stores/jobStore';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatTabProps {
  onNavigateToBoard: () => void;
}

export function ChatTab({ onNavigateToBoard }: ChatTabProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, addMessage, updateMessage, addJobPosting } = useJobStore();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: inputValue,
      createdAt: new Date(),
    };
    addMessage(userMessage);

    const isLink = isUrl(inputValue.trim());
    const urlToAnalyze = inputValue.trim();
    setInputValue('');

    if (isLink) {
      // Add processing message
      const processingId = (Date.now() + 1).toString();
      addMessage({
        id: processingId,
        type: 'assistant',
        content: '공고를 정리하고 있어요…',
        isProcessing: true,
        createdAt: new Date(),
      });

      try {
        // Call the edge function to analyze the job posting
        const jobData = await analyzeJobUrl(urlToAnalyze);
        
        // Create job posting from analyzed data
        const newJobId = (Date.now() + 2).toString();
        addJobPosting({
          id: newJobId,
          companyName: jobData.companyName || '회사명 확인 필요',
          title: jobData.title || '채용 공고',
          status: 'reviewing',
          priority: 4,
          quickInterest: 'medium',
          position: jobData.position || '미정',
          minExperience: jobData.minExperience,
          workType: jobData.workType,
          location: jobData.location,
          visaSponsorship: jobData.visaSponsorship,
          summary: jobData.summary || '공고 내용을 확인해주세요.',
          companyScore: jobData.companyScore || 3,
          fitScore: jobData.fitScore || 3,
          sourceUrl: urlToAnalyze,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Update processing message
        updateMessage(processingId, {
          content: `✅ 이직 보드에 추가됨\n\n${jobData.companyName} - ${jobData.title}`,
          isProcessing: false,
          jobPostingId: newJobId,
        });

        toast.success('공고가 분석되어 보드에 추가되었습니다');

      } catch (error) {
        console.error('Error analyzing job:', error);
        
        // Update to error message
        updateMessage(processingId, {
          content: '❌ 공고 분석에 실패했습니다. 링크를 확인하거나 공고 내용을 직접 붙여넣어 주세요.',
          isProcessing: false,
        });

        toast.error(error instanceof Error ? error.message : '공고 분석 실패');
      }
    } else {
      // Regular text message
      setTimeout(() => {
        addMessage({
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: '공고 링크를 붙여넣으시면 자동으로 분석해서 이직 보드에 정리해드릴게요.',
          createdAt: new Date(),
        });
      }, 500);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 pt-safe-top pb-3 border-b border-border bg-background/95 backdrop-blur-sm safe-top">
        <h1 className="text-xl font-bold text-foreground">채팅</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          공고를 넣는 순간, 정리가 시작됩니다
        </p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
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
                'max-w-[80%] rounded-2xl px-4 py-2.5',
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border card-shadow'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">
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
      <form onSubmit={handleSubmit} className="px-4 pb-20 pt-2 border-t border-border bg-background">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="공고 링크를 붙여넣거나 질문하세요"
            className="flex-1 bg-secondary rounded-full px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full w-10 h-10 shrink-0"
            disabled={!inputValue.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
