// Types for every table in supabase/migrations/001_initial_schema.sql.
//
// Written as `type` aliases rather than `interface`s on purpose: supabase-js
// requires each Row/Insert/Update to be assignable to Record<string, unknown>,
// which interfaces are not, and the typed client silently degrades to `never`.
//
// Column mapping:
//   uuid, text, timestamptz -> string (timestamps arrive as ISO 8601 strings)
//   int, numeric            -> number
//   jsonb                   -> Json
//   vector(1536)            -> string (PostgREST returns pgvector as "[0.1,0.2,...]")
// Text columns with documented values use the unions from ./enums.

import type {
  ChunkType,
  EquipmentType,
  PlanTier,
  ReadingType,
  ReadingUnit,
  RefrigerantType,
  SessionStatus,
  StepStatus,
  TechnicianRole,
} from './enums';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// 1. organizations
export type Organization = {
  id: string;
  name: string;
  plan_tier: PlanTier;
  created_at: string;
};
export type OrganizationInsert = {
  id?: string;
  name: string;
  plan_tier?: PlanTier;
  created_at?: string;
};
export type OrganizationUpdate = Partial<OrganizationInsert>;

// 2. technicians (id = auth.users.id)
export type Technician = {
  id: string;
  org_id: string | null;
  full_name: string;
  role: TechnicianRole;
  experience_years: number | null;
  created_at: string;
};
export type TechnicianInsert = {
  id: string;
  org_id?: string | null;
  full_name: string;
  role?: TechnicianRole;
  experience_years?: number | null;
  created_at?: string;
};
export type TechnicianUpdate = Partial<TechnicianInsert>;

// 3. equipment_units
export type EquipmentUnit = {
  id: string;
  org_id: string | null;
  manufacturer: string;
  model_number: string;
  serial_number: string | null;
  equipment_type: EquipmentType;
  refrigerant_type: RefrigerantType | null;
  tonnage: number | null;
  data_plate_image_url: string | null;
  created_at: string;
};
export type EquipmentUnitInsert = {
  id?: string;
  org_id?: string | null;
  manufacturer: string;
  model_number: string;
  serial_number?: string | null;
  equipment_type: EquipmentType;
  refrigerant_type?: RefrigerantType | null;
  tonnage?: number | null;
  data_plate_image_url?: string | null;
  created_at?: string;
};
export type EquipmentUnitUpdate = Partial<EquipmentUnitInsert>;

// 4. service_sessions
export type ServiceSession = {
  id: string;
  org_id: string | null;
  tech_id: string | null;
  equipment_id: string | null;
  reported_symptom: string;
  status: SessionStatus;
  current_step_index: number;
  safety_disconnect_verified: boolean;
  confirmed_root_cause: string | null;
  parts_replaced: Json | null;
  ai_summary_report: string | null;
  started_at: string;
  completed_at: string | null;
};
export type ServiceSessionInsert = {
  id?: string;
  org_id?: string | null;
  tech_id?: string | null;
  equipment_id?: string | null;
  reported_symptom: string;
  status?: SessionStatus;
  current_step_index?: number;
  safety_disconnect_verified?: boolean;
  confirmed_root_cause?: string | null;
  parts_replaced?: Json | null;
  ai_summary_report?: string | null;
  started_at?: string;
  completed_at?: string | null;
};
export type ServiceSessionUpdate = Partial<ServiceSessionInsert>;

// 5. diagnostic_steps
export type DiagnosticStep = {
  id: string;
  session_id: string | null;
  step_number: number;
  instruction: string;
  expected_target: string | null;
  tech_observation: string | null;
  captured_frame_url: string | null;
  status: StepStatus;
  created_at: string;
};
export type DiagnosticStepInsert = {
  id?: string;
  session_id?: string | null;
  step_number: number;
  instruction: string;
  expected_target?: string | null;
  tech_observation?: string | null;
  captured_frame_url?: string | null;
  status?: StepStatus;
  created_at?: string;
};
export type DiagnosticStepUpdate = Partial<DiagnosticStepInsert>;

// 6. diagnostic_readings
export type DiagnosticReading = {
  id: string;
  session_id: string | null;
  reading_type: ReadingType;
  numeric_value: number;
  unit: ReadingUnit;
  is_within_spec: boolean | null;
  recorded_at: string;
};
export type DiagnosticReadingInsert = {
  id?: string;
  session_id?: string | null;
  reading_type: ReadingType;
  numeric_value: number;
  unit: ReadingUnit;
  is_within_spec?: boolean | null;
  recorded_at?: string;
};
export type DiagnosticReadingUpdate = Partial<DiagnosticReadingInsert>;

// 7. oem_knowledge_chunks
export type OemKnowledgeChunk = {
  id: string;
  manufacturer: string;
  model_prefix: string;
  chunk_type: ChunkType;
  content: string;
  embedding: string | null;
  created_at: string;
};
export type OemKnowledgeChunkInsert = {
  id?: string;
  manufacturer: string;
  model_prefix: string;
  chunk_type: ChunkType;
  content: string;
  embedding?: string | null;
  created_at?: string;
};
export type OemKnowledgeChunkUpdate = Partial<OemKnowledgeChunkInsert>;

type Fk<Name extends string, Column extends string, Ref extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ['id'];
};

// Shape consumed by createClient<Database>() for typed queries and embeds.
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.17';
  };
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: OrganizationInsert;
        Update: OrganizationUpdate;
        Relationships: [];
      };
      technicians: {
        Row: Technician;
        Insert: TechnicianInsert;
        Update: TechnicianUpdate;
        Relationships: [Fk<'technicians_org_id_fkey', 'org_id', 'organizations'>];
      };
      equipment_units: {
        Row: EquipmentUnit;
        Insert: EquipmentUnitInsert;
        Update: EquipmentUnitUpdate;
        Relationships: [Fk<'equipment_units_org_id_fkey', 'org_id', 'organizations'>];
      };
      service_sessions: {
        Row: ServiceSession;
        Insert: ServiceSessionInsert;
        Update: ServiceSessionUpdate;
        Relationships: [
          Fk<'service_sessions_org_id_fkey', 'org_id', 'organizations'>,
          Fk<'service_sessions_tech_id_fkey', 'tech_id', 'technicians'>,
          Fk<'service_sessions_equipment_id_fkey', 'equipment_id', 'equipment_units'>,
        ];
      };
      diagnostic_steps: {
        Row: DiagnosticStep;
        Insert: DiagnosticStepInsert;
        Update: DiagnosticStepUpdate;
        Relationships: [Fk<'diagnostic_steps_session_id_fkey', 'session_id', 'service_sessions'>];
      };
      diagnostic_readings: {
        Row: DiagnosticReading;
        Insert: DiagnosticReadingInsert;
        Update: DiagnosticReadingUpdate;
        Relationships: [Fk<'diagnostic_readings_session_id_fkey', 'session_id', 'service_sessions'>];
      };
      oem_knowledge_chunks: {
        Row: OemKnowledgeChunk;
        Insert: OemKnowledgeChunkInsert;
        Update: OemKnowledgeChunkUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableName = keyof Database['public']['Tables'];
