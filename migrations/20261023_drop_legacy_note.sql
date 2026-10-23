CREATE TABLE IF NOT EXISTS rsk0_proof_scratch (id int, legacy_note text);
ALTER TABLE rsk0_proof_scratch DROP COLUMN IF EXISTS legacy_note;
