import cors from "cors";
import "dotenv/config";
import express from "express";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();
const port = Number(process.env.PORT || 8787);
const aldiBaseUrl =
  process.env.ALDI_API_BASE_URL || "https://hackhaton.internal.zrcn.dev";
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const openRouterModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

app.use(cors());
app.use(express.json());

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text.slice(0, 200)}`);
  }

  return response.json();
}

async function fetchAldi(path) {
  return fetchJson(`${aldiBaseUrl}${path}`);
}

function createFallbackIdeas(query, recipes) {
  return recipes.slice(0, 5).map((recipe) => ({
    recipe_id: recipe.id,
    recipe_name: recipe.name,
    reason: query
      ? `Matches the "${query}" request using ALDI recipe data.`
      : "Available from the ALDI recipe catalogue.",
    confidence: "grounded"
  }));
}

async function createAiIdeas(query, recipes) {
  if (!openRouterApiKey || !recipes.length) {
    return createFallbackIdeas(query, recipes);
  }

  const candidates = recipes.slice(0, 10).map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    cuisine: recipe.cuisine,
    tags: recipe.tags,
    ingredients: recipe.ingredients?.map((ingredient) => ingredient.name) || []
  }));

  const completion = await fetchJson("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "ALDI Recipe Assistant"
    },
    body: JSON.stringify({
      model: openRouterModel,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Return only valid JSON. Recommend only from the provided ALDI recipe candidates. Do not invent recipes, products, stores, prices, or ingredients."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Pick up to 5 best recipe ideas for the user's request. Return {\"ideas\":[{\"recipe_id\":number,\"recipe_name\":\"string\",\"reason\":\"string\",\"confidence\":\"grounded\"}]} only.",
            user_request: query,
            aldi_recipe_candidates: candidates
          })
        }
      ]
    })
  });

  const content = completion.choices?.[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(content);
    const validIds = new Set(recipes.map((recipe) => recipe.id));
    const ideas = (parsed.ideas || []).filter((idea) => validIds.has(idea.recipe_id));
    return ideas.length ? ideas : createFallbackIdeas(query, recipes);
  } catch {
    return createFallbackIdeas(query, recipes);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/recipe-ideas", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    const queryParam = query ? `?q=${encodeURIComponent(query)}` : "";
    let data = await fetchAldi(`/api/recipes${queryParam}`);
    let recipes = data.recipes || [];

    if (!recipes.length) {
      data = await fetchAldi("/api/recipes");
      recipes = data.recipes || [];
    }

    const ideas = await createAiIdeas(query, recipes);
    res.json({
      source: openRouterApiKey ? "openrouter-grounded" : "backend-fallback",
      ideas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/api", async (req, res) => {
  try {
    const data = await fetchAldi(req.originalUrl);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend API running on http://localhost:${port}`);
});
