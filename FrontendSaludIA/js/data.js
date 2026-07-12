// ============================================================
// SaludIA — Synthetic epidemiological data source (front-end only)
// Deterministic generator: same inputs always produce the same output.
// Models weekly Dengue / Malaria cases per Colombian municipality,
// with seasonality + environmental variables, for 2018, 2019, 2021.
// ============================================================

export const YEARS = [2018, 2019, 2021];
export const DISEASES = ["Dengue", "Malaria"];

// Representative municipalities (name, department, population, endemicity 0-1 per disease)
export const MUNICIPALITIES = [
  { name: "Cali", dep: "Valle del Cauca", pop: 2280000, dengue: 0.95, malaria: 0.15 },
  { name: "Villavicencio", dep: "Meta", pop: 560000, dengue: 0.9, malaria: 0.35 },
  { name: "Cúcuta", dep: "Norte de Santander", pop: 780000, dengue: 0.85, malaria: 0.2 },
  { name: "Neiva", dep: "Huila", pop: 360000, dengue: 0.88, malaria: 0.1 },
  { name: "Ibagué", dep: "Tolima", pop: 540000, dengue: 0.78, malaria: 0.1 },
  { name: "Medellín", dep: "Antioquia", pop: 2560000, dengue: 0.6, malaria: 0.25 },
  { name: "Bello", dep: "Antioquia", pop: 560000, dengue: 0.55, malaria: 0.3 },
  { name: "Barranquilla", dep: "Atlántico", pop: 1230000, dengue: 0.7, malaria: 0.1 },
  { name: "Cartagena", dep: "Bolívar", pop: 1030000, dengue: 0.72, malaria: 0.4 },
  { name: "Santa Marta", dep: "Magdalena", pop: 500000, dengue: 0.68, malaria: 0.45 },
  { name: "Montería", dep: "Córdoba", pop: 490000, dengue: 0.65, malaria: 0.55 },
  { name: "Sincelejo", dep: "Sucre", pop: 280000, dengue: 0.6, malaria: 0.35 },
  { name: "Valledupar", dep: "Cesar", pop: 490000, dengue: 0.62, malaria: 0.3 },
  { name: "Bucaramanga", dep: "Santander", pop: 580000, dengue: 0.7, malaria: 0.12 },
  { name: "Barrancabermeja", dep: "Santander", pop: 190000, dengue: 0.75, malaria: 0.4 },
  { name: "Florencia", dep: "Caquetá", pop: 170000, dengue: 0.8, malaria: 0.6 },
  { name: "Leticia", dep: "Amazonas", pop: 42000, dengue: 0.5, malaria: 0.92 },
  { name: "Quibdó", dep: "Chocó", pop: 130000, dengue: 0.45, malaria: 0.95 },
  { name: "Tumaco", dep: "Nariño", pop: 250000, dengue: 0.5, malaria: 0.9 },
  { name: "Buenaventura", dep: "Valle del Cauca", pop: 410000, dengue: 0.55, malaria: 0.8 },
  { name: "Puerto Asís", dep: "Putumayo", pop: 62000, dengue: 0.5, malaria: 0.7 },
  { name: "Yopal", dep: "Casanare", pop: 180000, dengue: 0.72, malaria: 0.4 },
  { name: "Arauca", dep: "Arauca", pop: 100000, dengue: 0.7, malaria: 0.55 },
  { name: "Riohacha", dep: "La Guajira", pop: 220000, dengue: 0.58, malaria: 0.35 },
  { name: "Girardot", dep: "Cundinamarca", pop: 110000, dengue: 0.82, malaria: 0.08 },
  { name: "Espinal", dep: "Tolima", pop: 80000, dengue: 0.78, malaria: 0.1 },
  { name: "Aguachica", dep: "Cesar", pop: 100000, dengue: 0.65, malaria: 0.25 },
  { name: "Apartadó", dep: "Antioquia", pop: 190000, dengue: 0.55, malaria: 0.6 },
  { name: "San José del Guaviare", dep: "Guaviare", pop: 45000, dengue: 0.5, malaria: 0.75 },
  { name: "Mocoa", dep: "Putumayo", pop: 42000, dengue: 0.48, malaria: 0.65 },
];

// Deterministic pseudo-random in [0,1)
function seeded(...nums) {
  let x = 0;
  for (let i = 0; i < nums.length; i++) {
    x += Math.sin(nums[i] * (127.1 + i * 47.3) + 311.7) * 43758.5453;
  }
  return x - Math.floor(x);
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
  return h;
}

// Seasonal multiplier: Dengue peaks mid-year (rainy), Malaria late in year.
function seasonal(disease, week) {
  const peak = disease === "Dengue" ? 26 : 40;
  const spread = disease === "Dengue" ? 10 : 13;
  const base = Math.exp(-((week - peak) ** 2) / (2 * spread * spread));
  const secondary = 0.35 * Math.exp(-((week - (peak - 24)) ** 2) / (2 * 6 * 6));
  return 0.25 + base + secondary;
}

