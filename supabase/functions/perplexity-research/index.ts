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
    const { productName, companyName, description, mode } = await req.json();

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Perplexity API key not configured" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isQuickMode = mode === 'quick';
    
    const systemPrompt = isQuickMode
      ? `You are a market research assistant. Provide BRIEF, CONCISE summaries. Keep responses short with bullet points. Focus on key facts only. Maximum 3-4 sentences per section.`
      : `You are an expert market research analyst. Provide COMPREHENSIVE, DETAILED analysis with full explanations, data points, market context, competitive landscape details, and thorough insights. Include specific numbers, percentages, and concrete examples where possible.`;

    const userPrompt = `Analyze the product/company: "${productName}"${companyName ? ` by ${companyName}` : ''}${description ? `. Additional context: ${description}` : ''}.

Provide a structured analysis with these sections:
1. MARKET OVERVIEW: ${isQuickMode ? 'Brief market position' : 'Detailed market analysis, size, growth trajectory, and positioning'}
2. SENTIMENT ANALYSIS: ${isQuickMode ? 'Quick sentiment summary' : 'Comprehensive sentiment breakdown with sources and evidence'}
3. COMPETITIVE LANDSCAPE: ${isQuickMode ? 'Top 3 competitors with prices' : 'Full competitive analysis with pricing, features, market share'}
4. TRENDS: ${isQuickMode ? 'Key trend highlights' : 'Detailed trend analysis with predictions and market shifts'}
5. KEY INSIGHTS: ${isQuickMode ? '3 main takeaways' : 'Comprehensive insights with actionable recommendations'}
6. LIMITATIONS: List any data gaps, uncertainties, or areas where information was limited
7. SUGGESTIONS: Recommend what additional research or data would improve this analysis

Format the response as JSON with this structure:
{
  "marketOverview": "...",
  "sentimentSummary": { "overall": "positive/neutral/negative", "confidence": 0-100, "details": "..." },
  "competitors": [{ "name": "...", "price": "...", "rating": "...", "keyDifference": "..." }],
  "trends": ["..."],
  "keyInsights": ["..."],
  "limitations": ["..."],
  "suggestions": ["..."],
  "sources": ["..."]
}`;

    console.log(`Running ${mode} mode Perplexity research for: ${productName}`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: isQuickMode ? 1500 : 4000,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Perplexity API error: ${response.status}`,
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from Perplexity" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to parse JSON from the response
    let parsedResult;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content;
      parsedResult = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, structure the raw text
      parsedResult = {
        marketOverview: content,
        sentimentSummary: { overall: "unknown", confidence: 50, details: "Could not parse structured data" },
        competitors: [],
        trends: [],
        keyInsights: [content.substring(0, 500)],
        limitations: ["Response was not in expected format"],
        suggestions: ["Try running the analysis again"],
        sources: []
      };
    }

    console.log(`Perplexity research completed for: ${productName}`);

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        data: parsedResult,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Perplexity research error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Please check your API key configuration and try again'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
