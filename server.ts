import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, type Content } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Birtamode, Jhapa, Nepal coordinates for local hospital retrieval bias
const HOSPITAL_LAT_LNG = {
  latitude: 26.6438,
  longitude: 87.9914,
};

const HOSPITAL_SYSTEM_INSTRUCTION = `You are the official Patient Assistance Chatbot for Spine X Superspeciality Hospital and Trauma Centre Pvt. Ltd., located in Birtamode, Jhapa, Nepal.

Verified Hospital Facts (Use ONLY these facts for hospital-specific details; never invent doctor qualifications, personal phone numbers, or fixed clinic schedules):
- Hospital Name: Spine X Superspeciality Hospital and Trauma Centre Pvt. Ltd.
- Location: Birtamode, Jhapa, Nepal
- 24/7 Emergency & Helpline Phone / WhatsApp: 9807923351
- Emergency Service: Open 24/7 (including ICU and trauma triage)
- Departments: Orthopedics, Emergency, ICU, Medicine Ward, Surgery Ward, Gynecology Ward
- Consultants & OPD Consultation Fees:
  1. Dr. Kumud Kumar Limbu — OPD fee NPR 400
  2. Dr. Keshar Bahadur Gurung — Physician — OPD fee NPR 500
  3. Dr. Sachin Silapkar — ENT Specialist — OPD fee NPR 500
  4. Dr. Laxam Rana Magar — General Surgeon — OPD fee NPR 500
  5. Dr. Prem Bahadur Shahi — OPD fee NPR 400
- Online Booking: Patients can book an appointment online on the Book Appointment page, receive a unique Booking ID (SXH-YYYY-XXXXXX), and check status anytime on the Check Status page using their Booking ID and registered mobile number.

Clinical Safety & Tone Guidelines:
- Be clear, calm, respectful, and concise.
- Never diagnose conditions or prescribe medication. Encourage patients with urgent trauma, chest pain, severe bleeding, or breathing difficulty to call 9807923351 or visit the 24/7 Emergency department immediately.
- If asked about doctor qualifications, personal phone numbers, or exact weekly schedules not listed above, state clearly that those details can be confirmed at the hospital OPD desk (9807923351) and that live bookable time slots are shown on the Book Appointment page.`;

interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

interface SearchSource {
  title: string;
  uri: string;
}

interface MapsPlaceSource {
  title: string;
  uri: string;
  snippets: string[];
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGroundingData(response: unknown): {
  searchSources: SearchSource[];
  mapsPlaces: MapsPlaceSource[];
} {
  const searchSources: SearchSource[] = [];
  const mapsPlaces: MapsPlaceSource[] = [];
  const seenUrls = new Set<string>();

  const resp = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: { uri?: string; title?: string };
          maps?: {
            uri?: string;
            title?: string;
            placeAnswerSources?: {
              reviewSnippets?: Array<{ content?: string }>;
            };
          };
        }>;
      };
    }>;
  };

  const chunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  for (const chunk of chunks) {
    if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
      seenUrls.add(chunk.web.uri);
      searchSources.push({
        title: chunk.web.title || chunk.web.uri,
        uri: chunk.web.uri,
      });
    }
    if (chunk.maps?.uri && !seenUrls.has(chunk.maps.uri)) {
      seenUrls.add(chunk.maps.uri);
      const snippets = (chunk.maps.placeAnswerSources?.reviewSnippets || [])
        .map((s) => s.content?.trim() || '')
        .filter(Boolean)
        .slice(0, 2);
      mapsPlaces.push({
        title: chunk.maps.title || 'View on Google Maps',
        uri: chunk.maps.uri,
        snippets,
      });
    }
  }

  return { searchSources, mapsPlaces };
}

function parseLatLng(raw: unknown): { latitude: number; longitude: number } {
  if (
    raw &&
    typeof raw === 'object' &&
    typeof (raw as { latitude?: unknown }).latitude === 'number' &&
    typeof (raw as { longitude?: unknown }).longitude === 'number'
  ) {
    const lat = (raw as { latitude: number }).latitude;
    const lng = (raw as { longitude: number }).longitude;
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }
  return HOSPITAL_LAT_LNG;
}

