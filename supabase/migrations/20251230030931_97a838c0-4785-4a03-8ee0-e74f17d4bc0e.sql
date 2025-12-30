-- Add language column to job_postings table
ALTER TABLE public.job_postings 
ADD COLUMN language text DEFAULT 'ko';

-- Add comment for clarity
COMMENT ON COLUMN public.job_postings.language IS 'Language of the job posting: ko (Korean) or en (English)';