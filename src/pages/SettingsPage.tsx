import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Save, Plus, Eye, EyeOff, Key, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ApiKey {
  id: string;
  key_name: string;
  key_value: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<"none" | "active" | "invalid">("none");
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadApiKeys();
    checkGeminiKeyStatus();
  }, [user]);

  const checkGeminiKeyStatus = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("user_api_keys")
      .select("key_value")
      .eq("user_id", user.id)
      .eq("key_name", "GEMINI_API_KEY")
      .single();

    if (data?.key_value) {
      setGeminiKey(data.key_value);
      setGeminiKeyStatus("active");
    } else {
      setGeminiKeyStatus("none");
    }
  };

  const testGeminiKey = async () => {
    if (!geminiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter a Gemini API key to test",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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
        setGeminiKeyStatus("active");
        toast({
          title: "Connection Successful",
          description: "Gemini API key successfully connected!",
        });
      } else {
        setGeminiKeyStatus("invalid");
        toast({
          title: "Invalid API Key",
          description: "The API key is invalid or has insufficient permissions",
          variant: "destructive",
        });
      }
    } catch (error) {
      setGeminiKeyStatus("invalid");
      toast({
        title: "Connection Failed",
        description: "Could not connect to Gemini API",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const saveGeminiKey = async () => {
    if (!geminiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter a Gemini API key",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: existingKey } = await supabase
        .from("user_api_keys")
        .select("id")
        .eq("user_id", user?.id)
        .eq("key_name", "GEMINI_API_KEY")
        .single();

      if (existingKey) {
        const { error } = await supabase
          .from("user_api_keys")
          .update({ key_value: geminiKey, updated_at: new Date().toISOString() })
          .eq("id", existingKey.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_api_keys").insert({
          user_id: user?.id,
          key_name: "GEMINI_API_KEY",
          key_value: geminiKey,
        });

        if (error) throw error;
      }

      setGeminiKeyStatus("active");
      toast({
        title: "API Key Saved",
        description: "Your Gemini API key has been saved successfully",
      });
      loadApiKeys();
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

  const loadApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading API keys",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddKey = async () => {
    if (!newKeyName || !newKeyValue) {
      toast({
        title: "Missing information",
        description: "Please provide both key name and value",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .insert({
          user_id: user?.id,
          key_name: newKeyName,
          key_value: newKeyValue,
        });

      if (error) throw error;

      toast({
        title: "API key added",
        description: "Your API key has been saved successfully",
      });

      setNewKeyName("");
      setNewKeyValue("");
      loadApiKeys();
    } catch (error: any) {
      toast({
        title: "Error adding API key",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "API key deleted",
        description: "The API key has been removed",
      });

      loadApiKeys();
    } catch (error: any) {
      toast({
        title: "Error deleting API key",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!window.confirm("Are you sure you want to delete ALL your data? This cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    try {
      // Delete all user data
      await supabase.from('agent_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('research_projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('user_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('user_api_keys').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      toast({
        title: "All data deleted",
        description: "Your data has been permanently removed",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-lg">
          Manage your preferences and API configurations
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Gemini API Key Management */}
        <Card className="glass-effect border-border/50 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Gemini API Key Management
            </CardTitle>
            <CardDescription>
              Configure your Gemini API key for AI-powered research. Without a key, the built-in Lovable AI service will be used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
              <span className="text-sm font-medium">Status:</span>
              {geminiKeyStatus === "active" ? (
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle className="h-4 w-4" />
                  Active
                </span>
              ) : geminiKeyStatus === "invalid" ? (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Invalid
                </span>
              ) : (
                <span className="text-muted-foreground">Not configured (using Lovable AI)</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gemini-api-key">Gemini API Key</Label>
              <Input
                id="gemini-api-key"
                type="password"
                placeholder="AIza..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={testGeminiKey}
                disabled={isTesting || !geminiKey.trim()}
                className="flex-1"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button
                onClick={saveGeminiKey}
                disabled={isLoading || !geminiKey.trim()}
                className="flex-1 gradient-primary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Key
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>Other API Keys</CardTitle>
            <CardDescription>
              Manage additional API keys for external services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add New API Key */}
            <div className="p-4 border border-border/50 rounded-lg space-y-4">
              <h3 className="text-sm font-semibold">Add New API Key</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g., GROQ_API_KEY"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-value">Key Value</Label>
                  <Input
                    id="key-value"
                    type="password"
                    placeholder="Enter API key value"
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddKey}
                disabled={isLoading}
                className="w-full gradient-primary hover:opacity-90 transition-opacity"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add API Key
              </Button>
            </div>

            {/* Existing API Keys */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Saved API Keys</h3>
              {apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No API keys saved yet. Add one above to get started.
                </p>
              ) : (
                apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-3 border border-border/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{key.key_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {showKeys[key.id]
                          ? key.key_value
                          : '•'.repeat(Math.min(key.key_value.length, 40))}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setShowKeys((prev) => ({ ...prev, [key.id]: !prev[key.id] }))
                        }
                      >
                        {showKeys[key.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteKey(key.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Customize your AI Assistant experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Voice Output</Label>
                <p className="text-xs text-muted-foreground">
                  Enable text-to-speech for AI responses
                </p>
              </div>
              <Switch checked={voiceOutput} onCheckedChange={setVoiceOutput} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-effect border-border/50 border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions - proceed with caution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleDeleteAllData}
            variant="destructive"
            className="w-full"
            disabled={isLoading}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isLoading ? "Deleting..." : "Delete All Data"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            This will permanently delete all research projects, insights, API keys, and settings from the database
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
