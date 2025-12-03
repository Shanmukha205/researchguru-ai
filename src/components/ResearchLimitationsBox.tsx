import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Lightbulb, Info } from "lucide-react";

interface ResearchLimitationsBoxProps {
  limitations: string[];
  suggestions: string[];
  sources?: string[];
}

export function ResearchLimitationsBox({ limitations, suggestions, sources }: ResearchLimitationsBoxProps) {
  if (!limitations?.length && !suggestions?.length) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-500" />
          Research Quality Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {limitations?.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Limitations & Data Gaps
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {limitations.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {suggestions?.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              <Lightbulb className="h-4 w-4" />
              Suggestions for Better Results
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {suggestions.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {sources && sources.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Sources:</span> {sources.slice(0, 3).join(' • ')}
              {sources.length > 3 && ` +${sources.length - 3} more`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
