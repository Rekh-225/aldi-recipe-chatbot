# ALDI Recipe-to-Cart Chatbot Hackathon Plan

## Goal

Build a chatbot-style shopping assistant for ALDI.

The user tells the assistant what they want to cook. The assistant suggests recipes, builds a product basket from real ALDI products, optimizes the basket for ALDI profit where possible, finds a nearby store, and shows the shortest in-store route to collect everything and reach checkout.

Optional extension: offer delivery if the delivery API is available and easy to integrate.

## Challenge Summary

Challenge site:

```txt
https://hackhaton.internal.zrcn.dev
```

API docs:

```txt
https://hackhaton.internal.zrcn.dev/docs
```

OpenAPI schema:

```txt
https://hackhaton.internal.zrcn.dev/api/openapi
```

The provided API includes:

- 16 product categories
- 119 products
- 10 recipes
- 5 stores
- 9x9 grid layout per store
- In-store route planner
- Product price and wholesale price
- Portion scaling
- Pantry-staple exclusion
- Profit-optimized product option per ingredient

## Core User Flow

1. User opens chatbot.
2. Bot asks what they want to cook.
3. User types something like:

```txt
pasta
chicken
vegetarian
something quick
```

4. App searches recipes.
5. User selects a recipe.
6. Bot asks for number of portions.
7. Bot asks whether to exclude pantry staples.
8. App builds basket from ALDI products.
9. App chooses profit-optimized products by default.
10. App asks whether user wants to shop in-store or get delivery.
11. If in-store:
    - find/select nearest store
    - show store address
    - show Google Maps directions link
    - show in-store 9x9 route to collect ingredients
12. If delivery:
    - check delivery availability if API is provided
    - show delivery fee and ETA
    - show basket summary

## MVP Scope

Must build:

- Recipe search
- Recipe selection
- Portion input
- Pantry staple toggle
- Basket display
- Profit-optimized product selection
- Store selection
- Store route display
- Clean chatbot-like flow

Should build if time allows:

- Browser geolocation
- Nearest-store recommendation
- Google Maps directions link
- Basket totals
- Total estimated ALDI margin

Only build if delivery API is simple:

- Delivery availability
- Delivery quote
- Delivery option in final checkout screen

Do not build:

- Login
- Payment
- Database
- Full order tracking
- Custom routing algorithm
- Complex AI conversation engine
- Full Google Maps SDK integration

## API Base URL

```txt
https://hackhaton.internal.zrcn.dev
```

## Main API Endpoints

### Search Recipes

```txt
GET /api/recipes?q={query}
```

Example:

```txt
GET /api/recipes?q=pasta
```

Use this when the user says what they want to eat.

### Recipe Details And Basket Options

```txt
GET /api/recipes/{id}?portions={number}&exclude_pantry={true|false}
```

Example:

```txt
GET /api/recipes/1?portions=6&exclude_pantry=true
```

This returns:

- recipe details
- scaled ingredient amounts
- whether each ingredient should be included
- product options
- cheapest option ID
- max profit option ID

Use `max_profit_option_id` as the default selected product for bonus points.

### Products

```txt
GET /api/products
GET /api/products?ingredient_key=spaghetti
GET /api/products?category_id=9
GET /api/products?sort=margin
GET /api/products?sort=price
```

Useful if we want to let the user switch between cheapest and highest-margin products.

### Stores

```txt
GET /api/stores
```

Each store includes:

- id
- name
- city
- address
- lat
- lng
- grid size

Example stores include:

- ALDI Wien Mitte
- ALDI Budapest Deak
- ALDI Munchen Zentrum
- ALDI Berlin Mitte
- ALDI Zurich HB

### Store Grid

```txt
GET /api/stores/{id}/grid
```

Example:

```txt
GET /api/stores/1/grid
```

Returns a 9x9 grid with:

- x/y cell positions
- cell type
- category IDs
- category names
- entrance
- checkout

### Route Plan

```txt
GET /api/stores/{id}/route-plan?recipe_id={recipeId}&exclude_pantry=true
```

Example:

```txt
GET /api/stores/1/route-plan?recipe_id=1&exclude_pantry=true
```

Returns:

- required category IDs
- pickup stops
- total steps
- full path through the grid
- checkout stop

Important: do not implement our own route planner. Use this endpoint.

