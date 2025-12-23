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

    // Step 1: Scrape the job posting URL using Firecrawl
    console.log('Scraping URL:', url);
    
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to scrape URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pageContent = scrapeData.data?.markdown || '';
    const pageTitle = scrapeData.data?.metadata?.title || '';
    
    console.log('Scraped content length:', pageContent.length);

    // Step 2: Use AI to analyze and extract job posting information
    const systemPrompt = `You are a job posting analyzer. Extract structured information from job postings.

CRITICAL INSTRUCTIONS:
1. For each field, you MUST provide the exact source sentence from the job posting as evidence.
2. If a field is not mentioned or cannot be found, set it to null and set evidence to "공고에 명시되지 않음".
3. For keyCompetencies: Extract EXACTLY 5 key competencies from the RECRUITER'S perspective - what they would prioritize when evaluating candidates.

Extract and return:
- companyName: company name
- title: job title  
- position: position category like "프론트엔드", "백엔드", "프로덕트 디자인", "PM" etc
- minExperience: minimum experience required (e.g. "3년 이상", "신입 가능")
- minExperienceEvidence: exact source sentence from job posting
- workType: work type ("재택", "출근", "하이브리드")
- workTypeEvidence: exact source sentence from job posting
- location: work location
- locationEvidence: exact source sentence from job posting
- visaSponsorship: boolean or null (if not mentioned)
- visaSponsorshipEvidence: exact source sentence or "공고에 명시되지 않음"
- summary: 3-4 sentence summary of the role in Korean
- keyCompetencies: array of EXACTLY 5 objects with {title, description} - the must-have experiences and abilities from recruiter's perspective
- companyScore: number 1-5 (estimated company attractiveness based on benefits, culture)
- fitScore: number 1-5 (general fit score based on role clarity)

Always respond in Korean for text fields.`;

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
                required: ["companyName", "title", "position", "summary", "keyCompetencies"],
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
      // Fallback: try to extract from content
      console.log('No tool call found, using defaults');
      jobData = {
        companyName: pageTitle?.split(/[|-]/).pop()?.trim() || '회사명 확인 필요',
        title: pageTitle?.split(/[|-]/)[0]?.trim() || '채용 공고',
        position: '미정',
        summary: '공고 내용을 확인해주세요.',
        keyCompetencies: [],
        companyScore: 3,
        fitScore: 3
      };
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
