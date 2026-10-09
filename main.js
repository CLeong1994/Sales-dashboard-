import './style.css';

// ---------------------------------------------------------------------------
// DATA LOADING
// Everything the dashboard reads comes from loadData(). It resolves to an
// array of rows shaped like:
//   { outlet: string, week: "YYYY-MM-DD", sales: number, target: number,
//     orders: number, returns: number }
//
// Rows come from the Supabase table public.outlet_weekly (see supabase.sql),
// read through the REST API. The URL and publishable key come from the
// VITE_SUPABASE_URL and VITE_SUPABASE_KEY env vars (.env locally, Vercel
// project settings in production) and are baked in at build time. That key is
// meant to be public; the table's row-level security only allows reads.
// If Supabase can't be reached or the table is empty, the embedded CSV is used
// and a note says so under the title.
// ---------------------------------------------------------------------------
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const SUPABASE_TABLE = 'outlet_weekly';

let dataSource = '';

async function loadData() {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('VITE_SUPABASE_URL or VITE_SUPABASE_KEY is not set');
    const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}` +
      '?select=outlet,week,sales,target,orders,returns&order=outlet.asc,week.asc';
    const res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    if (!res.ok) throw new Error(`Supabase returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    if (!rows.length) throw new Error('Supabase table is empty');
    dataSource = 'supabase';
    return rows.map(normalise);
  } catch (err) {
    console.warn('Falling back to embedded CSV.', err);
    dataSource = 'csv';
    return parseCsv(FALLBACK_CSV);
  }
}

const FALLBACK_CSV = `outlet,week,sales,target,orders,returns
Tampines,2026-09-07,18400,18000,612,9
Tampines,2026-09-14,16100,18000,540,14
Tampines,2026-09-21,19200,18000,640,8
Jurong,2026-09-07,14200,15000,488,11
Jurong,2026-09-14,12600,15000,430,19
Jurong,2026-09-21,15300,15000,512,10
Orchard,2026-09-07,22500,24000,690,12
Orchard,2026-09-14,20100,24000,612,21
Orchard,2026-09-21,24800,24000,742,9`;

function parseCsv(csv) {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = header.split(',').map(s => s.trim());
  return lines.map(line => {
    const vals = line.split(',');
    const raw = Object.fromEntries(cols.map((c, i) => [c, (vals[i] || '').trim()]));
    return normalise(raw);
  });
}

function normalise(r) {
  return {
    outlet: String(r.outlet),
    week: String(r.week).slice(0, 10),
    sales: Number(r.sales),
    target: Number(r.target),
    orders: Number(r.orders),
    returns: Number(r.returns),
  };
}

// ---------------------------------------------------------------------------
// RENDERING
// ---------------------------------------------------------------------------
const THRESHOLD = 0.9;
const OUTLETS = ['All', 'Tampines', 'Jurong', 'Orchard'];
let allRows = [];
let current = 'All';

const money = n => 'S$' + Math.round(n).toLocaleString('en-SG');
const num = n => Math.round(n).toLocaleString('en-SG');
const pct = (n, d = 1) => (n * 100).toFixed(d) + '%';
const fmtWeek = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderFilter() {
  const el = document.getElementById('filter');
  el.innerHTML = OUTLETS.map(o =>
    `<button type="button" data-outlet="${o}" aria-pressed="${o === current}">${o}</button>`).join('');
  el.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    current = b.dataset.outlet;
    render();
  };
}

function render() {
  document.querySelectorAll('#filter button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.outlet === current)));

  const rows = current === 'All' ? allRows : allRows.filter(r => r.outlet === current);
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  const sales = sum('sales'), target = sum('target'), orders = sum('orders'), returns = sum('returns');
  const weeks = [...new Set(rows.map(r => r.week))].sort();

  document.getElementById('period').textContent = weeks.length
    ? `${current === 'All' ? 'All outlets' : current} · weeks of ${fmtWeek(weeks[0])} to ${fmtWeek(weeks[weeks.length - 1])}`
    : 'No data';
  if (dataSource === 'csv') document.getElementById('period').textContent += ' · sample data (Supabase not connected)';

  document.getElementById('kpi-sales').textContent = money(sales);
  document.getElementById('kpi-sales-note').textContent = `Target ${money(target)}`;
  document.getElementById('kpi-target').textContent = target ? pct(sales / target) : '–';
  const diff = sales - target;
  document.getElementById('kpi-target-note').textContent = `${diff >= 0 ? '+' : '−'}${money(Math.abs(diff))} vs target`;
  document.getElementById('kpi-orders').textContent = num(orders);
  document.getElementById('kpi-orders-note').textContent = orders ? `Avg order ${money(sales / orders)}` : '';
  document.getElementById('kpi-returns').textContent = orders ? pct(returns / orders, 2) : '–';
  document.getElementById('kpi-returns-note').textContent = `${num(returns)} returns`;

  // Bars: one per outlet-week, grouped by outlet. Scale so 100% target sits at a fixed point.
  const ratios = rows.map(r => r.sales / r.target);
  const maxR = Math.max(1.1, ...ratios);
  const pos = r => (r / maxR) * 100;
  const groups = [...new Set(rows.map(r => r.outlet))];
  document.getElementById('bars').innerHTML = groups.map(o => {
    const items = rows.filter(r => r.outlet === o).sort((a, b) => a.week.localeCompare(b.week));
    return `<div class="group">` + items.map(r => {
      const ratio = r.sales / r.target;
      const bad = ratio < THRESHOLD;
      return `<div class="row" title="${esc(r.outlet)} ${r.week}: ${money(r.sales)} of ${money(r.target)}">
        <div class="name">${esc(r.outlet)}<small>${fmtWeek(r.week)}</small></div>
        <div class="track">
          <div class="fill${bad ? ' bad' : ''}" style="width:${pos(ratio).toFixed(2)}%"></div>
          <div class="tick" style="left:${pos(THRESHOLD).toFixed(2)}%"></div>
          <div class="tick target" style="left:${pos(1).toFixed(2)}%"></div>
        </div>
        <div class="pct${bad ? ' bad' : ''}">${pct(ratio)}</div>
      </div>`;
    }).join('') + `</div>`;
  }).join('') || '<div class="empty">No rows for this outlet.</div>';

  // Needs attention list, worst first.
  const attn = rows
    .map(r => ({ ...r, ratio: r.sales / r.target }))
    .filter(r => r.ratio < THRESHOLD)
    .sort((a, b) => a.ratio - b.ratio);
  document.getElementById('attn-count').textContent = attn.length;
  document.getElementById('attn').innerHTML = attn.length
    ? attn.map(r => `<li>
        <div><div class="who">${esc(r.outlet)}</div><div class="meta">Week of ${fmtWeek(r.week)} · ${money(r.sales)} of ${money(r.target)}</div></div>
        <div class="gap">${pct(r.ratio)}<div class="meta">${money(r.target - r.sales)} short</div></div>
      </li>`).join('')
    : '<li class="empty" style="background:none;padding:0">Every week is at or above 90% of target.</li>';
}

(async function init() {
  renderFilter();
  try {
    allRows = await loadData();
    render();
  } catch (err) {
    document.getElementById('period').innerHTML = `<span class="error">Could not load data: ${esc(err.message)}</span>`;
    console.error(err);
  }
})();
