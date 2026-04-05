import { createRoot } from "react-dom/client";
import { supabase } from "@/integrations/supabase/client";
import { ensureBrandIcons } from "@/lib/runtime/brandIcons";
import { registerNativeRuntimeHandlers } from "@/lib/runtime/nativeDeeplinks";
import App from "./App.tsx";
import "./index.css";

ensureBrandIcons();
registerNativeRuntimeHandlers(supabase);

createRoot(document.getElementById("root")!).render(<App />);
