# ALDI Recipe Assistant Workflow Implementation Plan

## Objective

Build a reliable hackathon demo that turns a user's cooking idea into:

1. A grounded recipe recommendation from the ALDI API.
2. A basket built only from real ALDI products.
3. A profit-aware or customer-cheapest product selection.
4. A basket that skips pantry staples and ingredients the user already has.
5. A selected or nearest ALDI store.
6. A clear in-store pickup route through the 9x9 grid.
7. An optional delivery/n8n path if the webhook is ready.

The app must work even if n8n is late or unavailable.

## Core Principle

The AI can understand the user, but it must not become the source of truth.

```txt
User message
-> n8n/OpenRouter extracts intent
-> Frontend calls ALDI API
-> Frontend only displays ALDI recipes/products/routes
```

Rules:

- Do not let AI invent products.
- Do not let AI invent prices.
- Do not let AI invent store routes.
- Do not let AI invent recipe details.
- If no good ALDI match exists, show the closest ALDI recipe options.

## Current App Status

Already built:

- React + Vite app.
- ALDI API client.
- Recipe search.
- Recipe selection.
- Portion control.
- Pantry-staple toggle.
- Profit-aware basket using `max_profit_option_id`.
- Basket total and margin.
- Store selector.
- Google Maps directions link.
- Nearest-store helper.
- 9x9 route grid.
- n8n delivery placeholder.

Remaining high-value work:

1. Route stop list.
2. Home ingredients exclusion.
3. Product strategy toggle.
4. n8n chat-intent integration.
5. Final summary panel.
6. Demo polish and testing.

## Final User Workflow

### Step 1: User Intent

User can type a natural message:

```txt
I want chicken and rice for 4 people. I already have salt and olive oil.
```

If n8n is ready:

```txt
Frontend -> n8n /webhook/chat-intent -> OpenRouter -> structured intent JSON
```

If n8n is not ready:

```txt
Use the existing recipe search input directly.
```

### Step 2: Intent JSON

n8n should return:

```json
{
  "dish": null,
  "ingredientsWanted": ["chicken", "rice"],
  "ingredientsAtHome": ["salt", "olive oil"],
  "portions": 4,
  "diet": null,
  "cuisine": null,
  "maxPrepMinutes": null
}
```

Frontend converts this to a search query:

```txt
dish || ingredientsWanted.join(" ") || cuisine || userMessage
```

### Step 3: Recipe Search

Call:

```txt
GET /api/recipes?q={query}
```

Show recipe cards with:

- name
- description
- cuisine
- prep time
- tags

### Step 4: Smart Questions

Before building the final basket, confirm:

- portions
- skip pantry staples
- ingredients already at home
- product strategy

Controls:

```txt
Portions: [number]
Skip pantry staples: [on/off]
Already have at home: salt, oil, garlic
Product strategy: Best for ALDI | Cheapest for customer
```

### Step 5: Recipe Detail

Call:

```txt
GET /api/recipes/{id}?portions={portions}&exclude_pantry={true|false}
```

Use returned ingredients and product options.

### Step 6: Basket Construction

Filter ingredients:

```txt
include_in_shopping_list === true
AND ingredient is not in ingredientsAtHome
```

Product strategy:

```txt
Best for ALDI -> max_profit_option_id
Cheapest for customer -> cheapest_option_id
```

Show each basket line:

- ingredient
- scaled amount
- selected product
- packs needed
- line price
- line margin
- reason selected

Example reason:

```txt
Selected for higher ALDI margin.
```

or:

```txt
Selected as the cheapest customer option.
```

### Step 7: Store Selection

Call:

```txt
GET /api/stores
```

User can:

- select a store manually
- click nearest store
- open Google Maps directions

Nearest store uses browser geolocation and Haversine distance.

No Google Maps API key is needed.

### Step 8: In-Store Route

Call:

```txt
GET /api/stores/{storeId}/grid
GET /api/stores/{storeId}/route-plan?recipe_id={recipeId}&exclude_pantry={true|false}
```

