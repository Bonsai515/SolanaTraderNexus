import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AppLayout from "@/layouts/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Trading from "@/pages/Trading";
import Wallet from "@/pages/Wallet";
import AIAgents from "@/pages/AIAgents";
import Strategies from "@/pages/Strategies";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/trading" component={Trading} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/ai-agents" component={AIAgents} />
      <Route path="/strategies" component={Strategies} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppLayout>
          <Router />
        </AppLayout>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
