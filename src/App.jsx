import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  ChefHat,
  CircleDollarSign,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  Route,
  Search,
  ShoppingBasket,
  Truck
} from "lucide-react";
import {
  getRecipe,
  getRoutePlan,
  getStoreGrid,
  getStores,
  searchRecipes
} from "./api/aldi";
import { getDeliveryQuote } from "./api/n8n";
import { createDirectionsUrl, findNearestStore } from "./utils/distance";

const DEFAULT_QUERY = "pasta";

function formatMoney(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR"
  }).format(value || 0);
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function parseHomeIngredients(value) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function shouldSkipIngredient(ingredient, homeIngredients) {
  if (!homeIngredients.length) return false;

  const name = normalizeText(ingredient.name);
  const key = normalizeText(ingredient.ingredient_key);

  return homeIngredients.some((item) => name.includes(item) || key.includes(item));
}

function selectProduct(ingredient, productStrategy) {
  const selectedId =
    productStrategy === "cheapest"
      ? ingredient.cheapest_option_id
      : ingredient.max_profit_option_id;

  return ingredient.product_options?.find(
    (option) => option.id === selectedId
  );
}

function buildBasket(recipeDetail, productStrategy, homeIngredients) {
  if (!recipeDetail?.ingredients) return [];

  return recipeDetail.ingredients
    .filter((ingredient) => ingredient.include_in_shopping_list)
    .filter((ingredient) => !shouldSkipIngredient(ingredient, homeIngredients))
    .map((ingredient) => ({
      ingredient,
      product: selectProduct(ingredient, productStrategy)
    }))
    .filter((line) => line.product);
}

function getSkippedHomeIngredients(recipeDetail, homeIngredients) {
  if (!recipeDetail?.ingredients) return [];

  return recipeDetail.ingredients.filter(
    (ingredient) =>
      ingredient.include_in_shopping_list &&
      shouldSkipIngredient(ingredient, homeIngredients)
  );
}

