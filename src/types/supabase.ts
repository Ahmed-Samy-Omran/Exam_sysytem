export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          accent_color: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          accent_color?: string
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          category_id: string
          question_text: string
          explanation: string | null
          difficulty: 'easy' | 'medium' | 'hard'
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          question_text: string
          explanation?: string | null
          difficulty?: 'easy' | 'medium' | 'hard'
          is_active?: boolean
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['questions']['Insert']>
        Relationships: []
      }
      question_options: {
        Row: {
          id: string
          question_id: string
          option_text: string
          is_correct: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          question_id: string
          option_text: string
          is_correct?: boolean
          sort_order?: number
        }
        Update: Partial<Database['public']['Tables']['question_options']['Insert']>
        Relationships: []
      }
      quiz_settings: {
        Row: {
          id: string
          category_id: string
          question_count_default: number
          time_limit_minutes: number | null
          passing_score: number
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          question_count_default?: number
          time_limit_minutes?: number | null
          passing_score?: number
        }
        Update: Partial<Database['public']['Tables']['quiz_settings']['Insert']>
        Relationships: []
      }
      admin_users: {
        Row: { user_id: string; email: string; created_at: string }
        Insert: { user_id: string; email: string }
        Update: Partial<Database['public']['Tables']['admin_users']['Insert']>
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          id: string
          category_filter: string[]
          time_limit_min: number | null
          started_at: string
          submitted_at: string | null
          status: 'in_progress' | 'submitted' | 'abandoned'
          score_percent: number | null
          correct_count: number
          wrong_count: number
          unanswered_count: number
          created_at: string
          candidate_name: string | null
          candidate_email: string | null
        }
        Insert: {
          id?: string
          category_filter?: string[]
          time_limit_min?: number | null
          status?: 'in_progress' | 'submitted' | 'abandoned'
          candidate_name?: string | null
          candidate_email?: string | null
        }
        Update: Partial<Database['public']['Tables']['quiz_attempts']['Insert']>
        Relationships: []
      }
      attempt_questions: {
        Row: {
          id: string
          attempt_id: string
          question_id: string
          question_text_snapshot: string
          category_id: string
          category_name: string
          explanation_snapshot: string | null
          correct_option_id: string
          option_order: Json
          display_order: number
        }
        Insert: Database['public']['Tables']['attempt_questions']['Row']
        Update: Partial<Database['public']['Tables']['attempt_questions']['Insert']>
        Relationships: []
      }
      attempt_answers: {
        Row: {
          id: string
          attempt_question_id: string
          chosen_option_id: string | null
          is_correct: boolean | null
          answered_at: string
        }
        Insert: Database['public']['Tables']['attempt_answers']['Row']
        Update: Partial<Database['public']['Tables']['attempt_answers']['Insert']>
        Relationships: []
      }
    }
    Views: {
      public_categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          accent_color: string
          created_at: string
        }
        Relationships: []
      }
      public_questions: {
        Row: {
          id: string
          category_id: string
          question_text: string
          difficulty: 'easy' | 'medium' | 'hard'
          category_slug: string
        }
        Relationships: []
      }
      public_question_options: {
        Row: {
          id: string
          question_id: string
          option_text: string
          sort_order: number
        }
        Relationships: []
      }
    }
    Functions: {
      create_attempt: {
        Args: {
          cat_filter: string[]
          counts: number[]
          time_limit_min?: number | null
        }
        Returns: unknown
      }
      create_candidate_attempt: {
        Args: {
          p_name: string
          p_email?: string | null
        }
        Returns: unknown
      }
      get_attempt: {
        Args: { a_id: string }
        Returns: unknown
      }
      submit_attempt: {
        Args: { a_id: string; p_answers: unknown; passing_score?: number }
        Returns: unknown
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}