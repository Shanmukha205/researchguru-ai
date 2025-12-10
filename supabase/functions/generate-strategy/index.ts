import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectName, companyName, sentimentData, competitorData, trendData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from available data
    const contextParts: string[] = [];
    
    if (sentimentData) {
      contextParts.push(`Sentiment Analysis: ${JSON.stringify(sentimentData)}`);
    }
    if (competitorData) {
      contextParts.push(`Competitor Analysis: ${JSON.stringify(competitorData)}`);
    }
    if (trendData) {
      contextParts.push(`Trend Analysis: ${JSON.stringify(trendData)}`);
    }

    const prompt = `You are a senior business strategist. Based on the following market research data for "${projectName}"${companyName ? ` by ${companyName}` : ''}, generate comprehensive business strategies.

Research Data:
${contextParts.join('\n\n')}

Generate exactly 6 strategy sections in the following JSON format:
{
  "strategies": [
    {
      "title": "Go-To-Market Strategy",
      "content": "Detailed strategy content based on the data...",
      "confidence": 85,
      "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
    },
    {
      "title": "User Segmentation Strategy",
      "content": "...",
      "confidence": 80,
      "recommendations": [...]
    },
    {
      "title": "Pricing Strategy",
      "content": "...",
      "confidence": 75,
      "recommendations": [...]
    },
    {
      "title": "Marketing Messaging Blueprint",
      "content": "...",
      "confidence": 82,
      "recommendations": [...]
    },
    {
      "title": "Risk Mitigation Plan",
      "content": "...",
      "confidence": 78,
      "recommendations": [...]
    },
    {
      "title": "Opportunity Exploitation Roadmap",
      "content": "...",
      "confidence": 80,
      "recommendations": [...]
    }
  ]
}

Requirements:
- Base ALL strategies on the provided research data only
- Confidence scores should reflect data quality (lower if data is sparse)
- Each content section should be 100-200 words
- Provide 3-5 actionable recommendations per strategy
- If insufficient data for a strategy, set confidence below 50 and note limitations
- Return ONLY valid JSON, no markdown`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a business strategy expert. Always respond with valid JSON only." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    let content = aiResponse.choices?.[0]?.message?.content || "";
    
    // Clean up response - remove markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    try {
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return fallback strategies
      return new Response(JSON.stringify({
        strategies: [
          {
            title: "Go-To-Market Strategy",
            content: "Based on the available research data, a phased market entry approach is recommended. Start with core user segments identified in the sentiment analysis.",
            confidence: 60,
            recommendations: ["Focus on primary user segments", "Leverage positive sentiment themes", "Address key pain points first"]
          },
          {
            title: "User Segmentation Strategy",
            content: "Segment users based on the sentiment patterns and engagement data available from the research.",
            confidence: 55,
            recommendations: ["Identify high-value segments", "Create targeted messaging", "Develop segment-specific features"]
          },
          {
            title: "Pricing Strategy",
            content: "Based on competitor pricing data, position competitively while maintaining value perception.",
            confidence: 50,
            recommendations: ["Analyze competitor price points", "Consider value-based pricing", "Test different price tiers"]
          },
          {
            title: "Marketing Messaging Blueprint",
            content: "Leverage positive themes from sentiment analysis to craft compelling marketing messages.",
            confidence: 55,
            recommendations: ["Highlight key differentiators", "Address user pain points", "Use social proof effectively"]
          },
          {
            title: "Risk Mitigation Plan",
            content: "Address identified negative sentiment themes and competitive threats proactively.",
            confidence: 50,
            recommendations: ["Monitor competitor moves", "Address negative feedback patterns", "Build contingency plans"]
          },
          {
            title: "Opportunity Exploitation Roadmap",
            content: "Capitalize on emerging trends and positive market signals identified in the research.",
            confidence: 55,
            recommendations: ["Prioritize high-impact opportunities", "Allocate resources strategically", "Set clear milestones"]
          }
        ]
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error in generate-strategy:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
