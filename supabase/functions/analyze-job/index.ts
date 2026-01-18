import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { callGeminiFromLovable, normalizeGeminiToLovable } from "../_shared/gemini.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  url: z.string().min(1).max(2000),
});

// Allowlisted job board domains for URL validation
const ALLOWED_DOMAINS = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'jobkorea.co.kr',
  'saramin.co.kr',
  'wanted.co.kr',
  'rocketpunch.com',
  'jumpit.co.kr',
  'programmers.co.kr',
  'catch.co.kr',
  'incruit.com',
  'worknet.go.kr',
  'albamon.com',
  'alba.co.kr',
  'job.go.kr',
  'career.co.kr',
  'jobs.lever.co',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.ashbyhq.com',
  'apply.workable.com',
  'jobs.smartrecruiters.com',
  'recruiting.paylocity.com',
  'monster.com',
  'ziprecruiter.com',
  'careerbuilder.com',
  'dice.com',
  'simplyhired.com',
  'flexjobs.com',
  'angel.co',
  'wellfound.com',
  'remoteok.com',
  'weworkremotely.com',
  'stackoverflow.jobs',
  'hired.com',
  'triplebyte.com',
];

/**
 * Validates a URL to prevent SSRF attacks
 * - Only allows HTTPS/HTTP protocols
 * - Blocks private IP ranges and localhost
 * - Checks against allowlisted job board domains
 */
