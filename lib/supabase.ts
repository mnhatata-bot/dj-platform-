import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jbnunnejqvvrwxewljdc.supabase.co";
const supabaseKey = "sb_publishable_WwF5eEz4xTwImwW6qKdeWg_Pq2atwU8";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
});
