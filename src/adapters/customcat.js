export async function submitOrderToCustomCat(order) {
  return {
    mode: process.env.CUSTOMCAT_API_KEY ? 'api_stub' : 'csv_fallback_stub',
    accepted: false,
    order,
  };
}
