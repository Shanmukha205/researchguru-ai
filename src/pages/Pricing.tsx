import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Perfect for getting started",
      features: [
        "Up to 3 research projects",
        "Basic sentiment analysis",
        "Limited competitor tracking",
        "AI Assistant (5 queries/day)",
        "Email support",
      ],
      limitations: [
        "No PDF export",
        "No trend detection",
        "Basic insights only",
      ],
      cta: "Current Plan",
      current: true,
    },
    {
      name: "Standard",
      price: "$29",
      period: "/month",
      description: "For growing businesses",
      features: [
        "Up to 20 research projects",
        "Advanced sentiment analysis",
        "Competitor tracking (up to 10)",
        "AI Assistant (50 queries/day)",
        "Trend detection",
        "PDF reports",
        "Priority email support",
      ],
      cta: "Upgrade to Standard",
      popular: true,
    },
    {
      name: "Pro",
      price: "$99",
      period: "/month",
      description: "For enterprise teams",
      features: [
        "Unlimited research projects",
        "Advanced sentiment analysis",
        "Unlimited competitor tracking",
        "AI Assistant (unlimited)",
        "Real-time trend detection",
        "Custom PDF reports",
        "API access",
        "Dedicated support",
        "Team collaboration",
        "Custom integrations",
      ],
      cta: "Upgrade to Pro",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Choose Your Plan
        </h1>
        <p className="text-muted-foreground text-lg">
          Unlock the full power of AI-driven market research
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`glass-effect border-border/50 relative ${
              plan.popular
                ? "border-primary shadow-lg shadow-primary/20 scale-105"
                : ""
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>
            )}
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <CardDescription className="mt-2">
                {plan.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.limitations && (
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Limitations:</p>
                  <ul className="space-y-2">
                    {plan.limitations.map((limitation, index) => (
                      <li key={index} className="text-xs text-muted-foreground">
                        • {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                className={`w-full ${
                  plan.current
                    ? "bg-secondary text-secondary-foreground"
                    : plan.popular
                    ? "gradient-primary hover:opacity-90"
                    : "bg-primary/10 hover:bg-primary/20"
                } transition-all`}
                disabled={plan.current}
              >
                {plan.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-effect border-border/50 max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>All Plans Include</CardTitle>
          <CardDescription>
            Core features available across all subscription tiers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">Groq-powered AI Assistant</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">Real-time data analysis</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">Secure data storage</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">Regular feature updates</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
