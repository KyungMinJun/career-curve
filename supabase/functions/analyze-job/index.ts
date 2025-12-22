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
    
Return a JSON object with these fields:
- companyName: string (company name)
- title: string (job title)
- position: string (position category like "프론트엔드", "백엔드", "프로덕트 디자인", "PM" etc)
- minExperience: string (minimum experience required, e.g. "3년 이상", "신입 가능")
- workType: string (work type like "재택", "출근", "하이브리드")
- location: string (work location)
- visaSponsorship: boolean (if visa sponsorship mentioned)
- summary: string (3-4 sentence summary of the role in Korean)
- requirements: array of strings (top 5 key requirements)
- companyScore: number 1-5 (estimated company attractiveness based on benefits, culture mentions)
- fitScore: number 1-5 (general fit score based on role clarity)

If information is not found, use reasonable defaults or null.
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
              description: "Extract structured job posting information",
              parameters: {
                type: "object",
                properties: {
                  companyName: { type: "string" },
                  title: { type: "string" },
                  position: { type: "string" },
                  minExperience: { type: "string" },
                  workType: { type: "string" },
                  location: { type: "string" },
                  visaSponsorship: { type: "boolean" },
                  summary: { type: "string" },
                  requirements: { type: "array", items: { type: "string" } },
                  companyScore: { type: "number" },
                  fitScore: { type: "number" }
                },
                required: ["companyName", "title", "position", "summary"],
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
