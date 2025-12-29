import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  JobPosting, 
  ChatMessage, 
  Experience, 
  Resume, 
  TailoredResume, 
  CareerGoal,
  JobStatus
} from '@/types/job';
import { toast } from 'sonner';

// Type for database job posting
interface DbJobPosting {
  id: string;
  user_id: string;
  company_name: string;
  title: string;
  status: string;
  priority: number;
  position: string;
  min_experience: string | null;
  min_experience_evidence: string | null;
  work_type: string | null;
  work_type_evidence: string | null;
  location: string | null;
  location_evidence: string | null;
  visa_sponsorship: boolean | null;
  visa_sponsorship_evidence: string | null;
  summary: string | null;
  company_score: number | null;
  fit_score: number | null;
  minimum_requirements_check: any;
  company_criteria_scores: any;
  key_competencies: any;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

// Convert DB format to app format
function dbToJobPosting(db: DbJobPosting): JobPosting {
  return {
    id: db.id,
    companyName: db.company_name,
    title: db.title,
    status: db.status as JobStatus,
    priority: db.priority,
    position: db.position,
    minExperience: db.min_experience ?? undefined,
    minExperienceEvidence: db.min_experience_evidence ?? undefined,
    workType: db.work_type ?? undefined,
    workTypeEvidence: db.work_type_evidence ?? undefined,
    location: db.location ?? undefined,
    locationEvidence: db.location_evidence ?? undefined,
    visaSponsorship: db.visa_sponsorship ?? undefined,
    visaSponsorshipEvidence: db.visa_sponsorship_evidence ?? undefined,
    summary: db.summary ?? undefined,
    companyScore: db.company_score ?? undefined,
    fitScore: db.fit_score ?? undefined,
    minimumRequirementsCheck: db.minimum_requirements_check ?? undefined,
    companyCriteriaScores: db.company_criteria_scores ?? undefined,
    keyCompetencies: db.key_competencies ?? undefined,
    sourceUrl: db.source_url ?? undefined,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

// Convert app format to DB format for insert/update
function jobPostingToDb(job: Partial<JobPosting>, userId: string): Record<string, any> {
  const result: Record<string, any> = { user_id: userId };
  
  if (job.companyName !== undefined) result.company_name = job.companyName;
  if (job.title !== undefined) result.title = job.title;
  if (job.status !== undefined) result.status = job.status;
  if (job.priority !== undefined) result.priority = job.priority;
  if (job.position !== undefined) result.position = job.position;
  if (job.minExperience !== undefined) result.min_experience = job.minExperience;
  if (job.minExperienceEvidence !== undefined) result.min_experience_evidence = job.minExperienceEvidence;
  if (job.workType !== undefined) result.work_type = job.workType;
  if (job.workTypeEvidence !== undefined) result.work_type_evidence = job.workTypeEvidence;
  if (job.location !== undefined) result.location = job.location;
  if (job.locationEvidence !== undefined) result.location_evidence = job.locationEvidence;
  if (job.visaSponsorship !== undefined) result.visa_sponsorship = job.visaSponsorship;
  if (job.visaSponsorshipEvidence !== undefined) result.visa_sponsorship_evidence = job.visaSponsorshipEvidence;
  if (job.summary !== undefined) result.summary = job.summary;
  if (job.companyScore !== undefined) result.company_score = job.companyScore;
  if (job.fitScore !== undefined) result.fit_score = job.fitScore;
  if (job.minimumRequirementsCheck !== undefined) result.minimum_requirements_check = job.minimumRequirementsCheck;
  if (job.companyCriteriaScores !== undefined) result.company_criteria_scores = job.companyCriteriaScores;
  if (job.keyCompetencies !== undefined) result.key_competencies = job.keyCompetencies;
  if (job.sourceUrl !== undefined) result.source_url = job.sourceUrl;
  
  return result;
}

function calculateRelativePriorityFromScores({
  allJobPostings,
  jobId,
  companyScore,
  fitScore,
}: {
  allJobPostings: JobPosting[];
  jobId?: string;
  companyScore?: number;
  fitScore?: number;
}): number {
  const comp = typeof companyScore === 'number' ? companyScore : 0;
  const fit = typeof fitScore === 'number' ? fitScore : 0;
  const count = (comp > 0 ? 1 : 0) + (fit > 0 ? 1 : 0);
  const thisScore = count > 0 ? (comp + fit) / count : 0;

  // No scores yet → keep as "미평가"
  if (thisScore === 0) return 0;

  const allScores = allJobPostings
    .filter((j) => (jobId ? j.id !== jobId : true))
    .map((j) => {
      const c = j.companyScore || 0;
      const f = j.fitScore || 0;
      const n = (c > 0 ? 1 : 0) + (f > 0 ? 1 : 0);
      return n > 0 ? (c + f) / n : 0;
    })
    .filter((s) => s > 0);

  // If this is the only scored job, assign absolute priority buckets
  if (allScores.length === 0) {
    if (thisScore >= 4) return 1;
    if (thisScore >= 3) return 2;
    if (thisScore >= 2) return 3;
    if (thisScore >= 1) return 4;
    return 5;
  }

  // Relative bucketing across all scored jobs (including this one)
  const allWithThis = [...allScores, thisScore].sort((a, b) => b - a);
  const rank = allWithThis.indexOf(thisScore);
  const total = allWithThis.length;
  const percentile = rank / total;

  if (percentile < 0.2) return 1;
  if (percentile < 0.4) return 2;
  if (percentile < 0.6) return 3;
  if (percentile < 0.8) return 4;
  return 5;
}

export function useSupabaseData() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [tailoredResumes, setTailoredResumes] = useState<TailoredResume[]>([]);
  const [currentGoals, setCurrentGoals] = useState<CareerGoal[]>([]);

  // Fetch all data on mount
  const fetchAllData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch job postings
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_postings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (jobsError) throw jobsError;
      setJobPostings((jobsData || []).map(dbToJobPosting));

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (messagesError) throw messagesError;
      setMessages((messagesData || []).map(m => ({
        id: m.id,
        type: m.type as 'user' | 'assistant' | 'system',
        content: m.content,
        jobPostingId: m.job_posting_id ?? undefined,
        isProcessing: m.is_processing ?? false,
        createdAt: new Date(m.created_at),
      })));

      // Fetch experiences
      const { data: expData, error: expError } = await supabase
        .from('experiences')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (expError) throw expError;
      setExperiences((expData || []).map(e => ({
        id: e.id,
        type: e.type as 'work' | 'project',
        title: e.title,
        company: e.company ?? undefined,
        period: e.period ?? undefined,
        description: e.description,
        bullets: (e.bullets as string[]) || [],
        usedInPostings: (e.used_in_postings as string[]) || [],
        createdAt: new Date(e.created_at),
      })));

      // Fetch resumes
      const { data: resumesData, error: resumesError } = await supabase
        .from('resumes')
        .select('*')
        .order('uploaded_at', { ascending: false });
      
      if (resumesError) throw resumesError;
      setResumes((resumesData || []).map(r => ({
        id: r.id,
        fileName: r.file_name,
        fileUrl: r.file_url,
        uploadedAt: new Date(r.uploaded_at),
        parseStatus: r.parse_status as 'pending' | 'success' | 'fail',
        parseError: r.parse_error ?? undefined,
        extractedText: r.extracted_text ?? undefined,
        ocrText: r.ocr_text ?? undefined,
        parsedAt: r.parsed_at ? new Date(r.parsed_at) : undefined,
      })));

      // Fetch tailored resumes
      const { data: tailoredData, error: tailoredError } = await supabase
        .from('tailored_resumes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (tailoredError) throw tailoredError;
      setTailoredResumes((tailoredData || []).map(t => ({
        id: t.id,
        jobPostingId: t.job_posting_id,
        companyName: t.company_name,
        jobTitle: t.job_title,
        content: t.content,
        aiFeedback: t.ai_feedback ?? undefined,
        language: t.language as 'ko' | 'en',
        format: t.format as 'consulting' | 'narrative',
        createdAt: new Date(t.created_at),
        updatedAt: new Date(t.updated_at),
      })));

      // Fetch career goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('career_goals')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      
      if (goalsError) throw goalsError;
      setCurrentGoals((goalsData || []).map(g => ({
        id: g.id,
        type: g.type as 'immediate' | 'short-term' | 'long-term',
        reason: g.reason,
        careerPath: g.career_path ?? undefined,
        result: g.result ?? undefined,
        searchPeriod: g.search_period ?? undefined,
        companyEvalCriteria: (g.company_eval_criteria as any[]) || [],
        startDate: new Date(g.start_date),
        endDate: g.end_date ? new Date(g.end_date) : undefined,
        createdAt: new Date(g.created_at),
        updatedAt: new Date(g.updated_at),
      })));

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Job posting operations
  const addJobPosting = async (posting: Omit<JobPosting, 'id'> & { id?: string }): Promise<string | undefined> => {
    if (!user) return;

    const dbData = jobPostingToDb(posting as Partial<JobPosting>, user.id);
    // Don't set id - let DB generate UUID

    // Auto-priority: if scores exist, compute a relative priority bucket.
    // (If user later adds/updates AI scores, we'll recompute again on update.)
    const autoPriority = calculateRelativePriorityFromScores({
      allJobPostings: jobPostings,
      companyScore: posting.companyScore,
      fitScore: posting.fitScore,
    });
    if ((posting.priority === 0 || posting.priority === undefined) && autoPriority > 0) {
      dbData.priority = autoPriority;
    }

    const { data, error } = await supabase
      .from('job_postings')
      .insert(dbData as any)
      .select()
      .single();

    if (error) {
      console.error('Error adding job posting:', error);
      toast.error('공고 추가 중 오류가 발생했습니다');
      return;
    }

    const newPosting = dbToJobPosting(data);
    setJobPostings(prev => [newPosting, ...prev]);
    return newPosting.id;
  };

  const updateJobPosting = async (id: string, updates: Partial<JobPosting>) => {
    if (!user) return;

    const existing = jobPostings.find((j) => j.id === id);

    const scoreTouched =
      updates.companyScore !== undefined ||
      updates.fitScore !== undefined ||
      updates.companyCriteriaScores !== undefined ||
      updates.keyCompetencies !== undefined;

    const computedPriority = scoreTouched
      ? calculateRelativePriorityFromScores({
          allJobPostings: jobPostings,
          jobId: id,
          companyScore: updates.companyScore ?? existing?.companyScore,
          fitScore: updates.fitScore ?? existing?.fitScore,
        })
      : undefined;

    const mergedUpdates: Partial<JobPosting> =
      computedPriority !== undefined ? { ...updates, priority: computedPriority } : updates;

    const dbData = jobPostingToDb(mergedUpdates, user.id);
    delete dbData.user_id; // Don't update user_id

    const { error } = await supabase
      .from('job_postings')
      .update(dbData)
      .eq('id', id);

    if (error) {
      console.error('Error updating job posting:', error);
      toast.error('공고 업데이트 중 오류가 발생했습니다');
      return;
    }

    setJobPostings(prev =>
      prev.map(p => (p.id === id ? { ...p, ...mergedUpdates, updatedAt: new Date() } : p))
    );
  };

  const removeJobPosting = async (id: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error removing job posting:', error);
      toast.error('공고 삭제 중 오류가 발생했습니다');
      return;
    }
    
    setJobPostings(prev => prev.filter(p => p.id !== id));
  };

  // Chat message operations
  const addMessage = async (message: Omit<ChatMessage, 'id'> & { id?: string }): Promise<string | undefined> => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        type: message.type,
        content: message.content,
        job_posting_id: message.jobPostingId ?? null,
        is_processing: message.isProcessing ?? false,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding message:', error);
      return;
    }
    
    const newMessage: ChatMessage = {
      id: data.id,
      type: data.type as 'user' | 'assistant' | 'system',
      content: data.content,
      jobPostingId: data.job_posting_id ?? undefined,
      isProcessing: data.is_processing ?? false,
      createdAt: new Date(data.created_at),
    };
    setMessages(prev => [...prev, newMessage]);
    return data.id;
  };

