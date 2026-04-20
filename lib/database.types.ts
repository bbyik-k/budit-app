export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      conflict_rules: {
        Row: {
          a_type: string;
          b_type: string;
          conflict_type: string;
          created_at: string;
          id: string;
          ingredient_a: string;
          ingredient_b: string;
          reason_ko: string;
          recommend: string | null;
          severity: string | null;
          source: string | null;
          updated_at: string;
        };
        Insert: {
          a_type: string;
          b_type: string;
          conflict_type: string;
          created_at?: string;
          id?: string;
          ingredient_a: string;
          ingredient_b: string;
          reason_ko: string;
          recommend?: string | null;
          severity?: string | null;
          source?: string | null;
          updated_at?: string;
        };
        Update: {
          a_type?: string;
          b_type?: string;
          conflict_type?: string;
          created_at?: string;
          id?: string;
          ingredient_a?: string;
          ingredient_b?: string;
          reason_ko?: string;
          recommend?: string | null;
          severity?: string | null;
          source?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ingredient_aliases: {
        Row: {
          alias: string;
          created_at: string;
          id: string;
          ingredient_id: string;
          source: string;
        };
        Insert: {
          alias: string;
          created_at?: string;
          id?: string;
          ingredient_id: string;
          source?: string;
        };
        Update: {
          alias?: string;
          created_at?: string;
          id?: string;
          ingredient_id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_group_members: {
        Row: {
          group_id: string;
          id: string;
          ingredient_id: string;
        };
        Insert: {
          group_id: string;
          id?: string;
          ingredient_id: string;
        };
        Update: {
          group_id?: string;
          id?: string;
          ingredient_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "ingredient_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredient_group_members_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_groups: {
        Row: {
          created_at: string;
          description: string | null;
          group_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          group_name: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          group_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      ingredients: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          is_restricted: boolean;
          name: string;
          name_en: string | null;
          restrict_info: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          is_restricted?: boolean;
          name: string;
          name_en?: string | null;
          restrict_info?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          is_restricted?: boolean;
          name?: string;
          name_en?: string | null;
          restrict_info?: string | null;
        };
        Relationships: [];
      };
      product_ingredients: {
        Row: {
          display_order: number;
          id: string;
          ingredient_id: string;
          product_id: string;
          raw_name: string;
        };
        Insert: {
          display_order: number;
          id?: string;
          ingredient_id: string;
          product_id: string;
          raw_name: string;
        };
        Update: {
          display_order?: number;
          id?: string;
          ingredient_id?: string;
          product_id?: string;
          raw_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          brand: string;
          category: string;
          created_at: string;
          id: string;
          image_url: string | null;
          name: string;
          oliveyoung_id: string | null;
          oliveyoung_rank: number | null;
          raw_ingredients_text: string | null;
          source_url: string | null;
          updated_at: string;
        };
        Insert: {
          brand: string;
          category: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name: string;
          oliveyoung_id?: string | null;
          oliveyoung_rank?: number | null;
          raw_ingredients_text?: string | null;
          source_url?: string | null;
          updated_at?: string;
        };
        Update: {
          brand?: string;
          category?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
          oliveyoung_id?: string | null;
          oliveyoung_rank?: number | null;
          raw_ingredients_text?: string | null;
          source_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      unmatched_log: {
        Row: {
          created_at: string;
          id: string;
          occurrence_count: number;
          product_id: string | null;
          raw_name: string;
          resolved: boolean;
          source: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          occurrence_count?: number;
          product_id?: string | null;
          raw_name: string;
          resolved?: boolean;
          source?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          occurrence_count?: number;
          product_id?: string | null;
          raw_name?: string;
          resolved?: boolean;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unmatched_log_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      log_unmatched: {
        Args: { p_product_id: string; p_raw_name: string };
        Returns: undefined;
      };
      match_ingredient_fuzzy: {
        Args: { term: string; threshold: number };
        Returns: {
          ingredient_id: string;
          name: string;
          similarity: number;
        }[];
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
