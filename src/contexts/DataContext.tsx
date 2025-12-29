import { createContext, useContext, ReactNode } from 'react';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useSubscription } from '@/hooks/useSubscription';
import {
  JobPosting,
  ChatMessage,
  Experience,
  Resume,
  TailoredResume,
  CareerGoal,
} from '@/types/job';

interface DataContextType {
  isLoading: boolean;
  // Job postings
  jobPostings: JobPosting[];
  addJobPosting: (posting: Omit<JobPosting, 'id'> & { id?: string }) => Promise<string | undefined>;
  updateJobPosting: (id: string, updates: Partial<JobPosting>) => Promise<void>;
  removeJobPosting: (id: string) => Promise<void>;
  // Messages
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id'> & { id?: string }) => Promise<string | undefined>;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => Promise<void>;
  // Experiences
  experiences: Experience[];
  addExperience: (experience: Experience) => Promise<void>;
  updateExperience: (id: string, updates: Partial<Experience>) => Promise<void>;
  removeExperience: (id: string) => Promise<void>;
  // Resumes
  resumes: Resume[];
  addResume: (resume: Resume) => Promise<void>;
  updateResume: (id: string, updates: Partial<Resume>) => Promise<void>;
  removeResume: (id: string) => Promise<void>;
  // Tailored resumes
  tailoredResumes: TailoredResume[];
  addTailoredResume: (resume: TailoredResume) => Promise<void>;
  updateTailoredResume: (id: string, updates: Partial<TailoredResume>) => Promise<void>;
  removeTailoredResume: (id: string) => Promise<void>;
  // Goals
  currentGoals: CareerGoal[];
  addGoal: (goal: CareerGoal) => Promise<void>;
  updateGoal: (id: string, updates: Partial<CareerGoal>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  // Subscription
  subscription: ReturnType<typeof useSubscription>['subscription'];
  plans: ReturnType<typeof useSubscription>['plans'];
  canAddJob: (currentJobCount: number) => boolean;
  hasAiCredits: () => boolean;
  useAiCredit: (amount?: number) => Promise<boolean>;
  // Refetch
  refetch: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const supabaseData = useSupabaseData();
  const subscriptionData = useSubscription();

  const value: DataContextType = {
    isLoading: supabaseData.isLoading || subscriptionData.isLoading,
    // Job postings
    jobPostings: supabaseData.jobPostings,
    addJobPosting: supabaseData.addJobPosting,
    updateJobPosting: supabaseData.updateJobPosting,
    removeJobPosting: supabaseData.removeJobPosting,
    // Messages
    messages: supabaseData.messages,
    addMessage: supabaseData.addMessage,
    updateMessage: supabaseData.updateMessage,
    // Experiences
    experiences: supabaseData.experiences,
    addExperience: supabaseData.addExperience,
    updateExperience: supabaseData.updateExperience,
    removeExperience: supabaseData.removeExperience,
    // Resumes
    resumes: supabaseData.resumes,
    addResume: supabaseData.addResume,
    updateResume: supabaseData.updateResume,
    removeResume: supabaseData.removeResume,
    // Tailored resumes
    tailoredResumes: supabaseData.tailoredResumes,
    addTailoredResume: supabaseData.addTailoredResume,
    updateTailoredResume: supabaseData.updateTailoredResume,
    removeTailoredResume: supabaseData.removeTailoredResume,
    // Goals
    currentGoals: supabaseData.currentGoals,
    addGoal: supabaseData.addGoal,
    updateGoal: supabaseData.updateGoal,
    removeGoal: supabaseData.removeGoal,
    // Subscription
    subscription: subscriptionData.subscription,
    plans: subscriptionData.plans,
    canAddJob: subscriptionData.canAddJob,
    hasAiCredits: subscriptionData.hasAiCredits,
    useAiCredit: subscriptionData.useAiCredit,
    // Refetch
    refetch: async () => {
      await Promise.all([supabaseData.refetch(), subscriptionData.refetch()]);
    },
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