const yearFactor = { 2018: 0.9, 2019: 1.25, 2021: 1.05 };

// Scales weekly incidence so rates land in a realistic 0–150 x100k range.
const CASE_FACTOR = 62;

// Weekly reported cases for a municipality/disease/year/week.
export function weeklyCases(mun, disease, year, week) {
  const endem = disease === "Dengue" ? mun.dengue : mun.malaria;
  if (endem < 0.05) return 0;
  const h = hashStr(mun.name + disease);
  const baseline = endem * (mun.pop / 100000) * CASE_FACTOR;
  const season = seasonal(disease, week);
  const noise = 0.55 + seeded(h, year, week) * 0.9;
  let cases = baseline * season * (yearFactor[year] || 1) * noise;
  // Inject deterministic outbreaks
  const outbreakRoll = seeded(h + year, week * 3);
  if (outbreakRoll > 0.96) cases *= 2.2 + seeded(h, week) * 1.5;
  return Math.max(0, Math.round(cases));
}

export function incidenceRate(mun, disease, year, week) {
  const cases = weeklyCases(mun, disease, year, week);
  return +((cases / mun.pop) * 100000).toFixed(1);
}

export function riskLevel(rate) {
  if (rate >= 90) return "high";
  if (rate >= 45) return "moderate";
  if (rate > 0) return "low";
  return "none";
}

// Environmental variables (deterministic).
export function environment(mun, week) {
  const h = hashStr(mun.dep);
  const temp = 22 + seeded(h, week) * 10;
  const precip = seasonal("Dengue", week) * 30 + seeded(h + 1, week) * 20;
  return { temp: +temp.toFixed(1), precip: +precip.toFixed(1) };
}

// Ranking of municipalities by incidence rate for a given filter.
export function ranking(disease, year, week, limit = 5) {
  return MUNICIPALITIES.map((m) => {
    const rate = incidenceRate(m, disease, year, week);
    return { name: m.name, dep: m.dep, rate, risk: riskLevel(rate) };
  })
    .filter((m) => m.rate > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, limit);
}

// Count of municipalities per risk bucket (for the map legend / stats).
export function riskCounts(disease, year, week) {
  const counts = { high: 0, moderate: 0, low: 0, none: 0 };
  MUNICIPALITIES.forEach((m) => {
    counts[riskLevel(incidenceRate(m, disease, year, week))]++;
  });
  return counts;
}

// Historical + 1-week-ahead prediction series for a municipality/disease.
export function predictionSeries(munName, disease, year = 2021, upto = 24, back = 5) {
  const mun = MUNICIPALITIES.find((m) => m.name === munName) || MUNICIPALITIES[0];
  const rows = [];
  for (let w = upto - back; w <= upto; w++) {
    rows.push({ week: `Sem ${w}`, actual: incidenceRate(mun, disease, year, w) });
  }
  // Predicted = smoothed trend + slight lead, with model noise.
  rows.forEach((r, i) => {
    const prev = i > 0 ? rows[i - 1].actual : r.actual;
    const trend = r.actual + (r.actual - prev) * 0.6;
    const h = hashStr(mun.name + disease + r.week);
    r.predicted = Math.max(0, +(trend * (0.92 + seeded(h, i) * 0.16)).toFixed(1));
  });
  // Next week: only prediction.
  const lastWeek = upto + 1;
  const last = rows[rows.length - 1];
  const momentum = last.actual - rows[rows.length - 2].actual;
  const nextPred = Math.max(0, +(last.actual + momentum * 0.9 + seeded(hashStr(mun.name), lastWeek) * 8).toFixed(1));
  rows.push({ week: `Sem ${lastWeek}`, actual: null, predicted: nextPred });
  return { mun, rows, nextWeek: lastWeek, nextPred };
}

// Detected anomalies: weeks where reported cases greatly exceed the expected baseline.
export function detectAnomalies(limit = 12) {
  const out = [];
  MUNICIPALITIES.forEach((m) => {
    DISEASES.forEach((disease) => {
      const endem = disease === "Dengue" ? m.dengue : m.malaria;
      if (endem < 0.3) return;
      YEARS.forEach((year) => {
        for (let w = 1; w <= 52; w++) {
          const cases = weeklyCases(m, disease, year, w);
          if (cases < 20) continue;
          // Expected = average of neighbouring weeks without outbreak boost.
          const endemBase = endem * (m.pop / 100000) * CASE_FACTOR;
          const expected = Math.round(endemBase * seasonal(disease, w) * (yearFactor[year] || 1));
          if (expected <= 0) continue;
          const ratio = cases / expected;
          if (ratio >= 1.8) {
            out.push({
              date: `${year} Sem ${w}`,
              year,
              week: w,
              mun: m.name,
              dep: m.dep,
              disease,
              cases,
              expected,
              ratio: +ratio.toFixed(1),
              severity: ratio >= 2.8 ? "critical" : ratio >= 2.1 ? "high" : "moderate",
            });
          }
        }
      });
    });
  });
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, limit);
}