Show:

- total steps
- 9x9 grid
- route path
- numbered pickup stops
- route stop list

Route stop list format:

```txt
0. Entrance
1. Pick up Vegetables
2. Pick up Pasta & Rice
3. Pick up Canned & Jarred
4. Pick up Meat & Poultry
5. Pick up Cheese & Deli
6. Pay at Checkout
```

### Step 9: Final Summary

Show one final pitch-friendly panel:

```txt
Recipe: Spaghetti Bolognese
Portions: 6
Skipped: salt, pepper, olive oil
Basket total: EUR 15.53
Estimated ALDI margin: EUR 5.30
Store: ALDI Wien Mitte
Route: 12 steps
Fulfillment: In-store route ready
```

### Step 10: Optional Delivery

Only if n8n delivery webhook is ready:

```txt
Frontend -> n8n /webhook/delivery-quote
```

Payload:

```json
{
  "storeId": 2,
  "basket": [
    {
      "productId": 1065,
      "name": "Spaghetti 1 kg",
      "packsNeeded": 1,
      "linePrice": 0.99
    }
  ]
}
```

Expected response:

```json
{
  "available": true,
  "etaMinutes": 45,
  "deliveryFee": 2.99,
  "message": "Delivery is available."
}
```

If n8n is not ready, show:

```txt
Delivery orchestration is integration-ready through n8n.
```

## Frontend State Model

Recommended state:

```js
{
  query: "",
  chatMessage: "",
  intent: null,
  recipes: [],
  selectedRecipe: null,
  recipeDetail: null,
  portions: 4,
  excludePantry: true,
  ingredientsAtHomeText: "",
  ingredientsAtHome: [],
  productStrategy: "profit",
  stores: [],
  selectedStoreId: "",
  storeGrid: null,
  routePlan: null,
  deliveryQuote: null,
  loading: {},
  error: ""
}
```

Product strategy values:

```txt
profit
cheapest
```

## n8n Chat Intent Contract

Webhook:

```txt
POST /webhook/chat-intent
```

Frontend request:

```json
{
  "message": "I want chicken and rice for 4 people. I already have salt and oil."
}
```

Response:

```json
{
  "dish": null,
  "ingredientsWanted": ["chicken", "rice"],
  "ingredientsAtHome": ["salt", "oil"],
  "portions": 4,
  "diet": null,
  "cuisine": null,
  "maxPrepMinutes": null
}
```

Frontend function:

```js
export async function extractChatIntent(message) {
  const response = await fetch(`${N8N_BASE_URL}/webhook/chat-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok) {
    throw new Error("Failed to extract chat intent");
  }

  return response.json();
}
```

## Matching Home Ingredients

Normalize names before matching:

```js
function normalize(value) {
  return value.toLowerCase().trim();
}
```

Basic matching:

```js
const home = ingredientsAtHome.map(normalize);

const shouldSkip = home.some((item) => {
  const ingredientName = normalize(ingredient.name);
  const ingredientKey = normalize(ingredient.ingredient_key || "");
  return ingredientName.includes(item) || ingredientKey.includes(item);
});
```

This is enough for the hackathon.

## Product Selection Logic

```js
function selectProduct(ingredient, productStrategy) {
  const selectedId =
    productStrategy === "cheapest"
      ? ingredient.cheapest_option_id
      : ingredient.max_profit_option_id;

  return ingredient.product_options?.find((option) => option.id === selectedId);
}
```

Reason text:

```js
productStrategy === "cheapest"
  ? "Selected as the cheapest customer option."
  : "Selected for higher ALDI margin."