function formatApiError(error: unknown): { status: number; message: string } {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('gemini_api_key is not configured')) {
    return {
      status: 500,
      message: 'Gemini API key is not configured. Please check Settings > Secrets.',
    };
  }
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'Gemini API key was rejected. Please verify your key in Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      status: 429,
      message: 'AI service rate limit reached. Please wait a moment and try again.',
    };
  }
  return {
    status: 500,
    message: rawMessage || 'Unable to generate AI response.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Multi-turn Gemini Chatbot Endpoint (supports Search Grounding, Maps Grounding, and Fast Lite)
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, mode, latLng } = req.body as {
        message?: unknown;
        history?: unknown;
        mode?: unknown;
        latLng?: unknown;
      };

      if (typeof message !== 'string' || message.trim().length === 0 || message.length > 2000) {
        res.status(400).json({ error: 'Please provide a message between 1 and 2000 characters.' });
        return;
      }

      const safeHistory: Content[] = Array.isArray(history)
        ? history
            .filter(
              (item): item is ChatHistoryTurn =>
                Boolean(item) &&
                typeof item === 'object' &&
                ((item as ChatHistoryTurn).role === 'user' ||
                  (item as ChatHistoryTurn).role === 'model') &&
                typeof (item as ChatHistoryTurn).text === 'string' &&
                (item as ChatHistoryTurn).text.trim().length > 0
            )
            .slice(-16)
            .map((item) => ({
              role: item.role,
              parts: [{ text: item.text.slice(0, 2000) }],
            }))
        : [];

      const chatMode = mode === 'maps' || mode === 'fast' ? mode : 'search';
      const model = chatMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
      const ai = getGenAIClient();

      const config: Record<string, unknown> = {
        systemInstruction: HOSPITAL_SYSTEM_INSTRUCTION,
      };

      if (chatMode === 'search') {
        config.tools = [{ googleSearch: {} }];
      } else if (chatMode === 'maps') {
        config.tools = [{ googleMaps: {} }];
        config.toolConfig = {
          retrievalConfig: {
            latLng: parseLatLng(latLng),
          },
        };
      }

      const chat = ai.chats.create({
        model,
        history: safeHistory,
        config,
      });

      const response = await chat.sendMessage({ message: message.trim() });
      const { searchSources, mapsPlaces } = extractGroundingData(response);

      res.json({
        reply: response.text || 'I could not generate a response. Please try rephrasing your question.',
        model,
        mode: chatMode,
        searchSources,
        mapsPlaces,
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Dedicated Google Search Grounding Endpoint (gemini-4-hydrogen + googleSearch)
  app.post('/api/grounding/search', async (req, res) => {
    try {
      const { query } = req.body as { query?: unknown };
      if (typeof query !== 'string' || query.trim().length < 2 || query.length > 500) {
        res.status(400).json({ error: 'Please enter a valid search query (2-500 characters).' });
        return;
      }

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: query.trim(),
        config: {
          systemInstruction:
            'You provide helpful, factual, up-to-date patient preparation, orthopedic health, and regional information relevant to visitors of Spine X Superspeciality Hospital in Birtamode, Jhapa, Nepal. Keep answers structured, concise, and avoid diagnosing medical conditions.',
          tools: [{ googleSearch: {} }],
        },
      });

      const { searchSources } = extractGroundingData(response);
      res.json({
        answer: response.text || '',
        sources: searchSources,
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Dedicated Google Maps Grounding Endpoint (gemini-4-hydrogen + googleMaps)
  app.post('/api/grounding/maps', async (req, res) => {
    try {
      const { query, latLng } = req.body as { query?: unknown; latLng?: unknown };
      if (typeof query !== 'string' || query.trim().length < 2 || query.length > 500) {
        res.status(400).json({ error: 'Please enter a valid location query (2-500 characters).' });
        return;
      }

      const ai = getGenAIClient();
      const coords = parseLatLng(latLng);
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${query.trim()} (Focus around Birtamode, Jhapa, Nepal near Spine X Superspeciality Hospital)`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: coords,
            },
          },
        },
      });

      const { mapsPlaces } = extractGroundingData(response);
      res.json({
        answer: response.text || '',
        places: mapsPlaces,
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