function validateUrl(urlString: string): { valid: boolean; error?: string; url?: string } {
  try {
    // Add protocol if missing
    const formattedUrl = urlString.trim().startsWith('http') 
      ? urlString.trim() 
      : `https://${urlString.trim()}`;
    
    const parsed = new URL(formattedUrl);
    
    // Only allow HTTP/HTTPS protocols
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return { valid: false, error: '지원되지 않는 URL 형식입니다. http 또는 https URL을 입력해주세요.' };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) {
      return { valid: false, error: '유효하지 않은 URL입니다. 올바른 채용 공고 URL을 입력해주세요.' };
    }
    
    // Block private IP ranges
    if (
      hostname.match(/^10\./i) ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./i) ||
      hostname.match(/^192\.168\./i) ||
      hostname.match(/^169\.254\./i) || // link-local (AWS metadata)
      hostname.match(/^fe80:/i) || // IPv6 link-local
      hostname.match(/^fc00:/i) || // IPv6 unique local
      hostname.match(/^fd[0-9a-f]{2}:/i) // IPv6 unique local
    ) {
      return { valid: false, error: '유효하지 않은 URL입니다. 올바른 채용 공고 URL을 입력해주세요.' };
    }
    
    // Check if domain is in allowlist
    const isAllowed = ALLOWED_DOMAINS.some(allowed => 
      hostname === allowed || hostname.endsWith('.' + allowed)
    );
    
    if (!isAllowed) {
      return { 
        valid: false, 
        error: '지원되지 않는 사이트입니다. LinkedIn, 잡코리아, 사람인, 원티드 등 주요 채용 사이트의 URL을 입력해주세요.' 
      };
    }
    
    // URL length check (already validated by Zod, but double-check)
    if (formattedUrl.length > 2000) {
      return { valid: false, error: 'URL이 너무 깁니다. URL을 줄여 다시 시도해주세요.' };
    }
    
    return { valid: true, url: formattedUrl };
  } catch {
    return { valid: false, error: '올바른 URL 형식이 아닙니다. 전체 URL을 확인해주세요.' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: '로그인이 필요합니다. 다시 로그인한 뒤 재시도해주세요.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: '인증이 만료되었습니다. 다시 로그인해주세요.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Atomic credit check and deduction (prevents race condition)
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('ai_credits_remaining, ai_credits_used')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      console.error('Subscription fetch error:', subError);
      return new Response(
        JSON.stringify({ success: false, error: '구독 정보를 찾을 수 없습니다. 결제 상태를 확인하거나 고객센터에 문의해주세요.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (subscription.ai_credits_remaining < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI 크레딧이 부족합니다. 플랜을 업그레이드하거나 크레딧을 충전해주세요.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optimistic concurrency control - only update if credits haven't changed
    const { error: creditError, count: updatedCount } = await supabaseClient
      .from('user_subscriptions')
      .update({
        ai_credits_remaining: subscription.ai_credits_remaining - 1,
        ai_credits_used: (subscription.ai_credits_used || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('ai_credits_remaining', subscription.ai_credits_remaining);

    if (creditError || updatedCount === 0) {
      console.error('Credit deduction failed (race condition):', creditError);
      return new Response(
        JSON.stringify({ success: false, error: '크레딧 차감에 실패했습니다. 잠시 후 다시 시도해주세요.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI credit deducted successfully');

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = requestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.issues);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '요청 형식이 올바르지 않습니다. 입력 값을 확인하고 다시 시도해주세요.',
          details: validationResult.error.issues.map(i => `${i.path.join('.')}: 입력 값을 확인해주세요.`)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = validationResult.data;

    // Validate URL to prevent SSRF attacks
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      console.log('URL validation failed:', url, urlValidation.error);
      return new Response(
        JSON.stringify({ success: false, error: urlValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedUrl = urlValidation.url!;

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: '페이지 분석 설정이 완료되지 않았습니다. 잠시 후 다시 시도하거나 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI 설정이 완료되지 않았습니다. 잠시 후 다시 시도하거나 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping validated URL:', formattedUrl);
    
    let pageContent = '';
    let pageTitle = '';
    
    // Check if this is LinkedIn or other restricted site
    const isLinkedIn = formattedUrl.includes('linkedin.com');
    
    if (isLinkedIn) {
      // For LinkedIn, try direct fetch with browser-like headers
      console.log('LinkedIn detected, using direct fetch');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      try {
        const directResponse = await fetch(formattedUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        });
        clearTimeout(timeoutId);
        
        if (directResponse.ok) {
          const html = await directResponse.text();
          
          // Extract title
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          pageTitle = titleMatch ? titleMatch[1].trim() : '';
          
          // Extract meta description
          const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
          const description = descMatch ? descMatch[1].trim() : '';
          
          // Extract JSON-LD structured data (LinkedIn often has this)
          const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
          let jsonLdContent = '';
          for (const match of jsonLdMatches) {
            try {
              const parsed = JSON.parse(match[1]);
              jsonLdContent += JSON.stringify(parsed, null, 2) + '\n\n';
            } catch (e) {
              // ignore parse errors
            }
          }
          
          // Extract visible text from main content areas
          let bodyContent = '';
          const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                           html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                           html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
          if (mainMatch) {
            bodyContent = mainMatch[1]
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          }
          
          pageContent = `Title: ${pageTitle}\n\nDescription: ${description}\n\n${jsonLdContent ? 'Structured Data:\n' + jsonLdContent : ''}\n\nContent:\n${bodyContent}`;
          console.log('Direct fetch content length:', pageContent.length);
        } else {
          console.log('Direct fetch failed:', directResponse.status);
        }
      } catch (e) {
        console.error('Direct fetch error:', e);
      }
    }
    
    // If direct fetch didn't work or not LinkedIn, try Firecrawl
    if (!pageContent || pageContent.length < 100) {
      console.log('Trying Firecrawl...');
      const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formattedUrl,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
      });

      const scrapeData = await scrapeResponse.json();

      if (!scrapeResponse.ok || !scrapeData.success) {
        console.error('Firecrawl error:', scrapeData);
        
        // If both methods failed, return helpful error message
        const isUnsupported = scrapeData.error?.includes('not currently supported');
        if (isUnsupported) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'LinkedIn 공고는 현재 자동 분석이 제한됩니다. 공고 내용을 직접 복사하여 입력해주세요.',
              unsupportedSite: true
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: false, error: '페이지 내용을 가져오지 못했습니다. URL을 확인하거나 공고 내용을 직접 입력해주세요.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      pageContent = scrapeData.data?.markdown || '';
      pageTitle = scrapeData.data?.metadata?.title || pageTitle;
    }

    console.log('Final content length:', pageContent.length);
    
    if (!pageContent || pageContent.length < 50) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '페이지 내용을 가져올 수 없습니다. URL을 확인하거나 공고 내용을 직접 입력해주세요.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Use AI to analyze and extract job posting information
    const systemPrompt = `You are a job posting analyzer.

Your task is to extract structured information from a job posting.
Treat the job posting as a hiring decision document, not a simple description.

CRITICAL INSTRUCTIONS:

0. Determine if the content is actually a job posting:
   - If it is NOT a job posting, set "isJobPosting" to false.
   - If it IS a job posting, set "isJobPosting" to true.

1. Determine the original language of the job posting content:
   - Korean (ko) or English (en)
   - Return the field "language" as either "ko" or "en"

2. For ALL text fields (companyName, title, position, summary, keyCompetencies.title, keyCompetencies.description, all evidence fields):
   - Use the SAME language as the original posting
   - Use the SAME language as the original posting
   - Evidence must be an EXACT source sentence from the posting (verbatim, no translation, no paraphrasing)

3. If a field is not mentioned:
   - Set the value to null
   - Set evidence to:
     - "Not specified" (English)
     - "공고에 명시되지 않음" (Korean)
   - Match the posting language exactly

4. Key interpretation rule (VERY IMPORTANT):
   - Do NOT simply list skills, responsibilities, or tools.
   - Extract what the recruiter is ACTUALLY evaluating when deciding pass/fail.
   - Combine experience and competency when they function as a single hiring criterion.
   - Exclude generic traits (e.g. “good communication”) unless they clearly affect hiring decisions.
   - Prioritize based on repetition, emphasis, and hiring risk if missing.

5. For keyCompetencies:
   - Extract EXACTLY 5 key competencies from the RECRUITER’S perspective.
   - These must represent the CORE hiring evaluation axes.
   - Each competency must be:
     - Non-overlapping
     - Non-substitutable
     - Critical enough that missing it would increase hiring risk
   - Order the 5 competencies by importance (most critical first).
   - Write each competency as a capability the candidate must already demonstrate (not a task list).

---

EXTRACT AND RETURN:

- language: "ko" | "en"

- companyName: company name

- title: job title

- position: position category
  (e.g. "Frontend", "Backend", "Product Design", "PM", "Program Management", etc.)

- minExperience: minimum experience required (nullable)
- minExperienceEvidence: exact source sentence

- workType: work type (nullable)
- workTypeEvidence: exact source sentence

- location: work location (nullable)
- locationEvidence: exact source sentence

- visaSponsorship: boolean or null
- visaSponsorshipEvidence: exact source sentence

- summary:
  Write a 3–4 sentence summary of the role that explains:
  - Why this role exists
  - What success looks like
  - What failure would look like
  (Use the original posting language only.)

- keyCompetencies:
  An array of EXACTLY 5 objects.
  Each object must include:
  {
    title: concise recruiter-style evaluation label,
    description: what the recruiter is truly evaluating (experience + competency combined)
  }

- companyScore: number (1–5)
- fitScore: number (1–5)

OUTPUT FORMAT RULES:
- Follow the field order above.
- Do NOT add extra fields.
- Do NOT include explanations outside the extracted results.
- Do NOT infer or assume anything not grounded in the posting text.
`;

    const aiResponse = await callGeminiFromLovable({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Page title: ${pageTitle}\n\nJob posting content:\n${pageContent.substring(0, 15000)}` }
      ],
      tools: [
         {
           type: "function",
           function: {
             name: "extract_job_posting",
             description: "Extract structured job posting information with evidence",
             parameters: {
               type: "object",
               properties: {
                 isJobPosting: { type: "boolean" },
                 language: { type: "string", enum: ["ko", "en"] },
                 companyName: { type: "string" },
                 title: { type: "string" },
                 position: { type: "string" },
                 minExperience: { type: "string", nullable: true },
                 minExperienceEvidence: { type: "string" },
                 workType: { type: "string", nullable: true },
                 workTypeEvidence: { type: "string" },
                 location: { type: "string", nullable: true },
                 locationEvidence: { type: "string" },
                 visaSponsorship: { type: "boolean", nullable: true },
                 visaSponsorshipEvidence: { type: "string" },
                 summary: { type: "string" },
                 keyCompetencies: {
                   type: "array",
                   items: {
                     type: "object",
                     properties: {
                       title: { type: "string" },
                       description: { type: "string" }
                     },
                     required: ["title", "description"]
                   },
                   minItems: 5,
                   maxItems: 5
                 },
                 companyScore: { type: "number" },
                 fitScore: { type: "number" }
               },
               required: ["isJobPosting", "language", "companyName", "title", "position", "summary", "keyCompetencies"],
               additionalProperties: false
             }
           }
         }
       ],
      tool_choice: { type: "function", function: { name: "extract_job_posting" } }
    }, geminiApiKey);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI 크레딧이 필요합니다. 크레딧을 충전한 뒤 다시 시도해주세요.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiDataRaw = await aiResponse.json();
    const aiData = normalizeGeminiToLovable(aiDataRaw);
    console.log('AI response received');

    // Extract the structured data from tool call
    let jobData = null;
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        jobData = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
      }
    }

    if (!jobData) {
      // No valid data extracted - return error instead of mock data
      console.log('No valid job data extracted from AI response');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '공고 내용을 추출할 수 없습니다. 페이지가 마감되었거나 접근할 수 없는 상태일 수 있습니다.',
          noContent: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (jobData.isJobPosting === false) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '공고가 아닙니다. 채용 공고 URL을 입력해주세요.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted job data:', jobData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          ...jobData,
          sourceUrl: url
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-job function:', error);
    const fallbackMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    const safeMessage =
      error instanceof Error && /[가-힣]/.test(error.message) ? error.message : fallbackMessage;
    return new Response(
      JSON.stringify({ success: false, error: safeMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