## Nearest Store Plan

The store API already gives `lat` and `lng`, so we do not need Google Maps API for the MVP.

Use browser geolocation:

```js
navigator.geolocation.getCurrentPosition(...)
```

Then calculate distance from user location to each store using Haversine distance.

Pick the store with the shortest distance.

Show:

```txt
Nearest store: ALDI Budapest Deak
Address: Deak Ferenc ter 3, 1052 Budapest
```

Add Google Maps directions link:

```txt
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
```

Example:

```txt
https://www.google.com/maps/dir/?api=1&destination=47.4979,19.0545
```

This gives user navigation without needing a Google API key.

## Delivery Plan

Delivery is a good business extension, but it should not block the MVP.

Add it as a final choice:

```txt
How would you like to get your basket?

[Shop in store] [Get delivery]
```

If the managing team gives delivery APIs, ask for these minimum endpoints:

```txt
GET /delivery/availability?lat={lat}&lng={lng}
POST /delivery/quote
POST /delivery/order
```

Minimum delivery data needed:

- user location or address
- selected product IDs
- quantities / packs needed
- availability true/false
- delivery fee
- ETA
- order confirmation ID

Delivery MVP:

1. Build basket first.
2. Ask for location/address.
3. Check delivery availability.
4. Show ETA and fee.
5. Show final basket summary.

Do not build payment or driver tracking.

## Product Selection Logic

For each included ingredient:

1. Read `product_options`.
2. Find product where `id === max_profit_option_id`.
3. Use that as the default selected product.
4. Display:
   - product name
   - size
   - packs needed
   - line price
   - line margin

Also optionally allow:

```txt
[Best for ALDI] [Cheapest for customer]
```

Best for ALDI:

```txt
max_profit_option_id
```

Cheapest for customer:

```txt
cheapest_option_id
```

## Basket Totals

Calculate:

```txt
totalPrice = sum(line_price)
totalWholesale = sum(line_wholesale)
totalMargin = sum(line_margin)
```

Show:

```txt
Basket total: EUR X.XX
Estimated ALDI margin: EUR Y.YY
```

## Suggested Tech Stack

Fastest option:

- React + Vite
- Plain CSS or Tailwind if already set up
- No backend required
- Fetch API directly from browser

Alternative:

- Next.js if team is already comfortable with it

Recommended for 2.5 hours:

```txt
React + Vite + simple CSS
```

## Suggested Components

```txt
App
RecipeSearch
ChatPanel
RecipeList
RecipeCard
RecipeDetail
PortionSelector
PantryToggle
BasketSummary
StoreSelector
NearestStoreButton
RouteGrid
DeliveryOption
```

## Suggested State Shape

```js
{
  query: "",
  recipes: [],
  selectedRecipeId: null,
  recipeDetail: null,
  portions: 4,
  excludePantry: true,
  stores: [],
  selectedStoreId: null,
  nearestStore: null,
  routePlan: null,
  fulfillmentMode: "store", // "store" or "delivery"
  deliveryQuote: null
}
```

## Team Roles

### Person 1: Tech Lead / Integration

Responsibilities:

- Create project
- Define API helper functions
- Keep scope controlled
- Merge everyone work
- Own final demo path

### Person 2: API And Basket Logic

Responsibilities:

- Implement API calls
- Recipe detail fetch
- Product selection logic
- Basket totals
- Margin calculation

### Person 3: Frontend Flow

Responsibilities:

- Chat-like UI
- Recipe search UI
- Recipe selection
- Portion and pantry controls
- State transitions

### Person 4: Junior Developer

Responsibilities:

- Recipe cards
- Basket table
- Loading states
- Error messages
- Manual testing

### Person 5: Junior Developer

Responsibilities:

- Store selector
- Google Maps directions link
- Demo script
- UI polish
- Testing final flow

If someone finishes early, help with route grid visualization.

## 2.5 Hour Timeline

### 0-10 Minutes: Setup And Scope

- Pick stack.
- Create app.
- Confirm MVP flow.
- Assign roles.
- Use recipe 1 and store 1 as default test data.

Demo default:

```txt
Query: pasta
Recipe: Spaghetti Bolognese
Portions: 6
Exclude pantry: true
Store: ALDI Wien Mitte
```

### 10-35 Minutes: API Helpers

Build:

```js
searchRecipes(query)
getRecipe(recipeId, portions, excludePantry)
getStores()
getStoreGrid(storeId)
getRoutePlan(storeId, recipeId, excludePantry)
```

Test in browser console or app UI.

### 10-55 Minutes: UI Shell

Build:

- page layout
- chat/search input
- recipe result cards
- selected recipe panel

### 35-75 Minutes: Basket Builder

Build:

- portions input
- pantry toggle
- recipe detail fetch
- ingredient list
- selected product per ingredient
- total price
- total margin

Use `max_profit_option_id` by default.

### 55-100 Minutes: Store And Route

Build:

- store dropdown
- route fetch
- 9x9 grid
- entrance marker
- checkout marker
- pickup stop markers
- route path markers
- total steps

### 75-115 Minutes: Nearest Store And Delivery Option

Build nearest store:

- get browser location
- calculate nearest store
- select it automatically
- show Google Maps directions link

Delivery:

- Add UI toggle only if API is available.
- If API is not available yet, keep it as a polished "coming next" option in pitch, not as fake functionality.

### 100-130 Minutes: Polish

Add:

- loading states
- API error states
- empty recipe search state
- clean labels
- responsive layout
- simple ALDI-like colors

### 130-150 Minutes: Final Testing And Pitch

Test this exact flow:

```txt
User: pasta
Select: Spaghetti Bolognese
Portions: 6
Exclude pantry: yes
Fulfillment: shop in store
Store: nearest or ALDI Wien Mitte
Show: basket, margin, route, directions link
```

Prepare pitch:

```txt
Our assistant turns a food craving into a profitable ALDI basket and a frictionless fulfillment path. It can guide the customer through the nearest store using an optimized route, and the same basket can be extended to delivery when delivery APIs are available.
```

## Demo Script

1. Open app.
2. Type:

```txt
I want pasta for dinner
```

3. Show recipe results.
4. Select:

```txt
Spaghetti Bolognese
```

5. Set portions:

```txt
6
```

6. Toggle:

```txt
Skip pantry staples: yes
```

7. Show basket:

- ingredients
- chosen ALDI products
- packs needed
- total price
- estimated margin

8. Click:

```txt
Find nearest store
```

9. Show nearest ALDI and directions link.
10. Show 9x9 route grid.
11. Explain:

```txt
The customer gets a complete basket and an optimized path through the store. ALDI gets a margin-aware recommendation engine that can also extend to delivery.
```

## Judging Points We Should Hit

- Uses provided API deeply
- Handles full recipe-to-cart flow
- Uses profit optimization
- Uses portion scaling
- Uses pantry skipping
- Shows route through store
- Has clear customer value
- Has clear ALDI business value
- Has delivery expansion story

## Main Risks

### Risk: Too much time spent on maps

Solution:

Use geolocation plus Google Maps directions link. Do not integrate Google Maps SDK.

### Risk: Delivery API arrives late

Solution:

Keep delivery as optional. Do not block MVP.

### Risk: Chatbot becomes too complicated

Solution:

Use guided chat steps with buttons and inputs. Do not build open-ended AI logic first.

### Risk: Route grid takes too long

Solution:

Fallback display:

- ordered stop list
- total steps
- store address

Grid is better, but stop list is enough for MVP.

## Build Priority

Priority order:

1. Recipe search
2. Recipe selection
3. Basket with product selections
4. Profit-optimized default choices
5. Store selection
6. Route plan
7. 9x9 grid
8. Nearest store
9. Directions link
10. Delivery option

If time gets tight, cut delivery and keep it in the pitch.

## Final Product Statement

```txt
This is an ALDI shopping assistant that turns a customer's food idea into a complete, margin-aware basket and then chooses the best fulfillment path: a guided in-store route through the nearest ALDI, or delivery when available.
```


## n8n Integration Plan

n8n should be used as an orchestration layer, not as the core app.

The frontend should still be simple and fast. n8n can sit between the frontend and external services when we need workflow logic, delivery integration, notifications, or a cleaner demo story.

Recommended use:

```txt
Frontend chatbot UI -> n8n Webhook -> ALDI API / Delivery API -> n8n response -> Frontend
```

### Best n8n Use Cases For This Hackathon

Use n8n for:

