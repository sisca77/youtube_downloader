import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: 'user' | 'admin';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
      };
      video_tasks: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          file_name: string | null;
          youtube_url: string | null;
          status: 'processing' | 'completed' | 'failed';
          progress: number;
          transcript: string | null;
          outline: string | null;
          detailed_explanation: string | null;
          metadata: any | null;
          summary_ratio: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          file_name?: string | null;
          youtube_url?: string | null;
          status?: 'processing' | 'completed' | 'failed';
          progress?: number;
          transcript?: string | null;
          outline?: string | null;
          detailed_explanation?: string | null;
          metadata?: any | null;
          summary_ratio?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          file_name?: string | null;
          youtube_url?: string | null;
          status?: 'processing' | 'completed' | 'failed';
          progress?: number;
          transcript?: string | null;
          outline?: string | null;
          detailed_explanation?: string | null;
          metadata?: any | null;
          summary_ratio?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};