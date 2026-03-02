export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          location_id: string;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          location_id?: string;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          location_id?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      locations: {
        Row: { created_at: string; id: string; name: string };
        Insert: { created_at?: string; id?: string; name: string };
        Update: { created_at?: string; id?: string; name?: string };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          created_by_user_id: string | null;
          id: string;
          location_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          rental_id: string | null;
          reservation_id: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          type: Database["public"]["Enums"]["payment_type"];
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          location_id?: string;
          method: Database["public"]["Enums"]["payment_method"];
          rental_id?: string | null;
          reservation_id?: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          type: Database["public"]["Enums"]["payment_type"];
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          location_id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          rental_id?: string | null;
          reservation_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          type?: Database["public"]["Enums"]["payment_type"];
        };
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          active: boolean;
          created_at: string;
          deposit_cents: number;
          duration_unit: Database["public"]["Enums"]["duration_unit"];
          duration_value: number;
          id: string;
          location_id: string;
          price_cents: number;
          season_key: string | null;
          vehicle_type_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          deposit_cents?: number;
          duration_unit: Database["public"]["Enums"]["duration_unit"];
          duration_value: number;
          id?: string;
          location_id?: string;
          price_cents: number;
          season_key?: string | null;
          vehicle_type_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          deposit_cents?: number;
          duration_unit?: Database["public"]["Enums"]["duration_unit"];
          duration_value?: number;
          id?: string;
          location_id?: string;
          price_cents?: number;
          season_key?: string | null;
          vehicle_type_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["user_role"];
        };
        Insert: {
          created_at?: string;
          id: string;
          role: Database["public"]["Enums"]["user_role"];
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Relationships: [];
      };
      rental_assets: {
        Row: { created_at: string; id: string; rental_id: string; vehicle_id: string };
        Insert: { created_at?: string; id?: string; rental_id: string; vehicle_id: string };
        Update: { created_at?: string; id?: string; rental_id?: string; vehicle_id?: string };
        Relationships: [];
      };
      rental_items: {
        Row: {
          created_at: string;
          id: string;
          pricing_rule_id: string;
          quantity: number;
          rental_id: string;
          unit_price_cents: number;
          vehicle_type_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          pricing_rule_id: string;
          quantity: number;
          rental_id: string;
          unit_price_cents: number;
          vehicle_type_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          pricing_rule_id?: string;
          quantity?: number;
          rental_id?: string;
          unit_price_cents?: number;
          vehicle_type_id?: string;
        };
        Relationships: [];
      };
      rentals: {
        Row: {
          actual_return_time: string | null;
          created_at: string;
          created_by_user_id: string;
          customer_email: string | null;
          customer_name: string;
          customer_phone: string | null;
          end_time: string;
          id: string;
          location_id: string;
          override_flag: boolean;
          override_reason: string | null;
          reservation_id: string | null;
          start_time: string;
          status: Database["public"]["Enums"]["rental_status"];
        };
        Insert: {
          actual_return_time?: string | null;
          created_at?: string;
          created_by_user_id: string;
          customer_email?: string | null;
          customer_name: string;
          customer_phone?: string | null;
          end_time: string;
          id?: string;
          location_id?: string;
          override_flag?: boolean;
          override_reason?: string | null;
          reservation_id?: string | null;
          start_time: string;
          status?: Database["public"]["Enums"]["rental_status"];
        };
        Update: {
          actual_return_time?: string | null;
          created_at?: string;
          created_by_user_id?: string;
          customer_email?: string | null;
          customer_name?: string;
          customer_phone?: string | null;
          end_time?: string;
          id?: string;
          location_id?: string;
          override_flag?: boolean;
          override_reason?: string | null;
          reservation_id?: string | null;
          start_time?: string;
          status?: Database["public"]["Enums"]["rental_status"];
        };
        Relationships: [];
      };
      reservation_items: {
        Row: {
          created_at: string;
          deposit_cents: number;
          id: string;
          pricing_rule_id: string;
          quantity: number;
          reservation_id: string;
          unit_price_cents: number;
          vehicle_type_id: string;
        };
        Insert: {
          created_at?: string;
          deposit_cents?: number;
          id?: string;
          pricing_rule_id: string;
          quantity: number;
          reservation_id: string;
          unit_price_cents: number;
          vehicle_type_id: string;
        };
        Update: {
          created_at?: string;
          deposit_cents?: number;
          id?: string;
          pricing_rule_id?: string;
          quantity?: number;
          reservation_id?: string;
          unit_price_cents?: number;
          vehicle_type_id?: string;
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          created_at: string;
          created_by_user_id: string | null;
          customer_email: string | null;
          customer_name: string;
          customer_phone: string | null;
          delivery_address: string | null;
          delivery_required: boolean;
          delivery_time: string | null;
          end_time: string;
          id: string;
          location_id: string;
          notes: string | null;
          override_flag: boolean;
          override_reason: string | null;
          overridden_by_user_id: string | null;
          start_time: string;
          status: Database["public"]["Enums"]["reservation_status"];
        };
        Insert: {
          created_at?: string;
          created_by_user_id?: string | null;
          customer_email?: string | null;
          customer_name: string;
          customer_phone?: string | null;
          delivery_address?: string | null;
          delivery_required?: boolean;
          delivery_time?: string | null;
          end_time: string;
          id?: string;
          location_id?: string;
          notes?: string | null;
          override_flag?: boolean;
          override_reason?: string | null;
          overridden_by_user_id?: string | null;
          start_time: string;
          status: Database["public"]["Enums"]["reservation_status"];
        };
        Update: {
          created_at?: string;
          created_by_user_id?: string | null;
          customer_email?: string | null;
          customer_name?: string;
          customer_phone?: string | null;
          delivery_address?: string | null;
          delivery_required?: boolean;
          delivery_time?: string | null;
          end_time?: string;
          id?: string;
          location_id?: string;
          notes?: string | null;
          override_flag?: boolean;
          override_reason?: string | null;
          overridden_by_user_id?: string | null;
          start_time?: string;
          status?: Database["public"]["Enums"]["reservation_status"];
        };
        Relationships: [];
      };
      stripe_events_processed: {
        Row: { id: string; processed_at: string };
        Insert: { id: string; processed_at?: string };
        Update: { id?: string; processed_at?: string };
        Relationships: [];
      };
      vehicle_types: {
        Row: {
          active: boolean;
          category: Database["public"]["Enums"]["vehicle_category"];
          created_at: string;
          id: string;
          location_id: string;
          name: string;
        };
        Insert: {
          active?: boolean;
          category: Database["public"]["Enums"]["vehicle_category"];
          created_at?: string;
          id?: string;
          location_id?: string;
          name: string;
        };
        Update: {
          active?: boolean;
          category?: Database["public"]["Enums"]["vehicle_category"];
          created_at?: string;
          id?: string;
          location_id?: string;
          name?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          asset_tag: string;
          created_at: string;
          id: string;
          location_id: string;
          notes: string | null;
          status: Database["public"]["Enums"]["vehicle_status"];
          vehicle_type_id: string;
        };
        Insert: {
          asset_tag: string;
          created_at?: string;
          id?: string;
          location_id?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["vehicle_status"];
          vehicle_type_id: string;
        };
        Update: {
          asset_tag?: string;
          created_at?: string;
          id?: string;
          location_id?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["vehicle_status"];
          vehicle_type_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      check_availability: {
        Args: {
          p_location_id: string;
          p_vehicle_type_id: string;
          p_start_time: string;
          p_end_time: string;
          p_quantity: number;
        };
        Returns: {
          is_available: boolean;
          available_count: number;
          total_count: number;
          blocked_count: number;
          category: Database["public"]["Enums"]["vehicle_category"];
          effective_start: string;
          effective_end: string;
        }[];
      };
      convert_reservation_to_rental: {
        Args: {
          p_reservation_id: string;
          p_assigned_vehicle_ids: string[];
          p_override_flag?: boolean;
          p_override_reason?: string;
        };
        Returns: string;
      };
      create_reservation: { Args: { p_payload: Json }; Returns: string };
      get_buffer_interval: {
        Args: { p_category: Database["public"]["Enums"]["vehicle_category"] };
        Returns: unknown;
      };
      has_location_access: { Args: { p_location_id: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff_or_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      return_rental: {
        Args: { p_rental_id: string; p_actual_return_time?: string };
        Returns: undefined;
      };
    };
    Enums: {
      duration_unit: "hour" | "day" | "week";
      payment_method: "stripe" | "cash";
      payment_status: "initiated" | "succeeded" | "failed" | "refunded";
      payment_type: "deposit" | "full" | "refund";
      rental_status: "active" | "returned" | "voided";
      reservation_status: "pending" | "confirmed" | "cancelled";
      user_role: "admin" | "staff";
      vehicle_category: "bike" | "car";
      vehicle_status: "available" | "maintenance";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
