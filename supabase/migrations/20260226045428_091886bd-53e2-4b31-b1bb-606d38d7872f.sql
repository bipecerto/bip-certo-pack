
-- Unique constraint for products upsert
ALTER TABLE public.products ADD CONSTRAINT products_company_id_name_key UNIQUE (company_id, name);

-- Unique constraint for product_variants upsert
ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_company_id_sku_key UNIQUE (company_id, sku);

-- Unique constraint for order_items upsert
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_variant_id_key UNIQUE (order_id, variant_id);

-- Unique constraint for package_items upsert
ALTER TABLE public.package_items ADD CONSTRAINT package_items_package_id_variant_id_key UNIQUE (package_id, variant_id);
