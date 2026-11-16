-- The public catalog needs to know which variants exist, but not exact stock counts.
-- Keep inventory and reservation totals private to trusted server-side database access.
REVOKE SELECT ("stock", "reserved", "updatedAt")
  ON TABLE public.product_variants
  FROM anon, authenticated;
