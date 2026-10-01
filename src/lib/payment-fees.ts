// The platform takes a fee from both sides of the deal. These are separate
// rates, not halves of one number: CLIENT_FEE_RATE is charged to the client and
// PROFESSIONAL_FEE_RATE is the fallback for the professional side (overridable by
// the `commission_rate` platform setting). At 0.1 each the platform keeps 20% in
// total on a milestone.
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
