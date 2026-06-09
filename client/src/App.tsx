import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Editor from "@/pages/Editor";
import Output from "@/pages/Output";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Editor} />
      <Route path="/output" component={Output} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <Toaster />
      <Router hook={useHashLocation}>
        <AppRouter />
      </Router>
    </TooltipProvider>
  );
}

export default App;
