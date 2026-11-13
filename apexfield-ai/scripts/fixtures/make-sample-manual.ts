/**
 * Generates a synthetic, deliberately awkward HVAC "service manual" PDF for testing
 * the parser: two-column prose, a full-width electrical data table, a charging chart
 * that runs across a page break (with a repeated header), a fault-code table with
 * wrapped cells, running headers/footers and page numbers.
 *
 * The brand ("Apexair") and every number in it are fictional. Never ingest this
 * into a production knowledge base.
 *
 *   npx tsx scripts/fixtures/make-sample-manual.ts [out.pdf]
 */
import { createWriteStream } from "node:fs";
import PDFDocument from "pdfkit";

const out = process.argv[2] ?? "sample-oem-manual.pdf";
const doc = new PDFDocument({ size: "LETTER", margin: 0, info: { Title: "Apexair AXC Series Split System Service Manual" } });
doc.pipe(createWriteStream(out));

const L = 54;
const R = 558;
const BODY = 9.5;
let page = 1;
const TOTAL = 4;

function chrome() {
  doc.font("Helvetica").fontSize(8).fillColor("#555");
  doc.text("APEXAIR AXC SERIES · SERVICE MANUAL · SYNTHETIC TEST FIXTURE", L, 26, { lineBreak: false });
  doc.text(`Page ${page} of ${TOTAL}`, 500, 760, { lineBreak: false });
  doc.fillColor("#000");
}
function newPage() {
  doc.addPage();
  page++;
  chrome();
}
function heading(text: string, x: number, y: number, size = 13) {
  doc.font("Helvetica-Bold").fontSize(size).text(text, x, y, { lineBreak: false });
  return y + size + 8;
}
function para(text: string, x: number, y: number, width: number) {
  doc.font("Helvetica").fontSize(BODY);
  doc.text(text, x, y, { width, lineGap: 1.5 });
  return doc.y + 7;
}
function row(cells: string[], xs: number[], y: number, bold = false) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
  cells.forEach((c, i) => doc.text(c, xs[i], y, { lineBreak: false }));
}

/* ---------------- page 1: title + two-column prose ---------------- */
chrome();
doc.font("Helvetica-Bold").fontSize(22).text("AXC Series Split System Air Conditioner", L, 60, { lineBreak: false });
doc.font("Helvetica").fontSize(11).text("Installation, Start-Up and Service Instructions · Models AXC024A1, AXC036A1, AXC048A1", L, 92, { lineBreak: false });

const COL_W = 236;
const RX = L + COL_W + 32;
let ly = heading("SAFETY CONSIDERATIONS", L, 130);
ly = para(
  "WARNING: ELECTRICAL SHOCK HAZARD. Before performing service or maintenance, turn off the main power switch to the outdoor unit and lock it out. Verify zero volts across L1 and L2 at the contactor line side with a meter rated for the circuit. More than one disconnect may be present. Failure to follow this warning could result in personal injury or death.",
  L, ly, COL_W,
);
ly = para(
  "Installation and service of this equipment must be performed by trained, qualified technicians. Wear safety glasses, gloves and protective clothing when brazing or recovering refrigerant. Keep a fire extinguisher available during brazing operations and follow all local codes and the current edition of the National Electrical Code.",
  L, ly, COL_W,
);
ly = para(
  "Never use oxygen or compressed air to pressurize the system for leak testing. Use dry nitrogen with a pressure regulator, and never exceed the test pressure listed on the unit data plate.",
  L, ly, COL_W,
);

let ry = heading("INTRODUCTION", RX, 130);
ry = para(
  "The AXC Series outdoor units are designed for split system cooling with R-410A refrigerant and a thermostatic expansion valve (TXV) indoor coil. These instructions cover installation, refrigerant charging, start-up checks and fault diagnosis. Read the entire manual before beginning the installation.",
  RX, ry, COL_W,
);
ry = para(
  "Units are shipped with a factory holding charge sufficient for an indoor coil and 15 feet of line set. Charge adjustments for longer line sets must be made using the subcooling method described in the Charging section. Weighing in charge alone is not acceptable for final verification.",
  RX, ry, COL_W,
);
ry = heading("MODEL NOMENCLATURE", RX, ry + 4, 11);
para(
  "Example: AXC036A1 is a 3-ton, 208/230V single-phase unit. Position 1-3 is the product series (AXC), positions 4-6 the nominal capacity in thousands of BTUh (024, 036, 048), position 7 the design revision and position 8 the voltage code.",
  RX, ry, COL_W,
);