function App() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeDetail, setRecipeDetail] = useState(null);
  const [portions, setPortions] = useState(4);
  const [excludePantry, setExcludePantry] = useState(true);
  const [ingredientsAtHomeText, setIngredientsAtHomeText] = useState("");
  const [productStrategy, setProductStrategy] = useState("profit");
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [storeGrid, setStoreGrid] = useState(null);
  const [routePlan, setRoutePlan] = useState(null);
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [loading, setLoading] = useState({
    recipes: false,
    detail: false,
    route: false,
    stores: false,
    location: false,
    delivery: false
  });
  const [error, setError] = useState("");

  const homeIngredients = useMemo(
    () => parseHomeIngredients(ingredientsAtHomeText),
    [ingredientsAtHomeText]
  );
  const basket = useMemo(
    () => buildBasket(recipeDetail, productStrategy, homeIngredients),
    [recipeDetail, productStrategy, homeIngredients]
  );
  const skippedHomeIngredients = useMemo(
    () => getSkippedHomeIngredients(recipeDetail, homeIngredients),
    [recipeDetail, homeIngredients]
  );
  const selectedStore = stores.find((store) => store.id === Number(selectedStoreId));

  const totals = useMemo(
    () =>
      basket.reduce(
        (acc, line) => ({
          price: acc.price + line.product.line_price,
          wholesale: acc.wholesale + line.product.line_wholesale,
          margin: acc.margin + line.product.line_margin
        }),
        { price: 0, wholesale: 0, margin: 0 }
      ),
    [basket]
  );

  useEffect(() => {
    loadRecipes(DEFAULT_QUERY);
    loadStores();
  }, []);

  async function withLoading(key, action) {
    setLoading((current) => ({ ...current, [key]: true }));
    setError("");

    try {
      return await action();
    } catch (err) {
      setError(err.message || "Something went wrong");
      return null;
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }

  async function loadRecipes(nextQuery = query) {
    const result = await withLoading("recipes", () => searchRecipes(nextQuery));
    if (result) setRecipes(result);
  }

  async function loadStores() {
    const result = await withLoading("stores", getStores);
    if (result) {
      setStores(result);
      setSelectedStoreId(String(result[0]?.id || ""));
    }
  }

  async function chooseRecipe(recipe) {
    setSelectedRecipe(recipe);
    setRoutePlan(null);
    setStoreGrid(null);
    setDeliveryQuote(null);

    const detail = await withLoading("detail", () =>
      getRecipe(recipe.id, portions, excludePantry)
    );

    if (detail) setRecipeDetail(detail);
  }

  async function refreshRecipeDetail(nextPortions = portions, nextExcludePantry = excludePantry) {
    if (!selectedRecipe) return;

    setRoutePlan(null);
    setStoreGrid(null);
    setDeliveryQuote(null);

    const detail = await withLoading("detail", () =>
      getRecipe(selectedRecipe.id, nextPortions, nextExcludePantry)
    );

    if (detail) setRecipeDetail(detail);
  }

  async function loadRoute() {
    if (!selectedRecipe || !selectedStoreId) return;

    const result = await withLoading("route", async () => {
      const [grid, route] = await Promise.all([
        getStoreGrid(selectedStoreId),
        getRoutePlan(selectedStoreId, selectedRecipe.id, excludePantry)
      ]);
      return { grid, route };
    });

    if (result) {
      setStoreGrid(result.grid);
      setRoutePlan(result.route);
    }
  }

  async function chooseNearestStore() {
    if (!navigator.geolocation) {
      setError("Browser location is not available.");
      return;
    }

    await withLoading(
      "location",
      () =>
        new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const nearest = findNearestStore(
                {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                },
                stores
              );

              if (nearest) {
                setSelectedStoreId(String(nearest.id));
              }

              resolve(nearest);
            },
            () => reject(new Error("Location permission was not granted."))
          );
        })
    );
  }

  async function checkDelivery() {
    if (!selectedStore) return;

    const quote = await withLoading("delivery", () =>
      getDeliveryQuote({
        storeId: selectedStore.id,
        store: selectedStore,
        basket: basket.map((line) => ({
          productId: line.product.id,
          name: line.product.name,
          packsNeeded: line.product.packs_needed,
          linePrice: line.product.line_price
        }))
      })
    );

    if (quote) setDeliveryQuote(quote);
  }

  function handleSubmit(event) {
    event.preventDefault();
    loadRecipes(query);
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="side-panel">
          <div className="brand">
            <span className="brand-mark">A</span>
            <div>
              <h1>ALDI Recipe Assistant</h1>
              <p>Recipe to basket to route</p>
            </div>
          </div>

          <div className="bot-card">
            <Bot size={22} />
            <div>
              <strong>Demo flow</strong>
              <p>Search a recipe, build a margin-aware basket, then route through a store.</p>
            </div>
          </div>

          <ProgressSteps
            selectedRecipe={selectedRecipe}
            basketReady={basket.length > 0}
            routeReady={Boolean(routePlan)}
          />
        </aside>

        <section className="main-panel">
          <header className="topbar">
            <div>
              <span className="eyebrow">Hackathon build</span>
              <h2>Shopping assistant workflow</h2>
            </div>
            <div className="summary-pills">
              <span>{recipes.length} recipes</span>
              <span>{stores.length} stores</span>
            </div>
          </header>

          {error ? (
            <div className="error-banner">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : null}

          <section className="search-section">
            <form className="search-form" onSubmit={handleSubmit}>
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try pasta, chicken, vegetarian, quick..."
              />
              <button type="submit" disabled={loading.recipes}>
                {loading.recipes ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
                Search
              </button>
            </form>
          </section>

          <div className="content-grid">
            <section className="panel">
              <PanelTitle icon={<ChefHat size={20} />} title="Recipe Options" />
              <RecipeList
                recipes={recipes}
                selectedRecipe={selectedRecipe}
                onChooseRecipe={chooseRecipe}
              />
            </section>

            <section className="panel">
              <PanelTitle icon={<ShoppingBasket size={20} />} title="Basket Builder" />
              <BasketBuilder
                recipeDetail={recipeDetail}
                basket={basket}
                totals={totals}
                portions={portions}
                excludePantry={excludePantry}
                productStrategy={productStrategy}
                ingredientsAtHomeText={ingredientsAtHomeText}
                skippedHomeIngredients={skippedHomeIngredients}
                loading={loading.detail}
                onChangePortions={(value) => {
                  setPortions(value);
                  refreshRecipeDetail(value, excludePantry);
                }}
                onChangeExcludePantry={(value) => {
                  setExcludePantry(value);
                  refreshRecipeDetail(portions, value);
                }}
                onChangeProductStrategy={setProductStrategy}
                onChangeIngredientsAtHome={setIngredientsAtHomeText}
              />
            </section>

            <section className="panel wide">
              <PanelTitle icon={<Route size={20} />} title="Store Route" />
              <StoreRoute
                stores={stores}
                selectedStoreId={selectedStoreId}
                selectedStore={selectedStore}
                routePlan={routePlan}
                storeGrid={storeGrid}
                loadingRoute={loading.route}
                loadingLocation={loading.location}
                canLoadRoute={Boolean(selectedRecipe && selectedStoreId)}
                onSelectStore={setSelectedStoreId}
                onFindNearest={chooseNearestStore}
                onLoadRoute={loadRoute}
              />
            </section>

            <section className="panel">
              <PanelTitle icon={<PackageCheck size={20} />} title="Final Summary" />
              <FinalSummary
                selectedRecipe={selectedRecipe}
                portions={portions}
                totals={totals}
                basket={basket}
                skippedHomeIngredients={skippedHomeIngredients}
                selectedStore={selectedStore}
                routePlan={routePlan}
                productStrategy={productStrategy}
              />
            </section>

            <section className="panel">
              <PanelTitle icon={<Truck size={20} />} title="Delivery Option" />
              <DeliveryPanel
                selectedStore={selectedStore}
                basket={basket}
                quote={deliveryQuote}
                loading={loading.delivery}
                onCheckDelivery={checkDelivery}
              />
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

function ProgressSteps({ selectedRecipe, basketReady, routeReady }) {
  const steps = [
    ["Search", true],
    ["Recipe", Boolean(selectedRecipe)],
    ["Basket", basketReady],
    ["Route", routeReady]
  ];

  return (
    <div className="steps">
      {steps.map(([label, done]) => (
        <div className={done ? "step done" : "step"} key={label}>
          <span>{done ? <Check size={15} /> : null}</span>
          {label}
        </div>
      ))}
    </div>
  );
}

function PanelTitle({ icon, title }) {
  return (
    <div className="panel-title">
      {icon}
      <h3>{title}</h3>
    </div>
  );
}

function RecipeList({ recipes, selectedRecipe, onChooseRecipe }) {
  if (!recipes.length) {
    return <p className="muted">No recipes yet. Search for a dish or ingredient.</p>;
  }

  return (
    <div className="recipe-list">
      {recipes.map((recipe) => (
        <button
          className={
            selectedRecipe?.id === recipe.id ? "recipe-card selected" : "recipe-card"
          }
          key={recipe.id}
          onClick={() => onChooseRecipe(recipe)}
          type="button"
        >
          <div>
            <h4>{recipe.name}</h4>
            <p>{recipe.description}</p>
          </div>
          <div className="recipe-meta">
            <span>
              <Clock size={14} />
              {recipe.prep_minutes} min
            </span>
            <span>{recipe.cuisine}</span>
          </div>
          <div className="tag-row">
            {recipe.tags.slice(0, 4).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}

function BasketBuilder({
  recipeDetail,
  basket,
  totals,
  portions,
  excludePantry,
  productStrategy,
  ingredientsAtHomeText,
  skippedHomeIngredients,
  loading,
  onChangePortions,
  onChangeExcludePantry,
  onChangeProductStrategy,
  onChangeIngredientsAtHome
}) {
  if (loading) {
    return <LoadingBlock text="Building the ALDI basket..." />;
  }

  if (!recipeDetail) {
    return <p className="muted">Choose a recipe to generate the shopping basket.</p>;
  }

  return (
    <div className="basket-block">
      <div className="controls-row">
        <label>
          Portions
          <input
            min="1"
            max="12"
            type="number"
            value={portions}
            onChange={(event) => onChangePortions(Number(event.target.value))}
          />
        </label>
        <label className="check-control">
          <input
            checked={excludePantry}
            onChange={(event) => onChangeExcludePantry(event.target.checked)}
            type="checkbox"
          />
          Skip pantry staples
        </label>
      </div>

      <div className="strategy-row" aria-label="Product strategy">
        <button
          className={productStrategy === "profit" ? "strategy active" : "strategy"}
          onClick={() => onChangeProductStrategy("profit")}
          type="button"
        >
          Best for ALDI
        </button>
        <button
          className={productStrategy === "cheapest" ? "strategy active" : "strategy"}
          onClick={() => onChangeProductStrategy("cheapest")}
          type="button"
        >
          Cheapest for customer
        </button>
      </div>

      <label>
        Already have at home
        <input
          value={ingredientsAtHomeText}
          onChange={(event) => onChangeIngredientsAtHome(event.target.value)}
          placeholder="salt, pepper, olive oil"
        />
      </label>

      {skippedHomeIngredients.length ? (
        <div className="skipped-box">
          <strong>Skipped from basket</strong>
          <p>{skippedHomeIngredients.map((ingredient) => ingredient.name).join(", ")}</p>
        </div>
      ) : null}

      <div className="total-strip">
        <div>
          <span>Basket total</span>
          <strong>{formatMoney(totals.price)}</strong>
        </div>
        <div>
          <span>Estimated margin</span>
          <strong>{formatMoney(totals.margin)}</strong>
        </div>
      </div>

      <div className="basket-lines">
        {basket.map(({ ingredient, product }) => (
          <div className="basket-line" key={ingredient.ingredient_key}>
            <div>
              <span className="ingredient-name">{ingredient.name}</span>
              <small>
                {ingredient.scaled_amount} {ingredient.unit} needed
              </small>
            </div>
            <div>
              <strong>{product.name}</strong>
              <small>
                {product.packs_needed} pack(s) · {formatMoney(product.line_price)} ·{" "}
                {formatMoney(product.line_margin)} margin
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StoreRoute({
  stores,
  selectedStoreId,
  selectedStore,
  routePlan,
  storeGrid,
  loadingRoute,
  loadingLocation,
  canLoadRoute,
  onSelectStore,
  onFindNearest,
  onLoadRoute
}) {
  return (
    <div className="route-layout">
      <div className="route-controls">
        <label>
          Store
          <select
            value={selectedStoreId}
            onChange={(event) => onSelectStore(event.target.value)}
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>

        {selectedStore ? (
          <div className="store-card">
            <MapPin size={17} />
            <div>
              <strong>{selectedStore.name}</strong>
              <p>{selectedStore.address}</p>
              <a href={createDirectionsUrl(selectedStore)} rel="noreferrer" target="_blank">
                Open Google Maps directions
              </a>
            </div>
          </div>
        ) : null}

        <div className="button-row">
          <button type="button" onClick={onFindNearest} disabled={loadingLocation}>
            {loadingLocation ? <Loader2 className="spin" size={18} /> : <Navigation size={18} />}
            Nearest
          </button>
          <button type="button" onClick={onLoadRoute} disabled={!canLoadRoute || loadingRoute}>
            {loadingRoute ? <Loader2 className="spin" size={18} /> : <Route size={18} />}
            Build route
          </button>
        </div>

        {routePlan ? (
          <>
            <div className="route-summary">
              <strong>{routePlan.total_steps} total steps</strong>
              <p>{routePlan.stops.length} route stops including checkout</p>
            </div>
            <RouteStopList stops={routePlan.stops} />
          </>
        ) : (
          <p className="muted">Select a recipe and store, then build the route.</p>
        )}
      </div>

      <div>
        <RouteGrid grid={storeGrid} routePlan={routePlan} />
      </div>
    </div>
  );
}

function RouteStopList({ stops = [] }) {
  if (!stops.length) return null;

  return (
    <div className="route-stops">
      <strong>Pickup order</strong>
      <ol>
        {stops.map((stop) => (
          <li key={`${stop.order}-${stop.x}-${stop.y}`}>
            <span>{stop.label}</span>
            <small>
              Cell {stop.x},{stop.y} - {stop.steps_from_previous} step(s)
            </small>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RouteGrid({ grid, routePlan }) {
  const pathKeys = new Set(routePlan?.path?.map((point) => `${point.x},${point.y}`) || []);
  const stopMap = new Map(
    routePlan?.stops?.map((stop) => [`${stop.x},${stop.y}`, stop]) || []
  );
  const cells = grid?.cells || [];

  if (!grid || !routePlan) {
    return (
      <div className="grid-placeholder">
        <PackageCheck size={28} />
        <span>Route grid will appear here</span>
      </div>
    );
  }

  return (
    <div className="store-grid" style={{ "--grid-size": grid.width }}>
      {cells.map((cell) => {
        const key = `${cell.x},${cell.y}`;
        const stop = stopMap.get(key);
        const isPath = pathKeys.has(key);
        const className = [
          "grid-cell",
          isPath ? "path" : "",
          stop ? "stop" : "",
          cell.type === "checkout" ? "checkout" : "",
          cell.type === "entrance" ? "entrance" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div className={className} key={key} title={cell.label}>
            {stop ? <strong>{stop.order}</strong> : null}
            <small>{cell.categories?.[0] || cell.type}</small>
          </div>
        );
      })}
    </div>
  );
}

function FinalSummary({
  selectedRecipe,
  portions,
  totals,
  basket,
  skippedHomeIngredients,
  selectedStore,
  routePlan,
  productStrategy
}) {
  if (!selectedRecipe) {
    return <p className="muted">Select a recipe to generate the final demo summary.</p>;
  }

  return (
    <div className="final-summary">
      <div>
        <span>Recipe</span>
        <strong>{selectedRecipe.name}</strong>
      </div>
      <div>
        <span>Portions</span>
        <strong>{portions}</strong>
      </div>
      <div>
        <span>Basket</span>
        <strong>
          {basket.length} items - {formatMoney(totals.price)}
        </strong>
      </div>
      <div>
        <span>ALDI margin</span>
        <strong>{formatMoney(totals.margin)}</strong>
      </div>
      <div>
        <span>Strategy</span>
        <strong>
          {productStrategy === "cheapest" ? "Cheapest for customer" : "Best for ALDI"}
        </strong>
      </div>
      <div>
        <span>Skipped</span>
        <strong>
          {skippedHomeIngredients.length
            ? skippedHomeIngredients.map((ingredient) => ingredient.name).join(", ")
            : "Pantry/home items only"}
        </strong>
      </div>
      <div>
        <span>Store</span>
        <strong>{selectedStore?.name || "Choose store"}</strong>
      </div>
      <div>
        <span>Route</span>
        <strong>{routePlan ? `${routePlan.total_steps} steps to checkout` : "Not built yet"}</strong>
      </div>
    </div>
  );
}

function DeliveryPanel({ selectedStore, basket, quote, loading, onCheckDelivery }) {
  return (
    <div className="delivery-panel">
      <p>
        Delivery is wired as an optional n8n workflow. The app can send the selected
        basket and store to an n8n webhook when it is available.
      </p>
      <button type="button" disabled={!selectedStore || !basket.length || loading} onClick={onCheckDelivery}>
        {loading ? <Loader2 className="spin" size={18} /> : <Truck size={18} />}
        Check delivery
      </button>
      {quote ? (
        <div className={quote.available ? "quote success" : "quote"}>
          <CircleDollarSign size={18} />
          <span>{quote.message || "Delivery quote received."}</span>
        </div>
      ) : null}
    </div>
  );
}

function LoadingBlock({ text }) {
  return (
    <div className="loading-block">
      <Loader2 className="spin" size={20} />
      <span>{text}</span>
    </div>
  );
}

export default App;

