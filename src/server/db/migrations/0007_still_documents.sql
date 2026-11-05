-- Blocks v1 -> STILL document (SPEC §11.8). Rows with a "blocks" key are converted; others are left alone.
CREATE FUNCTION pg_temp.still_doc(doc jsonb, ex_id uuid) RETURNS jsonb AS $$
  SELECT jsonb_build_object('version', 1, 'type', 'doc', 'content', COALESCE(jsonb_agg(
    CASE b.value->>'type'
      WHEN 'heading' THEN jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('id', 'n' || b.n, 'level', 2))
        || CASE WHEN b.value->>'text' <> '' THEN jsonb_build_object('content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', b.value->>'text'))) ELSE '{}'::jsonb END
      WHEN 'paragraph' THEN jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', 'n' || b.n))
        || CASE WHEN b.value->>'text' <> '' THEN jsonb_build_object('content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', b.value->>'text'))) ELSE '{}'::jsonb END
      WHEN 'image' THEN jsonb_build_object('type', 'stillImage', 'attrs', jsonb_build_object('id', 'n' || b.n, 'imageId', b.value->>'imageId', 'display', 'INLINE', 'caption', null))
      ELSE jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', 'n' || b.n), 'content', jsonb_build_array(jsonb_build_object(
        'type', 'text', 'text', COALESCE((SELECT s.content FROM guide_sentences s WHERE s.id = (b.value->>'sentenceId')::uuid AND s.exhibition_id = ex_id), ''),
        'marks', jsonb_build_array(jsonb_build_object('type', 'scrap', 'attrs', jsonb_build_object('sentenceId', b.value->>'sentenceId'))))))
    END ORDER BY b.n), '[]'::jsonb))
  FROM jsonb_array_elements(doc->'blocks') WITH ORDINALITY AS b(value, n)
$$ LANGUAGE sql;--> statement-breakpoint
UPDATE exhibitions SET description = pg_temp.still_doc(description, id) WHERE description ? 'blocks';--> statement-breakpoint
UPDATE exhibitions SET guide = pg_temp.still_doc(guide, id) WHERE guide ? 'blocks';
