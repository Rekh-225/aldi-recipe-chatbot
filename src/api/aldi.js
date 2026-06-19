const ALDI_API_BASE_URL =
  import.meta.env.VITE_ALDI_API_BASE_URL || "https://hackhaton.internal.zrcn.dev";

async function request(path) {
  const response = await fetch(`${ALDI_API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`ALDI API request failed: ${response.status}`);
  }

  return response.json();
}

export async function searchRecipes(query) {
  const params = query ? `?q=${encodeURIComponent(query)}` : "";
  const data = await request(`/api/recipes${params}`);
  return data.recipes || [];
}

export async function getRecipe(recipeId, portions, excludePantry) {
  const params = new URLSearchParams();
  if (portions) params.set("portions", String(portions));
  params.set("exclude_pantry", String(Boolean(excludePantry)));

  return request(`/api/recipes/${recipeId}?${params.toString()}`);
}

export async function getStores() {
  const data = await request("/api/stores");
  return data.stores || [];
}

export async function getStoreGrid(storeId) {
  return request(`/api/stores/${storeId}/grid`);
}

export async function getRoutePlan(storeId, recipeId, excludePantry) {
  const params = new URLSearchParams({
    recipe_id: String(recipeId),
    exclude_pantry: String(Boolean(excludePantry))
  });

  return request(`/api/stores/${storeId}/route-plan?${params.toString()}`);
}
