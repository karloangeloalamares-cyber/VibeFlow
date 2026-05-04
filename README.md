# VibeFlow Content Factory

Content Factory as a Service MVP with TikTok Intelligence video analysis and Gemini Veo vertical generation.

## Features
- **TikTok Video Ingestion**: Fetches and downloads TikTok videos using Apify.
- **AI Analysis**: Analyzes downloaded videos using the Gemini API to extract vibe score, summaries, visual beats, and more.
- **Vertical Generation Context**: Uses analyzed results for better vertical content ideation and production contexts.

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- [Apify Account](https://apify.com/) and API Token
- Google Gemini API Key

### Installation

1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables by copying `.env.example` to `.env` and adding your real API keys:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to include your `GEMINI_API_KEY` and `APIFY_TOKEN`*.

### Running the Applet

To run the development server:
```bash
npm run dev
```

To build and start production server:
```bash
npm run build
npm run start
```

## Architecture
- **Frontend**: React + Tailwind CSS + Vite
- **Backend**: Express + Vite Middleware (for dev)
- **AI / Ingestion**: `apify-client` and `@google/genai`
