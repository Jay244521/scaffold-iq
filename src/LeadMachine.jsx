import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Check,
  Copy,
  DollarSign,
  Download,
  FileText,
  HardHat,
  MapPin,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';

const PERMITS_URL =
  "https://services.arcgis.com/Wl7Y1m92PbjtJs5n/arcgis/rest/services/CFW_Development_Permits_Table/FeatureServer/0/query?where=PermitType%3D'Commercial+Building'&outFields=PermitNum,OriginalAddress,Description,DeclaredValue,ApplicantName,ContractorName&f=pjson&resultRecordCount=20";

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

function normalizePermit(attributes, index) {
  return {
    id: `${clean(attributes.PermitNum) || 'permit'}-${index}`,
    permitNum: clean(attributes.PermitNum),
    address: clean(attributes.OriginalAddress),
    description: clean(attributes.Description),
    value: toNumber(attributes.DeclaredValue),
    applicant: clean(attributes.ApplicantName),
    contractor: clean(attributes.ContractorName),
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

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="text-slate-500">{label}:</span>
      <span className="min-w-0 break-words font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}

function PermitCard({ permit }) {
  const [copied, setCopied] = useState(false);

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
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            {permit.permitNum || 'Unnumbered permit'}
          </div>
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-start gap-1.5 text-base font-semibold text-slate-900 hover:text-orange-600"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{permit.address}</span>
            </a>
          ) : (
            <div className="mt-1 text-base font-semibold text-slate-400">No address listed</div>
          )}
        </div>
        <div className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-semibold tabular-nums text-emerald-700">
          {currency.format(permit.value)}
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-slate-600" title={permit.description}>
        {permit.description || 'No description provided.'}
      </p>

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        <DetailRow icon={User} label="Applicant" value={permit.applicant} />
        <DetailRow icon={HardHat} label="Contractor" value={permit.contractor} />
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy lead'}
      </button>
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
      const response = await fetch(PERMITS_URL, { signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = await response.json();
      // ArcGIS reports query errors with HTTP 200 and an `error` object.
      if (data.error) {
        throw new Error(data.error.message || 'The permit service returned an error.');
      }
      const features = Array.isArray(data.features) ? data.features : [];
      setPermits(features.map((f, i) => normalizePermit(f.attributes || {}, i)));
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
