import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  BrickWall,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Copy,
  DollarSign,
  Download,
  Droplets,
  FileText,
  HardHat,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Wind,
  Zap,
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

function normalizePermit(attributes, fields, index) {
  const get = (key) => (fields[key] ? attributes[fields[key]] : undefined);
  return {
    id: `${clean(get('permitNum')) || 'permit'}-${index}`,
    permitNum: clean(get('permitNum')),
    address: clean(get('address')),
    description: clean(get('description')),
    value: toNumber(get('value')),
    applicant: clean(get('applicant')),
    contractor: clean(get('contractor')),
    filedDate: formatDate(get('date')),
  };
}

function leadSummary(permit) {
  return [
    `Permit: ${permit.permitNum || 'N/A'}`,
    `Address: ${permit.address || 'N/A'}`,
    `Value: ${currency.format(permit.value)}`,
    `Applicant: ${permit.applicant || 'N/A'}`,
    `Contractor: ${permit.contractor || 'N/A'}`,
    `Scope: ${permit.description || 'N/A'}`,
  ].join('\n');
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(permits) {
  const header = ['Permit #', 'Address', 'Description', 'Declared Value', 'Applicant', 'Contractor'];
  const rows = permits.map((p) =>
    [p.permitNum, p.address, p.description, p.value, p.applicant, p.contractor].map(csvCell).join(',')
  );
  const blob = new Blob([[header.map(csvCell).join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fort-worth-commercial-permits-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-1 truncate text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

const TRADE_ICONS = {
  electrical: Zap,
  plumbing: Droplets,
  hvac: Wind,
  concrete: BrickWall,
};

const TRADE_STATUS = {
  missing: { label: 'Likely missing', className: 'bg-orange-100 text-orange-800 ring-orange-200', icon: CircleAlert },
  covered: { label: 'In scope', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CircleCheck },
  unlikely: { label: 'Not needed', className: 'bg-slate-100 text-slate-500 ring-slate-200', icon: CircleMinus },
};

const ANALYSIS_DELAY_MS = 900;

function TradeRow({ trade }) {
  const Icon = TRADE_ICONS[trade.key];
  const status = TRADE_STATUS[trade.status];
  const StatusIcon = status.icon;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <div
        className={`rounded-lg p-1.5 ${trade.status === 'missing' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-slate-800">{trade.name}</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.className}`}
          >
            <StatusIcon className="h-3 w-3" aria-hidden="true" />
            {status.label}
          </span>
          <span className="ml-auto text-xs text-slate-400">{trade.likelihood} need</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{trade.reason}</p>
      </div>
    </li>
  );
}

function AnalysisPanel({ analysis, description }) {
  return (
    <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-900">
          <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />
          Trade needs analysis
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
          Simulated
        </span>
      </div>

      <div className="mt-3 text-xs text-slate-500">Project type</div>
      <div className="text-sm font-medium text-slate-800">{analysis.projectType}</div>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span>Confidence</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${analysis.confidence}%` }} />
        </div>
        <span className="tabular-nums font-medium text-slate-700">{analysis.confidence}%</span>
      </div>

      <p className="mt-3 text-sm text-slate-700">{analysis.summary}</p>

      <ul className="mt-2 divide-y divide-violet-100">
        {analysis.trades.map((trade) => (
          <TradeRow key={trade.key} trade={trade} />
        ))}
      </ul>

      <p className="mt-3 border-t border-violet-100 pt-3 text-xs italic text-slate-500">
        Based on: “{description || 'No description filed'}”
      </p>
    </div>
  );
}

function PermitCard({ permit }) {
  const [copied, setCopied] = useState(false);
  const [analysisState, setAnalysisState] = useState('idle');
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const analysis = useMemo(
    () => (analysisState === 'done' ? analyzeNeeds(permit.description, permit.value) : null),
    [analysisState, permit.description, permit.value]
  );

  const handleAnalyze = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    if (analysisState === 'idle') {
      setAnalysisState('loading');
      timerRef.current = setTimeout(() => setAnalysisState('done'), ANALYSIS_DELAY_MS);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(leadSummary(permit));
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
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Declared value</div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{currency.format(permit.value)}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {permit.permitNum && (
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">
              {permit.permitNum}
            </span>
          )}
          {permit.filedDate && <span className="text-[11px] text-slate-400">Filed {permit.filedDate}</span>}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-xs text-slate-400">Address</div>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-sm font-semibold text-slate-800 hover:text-orange-600 hover:underline"
              >
                {permit.address}
              </a>
            ) : (
              <div className="text-sm font-semibold text-slate-400">No address listed</div>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <HardHat className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-xs text-slate-400">Contractor</div>
            <div className={`break-words text-sm font-semibold ${permit.contractor ? 'text-slate-800' : 'text-slate-400'}`}>
              {permit.contractor || 'Not listed'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={handleAnalyze}
          aria-expanded={isOpen}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            isOpen ? 'bg-violet-100 text-violet-800 hover:bg-violet-200' : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {isOpen ? 'Hide analysis' : 'Analyze Needs'}
          {isOpen ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy lead details"
          aria-label="Copy lead details"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 text-slate-500 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {isOpen && analysisState === 'loading' && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-4 text-sm text-violet-800">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Analyzing permit scope…
        </div>
      )}
      {isOpen && analysis && <AnalysisPanel analysis={analysis} description={permit.description} />}
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
      <div className="h-3 w-24 rounded bg-slate-200" />
      <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
      <div className="mt-4 h-3 w-full rounded bg-slate-100" />
      <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
      <div className="mt-6 h-3 w-1/2 rounded bg-slate-100" />
      <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
    </div>
  );
}

const SORTS = {
  default: { label: 'Feed order', fn: null },
  valueDesc: { label: 'Highest value', fn: (a, b) => b.value - a.value },
  valueAsc: { label: 'Lowest value', fn: (a, b) => a.value - b.value },
};

export default function LeadMachine() {
  const [permits, setPermits] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');

  const loadPermits = useCallback(async (signal) => {
    setStatus('loading');
    setError('');
    try {
      const { features, fields } = await fetchCommercialPermits(signal);
      setPermits(features.map((attributes, i) => normalizePermit(attributes, fields, i)));
      setLastUpdated(new Date());
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

  const visiblePermits = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? permits.filter((p) =>
          [p.permitNum, p.address, p.description, p.applicant, p.contractor]
            .join(' ')
            .toLowerCase()
            .includes(term)
        )
      : permits;
    const sorter = SORTS[sort].fn;
    return sorter ? [...filtered].sort(sorter) : filtered;
  }, [permits, query, sort]);

  const stats = useMemo(() => {
    const total = permits.reduce((sum, p) => sum + p.value, 0);
    const top = permits.reduce((best, p) => (!best || p.value > best.value ? p : best), null);
    const contractors = new Set(permits.map((p) => p.contractor).filter(Boolean));
    return {
      count: permits.length,
      total,
      average: permits.length ? total / permits.length : 0,
      top,
      contractorCount: contractors.size,
    };
  }, [permits]);

  const isLoading = status === 'loading';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-500 p-2">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">Fort Worth Lead Machine</h1>
              <p className="text-sm text-slate-300">Latest commercial building permits from the City of Fort Worth</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadCsv(visiblePermits)}
              disabled={isLoading || visiblePermits.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => loadPermits()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={FileText} label="Permits loaded" value={isLoading ? '…' : stats.count} />
          <StatCard
            icon={DollarSign}
            label="Total declared value"
            value={isLoading ? '…' : compactCurrency.format(stats.total)}
            hint={!isLoading && stats.count ? `Avg ${currency.format(stats.average)} per permit` : null}
          />
          <StatCard
            icon={Building2}
            label="Largest project"
            value={isLoading || !stats.top ? '…' : compactCurrency.format(stats.top.value)}
            hint={!isLoading && stats.top ? stats.top.address : null}
          />
          <StatCard icon={HardHat} label="Unique contractors" value={isLoading ? '…' : stats.contractorCount} />
        </section>

        <section className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address, contractor, applicant…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
            <label className="inline-flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm outline-none focus:border-orange-400"
              >
                {Object.entries(SORTS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="mt-6">
          {status === 'error' && (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-semibold">Couldn't load permits</div>
                  <div className="text-sm">{error}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadPermits()}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {status === 'ready' && visiblePermits.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              {permits.length === 0 ? 'No commercial permits were returned.' : 'No permits match your search.'}
            </div>
          )}

          {status === 'ready' && visiblePermits.length > 0 && (
            <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visiblePermits.map((permit) => (
                <PermitCard key={permit.id} permit={permit} />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 text-center text-xs text-slate-400">
          Data: City of Fort Worth Development Permits (ArcGIS FeatureServer)
        </footer>
      </main>
    </div>
  );
}
