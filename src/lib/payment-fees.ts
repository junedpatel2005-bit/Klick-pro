export const CLIENT_FEE_RATE = 0.1;
export const PROFESSIONAL_FEE_RATE = 0.1;

export function calculateMilestoneMoney(baseAmount: number, customProfessionalFeeRate?: number) {
  const professionalRate =
    typeof customProfessionalFeeRate === "number" &&
    !isNaN(customProfessionalFeeRate) &&
    customProfessionalFeeRate >= 0
      ? customProfessionalFeeRate
      : PROFESSIONAL_FEE_RATE;

  const clientFeeAmount = Math.ceil(baseAmount * CLIENT_FEE_RATE);
  const professionalFeeAmount = Math.ceil(baseAmount * professionalRate);
  const clientChargeAmount = baseAmount + clientFeeAmount;
  const professionalPayoutAmount = Math.max(0, baseAmount - professionalFeeAmount);

  return {
    baseAmount,
    clientFeeAmount,
    professionalFeeAmount,
    clientChargeAmount,
    professionalPayoutAmount,
    adminNetAmount: clientChargeAmount - professionalPayoutAmount,
    commissionRate: professionalRate,
  };
}
