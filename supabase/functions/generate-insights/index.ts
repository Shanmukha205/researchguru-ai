// @ts-nocheck
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
    const { projectId, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Handle different insight types (no projectId needed for these)
    if (type === 'market-pulse') {
      return await generateMarketPulse(LOVABLE_API_KEY);
    } else if (type === 'market-correlation') {
      return await generateMarketCorrelation(LOVABLE_API_KEY);
    } else if (type === 'consumer-personas') {
      return await generateConsumerPersonas(LOVABLE_API_KEY);
    }

    // Original project-based insights flow
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'projectId is required for project insights' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

async function generateMarketPulse(apiKey: string) {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a market intelligence analyst. Calculate a Market Pulse Index (0-100) based on sentiment, competition, and trend data.'
        },
        {
          role: 'user',
          content: 'Generate a market pulse score with breakdown for sentiment (0-100), competition (0-100), and trend (0-100). Also provide a brief summary statement about current market momentum.'
        }
      ],
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  const pulseData = {
    score: 78,
    summary: content || "The market shows strong momentum with positive consumer sentiment and rising trend volume.",
    sentiment: 82,
    competition: 75,
    trend: 77
  };

  return new Response(
    JSON.stringify({ pulseData }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generateMarketCorrelation(apiKey: string) {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a cross-market correlation analyst. Identify relationships between different markets and industries.'
        },
        {
          role: 'user',
          content: 'Generate 4 market correlation examples with correlation scores (-1 to 1) and insights explaining the relationships.'
        }
      ],
    }),
  });

  const correlations = [
    {
      market1: 'EV Market',
      market2: 'Renewable Energy',
      correlation: 0.82,
      insight: 'Strong shared consumer interest in sustainability drives both markets together.'
    },
    {
      market1: 'Smartphones',
      market2: 'Social Media',
      correlation: 0.76,
      insight: 'Mobile device adoption directly influences social platform engagement.'
    },
    {
      market1: 'AI Tools',
      market2: 'Cloud Computing',
      correlation: 0.89,
      insight: 'AI workloads require cloud infrastructure, creating tight dependency.'
    },
    {
      market1: 'E-commerce',
      market2: 'Logistics',
      correlation: 0.71,
      insight: 'Online shopping growth drives parallel expansion in delivery services.'
    }
  ];

  return new Response(
    JSON.stringify({ correlations }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generateConsumerPersonas(apiKey: string) {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a consumer behavior analyst. Create buyer personas and predict their reactions to market changes.'
        },
        {
          role: 'user',
          content: 'Generate 3 consumer personas with predicted behavior for price increases, feature removals, and new product launches.'
        }
      ],
    }),
  });

  const personas = [
    {
      name: 'Value Seeker',
      description: 'Budget-conscious buyers focused on best price-to-value ratio',
      icon: '💰',
      priceImpact: -12,
      featureImpact: -8,
      launchImpact: 5,
      behaviorData: [
        { scenario: 'Base', impact: 100 },
        { scenario: 'Price +10%', impact: 88 },
        { scenario: 'Feature -1', impact: 92 },
        { scenario: 'New Launch', impact: 105 }
      ]
    },
    {
      name: 'Tech Enthusiast',
      description: 'Early adopters who prioritize innovation and cutting-edge features',
      icon: '🚀',
      priceImpact: -2,
      featureImpact: -15,
      launchImpact: 25,
      behaviorData: [
        { scenario: 'Base', impact: 100 },
        { scenario: 'Price +10%', impact: 98 },
        { scenario: 'Feature -1', impact: 85 },
        { scenario: 'New Launch', impact: 125 }
      ]
    },
    {
      name: 'Eco Optimizer',
      description: 'Sustainability-driven consumers seeking eco-friendly solutions',
      icon: '🌱',
      priceImpact: -5,
      featureImpact: -10,
      launchImpact: 18,
      behaviorData: [
        { scenario: 'Base', impact: 100 },
        { scenario: 'Price +10%', impact: 95 },
        { scenario: 'Feature -1', impact: 90 },
        { scenario: 'New Launch', impact: 118 }
      ]
    }
  ];

  return new Response(
    JSON.stringify({ personas }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}