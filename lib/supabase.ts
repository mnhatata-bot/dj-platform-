import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jbnunnejqvvrwxewljdc.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_WwF5eEz4xTwImwW6qKdeWg_Pq2atwU8";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
});
