import { z } from 'zod';

// Allowed values for the text columns that 001_initial_schema.sql documents in
// comments. The database does not enforce these yet (no CHECK constraints), so
// these are the app's source of truth. Each zod schema can validate AI output
// or form input before it is written.

export const PLAN_TIERS = ['pilot', 'pro', 'enterprise'] as const;
export const PlanTierSchema = z.enum(PLAN_TIERS);
export type PlanTier = z.infer<typeof PlanTierSchema>;

export const TECHNICIAN_ROLES = ['apprentice', 'tech', 'lead_tech', 'admin'] as const;
export const TechnicianRoleSchema = z.enum(TECHNICIAN_ROLES);
export type TechnicianRole = z.infer<typeof TechnicianRoleSchema>;

export const EQUIPMENT_TYPES = ['split_ac', 'heat_pump', 'gas_furnace', 'rtu'] as const;
export const EquipmentTypeSchema = z.enum(EQUIPMENT_TYPES);
export type EquipmentType = z.infer<typeof EquipmentTypeSchema>;

export const REFRIGERANT_TYPES = ['R-410A', 'R-454B', 'R-32', 'R-22'] as const;
export const RefrigerantTypeSchema = z.enum(REFRIGERANT_TYPES);
export type RefrigerantType = z.infer<typeof RefrigerantTypeSchema>;

export const SESSION_STATUSES = ['in_progress', 'escalated', 'completed'] as const;
export const SessionStatusSchema = z.enum(SESSION_STATUSES);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const STEP_STATUSES = ['pending', 'passed', 'failed', 'skipped'] as const;
export const StepStatusSchema = z.enum(STEP_STATUSES);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const READING_TYPES = [
  'suction_psi',
  'liquid_psi',
  'superheat',
  'subcooling',
  'amp_draw',
  'voltage',
  'static_pressure',
] as const;
export const ReadingTypeSchema = z.enum(READING_TYPES);
export type ReadingType = z.infer<typeof ReadingTypeSchema>;

export const READING_UNITS = ['psi', 'degF', 'amps', 'volts', 'inWC'] as const;
export const ReadingUnitSchema = z.enum(READING_UNITS);
export type ReadingUnit = z.infer<typeof ReadingUnitSchema>;

export const CHUNK_TYPES = ['error_code', 'wiring_spec', 'charging_chart', 'sequence_of_ops'] as const;
export const ChunkTypeSchema = z.enum(CHUNK_TYPES);
export type ChunkType = z.infer<typeof ChunkTypeSchema>;
