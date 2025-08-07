export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      document_extractions: {
        Row: {
          created_at: string | null
          document_id: string | null
          extracted_text: string | null
          id: string
          structured_data: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          extracted_text?: string | null
          id?: string
          structured_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          extracted_text?: string | null
          id?: string
          structured_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_analysis: Json | null
          content: string | null
          created_at: string | null
          document_type: string | null
          extracted_content: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          filename: string
          id: string
          metadata: Json | null
          processing_progress: number | null
          processing_status: string | null
          processing_step: number | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          content?: string | null
          created_at?: string | null
          document_type?: string | null
          extracted_content?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          filename: string
          id?: string
          metadata?: Json | null
          processing_progress?: number | null
          processing_status?: string | null
          processing_step?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          content?: string | null
          created_at?: string | null
          document_type?: string | null
          extracted_content?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          filename?: string
          id?: string
          metadata?: Json | null
          processing_progress?: number | null
          processing_status?: string | null
          processing_step?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      export_history: {
        Row: {
          export_format: string | null
          exported_at: string | null
          file_size: number | null
          file_url: string | null
          form_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          export_format?: string | null
          exported_at?: string | null
          file_size?: number | null
          file_url?: string | null
          form_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          export_format?: string | null
          exported_at?: string | null
          file_size?: number | null
          file_url?: string | null
          form_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      form_shares: {
        Row: {
          created_at: string | null
          expires_at: string | null
          form_id: string | null
          id: string
          share_type: string | null
          shared_by: string | null
          shared_with: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          form_id?: string | null
          id?: string
          share_type?: string | null
          shared_by?: string | null
          shared_with?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          form_id?: string | null
          id?: string
          share_type?: string | null
          shared_by?: string | null
          shared_with?: string | null
        }
        Relationships: []
      }
      form_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          fields: Json
          id: string
          is_public: boolean | null
          is_system: boolean | null
          name: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fields: Json
          id?: string
          is_public?: boolean | null
          is_system?: boolean | null
          name: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_public?: boolean | null
          is_system?: boolean | null
          name?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      forms: {
        Row: {
          completion_status: string | null
          created_at: string | null
          document_id: string | null
          form_name: string | null
          form_template: Json | null
          id: string
          populated_data: Json | null
          updated_at: string | null
        }
        Insert: {
          completion_status?: string | null
          created_at?: string | null
          document_id?: string | null
          form_name?: string | null
          form_template?: Json | null
          id?: string
          populated_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          completion_status?: string | null
          created_at?: string | null
          document_id?: string | null
          form_name?: string | null
          form_template?: Json | null
          id?: string
          populated_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_forms: {
        Row: {
          created_at: string | null
          document_id: string | null
          form_data: Json | null
          form_type: string | null
          id: string
          status: string | null
          template_id: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          form_data?: Json | null
          form_type?: string | null
          id?: string
          status?: string | null
          template_id?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          form_data?: Json | null
          form_type?: string | null
          id?: string
          status?: string | null
          template_id?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_forms_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          created_at: string | null
          document_id: string | null
          error_message: string | null
          id: string
          job_type: string | null
          progress: number | null
          result: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          job_type?: string | null
          progress?: number | null
          result?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          job_type?: string | null
          progress?: number | null
          result?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_status: {
        Row: {
          created_at: string | null
          current_step: string | null
          document_id: string | null
          id: string
          progress_percentage: number | null
          status_message: string | null
          step_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_step?: string | null
          document_id?: string | null
          id?: string
          progress_percentage?: number | null
          status_message?: string | null
          step_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_step?: string | null
          document_id?: string | null
          id?: string
          progress_percentage?: number | null
          status_message?: string | null
          step_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_status_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          preferences: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_analytics: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          preferences: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          session_data: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          session_data?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          session_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const 