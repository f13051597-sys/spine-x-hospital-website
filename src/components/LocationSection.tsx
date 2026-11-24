import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  PhoneCall,
  Search,
} from 'lucide-react';
import React, { useState } from 'react';
import { HOSPITAL_INFO } from '../data/hospitalCatalog';

const BIRTAMODE_CENTER = { lat: 26.6438, lng: 87.9914 };

interface MapsPlaceResult {
  title: string;
  uri: string;
  snippets: string[];
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function InteractiveHospitalMap({ apiKey }: { apiKey: string }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);

  return (
    <APIProvider apiKey={apiKey} language="en" region="NP">
      <div className="w-full h-[360px] lg:h-[420px]">
        <GoogleMap
          defaultCenter={BIRTAMODE_CENTER}
          defaultZoom={15}
          mapId="DEMO_MAP_ID"
          gestureHandling="cooperative"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker
            ref={markerRef}
            position={BIRTAMODE_CENTER}
            title={HOSPITAL_INFO.name}
            onClick={() => setInfoOpen(true)}
          >
            <Pin background="#0F4C81" borderColor="#0B3A63" glyphColor="#FFFFFF" />
          </AdvancedMarker>

          {infoOpen && marker && (
            <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
              <div className="p-1 max-w-[220px] space-y-1 text-slate-900">
                <div className="font-display font-semibold text-xs leading-snug">
                  {HOSPITAL_INFO.name}
                </div>
                <div className="text-[11px] text-slate-600">{HOSPITAL_INFO.address}</div>
                <div className="text-[11px] font-mono font-medium text-[#0F4C81]">
                  24/7 Helpline: {HOSPITAL_INFO.phone}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </APIProvider>
  );
}

const PRESET_MAPS_QUERIES = [
  'Pharmacies and diagnostic centers near Birtamode, Jhapa',
  'Birtamode Bus Park and major transit stops near Jhapa',
  'Hotels and lodges for patient families in Birtamode, Jhapa',
];

export function LocationSection() {
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';

  const [mapsQuery, setMapsQuery] = useState('');
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsAnswer, setMapsAnswer] = useState<string>('');
  const [mapsPlaces, setMapsPlaces] = useState<MapsPlaceResult[]>([]);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locating, setLocating] = useState(false);

