import { create } from 'zustand';
import { JobPosting, ChatMessage, Experience, CareerGoal } from '@/types/job';

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

  // Goals
  currentGoal: CareerGoal | null;
  setGoal: (goal: CareerGoal) => void;

  // User info
  userName: string;
  setUserName: (name: string) => void;
  goalStartDate: Date | null;
  setGoalStartDate: (date: Date) => void;
}

// Sample data for demo
const sampleJobPostings: JobPosting[] = [
  {
    id: '1',
    companyName: '토스',
    title: 'Frontend Engineer',
    status: 'interview',
    priority: 1,
    quickInterest: 'high',
    position: '프론트엔드',
    minExperience: '3년 이상',
    workType: '하이브리드',
    location: '서울 강남',
    visaSponsorship: false,
    summary: '토스에서 사용자 경험을 혁신할 프론트엔드 엔지니어를 찾습니다.',
    companyScore: 4,
    fitScore: 5,
    createdAt: new Date('2024-12-15'),
    updatedAt: new Date('2024-12-20'),
  },
  {
    id: '2',
    companyName: '당근',
    title: 'Product Designer',
    status: 'applied',
    priority: 2,
    quickInterest: 'high',
    position: '프로덕트 디자인',
    minExperience: '5년 이상',
    workType: '재택',
    location: '서울 서초',
    visaSponsorship: true,
    summary: '당근에서 지역 커뮤니티를 위한 제품을 디자인합니다.',
    companyScore: 5,
    fitScore: 4,
    createdAt: new Date('2024-12-18'),
    updatedAt: new Date('2024-12-19'),
  },
  {
    id: '3',
    companyName: '카카오',
    title: 'iOS Developer',
    status: 'reviewing',
    priority: 3,
    quickInterest: 'medium',
    position: 'iOS',
    minExperience: '3년 이상',
    workType: '출근',
    location: '판교',
    summary: '카카오톡 iOS 앱 개발에 참여합니다.',
    companyScore: 4,
    fitScore: 3,
    createdAt: new Date('2024-12-20'),
    updatedAt: new Date('2024-12-20'),
  },
];

const sampleExperiences: Experience[] = [
  {
    id: '1',
    title: '리드 프론트엔드 개발자',
    company: '스타트업 A',
    description: '프론트엔드 팀 리드로 React/TypeScript 기반 서비스 개발',
    bullets: [
      '5명 규모의 프론트엔드 팀 리드',
      'MAU 50만 서비스 성능 최적화 30% 개선',
      '디자인 시스템 구축 및 컴포넌트 라이브러리 개발',
    ],
    usedInPostings: ['1'],
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    title: '시니어 개발자',
    company: '기업 B',
    description: '커머스 플랫폼 개발',
    bullets: [
      'Next.js 기반 커머스 플랫폼 개발',
      '결제 시스템 연동 및 안정화',
      '코드 리뷰 문화 정착',
    ],
    usedInPostings: ['2'],
    createdAt: new Date('2024-01-01'),
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

export const useJobStore = create<JobStore>((set) => ({
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
  experiences: sampleExperiences,
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

  // Goals
  currentGoal: {
    id: '1',
    type: 'immediate',
    reason: '성장 기회와 더 나은 보상을 위해',
    careerPath: '시니어 엔지니어 → 테크 리드',
    companyEvalCriteria: [
      { name: '성장 가능성', weight: 5 },
      { name: '기술 스택', weight: 4 },
      { name: '보상', weight: 4 },
      { name: '워라밸', weight: 3 },
      { name: '회사 문화', weight: 4 },
    ],
    fitEvalCriteria: [
      { name: '경력 적합도', weight: 5 },
      { name: '기술 매칭', weight: 5 },
      { name: '성장 기회', weight: 4 },
      { name: '역할 범위', weight: 3 },
      { name: '팀 규모', weight: 2 },
    ],
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
  setGoal: (goal) => set({ currentGoal: goal }),

  // User info
  userName: '사용자',
  setUserName: (name) => set({ userName: name }),
  goalStartDate: new Date('2024-12-01'),
  setGoalStartDate: (date) => set({ goalStartDate: date }),
}));