  const updateMessage = async (id: string, updates: Partial<ChatMessage>) => {
    if (!user) return;
    
    const dbUpdates: Record<string, any> = {};
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.isProcessing !== undefined) dbUpdates.is_processing = updates.isProcessing;
    if (updates.jobPostingId !== undefined) dbUpdates.job_posting_id = updates.jobPostingId;
    
    const { error } = await supabase
      .from('chat_messages')
      .update(dbUpdates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating message:', error);
      return;
    }
    
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  // Experience operations
  const addExperience = async (experience: Omit<Experience, 'id'> & { id?: string }): Promise<string | undefined> => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('experiences')
      .insert({
        user_id: user.id,
        type: experience.type,
        title: experience.title,
        company: experience.company ?? null,
        period: experience.period ?? null,
        description: experience.description,
        bullets: experience.bullets,
        used_in_postings: experience.usedInPostings,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding experience:', error);
      toast.error('경력 추가 중 오류가 발생했습니다');
      return;
    }
    
    const newExperience: Experience = {
      id: data.id,
      type: data.type as 'work' | 'project',
      title: data.title,
      company: data.company ?? undefined,
      period: data.period ?? undefined,
      description: data.description,
      bullets: (data.bullets as string[]) || [],
      usedInPostings: (data.used_in_postings as string[]) || [],
      createdAt: new Date(data.created_at),
    };
    setExperiences(prev => [newExperience, ...prev]);
    return data.id;
  };

