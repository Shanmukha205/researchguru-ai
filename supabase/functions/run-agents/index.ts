// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lovable AI Gateway configuration
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

    // Determine which API to use
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') || null;
    const useUserKey = userGeminiKey && userGeminiKey.trim().length > 0;
    
    console.log('Using API:', useUserKey ? 'User Gemini Key' : 'Lovable AI Gateway');

    // Run all agents in parallel
    const [sentimentResult, competitorResult, trendResult] = await Promise.allSettled([
      runSentimentAgent(productName, companyName, useUserKey ? userGeminiKey : null, LOVABLE_API_KEY),
      runCompetitorAgent(productName, companyName, useUserKey ? userGeminiKey : null, LOVABLE_API_KEY),
      runTrendAgent(productName, companyName, useUserKey ? userGeminiKey : null, LOVABLE_API_KEY),
    ]);

    // Store results in database
    const results = [];

    if (sentimentResult.status === 'fulfilled') {
      const { error } = await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'sentiment',
        status: 'completed',
        results: sentimentResult.value,
      });
      if (!error) results.push({ type: 'sentiment', data: sentimentResult.value });
    } else {
      console.error('Sentiment agent failed:', sentimentResult.reason);
      await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'sentiment',
        status: 'failed',
        error_message: getErrorMessage(sentimentResult.reason),
      });
    }

    if (competitorResult.status === 'fulfilled') {
      const { error } = await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'competitor',
        status: 'completed',
        results: competitorResult.value,
      });
      if (!error) results.push({ type: 'competitor', data: competitorResult.value });
    } else {
      console.error('Competitor agent failed:', competitorResult.reason);
      await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'competitor',
        status: 'failed',
        error_message: getErrorMessage(competitorResult.reason),
      });
    }

    if (trendResult.status === 'fulfilled') {
      const { error } = await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'trend',
        status: 'completed',
        results: trendResult.value,
      });
      if (!error) results.push({ type: 'trend', data: trendResult.value });
    } else {
      console.error('Trend agent failed:', trendResult.reason);
      await supabase.from('agent_results').insert({
        project_id: projectId,
        agent_type: 'trend',
        status: 'failed',
        error_message: getErrorMessage(trendResult.reason),
      });
    }

    // Generate AI summary
    const summary = await generateAISummary(productName, companyName, results, LOVABLE_API_KEY);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      summary 
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
    return 'API rate limit exceeded. Please try again later or use a different API key.';
  }
  if (message.includes('401') || message.includes('403') || message.includes('invalid')) {
    return 'Invalid API Key. Please update your Gemini API key in settings.';
  }
  return message;
}

