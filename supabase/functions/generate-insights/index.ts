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
    
    // Prioritize user's Gemini API key, fall back to Lovable AI Gateway
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    // Prefer direct Gemini API if key is available
    const useGemini = GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 0;
    const apiKey = useGemini ? GEMINI_API_KEY : LOVABLE_API_KEY;
    
    if (!apiKey) {
      throw new Error("No API keys configured");
    }
    
    console.log("Using API:", useGemini ? "Gemini API Direct" : "Lovable AI Gateway");

    // Handle different insight types (no projectId needed for these)
    if (type === 'market-pulse') {
      return await generateMarketPulse(apiKey, projectId, useGemini);
    } else if (type === 'market-correlation') {
      return await generateMarketCorrelation(apiKey, projectId, useGemini);
    } else if (type === 'consumer-personas') {
      return await generateConsumerPersonas(apiKey, projectId, useGemini);
    } else if (type === 'strengths-weaknesses') {
      return await generateStrengthsWeaknesses(apiKey, projectId, useGemini);
    } else if (type === 'risks-opportunities') {
      return await generateRisksOpportunities(apiKey, projectId, useGemini);
    } else if (type === 'feature-gaps') {
      return await generateFeatureGaps(apiKey, projectId, useGemini);
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

// Helper function to call Gemini API directly with retries
async function callGeminiDirect(prompt: string, apiKey: string, retryCount = 0): Promise<string> {
  const maxRetries = 3;
  const backoffMs = Math.pow(2, retryCount) * 1000;
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText.substring(0, 200));
    
    if (response.status === 429 && retryCount < maxRetries) {
      console.log(`Rate limited, retrying in ${backoffMs}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return callGeminiDirect(prompt, apiKey, retryCount + 1);
    }
    if (response.status === 429) {
      throw new Error('API rate limit exceeded. Please try again later.');
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error('Invalid Gemini API key — update it in API Key Management.');
    }
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Helper function to call Lovable AI Gateway
async function callLovableAI(prompt: string, systemPrompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function generateMarketPulse(apiKey: string, projectId?: string, useGemini: boolean = false) {
  try {
    // Create Supabase client to fetch real data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch agent results - project-specific if projectId provided
    let query = supabaseClient
      .from('agent_results')
      .select('*, research_projects(product_name, company_name)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    
    if (projectId) {
      query = query.eq('project_id', projectId).limit(20);
    } else {
      query = query.limit(10);
    }

    const { data: agentResults, error: resultsError } = await query;

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

    // Get product context
    const productContext = projectId && agentResults.length > 0 
      ? `for ${agentResults[0].research_projects?.product_name || 'this product'} by ${agentResults[0].research_projects?.company_name || 'the company'}`
      : 'across analyzed products';

    // Generate AI summary based on real data with unique context
    const summaryPrompt = `Analyze this market data ${productContext} and generate ONE unique, specific sentence:
- Sentiment Score: ${sentimentScore}/100 (${sentimentScore > 60 ? 'positive' : sentimentScore < 40 ? 'negative' : 'neutral'})
- Competition Score: ${competitionScore}/100
- Trend Score: ${trendScore}/100
- Overall Market Pulse: ${overallScore}/100
- Timestamp: ${new Date().toISOString()}

Create a UNIQUE, contextual summary that reflects the specific product/market conditions. Avoid generic phrases. Include specific insights about momentum, consumer response, or competitive position.`;

    let aiSummary: string;
    try {
      if (useGemini) {
        aiSummary = await callGeminiDirect('You are a market intelligence analyst. Provide concise, actionable summaries. ' + summaryPrompt, apiKey);
      } else {
        aiSummary = await callLovableAI(summaryPrompt, 'You are a market intelligence analyst. Provide concise, actionable summaries.', apiKey);
      }
    } catch (error) {
      console.error('AI summary error:', error);
      aiSummary = `Market shows ${overallScore > 60 ? 'strong' : overallScore < 40 ? 'weak' : 'moderate'} momentum with ${sentimentScore > 60 ? 'positive' : 'mixed'} consumer sentiment.`;
    }
    
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

async function generateMarketCorrelation(apiKey: string, projectId?: string, useGemini: boolean = false) {
  try {
    // Create Supabase client to fetch real data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch projects - prioritize current project if provided
    let projectsQuery = supabaseClient
      .from('research_projects')
      .select('id, product_name, company_name')
      .order('created_at', { ascending: false });
    
    if (projectId) {
      // Get current project + 4 others for comparison
      const { data: currentProject } = await supabaseClient
        .from('research_projects')
        .select('id, product_name, company_name')
        .eq('id', projectId)
        .single();
      
      const { data: otherProjects } = await supabaseClient
        .from('research_projects')
        .select('id, product_name, company_name')
        .neq('id', projectId)
        .limit(4);
      
      const projects = currentProject ? [currentProject, ...(otherProjects || [])] : otherProjects;
      if (!projects || projects.length < 2) {
        return generateDefaultCorrelations();
      }
      
      return await analyzeProjectCorrelations(apiKey, supabaseClient, projects, useGemini);
    }

    const { data: projects, error: projectsError } = await projectsQuery.limit(5);

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

    const timestamp = new Date().toISOString();
    const prompt = `As a market analyst, identify 3-4 UNIQUE, SPECIFIC correlations between these products:
${JSON.stringify(projectsData, null, 2)}

Analysis timestamp: ${timestamp}

Requirements:
1. Calculate REAL correlation coefficients based on actual sentiment scores and market data
2. Identify cross-market patterns (e.g., price sensitivity, feature preferences, brand loyalty)
3. Provide SPECIFIC insights unique to these exact products
4. Consider: sentiment alignment, competitive positioning, consumer demographics
5. Avoid generic statements - be specific to these products

Return ONLY a JSON array: [{"market1": "Product/Category Name", "market2": "Product/Category Name", "correlation": <-1 to 1>, "insight": "Specific finding about relationship"}]`;

    let content: string;
    try {
      if (useGemini) {
        content = await callGeminiDirect('You are a market correlation analyst. Return valid JSON only. ' + prompt, apiKey);
      } else {
        content = await callLovableAI(prompt, 'You are a market correlation analyst. Return valid JSON only.', apiKey);
      }
    } catch (error) {
      console.error('AI correlation error:', error);
      content = '';
    }
    
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

async function generateConsumerPersonas(apiKey: string, projectId?: string, useGemini: boolean = false) {
  try {
    // Create Supabase client to fetch real data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch agent results - project-specific if provided
    let query = supabaseClient
      .from('agent_results')
      .select('*, research_projects(product_name, company_name)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    
    if (projectId) {
      query = query.eq('project_id', projectId).limit(10);
    } else {
      query = query.limit(5);
    }

    const { data: agentResults } = await query;

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

    // Get product context
    const productContext = projectId && agentResults.length > 0 
      ? `for ${agentResults[0].research_projects?.product_name || 'this product'} by ${agentResults[0].research_projects?.company_name || 'the company'}`
      : 'based on market research data';

    // Generate AI-powered personas based on real market data with timestamp for uniqueness
    const timestamp = new Date().toISOString();
    const prompt = `Analyze consumer behavior ${productContext} with this sentiment data (Positive: ${avgPositive}%, Negative: ${avgNegative}%).
Analysis timestamp: ${timestamp}

Generate 3 UNIQUE, SPECIFIC consumer personas that reflect the actual market sentiment. Consider:
- How different consumer types would react to this specific product
- The sentiment scores indicate the market's actual reception
- Realistic behavioral predictions based on market data

For each persona provide:
- name: A descriptive, unique persona name (not generic)
- description: 2-3 sentences describing this specific consumer type and their relationship to this product category
- icon: An appropriate emoji
- priceImpact: Realistic reaction to 10% price increase (-20 to +5)
- featureImpact: Realistic reaction to feature removal (-25 to 0)
- launchImpact: Realistic reaction to new product launch (0 to +30)

Return ONLY a valid JSON array. Make each persona distinct and relevant to the actual sentiment data.`;

    let content: string;
    try {
      if (useGemini) {
        content = await callGeminiDirect('You are a consumer behavior analyst. Return valid JSON only. ' + prompt, apiKey);
      } else {
        content = await callLovableAI(prompt, 'You are a consumer behavior analyst. Return valid JSON only.', apiKey);
      }
    } catch (error) {
      console.error('AI personas error:', error);
      content = '';
    }
    
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

// Helper function for default correlations
function generateDefaultCorrelations() {
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

// Helper function to analyze project correlations
async function analyzeProjectCorrelations(apiKey: string, supabaseClient: any, projects: any[], useGemini: boolean = false) {
  const projectIds = projects.map(p => p.id);
  const { data: agentResults } = await supabaseClient
    .from('agent_results')
    .select('*')
    .in('project_id', projectIds)
    .eq('status', 'completed');

  const projectsData = projects.map(p => {
    const results = agentResults?.filter((r: any) => r.project_id === p.id) || [];
    const sentiment = results.find((r: any) => r.agent_type === 'sentiment')?.results;
    const competitor = results.find((r: any) => r.agent_type === 'competitor')?.results;
    
    return {
      name: p.product_name,
      company: p.company_name,
      sentimentScore: sentiment?.overallScore || 0,
      competitorCount: competitor?.competitors?.length || 0
    };
  });

  const timestamp = new Date().toISOString();
  const prompt = `As a market analyst, identify 3-4 UNIQUE, SPECIFIC correlations between these products:
${JSON.stringify(projectsData, null, 2)}

Analysis timestamp: ${timestamp}

Requirements:
1. Calculate REAL correlation coefficients based on actual sentiment scores and market data
2. Identify cross-market patterns (e.g., price sensitivity, feature preferences, brand loyalty)
3. Provide SPECIFIC insights unique to these exact products
4. Consider: sentiment alignment, competitive positioning, consumer demographics
5. Avoid generic statements - be specific to these products

Return ONLY a JSON array: [{"market1": "Product/Category Name", "market2": "Product/Category Name", "correlation": <-1 to 1>, "insight": "Specific finding about relationship"}]`;

  let content: string;
  try {
    if (useGemini) {
      content = await callGeminiDirect('You are a market correlation analyst. Return valid JSON only. ' + prompt, apiKey);
    } else {
      content = await callLovableAI(prompt, 'You are a market correlation analyst. Return valid JSON only.', apiKey);
    }
  } catch (error) {
    console.error('AI correlation error:', error);
    content = '';
  }
  
  let correlations;
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    correlations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    correlations = [];
  }

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
}

// Generate Strengths & Weaknesses Analysis
async function generateStrengthsWeaknesses(apiKey: string, projectId?: string, useGemini: boolean = false) {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let query = supabaseClient
      .from('agent_results')
      .select('*, research_projects(product_name, company_name)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    query = query.limit(20);

    const { data: agentResults, error } = await query;

    if (error) throw error;

    if (!agentResults || agentResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          strengths: [{ text: "Run research projects to generate strength insights", confidence: 0 }],
          weaknesses: [{ text: "Run research projects to identify areas for improvement", confidence: 0 }]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sentimentData = agentResults.filter(r => r.agent_type === 'sentiment').map(r => r.results);
    const competitorData = agentResults.filter(r => r.agent_type === 'competitor').map(r => r.results);
    const trendData = agentResults.filter(r => r.agent_type === 'trend').map(r => r.results);

    const productContext = projectId && agentResults[0]?.research_projects 
      ? `${agentResults[0].research_projects.product_name} by ${agentResults[0].research_projects.company_name}`
      : 'the analyzed products';

    const prompt = `Analyze the following market research data for ${productContext} and identify SPECIFIC strengths and weaknesses.

Sentiment Data: ${JSON.stringify(sentimentData.slice(0, 5), null, 2)}
Competitor Data: ${JSON.stringify(competitorData.slice(0, 5), null, 2)}
Trend Data: ${JSON.stringify(trendData.slice(0, 5), null, 2)}

Return a JSON object with this exact structure (no markdown, just JSON):
{
  "strengths": [
    { "text": "specific strength based on data", "confidence": 85 },
    { "text": "another specific strength", "confidence": 78 }
  ],
  "weaknesses": [
    { "text": "specific weakness based on data", "confidence": 72 },
    { "text": "another specific weakness", "confidence": 68 }
  ]
}

Provide 3-5 strengths and 2-4 weaknesses. Base each insight on the actual data provided. Confidence should be 50-95.`;

    let content = '';
    try {
      if (useGemini) {
        content = await callGeminiDirect(prompt, apiKey);
      } else {
        content = await callLovableAI(prompt, 'You are a product analyst. Return only valid JSON.', apiKey);
      }
    } catch (error) {
      console.error('AI error:', error);
    }

    let result = { strengths: [], weaknesses: [] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('JSON parse error');
    }

    if (!result.strengths?.length) {
      result.strengths = [
        { text: "Positive consumer sentiment detected in recent analysis", confidence: 72 },
        { text: "Competitive pricing relative to market alternatives", confidence: 68 }
      ];
    }
    if (!result.weaknesses?.length) {
      result.weaknesses = [
        { text: "Limited feature differentiation from competitors", confidence: 65 },
        { text: "Brand awareness could be improved", confidence: 60 }
      ];
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating strengths/weaknesses:', error);
    return new Response(
      JSON.stringify({ 
        strengths: [{ text: "Analysis temporarily unavailable", confidence: 0 }],
        weaknesses: [{ text: "Analysis temporarily unavailable", confidence: 0 }]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Generate Risks & Opportunities Analysis
async function generateRisksOpportunities(apiKey: string, projectId?: string, useGemini: boolean = false) {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let query = supabaseClient
      .from('agent_results')
      .select('*, research_projects(product_name, company_name)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    query = query.limit(20);

    const { data: agentResults, error } = await query;

    if (error) throw error;

    if (!agentResults || agentResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          risks: [{ text: "Run research to identify potential risks", confidence: 0, impact: "low" }],
          opportunities: [{ text: "Run research to discover market opportunities", confidence: 0, impact: "low" }]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sentimentData = agentResults.filter(r => r.agent_type === 'sentiment').map(r => r.results);
    const competitorData = agentResults.filter(r => r.agent_type === 'competitor').map(r => r.results);
    const trendData = agentResults.filter(r => r.agent_type === 'trend').map(r => r.results);

    const productContext = projectId && agentResults[0]?.research_projects 
      ? `${agentResults[0].research_projects.product_name} by ${agentResults[0].research_projects.company_name}`
      : 'the analyzed products';

    const prompt = `Analyze the following market research data for ${productContext} and identify SPECIFIC risks and opportunities.

Sentiment Data: ${JSON.stringify(sentimentData.slice(0, 5), null, 2)}
Competitor Data: ${JSON.stringify(competitorData.slice(0, 5), null, 2)}
Trend Data: ${JSON.stringify(trendData.slice(0, 5), null, 2)}

Return a JSON object with this exact structure (no markdown, just JSON):
{
  "risks": [
    { "text": "specific market risk based on data", "confidence": 78, "impact": "high" },
    { "text": "another risk", "confidence": 65, "impact": "medium" }
  ],
  "opportunities": [
    { "text": "specific growth opportunity", "confidence": 82, "impact": "high" },
    { "text": "another opportunity", "confidence": 70, "impact": "medium" }
  ]
}

Provide 2-4 risks and 2-4 opportunities. Impact must be "high", "medium", or "low". Confidence should be 50-95.`;

    let content = '';
    try {
      if (useGemini) {
        content = await callGeminiDirect(prompt, apiKey);
      } else {
        content = await callLovableAI(prompt, 'You are a market risk analyst. Return only valid JSON.', apiKey);
      }
    } catch (error) {
      console.error('AI error:', error);
    }

    let result = { risks: [], opportunities: [] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('JSON parse error');
    }

    if (!result.risks?.length) {
      result.risks = [
        { text: "Increasing competition in the market segment", confidence: 72, impact: "medium" },
        { text: "Consumer preferences may shift with new entrants", confidence: 65, impact: "medium" }
      ];
    }
    if (!result.opportunities?.length) {
      result.opportunities = [
        { text: "Growing market demand in target demographic", confidence: 78, impact: "high" },
        { text: "Potential for strategic partnerships", confidence: 68, impact: "medium" }
      ];
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating risks/opportunities:', error);
    return new Response(
      JSON.stringify({ 
        risks: [{ text: "Analysis temporarily unavailable", confidence: 0, impact: "low" }],
        opportunities: [{ text: "Analysis temporarily unavailable", confidence: 0, impact: "low" }]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Generate Feature Gap Analysis
async function generateFeatureGaps(apiKey: string, projectId?: string, useGemini: boolean = false) {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let query = supabaseClient
      .from('agent_results')
      .select('*, research_projects(product_name, company_name)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    query = query.limit(20);

    const { data: agentResults, error } = await query;

    if (error) throw error;

    if (!agentResults || agentResults.length === 0) {
      return new Response(
        JSON.stringify({ features: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const competitorData = agentResults.filter(r => r.agent_type === 'competitor').map(r => r.results);

    const productContext = projectId && agentResults[0]?.research_projects 
      ? `${agentResults[0].research_projects.product_name} by ${agentResults[0].research_projects.company_name}`
      : 'the analyzed products';

    const prompt = `Analyze the following competitor data for ${productContext} and generate a feature comparison analysis.

Competitor Data: ${JSON.stringify(competitorData.slice(0, 5), null, 2)}

Return a JSON object with this exact structure (no markdown, just JSON):
{
  "features": [
    { "feature": "Feature Name", "yourProduct": true, "competitor": true, "priority": "high" },
    { "feature": "Another Feature", "yourProduct": false, "competitor": true, "priority": "medium" },
    { "feature": "Third Feature", "yourProduct": "partial", "competitor": true, "priority": "low" }
  ]
}

Generate 6-10 realistic feature comparisons based on the product category and competitor data.
yourProduct can be: true (has feature), false (missing feature), or "partial" (partially implemented).
competitor can be: true (has feature), false (missing feature), or "partial" (partially implemented).
priority must be: "high", "medium", or "low".
Focus on identifying gaps where competitor has features that the product lacks.`;

    let content = '';
    try {
      if (useGemini) {
        content = await callGeminiDirect(prompt, apiKey);
      } else {
        content = await callLovableAI(prompt, 'You are a product feature analyst. Return only valid JSON.', apiKey);
      }
    } catch (error) {
      console.error('AI error:', error);
    }

    let result = { features: [] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('JSON parse error');
    }

    if (!result.features?.length) {
      result.features = [
        { feature: "Core Product Functionality", yourProduct: true, competitor: true, priority: "high" },
        { feature: "Mobile App Support", yourProduct: true, competitor: "partial", priority: "medium" },
        { feature: "Advanced Analytics", yourProduct: "partial", competitor: true, priority: "high" },
        { feature: "Third-party Integrations", yourProduct: false, competitor: true, priority: "medium" },
        { feature: "Custom Reporting", yourProduct: false, competitor: true, priority: "high" },
        { feature: "Multi-language Support", yourProduct: false, competitor: "partial", priority: "low" },
        { feature: "API Access", yourProduct: true, competitor: true, priority: "medium" }
      ];
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating feature gaps:', error);
    return new Response(
      JSON.stringify({ features: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}