// Full-year weekly series (environment + epidemiology) for one municipality.
// Used by the prediction page detail charts.
export function weeklyDetailSeries(munName, disease, year = 2021) {
  const mun = MUNICIPALITIES.find((m) => m.name === munName) || MUNICIPALITIES[0];
  const rows = [];
  for (let w = 1; w <= 52; w++) {
    const env = environment(mun, w);
    rows.push({
      week: w,
      cases: weeklyCases(mun, disease, year, w),
      rate: incidenceRate(mun, disease, year, w),
      temp: env.temp,
      precip: env.precip,
    });
  }
  return { mun, rows };
}

// Municipalities within a department, ordered by population (for comparison charts).
export function departmentMunicipalities(dep) {
  return MUNICIPALITIES.filter((m) => m.dep === dep).sort((a, b) => b.pop - a.pop);
}

// Pearson correlation coefficient between two equal-length arrays.
function correlation(a, b) {
  const n = a.length;
  if (n === 0) return 0;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : +(num / den).toFixed(2);
}

// Narrative summary of findings + probable drivers of the contagion level.
export function findingsSummary(munName, disease, year = 2021) {
  const { mun, rows } = weeklyDetailSeries(munName, disease, year);
  const peak = rows.reduce((a, b) => (b.cases > a.cases ? b : a), rows[0]);
  const totalCases = rows.reduce((s, r) => s + r.cases, 0);
  const avgTemp = +(rows.reduce((s, r) => s + r.temp, 0) / rows.length).toFixed(1);
  const avgPrecip = +(rows.reduce((s, r) => s + r.precip, 0) / rows.length).toFixed(1);
  const peakRate = Math.max(...rows.map((r) => r.rate));
  const endem = disease === "Dengue" ? mun.dengue : mun.malaria;

  const corrTemp = correlation(
    rows.map((r) => r.temp),
    rows.map((r) => r.cases),
  );
  const corrPrecip = correlation(
    rows.map((r) => r.precip),
    rows.map((r) => r.cases),
  );

  const { nextPred } = predictionSeries(munName, disease, year);
  const risk = riskLevel(nextPred);
  const riskLabel = { high: "alto", moderate: "moderado", low: "bajo", none: "sin datos" }[risk];

  // Probable causes ranked by relevance to the observed contagion level.
  const causes = [];
  if (endem >= 0.7)
    causes.push(
      `Alta endemicidad histórica de ${disease} en ${mun.name} (índice ${(endem * 100).toFixed(0)}%), que mantiene una circulación constante del agente infeccioso.`,
    );
  else if (endem >= 0.4)
    causes.push(
      `Endemicidad media de ${disease} (índice ${(endem * 100).toFixed(0)}%), con focos de transmisión activos en la zona.`,
    );
  else
    causes.push(
      `Endemicidad baja de ${disease} (índice ${(endem * 100).toFixed(0)}%); los casos tienden a ser importados o esporádicos.`,
    );

  if (corrPrecip >= 0.3)
    causes.push(
      `Correlación positiva entre precipitaciones y casos (r=${corrPrecip}): la lluvia genera criaderos de mosquitos que amplifican la transmisión.`,
    );
  if (corrTemp >= 0.3)
    causes.push(
      `Correlación positiva entre temperatura y casos (r=${corrTemp}): un rango cercano a ${avgTemp} °C acelera el ciclo de vida del vector.`,
    );
  if (mun.pop >= 800000)
    causes.push(
      `Alta densidad poblacional (${mun.pop.toLocaleString("es-CO")} hab.), que facilita el contacto humano-vector y la propagación urbana.`,
    );
  causes.push(
    `Estacionalidad marcada: el pico de casos se concentra alrededor de la semana ${peak.week}, coincidiendo con la temporada de lluvias.`,
  );

  return {
    mun,
    disease,
    risk,
    riskLabel,
    nextPred,
    peakWeek: peak.week,
    peakCases: peak.cases,
    peakRate,
    totalCases,
    avgTemp,
    avgPrecip,
    endem,
    corrTemp,
    corrPrecip,
    causes,
  };
}

// Flat table of records for the data explorer.
export function buildRecords() {
  const rows = [];
  MUNICIPALITIES.forEach((m) => {
    DISEASES.forEach((disease) => {
      const endem = disease === "Dengue" ? m.dengue : m.malaria;
      if (endem < 0.05) return;
      YEARS.forEach((year) => {
        for (let w = 1; w <= 52; w++) {
          const cases = weeklyCases(m, disease, year, w);
          const env = environment(m, w);
          rows.push({
            mun: m.name,
            dep: m.dep,
            disease,
            year,
            week: w,
            cases,
            pop: m.pop,
            rate: incidenceRate(m, disease, year, w),
            temp: env.temp,
            precip: env.precip,
          });
        }
      });
    });
  });
  return rows;
}