  const updateExperience = async (id: string, updates: Partial<Experience>) => {
    if (!user) return;
    
    const dbUpdates: Record<string, any> = {};
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.period !== undefined) dbUpdates.period = updates.period;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.bullets !== undefined) dbUpdates.bullets = updates.bullets;
    if (updates.usedInPostings !== undefined) dbUpdates.used_in_postings = updates.usedInPostings;
    
    const { error } = await supabase
      .from('experiences')
      .update(dbUpdates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating experience:', error);
      toast.error('경력 업데이트 중 오류가 발생했습니다');
      return;
    }
    
    setExperiences(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const removeExperience = async (id: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('experiences')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error removing experience:', error);
      toast.error('경력 삭제 중 오류가 발생했습니다');
      return;
    }
    
    setExperiences(prev => prev.filter(e => e.id !== id));
  };

  // Resume operations
  const addResume = async (resume: Omit<Resume, 'id'> & { id?: string }): Promise<string | undefined> => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        file_name: resume.fileName,
        file_url: resume.fileUrl,
        parse_status: resume.parseStatus,
        parse_error: resume.parseError ?? null,
        extracted_text: resume.extractedText ?? null,
        ocr_text: resume.ocrText ?? null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding resume:', error);
      toast.error('이력서 추가 중 오류가 발생했습니다');
      return;
    }
    
    const newResume: Resume = {
      id: data.id,
      fileName: data.file_name,
      fileUrl: data.file_url,
      uploadedAt: new Date(data.uploaded_at),
      parseStatus: data.parse_status as 'pending' | 'success' | 'fail',
      parseError: data.parse_error ?? undefined,
      extractedText: data.extracted_text ?? undefined,
      ocrText: data.ocr_text ?? undefined,
      parsedAt: data.parsed_at ? new Date(data.parsed_at) : undefined,
    };
    setResumes(prev => [newResume, ...prev]);
    return data.id;
  };

  const updateResume = async (id: string, updates: Partial<Resume>) => {
    if (!user) return;

    const dbUpdates: Record<string, any> = {};
    if (updates.parseStatus !== undefined) dbUpdates.parse_status = updates.parseStatus;
    if (updates.parseError !== undefined) dbUpdates.parse_error = updates.parseError;
    if (updates.extractedText !== undefined) dbUpdates.extracted_text = updates.extractedText;
    if (updates.ocrText !== undefined) dbUpdates.ocr_text = updates.ocrText;
    if (updates.parsedAt !== undefined) dbUpdates.parsed_at = updates.parsedAt?.toISOString();

    // If there's nothing to persist, don't call the backend (it can throw "no values" errors).
    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase
      .from('resumes')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Error updating resume:', error);
      toast.error('이력서 업데이트 중 오류가 발생했습니다');
      return;
    }

    setResumes(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeResume = async (id: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error removing resume:', error);
      toast.error('이력서 삭제 중 오류가 발생했습니다');
      return;
    }
    
    setResumes(prev => prev.filter(r => r.id !== id));
  };

  // Tailored resume operations
  const addTailoredResume = async (resume: Omit<TailoredResume, 'id'> & { id?: string }): Promise<string | undefined> => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('tailored_resumes')
      .insert({
        user_id: user.id,
        job_posting_id: resume.jobPostingId,
        company_name: resume.companyName,
        job_title: resume.jobTitle,
        content: resume.content,
        ai_feedback: resume.aiFeedback ?? null,
        language: resume.language,
        format: resume.format,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding tailored resume:', error);
      toast.error('맞춤 이력서 추가 중 오류가 발생했습니다');
      return;
    }
    
    const newResume: TailoredResume = {
      id: data.id,
      jobPostingId: data.job_posting_id,
      companyName: data.company_name,
      jobTitle: data.job_title,
      content: data.content,
      aiFeedback: data.ai_feedback ?? undefined,
      language: data.language as 'ko' | 'en',
      format: data.format as 'consulting' | 'narrative',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
    setTailoredResumes(prev => [newResume, ...prev]);
    return data.id;
  };

  const updateTailoredResume = async (id: string, updates: Partial<TailoredResume>) => {
    if (!user) return;
    
    const dbUpdates: Record<string, any> = {};
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.aiFeedback !== undefined) dbUpdates.ai_feedback = updates.aiFeedback;
    if (updates.language !== undefined) dbUpdates.language = updates.language;
    if (updates.format !== undefined) dbUpdates.format = updates.format;
    
    const { error } = await supabase
      .from('tailored_resumes')
      .update(dbUpdates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating tailored resume:', error);
      toast.error('맞춤 이력서 업데이트 중 오류가 발생했습니다');
      return;
    }
    
    setTailoredResumes(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date() } : r));
  };

  const removeTailoredResume = async (id: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('tailored_resumes')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error removing tailored resume:', error);
      toast.error('맞춤 이력서 삭제 중 오류가 발생했습니다');
      return;
    }
    
    setTailoredResumes(prev => prev.filter(r => r.id !== id));
  };

  // Career goal operations
  const addGoal = async (goal: Omit<CareerGoal, 'id'> & { id?: string }): Promise<string | undefined> => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('career_goals')
      .insert({
        user_id: user.id,
        type: goal.type,
        reason: goal.reason,
        career_path: goal.careerPath ?? null,
        result: goal.result ?? null,
        search_period: goal.searchPeriod ?? null,
        company_eval_criteria: goal.companyEvalCriteria,
        start_date: goal.startDate.toISOString(),
        end_date: goal.endDate?.toISOString() ?? null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding goal:', error);
      toast.error('목표 추가 중 오류가 발생했습니다');
      return;
    }
    
    const newGoal: CareerGoal = {
      id: data.id,
      type: data.type as 'immediate' | 'short-term' | 'long-term',
      reason: data.reason,
      careerPath: data.career_path ?? undefined,
      result: data.result ?? undefined,
      searchPeriod: data.search_period ?? undefined,
      companyEvalCriteria: (data.company_eval_criteria as any[]) || [],
      startDate: new Date(data.start_date),
      endDate: data.end_date ? new Date(data.end_date) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
    setCurrentGoals(prev => [newGoal, ...prev]);
    return data.id;
  };

  const updateGoal = async (id: string, updates: Partial<CareerGoal>) => {
    if (!user) return;
    
    const dbUpdates: Record<string, any> = {};
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.reason !== undefined) dbUpdates.reason = updates.reason;
    if (updates.careerPath !== undefined) dbUpdates.career_path = updates.careerPath;
    if (updates.result !== undefined) dbUpdates.result = updates.result;
    if (updates.searchPeriod !== undefined) dbUpdates.search_period = updates.searchPeriod;
    if (updates.companyEvalCriteria !== undefined) dbUpdates.company_eval_criteria = updates.companyEvalCriteria;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate.toISOString();
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate?.toISOString() ?? null;
    
    const { error } = await supabase
      .from('career_goals')
      .update(dbUpdates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating goal:', error);
      toast.error('목표 업데이트 중 오류가 발생했습니다');
      return;
    }
    
    setCurrentGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates, updatedAt: new Date() } : g));
  };

  const removeGoal = async (id: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('career_goals')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      console.error('Error archiving goal:', error);
      toast.error('목표 삭제 중 오류가 발생했습니다');
      return;
    }
    
    setCurrentGoals(prev => prev.filter(g => g.id !== id));
  };

  return {
    isLoading,
    // Job postings
    jobPostings,
    addJobPosting,
    updateJobPosting,
    removeJobPosting,
    // Messages
    messages,
    addMessage,
    updateMessage,
    // Experiences
    experiences,
    addExperience,
    updateExperience,
    removeExperience,
    // Resumes
    resumes,
    addResume,
    updateResume,
    removeResume,
    // Tailored resumes
    tailoredResumes,
    addTailoredResume,
    updateTailoredResume,
    removeTailoredResume,
    // Goals
    currentGoals,
    addGoal,
    updateGoal,
    removeGoal,
    // Refetch
    refetch: fetchAllData,
  };
}
