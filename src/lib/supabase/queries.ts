import type { ApexSupabaseClient } from './client';
import type {
  DiagnosticReading,
  DiagnosticReadingInsert,
  DiagnosticStep,
  DiagnosticStepInsert,
  DiagnosticStepUpdate,
  EquipmentUnit,
  ServiceSession,
  ServiceSessionUpdate,
  Technician,
} from './database.types';

// Thin, typed wrappers around the coaching-loop tables. Each one throws the
// Supabase error rather than returning { data, error }, so callers can use
// try/catch. All run as the signed-in technician and are limited by RLS.

export type SessionDetails = ServiceSession & {
  equipment_units: EquipmentUnit | null;
  diagnostic_steps: DiagnosticStep[];
  diagnostic_readings: DiagnosticReading[];
};

/** The technician row for the signed-in user, or null if signed out / not onboarded. */
export async function getCurrentTechnician(db: ApexSupabaseClient): Promise<Technician | null> {
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) return null;

  const { data, error } = await db.from('technicians').select('*').eq('id', auth.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Opens a new coaching session for the signed-in technician in their org. */
export async function startServiceSession(
  db: ApexSupabaseClient,
  input: { reportedSymptom: string; equipmentId?: string | null },
): Promise<ServiceSession> {
  const tech = await getCurrentTechnician(db);
  if (!tech?.org_id) throw new Error('Signed-in user is not a technician in an organization.');

  const { data, error } = await db
    .from('service_sessions')
    .insert({
      org_id: tech.org_id,
      tech_id: tech.id,
      equipment_id: input.equipmentId ?? null,
      reported_symptom: input.reportedSymptom,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** A session with its equipment, steps (in order) and readings (oldest first). */
export async function getSessionDetails(db: ApexSupabaseClient, sessionId: string): Promise<SessionDetails | null> {
  const { data, error } = await db
    .from('service_sessions')
    .select('*, equipment_units(*), diagnostic_steps(*), diagnostic_readings(*)')
    .eq('id', sessionId)
    .order('step_number', { referencedTable: 'diagnostic_steps' })
    .order('recorded_at', { referencedTable: 'diagnostic_readings' })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateServiceSession(
  db: ApexSupabaseClient,
  sessionId: string,
  patch: ServiceSessionUpdate,
): Promise<ServiceSession> {
  const { data, error } = await db.from('service_sessions').update(patch).eq('id', sessionId).select().single();
  if (error) throw error;
  return data;
}

/** Marks the session completed with its root cause and timestamp. */
export function completeServiceSession(
  db: ApexSupabaseClient,
  sessionId: string,
  result: { confirmedRootCause: string; partsReplaced?: string[]; aiSummaryReport?: string },
): Promise<ServiceSession> {
  return updateServiceSession(db, sessionId, {
    status: 'completed',
    confirmed_root_cause: result.confirmedRootCause,
    parts_replaced: result.partsReplaced ?? [],
    ai_summary_report: result.aiSummaryReport ?? null,
    completed_at: new Date().toISOString(),
  });
}

export async function addDiagnosticStep(db: ApexSupabaseClient, step: DiagnosticStepInsert): Promise<DiagnosticStep> {
  const { data, error } = await db.from('diagnostic_steps').insert(step).select().single();
  if (error) throw error;
  return data;
}

export async function updateDiagnosticStep(
  db: ApexSupabaseClient,
  stepId: string,
  patch: DiagnosticStepUpdate,
): Promise<DiagnosticStep> {
  const { data, error } = await db.from('diagnostic_steps').update(patch).eq('id', stepId).select().single();
  if (error) throw error;
  return data;
}

export async function recordReading(
  db: ApexSupabaseClient,
  reading: DiagnosticReadingInsert,
): Promise<DiagnosticReading> {
  const { data, error } = await db.from('diagnostic_readings').insert(reading).select().single();
  if (error) throw error;
  return data;
}