  const runMapsGrounding = async (queryText: string) => {
    const clean = queryText.trim();
    if (clean.length < 2) return;
    setMapsQuery(clean);
    setMapsLoading(true);
    setMapsError(null);
    try {
      const res = await fetch('/api/grounding/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clean,
          latLng: userCoords || BIRTAMODE_CENTER,
        }),
      });
      const data = (await res.json()) as {
        answer?: string;
        places?: MapsPlaceResult[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to retrieve Google Maps data.');
      }
      setMapsAnswer(data.answer || '');
      setMapsPlaces(Array.isArray(data.places) ? data.places : []);
    } catch (err) {
      setMapsError(
        err instanceof Error ? err.message : 'Unable to load Google Maps Grounding results.'
      );
    } finally {
      setMapsLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setMapsError('Geolocation is not supported in this browser.');
      return;
    }
    setLocating(true);
    setMapsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setMapsError('Location permission denied. Using Birtamode, Jhapa hospital coordinates.');
      },
      { timeout: 8000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runMapsGrounding(mapsQuery);
  };

  return (
    <section className="py-16 lg:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
        <div className="space-y-2.5 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Hospital Location &amp; Google Maps
          </p>
          <h2
            className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-950"
            style={{ textWrap: 'balance' }}
          >
            Visit Spine X Hospital in Birtamode, Jhapa
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          <div className="lg:col-span-5 surface-card rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-slate-50/60">
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-950">
                  {HOSPITAL_INFO.name}
                </h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Serving Birtamode, Jhapa, and eastern Nepal with 24/7 emergency trauma care and
                  outpatient specialist consultations.
                </p>
              </div>

              <div className="space-y-4 pt-5 border-t border-slate-200/80 text-sm">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-4.5 h-4.5 text-[#0F4C81]" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">Hospital Address</div>
                    <div className="text-slate-600 mt-0.5">{HOSPITAL_INFO.address}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <PhoneCall className="w-4.5 h-4.5 text-emerald-700" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">24/7 Emergency &amp; OPD Desk</div>
                    <a
                      href={HOSPITAL_INFO.phoneHref}
                      className="font-mono tabular-nums font-bold text-[#0F4C81] hover:underline mt-0.5 inline-block"
                    >
                      {HOSPITAL_INFO.phone}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 pt-2">
              <a
                href={HOSPITAL_INFO.mapsQueryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0A365C] shadow-xs transition-all"
              >
                <span>Open Directions in Google Maps</span>
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>

              <a
                href={HOSPITAL_INFO.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-emerald-600/30 bg-emerald-50 text-emerald-900 text-sm font-semibold hover:bg-emerald-100 transition-all"
              >
                <MessageCircle className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <span>Message on WhatsApp</span>
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 min-h-[360px] lg:min-h-[420px] rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-100 shadow-sm">
            {mapsApiKey ? (
              <InteractiveHospitalMap apiKey={mapsApiKey} />
            ) : (
              <iframe
                title="Spine X Superspeciality Hospital Location - Birtamode, Jhapa, Nepal"
                src={HOSPITAL_INFO.mapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full min-h-[360px] lg:min-h-[420px] border-0"
              />
            )}
          </div>
        </div>

        {/* Google Maps Grounding Explorer */}
        <div className="surface-card rounded-2xl p-6 sm:p-8 bg-slate-50/70 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="font-display text-base sm:text-lg font-bold text-slate-950 flex items-center gap-2">
                <Compass className="w-4.5 h-4.5 text-[#0F4C81]" aria-hidden="true" />
                <span>Nearby Places &amp; Transit Guide (Google Maps Data)</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Explore verified pharmacies, transit stops, and patient-family accommodations around
                Birtamode using Google Maps Grounding.
              </p>
            </div>

            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {locating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F4C81]" aria-hidden="true" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-[#0F4C81]" aria-hidden="true" />
              )}
              <span>{userCoords ? 'Location Active' : 'Use My Location'}</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={mapsQuery}
                onChange={(e) => setMapsQuery(e.target.value)}
                placeholder="Ask about nearby pharmacies, bus parks, ATMs, or lodges in Birtamode..."
                className="clinical-input pl-10 pr-3.5 py-2.5 text-sm min-h-[44px]"
              />
            </div>
            <button
              type="submit"
              disabled={mapsLoading || mapsQuery.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0F4C81] text-white text-sm font-semibold hover:bg-[#0A365C] disabled:bg-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {mapsLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>Find Nearby</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {PRESET_MAPS_QUERIES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => void runMapsGrounding(preset)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-[#0F4C81] hover:text-[#0F4C81] shadow-2xs transition-colors cursor-pointer text-left"
              >
                {preset}
              </button>
            ))}
          </div>

          {mapsError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium"
            >
              {mapsError}
            </div>
          )}

          {(mapsAnswer || mapsPlaces.length > 0) && (
            <div className="pt-5 border-t border-slate-200/80 space-y-4">
              {mapsAnswer && (
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-slate-200/80">
                  {mapsAnswer}
                </div>
              )}

              {mapsPlaces.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Google Maps Places &amp; Directions Links
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {mapsPlaces.map((place) =>
                      isSafeHttpUrl(place.uri) ? (
                        <a
                          key={place.uri}
                          href={place.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="surface-card surface-card-hover p-4 rounded-xl block space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-[#0F4C81]">
                              {place.title}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </div>
                          {place.snippets.map((snippet, idx) => (
                            <p key={idx} className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              “{snippet}”
                            </p>
                          ))}
                        </a>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
