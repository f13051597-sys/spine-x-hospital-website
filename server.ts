import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import { getApp, getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, type Content } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const adminApp = getApps().length
  ? getApp()
  : initializeAdminApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAdminAuth(adminApp);

const BOOTSTRAP_ADMIN_EMAIL = 'f13051597@gmail.com';
const FONEPAY_TERMINAL_ID = '2222050014357399';
const FONEPAY_BRANCH = 'BIRTAMOD';

function getFonepayEnvConfig() {
  const merchantCode = (process.env.FONEPAY_MERCHANT_CODE || '').trim();
  const username = (process.env.FONEPAY_USERNAME || '').trim();
  const password = (process.env.FONEPAY_PASSWORD || '').trim();
  const secretKey = (process.env.FONEPAY_SECRET_KEY || '').trim();
  const apiBaseUrl = (
    process.env.FONEPAY_API_BASE_URL || 'https://merchantapi.fonepay.com'
  )
    .trim()
    .replace(/\/+$/, '');

  const isConfigured = Boolean(merchantCode && username && password && secretKey);
  return { merchantCode, username, password, secretKey, apiBaseUrl, isConfigured };
}

function parseSlotToMinutesNpt(timeSlot: string): { hours: number; minutes: number } {
  const match = timeSlot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hours: 9, minutes: 0 };
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

function computeAppointmentTimestampUtcMs(appointmentDate: string, timeSlot: string): number | null {
  const match = appointmentDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const { hours, minutes } = parseSlotToMinutesNpt(timeSlot);
  // Nepal Standard Time is UTC+05:45 (345 minutes ahead of UTC)
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - 345 * 60 * 1000;
  return Number.isFinite(utcMs) ? utcMs : null;
}

// Birtamode, Jhapa, Nepal coordinates for local hospital retrieval bias
const HOSPITAL_LAT_LNG = {
  latitude: 26.6438,
  longitude: 87.9914,
};

