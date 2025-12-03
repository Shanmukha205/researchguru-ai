import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";

interface ErrorExplanationPanelProps {
  error: string;
  agentType?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ErrorExplanationPanel({ error, agentType, onRetry, isRetrying }: ErrorExplanationPanelProps) {
  const getErrorDetails = (errorMsg: string) => {
    const lowerError = errorMsg.toLowerCase();
    
    if (lowerError.includes('api key') || lowerError.includes('401') || lowerError.includes('unauthorized')) {
      return {
        title: 'API Key Issue',
        cause: 'The API key is invalid, expired, or not properly configured.',
        fix: 'Go to Settings → API Key Management and update your Gemini API key.',
        icon: AlertTriangle,
        iconColor: 'text-amber-500'
      };
    }
    
    if (lowerError.includes('rate limit') || lowerError.includes('429') || lowerError.includes('quota')) {
      return {
        title: 'Rate Limit Exceeded',
        cause: 'Too many requests were made in a short time period.',
        fix: 'Wait a few minutes before trying again, or upgrade your API plan.',
        icon: AlertTriangle,
        iconColor: 'text-amber-500'
      };
    }
    
    if (lowerError.includes('timeout') || lowerError.includes('network') || lowerError.includes('fetch')) {
      return {
        title: 'Connection Error',
        cause: 'Unable to connect to the analysis service.',
        fix: 'Check your internet connection and try again.',
        icon: XCircle,
        iconColor: 'text-red-500'
      };
    }
    
    if (lowerError.includes('no data') || lowerError.includes('not found') || lowerError.includes('empty')) {
      return {
        title: 'No Data Available',
        cause: 'Could not find sufficient data for this product/company.',
        fix: 'Try using a more specific product name or add more context in the description.',
        icon: HelpCircle,
        iconColor: 'text-blue-500'
      };
    }
    
    if (lowerError.includes('parse') || lowerError.includes('json') || lowerError.includes('format')) {
      return {
        title: 'Data Processing Error',
        cause: 'The response data was in an unexpected format.',
        fix: 'This is usually temporary. Try running the analysis again.',
        icon: AlertTriangle,
        iconColor: 'text-amber-500'
      };
    }
    
    return {
      title: 'Analysis Failed',
      cause: 'An unexpected error occurred during analysis.',
      fix: 'Try again. If the problem persists, check your API key or try a different query.',
      icon: XCircle,
      iconColor: 'text-red-500'
    };
  };

  const details = getErrorDetails(error);
  const Icon = details.icon;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={`h-5 w-5 ${details.iconColor}`} />
          {agentType ? `${agentType} - ` : ''}{details.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-foreground">What happened:</p>
            <p className="text-muted-foreground">{details.cause}</p>
          </div>
          
          <div>
            <p className="font-medium text-foreground">How to fix:</p>
            <p className="text-muted-foreground">{details.fix}</p>
          </div>
        </div>

        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </Button>
        )}

        <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
          Error details: {error.substring(0, 150)}{error.length > 150 ? '...' : ''}
        </p>
      </CardContent>
    </Card>
  );
}
