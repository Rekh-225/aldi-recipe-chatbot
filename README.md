# ALDI Recipe-to-Cart Chatbot

Hackathon project for building an ALDI shopping assistant.

The app goal is to turn a user's food idea into:

- matching recipe suggestions
- a portion-scaled ALDI basket
- profit-aware product recommendations
- nearest-store selection
- an optimized in-store shopping route
- optional delivery orchestration through n8n

## Challenge API

Base URL:

```txt
https://hackhaton.internal.zrcn.dev
```

Docs:

```txt
https://hackhaton.internal.zrcn.dev/docs
```

OpenAPI:

```txt
https://hackhaton.internal.zrcn.dev/api/openapi
```

## Team Plan

See [HACKATHON_PLAN.md](./HACKATHON_PLAN.md).

## Run Locally

```bash
npm install
npm run dev
```

Then open:

```txt
http://localhost:5173
```

Optional environment file:

```bash
cp .env.example .env
```

## Current Build

The starter app includes:

- recipe search
- recipe selection
- portion and pantry controls
- profit-aware basket selection using `max_profit_option_id`
- basket total and margin summary
- store selector
- nearest-store helper using browser geolocation
- Google Maps directions link
- 9x9 route grid
- optional n8n delivery quote hook
