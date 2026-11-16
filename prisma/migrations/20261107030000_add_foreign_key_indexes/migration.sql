-- Add covering indexes for foreign-key lookups that are not already the
-- leading columns of another index.
CREATE INDEX "favorites_productId_idx" ON "favorites"("productId");
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");
CREATE INDEX "product_relations_relatedId_idx" ON "product_relations"("relatedId");
CREATE INDEX "stock_reservations_variantId_idx" ON "stock_reservations"("variantId");
