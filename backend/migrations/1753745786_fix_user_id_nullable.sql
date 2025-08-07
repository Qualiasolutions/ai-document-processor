-- Migration: fix_user_id_nullable
-- Created at: 1753745786

ALTER TABLE documents ALTER COLUMN user_id DROP NOT NULL;;