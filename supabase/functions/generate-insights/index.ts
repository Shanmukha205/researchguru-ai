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
    
    // Try to use primary Gemini API key, fall back to secondary if needed
    const PRIMARY_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SECONDARY_API_KEY = Deno.env.get("GEMINI_API_KEY_2");
    
    let LOVABLE_API_KEY = PRIMARY_API_KEY;
    
    if (!LOVABLE_API_KEY) {
      LOVABLE_API_KEY = SECONDARY_API_KEY;
      if (!LOVABLE_API_KEY) {
        throw new Error("No API keys configured");
      }
      console.log("Using secondary API key");
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
  try {
    // Create Supabase client to fetch real data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch recent agent results
    const { data: agentResults, error: resultsError } = await supabaseClient
      .from('agent_results')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (resultsError) throw resultsError;

    if (!agentResults || agentResults.length === 0) {
      // Return default data if no results
      return new Response(
        JSON.stringify({ 
          pulseData: {
            score: 50,
            summary: "No market data available yet. Run research projects to generate insights.",
            sentiment: 50,
            competition: 50,
            trend: 50
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate sentiment score
    const sentimentResults = agentResults.filter(r => r.agent_type === 'sentiment');
    let sentimentScore = 50;
    if (sentimentResults.length > 0) {
      const avgPositive = sentimentResults.reduce((sum, r) => 
        sum + (r.results?.positive || 0), 0) / sentimentResults.length;
      const avgNegative = sentimentResults.reduce((sum, r) => 
        sum + (r.results?.negative || 0), 0) / sentimentResults.length;
      sentimentScore = Math.round((avgPositive - avgNegative + 100) / 2);
    }

    // Calculate competition score
    const competitorResults = agentResults.filter(r => r.agent_type === 'competitor');
    let competitionScore = 50;
    if (competitorResults.length > 0) {
      const allCompetitors = competitorResults.flatMap(r => r.results?.competitors || []);
      if (allCompetitors.length > 0) {
        const avgRating = allCompetitors.reduce((sum: number, c: any) => 
          sum + (c.rating || 0), 0) / allCompetitors.length;
        competitionScore = Math.round((avgRating / 5) * 100);
      }
    }

    // Calculate trend score
    const trendResults = agentResults.filter(r => r.agent_type === 'trend');
    let trendScore = 50;
    if (trendResults.length > 0) {
      const avgTrendScore = trendResults.reduce((sum, r) => 
        sum + (r.results?.trendScore || 50), 0) / trendResults.length;
      trendScore = Math.round(avgTrendScore);
    }

    // Calculate overall Market Pulse Index
    const overallScore = Math.round(
      (sentimentScore * 0.4) + (competitionScore * 0.3) + (trendScore * 0.3)
    );

    // Generate AI summary based on real data
    const summaryPrompt = `Based on this market data, generate a one-sentence summary:
- Sentiment Score: ${sentimentScore}/100 (${sentimentScore > 60 ? 'positive' : sentimentScore < 40 ? 'negative' : 'neutral'})
- Competition Score: ${competitionScore}/100
- Trend Score: ${trendScore}/100
- Overall Market Pulse: ${overallScore}/100

Create a brief, business-focused summary highlighting the market momentum.`;

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
            content: 'You are a market intelligence analyst. Provide concise, actionable summaries.'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
      }),
    });

    const data = await response.json();
    const aiSummary = data.choices?.[0]?.message?.content || 
      `Market shows ${overallScore > 60 ? 'strong' : overallScore < 40 ? 'weak' : 'moderate'} momentum with ${sentimentScore > 60 ? 'positive' : 'mixed'} consumer sentiment.`;
    
    const pulseData = {
      score: overallScore,
      summary: aiSummary,
      sentiment: sentimentScore,
      competition: competitionScore,
      trend: trendScore
    };

    return new Response(
      JSON.stringify({ pulseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating market pulse:', error);
    // Return fallback data on error
    return new Response(
      JSON.stringify({ 
        pulseData: {
          score: 50,
          summary: "Unable to calculate market pulse. Please try again.",
          sentiment: 50,
          competition: 50,
          trend: 50
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function generateMarketCorrelation(apiKey: string) {
  try {
    // Create Supabase client to fetch real data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch recent projects and their results
    const { data: projects, error: projectsError } = await supabaseClient
      .from('research_projects')
      .select('id, product_name, company_name')
      .order('created_at', { ascending: false })
      .limit(5);

    if (projectsError) throw projectsError;

    if (!projects || projects.length < 2) {
      // Return default correlations if not enough data
      return new Response(
        JSON.stringify({ 
          correlations: [
            {
              market1: 'Market Analysis',
              market2: 'Consumer Trends',
              correlation: 0.75,
              insight: 'Analyze more products to discover cross-market relationships and correlations.'
            }
          ]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch agent results for these projects
    const projectIds = projects.map(p => p.id);
    const { data: agentResults } = await supabaseClient
      .from('agent_results')
      .select('*')
      .in('project_id', projectIds)
      .eq('status', 'completed');

    // Generate AI-powered correlations
    const projectsData = projects.map(p => {
      const results = agentResults?.filter(r => r.project_id === p.id) || [];
      const sentiment = results.find(r => r.agent_type === 'sentiment')?.results;
      const competitor = results.find(r => r.agent_type === 'competitor')?.results;
      
      return {
        name: p.product_name,
        company: p.company_name,
        sentimentScore: sentiment?.overallScore || 0,
        competitorCount: competitor?.competitors?.length || 0
      };
    });

    const prompt = `Analyze these products and identify 3-4 meaningful correlations or relationships:
${JSON.stringify(projectsData, null, 2)}

For each correlation, provide:
- market1 and market2 names (product categories or market segments)
- correlation score (-1 to 1, where 1 is strong positive correlation)
- insight explaining the relationship

Return as JSON array with format: [{"market1": "X", "market2": "Y", "correlation": 0.X, "insight": "..."}]`;

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
            content: 'You are a market correlation analyst. Return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Try to parse AI response, fallback to default if needed
    let correlations;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      correlations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      correlations = [];
    }

    // Add default correlations if not enough from AI
    if (correlations.length < 2) {
      correlations = [
        {
          market1: projects[0]?.product_name || 'Product A',
          market2: projects[1]?.product_name || 'Product B',
          correlation: 0.65,
          insight: 'Both products show similar consumer sentiment patterns and market positioning.'
        },
        ...correlations
      ];
    }

    return new Response(
      JSON.stringify({ correlations: correlations.slice(0, 4) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating correlations:', error);
    // Return fallback data
    return new Response(
      JSON.stringify({ 
        correlations: [
          {
            market1: 'Market Analysis',
            market2: 'Consumer Trends',
            correlation: 0.70,
            insight: 'Run more research projects to discover meaningful market correlations.'
          }
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function generateConsumerPersonas(apiKey: string) {
  try {
    // Create Supabase client to fetch real data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch recent sentiment and competitor data
    const { data: agentResults } = await supabaseClient
      .from('agent_results')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!agentResults || agentResults.length === 0) {
      // Return default personas if no data
      return new Response(
        JSON.stringify({ 
          personas: [
            {
              name: 'Market Explorer',
              description: 'Run research projects to generate AI-powered consumer personas',
              icon: '🎯',
              priceImpact: 0,
              featureImpact: 0,
              launchImpact: 0,
              behaviorData: [
                { scenario: 'Base', impact: 100 },
                { scenario: 'Analysis', impact: 100 }
              ]
            }
          ]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze sentiment data to understand consumer behavior
    const sentimentData = agentResults.filter(r => r.agent_type === 'sentiment');
    const avgPositive = sentimentData.length > 0 
      ? sentimentData.reduce((sum, r) => sum + (r.results?.positive || 0), 0) / sentimentData.length 
      : 50;
    const avgNegative = sentimentData.length > 0
      ? sentimentData.reduce((sum, r) => sum + (r.results?.negative || 0), 0) / sentimentData.length
      : 20;

    // Generate AI-powered personas based on real market data
    const prompt = `Based on this market sentiment data (Positive: ${avgPositive}%, Negative: ${avgNegative}%), generate 3 distinct consumer personas.

For each persona provide:
- name: A descriptive persona name
- description: 2-sentence description of this consumer type
- icon: An emoji that represents them
- priceImpact: How they react to 10% price increase (-20 to +5)
- featureImpact: How they react to feature removal (-25 to 0)
- launchImpact: How they react to new product launch (0 to +30)

Return as JSON array only.`;

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
            content: 'You are a consumer behavior analyst. Return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Try to parse AI response
    let personas;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      personas = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      personas = [];
    }

    // Add behavior simulation data to each persona
    personas = personas.map((persona: any) => ({
      ...persona,
      behaviorData: [
        { scenario: 'Base', impact: 100 },
        { scenario: 'Price +10%', impact: 100 + persona.priceImpact },
        { scenario: 'Feature -1', impact: 100 + persona.featureImpact },
        { scenario: 'New Launch', impact: 100 + persona.launchImpact }
      ]
    }));

    // Use default if no personas generated
    if (personas.length === 0) {
      personas = [
        {
          name: 'Value Seeker',
          description: 'Budget-conscious buyers focused on best price-to-value ratio. Highly sensitive to price changes.',
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
          description: 'Early adopters who prioritize innovation and cutting-edge features. Less price-sensitive.',
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
          name: 'Quality Focused',
          description: 'Consumers seeking reliability and proven performance. Moderate sensitivity to changes.',
          icon: '⭐',
          priceImpact: -6,
          featureImpact: -10,
          launchImpact: 12,
          behaviorData: [
            { scenario: 'Base', impact: 100 },
            { scenario: 'Price +10%', impact: 94 },
            { scenario: 'Feature -1', impact: 90 },
            { scenario: 'New Launch', impact: 112 }
          ]
        }
      ];
    }

    return new Response(
      JSON.stringify({ personas: personas.slice(0, 3) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating personas:', error);
    // Return fallback personas
    return new Response(
      JSON.stringify({ 
        personas: [
          {
            name: 'Market Explorer',
            description: 'Complete research projects to unlock detailed consumer persona analysis.',
            icon: '🎯',
            priceImpact: 0,
            featureImpact: 0,
            launchImpact: 0,
            behaviorData: [
              { scenario: 'Base', impact: 100 },
              { scenario: 'Analyze', impact: 100 }
            ]
          }
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}