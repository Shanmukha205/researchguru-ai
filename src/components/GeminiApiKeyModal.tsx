import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Key, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface GeminiApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyConfigured: () => void;
}

export function GeminiApiKeyModal({ open, onOpenChange, onKeyConfigured }: GeminiApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      setApiKey("");
      setTestResult(null);
    }
  }, [open]);

  const testApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter a Gemini API key to test",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        }
      );

      if (response.ok) {
        setTestResult("success");
        toast({
          title: "Connection Successful",
          description: "Your Gemini API key is valid and working!",
        });
      } else {
        const errorData = await response.json();
        setTestResult("error");
        toast({
          title: "Invalid API Key",
          description: errorData.error?.message || "The API key is invalid or has insufficient permissions",
          variant: "destructive",
        });
      }
    } catch (error) {
      setTestResult("error");
      toast({
        title: "Connection Failed",
        description: "Could not connect to Gemini API. Please check your key.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter a Gemini API key",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Check if GEMINI_API_KEY already exists
      const { data: existingKey } = await supabase
        .from("user_api_keys")
        .select("id")
        .eq("user_id", user?.id)
        .eq("key_name", "GEMINI_API_KEY")
        .single();

      if (existingKey) {
        // Update existing key
        const { error } = await supabase
          .from("user_api_keys")
          .update({ key_value: apiKey, updated_at: new Date().toISOString() })
          .eq("id", existingKey.id);

        if (error) throw error;
      } else {
        // Insert new key
        const { error } = await supabase.from("user_api_keys").insert({
          user_id: user?.id,
          key_name: "GEMINI_API_KEY",
          key_value: apiKey,
        });

        if (error) throw error;
      }

      toast({
        title: "API Key Saved",
        description: "Your Gemini API key has been saved successfully",
      });

      onKeyConfigured();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error Saving Key",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const skipAndUseLovableAI = () => {
    toast({
      title: "Using Lovable AI",
      description: "Research will use the built-in AI service",
    });
    onKeyConfigured();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Configure AI API Key
          </DialogTitle>
          <DialogDescription>
            Enter your Gemini API key for direct access, or skip to use the built-in Lovable AI service.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="gemini-key">Gemini API Key (Optional)</Label>
            <Input
              id="gemini-key"
              type="password"
              placeholder="AIza..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-background/50"
            />
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                testResult === "success"
                  ? "bg-green-500/10 text-green-500"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {testResult === "success" ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">API key is valid and working!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Invalid API key. Please check and try again.</span>
                </>
              )}
            </div>
          )}

          <Button
            variant="outline"
            onClick={testApiKey}
            disabled={isTesting || !apiKey.trim()}
            className="w-full"
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={skipAndUseLovableAI} className="sm:mr-auto">
            Skip & Use Lovable AI
          </Button>
          <Button onClick={saveApiKey} disabled={isLoading || !apiKey.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save API Key"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
