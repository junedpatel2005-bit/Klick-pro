// Platform commission is deducted from the professional payout when enabled by Admin.
// Client service fees have been eliminated: clients are charged strictly the milestone amount.
export const CLIENT_FEE_RATE = 0;
export const PROFESSIONAL_FEE_RATE = 0.1;

export function calculateMilestoneMoney(
  baseAmount: number,
  customProfessionalFeeRate?: number,
  customClientFeeRate?: number,
) {
  const isZeroCommission = customProfessionalFeeRate === 0;

  const professionalRate =
    typeof customProfessionalFeeRate === "number" &&
    !isNaN(customProfessionalFeeRate) &&
    customProfessionalFeeRate >= 0
      ? customProfessionalFeeRate
      : (isZeroCommission ? 0 : 0);

  const clientRate =
    typeof customClientFeeRate === "number" &&
    !isNaN(customClientFeeRate) &&
    customClientFeeRate >= 0
      ? customClientFeeRate
      : 0;

  const clientFeeAmount = Math.ceil(baseAmount * clientRate);
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
