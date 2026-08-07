import type { User } from "@supabase/supabase-js";

export function isDemoMode(): boolean {
  return (
    process.env.IS_DEMO === "true" || process.env.IsDemo === "true" || false
  );
}

export const DEMO_USER: User = {
  id: "00000000-0000-0000-0000-000000000000",
  aud: "authenticated",
  role: "authenticated",
  email: "demo@utangz.local",
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  confirmation_sent_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  recovery_sent_at: "",
  new_email: null,
  new_phone: null,
  invited_at: "",
  action_link: null,
  email_change: null,
  phone_change: null,
  reauthentication_sent_at: "",
  is_super_admin: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  identities: [],
  factors: [],
  app_metadata: {},
  user_metadata: {
    demo: true,
  },
  amr: [],
  aal: "aal1",
} as unknown as User;
