export type CityCoordinate = { lat: number; lng: number };

export const INDIAN_CITY_COORDINATES: Record<string, CityCoordinate> = {
  // Gujarat
  surat: { lat: 21.1702, lng: 72.8311 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  rajkot: { lat: 22.3039, lng: 70.8022 },
  bhavnagar: { lat: 21.7645, lng: 72.1519 },
  jamnagar: { lat: 22.4707, lng: 70.0577 },
  gandhinagar: { lat: 23.2156, lng: 72.6369 },
  anand: { lat: 22.5645, lng: 72.9289 },
  bharuch: { lat: 21.7051, lng: 72.9959 },
  navsari: { lat: 20.9467, lng: 72.952 },
  valsad: { lat: 20.5992, lng: 72.9342 },
  vapi: { lat: 20.3893, lng: 72.9106 },
  junagadh: { lat: 21.5222, lng: 70.4579 },
  mehsana: { lat: 23.588, lng: 72.3693 },

  // Maharashtra
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  nashik: { lat: 19.9975, lng: 73.7898 },
  aurangabad: { lat: 19.8762, lng: 75.3433 },
  chhatrapatisambhajinagar: { lat: 19.8762, lng: 75.3433 },
  thane: { lat: 19.2183, lng: 72.9781 },
  navimumbai: { lat: 19.033, lng: 73.0297 },
  kolhapur: { lat: 16.705, lng: 74.2433 },
  solapur: { lat: 17.6599, lng: 75.9064 },
  amravati: { lat: 20.9374, lng: 77.7796 },

  // Delhi NCR
  delhi: { lat: 28.7041, lng: 77.1025 },
  newdelhi: { lat: 28.6139, lng: 77.209 },
  noida: { lat: 28.5355, lng: 77.391 },
  greaternoida: { lat: 28.4744, lng: 77.504 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  faridabad: { lat: 28.4089, lng: 77.3178 },
  ghaziabad: { lat: 28.6692, lng: 77.4538 },

  // Karnataka
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  mysuru: { lat: 12.2958, lng: 76.6394 },
  mysore: { lat: 12.2958, lng: 76.6394 },
  mangaluru: { lat: 12.9141, lng: 74.856 },
  hubballi: { lat: 15.3647, lng: 75.124 },
  belagavi: { lat: 15.8497, lng: 74.4977 },

  // Tamil Nadu
  chennai: { lat: 13.0827, lng: 80.2707 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  madurai: { lat: 9.9252, lng: 78.1198 },
  tiruchirappalli: { lat: 10.7905, lng: 78.7047 },
  salem: { lat: 11.6643, lng: 78.146 },

  // Telangana & Andhra Pradesh
  hyderabad: { lat: 17.385, lng: 78.4867 },
  secunderabad: { lat: 17.4399, lng: 78.4983 },
  warangal: { lat: 17.9689, lng: 79.5941 },
  visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  vijayawada: { lat: 16.5062, lng: 80.648 },
  guntur: { lat: 16.3067, lng: 80.4365 },

  // Rajasthan
  jaipur: { lat: 26.9124, lng: 75.7873 },
  jodhpur: { lat: 26.2389, lng: 73.0243 },
  udaipur: { lat: 24.5854, lng: 73.7125 },
  kota: { lat: 25.2138, lng: 75.8648 },
  ajmer: { lat: 26.4499, lng: 74.6399 },

  // West Bengal
  kolkata: { lat: 22.5726, lng: 88.3639 },
  howrah: { lat: 22.5958, lng: 88.2636 },

  // Uttar Pradesh
  lucknow: { lat: 26.8467, lng: 80.9462 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  agra: { lat: 27.1767, lng: 78.0081 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  prayagraj: { lat: 25.4358, lng: 81.8463 },
  meerut: { lat: 28.9845, lng: 77.7064 },

  // Punjab, Haryana & Chandigarh
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  ludhiana: { lat: 30.901, lng: 75.8573 },
  amritsar: { lat: 31.634, lng: 74.8723 },
  jalandhar: { lat: 31.326, lng: 75.5762 },

  // Madhya Pradesh
  bhopal: { lat: 23.2599, lng: 77.4126 },
  indore: { lat: 22.7196, lng: 75.8577 },
  gwalior: { lat: 26.2183, lng: 78.1828 },
  jabalpur: { lat: 23.1815, lng: 79.9864 },

  // Kerala
  kochi: { lat: 9.9312, lng: 76.2673 },
  thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  kozhikode: { lat: 11.2588, lng: 75.7804 },

  // Bihar & Odisha
  patna: { lat: 25.5941, lng: 85.1376 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245 },
  cuttack: { lat: 20.4625, lng: 85.8828 },
};

/**
 * Normalizes city string by lowercasing and stripping non-alphanumeric characters,
 * then retrieves latitude & longitude.
 */
export function getCityCoordinates(cityName?: string | null): CityCoordinate | null {
  if (!cityName) return null;
  const key = cityName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return INDIAN_CITY_COORDINATES[key] ?? null;
}
