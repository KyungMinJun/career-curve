// Job posting status flow
export type JobStatus = 
  | 'reviewing'      // 지원검토
  | 'applied'        // 서류지원
  | 'interview'      // 인터뷰
  | 'rejected-docs'  // 불합격-서류
  | 'rejected-interview' // 불합격-인터뷰
  | 'offer'          // 오퍼
  | 'accepted';      // 합격-최종

// Quick interest indicator
export type QuickInterest = 'high' | 'medium' | 'low';

// Job posting data structure
export interface JobPosting {
  id: string;
  companyName: string;
  title: string;
  status: JobStatus;
  priority: number;
  quickInterest: QuickInterest;
  position: string;
  minExperience?: string;
  workType?: string;
  location?: string;
  visaSponsorship?: boolean;
  summary?: string;
  companyScore?: number;
  fitScore?: number;
  sourceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Experience/Resume data
export interface Experience {
  id: string;
  title: string;
  company?: string;
  description: string;
  bullets: string[];
  usedInPostings: string[]; // Job posting IDs
  createdAt: Date;
}

// Goal settings
export interface CareerGoal {
  id: string;
  type: 'immediate' | 'short-term' | 'long-term';
  reason: string;
  careerPath?: string;
  companyEvalCriteria: { name: string; weight: number }[];
  fitEvalCriteria: { name: string; weight: number }[];
  createdAt: Date;
  updatedAt: Date;
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
};

// Quick interest labels
export const INTEREST_LABELS: Record<QuickInterest, string> = {
  'high': '👍',
  'medium': '😐',
  'low': '👎',
};
