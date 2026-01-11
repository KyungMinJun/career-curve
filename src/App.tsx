import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DataProvider } from "@/contexts/DataContext";
import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppWithProviders() {
  const { user, isLoading } = useAuth();
  // Initialize device fingerprint for logged-in users (abuse detection)
  useDeviceFingerprint();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <DataProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ProtectedRoute>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/:tab" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ProtectedRoute>
        </BrowserRouter>
      </TooltipProvider>
    </DataProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppWithProviders />
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
