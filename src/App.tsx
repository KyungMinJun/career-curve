import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { JobStoreProvider, useJobStore } from "@/stores/jobStore";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthStoreSync() {
  const { user } = useAuth();
  const { setUserNames } = useJobStore();

  useEffect(() => {
    if (!user) return;

    const ko = String((user.user_metadata as any)?.name_ko ?? '').trim();
    const en = String((user.user_metadata as any)?.name_en ?? '').trim();
    if (!ko && !en) return;

    setUserNames({ ko, en });
  }, [user, setUserNames]);

  return null;
}

function AppWithProviders() {
  const { user, isLoading } = useAuth();

  // Wait for auth to be determined before rendering anything that uses storage
  // This prevents loading wrong user's data during the auth check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  // Use user.id if logged in, otherwise use a truly anonymous key
  // CRITICAL: Each user MUST have their own isolated storage
  const storageKey = user?.id ? `jobflow-storage:${user.id}` : "jobflow-storage:anon";

  // One-time cleanup for legacy shared storage key (pre-fix)
  useEffect(() => {
    try {
      if (user?.id) {
        const legacyKeys = ["jobflow-storage", "jobflow", "job-store", "zustand-job-store"];
        legacyKeys.forEach((k) => {
          if (localStorage.getItem(k)) localStorage.removeItem(k);
        });
      }
    } catch {
      // ignore
    }
  }, [user?.id]);

  return (
    <JobStoreProvider key={storageKey} storageKey={storageKey}>
      <AuthStoreSync />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ProtectedRoute>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ProtectedRoute>
        </BrowserRouter>
      </TooltipProvider>
    </JobStoreProvider>
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
