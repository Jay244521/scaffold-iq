import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  HardHat,
  Layers,
  LoaderCircle,
  Mail,
  MapPin,
  Pickaxe,
  RefreshCw,
  Settings,
  User,
} from 'lucide-react';
import { analyzeNeeds } from './analyzeNeeds';
import { fetchCommercialPermits } from './permitsApi';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const TILE_SIZE = 56;
const GRID_COLUMNS = 5;

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : value ?? '';
}

function formatDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Building height on the map scales with the log of the declared value, so a
// $100M project towers over a $50K one without dwarfing everything else.
function buildingHeight(value) {
  if (value <= 0) return 6;
  const height = 10 + (Math.log10(value) - 3.5) * 28;
  return Math.round(Math.min(150, Math.max(8, height)));
}

function normalizePermit(attributes, fields, index) {
  const get = (key) => (fields[key] ? attributes[fields[key]] : undefined);
  const description = clean(get('description'));
  const value = toNumber(get('value'));
  const analysis = analyzeNeeds(description, value);
  const typeLabel = [clean(get('type')), clean(get('subtype'))].filter(Boolean).join(' · ');
  return {
    id: `${clean(get('permitNum')) || 'permit'}-${index}`,
    permitNum: clean(get('permitNum')),
    address: clean(get('address')),
    description,
    value,
    contractor: clean(get('contractor')),
    owner: clean(get('applicant')),
    status: clean(get('status')),
    zoning: clean(get('zoning')),
    filedDate: formatDate(get('date')),
    typeLabel,
    analysis,
    needs: analysis.trades.filter((t) => t.status === 'missing').map((t) => t.name),
    height: buildingHeight(value),
  };
}

function joinNeeds(needs) {
  if (needs.length === 0) return '';
  if (needs.length === 1) return `${needs[0]} work`;
  return `${needs[0]} and ${needs[1]} work`;
}

function outreachEmail(permit) {
  const trade = permit.needs[0] || 'Trade';
  const greeting = permit.contractor ? `Hi ${permit.contractor} team,` : 'Hi there,';
  const stage = permit.status ? ` (currently ${permit.status.toLowerCase()})` : '';
  const project = permit.analysis.projectType.split(' · ')[0].toLowerCase();
  const gapLine = permit.needs.length
    ? `Based on the scope filed with the city, it looks like ${joinNeeds(permit.needs)} may still need to be lined up.`
    : 'If you are still lining up subcontractors for any part of the scope, we would like to bid.';
  return `Subject: ${trade} crew available for ${permit.address || 'your Fort Worth project'}

${greeting}

I saw the permit${permit.permitNum ? ` ${permit.permitNum}` : ''} for the ${project} project at ${permit.address || 'your Fort Worth site'}${stage}. ${gapLine}

We are a local Fort Worth crew with availability in the coming weeks. Do you have 5 minutes next week to talk about bidding on this scope?

Best,
[Your Name]
[Company] · [Phone]`;
}

function IsometricBuilding({ permit, active, onClick }) {
  const s = TILE_SIZE;
  const h = permit.height;
  const top = active ? 'bg-cyan-300' : 'bg-slate-300';
  const front = active ? 'bg-cyan-500' : 'bg-slate-400';
  const side = active ? 'bg-cyan-700' : 'bg-slate-500';
  const face = 'absolute border border-black/20';

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${permit.address || 'No address'} · ${currency.format(permit.value)}`}
      aria-label={`Select ${permit.address || 'permit'} (${currency.format(permit.value)})`}
      aria-pressed={active}
      className="relative block cursor-pointer focus:outline-none"
      style={{ width: s, height: s, transformStyle: 'preserve-3d' }}
    >
      <div className={`absolute inset-0 border ${active ? 'border-cyan-400 bg-cyan-950/60' : 'border-zinc-700 bg-zinc-800/80'}`} />
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        {/* Front face along the tile's bottom edge, raised into the Z axis. */}
        <div
          className={`${face} ${front}`}
          style={{ left: 0, top: s, width: s, height: h, transformOrigin: 'top', transform: 'rotateX(90deg)' }}
        />
        {/* Side face along the tile's left edge (the other edge facing the viewer after the grid's -45deg turn). */}
        <div
          className={`${face} ${side}`}
          style={{ left: 0, top: 0, width: h, height: s, transformOrigin: 'left', transform: 'rotateY(-90deg)' }}
        />
        {/* Roof. */}
        <div className={`${face} ${top}`} style={{ inset: 0, transform: `translateZ(${h}px)` }} />
      </div>
    </button>
  );
}

function SectionLabel({ icon: Icon, children, accent }) {
  return (
    <div
      className={`mb-3 flex items-center gap-2 text-xs uppercase tracking-widest ${accent ? 'text-cyan-500' : 'text-zinc-500'}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </div>
  );
}

