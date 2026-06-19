const N8N_BASE_URL = import.meta.env.VITE_N8N_BASE_URL;

export async function getDeliveryQuote(payload) {
  if (!N8N_BASE_URL) {
    return {
      available: false,
      message: "Delivery orchestration is not connected yet."
    };
  }

  const response = await fetch(`${N8N_BASE_URL}/webhook/delivery-quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Failed to get delivery quote");
  }

  return response.json();
}
