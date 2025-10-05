import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { X, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AgentConfigDialogProps {
  agentType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AgentConfigDialog({ agentType, open, onOpenChange }: AgentConfigDialogProps) {
  const { toast } = useToast();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [sentimentThreshold, setSentimentThreshold] = useState(0.5);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open, agentType]);

  const loadConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('agent_configurations')
        .select('*')
        .eq('user_id', user.id)
        .eq('agent_type', agentType)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setKeywords(data.keywords || []);
        const threshold = typeof data.sentiment_threshold === 'string' 
          ? parseFloat(data.sentiment_threshold) 
          : data.sentiment_threshold || 0.5;
        setSentimentThreshold(threshold);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('agent_configurations')
        .upsert([{
          user_id: user.id,
          agent_type: agentType,
          keywords,
          sentiment_threshold: sentimentThreshold,
          filters: {},
        }]);

      if (error) throw error;

      toast({
        title: 'Configuration saved',
        description: `${agentType} agent settings updated successfully.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure {agentType} Agent
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <Label>Keywords to Monitor</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter keyword..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
              />
              <Button onClick={handleAddKeyword} variant="secondary">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="gap-1">
                  {keyword}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleRemoveKeyword(keyword)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {agentType === 'sentiment' && (
            <div className="space-y-3">
              <Label>Sentiment Threshold: {sentimentThreshold.toFixed(2)}</Label>
              <Slider
                value={[sentimentThreshold]}
                onValueChange={(values) => setSentimentThreshold(values[0])}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                Set minimum sentiment score for positive feedback (0 = very negative, 1 = very positive)
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
