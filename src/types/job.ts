// Job posting status flow
export type JobStatus = 
  | 'reviewing'      // 지원검토
  | 'applied'        // 서류지원
  | 'interview'      // 인터뷰
  | 'rejected-docs'  // 불합격-서류
  | 'rejected-interview' // 불합격-인터뷰
  | 'offer'          // 오퍼
  | 'accepted'       // 합격-최종
  | 'closed';        // 공고 마감

// AI-extracted key competency for job posting (recruiter perspective)
export interface KeyCompetency {
  title: string;
  description: string;
  score?: number; // User's self-assessment 1-5
  rationale?: string;
  evaluation?: string; // AI evaluation of user's fit
}

// Company criteria scores (per job)
export interface CompanyCriteriaScore {
  name: string;
  weight: number;
  description?: string; // 세부 설명
  score?: number; // 1-5
}

// Job info field with evidence
export interface JobInfoField {
  value?: string;
  evidence?: string; // Source sentence from job posting
}

// Minimum requirements check result
export interface MinimumRequirementsCheck {
  experienceMet: '충족' | '미충족' | '판단 불가';
  reason: string;
}

// Job posting data structure
export interface JobPosting {
  id: string;
  companyName: string;
  title: string;
  status: JobStatus;
  priority: number; // 1-5 (1 is best)
  position: string;
  minExperience?: string;
  minExperienceEvidence?: string;
  workType?: string;
  workTypeEvidence?: string;
  location?: string;
  locationEvidence?: string;
  visaSponsorship?: boolean | null;
  visaSponsorshipEvidence?: string;
  summary?: string;
  companyScore?: number; // 1-5 average
  fitScore?: number; // 1-5 average
  minimumRequirementsCheck?: MinimumRequirementsCheck; // AI 최소 조건 검토 결과
  companyCriteriaScores?: CompanyCriteriaScore[]; // Per-job company criteria scores
  keyCompetencies?: KeyCompetency[]; // AI-extracted from recruiter perspective
  sourceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Experience/Resume data
export type ExperienceType = 'work' | 'project';

export interface Experience {
  id: string;
  type: ExperienceType;
  title: string;
  company?: string;
  period?: string; // 기간 (예: "2022.01 - 2023.12", "2023.06 - 현재")
  description: string;
  bullets: string[];
  usedInPostings: string[]; // Job posting IDs
  createdAt: Date;
}

// 공고별 맞춤 이력서
export interface TailoredResume {
  id: string;
  jobPostingId: string;
  companyName: string;
  jobTitle: string;
  content: string; // AI가 생성한 이력서 내용
  aiFeedback?: string; // AI의 채용담당자 관점 피드백
  language: 'ko' | 'en';
  format: 'consulting' | 'narrative';
  createdAt: Date;
  updatedAt: Date;
}

// Resume file data
export interface Resume {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  parseStatus: 'pending' | 'success' | 'fail';
  parseError?: string;

  // 파싱 파이프라인 진단/저장용 (4단계 검증을 위해)
  extractedText?: string; // PDF 텍스트 추출 결과(가능하면)
  ocrText?: string; // OCR 전사 결과(이미지 기반일 때)
  parsedAt?: Date;
}

// Goal settings
export interface CareerGoal {
  id: string;
  type: 'immediate' | 'short-term' | 'long-term';
  reason: string;
  careerPath?: string;
  result?: string; // 목표 결과
  searchPeriod?: string; // e.g., "3개월", "6개월"
  companyEvalCriteria: { name: string; weight: number; description?: string }[];
  startDate: Date; // 목표 시작일
  endDate?: Date; // 목표 종료일 (입력 시 자동으로 이전 기록으로 이동)
  createdAt: Date;
  updatedAt: Date;
}

// Goal history record
export interface GoalHistory {
  id: string;
  goal: CareerGoal;
  archivedAt: Date;
}

// Chat message
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  jobPostingId?: string; // If message resulted in a job posting
  isProcessing?: boolean;
  createdAt: Date;
}

// Status labels in Korean
export const STATUS_LABELS: Record<JobStatus, string> = {
  'reviewing': '지원검토',
  'applied': '서류지원',
  'interview': '인터뷰',
  'rejected-docs': '불합격-서류',
  'rejected-interview': '불합격-인터뷰',
  'offer': '오퍼',
  'accepted': '합격-최종',
  'closed': '공고 마감',
};

// Status colors
export const STATUS_COLORS: Record<JobStatus, string> = {
  'reviewing': 'bg-muted text-muted-foreground',
  'applied': 'bg-info/10 text-info',
  'interview': 'bg-primary/10 text-primary',
  'rejected-docs': 'bg-destructive/10 text-destructive',
  'rejected-interview': 'bg-destructive/10 text-destructive',
  'offer': 'bg-success/10 text-success',
  'accepted': 'bg-success/10 text-success',
  'closed': 'bg-muted text-muted-foreground',
};

// Priority labels
export const PRIORITY_LABELS: Record<number, string> = {
  1: '최우선',
  2: '높음',
  3: '보통',
  4: '낮음',
  5: '관심',
};
