export const CLIENT_FEE_RATE = 0.1;
export const PROFESSIONAL_FEE_RATE = 0.1;

export function calculateMilestoneMoney(baseAmount: number) {
  const clientFeeAmount = Math.ceil(baseAmount * CLIENT_FEE_RATE);
  const professionalFeeAmount = Math.ceil(baseAmount * PROFESSIONAL_FEE_RATE);
  const clientChargeAmount = baseAmount + clientFeeAmount;
  const professionalPayoutAmount = Math.max(0, baseAmount - professionalFeeAmount);

  return {
    baseAmount,
    clientFeeAmount,
    professionalFeeAmount,
    clientChargeAmount,
    professionalPayoutAmount,
    adminNetAmount: clientChargeAmount - professionalPayoutAmount,
  };
}
