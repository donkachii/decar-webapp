// SKU convention (CLAUDE.md section 5):
//
//   DCR-{MAKE}-{MODEL}-{GEN}{F|P}-{TYPE}-{POS}-{COND}[-U##]
//
// The locked code tables and buildSku live in backend/app/domain/sku.py. The
// frontend only needs to recognise a SKU in a URL or cart line.

export const SKU_PATTERN =
  /^DCR-(TOY|LEX)-([A-Z0-9]+)-([A-Z0-9]+)([FP])-([A-Z]{2})-([A-Z]{1,2})-(BA|BB|BC|NG|NA)(?:-U(\d{2}))?$/;

export function isValidSku(sku: string): boolean {
  return SKU_PATTERN.test(sku);
}

/** Normalises a SKU from a URL segment. Returns null when it cannot be a SKU. */
export function normaliseSku(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const sku = decoded.trim().toUpperCase();
  return isValidSku(sku) ? sku : null;
}