/* ---------------- page 2: full-width electrical table + wiring ---------------- */
newPage();
let y = heading("ELECTRICAL DATA", L, 60, 14);
const ex = [L, 132, 226, 298, 366, 434, 500];
row(["Model", "Volts-Ph-Hz", "Comp RLA", "Comp LRA", "Fan FLA", "MCA", "MOCP"], ex, y, true);
const elec = [
  ["AXC024A1", "208/230-1-60", "10.3", "52.0", "0.8", "13.7", "20"],
  ["AXC030A1", "208/230-1-60", "12.8", "64.0", "0.8", "16.8", "25"],
  ["AXC036A1", "208/230-1-60", "14.1", "77.0", "1.2", "18.8", "30"],
  ["AXC042A1", "208/230-1-60", "17.9", "112.0", "1.2", "23.6", "40"],
  ["AXC048A1", "208/230-1-60", "21.2", "117.0", "1.4", "27.9", "45"],
];
for (const r of elec) {
  y += 16;
  row(r, ex, y);
}
y += 34;
y = heading("WIRING AND CONTROLS", L, y);
y = para(
  "Low voltage control wiring connects the thermostat to the outdoor unit through the indoor unit. Connect thermostat Y to the contactor coil and C to the 24V common. Measure 24V AC (acceptable range 20 to 30V) across the contactor coil terminals with a call for cooling present. If 24V is absent at the coil but present at the thermostat, check the low voltage splice at the air handler before condemning the control board.",
  L, y, R - L,
);
para(
  "High voltage supply wiring must be sized from the MCA and protected by the MOCP listed in the Electrical Data table. Connect L1 and L2 to the contactor line side terminals. The dual run capacitor terminals are HERM (compressor), FAN (outdoor fan motor) and C (common).",
  L, y, R - L,
);

/* ---------------- page 3: charging chart that spills onto page 4 ---------------- */
newPage();
y = heading("CHARGING", L, 60, 14);
y = heading("Subcooling Charging Method", L, y, 11.5);
y = para(
  "Operate the unit in cooling for at least 15 minutes with the indoor airflow set correctly. Measure liquid line pressure at the service valve and liquid line temperature within 6 inches of the valve. Subcooling equals saturation temperature at the measured pressure minus the liquid line temperature. Add refrigerant if subcooling is low; recover refrigerant if it is high. Target subcooling for all AXC models is 10°F ±3°F.",
  L, y, R - L,
);
y = para(
  "Superheat check: with the TXV metering, superheat at the indoor coil outlet should read 8 to 12°F once subcooling is on target. Low superheat with low subcooling points to a TXV sensing bulb that is loose or uninsulated rather than a refrigerant shortage. Do not add refrigerant until the bulb is secured and insulated and the system has stabilized for 15 minutes.",
  L, y, R - L,
);
y = para(
  "Charge verification must be repeated whenever the outdoor ambient changes by more than 10°F during the visit. Record the ambient, liquid pressure, liquid line temperature and calculated subcooling on the start-up checklist and in the dispatch report.",
  L, y, R - L,
);
// Start the chart low enough that it must continue on the next page.
y = Math.max(y + 6, 560);
doc.font("Helvetica").fontSize(BODY).text("Table 3. Subcooling charging chart (R-410A, TXV systems):", L, y, { lineBreak: false });
y += 22;
const cx = [L, 190, 330, 460];
const chartHeader = ["Outdoor Ambient (°F)", "Liquid Pressure (PSIG)", "Target Subcooling (°F)", "Liquid Line Temp (°F)"];
row(chartHeader, cx, y, true);
const chart: string[][] = [];
for (let t = 65; t <= 115; t += 2.5) {
  const psi = Math.round(220 + (t - 65) * 4.6);
  const sat = Math.round(70 + (t - 65) * 0.92);
  chart.push([t.toFixed(1), String(psi), "10", String(sat - 10)]);
}
let i = 0;
for (; i < chart.length; i++) {
  y += 15;
  if (y > 735) break;
  row(chart[i], cx, y);
}
newPage();
y = 60;
row(chartHeader, cx, y, true);
for (; i < chart.length; i++) {
  y += 15;
  row(chart[i], cx, y);
}

/* ---------------- page 4: fault codes with wrapped cells ---------------- */
y += 34;
y = heading("TROUBLESHOOTING", L, y, 14);
y = heading("Fault Codes", L, y, 11.5);
y = para("The control board status LED flashes the active fault code. Count the flashes after a 2-second pause.", L, y, R - L);
y += 4;
const fx = [L, 110, 175, 385];
row(["Code", "Flashes", "Description", "Corrective Action"], fx, y, true);
const faults: [string, string, string[], string][] = [
  ["E1", "1", ["High pressure switch open"], "Check condenser fan and coil"],
  ["E2", "2", ["Low pressure switch open for more than", "30 seconds during a cooling call"], "Check charge and indoor airflow"],
  ["E3", "3", ["Compressor short cycling"], "Check thermostat anticipator"],
  ["E4", "4", ["Locked rotor: compressor amp draw above", "LRA for 3 consecutive starts"], "Test run capacitor, then compressor"],
  ["E5", "5", ["Outdoor coil sensor open or shorted"], "Measure sensor resistance"],
];
for (const [code, flashes, desc, action] of faults) {
  y += 16;
  row([code, flashes, desc[0], action], fx, y);
  for (const extra of desc.slice(1)) {
    y += 11;
    doc.font("Helvetica").fontSize(9).text(extra, fx[2], y, { lineBreak: false });
  }
}

doc.end();
console.log(`wrote ${out}`);
