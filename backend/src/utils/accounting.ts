const MONEY_SCALE = 100;

/** Round book values to the currency precision stored by TekBooks. */
export function roundMoney(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;
}

export function sumMoney(values: unknown[]) {
  return roundMoney(values.reduce<number>((total, value) => total + Number(value || 0), 0));
}

export function invoicePaymentState(totalValue: unknown, paidValue: unknown) {
  const total = roundMoney(totalValue);
  const paidAmount = Math.min(total, Math.max(0, roundMoney(paidValue)));
  const balance = roundMoney(Math.max(0, total - paidAmount));
  const status = balance <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
  return { paidAmount, balance, status } as const;
}
