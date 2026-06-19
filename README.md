# WhatsApp Business Beach Shuttle Bot

A WhatsApp Business reservation bot for a beach shuttle service, using Flask, the Meta Cloud API, and Supabase.

## Features
- Purely interactive UI (List & Button messages)
- In-memory session state management
- Saves bookings to Supabase PostgreSQL
- Built for Render.com deployment

## Setup

1. Clone the repository
2. Create a virtual environment and install dependencies with `pip install -r requirements.txt`
3. Create a `.env` file based on `.env.example`
4. Set up your Supabase Database:
   - Run the SQL in `schema.sql` in your Supabase SQL Editor.
5. Set up Meta Developer App:
   - Add the WhatsApp product.
   - Configure Webhooks (use your deployed URL + `/webhook`, and your `META_VERIFY_TOKEN`).
   - Subscribe to the `messages` webhook field.

## Running Locally

```bash
PORT=5001 .venv/bin/python app.py
```

The app listens on the port in `PORT` and defaults to `5000` if it is not set. On macOS, port `5000` may already be taken by a system service, so `5001` is a safe local choice.

If you want to demo the flow locally without real WhatsApp or Supabase credentials, set `DEMO_MODE=true` in your `.env`. In demo mode the bot logs the outgoing WhatsApp payloads instead of sending them to Meta.

To expose the webhook publicly, install ngrok and authenticate it once with your account token, then run:

```bash
ngrok http 5001
```

Copy the generated `https://...ngrok-free.app` URL and append `/webhook` when configuring Meta.

## Deployment to Render.com

1. Create a new Web Service on Render.
2. Connect your GitHub repository.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add all Environment Variables under the "Environment" tab.
