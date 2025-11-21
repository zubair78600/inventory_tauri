const STATE_CODE_EXCEPTIONS = ['JK', 'LD'];

export function formatINR(amount: number): string {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  });
  return formatter.format(amount);
}

export function computeGST(params: {
  subtotal: number;
  gstRate: number;
  originState?: string | null;
  destinationState?: string | null;
}) {
  const { subtotal, gstRate, originState, destinationState } = params;
  const normalizedOrigin = originState?.toUpperCase().trim();
  const normalizedDest = destinationState?.toUpperCase().trim();
  const isSameState =
    normalizedOrigin &&
    normalizedDest &&
    normalizedOrigin === normalizedDest &&
    !STATE_CODE_EXCEPTIONS.includes(normalizedOrigin);

  const gstAmount = subtotal * (gstRate / 100);
  if (isSameState) {
    const half = gstAmount / 2;
    return {
      gstAmount,
      cgst: half,
      sgst: half,
      igst: 0,
    };
  }

  return {
    gstAmount,
    cgst: 0,
    sgst: 0,
    igst: gstAmount,
  };
}