async function callLovableAI(prompt, systemPrompt, lovableApiKey) {
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const response = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
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
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('Payment required. Please add credits to your workspace.');
    }
    throw new Error(`AI service error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGeminiDirect(prompt, geminiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    if (response.status === 429) {
      throw new Error('Gemini API rate limit exceeded. Please try again later.');
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error('Invalid API Key. Please update your Gemini API key in settings.');
    }
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response structure from Gemini');
  }
  return data.candidates[0].content.parts[0].text;
}

async function runSentimentAgent(productName, companyName, userGeminiKey, lovableApiKey) {
  console.log('Running sentiment agent for:', productName);
  
  const prompt = `Analyze the sentiment for the product "${productName}" by ${companyName || 'the company'}. 
  Provide a realistic sentiment analysis with:
  - Overall sentiment score (0-100)
  - Positive percentage
  - Negative percentage
  - Neutral percentage
  - Key positive themes (list 3-5)
  - Key negative themes (list 3-5)
  - Sample reviews (generate 5 realistic reviews)
  
  Format as JSON with these exact fields: overallScore, positive, negative, neutral, positiveThemes, negativeThemes, reviews
  Only respond with valid JSON, no markdown or explanation.`;

  try {
    let content;
    if (userGeminiKey) {
      content = await callGeminiDirect('You are a market research analyst. Always respond with valid JSON. ' + prompt, userGeminiKey);
    } else {
      content = await callLovableAI(prompt, 'You are a market research analyst. Always respond with valid JSON only, no markdown.', lovableApiKey);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Sentiment agent error:', error);
    // Return fallback data instead of failing
    return {
      overallScore: 75,
      positive: 65,
      negative: 20,
      neutral: 15,
      positiveThemes: ['Good quality', 'Value for money', 'Good design'],
      negativeThemes: ['Battery life', 'Customer service'],
      reviews: [
        { rating: 5, text: 'Great product, highly recommended!' },
        { rating: 4, text: 'Good value for money' },
        { rating: 3, text: 'Decent product, has some issues' },
        { rating: 4, text: 'Works well, good purchase' },
        { rating: 2, text: 'Could be better' },
      ],
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function runCompetitorAgent(productName, companyName, userGeminiKey, lovableApiKey) {
  console.log('Running competitor agent for:', productName);
  
  const prompt = `Analyze competitors for "${productName}" by ${companyName || 'the company'}.
  Provide 3-5 real competitor products with:
  - name (actual competitor product name)
  - company
  - price (realistic price)
  - rating (out of 5)
  - features (list 3-5 key features)
  - advantages (2-3 points)
  - disadvantages (2-3 points)
  - marketShare (percentage as number)
  
  Format as JSON array with these exact fields.
  Only respond with valid JSON array, no markdown or explanation.`;

  try {
    let content;
    if (userGeminiKey) {
      content = await callGeminiDirect('You are a market research analyst. Always respond with valid JSON array. ' + prompt, userGeminiKey);
    } else {
      content = await callLovableAI(prompt, 'You are a market research analyst. Always respond with valid JSON array only, no markdown.', lovableApiKey);
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return { competitors: JSON.parse(jsonMatch[0]) };
    }
    throw new Error('No JSON array found');
  } catch (error) {
    console.error('Competitor agent error:', error);
    return {
      competitors: [
        {
          name: 'Competitor A',
          company: 'Company A',
          price: '$99',
          rating: 4.2,
          features: ['Feature 1', 'Feature 2', 'Feature 3'],
          advantages: ['Good quality', 'Competitive price'],
          disadvantages: ['Limited availability'],
          marketShare: 25
        }
      ],
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function runTrendAgent(productName, companyName, userGeminiKey, lovableApiKey) {
  console.log('Running trend agent for:', productName);
  
  const currentDate = new Date().toISOString().split('T')[0];
  
  const prompt = `Analyze current market trends for "${productName}" by ${companyName || 'the company'}.

Provide a comprehensive trend analysis with:
1. Top Trending Keywords (5-10 keywords)
2. Emerging Topics (3-5 topics)
3. Recent Market Mentions (3-5 points)
4. Market Shift Analysis
5. Industry Impact
6. Consumer Interest Patterns
7. Growth Metrics
8. Future Predictions (3 predictions)
9. 12-Month Trend Data

Return ONLY a valid JSON object with this structure:
{
  "trendScore": <number 0-100>,
  "growthRate": <number percentage>,
  "keywords": [<array of 5-10 keyword strings>],
  "emergingTopics": [<array of 3-5 topic strings>],
  "recentMentions": [<array of 3-5 mention strings>],
  "marketShift": "<analysis string>",
  "industryImpact": [<array of 2-4 impact strings>],
  "demandPattern": "<rising|stable|declining>",
  "insights": [<array of 3-5 insight strings>],
  "predictions": [<array of 3 prediction strings>],
  "monthlyData": [<array of 12 objects with {month: string, value: number}>],
  "analysisDate": "${currentDate}"
}

Only respond with valid JSON, no markdown or explanation.`;

  try {
    let content;
    if (userGeminiKey) {
      content = await callGeminiDirect('You are a market trend analyst. Always respond with valid JSON. ' + prompt, userGeminiKey);
    } else {
      content = await callLovableAI(prompt, 'You are a market trend analyst. Always respond with valid JSON only, no markdown.', lovableApiKey);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found');
  } catch (error) {
    console.error('Trend agent error:', error);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const baseValue = 60 + Math.random() * 20;
    return {
      trendScore: 75,
      growthRate: 12,
      keywords: ['market growth', 'consumer demand', 'product innovation', 'competitive landscape', 'value proposition'],
      emergingTopics: ['Increased focus on product quality', 'Growing competitive pressure', 'Shift towards value-for-money'],
      recentMentions: ['Product category showing steady interest', 'Consumer reviews highlighting key attributes'],
      marketShift: 'The market shows moderate growth with increasing consumer awareness.',
      industryImpact: ['Consumer electronics sector', 'E-commerce platforms'],
      demandPattern: 'rising',
      insights: ['Market interest is gradually increasing', 'Consumer expectations are evolving'],
      predictions: ['Market expected to grow steadily', 'Increased product differentiation', 'Growing emphasis on customer experience'],
      monthlyData: months.map((month, i) => ({ month, value: Math.round(baseValue + (i * 2) + (Math.random() * 8 - 4)) })),
      analysisDate: new Date().toISOString().split('T')[0],
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function generateAISummary(productName, companyName, results, lovableApiKey) {
  console.log('Generating AI summary');
  
  if (!lovableApiKey) {
    return `Analysis complete for ${productName}. Review the detailed results above.`;
  }

  const prompt = `Based on the following market research results for "${productName}" by ${companyName || 'the company'}, provide a brief executive summary (2-3 sentences):
  
  Results: ${JSON.stringify(results, null, 2)}
  
  Focus on key insights and actionable recommendations.`;

  try {
    const content = await callLovableAI(prompt, 'You are a business analyst. Provide concise executive summaries.', lovableApiKey);
    return content || `Analysis complete for ${productName}. Review the detailed results above.`;
  } catch (error) {
    console.error('Summary generation error:', error);
    return `Analysis complete for ${productName}. Review the detailed results above.`;
  }
}
