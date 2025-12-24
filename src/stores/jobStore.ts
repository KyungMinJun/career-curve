import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { JobPosting, ChatMessage, Experience, CareerGoal, GoalHistory, Resume } from '@/types/job';

interface JobStore {
  // Job postings
  jobPostings: JobPosting[];
  addJobPosting: (posting: JobPosting) => void;
  updateJobPosting: (id: string, updates: Partial<JobPosting>) => void;
  removeJobPosting: (id: string) => void;

  // Chat messages
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;

  // Experiences
  experiences: Experience[];
  addExperience: (experience: Experience) => void;
  updateExperience: (id: string, updates: Partial<Experience>) => void;
  removeExperience: (id: string) => void;

  // Resumes
  resumes: Resume[];
  addResume: (resume: Resume) => void;
  updateResume: (id: string, updates: Partial<Resume>) => void;
  removeResume: (id: string) => void;

  // Goals
  currentGoal: CareerGoal | null;
  setGoal: (goal: CareerGoal) => void;
  goalHistory: GoalHistory[];
  archiveGoal: (goal: CareerGoal) => void;

  // User info
  userName: string;
  setUserName: (name: string) => void;
  goalStartDate: Date | null;
  setGoalStartDate: (date: Date) => void;
}

// Simple example posting
const sampleJobPostings: JobPosting[] = [
  {
    id: 'example-1',
    companyName: '예시 회사',
    title: '예시 공고',
    status: 'reviewing',
    priority: 3,
    position: '포지션',
    summary: '이것은 예시 공고입니다. 채팅에서 공고 링크를 붙여넣으면 자동으로 분석됩니다.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    type: 'assistant',
    content: '안녕하세요! 공고 링크를 붙여넣으면 자동으로 정리해드릴게요.',
    createdAt: new Date(),
  },
];

export const useJobStore = create<JobStore>()(
  persist(
    (set) => ({
      // Job postings
      jobPostings: sampleJobPostings,
      addJobPosting: (posting) =>
        set((state) => ({ jobPostings: [...state.jobPostings, posting] })),
      updateJobPosting: (id, updates) =>
        set((state) => ({
          jobPostings: state.jobPostings.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
          ),
        })),
      removeJobPosting: (id) =>
        set((state) => ({
          jobPostings: state.jobPostings.filter((p) => p.id !== id),
        })),

      // Chat messages
      messages: initialMessages,
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),

      // Experiences
      experiences: [],
      addExperience: (experience) =>
        set((state) => ({ experiences: [...state.experiences, experience] })),
      updateExperience: (id, updates) =>
        set((state) => ({
          experiences: state.experiences.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        })),
      removeExperience: (id) =>
        set((state) => ({
          experiences: state.experiences.filter((e) => e.id !== id),
        })),

      // Resumes
      resumes: [],
      addResume: (resume) =>
        set((state) => ({ resumes: [...state.resumes, resume] })),
      updateResume: (id, updates) =>
        set((state) => ({
          resumes: state.resumes.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      removeResume: (id) =>
        set((state) => ({
          resumes: state.resumes.filter((r) => r.id !== id),
        })),

      // Goals
      currentGoal: {
        id: '1',
        type: 'immediate',
        reason: '',
        searchPeriod: '3개월',
        companyEvalCriteria: [
          { name: '성장 가능성', weight: 5 },
          { name: '기술 스택', weight: 4 },
          { name: '보상', weight: 4 },
          { name: '워라밸', weight: 3 },
          { name: '회사 문화', weight: 4 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      setGoal: (goal) => set({ currentGoal: goal }),
      goalHistory: [],
      archiveGoal: (goal) =>
        set((state) => ({
          goalHistory: [...state.goalHistory, { id: Date.now().toString(), goal, archivedAt: new Date() }],
        })),

      // User info
      userName: '사용자',
      setUserName: (name) => set({ userName: name }),
      goalStartDate: new Date(),
      setGoalStartDate: (date) => set({ goalStartDate: date }),
    }),
    {
      name: 'jobflow-storage',
      partialize: (state) => ({
        jobPostings: state.jobPostings,
        messages: state.messages,
        experiences: state.experiences,
        resumes: state.resumes,
        currentGoal: state.currentGoal,
        goalHistory: state.goalHistory,
        userName: state.userName,
        goalStartDate: state.goalStartDate,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Rehydrate dates from strings
          state.goalStartDate = state.goalStartDate ? new Date(state.goalStartDate) : null;
          state.jobPostings = state.jobPostings.map((p) => ({
            ...p,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          }));
          state.messages = (state.messages || []).map((m) => ({
            ...m,
            createdAt: new Date(m.createdAt),
          }));
          state.experiences = state.experiences.map((e) => ({
            ...e,
            createdAt: new Date(e.createdAt),
          }));
          state.resumes = state.resumes.map((r) => ({
            ...r,
            uploadedAt: new Date(r.uploadedAt),
            parsedAt: r.parsedAt ? new Date(r.parsedAt) : undefined,
          }));
          if (state.currentGoal) {
            state.currentGoal.createdAt = new Date(state.currentGoal.createdAt);
            state.currentGoal.updatedAt = new Date(state.currentGoal.updatedAt);
          }
          state.goalHistory = state.goalHistory.map((h) => ({
            ...h,
            archivedAt: new Date(h.archivedAt),
            goal: {
              ...h.goal,
              createdAt: new Date(h.goal.createdAt),
              updatedAt: new Date(h.goal.updatedAt),
            },
          }));
        }
      },
    }
  )
);
