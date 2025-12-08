// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// STRICT API-ONLY MODE - NO HALLUCINATION ALLOWED
const ZERO_HALLUCINATION_POLICY = true;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, companyName, description, projectId, userGeminiKey } = await req.json();
    
    console.log('Starting agents for:', { productName, companyName, projectId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // API Keys - REQUIRED for real data
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || userGeminiKey;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Validate API keys
    if (!PERPLEXITY_API_KEY) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'PERPLEXITY_API_KEY not configured. Cannot fetch real data.',
        diagnostics: { timestamp: new Date().toISOString(), errorCode: 'MISSING_API_KEY' }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('API Keys Status:', {
      perplexity: !!PERPLEXITY_API_KEY,
      groq: !!GROQ_API_KEY,
      gemini: !!GEMINI_API_KEY,
      lovable: !!LOVABLE_API_KEY
    });

    // Run all agents in parallel - ALL USING REAL API DATA
    const [sentimentResult, competitorResult, trendResult] = await Promise.allSettled([
      runSentimentAgent(productName, companyName, PERPLEXITY_API_KEY, GROQ_API_KEY),
      runCompetitorAgent(productName, companyName, PERPLEXITY_API_KEY, GROQ_API_KEY),
      runTrendAgent(productName, companyName, PERPLEXITY_API_KEY, GROQ_API_KEY),
    ]);

    // Store results in database
    const results = [];

    if (sentimentResult.status === 'fulfilled' && !sentimentResult.value._apiError) {
      const { error } = await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'sentiment',
        status: 'completed',
        results: sentimentResult.value,
      });
      if (!error) results.push({ type: 'sentiment', data: sentimentResult.value });
    } else {
      const errorMsg = sentimentResult.status === 'rejected' 
        ? getErrorMessage(sentimentResult.reason)
        : sentimentResult.value._apiError || 'API data unavailable';
      console.error('Sentiment agent failed:', errorMsg);
      await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'sentiment',
        status: 'failed',
        error_message: errorMsg,
      });
    }

    if (competitorResult.status === 'fulfilled' && !competitorResult.value._apiError) {
      const { error } = await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'competitor',
        status: 'completed',
        results: competitorResult.value,
      });
      if (!error) results.push({ type: 'competitor', data: competitorResult.value });
    } else {
      const errorMsg = competitorResult.status === 'rejected' 
        ? getErrorMessage(competitorResult.reason)
        : competitorResult.value._apiError || 'API data unavailable';
      console.error('Competitor agent failed:', errorMsg);
      await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'competitor',
        status: 'failed',
        error_message: errorMsg,
      });
    }

    if (trendResult.status === 'fulfilled' && !trendResult.value._apiError) {
      const { error } = await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'trend',
        status: 'completed',
        results: trendResult.value,
      });
      if (!error) results.push({ type: 'trend', data: trendResult.value });
    } else {
      const errorMsg = trendResult.status === 'rejected' 
        ? getErrorMessage(trendResult.reason)
        : trendResult.value._apiError || 'API data unavailable';
      console.error('Trend agent failed:', errorMsg);
      await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'trend',
        status: 'failed',
        error_message: errorMsg,
      });
    }

    // Generate summary only from API-verified data
    const summary = results.length > 0 
      ? generateDataDrivenSummary(productName, companyName, results)
      : 'Insufficient API data available. Please check API limits or provide more details.';

    return new Response(JSON.stringify({ 
      success: results.length > 0, 
      results,
      summary,
      apiSourcesUsed: {
        perplexity: true,
        groq: !!GROQ_API_KEY,
        dataPoints: results.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in run-agents:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getErrorMessage(error) {
  const message = error?.message || 'Unknown error';
  if (message.includes('429') || message.includes('quota') || message.includes('rate limit')) {
    return 'API rate limit exceeded. Please try again later.';
  }
  if (message.includes('401') || message.includes('403') || message.includes('invalid')) {
    return 'Invalid API Key. Please update your API keys in settings.';
  }
  return message;
}

// Call Perplexity API for REAL data
async function callPerplexityAPI(query: string, apiKey: string): Promise<any> {
  console.log('Calling Perplexity API for:', query.substring(0, 50));
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a market research API. Return ONLY factual data from your web search. If data is not found, return null for that field. Do NOT make up or estimate any values. All data must come from actual search results. Return valid JSON only.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: 4000,
      return_images: false,
      return_related_questions: false,
      search_recency_filter: 'month',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Perplexity API error:', response.status, errorText);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  
  console.log('Perplexity response received, length:', content?.length || 0);
  return content;
}

// Parse JSON from API response
function parseAPIResponse(content: string): any {
  if (!content) return null;
  
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content;
    return JSON.parse(jsonStr);
  } catch {
    // Try to find JSON object directly
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// SENTIMENT AGENT - API DATA ONLY
async function runSentimentAgent(productName: string, companyName: string, perplexityKey: string, groqKey?: string) {
  console.log('Running sentiment agent for:', productName);
  
  const query = `Search for customer reviews and sentiment for "${productName}" ${companyName ? `by ${companyName}` : ''}.

Return a JSON object with ONLY data found in your search results:
{
  "overallScore": <number 0-100 from review averages, or null if not found>,
  "positive": <percentage of positive reviews found, or null>,
  "negative": <percentage of negative reviews found, or null>,
  "neutral": <percentage of neutral reviews found, or null>,
  "positiveThemes": [<actual positive themes mentioned in reviews>],
  "negativeThemes": [<actual negative themes mentioned in reviews>],
  "reviews": [
    {"source": "<website>", "rating": <1-5>, "text": "<actual review snippet>", "date": "<date if available>"}
  ],
  "sourceDomains": [<list of domains where reviews were found>],
  "totalReviewsFound": <number of reviews found>,
  "confidence": <0-100 based on amount of data found>,
  "dataStatus": "complete" | "partial" | "insufficient"
}

CRITICAL: Only include data actually found. Use null for missing fields. Do NOT fabricate reviews or scores.`;

  try {
    const content = await callPerplexityAPI(query, perplexityKey);
    const parsed = parseAPIResponse(content);
    
    if (!parsed) {
      return {
        _apiError: 'No valid data returned from API',
        overallScore: null,
        positive: null,
        negative: null,
        neutral: null,
        positiveThemes: [],
        negativeThemes: [],
        reviews: [],
        sourceDomains: [],
        confidence: 0,
        dataStatus: 'insufficient',
        _rawResponse: content?.substring(0, 500)
      };
    }

    // Validate that we have real data
    const hasRealData = parsed.reviews?.length > 0 || parsed.sourceDomains?.length > 0 || parsed.overallScore !== null;
    
    return {
      ...parsed,
      confidence: parsed.confidence || (hasRealData ? 70 : 20),
      confidenceLevel: hasRealData ? 'High' : 'Low',
      dataStatus: hasRealData ? (parsed.dataStatus || 'complete') : 'insufficient',
      apiEndpoint: 'Perplexity Sonar',
      resultsCount: parsed.reviews?.length || 0,
      _apiVerified: true
    };
  } catch (error) {
    console.error('Sentiment agent API error:', error);
    return {
      _apiError: error instanceof Error ? error.message : 'API call failed',
      overallScore: null,
      positive: null,
      negative: null,
      neutral: null,
      positiveThemes: [],
      negativeThemes: [],
      reviews: [],
      sourceDomains: [],
      confidence: 0,
      dataStatus: 'api_error'
    };
  }
}

// COMPETITOR AGENT - API DATA ONLY  
async function runCompetitorAgent(productName: string, companyName: string, perplexityKey: string, groqKey?: string) {
  console.log('Running competitor agent for:', productName);
  
  const query = `Search for competitors and alternatives to "${productName}" ${companyName ? `by ${companyName}` : ''}.

Return a JSON object with ONLY data found in your search results:
{
  "competitors": [
    {
      "name": "<actual competitor product name>",
      "company": "<actual company name>",
      "price": "<actual price found, or null if not found>",
      "priceSource": "<domain where price was found>",
      "rating": <rating out of 5 if found, or null>,
      "ratingSource": "<domain where rating was found>",
      "features": [<actual features mentioned>],
      "advantages": [<advantages mentioned in comparisons>],
      "disadvantages": [<disadvantages mentioned>]
    }
  ],
  "sourceDomains": [<list of domains searched>],
  "totalCompetitorsFound": <number>,
  "confidence": <0-100 based on data completeness>,
  "dataStatus": "complete" | "partial" | "insufficient"
}

CRITICAL: Only include REAL competitors found in search results. Do NOT invent products, prices, or ratings. If price not found, set price to null.`;

  try {
    const content = await callPerplexityAPI(query, perplexityKey);
    const parsed = parseAPIResponse(content);
    
    if (!parsed || !parsed.competitors) {
      return {
        _apiError: 'No competitor data returned from API',
        competitors: [],
        sourceDomains: [],
        overallConfidence: 0,
        dataStatus: 'insufficient',
        _rawResponse: content?.substring(0, 500)
      };
    }

    // Validate competitors have real data
    const validCompetitors = (parsed.competitors || []).filter((c: any) => 
      c.name && c.name !== 'N/A' && !c.name.includes('Unable')
    );

    const hasRealData = validCompetitors.length > 0;

    return {
      competitors: validCompetitors.map((c: any) => ({
        ...c,
        priceConfidence: c.price && c.price !== 'null' && c.priceSource ? 80 : 20,
        confidenceLevel: c.priceSource && c.ratingSource ? 'High' : c.priceSource || c.ratingSource ? 'Medium' : 'Low',
        sourceEvidence: c.priceSource || c.ratingSource || 'No source available'
      })),
      sourceDomains: parsed.sourceDomains || [],
      overallConfidence: hasRealData ? (parsed.confidence || 70) : 0,
      dataStatus: hasRealData ? (parsed.dataStatus || 'complete') : 'insufficient',
      apiEndpoint: 'Perplexity Sonar',
      resultsCount: validCompetitors.length,
      _apiVerified: true
    };
  } catch (error) {
    console.error('Competitor agent API error:', error);
    return {
      _apiError: error instanceof Error ? error.message : 'API call failed',
      competitors: [],
      sourceDomains: [],
      overallConfidence: 0,
      dataStatus: 'api_error'
    };
  }
}

// TREND AGENT - API DATA ONLY
async function runTrendAgent(productName: string, companyName: string, perplexityKey: string, groqKey?: string) {
  console.log('Running trend agent for:', productName);
  
  const currentDate = new Date().toISOString().split('T')[0];
  
  const query = `Search for market trends, news, and popularity data for "${productName}" ${companyName ? `by ${companyName}` : ''}.

Return a JSON object with ONLY data found in your search results:
{
  "trendingKeywords": [<keywords associated with this product in recent searches/articles>],
  "emergingTopics": [
    {"topic": "<topic>", "source": "<where it was mentioned>", "sentiment": "positive"|"negative"|"neutral"}
  ],
  "recentNews": [
    {"headline": "<actual headline>", "source": "<domain>", "date": "<date>", "summary": "<brief summary>"}
  ],
  "marketMentions": [
    {"mention": "<what was said>", "source": "<domain>", "context": "<context>"}
  ],
  "trendDirection": "rising" | "stable" | "declining" | "unknown",
  "trendScore": <0-100 based on search volume and mentions, or null>,
  "sourceDomains": [<domains searched>],
  "confidence": <0-100>,
  "dataStatus": "complete" | "partial" | "insufficient",
  "searchDate": "${currentDate}"
}

CRITICAL: Only include data actually found. Do NOT invent news headlines or trends. If trend data not found, set trendDirection to "unknown".`;

  try {
    const content = await callPerplexityAPI(query, perplexityKey);
    const parsed = parseAPIResponse(content);
    
    if (!parsed) {
      return {
        _apiError: 'No trend data returned from API',
        trendingKeywords: [],
        emergingTopics: [],
        recentNews: [],
        marketMentions: [],
        trendDirection: 'unknown',
        trendScore: null,
        sourceDomains: [],
        confidence: 0,
        dataStatus: 'insufficient',
        _rawResponse: content?.substring(0, 500)
      };
    }

    const hasRealData = 
      (parsed.trendingKeywords?.length > 0) ||
      (parsed.recentNews?.length > 0) ||
      (parsed.marketMentions?.length > 0);

    return {
      ...parsed,
      trendScore: parsed.trendScore || (hasRealData ? 60 : null),
      confidence: parsed.confidence || (hasRealData ? 70 : 20),
      confidenceLevel: hasRealData ? 'High' : 'Low',
      dataStatus: hasRealData ? (parsed.dataStatus || 'complete') : 'insufficient',
      apiEndpoint: 'Perplexity Sonar',
      resultsCount: (parsed.recentNews?.length || 0) + (parsed.marketMentions?.length || 0),
      _apiVerified: true
    };
  } catch (error) {
    console.error('Trend agent API error:', error);
    return {
      _apiError: error instanceof Error ? error.message : 'API call failed',
      trendingKeywords: [],
      emergingTopics: [],
      recentNews: [],
      marketMentions: [],
      trendDirection: 'unknown',
      trendScore: null,
      sourceDomains: [],
      confidence: 0,
      dataStatus: 'api_error'
    };
  }
}

// Generate summary from API-verified data only
function generateDataDrivenSummary(productName: string, companyName: string, results: any[]): string {
  const parts = [];
  
  const sentiment = results.find(r => r.type === 'sentiment')?.data;
  const competitor = results.find(r => r.type === 'competitor')?.data;
  const trend = results.find(r => r.type === 'trend')?.data;

  if (sentiment?.overallScore !== null && sentiment?.overallScore !== undefined) {
    const sentimentLabel = sentiment.overallScore >= 70 ? 'positive' : sentiment.overallScore >= 40 ? 'mixed' : 'negative';
    parts.push(`Sentiment: ${sentimentLabel} (${sentiment.overallScore}/100 from ${sentiment.reviews?.length || 0} reviews)`);
  }

  if (competitor?.competitors?.length > 0) {
    parts.push(`Competitors: ${competitor.competitors.length} found`);
  }

  if (trend?.trendDirection && trend.trendDirection !== 'unknown') {
    parts.push(`Trend: ${trend.trendDirection}`);
  }

  if (parts.length === 0) {
    return `Insufficient API data for ${productName}. Limited data was returned from search APIs.`;
  }

  return `${productName}${companyName ? ` by ${companyName}` : ''}: ${parts.join(' | ')} (API-verified data)`;
}
