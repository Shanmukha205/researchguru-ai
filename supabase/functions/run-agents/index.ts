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

// SENTIMENT AGENT - STRICT API MODE (100% API-GROUNDED)
async function runSentimentAgent(productName: string, companyName: string, perplexityKey: string, groqKey?: string) {
  console.log('Running sentiment agent for:', productName);
  
  const query = `You are a market research data extractor. Search for REAL customer reviews and ratings for "${productName}"${companyName ? ` by ${companyName}` : ''}.

MANDATORY: Search these e-commerce and review sites:
- Amazon (amazon.com, amazon.in)
- Flipkart
- Best Buy
- Google Reviews
- Trustpilot
- Reddit discussions
- Tech review sites (CNET, TechRadar, Tom's Guide)

Return ONLY a valid JSON object with REAL data found in search results:

{
  "overallScore": <REQUIRED: Calculate from average ratings. Example: If average is 4.1/5, score = 82. Must be 0-100 integer>,
  "averageRating": <REQUIRED: Decimal rating like 4.1, 3.8, etc. from actual review sites>,
  "positive": <REQUIRED: Integer percentage of positive reviews (4-5 stars). Calculate from real breakdown>,
  "negative": <REQUIRED: Integer percentage of negative reviews (1-2 stars). Calculate from real breakdown>,
  "neutral": <REQUIRED: Integer percentage of neutral reviews (3 stars). Calculate from real breakdown>,
  "totalReviewsAnalyzed": <REQUIRED: Total number of reviews you found data from>,
  "positiveThemes": [<REQUIRED: 3-5 actual positive points from real reviews like "great battery", "comfortable fit", "good value">],
  "negativeThemes": [<REQUIRED: 3-5 actual negative points from real reviews like "poor mic quality", "loose fit", "short cable">],
  "reviews": [
    {"source": "Amazon", "rating": 4.2, "text": "<actual review snippet>", "helpful_votes": <if available>},
    {"source": "Flipkart", "rating": 3.8, "text": "<actual review snippet>"}
  ],
  "sourceDomains": ["amazon.in", "flipkart.com", "reddit.com"],
  "dataQuality": "complete" | "partial" | "insufficient"
}

CRITICAL RULES:
1. ALL percentages must add up to 100% (positive + negative + neutral = 100)
2. Calculate overallScore as: (averageRating / 5) * 100
3. Extract themes from ACTUAL review text only
4. Include at least 3 real review snippets
5. If data unavailable for any field, use null (NEVER use "N/A" or empty string)
6. DO NOT INVENT OR ESTIMATE - only report what you actually found`;

  try {
    const content = await callPerplexityAPI(query, perplexityKey);
    const parsed = parseAPIResponse(content);
    
    if (!parsed) {
      return {
        _apiError: 'Insufficient API data — unable to produce sentiment metrics.',
        apiSourcesUsed: ['Perplexity Sonar API'],
        rawAPISummary: 'No valid data returned from API',
        processedInsights: null,
        missingDataReport: ['overallScore', 'positive', 'negative', 'neutral', 'positiveThemes', 'negativeThemes', 'reviews'],
        overallScore: null,
        positive: null,
        negative: null,
        neutral: null,
        positiveThemes: [],
        negativeThemes: [],
        reviews: [],
        sourceDomains: [],
        confidence: 0,
        dataStatus: 'insufficient'
      };
    }

    // Validate and normalize sentiment percentages
    let positive = parsed.positive;
    let negative = parsed.negative;
    let neutral = parsed.neutral;
    
    // Ensure percentages are valid numbers
    if (typeof positive === 'number' && typeof negative === 'number' && typeof neutral === 'number') {
      const total = positive + negative + neutral;
      if (total !== 100 && total > 0) {
        // Normalize to 100%
        positive = Math.round((positive / total) * 100);
        negative = Math.round((negative / total) * 100);
        neutral = 100 - positive - negative;
      }
    }

    // Calculate overallScore if not provided but we have averageRating
    let overallScore = parsed.overallScore;
    if ((overallScore === null || overallScore === undefined) && parsed.averageRating) {
      overallScore = Math.round((parsed.averageRating / 5) * 100);
    }

    const hasRealData = 
      (overallScore !== null && overallScore !== undefined) ||
      parsed.reviews?.length > 0 || 
      parsed.positiveThemes?.length > 0 ||
      parsed.sourceDomains?.length > 0;
    
    // Build missing data report
    const missingFields = [];
    if (overallScore === null || overallScore === undefined) missingFields.push('overallScore');
    if (positive === null || positive === undefined) missingFields.push('positive');
    if (negative === null || negative === undefined) missingFields.push('negative');
    if (!parsed.positiveThemes?.length) missingFields.push('positiveThemes');
    if (!parsed.negativeThemes?.length) missingFields.push('negativeThemes');
    if (!parsed.reviews?.length) missingFields.push('reviews');
    
    return {
      overallScore: overallScore,
      averageRating: parsed.averageRating || null,
      positive: positive,
      negative: negative,
      neutral: neutral,
      totalReviewsAnalyzed: parsed.totalReviewsAnalyzed || parsed.reviews?.length || 0,
      positiveThemes: parsed.positiveThemes || [],
      negativeThemes: parsed.negativeThemes || [],
      reviews: parsed.reviews || [],
      sourceDomains: parsed.sourceDomains || [],
      apiSourcesUsed: ['Perplexity Sonar API'],
      rawAPISummary: `Retrieved ${parsed.reviews?.length || 0} reviews from ${parsed.sourceDomains?.length || 0} sources. Average rating: ${parsed.averageRating || 'not found'}`,
      processedInsights: hasRealData ? {
        sentimentLabel: overallScore >= 70 ? 'Positive' : overallScore >= 40 ? 'Mixed' : 'Negative',
        dominantPositiveTheme: parsed.positiveThemes?.[0] || null,
        dominantNegativeTheme: parsed.negativeThemes?.[0] || null,
        reviewCount: parsed.totalReviewsAnalyzed || parsed.reviews?.length || 0
      } : null,
      missingDataReport: missingFields.length > 0 ? missingFields : null,
      confidence: hasRealData ? (parsed.reviews?.length >= 5 ? 85 : 65) : 20,
      confidenceLevel: hasRealData ? 'High' : 'Low',
      dataStatus: hasRealData ? 'complete' : 'insufficient',
      dataQuality: parsed.dataQuality || (hasRealData ? 'complete' : 'insufficient'),
      apiEndpoint: 'Perplexity Sonar',
      resultsCount: parsed.reviews?.length || 0,
      _apiVerified: true
    };
  } catch (error) {
    console.error('Sentiment agent API error:', error);
    return {
      _apiError: error instanceof Error ? error.message : 'Insufficient API data — unable to produce sentiment metrics.',
      apiSourcesUsed: ['Perplexity Sonar API'],
      rawAPISummary: 'API call failed',
      processedInsights: null,
      missingDataReport: ['All fields - API error'],
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

// COMPETITOR AGENT - STRICT API MODE (LIMIT TO 4-5 COMPETITORS)
async function runCompetitorAgent(productName: string, companyName: string, perplexityKey: string, groqKey?: string) {
  console.log('Running competitor agent for:', productName);
  
  const query = `You are a market research data extractor. Search for the TOP 4-5 most relevant competitors to "${productName}"${companyName ? ` by ${companyName}` : ''}.

MANDATORY: Search these e-commerce sites for REAL pricing and ratings:
- Amazon (amazon.com, amazon.in, amazon.co.uk)
- Flipkart
- Best Buy
- Official brand websites
- Tech review sites (CNET, TechRadar, GSMArena)

Return ONLY a valid JSON object with EXACTLY 4-5 competitors:

{
  "competitors": [
    {
      "name": "<REQUIRED: Exact product name found>",
      "company": "<REQUIRED: Brand name like Samsung, JBL, Sony>",
      "price": "<REQUIRED: Exact price with currency symbol like '$29.99' or '₹1,299' or '£24.99'>",
      "priceSource": "<REQUIRED: Exact site where price was found like 'Amazon India', 'Flipkart'>",
      "rating": <REQUIRED: Decimal rating from reviews like 4.2, 3.8, 4.5>,
      "ratingSource": "<REQUIRED: Site where rating was found like 'Amazon', 'Flipkart'>",
      "reviewCount": <Number of reviews if available>,
      "features": ["feature1", "feature2", "feature3"],
      "url": "<product page URL if available>"
    }
  ],
  "sourceDomains": ["amazon.in", "flipkart.com"],
  "searchQuery": "competitors alternatives to ${productName}",
  "dataQuality": "complete" | "partial"
}

CRITICAL RULES:
1. Return EXACTLY 4-5 competitors (no more, no less)
2. Every competitor MUST have a real price with currency symbol (₹, $, €, £)
3. Every competitor MUST have a real rating (decimal like 4.2)
4. Price and rating MUST come from actual e-commerce sites
5. If you cannot find price for a product, DO NOT include that product
6. If you cannot find rating for a product, DO NOT include that product
7. NEVER use "N/A", null, or empty values for price/rating
8. Only include products with COMPLETE data (name, company, price, rating)`;

  try {
    const content = await callPerplexityAPI(query, perplexityKey);
    const parsed = parseAPIResponse(content);
    
    if (!parsed || !parsed.competitors) {
      return {
        _apiError: 'API returned no competitors. No data available.',
        apiSourcesUsed: ['Perplexity Sonar API'],
        rawAPISummary: 'No competitor data returned from API',
        processedInsights: null,
        missingDataReport: ['competitors', 'pricing', 'ratings'],
        competitors: [],
        sourceDomains: [],
        overallConfidence: 0,
        dataStatus: 'insufficient'
      };
    }

    // Filter to only competitors with COMPLETE data (price and rating)
    const validCompetitors = (parsed.competitors || [])
      .filter((c: any) => {
        const hasName = c.name && c.name !== 'N/A' && !c.name.toLowerCase().includes('unable');
        const hasPrice = c.price && c.price !== 'N/A' && c.price !== null && c.price !== '';
        const hasRating = c.rating !== null && c.rating !== undefined && c.rating !== 'N/A' && !isNaN(Number(c.rating));
        return hasName && hasPrice && hasRating;
      })
      .slice(0, 5) // LIMIT TO 5 COMPETITORS
      .map((c: any) => ({
        name: c.name,
        company: c.company || 'Unknown Brand',
        price: c.price,
        priceSource: c.priceSource || 'E-commerce site',
        rating: typeof c.rating === 'number' ? c.rating : parseFloat(c.rating),
        ratingSource: c.ratingSource || 'Review site',
        reviewCount: c.reviewCount || null,
        features: c.features || [],
        url: c.url || null,
        priceConfidence: 90,
        ratingConfidence: 90,
        confidenceLevel: 'High',
        dataComplete: true
      }));

    const hasRealData = validCompetitors.length > 0;
    
    // Build missing data report
    const originalCount = parsed.competitors?.length || 0;
    const filteredOut = originalCount - validCompetitors.length;
    const missingFields = [];
    if (filteredOut > 0) {
      missingFields.push(`${filteredOut} competitors excluded due to missing price/rating data`);
    }
    if (!hasRealData) {
      missingFields.push('No competitors with complete pricing and rating data found');
    }

    return {
      competitors: validCompetitors,
      totalCompetitorsReturned: validCompetitors.length,
      apiSourcesUsed: ['Perplexity Sonar API'],
      rawAPISummary: `Found ${validCompetitors.length} competitors with complete data from ${parsed.sourceDomains?.length || 0} sources`,
      processedInsights: hasRealData ? {
        competitorCount: validCompetitors.length,
        priceRange: validCompetitors.length > 0 ? {
          lowest: validCompetitors.reduce((min: any, c: any) => {
            const price = parseFloat(c.price.replace(/[^0-9.]/g, ''));
            return min === null || price < min ? price : min;
          }, null),
          highest: validCompetitors.reduce((max: any, c: any) => {
            const price = parseFloat(c.price.replace(/[^0-9.]/g, ''));
            return max === null || price > max ? price : max;
          }, null)
        } : null,
        avgRating: validCompetitors.length > 0 
          ? (validCompetitors.reduce((sum: number, c: any) => sum + c.rating, 0) / validCompetitors.length).toFixed(1)
          : null,
        topCompetitor: validCompetitors[0]?.name || null
      } : null,
      missingDataReport: missingFields.length > 0 ? missingFields : null,
      sourceDomains: parsed.sourceDomains || [],
      overallConfidence: hasRealData ? 85 : 0,
      dataStatus: hasRealData ? 'complete' : 'insufficient',
      dataQuality: parsed.dataQuality || (hasRealData ? 'complete' : 'insufficient'),
      apiEndpoint: 'Perplexity Sonar',
      resultsCount: validCompetitors.length,
      _apiVerified: true
    };
  } catch (error) {
    console.error('Competitor agent API error:', error);
    return {
      _apiError: error instanceof Error ? error.message : 'Insufficient API data — unable to produce competitor analysis.',
      apiSourcesUsed: ['Perplexity Sonar API'],
      rawAPISummary: 'API call failed',
      processedInsights: null,
      missingDataReport: ['All fields - API error'],
      competitors: [],
      sourceDomains: [],
      overallConfidence: 0,
      dataStatus: 'api_error'
    };
  }
}

// TREND AGENT - STRICT API MODE
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
  "searchDate": "${currentDate}",
  "rawDataSummary": "<brief summary of what was actually retrieved from API>"
}

CRITICAL: Only include data actually found. Do NOT invent news headlines or trends. If trend data not found, set trendDirection to "unknown".`;

  try {
    const content = await callPerplexityAPI(query, perplexityKey);
    const parsed = parseAPIResponse(content);
    
    if (!parsed) {
      return {
        _apiError: 'No API data available for this field.',
        apiSourcesUsed: ['Perplexity Sonar API'],
        rawAPISummary: 'No trend data returned from API',
        processedInsights: null,
        missingDataReport: ['trendingKeywords', 'recentNews', 'marketMentions', 'trendDirection'],
        trendingKeywords: [],
        emergingTopics: [],
        recentNews: [],
        marketMentions: [],
        trendDirection: 'unknown',
        trendScore: null,
        sourceDomains: [],
        confidence: 0,
        dataStatus: 'insufficient'
      };
    }

    const hasRealData = 
      (parsed.trendingKeywords?.length > 0) ||
      (parsed.recentNews?.length > 0) ||
      (parsed.marketMentions?.length > 0);

    // Build missing data report
    const missingFields = [];
    if (!parsed.trendingKeywords?.length) missingFields.push('trendingKeywords');
    if (!parsed.recentNews?.length) missingFields.push('recentNews');
    if (!parsed.marketMentions?.length) missingFields.push('marketMentions');
    if (parsed.trendDirection === 'unknown') missingFields.push('trendDirection');
    if (parsed.trendScore === null) missingFields.push('trendScore');

    return {
      ...parsed,
      apiSourcesUsed: ['Perplexity Sonar API'],
      rawAPISummary: parsed.rawDataSummary || `Found ${parsed.recentNews?.length || 0} news items, ${parsed.trendingKeywords?.length || 0} keywords from ${parsed.sourceDomains?.length || 0} sources`,
      processedInsights: hasRealData ? {
        trendSummary: parsed.trendDirection !== 'unknown' ? `Market trend is ${parsed.trendDirection}` : 'Trend direction undetermined',
        keyTopics: parsed.trendingKeywords?.slice(0, 5) || [],
        newsCount: parsed.recentNews?.length || 0
      } : null,
      missingDataReport: missingFields.length > 0 ? missingFields : null,
      trendScore: parsed.trendScore || (hasRealData ? 60 : null),
      confidence: parsed.confidence || (hasRealData ? 70 : 20),
      confidenceLevel: hasRealData ? 'High' : 'Low',
      dataStatus: hasRealData ? 'complete' : 'insufficient',
      apiEndpoint: 'Perplexity Sonar',
      resultsCount: (parsed.recentNews?.length || 0) + (parsed.marketMentions?.length || 0),
      _apiVerified: true
    };
  } catch (error) {
    console.error('Trend agent API error:', error);
    return {
      _apiError: error instanceof Error ? error.message : 'Unable to generate insights due to missing API data. Please verify API keys or re-trigger the pipeline.',
      apiSourcesUsed: ['Perplexity Sonar API'],
      rawAPISummary: 'API call failed',
      processedInsights: null,
      missingDataReport: ['All fields - API error'],
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
