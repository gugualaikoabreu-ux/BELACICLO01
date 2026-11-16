ALTER TABLE "products"
  ADD COLUMN "weightGrams" INTEGER,
  ADD COLUMN "lengthCm" INTEGER,
  ADD COLUMN "widthCm" INTEGER,
  ADD COLUMN "heightCm" INTEGER;

ALTER TABLE "orders"
  ADD COLUMN "shippingServiceCode" TEXT,
  ADD COLUMN "shippingServiceName" TEXT;

INSERT INTO "categories" ("id", "slug", "name", "description", "department", "active", "createdAt")
VALUES ('bc-category-feminina-alfaiataria', 'feminina-alfaiataria', 'Alfaiataria', NULL, 'FEMININA', true, NOW())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "products" ("id", "slug", "name", "department", "description", "category", "categoryId", "price", "promotionalPrice", "active", "demo", "createdAt", "updatedAt")
SELECT 'bc-product-calca-alfaiataria', 'calca-alfaiataria', 'Calça de Alfaiataria', 'FEMININA', 'Calça de alfaiataria com friso.', 'Alfaiataria', c."id", 16800, NULL, false, false, NOW(), NOW()
FROM "categories" c WHERE c."slug" = 'feminina-alfaiataria'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "products" ("id", "slug", "name", "department", "description", "category", "categoryId", "price", "promotionalPrice", "active", "demo", "createdAt", "updatedAt")
SELECT 'bc-product-blazer', 'blazer', 'Blazer', 'FEMININA', 'Blazer.', 'Alfaiataria', c."id", 18800, NULL, false, false, NOW(), NOW()
FROM "categories" c WHERE c."slug" = 'feminina-alfaiataria'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "product_variants" ("id", "productId", "size", "color", "sku", "stock", "reserved", "active", "updatedAt")
SELECT 'bc-variant-' || p."slug" || '-' || s.size, p."id", s.size, NULL, NULL, 0, 0, true, NOW()
FROM "products" p
CROSS JOIN (VALUES ('P'), ('M'), ('G'), ('XG')) AS s(size)
WHERE p."slug" IN ('calca-alfaiataria', 'blazer')
ON CONFLICT ("id") DO NOTHING;
