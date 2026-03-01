// TODO: Replace with actual Wheels database schema once PRD is finalized.
// Generate types from Supabase CLI: npx supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Placeholder — define tables in PRD/technical-arch, then update here.
    };
  };
}
