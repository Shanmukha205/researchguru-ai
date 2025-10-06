import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get auth token
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Fetch all agent results for the project
    const { data: results, error: resultsError } = await supabaseClient
      .from('agent_results')
      .select('*')
      .eq('project_id', projectId);

    if (resultsError) throw resultsError;

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No agent results found for this project' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare data for AI analysis
    const agentSummary = results.map(r => ({
      agent: r.agent_type,
      status: r.status,
      results: r.results
    }));

    const prompt = `Analyze the following research agent results and provide:
1. Key findings (3-5 bullet points)
2. Sentiment analysis (overall positive/negative/neutral with percentages)
3. Trends and patterns identified
4. Anomalies or unexpected results
5. Actionable recommendations

Agent Results:
${JSON.stringify(agentSummary, null, 2)}

Provide structured JSON output with: keyFindings (array), sentimentAnalysis (object with positive, negative, neutral percentages), trends (array), anomalies (array), recommendations (array)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a research analyst. Always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_insights",
              description: "Generate structured insights from research data",
              parameters: {
                type: "object",
                properties: {
                  keyFindings: {
                    type: "array",
                    items: { type: "string" }
                  },
                  sentimentAnalysis: {
                    type: "object",
                    properties: {
                      positive: { type: "number" },
                      negative: { type: "number" },
                      neutral: { type: "number" }
                    },
                    required: ["positive", "negative", "neutral"]
                  },
                  trends: {
                    type: "array",
                    items: { type: "string" }
                  },
                  anomalies: {
                    type: "array",
                    items: { type: "string" }
                  },
                  recommendations: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["keyFindings", "sentimentAnalysis", "trends", "anomalies", "recommendations"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_insights" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No insights generated");
    }

    const insights = JSON.parse(toolCall.function.arguments);

    // Store insights in database
    const { error: insertError } = await supabaseClient
      .from('insights')
      .insert({
        project_id: projectId,
        insight_type: 'ai_summary',
        data: insights
      });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});