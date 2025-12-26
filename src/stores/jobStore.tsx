import { createContext, ReactNode, useContext, useMemo } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { JobPosting, ChatMessage, Experience, CareerGoal, GoalHistory, Resume, TailoredResume } from '@/types/job';

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

  // Tailored Resumes (공고별 맞춤 이력서)
  tailoredResumes: TailoredResume[];
  addTailoredResume: (resume: TailoredResume) => void;
  updateTailoredResume: (id: string, updates: Partial<TailoredResume>) => void;
  removeTailoredResume: (id: string) => void;

  // Goals - 복수 목표 지원
  currentGoals: CareerGoal[];
  addGoal: (goal: CareerGoal) => void;
  updateGoal: (id: string, updates: Partial<CareerGoal>) => void;
  removeGoal: (id: string) => void;
  goalHistory: GoalHistory[];
  archiveGoal: (goal: CareerGoal) => void;
  removeGoalHistory: (id: string) => void;
  
  // Legacy compatibility
  currentGoal: CareerGoal | null;
  setGoal: (goal: CareerGoal) => void;

  // User info
  userName: string; // display name (derived)
  userNameKo: string;
  userNameEn: string;
  setUserNames: (names: { ko: string; en: string }) => void;
  setUserName: (name: string) => void; // legacy setter (updates display name only)
}

// NOTE: 이전 버전에서 로그인 전(또는 로그아웃 직후) 화면에 예시/목데이터가 노출될 수 있어,
// 기본 샘플 데이터는 사용하지 않습니다.
const sampleJobPostings: JobPosting[] = [];

const initialMessages: ChatMessage[] = [];

