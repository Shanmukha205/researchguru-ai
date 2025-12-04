import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Volume2, VolumeX, Mic, MicOff, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI research assistant. I can help you analyze market trends, competitor insights, and provide business intelligence based on your recent research. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
        toast({
          title: "Error",
          description: "Voice recognition failed",
          variant: "destructive",
        });
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, [toast]);

  // Stop speech when voice is disabled
  useEffect(() => {
    if (!voiceEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  const speak = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { 
          messages: [...messages, userMessage],
          userId: user?.id 
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        
        // Handle specific error types
        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
          throw new Error('AI service is temporarily busy. Please wait a moment and try again.');
        }
        
        throw new Error('Unable to connect to AI service. Please try again.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data && data.message) {
        const assistantMessage = { role: "assistant" as const, content: data.message };
        setMessages((prev) => [...prev, assistantMessage]);
        
        // Speak the response if voice is enabled
        if (voiceEnabled) {
          speak(data.message);
        }
      } else {
        throw new Error('No response received from AI assistant');
      }
    } catch (error: any) {
      console.error('Error calling AI assistant:', error);
      
      // Add error message to chat
      const errorMessage = { 
        role: "assistant" as const, 
        content: `I apologize, but I encountered an issue: ${error.message || 'Unable to process your request'}. Please try again in a moment.`
      };
      setMessages((prev) => [...prev, errorMessage]);
      
      toast({
        title: "Connection Issue",
        description: error.message || "Failed to communicate with AI assistant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    if (voiceEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Not Supported",
        description: "Voice recognition is not supported in this browser",
        variant: "destructive",
      });
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  return (
    <div className="p-8 h-screen flex flex-col animate-fade-in">
      <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">AI Assistant</h1>
            <p className="text-muted-foreground text-lg">
              Real-time market intelligence assistant
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleRecording}
              className={isRecording ? "bg-red-500/20 animate-pulse" : ""}
            >
              {isRecording ? (
                <MicOff className="h-5 w-5 text-red-500" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleVoice}
              className={voiceEnabled ? "bg-primary/20" : ""}
            >
              {voiceEnabled ? (
                <Volume2 className={`h-5 w-5 ${isSpeaking ? "animate-pulse" : ""}`} />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <Card className="glass-effect border-border/50 flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Chat Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "assistant" ? "justify-start" : "justify-end"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-4 rounded-lg ${
                      message.role === "assistant"
                        ? "bg-secondary/50 border border-border/50"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-accent" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <div className="bg-secondary/50 border border-border/50 p-4 rounded-lg">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce delay-100" />
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything about your market research..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              disabled={isLoading}
              className="bg-background/50"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="gradient-primary hover:opacity-90 transition-opacity"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}