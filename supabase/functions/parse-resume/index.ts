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
    const { fileName, resumeId, resumeText } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // If no resume text provided, we cannot parse
    if (!resumeText || resumeText.trim().length === 0) {
      console.log('No resume text provided');
      return new Response(
        JSON.stringify({ 
          success: true, 
          experiences: [],
          message: 'No resume content to parse'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert resume parser. Extract work experiences and projects from the resume.

CRITICAL INSTRUCTIONS:
1. ONLY extract information that is ACTUALLY in the resume. Do NOT make up or hallucinate any experiences.
2. Categorize each item as either "work" (for job positions, employment) or "project" (for side projects, personal projects, academic projects).
3. Extract the actual title, company/organization name, description, and bullet points from the resume.
4. If information is unclear, use what's written - do not invent details.

Return a JSON object with:
- experiences: array of objects with:
  - type: "work" or "project"
  - title: actual job title or project name from resume
  - company: actual company name (for work) or organization/team (for project)
  - description: brief description extracted from resume
  - bullets: array of actual achievements/responsibilities from resume

Always respond in Korean if the resume is in Korean, otherwise match the resume language.`;

    console.log('Parsing resume with AI, text length:', resumeText.length);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Parse this resume and extract experiences:\n\n${resumeText.substring(0, 10000)}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_resume_experiences",
              description: "Extract work experiences and projects from resume",
              parameters: {
                type: "object",
                properties: {
                  experiences: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["work", "project"] },
                        title: { type: "string" },
                        company: { type: "string" },
                        description: { type: "string" },
                        bullets: { type: "array", items: { type: "string" } }
                      },
                      required: ["type", "title", "description", "bullets"]
                    }
                  }
                },
                required: ["experiences"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_resume_experiences" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    let experiences = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        experiences = parsed.experiences || [];
        console.log('Extracted experiences:', experiences.length);
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, experiences }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error parsing resume:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
