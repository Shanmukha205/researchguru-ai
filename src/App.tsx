import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppLayout } from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Research from "./pages/Research";
import Comparison from "./pages/Comparison";
import AIInsightsCenter from "./pages/AIInsightsCenter";
import CrossMarket from "./pages/CrossMarket";
import ConsumerPersona from "./pages/ConsumerPersona";
import ScenarioSimulator from "./pages/ScenarioSimulator";
import DatasetStudio from "./pages/DatasetStudio";
import MyNotes from "./pages/MyNotes";
import AIAssistant from "./pages/AIAssistant";
import EnhancedSettings from "./pages/EnhancedSettings";
import Pricing from "./pages/Pricing";
import AdminAnalytics from "./pages/AdminAnalytics";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/research" element={<Research />} />
                <Route path="/comparison" element={<Comparison />} />
                <Route path="/ai-insights" element={<AIInsightsCenter />} />
                <Route path="/ai-assistant" element={<AIAssistant />} />
                <Route path="/cross-market" element={<CrossMarket />} />
                <Route path="/consumer-persona" element={<ConsumerPersona />} />
                <Route path="/scenario-simulator" element={<ScenarioSimulator />} />
                <Route path="/dataset-studio" element={<DatasetStudio />} />
                <Route path="/my-notes" element={<MyNotes />} />
                <Route path="/settings" element={<EnhancedSettings />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;