const HOSPITAL_SYSTEM_INSTRUCTION = `You are the official Patient Assistance Chatbot for Spine X Superspeciality Hospital & Trauma Center Pvt. Ltd., located at Bhagwan Chowk, Birtamode-3, Jhapa, Nepal.

Verified Hospital Facts (Use ONLY these facts for hospital-specific details; never invent additional doctor qualifications, personal phone numbers, or unlisted fees):
- Hospital Name: Spine X Superspeciality Hospital & Trauma Center Pvt. Ltd.
- Location: Bhagwan Chowk, Birtamode-3, Jhapa, Nepal
- 24/7 Emergency & Helpline Phone / WhatsApp: 9807923351
- Landline Numbers: 023-591068 | 023-591069
- Emergency & OPD: 24-Hour Emergency and Trauma Services, Daily OPD Services
- Departmental Services:
  1. Orthopedic, Neurology and Spine Diseases
  2. Gynecology, Obstetrics and Infertility
  3. Neonatal and Pediatric Diseases
  4. Stomach, Chest, Heart, Diabetes and Rheumatology Diseases
  5. Surgical Services in All Departments
- Other Services & Facilities: Physiotherapy, X-ray and Video X-ray Services, Advanced Laboratory Services, 24-Hour Pharmacy Services, ICU Services, NICU Services, PICU Services, Day Care Surgical Ward, Nursery, Post-operative Ward, Trauma Ward, Medical Ward, Cabin Facilities.
- Consultants:
  1. Dr. Kumud Kumar Limbu — Senior Orthopedic & Rheumatology Specialist — OPD fee NPR 400
  2. Dr. Prem Bahadur Shahi — MS - Orthopedics, Fellowship in Spine Surgery (GRIPMER, India), Microscopic & Neuro-Endoscopic Spine Surgery (SGRH, India), Navigation Spine Surgery Training (Singapore), NMC No. 6802 — Senior Orthopedic, Neuro & Spine Surgeon — Daily Service — OPD fee NPR 400
  3. Dr. Keshar Bahadur Gurung — MBBS, MD — Consultant Physician — OPD fee NPR 500
  4. Dr. Sachin Lal Silpakar — Senior ENT Specialist, NMC No. 4837 — Daily Service — OPD fee NPR 500
  5. Dr. Laxman Rana Magar — MBBS, MS — General and Laparoscopic Surgeon — Daily Service — OPD fee NPR 500
  6. Dr. Dharmapal Ray — MBBS, MD (Pediatrics) (K.U.), PGPN Boston University (USA), Training in Pediatric Asthma (IAP), NMC No. 5550 — Neonatal, Pediatric & Child Nutrition Specialist — Daily Service (OPD fee confirmed at OPD desk)
- Online Booking & Reminders: Patients can book an appointment online on the Book Appointment page, receive a unique Booking ID (SXH-YYYY-XXXXXX), download a Calendar (.ics) or browser reminder, check status anytime on the Check Status page using their Booking ID and registered mobile number, and submit Patient Feedback.

Clinical Safety & Tone Guidelines:
- Be clear, calm, respectful, and concise.
- Never diagnose conditions or prescribe medication. Encourage patients with urgent trauma, chest pain, severe bleeding, or breathing difficulty to call 9807923351 or 023-591068 or visit the 24-Hour Emergency department immediately.
- If asked about unlisted fees or exact appointment times, advise confirming at the hospital OPD desk (9807923351) and checking live open slots on the Book Appointment page.`;

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

  // Non-secret Fonepay merchant configuration & API readiness status
  app.get('/api/payments/fonepay/config', (_req, res) => {
    const fonepay = getFonepayEnvConfig();
    res.json({
      merchantName: 'SPINE X. SUPERSPECIALITY HOSPITAL AND TRAUMA CENTER PRIVATE LIMITED',
      terminalId: FONEPAY_TERMINAL_ID,
      branch: FONEPAY_BRANCH,
      acquiredBy: 'Siddhartha Bank',
      apiConfigured: fonepay.isConfigured,
      verificationMode: fonepay.isConfigured ? 'fonepay_api' : 'manual_admin_verification',
    });
  });

  // Backend structural validation for payment submission before Firestore atomic commit
  app.post('/api/payments/validate-submission', (req, res) => {
    const body = req.body as {
      patientName?: unknown;
      mobileNumber?: unknown;
      amount?: unknown;
      transactionId?: unknown;
      paymentCategory?: unknown;
      hasScreenshot?: unknown;
    };

    const patientName = typeof body.patientName === 'string' ? body.patientName.trim() : '';
    const mobile = typeof body.mobileNumber === 'string' ? body.mobileNumber.replace(/\D/g, '') : '';
    const amount = Number(body.amount);
    const txId =
      typeof body.transactionId === 'string'
        ? body.transactionId.trim().toUpperCase().replace(/\s+/g, '')
        : '';
    const category = body.paymentCategory === 'appointment' ? 'appointment' : 'general';

    if (patientName.length < 2 || patientName.length > 100) {
      res.status(400).json({ valid: false, error: 'Patient full name must be 2–100 characters.' });
      return;
    }
    if (!/^[0-9]{7,15}$/.test(mobile)) {
      res.status(400).json({ valid: false, error: 'Please enter a valid 7 to 15 digit mobile number.' });
      return;
    }
    if (!Number.isFinite(amount) || amount < 10 || amount > 500000) {
      res.status(400).json({
        valid: false,
        error: 'Payment amount must be between NPR 10 and NPR 500,000.',
      });
      return;
    }
    if (!/^[A-Z0-9._-]{4,64}$/.test(txId)) {
      res.status(400).json({
        valid: false,
        error: 'Transaction ID must be 4–64 alphanumeric characters (e.g., Fonepay Ref / Trace ID).',
      });
      return;
    }
    if (!body.hasScreenshot) {
      res.status(400).json({
        valid: false,
        error: 'Please upload your payment confirmation screenshot before submitting.',
      });
      return;
    }

    res.json({
      valid: true,
      normalizedTransactionId: txId,
      normalizedMobile: mobile.startsWith('977') && mobile.length === 13 ? mobile.slice(3) : mobile,
      amount: Math.round(amount),
      paymentCategory: category,
    });
  });

  // Server-side Fonepay Merchant Verification endpoint (requires Firebase ID token for admin check)
  app.post('/api/payments/fonepay/verify', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!idToken) {
        res.status(401).json({ verified: false, error: 'Authentication required for payment verification.' });
        return;
      }

      const decoded = await adminAuth.verifyIdToken(idToken);
      if (!decoded.email_verified) {
        res.status(403).json({ verified: false, error: 'Verified Google email required.' });
        return;
      }

      const { paymentRef, transactionId, amount } = req.body as {
        paymentRef?: unknown;
        transactionId?: unknown;
        amount?: unknown;
      };

      const cleanRef = typeof paymentRef === 'string' ? paymentRef.trim() : '';
      const cleanTx =
        typeof transactionId === 'string'
          ? transactionId.trim().toUpperCase().replace(/\s+/g, '')
          : '';
      const numericAmount = Number(amount);

      if (!cleanRef || !cleanTx || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        res.status(400).json({ verified: false, error: 'Invalid payment verification parameters.' });
        return;
      }

      const fonepay = getFonepayEnvConfig();
      if (!fonepay.isConfigured) {
        res.json({
          verified: false,
          mode: 'manual_admin_verification',
          isAdminCaller: decoded.email === BOOTSTRAP_ADMIN_EMAIL,
          message:
            'Official Fonepay Merchant API credentials are not configured on the server. Authorized administrators must manually inspect the Fonepay statement & receipt screenshot before verifying.',
        });
        return;
      }

      // Official Fonepay Merchant Verification API HMAC-SHA512 signature & verification call
      const prn = cleanRef;
      const amt = numericAmount.toFixed(2);
      const dataToSign = `${fonepay.merchantCode},${amt},${prn},${cleanTx}`;
      const dv = crypto
        .createHmac('sha512', fonepay.secretKey)
        .update(dataToSign)
        .digest('hex')
        .toUpperCase();

      const verifyUrl = `${fonepay.apiBaseUrl}/api/merchant/merchantDetailsForThirdParty/txnVerification`;
      const params = new URLSearchParams({
        PRN: prn,
        PID: fonepay.merchantCode,
        BID: cleanTx,
        UID: cleanTx,
        AMT: amt,
        DV: dv,
      });

      const apiResp = await fetch(`${verifyUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/xml',
          Authorization: `Basic ${Buffer.from(`${fonepay.username}:${fonepay.password}`).toString('base64')}`,
        },
      });

      const bodyText = await apiResp.text();
      const upper = bodyText.toUpperCase();
      const confirmedSuccess =
        apiResp.ok &&
        (upper.includes('<SUCCESS>TRUE</SUCCESS>') ||
          upper.includes('"SUCCESS":TRUE') ||
          upper.includes('"RESPONSE_CODE":"SUCCESS"'));

      res.json({
        verified: confirmedSuccess,
        mode: 'fonepay_api',
        fonepayTraceId: confirmedSuccess ? cleanTx : null,
        message: confirmedSuccess
          ? 'Transaction verified via official Fonepay Merchant API.'
          : 'Fonepay Merchant API did not confirm this transaction as settled.',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to verify payment request.';
      res.status(500).json({ verified: false, error: msg });
    }
  });

  // Authoritative server-side Refund Eligibility check (Nepal Standard Time UTC+05:45)
  app.post('/api/refunds/validate-eligibility', (req, res) => {
    const body = req.body as {
      appointmentDate?: unknown;
      timeSlot?: unknown;
      appointmentStatus?: unknown;
      paymentVerificationStatus?: unknown;
      amount?: unknown;
    };

    const appointmentDate = typeof body.appointmentDate === 'string' ? body.appointmentDate.trim() : '';
    const timeSlot = typeof body.timeSlot === 'string' ? body.timeSlot.trim() : '09:00 AM';
    const appointmentStatus =
      typeof body.appointmentStatus === 'string' ? body.appointmentStatus.trim() : '';
    const paymentVerificationStatus =
      typeof body.paymentVerificationStatus === 'string' ? body.paymentVerificationStatus.trim() : '';
    const amount = Number(body.amount);

    if (paymentVerificationStatus !== 'verified') {
      res.json({
        eligible: false,
        refundPercentage: 0,
        eligibilityType: null,
        hoursUntilAppointment: null,
        reason: 'Only verified payments are eligible for a refund request.',
      });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      res.json({
        eligible: false,
        refundPercentage: 0,
        eligibilityType: null,
        hoursUntilAppointment: null,
        reason: 'Invalid paid amount for refund.',
      });
      return;
    }

    // Hospital-cancelled (or rejected by hospital) appointments are always eligible for 100% refund
    if (appointmentStatus === 'cancelled' || appointmentStatus === 'rejected') {
      res.json({
        eligible: true,
        refundPercentage: 100,
        eligibilityType: 'hospital_cancelled',
        hoursUntilAppointment: null,
        reason:
          'Hospital-cancelled appointment: eligible for a 100% refund regardless of the 24-hour window.',
      });
      return;
    }

    if (appointmentStatus === 'completed') {
      res.json({
        eligible: false,
        refundPercentage: 0,
        eligibilityType: null,
        hoursUntilAppointment: 0,
        reason: 'Completed consultations are not eligible for an online refund.',
      });
      return;
    }

    if (!appointmentDate) {
      res.json({
        eligible: true,
        refundPercentage: 100,
        eligibilityType: 'standard_24h',
        hoursUntilAppointment: null,
        reason: 'General hospital payment eligible for Accounts Desk refund review.',
      });
      return;
    }

    const apptUtcMs = computeAppointmentTimestampUtcMs(appointmentDate, timeSlot);
    if (apptUtcMs === null) {
      res.status(400).json({
        eligible: false,
        error: 'Invalid appointment date or time slot.',
      });
      return;
    }

    const hoursUntil = (apptUtcMs - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil >= 24) {
      res.json({
        eligible: true,
        refundPercentage: 100,
        eligibilityType: 'standard_24h',
        hoursUntilAppointment: Math.floor(hoursUntil),
        reason: `Eligible for refund (${Math.floor(hoursUntil)} hours remaining before appointment).`,
      });
      return;
    }

    res.json({
      eligible: false,
      refundPercentage: 0,
      eligibilityType: null,
      hoursUntilAppointment: Number(hoursUntil.toFixed(1)),
      reason:
        'Normal refund requests are unavailable within 24 hours of the scheduled appointment (unless cancelled by the hospital).',
    });
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
      app.use(express.static(distDir, { index: false }));
      app.get('*', (_req, res) => {
        const indexPath = path.join(distDir, 'index.html');
        const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
        if (!appUrl) {
          res.sendFile(indexPath);
          return;
        }
        try {
          const safeAppUrl = appUrl.replace(/"/g, '&quot;');
          const html = fs.readFileSync(indexPath, 'utf8');
          const injected = html.replace(
            '</head>',
            `    <link rel="canonical" href="${safeAppUrl}/" />\n    <meta property="og:url" content="${safeAppUrl}/" />\n  </head>`
          );
          res.type('html').send(injected);
        } catch {
          res.sendFile(indexPath);
        }
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
