-- Add Korean and English name fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN name_ko text,
ADD COLUMN name_en text;

-- Migrate existing name to name_ko (assuming most users have Korean names)
UPDATE public.profiles SET name_ko = name WHERE name IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.name_ko IS 'Korean name for Korean job postings';
COMMENT ON COLUMN public.profiles.name_en IS 'English name for English job postings';