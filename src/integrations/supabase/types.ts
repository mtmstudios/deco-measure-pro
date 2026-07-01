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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acryl_position: {
        Row: {
          beschreibung: string | null
          created_at: string
          daten: Json | null
          id: string
          laenge_m: number | null
          raum_id: string
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          daten?: Json | null
          id?: string
          laenge_m?: number | null
          raum_id: string
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          daten?: Json | null
          id?: string
          laenge_m?: number | null
          raum_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acryl_position_raum_id_fkey"
            columns: ["raum_id"]
            isOneToOne: false
            referencedRelation: "raum"
            referencedColumns: ["id"]
          },
        ]
      }
      benutzer: {
        Row: {
          betrieb_id: string
          created_at: string
          email: string
          id: string
          name: string
          rolle: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          betrieb_id: string
          created_at?: string
          email: string
          id: string
          name: string
          rolle?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          betrieb_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          rolle?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benutzer_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betrieb"
            referencedColumns: ["id"]
          },
        ]
      }
      betrieb: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fehlermeldung: {
        Row: {
          benutzer_id: string | null
          betrieb_id: string | null
          created_at: string
          id: string
          notiz: string
          route: string | null
          screenshots: string[]
          user_agent: string | null
        }
        Insert: {
          benutzer_id?: string | null
          betrieb_id?: string | null
          created_at?: string
          id?: string
          notiz: string
          route?: string | null
          screenshots?: string[]
          user_agent?: string | null
        }
        Update: {
          benutzer_id?: string | null
          betrieb_id?: string | null
          created_at?: string
          id?: string
          notiz?: string
          route?: string | null
          screenshots?: string[]
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fehlermeldung_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betrieb"
            referencedColumns: ["id"]
          },
        ]
      }
      generierte_position: {
        Row: {
          bezeichnung: string
          created_at: string
          daten: Json | null
          einheit: string | null
          einheitspreis: number | null
          id: string
          leistung_id: string | null
          menge: number | null
          projekt_id: string
          raum_id: string | null
          summe: number | null
        }
        Insert: {
          bezeichnung: string
          created_at?: string
          daten?: Json | null
          einheit?: string | null
          einheitspreis?: number | null
          id?: string
          leistung_id?: string | null
          menge?: number | null
          projekt_id: string
          raum_id?: string | null
          summe?: number | null
        }
        Update: {
          bezeichnung?: string
          created_at?: string
          daten?: Json | null
          einheit?: string | null
          einheitspreis?: number | null
          id?: string
          leistung_id?: string | null
          menge?: number | null
          projekt_id?: string
          raum_id?: string | null
          summe?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "generierte_position_leistung_id_fkey"
            columns: ["leistung_id"]
            isOneToOne: false
            referencedRelation: "leistung_katalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generierte_position_projekt_id_fkey"
            columns: ["projekt_id"]
            isOneToOne: false
            referencedRelation: "projekt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generierte_position_raum_id_fkey"
            columns: ["raum_id"]
            isOneToOne: false
            referencedRelation: "raum"
            referencedColumns: ["id"]
          },
        ]
      }
      heizkoerper: {
        Row: {
          abstand_boden_cm: number | null
          bemerkung: string | null
          breite_cm: number | null
          created_at: string
          daten: Json | null
          hoehe_cm: number | null
          id: string
          raum_id: string
          tiefe_cm: number | null
        }
        Insert: {
          abstand_boden_cm?: number | null
          bemerkung?: string | null
          breite_cm?: number | null
          created_at?: string
          daten?: Json | null
          hoehe_cm?: number | null
          id?: string
          raum_id: string
          tiefe_cm?: number | null
        }
        Update: {
          abstand_boden_cm?: number | null
          bemerkung?: string | null
          breite_cm?: number | null
          created_at?: string
          daten?: Json | null
          hoehe_cm?: number | null
          id?: string
          raum_id?: string
          tiefe_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "heizkoerper_raum_id_fkey"
            columns: ["raum_id"]
            isOneToOne: false
            referencedRelation: "raum"
            referencedColumns: ["id"]
          },
        ]
      }
      leistung_katalog: {
        Row: {
          betrieb_id: string
          bezeichnung: string
          code: string
          created_at: string
          einheit: string
          einheitspreis: number | null
          gewerk: string | null
          id: string
        }
        Insert: {
          betrieb_id: string
          bezeichnung: string
          code: string
          created_at?: string
          einheit: string
          einheitspreis?: number | null
          gewerk?: string | null
          id?: string
        }
        Update: {
          betrieb_id?: string
          bezeichnung?: string
          code?: string
          created_at?: string
          einheit?: string
          einheitspreis?: number | null
          gewerk?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leistung_katalog_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betrieb"
            referencedColumns: ["id"]
          },
        ]
      }
      oeffnung: {
        Row: {
          bemerkung: string | null
          breite_cm: number | null
          created_at: string
          daten: Json | null
          hoehe_cm: number | null
          id: string
          raum_id: string
          typ: string
        }
        Insert: {
          bemerkung?: string | null
          breite_cm?: number | null
          created_at?: string
          daten?: Json | null
          hoehe_cm?: number | null
          id?: string
          raum_id: string
          typ: string
        }
        Update: {
          bemerkung?: string | null
          breite_cm?: number | null
          created_at?: string
          daten?: Json | null
          hoehe_cm?: number | null
          id?: string
          raum_id?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "oeffnung_raum_id_fkey"
            columns: ["raum_id"]
            isOneToOne: false
            referencedRelation: "raum"
            referencedColumns: ["id"]
          },
        ]
      }
      projekt: {
        Row: {
          adresse: string | null
          auftrag_nr: string | null
          betrieb_id: string
          created_at: string
          created_by: string | null
          gewerk: string | null
          id: string
          kunde: string
          objekt_bezeichnung: string
          sachbearbeiter: string | null
          status: Database["public"]["Enums"]["projekt_status"]
          uebergeben_at: string | null
          updated_at: string
          verkaeufer: string | null
        }
        Insert: {
          adresse?: string | null
          auftrag_nr?: string | null
          betrieb_id: string
          created_at?: string
          created_by?: string | null
          gewerk?: string | null
          id?: string
          kunde: string
          objekt_bezeichnung: string
          sachbearbeiter?: string | null
          status?: Database["public"]["Enums"]["projekt_status"]
          uebergeben_at?: string | null
          updated_at?: string
          verkaeufer?: string | null
        }
        Update: {
          adresse?: string | null
          auftrag_nr?: string | null
          betrieb_id?: string
          created_at?: string
          created_by?: string | null
          gewerk?: string | null
          id?: string
          kunde?: string
          objekt_bezeichnung?: string
          sachbearbeiter?: string | null
          status?: Database["public"]["Enums"]["projekt_status"]
          uebergeben_at?: string | null
          updated_at?: string
          verkaeufer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projekt_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betrieb"
            referencedColumns: ["id"]
          },
        ]
      }
      raum: {
        Row: {
          bemerkung: string | null
          breite_cm: number | null
          created_at: string
          deckentyp: string | null
          etage: string | null
          geometrie: Json | null
          id: string
          laenge_cm: number | null
          name: string
          projekt_id: string
          raumhoehe_cm: number | null
          reihenfolge: number | null
          updated_at: string
        }
        Insert: {
          bemerkung?: string | null
          breite_cm?: number | null
          created_at?: string
          deckentyp?: string | null
          etage?: string | null
          geometrie?: Json | null
          id?: string
          laenge_cm?: number | null
          name: string
          projekt_id: string
          raumhoehe_cm?: number | null
          reihenfolge?: number | null
          updated_at?: string
        }
        Update: {
          bemerkung?: string | null
          breite_cm?: number | null
          created_at?: string
          deckentyp?: string | null
          etage?: string | null
          geometrie?: Json | null
          id?: string
          laenge_cm?: number | null
          name?: string
          projekt_id?: string
          raumhoehe_cm?: number | null
          reihenfolge?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raum_projekt_id_fkey"
            columns: ["projekt_id"]
            isOneToOne: false
            referencedRelation: "projekt"
            referencedColumns: ["id"]
          },
        ]
      }
      raum_leistung: {
        Row: {
          bezeichnung: string | null
          created_at: string
          daten: Json | null
          einheit: string | null
          id: string
          leistung_id: string | null
          menge: number | null
          raum_id: string
        }
        Insert: {
          bezeichnung?: string | null
          created_at?: string
          daten?: Json | null
          einheit?: string | null
          id?: string
          leistung_id?: string | null
          menge?: number | null
          raum_id: string
        }
        Update: {
          bezeichnung?: string | null
          created_at?: string
          daten?: Json | null
          einheit?: string | null
          id?: string
          leistung_id?: string | null
          menge?: number | null
          raum_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raum_leistung_leistung_id_fkey"
            columns: ["leistung_id"]
            isOneToOne: false
            referencedRelation: "leistung_katalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raum_leistung_raum_id_fkey"
            columns: ["raum_id"]
            isOneToOne: false
            referencedRelation: "raum"
            referencedColumns: ["id"]
          },
        ]
      }
      raum_teilflaeche: {
        Row: {
          bemerkung: string | null
          breite_cm: number | null
          created_at: string
          daten: Json | null
          flaeche_m2: number | null
          hoehe_cm: number | null
          id: string
          laenge_cm: number | null
          raum_id: string
          typ: string
        }
        Insert: {
          bemerkung?: string | null
          breite_cm?: number | null
          created_at?: string
          daten?: Json | null
          flaeche_m2?: number | null
          hoehe_cm?: number | null
          id?: string
          laenge_cm?: number | null
          raum_id: string
          typ: string
        }
        Update: {
          bemerkung?: string | null
          breite_cm?: number | null
          created_at?: string
          daten?: Json | null
          flaeche_m2?: number | null
          hoehe_cm?: number | null
          id?: string
          laenge_cm?: number | null
          raum_id?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "raum_teilflaeche_raum_id_fkey"
            columns: ["raum_id"]
            isOneToOne: false
            referencedRelation: "raum"
            referencedColumns: ["id"]
          },
        ]
      }
      regel: {
        Row: {
          aktiv: boolean
          betrieb_id: string
          created_at: string
          definition: Json
          id: string
          name: string
        }
        Insert: {
          aktiv?: boolean
          betrieb_id: string
          created_at?: string
          definition?: Json
          id?: string
          name: string
        }
        Update: {
          aktiv?: boolean
          betrieb_id?: string
          created_at?: string
          definition?: Json
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "regel_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betrieb"
            referencedColumns: ["id"]
          },
        ]
      }
      uebergabe: {
        Row: {
          created_at: string
          daten: Json | null
          id: string
          projekt_id: string
          uebergeben_am: string
          uebergeben_an: string | null
          uebergeben_von: string | null
        }
        Insert: {
          created_at?: string
          daten?: Json | null
          id?: string
          projekt_id: string
          uebergeben_am?: string
          uebergeben_an?: string | null
          uebergeben_von?: string | null
        }
        Update: {
          created_at?: string
          daten?: Json | null
          id?: string
          projekt_id?: string
          uebergeben_am?: string
          uebergeben_an?: string | null
          uebergeben_von?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uebergabe_projekt_id_fkey"
            columns: ["projekt_id"]
            isOneToOne: false
            referencedRelation: "projekt"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_betrieb_id: { Args: never; Returns: string }
      duplicate_raum: { Args: { p_raum_id: string }; Returns: string }
      upsert_raum_snapshot: { Args: { p: Json }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "mitarbeiter"
      projekt_status: "erfassung" | "geprueft" | "uebergeben" | "fehler"
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
      app_role: ["admin", "mitarbeiter"],
      projekt_status: ["erfassung", "geprueft", "uebergeben", "fehler"],
    },
  },
} as const
