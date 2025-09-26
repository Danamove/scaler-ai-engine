export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      api_costs: {
        Row: {
          cost_usd: number | null
          created_at: string
          function_name: string
          id: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          function_name: string
          id?: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          function_name?: string
          id?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      filter_rules: {
        Row: {
          created_at: string
          exclude_terms: string[] | null
          id: string
          job_id: string
          min_months_current_role: number | null
          min_years_experience: number | null
          must_have_terms: string[] | null
          require_top_uni: boolean | null
          required_titles: string[] | null
          updated_at: string
          use_not_relevant_filter: boolean | null
          use_target_companies_filter: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          exclude_terms?: string[] | null
          id?: string
          job_id: string
          min_months_current_role?: number | null
          min_years_experience?: number | null
          must_have_terms?: string[] | null
          require_top_uni?: boolean | null
          required_titles?: string[] | null
          updated_at?: string
          use_not_relevant_filter?: boolean | null
          use_target_companies_filter?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          exclude_terms?: string[] | null
          id?: string
          job_id?: string
          min_months_current_role?: number | null
          min_years_experience?: number | null
          must_have_terms?: string[] | null
          require_top_uni?: boolean | null
          required_titles?: string[] | null
          updated_at?: string
          use_not_relevant_filter?: boolean | null
          use_target_companies_filter?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      filtered_results: {
        Row: {
          created_at: string
          filter_reasons: string[] | null
          id: string
          job_id: string
          raw_data_id: string
          stage_1_passed: boolean
          stage_2_passed: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_reasons?: string[] | null
          id?: string
          job_id: string
          raw_data_id: string
          stage_1_passed?: boolean
          stage_2_passed?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          filter_reasons?: string[] | null
          id?: string
          job_id?: string
          raw_data_id?: string
          stage_1_passed?: boolean
          stage_2_passed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filtered_results_raw_data_id_fkey"
            columns: ["raw_data_id"]
            isOneToOne: false
            referencedRelation: "raw_data"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          job_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          job_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          job_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      netly_files: {
        Row: {
          additional_data: Json | null
          candidate_name: string
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          additional_data?: Json | null
          candidate_name: string
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          additional_data?: Json | null
          candidate_name?: string
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: []
      }
      not_relevant_companies: {
        Row: {
          category: string | null
          company_name: string
          created_at: string
          id: string
        }
        Insert: {
          category?: string | null
          company_name: string
          created_at?: string
          id?: string
        }
        Update: {
          category?: string | null
          company_name?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      raw_data: {
        Row: {
          created_at: string
          current_company: string | null
          current_title: string | null
          education: string | null
          full_name: string
          id: string
          job_id: string
          linkedin_url: string | null
          months_in_current_role: number | null
          previous_company: string | null
          profile_summary: string | null
          user_id: string
          years_of_experience: number | null
        }
        Insert: {
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          education?: string | null
          full_name: string
          id?: string
          job_id: string
          linkedin_url?: string | null
          months_in_current_role?: number | null
          previous_company?: string | null
          profile_summary?: string | null
          user_id: string
          years_of_experience?: number | null
        }
        Update: {
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          education?: string | null
          full_name?: string
          id?: string
          job_id?: string
          linkedin_url?: string | null
          months_in_current_role?: number | null
          previous_company?: string | null
          profile_summary?: string | null
          user_id?: string
          years_of_experience?: number | null
        }
        Relationships: []
      }
      synonyms: {
        Row: {
          canonical_term: string
          category: string
          created_at: string
          id: string
          variant_term: string
        }
        Insert: {
          canonical_term: string
          category: string
          created_at?: string
          id?: string
          variant_term: string
        }
        Update: {
          canonical_term?: string
          category?: string
          created_at?: string
          id?: string
          variant_term?: string
        }
        Relationships: []
      }
      target_companies: {
        Row: {
          category: string | null
          company_name: string
          created_at: string
          id: string
        }
        Insert: {
          category?: string | null
          company_name: string
          created_at?: string
          id?: string
        }
        Update: {
          category?: string | null
          company_name?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      top_universities: {
        Row: {
          country: string | null
          created_at: string
          id: string
          university_name: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          university_name: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          university_name?: string
        }
        Relationships: []
      }
      user_blacklist: {
        Row: {
          company_name: string
          created_at: string
          id: string
          job_id: string | null
          user_id: string
        }
        Insert: {
          company_name: string
          created_at?: string
          id?: string
          job_id?: string | null
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          job_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_past_candidates: {
        Row: {
          candidate_name: string
          created_at: string
          id: string
          job_id: string | null
          user_id: string
        }
        Insert: {
          candidate_name: string
          created_at?: string
          id?: string
          job_id?: string | null
          user_id: string
        }
        Update: {
          candidate_name?: string
          created_at?: string
          id?: string
          job_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_own_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
      can_access_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["admin", "user"],
    },
  },
} as const
