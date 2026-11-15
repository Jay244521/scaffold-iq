"use client";

import { EVIDENCE_BUCKET } from "@/lib/env";
import { MAX_FILES_PER_BATCH, checkEvidenceFile, evidencePath } from "@/lib/evidence";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { registerEvidence } from "./actions";

/** Client-side pre-check (the server re-checks everything). Returns error messages. */
export function precheckFiles(files: File[]): string[] {
  const errors = files.map((f) => checkEvidenceFile(f.name, f.type, f.size)).flatMap((c) => (c.ok ? [] : [c.error]));
  if (files.length > MAX_FILES_PER_BATCH) errors.unshift(`Attach up to ${MAX_FILES_PER_BATCH} files at a time.`);
  return errors;
}

/**
 * Uploads files straight to private storage under the user's own session (storage
 * policies check membership), then asks the server to verify and record each one.
 */
export async function uploadEvidence(orgId: string, incidentId: string, files: File[], onProgress?: (done: number) => void) {
  const supabase = getBrowserSupabase();
  const errors: string[] = [];
  let done = 0;
  for (const file of files) {
    const path = evidencePath(orgId, incidentId, crypto.randomUUID(), file.name);
    const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      errors.push(`${file.name}: upload failed. ${/size|large/i.test(error.message) ? "File is too large." : "Please try again."}`);
    } else {
      const res = await registerEvidence(incidentId, path, file.name);
      if (res.error) errors.push(res.error);
    }
    onProgress?.(++done);
  }
  return { uploaded: files.length - errors.length, errors };
}
