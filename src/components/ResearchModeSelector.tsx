import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Zap, BookOpen } from "lucide-react";

interface ResearchModeSelectorProps {
  mode: 'quick' | 'deep';
  onModeChange: (mode: 'quick' | 'deep') => void;
  disabled?: boolean;
}

export function ResearchModeSelector({ mode, onModeChange, disabled }: ResearchModeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Research Mode</Label>
      <RadioGroup
        value={mode}
        onValueChange={(value) => onModeChange(value as 'quick' | 'deep')}
        className="grid grid-cols-2 gap-3"
        disabled={disabled}
      >
        <Label
          htmlFor="quick"
          className={`cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Card className={`border-2 transition-all ${
            mode === 'quick' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}>
            <CardContent className="p-4 flex items-start gap-3">
              <RadioGroupItem value="quick" id="quick" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">Quick Research</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fast summaries, key points only. Best for quick insights.
                </p>
              </div>
            </CardContent>
          </Card>
        </Label>

        <Label
          htmlFor="deep"
          className={`cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Card className={`border-2 transition-all ${
            mode === 'deep' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}>
            <CardContent className="p-4 flex items-start gap-3">
              <RadioGroupItem value="deep" id="deep" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Deep Research</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Full analysis with detailed insights and explanations.
                </p>
              </div>
            </CardContent>
          </Card>
        </Label>
      </RadioGroup>
    </div>
  );
}