const createJobStore = (storageKey: string) =>
  createStore<JobStore>()(
    persist(
      (set) => ({
        // Job postings
        jobPostings: sampleJobPostings,
        addJobPosting: (posting) => set((state) => ({ jobPostings: [...state.jobPostings, posting] })),
        updateJobPosting: (id, updates) =>
          set((state) => ({
            jobPostings: state.jobPostings.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p)),
          })),
        removeJobPosting: (id) => set((state) => ({ jobPostings: state.jobPostings.filter((p) => p.id !== id) })),

        // Chat messages
        messages: initialMessages,
        addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
        updateMessage: (id, updates) =>
          set((state) => ({
            messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
          })),

        // Experiences
        experiences: [],
        addExperience: (experience) => set((state) => ({ experiences: [...state.experiences, experience] })),
        updateExperience: (id, updates) =>
          set((state) => ({
            experiences: state.experiences.map((e) => (e.id === id ? { ...e, ...updates } : e)),
          })),
        removeExperience: (id) => set((state) => ({ experiences: state.experiences.filter((e) => e.id !== id) })),

        // Resumes
        resumes: [],
        addResume: (resume) => set((state) => ({ resumes: [...state.resumes, resume] })),
        updateResume: (id, updates) =>
          set((state) => ({
            resumes: state.resumes.map((r) => (r.id === id ? { ...r, ...updates } : r)),
          })),
        removeResume: (id) => set((state) => ({ resumes: state.resumes.filter((r) => r.id !== id) })),

        // Tailored Resumes
        tailoredResumes: [],
        addTailoredResume: (resume) => set((state) => ({ tailoredResumes: [...state.tailoredResumes, resume] })),
        updateTailoredResume: (id, updates) =>
          set((state) => ({
            tailoredResumes: state.tailoredResumes.map((r) => (r.id === id ? { ...r, ...updates, updatedAt: new Date() } : r)),
          })),
        removeTailoredResume: (id) => set((state) => ({ tailoredResumes: state.tailoredResumes.filter((r) => r.id !== id) })),

        // Goals - 복수 목표 지원
        currentGoals: [],
        addGoal: (goal) => set((state) => ({ currentGoals: [...state.currentGoals, goal] })),
        updateGoal: (id, updates) =>
          set((state) => ({
            currentGoals: state.currentGoals.map((g) => (g.id === id ? { ...g, ...updates, updatedAt: new Date() } : g)),
          })),
        removeGoal: (id) => set((state) => ({ currentGoals: state.currentGoals.filter((g) => g.id !== id) })),
        goalHistory: [],
        archiveGoal: (goal) =>
          set((state) => ({
            goalHistory: [...state.goalHistory, { id: Date.now().toString(), goal, archivedAt: new Date() }],
          })),
        removeGoalHistory: (id) => set((state) => ({ goalHistory: state.goalHistory.filter((h) => h.id !== id) })),
        
        // Legacy compatibility - currentGoal은 첫 번째 목표 반환
        get currentGoal() {
          return null; // getter는 persist에서 처리
        },
        setGoal: (goal) => set((state) => {
          // 기존 목표가 있으면 업데이트, 없으면 추가
          const exists = state.currentGoals.find((g) => g.id === goal.id);
          if (exists) {
            return { currentGoals: state.currentGoals.map((g) => (g.id === goal.id ? goal : g)) };
          }
          return { currentGoals: [goal, ...state.currentGoals] };
        }),

        // User info
        userName: '사용자',
        userNameKo: '',
        userNameEn: '',
        setUserNames: (names) =>
          set(() => ({
            userNameKo: names.ko,
            userNameEn: names.en,
            userName: names.ko || names.en || '사용자',
          })),
        setUserName: (name) => set({ userName: name }),
      }),
      {
        name: storageKey,
        partialize: (state) => ({
            jobPostings: state.jobPostings,
            messages: state.messages,
            experiences: state.experiences,
            resumes: state.resumes,
            tailoredResumes: state.tailoredResumes,
            currentGoals: state.currentGoals,
            goalHistory: state.goalHistory,
            userName: state.userName,
            userNameKo: state.userNameKo,
            userNameEn: state.userNameEn,
          }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;

          // Rehydrate dates from strings
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
          state.tailoredResumes = (state.tailoredResumes || []).map((r) => ({
            ...r,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
            format: (r as any).format ?? (r.language === 'en' ? 'consulting' : 'narrative'),
          }));
          
          // Migrate legacy currentGoal to currentGoals array
          const legacyGoal = (state as any).currentGoal;
          if (legacyGoal && (!state.currentGoals || state.currentGoals.length === 0)) {
            const migratedGoal = {
              ...legacyGoal,
              createdAt: new Date(legacyGoal.createdAt),
              updatedAt: new Date(legacyGoal.updatedAt),
              startDate: new Date(legacyGoal.startDate ?? new Date()),
              endDate: legacyGoal.endDate ? new Date(legacyGoal.endDate) : undefined,
            };
            // Only add if it has content (not just defaults)
            if (migratedGoal.reason?.trim() || migratedGoal.careerPath?.trim()) {
              state.currentGoals = [migratedGoal];
            }
          }
          
          // Rehydrate currentGoals dates
          state.currentGoals = (state.currentGoals || []).map((g) => ({
            ...g,
            createdAt: new Date(g.createdAt),
            updatedAt: new Date(g.updatedAt),
            startDate: new Date((g as any).startDate ?? new Date()),
            endDate: (g as any).endDate ? new Date((g as any).endDate) : undefined,
          }));
          
          state.goalHistory = (state.goalHistory || []).map((h) => ({
            ...h,
            archivedAt: new Date(h.archivedAt),
            goal: {
              ...h.goal,
              createdAt: new Date(h.goal.createdAt),
              updatedAt: new Date(h.goal.updatedAt),
              startDate: new Date((h.goal as any).startDate ?? new Date()),
              endDate: (h.goal as any).endDate ? new Date((h.goal as any).endDate) : undefined,
            },
          }));
        },
      }
    )
  );

type JobStoreApi = ReturnType<typeof createJobStore>;

const JobStoreContext = createContext<JobStoreApi | null>(null);

export function JobStoreProvider({
  children,
  storageKey,
}: {
  children: ReactNode;
  storageKey: string;
}) {
  const store = useMemo(() => createJobStore(storageKey), [storageKey]);
  return <JobStoreContext.Provider value={store}>{children}</JobStoreContext.Provider>;
}

export function useJobStore<T = JobStore>(selector?: (state: JobStore) => T): T {
  const store = useContext(JobStoreContext);
  if (!store) {
    throw new Error('useJobStore must be used within a JobStoreProvider');
  }
  return useStore(store, (selector ?? ((s) => s as unknown as T)) as any);
}
