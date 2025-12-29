import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Step 1: Scrape the job posting URL
    const formattedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
    console.log('Scraping URL:', formattedUrl);
    
    let pageContent = '';
    let pageTitle = '';
    
    // Check if this is LinkedIn or other restricted site
    const isLinkedIn = formattedUrl.includes('linkedin.com');
    
    if (isLinkedIn) {
      // For LinkedIn, try direct fetch with browser-like headers
      console.log('LinkedIn detected, using direct fetch');
      try {
        const directResponse = await fetch(formattedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        });
        
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
