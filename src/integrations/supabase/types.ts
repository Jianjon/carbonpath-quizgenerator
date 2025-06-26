export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          service_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          service_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          service_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          pdf_source: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          pdf_source?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          pdf_source?: string | null
        }
        Relationships: []
      }
      generation_sessions: {
        Row: {
          created_at: string
          id: string
          parameters: Json
          question_count: number
          session_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          parameters: Json
          question_count?: number
          session_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          parameters?: Json
          question_count?: number
          session_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      learning_goals: {
        Row: {
          chapter_id: string | null
          created_at: string
          description: string | null
          id: string
          title: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_goals_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank: {
        Row: {
          bloom_level: number | null
          chapter_id: string | null
          content: string
          correct_answer: string
          created_at: string
          created_by: string | null
          difficulty: number | null
          difficulty_label: string | null
          explanation: string
          id: string
          learning_goal_ids: string[] | null
          options: Json | null
          page_range: string | null
          question_type: string
          session_id: string | null
          source_pdf: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          bloom_level?: number | null
          chapter_id?: string | null
          content: string
          correct_answer: string
          created_at?: string
          created_by?: string | null
          difficulty?: number | null
          difficulty_label?: string | null
          explanation: string
          id?: string
          learning_goal_ids?: string[] | null
          options?: Json | null
          page_range?: string | null
          question_type: string
          session_id?: string | null
          source_pdf?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          bloom_level?: number | null
          chapter_id?: string | null
          content?: string
          correct_answer?: string
          created_at?: string
          created_by?: string | null
          difficulty?: number | null
          difficulty_label?: string | null
          explanation?: string
          id?: string
          learning_goal_ids?: string[] | null
          options?: Json | null
          page_range?: string | null
          question_type?: string
          session_id?: string | null
          source_pdf?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "generation_sessions"
            referencedColumns: ["id"]
          },
        ]
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
