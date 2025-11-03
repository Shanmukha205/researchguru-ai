import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTheme } from "next-themes";

export default function EnhancedSettings() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Agent toggles
  const [agentToggles, setAgentToggles] = useState({
    sentiment: true,
    competitor: true,
    trends: true,
    insights: true
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    email: true,
    inApp: true,
    agentComplete: true,
    newInsights: true
  });

  const handleDeleteAllData = async () => {
    if (!window.confirm("Are you sure you want to delete ALL your data? This cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    try {
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
          Configure your application preferences and API integrations
        </p>
      </div>

      <Accordion type="multiple" className="space-y-4" defaultValue={["agents", "theme"]}>
        {/* Agent Controls */}
        <AccordionItem value="agents" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <h2 className="text-lg font-semibold">Agent Controls</h2>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <p className="text-sm text-muted-foreground mb-4">
              Enable or disable individual research agents
            </p>
            <div className="space-y-4">
              {Object.entries(agentToggles).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label className="capitalize font-medium">{key} Agent</Label>
                    <p className="text-xs text-muted-foreground">
                      {key === 'sentiment' && 'Analyze customer sentiment and reviews'}
                      {key === 'competitor' && 'Research competitor products and pricing'}
                      {key === 'trends' && 'Track market trends and patterns'}
                      {key === 'insights' && 'Generate AI-powered insights and recommendations'}
                    </p>
                  </div>
                  <Switch
                    checked={value}
                    onCheckedChange={(checked) => 
                      setAgentToggles(prev => ({ ...prev, [key]: checked }))
                    }
                  />
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Theme & Appearance */}
        <AccordionItem value="theme" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Theme & Appearance</h2>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Theme Mode</Label>
                  <p className="text-xs text-muted-foreground">Choose your preferred color scheme</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                  >
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                  >
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                  >
                    System
                  </Button>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Notifications */}
        <AccordionItem value="notifications" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <h2 className="text-lg font-semibold">Notifications & Alerts</h2>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <p className="text-sm text-muted-foreground mb-4">
              Configure how you receive updates and alerts
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, email: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>In-App Notifications</Label>
                  <p className="text-xs text-muted-foreground">Show toast notifications in the app</p>
                </div>
                <Switch
                  checked={notifications.inApp}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, inApp: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Agent Completion Alerts</Label>
                  <p className="text-xs text-muted-foreground">Notify when agents finish running</p>
                </div>
                <Switch
                  checked={notifications.agentComplete}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, agentComplete: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>New Insights Alerts</Label>
                  <p className="text-xs text-muted-foreground">Notify when new insights are generated</p>
                </div>
                <Switch
                  checked={notifications.newInsights}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, newInsights: checked }))
                  }
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Preferences */}
        <AccordionItem value="preferences" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <h2 className="text-lg font-semibold">Additional Preferences</h2>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Voice Output</Label>
                  <p className="text-xs text-muted-foreground">Enable text-to-speech for AI responses</p>
                </div>
                <Switch checked={voiceOutput} onCheckedChange={setVoiceOutput} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* System Actions */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions - proceed with caution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={handleDeleteAllData}
            variant="destructive"
            className="w-full"
            disabled={isLoading}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isLoading ? "Deleting..." : "Delete All Data"}
          </Button>
          <p className="text-xs text-muted-foreground">
            This will permanently delete all research projects, insights, API keys, and settings
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
