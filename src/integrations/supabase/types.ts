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
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      import_job_errors: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          job_id: string
          message: string | null
          raw_row: Json | null
          row_number: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          message?: string | null
          raw_row?: Json | null
          row_number?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          message?: string | null
          raw_row?: Json | null
          row_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_job_errors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_errors_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_path: string
          id: string
          marketplace: string | null
          processed_rows: number | null
          started_at: string | null
          stats: Json | null
          status: string
          total_rows: number | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path: string
          id?: string
          marketplace?: string | null
          processed_rows?: number | null
          started_at?: string | null
          stats?: Json | null
          status?: string
          total_rows?: number | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string
          id?: string
          marketplace?: string | null
          processed_rows?: number | null
          started_at?: string | null
          stats?: Json | null
          status?: string
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_accounts: {
        Row: {
          access_token: string | null
          company_id: string
          connected_at: string | null
          id: string
          marketplace: string
          meta: Json | null
          refresh_token: string | null
        }
        Insert: {
          access_token?: string | null
          company_id: string
          connected_at?: string | null
          id?: string
          marketplace: string
          meta?: Json | null
          refresh_token?: string | null
        }
        Update: {
          access_token?: string | null
          company_id?: string
          connected_at?: string | null
          id?: string
          marketplace?: string
          meta?: Json | null
          refresh_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_lines_staging: {
        Row: {
          address: string | null
          buyer_name: string | null
          company_id: string | null
          created_at: string
          external_order_id: string | null
          id: string
          item_name: string | null
          job_id: string
          line_hash: string
          marketplace: string | null
          processed: boolean | null
          qty: number | null
          raw_data: Json | null
          recipient_name: string | null
          sku: string | null
          tracking_code: string | null
          variation: string | null
        }
        Insert: {
          address?: string | null
          buyer_name?: string | null
          company_id?: string | null
          created_at?: string
          external_order_id?: string | null
          id?: string
          item_name?: string | null
          job_id: string
          line_hash: string
          marketplace?: string | null
          processed?: boolean | null
          qty?: number | null
          raw_data?: Json | null
          recipient_name?: string | null
          sku?: string | null
          tracking_code?: string | null
          variation?: string | null
        }
        Update: {
          address?: string | null
          buyer_name?: string | null
          company_id?: string | null
          created_at?: string
          external_order_id?: string | null
          id?: string
          item_name?: string | null
          job_id?: string
          line_hash?: string
          marketplace?: string | null
          processed?: boolean | null
          qty?: number | null
          raw_data?: Json | null
          recipient_name?: string | null
          sku?: string | null
          tracking_code?: string | null
          variation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_lines_staging_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_lines_staging_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          company_id: string
          id: string
          order_id: string
          qty: number
          variant_id: string | null
        }
        Insert: {
          company_id: string
          id?: string
          order_id: string
          qty?: number
          variant_id?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          order_id?: string
          qty?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_summary: string | null
          company_id: string
          created_at: string
          customer_name: string | null
          external_order_id: string | null
          id: string
          marketplace: string | null
          status: string
        }
        Insert: {
          address_summary?: string | null
          company_id: string
          created_at?: string
          customer_name?: string | null
          external_order_id?: string | null
          id?: string
          marketplace?: string | null
          status?: string
        }
        Update: {
          address_summary?: string | null
          company_id?: string
          created_at?: string
          customer_name?: string | null
          external_order_id?: string | null
          id?: string
          marketplace?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          company_id: string
          id: string
          package_id: string
          qty: number
          variant_id: string | null
        }
        Insert: {
          company_id: string
          id?: string
          package_id: string
          qty?: number
          variant_id?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          package_id?: string
          qty?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_scanned_at: string | null
          order_id: string
          package_number: number
          scan_code: string | null
          status: string
          tracking_code: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_scanned_at?: string | null
          order_id: string
          package_number?: number
          scan_code?: string | null
          status?: string
          tracking_code?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_scanned_at?: string | null
          order_id?: string
          package_number?: number
          scan_code?: string | null
          status?: string
          tracking_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json | null
          company_id: string
          created_at: string
          id: string
          product_id: string
          sku: string | null
          variant_name: string | null
        }
        Insert: {
          attributes?: Json | null
          company_id: string
          created_at?: string
          id?: string
          product_id: string
          sku?: string | null
          variant_name?: string | null
        }
        Update: {
          attributes?: Json | null
          company_id?: string
          created_at?: string
          id?: string
          product_id?: string
          sku?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_sku: string | null
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          base_sku?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          base_sku?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          name: string | null
          role: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id: string
          name?: string | null
          role?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          meta: Json | null
          package_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          meta?: Json | null
          package_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          meta?: Json | null
          package_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: never; Returns: string }
      increment_processed_rows: {
        Args: { count: number; inc_job_id: string }
        Returns: undefined
      }
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
