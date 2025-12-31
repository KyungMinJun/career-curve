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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      career_goals: {
        Row: {
          archived_at: string | null
          career_path: string | null
          company_eval_criteria: Json | null
          created_at: string
          end_date: string | null
          id: string
          is_archived: boolean | null
          reason: string
          result: string | null
          search_period: string | null
          start_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          career_path?: string | null
          company_eval_criteria?: Json | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_archived?: boolean | null
          reason: string
          result?: string | null
          search_period?: string | null
          start_date?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          career_path?: string | null
          company_eval_criteria?: Json | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_archived?: boolean | null
          reason?: string
          result?: string | null
          search_period?: string | null
          start_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_processing: boolean | null
          job_posting_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_processing?: boolean | null
          job_posting_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_processing?: boolean | null
          job_posting_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          bullets: Json | null
          company: string | null
          created_at: string
          description: string
          id: string
          period: string | null
          title: string
          type: string
          used_in_postings: Json | null
          user_id: string
        }
        Insert: {
          bullets?: Json | null
          company?: string | null
          created_at?: string
          description: string
          id?: string
          period?: string | null
          title: string
          type: string
          used_in_postings?: Json | null
          user_id: string
        }
        Update: {
          bullets?: Json | null
          company?: string | null
          created_at?: string
          description?: string
          id?: string
          period?: string | null
          title?: string
          type?: string
          used_in_postings?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          company_criteria_scores: Json | null
          company_name: string
          company_score: number | null
          created_at: string
          fit_score: number | null
          id: string
          key_competencies: Json | null
          language: string | null
          location: string | null
          location_evidence: string | null
          min_experience: string | null
          min_experience_evidence: string | null
          minimum_requirements_check: Json | null
          position: string
          priority: number
          source_url: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
          visa_sponsorship: boolean | null
          visa_sponsorship_evidence: string | null
          work_type: string | null
          work_type_evidence: string | null
        }
        Insert: {
          company_criteria_scores?: Json | null
          company_name: string
          company_score?: number | null
          created_at?: string
          fit_score?: number | null
          id?: string
          key_competencies?: Json | null
          language?: string | null
          location?: string | null
          location_evidence?: string | null
          min_experience?: string | null
          min_experience_evidence?: string | null
          minimum_requirements_check?: Json | null
          position: string
          priority?: number
          source_url?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
          visa_sponsorship?: boolean | null
          visa_sponsorship_evidence?: string | null
          work_type?: string | null
          work_type_evidence?: string | null
        }
        Update: {
          company_criteria_scores?: Json | null
          company_name?: string
          company_score?: number | null
          created_at?: string
          fit_score?: number | null
          id?: string
          key_competencies?: Json | null
          language?: string | null
          location?: string | null
          location_evidence?: string | null
          min_experience?: string | null
          min_experience_evidence?: string | null
          minimum_requirements_check?: Json | null
          position?: string
          priority?: number
          source_url?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          visa_sponsorship?: boolean | null
          visa_sponsorship_evidence?: string | null
          work_type?: string | null
          work_type_evidence?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          ai_credits: number
          created_at: string
          display_name: string
          features: Json | null
          id: string
          is_active: boolean
          job_limit: number
          name: string
          price: number
          resume_credits: number
        }
        Insert: {
          ai_credits?: number
          created_at?: string
          display_name: string
          features?: Json | null
          id?: string
          is_active?: boolean
          job_limit?: number
          name: string
          price?: number
          resume_credits?: number
        }
        Update: {
          ai_credits?: number
          created_at?: string
          display_name?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          job_limit?: number
          name?: string
          price?: number
          resume_credits?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          name_en: string | null
          name_ko: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_en?: string | null
          name_ko?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_en?: string | null
          name_ko?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          extracted_text: string | null
          file_name: string
          file_url: string
          id: string
          ocr_text: string | null
          parse_error: string | null
          parse_status: string
          parsed_at: string | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          extracted_text?: string | null
          file_name: string
          file_url: string
          id?: string
          ocr_text?: string | null
          parse_error?: string | null
          parse_status?: string
          parsed_at?: string | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          extracted_text?: string | null
          file_name?: string
          file_url?: string
          id?: string
          ocr_text?: string | null
          parse_error?: string | null
          parse_status?: string
          parsed_at?: string | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tailored_resumes: {
        Row: {
          ai_feedback: string | null
          company_name: string
          content: string
          created_at: string
          format: string
          id: string
          job_posting_id: string
          job_title: string
          language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          company_name: string
          content: string
          created_at?: string
          format: string
          id?: string
          job_posting_id: string
          job_title: string
          language: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          company_name?: string
          content?: string
          created_at?: string
          format?: string
          id?: string
          job_posting_id?: string
          job_title?: string
          language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tailored_resumes_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          ai_credits_remaining: number
          ai_credits_used: number
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string
          resume_credits_remaining: number
          resume_credits_used: number
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_credits_remaining?: number
          ai_credits_used?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id: string
          resume_credits_remaining?: number
          resume_credits_used?: number
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_credits_remaining?: number
          ai_credits_used?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string
          resume_credits_remaining?: number
          resume_credits_used?: number
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