```

## Implementation Priority

### Priority 1: Route Stop List

Why:

- Easy.
- High demo value.
- Makes route output understandable.

Acceptance:

- After clicking `Build route`, app shows ordered stops from `routePlan.stops`.

### Priority 2: Product Strategy Toggle

Why:

- Shows business/customer tradeoff clearly.
- Uses API-provided `cheapest_option_id` and `max_profit_option_id`.

Acceptance:

- Toggle changes selected products and totals.
- Basket updates immediately.

### Priority 3: Home Ingredients Input

Why:

- Hits smart-question bonus.
- Works even without n8n.

Acceptance:

- User enters `salt, oil, garlic`.
- Matching ingredients are skipped.
- UI shows skipped ingredients.

### Priority 4: Final Summary Panel

Why:

- Makes pitch easier.
- Gives judges a clean final result.

Acceptance:

- Shows recipe, portions, total, margin, store, route steps, skipped ingredients.

### Priority 5: n8n Chat Intent

Why:

- Makes chatbot feel intelligent.
- Keeps OpenRouter key out of frontend.

Acceptance:

- User enters natural sentence.
- n8n returns JSON.
- Frontend searches recipes and sets portions/home ingredients.

## 50-Minute Execution Plan

### 0-10 Minutes

Implement route stop list.

Files:

```txt
src/App.jsx
src/styles.css
```

### 10-20 Minutes

Implement product strategy toggle.

Update:

```txt
selectProduct()
buildBasket()
BasketBuilder UI
totals
```

### 20-30 Minutes

Implement home ingredients input and skipped list.

Update:

```txt
state
buildBasket()
BasketBuilder UI
summary data
```

### 30-40 Minutes

Implement final summary panel.

Show it after recipe + basket are ready.

### 40-50 Minutes

If n8n webhook is ready:

- add `extractChatIntent()`
- add natural-language input handling
- test one demo message

If n8n is not ready:

- polish UI
- test demo flow
- prepare pitch

## Cut Line

If time is low, do not add more architecture.

Must ship:

```txt
recipe -> basket -> margin -> store -> route
```

Optional:

```txt
n8n, delivery, extra AI formatting
```

## Demo Script

Use this exact demo:

```txt
I want pasta for 6 people. I already have salt, pepper, and olive oil.
```

If n8n is ready:

1. Enter natural message.
2. Show extracted recipe search.
3. Select Spaghetti Bolognese.
4. Show portions set to 6.
5. Show skipped home ingredients.

If n8n is not ready:

1. Search `pasta`.
2. Select Spaghetti Bolognese.
3. Set portions to 6.
4. Enter home ingredients manually.

Then:

1. Show basket total.
2. Show estimated ALDI margin.
3. Show product strategy toggle.
4. Select ALDI Wien Mitte.
5. Click Build route.
6. Show 9x9 route grid.
7. Show route stop list.
8. Show final summary.

Pitch line:

```txt
Our assistant converts a food idea into a real ALDI basket and a store route, while optimizing either for customer price or ALDI margin. AI is used only to understand the user; all recipes, products, prices, and routes come from ALDI data.
```

## Acceptance Checklist

Before final demo:

- App loads at `http://localhost:5173`.
- Search `pasta` returns recipe options.
- Selecting recipe builds basket.
- Portions update basket amounts.
- Pantry toggle works.
- Home ingredients are skipped.
- Product strategy toggle changes basket.
- Basket total and margin are visible.
- Store selector works.
- Google Maps link opens.
- Build route shows total steps.
- Route grid displays path/stops.
- Route stop list displays ordered stops.
- Final summary panel is visible.
- n8n fallback does not break app.

## Team Assignments

### Builder 1

Own:

- route stop list
- product strategy toggle
- home ingredients input
- final summary panel
- frontend stability

### Builder 2

Own:

- n8n chat-intent webhook
- OpenRouter prompt
- delivery quote webhook if time allows
- API/business logic support

### Support Team

Own:

- testing all flows
- screenshots
- demo script
- pitch wording
- bug reporting

## Final Success Definition

The demo succeeds if we can show:

```txt
User craving -> ALDI recipe -> smart basket -> profit/customer strategy -> store route -> final summary
```

Everything else is a bonus.