function Dossier({ permit, index, total, onStep }) {
  const [draftEmail, setDraftEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const mapsUrl = permit.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${permit.address}, Fort Worth, TX`)}`
    : null;

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs uppercase tracking-widest text-zinc-500">
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Site dossier | {permit.permitNum || 'No permit #'}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onStep(-1)}
              aria-label="Previous site"
              className="rounded p-1 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              {index + 1}/{total}
            </span>
            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label="Next site"
              className="rounded p-1 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </span>
        </div>
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 block break-words text-2xl font-bold text-white hover:text-cyan-400"
          >
            {permit.address}
          </a>
        ) : (
          <h2 className="mb-2 text-2xl font-bold text-zinc-500">No address listed</h2>
        )}
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded border border-emerald-800/50 bg-emerald-900/40 px-2 py-1 text-emerald-400">
            {permit.analysis.projectType.split(' · ')[0].toUpperCase()}
          </span>
          {permit.typeLabel && (
            <span className="rounded border border-cyan-800/50 bg-cyan-900/40 px-2 py-1 text-cyan-400">
              {permit.typeLabel.toUpperCase()}
            </span>
          )}
          {permit.status && (
            <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300">
              {permit.status.toUpperCase()}
            </span>
          )}
        </div>
        {permit.filedDate && <div className="mt-2 text-xs text-zinc-500">Filed {permit.filedDate}</div>}
      </div>

      <div className="grid grid-cols-2 gap-4 border-y border-zinc-800 py-6">
        <div>
          <div className="mb-1 text-xs uppercase text-zinc-500">Reported cost</div>
          <div className="break-words text-2xl font-bold text-emerald-400 sm:text-3xl">{currency.format(permit.value)}</div>
        </div>
        <div>
          <div className="mb-1 text-xs uppercase text-zinc-500">{permit.zoning ? 'Zoning code' : 'Owner / applicant'}</div>
          <div className="break-words text-lg font-medium text-white">
            {permit.zoning || permit.owner || <span className="text-zinc-500">Not listed</span>}
          </div>
        </div>
      </div>

      <div>
        <SectionLabel icon={FileText}>The work described</SectionLabel>
        <p className="border-l-2 border-cyan-900 pl-4 leading-relaxed text-zinc-300">
          {permit.description || <span className="text-zinc-500">No description filed.</span>}
        </p>
      </div>

      <div>
        <SectionLabel icon={Settings} accent>
          The manifest · missing trades
        </SectionLabel>
        {permit.needs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {permit.needs.map((need) => (
              <span
                key={need}
                className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300"
              >
                <Pickaxe className="h-3 w-3" aria-hidden="true" /> {need}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">The filed scope already covers the major trades.</p>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          {permit.analysis.summary} Simulated from the permit description ({permit.analysis.confidence}% confidence).
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-4">
          <div className="mb-1 text-xs uppercase text-zinc-500">General contractor</div>
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <HardHat className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" />
            <span className="break-words">{permit.contractor || <span className="text-zinc-500">Not listed</span>}</span>
          </div>
          {permit.owner && permit.zoning && (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <User className="h-3.5 w-3.5" aria-hidden="true" /> Owner / applicant: {permit.owner}
            </div>
          )}
        </div>

        {!draftEmail ? (
          <button
            type="button"
            onClick={() => setDraftEmail(outreachEmail(permit))}
            className="flex w-full items-center justify-center gap-2 rounded bg-cyan-600 py-3 font-bold text-white transition-colors hover:bg-cyan-500"
          >
            <Mail className="h-4 w-4" aria-hidden="true" /> Generate outreach
          </button>
        ) : (
          <div>
            <div className="mb-2 text-xs text-cyan-500">OUTREACH DRAFT · EDIT BEFORE SENDING</div>
            <textarea
              aria-label="Outreach draft"
              className="h-64 w-full resize-none rounded border border-zinc-700 bg-zinc-900 p-4 text-zinc-300 focus:border-cyan-500 focus:outline-none"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
            />
            <div className="mt-2 flex items-center gap-4 text-xs">
              <button type="button" onClick={copyDraft} className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy draft'}
              </button>
              <button type="button" onClick={() => setDraftEmail('')} className="text-zinc-500 hover:text-zinc-300">
                Clear draft
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContractorBook({ permits, onSelect }) {
  const contractors = useMemo(() => {
    const byName = new Map();
    for (const permit of permits) {
      const name = permit.contractor || 'Contractor not listed';
      const entry = byName.get(name) || { name, total: 0, permits: [] };
      entry.total += permit.value;
      entry.permits.push(permit);
      byName.set(name, entry);
    }
    return [...byName.values()].sort((a, b) => b.total - a.total);
  }, [permits]);

  return (
    <ul className="divide-y divide-zinc-800">
      {contractors.map((c) => (
        <li key={c.name} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className={`flex min-w-0 items-center gap-2 font-bold ${c.name === 'Contractor not listed' ? 'text-zinc-500' : 'text-white'}`}>
              <HardHat className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
              <span className="break-words">{c.name}</span>
            </div>
            <span className="shrink-0 text-emerald-400">{compactCurrency.format(c.total)}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {c.permits.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className="flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <span className="truncate">{p.address || 'No address'}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Manifest({ permits, selectedId, onSelect }) {
  return (
    <ul className="divide-y divide-zinc-800">
      {permits.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onSelect(p.id)}
            className={`w-full p-5 text-left hover:bg-zinc-800/60 ${p.id === selectedId ? 'bg-cyan-950/30' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`break-words font-bold ${p.id === selectedId ? 'text-cyan-400' : 'text-white'}`}>
                {p.address || 'No address'}
              </span>
              <span className="shrink-0 text-emerald-400">{compactCurrency.format(p.value)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.needs.length > 0 ? (
                p.needs.map((need) => (
                  <span key={need} className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                    {need}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-zinc-500">No gaps flagged</span>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

const TABS = [
  { key: 'sites', label: 'The Sites' },
  { key: 'contractors', label: 'Contractor Book' },
  { key: 'manifest', label: 'The Manifest' },
];

export default function LeadMachine() {
  const [permits, setPermits] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('sites');

  const loadPermits = useCallback(async (signal) => {
    setStatus('loading');
    setError('');
    try {
      const { features, fields } = await fetchCommercialPermits(signal);
      const next = features.map((attributes, i) => normalizePermit(attributes, fields, i));
      setPermits(next);
      setSelectedId((current) => (next.some((p) => p.id === current) ? current : next[0]?.id ?? null));
      setStatus('ready');
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Unable to load permits.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadPermits(controller.signal);
    return () => controller.abort();
  }, [loadPermits]);

  const selectedIndex = permits.findIndex((p) => p.id === selectedId);
  const selected = selectedIndex >= 0 ? permits[selectedIndex] : null;

  const selectPermit = (id) => {
    setSelectedId(id);
    setTab('sites');
  };

  const step = (delta) => {
    if (permits.length === 0) return;
    const next = (selectedIndex + delta + permits.length) % permits.length;
    setSelectedId(permits[next].id);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-zinc-950 font-mono text-sm text-zinc-300 lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Left: isometric site map */}
      <div className="relative flex h-[60vh] min-h-[420px] items-center justify-center overflow-hidden border-b border-zinc-800 lg:h-auto lg:flex-1 lg:border-b-0 lg:border-r">
        <div className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-4 sm:left-6 sm:top-6">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-wider text-zinc-100 sm:text-2xl">
              <Layers className="h-6 w-6 shrink-0 text-cyan-500" aria-hidden="true" />
              CFW JOB-SITE MACHINE
            </h1>
            <p className="text-xs text-zinc-500 sm:text-sm">Latest Fort Worth commercial permits · City open data</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 border border-black/20 bg-slate-400" /> Site
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 border border-black/20 bg-cyan-500" /> Selected
              </span>
              <span className="text-zinc-500">Height = declared value</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadPermits()}
            disabled={status === 'loading'}
            aria-label="Refresh permits"
            className="shrink-0 rounded border border-zinc-700 p-2 text-zinc-400 hover:border-cyan-600 hover:text-cyan-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {status === 'loading' && (
          <div className="flex items-center gap-2 text-zinc-500">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Pulling permits from the city…
          </div>
        )}

        {status === 'error' && (
          <div className="mx-6 mt-24 max-w-md rounded-lg border border-red-900/60 bg-red-950/40 p-5 text-red-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <div className="font-bold">Couldn't load permits</div>
                <div className="mt-1 break-words text-xs">{error}</div>
                <button
                  type="button"
                  onClick={() => loadPermits()}
                  className="mt-3 rounded bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'ready' && permits.length === 0 && (
          <p className="text-zinc-500">No commercial permits were returned.</p>
        )}

        {status === 'ready' && permits.length > 0 && (
          <div className="mt-24 origin-center scale-[0.62] sm:scale-90 lg:mt-12 lg:scale-100">
            <div
              className="grid gap-7"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${TILE_SIZE}px)`,
                transform: 'rotateX(60deg) rotateZ(-45deg)',
                transformStyle: 'preserve-3d',
              }}
            >
              {permits.map((permit) => (
                <IsometricBuilding
                  key={permit.id}
                  permit={permit}
                  active={permit.id === selectedId}
                  onClick={() => selectPermit(permit.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: data and lead generation panel */}
      <div className="flex w-full flex-col bg-zinc-900 lg:h-full lg:w-[450px] lg:overflow-y-auto">
        <div className="sticky top-0 z-10 flex border-b border-zinc-800 bg-zinc-900 text-[11px] font-bold uppercase tracking-widest text-zinc-500 sm:text-xs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 border-b-2 py-4 ${t.key === tab ? 'border-cyan-500 text-cyan-400' : 'border-transparent hover:text-zinc-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {status === 'ready' && tab === 'sites' && selected && (
          <Dossier key={selected.id} permit={selected} index={selectedIndex} total={permits.length} onStep={step} />
        )}
        {status === 'ready' && tab === 'contractors' && <ContractorBook permits={permits} onSelect={selectPermit} />}
        {status === 'ready' && tab === 'manifest' && (
          <Manifest permits={permits} selectedId={selectedId} onSelect={selectPermit} />
        )}
        {status !== 'ready' && <p className="p-6 text-zinc-600">Site details appear once permits load.</p>}
      </div>
    </div>
  );
}
