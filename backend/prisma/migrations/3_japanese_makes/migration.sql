-- Every Japanese make, not only Toyota and Lexus (CLAUDE.md section 2, decided 2026-10-23).
-- Make codes are only ever added (src/domain/sku.ts), so every existing row still passes.
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_make_check",
    ADD CONSTRAINT "vehicles_make_check" CHECK (make in ('toyota', 'lexus', 'honda', 'acura', 'nissan', 'infiniti', 'mazda', 'mitsubishi', 'subaru', 'suzuki', 'isuzu', 'daihatsu'));

-- Same expression as SKU_PATTERN in src/domain/sku.ts.
ALTER TABLE "parts" DROP CONSTRAINT "parts_sku_format",
    ADD CONSTRAINT "parts_sku_format" CHECK (sku ~ '^DCR-(TOY|LEX|HON|ACU|NIS|INF|MAZ|MIT|SUB|SUZ|ISU|DAI)-[A-Z0-9]+-[A-Z0-9]+[FP]-[A-Z]{2}-[A-Z]{1,2}-(BA|BB|BC|NG|NA)(-U[0-9]{2})?$');
