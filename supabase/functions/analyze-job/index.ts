import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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
      return { valid: false, error: '지원되지 않는 URL 형식입니다.' };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) {
      return { valid: false, error: '유효하지 않은 URL입니다.' };
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
      return { valid: false, error: '유효하지 않은 URL입니다.' };
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
      return { valid: false, error: 'URL이 너무 깁니다.' };
    }
    
    return { valid: true, url: formattedUrl };
  } catch {
    return { valid: false, error: '올바른 URL 형식이 아닙니다.' };
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
        JSON.stringify({ success: false, error: 'Unauthorized' }),
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
        JSON.stringify({ success: false, error: 'Invalid token' }),
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
        JSON.stringify({ success: false, error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (subscription.ai_credits_remaining < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient AI credits' }),
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
        JSON.stringify({ success: false, error: 'Credit deduction failed. Please try again.' }),
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
          error: 'Invalid input data',
          details: validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
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
          JSON.stringify({ success: false, error: 'Failed to scrape URL' }),
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
    const systemPrompt = `You are a job posting analyzer. Extract structured information from job postings.

CRITICAL INSTRUCTIONS:
1. Determine the original language of the job posting content: Korean (ko) or English (en).
2. Return the field "language" as either "ko" or "en".
3. For ALL text fields (companyName, title, position, summary, keyCompetencies.title/description, evidence strings):
   - Use the SAME language as the original posting.
   - Evidence must be an exact source sentence from the posting (do not translate evidence).
4. If a field is not mentioned, set it to null and set evidence to "Not specified" (English) or "공고에 명시되지 않음" (Korean), matching the posting language.
5. For keyCompetencies: Extract EXACTLY 5 key competencies from the RECRUITER'S perspective.

Extract and return:
- language: "ko" | "en"
- companyName: company name
- title: job title
- position: position category like "Frontend", "Backend", "Product Design", "PM" etc
- minExperience: minimum experience required (nullable)
- minExperienceEvidence: exact source sentence
- workType: work type (nullable)
- workTypeEvidence: exact source sentence
- location: work location (nullable)
- locationEvidence: exact source sentence
- visaSponsorship: boolean or null (if not mentioned)
- visaSponsorshipEvidence: exact source sentence
- summary: 3-4 sentence summary of the role (same language as posting)
- keyCompetencies: array of EXACTLY 5 objects with {title, description}
- companyScore: number 1-5
- fitScore: number 1-5
`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
                 required: ["language", "companyName", "title", "position", "summary", "keyCompetencies"],
                 additionalProperties: false
               }
             }
           }
         ],
        tool_choice: { type: "function", function: { name: "extract_job_posting" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract the structured data from tool call
    let jobData = null;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
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
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
