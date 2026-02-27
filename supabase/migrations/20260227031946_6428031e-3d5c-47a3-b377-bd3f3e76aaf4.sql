
-- Add unique constraints for order_items and package_items upserts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_variant_unique') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_variant_unique UNIQUE (order_id, variant_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'package_items_package_variant_unique') THEN
    ALTER TABLE public.package_items ADD CONSTRAINT package_items_package_variant_unique UNIQUE (package_id, variant_id);
  END IF;
END $$;