- delivery availability and quote flow
- turning a basket into a delivery request
- optional notification after order creation
- optional AI intent classification if we have time
- logging demo sessions

Do not use n8n for:

- rendering the UI
- the 9x9 route grid
- complicated chat state
- anything that would slow down the MVP

### Recommended Architecture

Frontend handles:

- UI
- chat steps
- recipe cards
- basket display
- route grid
- nearest-store calculation

n8n handles:

- webhook endpoints
- delivery API calls
- optional basket enrichment
- optional order/lead creation
- optional notifications

ALDI API handles:

- recipes
- products
- stores
- route planning

### Minimal n8n Workflow 1: Delivery Quote

Purpose:

After the app builds a basket, n8n checks whether delivery is available and returns ETA/fee.

Webhook:

```txt
POST /webhook/delivery-quote
```

Frontend sends:

```json
{
  "userLocation": {
    "lat": 47.4979,
    "lng": 19.0545
  },
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

n8n nodes:

```txt
Webhook
-> Set / Edit Fields
-> HTTP Request to delivery availability API
-> HTTP Request to delivery quote API
-> Respond to Webhook
```

n8n returns:

```json
{
  "available": true,
  "etaMinutes": 45,
  "deliveryFee": 2.99,
  "fulfillmentStoreId": 2,
  "message": "Delivery is available from ALDI Budapest Deak."
}
```

If delivery API is not ready, return a controlled fallback:

```json
{
  "available": false,
  "message": "Delivery is not available for this demo location yet."
}
```

### Minimal n8n Workflow 2: Delivery Order

Only build this if quote works first.

Webhook:

```txt
POST /webhook/create-delivery-order
```

Frontend sends:

```json
{
  "customer": {
    "name": "Demo User",
    "address": "Deak Ferenc ter 3, Budapest",
    "lat": 47.4979,
    "lng": 19.0545
  },
  "basket": [
    {
      "productId": 1065,
      "quantity": 1
    }
  ],
  "deliveryQuoteId": "quote_123"
}
```

n8n nodes:

```txt
Webhook
-> Validate required fields
-> HTTP Request to delivery order API
-> Optional Slack/Email notification
-> Respond to Webhook
```

n8n returns:

```json
{
  "success": true,
  "orderId": "order_123",
  "etaMinutes": 45
}
```

### Optional n8n Workflow 3: Chat Orchestrator

This is only worth doing if n8n is already set up and the team is comfortable with it.

Webhook:

```txt
POST /webhook/chat
```

Frontend sends:

```json
{
  "message": "I want pasta for 6 people",
  "session": {
    "selectedRecipeId": null,
    "portions": null,
    "excludePantry": true
  }
}
```

n8n nodes:

```txt
Webhook
-> optional AI/classifier node
-> HTTP Request to /api/recipes?q=pasta
-> Set response message
-> Respond to Webhook
```

Return:

```json
{
  "reply": "I found a few pasta recipes. Pick one.",
  "recipes": []
}
```

Warning:

This can become slow to debug. For the hackathon, guided frontend state is safer than a full n8n-powered chatbot.

### Frontend Integration With n8n

Create a small n8n client:

```js
const N8N_BASE_URL = import.meta.env.VITE_N8N_BASE_URL;

export async function getDeliveryQuote(payload) {
  const res = await fetch(`${N8N_BASE_URL}/webhook/delivery-quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error("Failed to get delivery quote");
  }

  return res.json();
}
```

Environment variable:

```txt
VITE_N8N_BASE_URL=https://your-n8n-domain.com
```

For local testing:

```txt
VITE_N8N_BASE_URL=http://localhost:5678
```

### n8n Build Priority

Build in this order:

1. Frontend MVP without n8n
2. n8n delivery quote webhook
3. Frontend delivery option calls n8n
4. n8n order webhook if delivery quote works
5. Optional notifications
6. Optional AI/chat orchestration

### n8n Demo Story

Use this line in the pitch:

```txt
n8n acts as the fulfillment orchestration layer. Our frontend builds the recipe basket and route, while n8n connects that basket to delivery availability, delivery quotes, and future order automation.
```

### n8n Risk Control

If n8n setup takes more than 20 minutes, stop and continue without it.

Fallback:

- Keep the frontend route and basket working.
- Show delivery as an integration-ready option.
- Mention that n8n would handle delivery fulfillment orchestration.
