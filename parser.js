const expediente = { doc: "", filiaciones: [] };
const tcase = s => (s||"").toLowerCase().replace(/\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g,c=>c.toUpperCase());
const normalize = s => (s||"").normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const normAZ = s => (s||"").normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
.replace(/[^A-ZÑÁÉÍÓÚÜ\s-]/g,'').replace(/\s+/g,' ').trim();
function buildNS(raw){
const up0 = normalize(raw||"");
const up = up0.replace(/く/g,'<').replace(/＜/g,'<');
let NS = ""; const MAP = [];
for (let i=0;i<up.length;i++){
const ch = up[i];
if (/\s/.test(ch)) continue;
NS += ch; MAP.push(i);
}
return { NS, MAP, RAW: raw||"", UPROW: up };
}
function damerauLevenshtein(a,b,limit=2){
a=a||""; b=b||""; if(a===b) return 0; if(!a||!b) return Math.min(limit+1, Math.max(a.length,b.length));
const al=a.length, bl=b.length; if (Math.abs(al-bl)>limit) return limit+1;
const dp=Array.from({length:al+1},()=>Array(bl+1).fill(0));
for(let i=0;i<=al;i++) dp[i][0]=i; for(let j=0;j<=bl;j++) dp[0][j]=j;
for(let i=1;i<=al;i++){
let minRow=limit+1;
for(let j=1;j<=bl;j++){
const cost=a[i-1]===b[j-1]?0:1;
let v=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) v=Math.min(v, dp[i-2][j-2]+1);
dp[i][j]=v; if(v<minRow) minRow=v;
}
if(minRow>limit) return limit+1;
}
return dp[al][bl];
}
function findApproxTag(ns, tag, maxDist = 2) {
const T = tag.toUpperCase().replace(/\s+/g,'');
const L = T.length;
let best = { idx: -1, d: maxDist + 1 };
for (let i = 0; i <= ns.length - L; i++) {
const win = ns.slice(i, i + L);
const d = damerauLevenshtein(win, T, maxDist);
if (d <= maxDist && (d < best.d || best.idx === -1)) {
best = { idx: i, d };
if (d === 0) break;
}
}
return best.idx;
}
let MUNICIPIOS_SET = new Set([
"MADRID","ALCOBENDAS","BARCELONA","VALENCIA","SEVILLA","MALAGA","MURCIA",
"SANTA CRUZ DE TENERIFE","LAS PALMAS","ARONA","ADEJE","TELDE","VIGO","OVIEDO","GIJON","BILBAO","VALLADOLID","SALAMANCA","TOLEDO"
].map(normalize));
let MUNICIPIOS_CANON = new Map();
MUNICIPIOS_CANON = new Map([...MUNICIPIOS_SET].map(m => [m, m]));
let MUNICIPIOS_NOSPACE = new Map([...MUNICIPIOS_SET].map(m => [m.replace(/\s+/g,''), m]));
const PROVINCIAS = ["A CORUÑA","ALAVA","ALAVA","ALBACETE","ALICANTE","ALMERIA","ALMERIA","ASTURIAS","ÁVILA","AVILA","BADAJOZ","BARCELONA","BIZKAIA","VIZCAYA","BURGOS","CÁCERES","CACERES","CÁDIZ","CADIZ","CANTABRIA","CASTELLON","CASTELLON","CIUDAD REAL","CÓRDOBA","CORDOBA","CUENCA","GIRONA","GERONA","GRANADA","GUADALAJARA","GUIPÚZCOA","GUIPUZCOA","GIPUZKOA","HUELVA","HUESCA","ILLES BALEARS","ISLAS BALEARES","JAÉN","JAEN","LA RIOJA","LAS PALMAS","LEÓN","LEON","LLEIDA","LUGO","MADRID","MÁLAGA","MALAGA","MURCIA","NAVARRA","NAFARROA","OURENSE","ORENSE","PALENCIA","PONTEVEDRA","SALAMANCA","SANTA CRUZ DE TENERIFE","SEGOVIA","SEVILLA","SORIA","TARRAGONA","TERUEL","TOLEDO","VALENCIA","VALLADOLID","ZAMORA","ZARAGOZA","CEUTA","MELILLA"].map(normalize);
const PROV_SET = new Set(PROVINCIAS);
const PROV_NOSPACE = new Map([...PROV_SET].map(p => [p.replace(/\s+/g,''), p]));
let NOMBRES_SET = new Set(); // se cargará de nombres.json si se puede
async function initMunicipios(){
try{
const arr = (typeof window !== 'undefined')
? (window.MUNICIPIOS || window.municipios || window.Municipios || window.MUNICIPIOS_ES || null)
: null;
if (Array.isArray(arr) && arr.length){
const rawList = arr
.map(x => String(x || "").trim())
.filter(Boolean);
MUNICIPIOS_SET = new Set(rawList.map(normalize));
MUNICIPIOS_CANON = new Map(rawList.map(v => [normalize(v), v]));
MUNICIPIOS_NOSPACE = new Map(rawList.map(v => [normalize(v).replace(/\s+/g,''), v]));
console.log(`Municipios cargados (municipios.js): ${MUNICIPIOS_SET.size}`);
return;
}
console.warn('municipios.js no expuso un array global esperado. Uso fallback.');
}catch(e){
console.warn('Error leyendo municipios.js (global). Uso fallback.', e);
}
}
async function initNombres(){
try{
const res = await fetch('nombres.json', {cache:'no-store'});
if (!res.ok) throw new Error('HTTP '+res.status);
const arr = await res.json();
if (Array.isArray(arr) && arr.length){
const list = arr.map(line => String(line).split(',')[0]).filter(Boolean);
NOMBRES_SET = new Set(list.map(normalize));
console.log(`Nombres cargados: ${NOMBRES_SET.size}`);
}
}catch(e){
console.warn('nombres.json no accesible (¿file:// / CORS?). Padres quedarán en duda si no hay set.', e);
}
}
function matchMunicipioSuffixNS(ns){
if (!ns || !MUNICIPIOS_NOSPACE.size) return null;
const maxLen = Math.min(32, ns.length);
for (let len = maxLen; len >= 4; len--) {
const sub = ns.slice(ns.length - len);
const hit = MUNICIPIOS_NOSPACE.get(sub);
if (hit) return { canon: hit, index: ns.length - len };
}
return null;
}
function findProvinceAfter(ns, start=0){
if (!ns) return null;
let best = null;
for (const [pNS, canon] of PROV_NOSPACE.entries()){
const idx = ns.indexOf(pNS, start);
if (idx !== -1){
if (!best || idx < best.index || (idx === best.index && pNS.length > best.pNS.length)){
best = { index: idx, canon, pNS };
}
}
}
return best;
}
function matchMunicipio(raw){
const cand = normAZ(raw);
const can  = normalize(cand);
if (MUNICIPIOS_SET.has(can)) {
const canonExact = MUNICIPIOS_CANON.get(can) || cand;
return {canon: canonExact, approx:false, found:true};
}
let best=null, bestD=3;
for (const m of MUNICIPIOS_SET){
const d = damerauLevenshtein(can, m, 2);
if (d<bestD){ bestD=d; best=m; if (d===0) break; }
}
if (best!=null && bestD<=2) {
const canonExact = MUNICIPIOS_CANON.get(best) || best;
return {canon: String(canonExact).replace(/\s+/g,' ').trim(), approx:true, found:true};
}
return {canon:cand, approx:false, found:false};
}
function mapDigit(ch){
if (/[0-9]/.test(ch)) return ch;
const t = ch.toUpperCase();
if (t==='O'||t==='Q') return '0';
if (t==='I'||t==='L') return '1';
if (t==='Z') return '2';
if (t==='S') return '5';
if (t==='B') return '8';
return '0';
}
function parsePassportByMRZ(ocrRaw){
const built = buildNS(ocrRaw);
const NS = built.NS;
const RAW = built.RAW;
const idxP = NS.indexOf('P<');
if (idxP === -1) return null;
const win = NS.slice(idxP, Math.min(NS.length, idxP + 120));
const lines = win.split(/\n/).filter(Boolean);
let l1 = "", l2 = "";
if (lines.length >= 2) {
l1 = String(lines[0] || "").replace(/\s+/g, "");
l2 = String(lines[1] || "").replace(/\s+/g, "");
} else {
const flat = win.replace(/\s+/g, "");
l1 = flat.slice(0, 44);
l2 = flat.slice(44, 88);
}
l1 = (l1 || "").padEnd(44, '<').slice(0, 44);
l2 = (l2 || "").padEnd(44, '<').slice(0, 44);
const mapDigitMRZ = (ch)=>{
if (/[0-9]/.test(ch)) return ch;
const t = String(ch||"").toUpperCase();
if (t==='O'||t==='Q') return '0';
if (t==='I'||t==='L') return '1';
if (t==='Z') return '2';
if (t==='S') return '5';
if (t==='B') return '8';
return ch; // el nº de pasaporte puede llevar letras
};
const clean = (s)=>String(s||"").replace(/</g,' ').replace(/\s+/g,' ').trim();
const issuing = l1.slice(2,5);              // ISO3 emisor
const namesPart = l1.slice(5);              // apellidos<<nombres
const parts = namesPart.split('<<');
const sur = clean(parts[0] || "").toUpperCase();
const giv = tcase(clean((parts[1] || "").replace(/</g,' ')));
const docNumRaw = l2.slice(0,9);
const docNum = docNumRaw.replace(/</g,'').split('').map(mapDigitMRZ).join('').toUpperCase();
const nat = l2.slice(10,13).replace(/</g,'').toUpperCase();  // ISO3 nacionalidad
const dob6 = l2.slice(13,19).split('').map(mapDigitMRZ).join('');
const sex = (l2.slice(20,21) || '').toUpperCase();
const ddmmyyyy = (yymmdd)=>{
if (!/^\d{6}$/.test(yymmdd)) return "";
const yy = parseInt(yymmdd.slice(0,2),10);
const mm = yymmdd.slice(2,4);
const dd = yymmdd.slice(4,6);
const nowYY = new Date().getFullYear() % 100;
const yyyy = (yy > nowYY ? 1900 + yy : 2000 + yy);
return `${dd}/${mm}/${yyyy}`;
};
const fechaNac = ddmmyyyy(dob6);
const sexo = (sex === 'F') ? 'FEMENINO' : (sex === 'M') ? 'MASCULINO' : "";
const bodyHit = (docNum && docNum.length >= 6)
? new RegExp(`\\b${docNum.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\b`, 'i').test(RAW)
: false;
return {
Nombre: tcase(giv),
Apellidos: (sur || "").toUpperCase(),
"Tipo de documento": "PASAPORTE",
"Nº Documento": docNum,
Sexo: sexo,
Nacionalidad: nat || "",
"Nombre de los Padres": "",
"Fecha de nacimiento": fechaNac,
"Lugar de nacimiento": "",
Domicilio: "",
_flags:{
Nombre: !giv,
Apellidos: !sur,
Padres: true,
Lugar: true,
Domicilio: true,
Numero: !docNum || !bodyHit
},
_mrz:{ l1, l2, issuing }
};
}
function parseDocument(ocrRaw){
const maybePass = parsePassportByMRZ(ocrRaw);
if (maybePass) return maybePass;
return parseByRules(ocrRaw);
}
function parseByRules(ocrRaw){
{
const built = buildNS(ocrRaw);
let NS0 = built.NS, MAP0 = built.MAP, RAW0 = built.RAW;
if (NS0.startsWith('EQUIPO')) {
const idxDomStart = NS0.indexOf('DOMICILIO');
if (idxDomStart !== -1) {
NS0  = NS0.slice(idxDomStart);
MAP0 = MAP0.slice(idxDomStart); // mantiene alineado el mapeo RAW
}
}
var NS = NS0, MAP = MAP0, RAW = RAW0;
}
const canonNS = NS.replace(/[l1]/g,'I').replace(/[0Ｏ]/g,'O').replace(/5/g,'S').replace(/[QC]/g,'D');
const idxIDESP = (() => {
const hits = [];
const rx = /[IL1](?:D|Q|C|O|0)E(?:S|5)P/g;
for (const m of canonNS.matchAll(rx)) hits.push(m.index);
const a = canonNS.indexOf('IOESP'); if (a !== -1) hits.push(a);
const b = canonNS.indexOf('IOSEP'); if (b !== -1) hits.push(b);
if (!hits.length) return -1;
return Math.min(...hits);
})();
const idxEQUIPO = NS.indexOf('EQUIPO');
const idxDOM = NS.indexOf('DOMICILIO');
let idxLUG = (()=>{
const a=NS.indexOf('LUGARDENACIMIENTO');
if (a!==-1) return a;
return NS.indexOf('LAGARDENACIMIENTO');
})();
if (idxLUG === -1) {
const alt1 = findApproxTag(NS, 'LUGARDE NACIMIENTO', 2);
const alt2 = findApproxTag(NS, 'LAGARDE NACIMIENTO', 2);
idxLUG = (alt1 !== -1) ? alt1 : (alt2 !== -1 ? alt2 : -1);
}
const gStop = [idxIDESP, idxEQUIPO].filter(i=>i!==-1).reduce((m,i)=>Math.min(m,i), NS.length);
let domicilio = "", domicilioUncertain = true;
if (idxDOM !== -1){
const start = idxDOM + 'DOMICILIO'.length;
const aLUG = idxLUG === -1 ? Infinity : idxLUG;
const aEQ  = idxEQUIPO === -1 ? Infinity : idxEQUIPO;
const aID  = idxIDESP === -1 ? Infinity : idxIDESP;
const pv   = findProvinceAfter(NS, start);
const anchorEnd = Math.min(aLUG, aEQ, aID, NS.length);
const end = (pv && pv.index < anchorEnd) ? pv.index : anchorEnd;
let domNS = NS.slice(start, end).trim();
const suf = matchMunicipioSuffixNS(domNS);
const rawStart = MAP[start] ?? 0;
const rawEndStreet = (suf ? MAP[start + suf.index - 1] : MAP[end - 1]) ?? MAP[MAP.length-1];
let street = RAW.slice(rawStart, (rawEndStreet ?? rawStart)+1)
.replace(/\s*,\s*/g, ', ')
.replace(/\.([A-Za-zÁÉÍÓÚÜÑ])/g, '. $1')
.replace(/([A-Za-zÁÉÍÓÚÜÑ])(\d)/g, '$1 $2')
.replace(/(\d)([A-Za-zÁÉÍÓÚÜÑ])/g, '$1 $2')
.replace(/\s{2,}/g,' ')
.trim();
if (suf){
domicilio = `${street}, ${tcase(suf.canon)}`;
domicilioUncertain = false;
} else {
domicilio = street;
}
}
let lugarNac = "", lugarUncertain = true;
if (idxLUG !== -1){
const start = idxLUG + (NS.startsWith('LUGARDENACIMIENTO', idxLUG) ? 'LUGARDENACIMIENTO'.length : 'LAGARDENACIMIENTO'.length);
const aH  = (()=>{ const i=NS.indexOf('HIJOADE', start); return i!==-1?i:Infinity;})();
const aID = idxIDESP !== -1 ? idxIDESP : Infinity;
const aEQ = idxEQUIPO !== -1 ? idxEQUIPO : Infinity;
const pv  = findProvinceAfter(NS, start);
const idxH = NS.indexOf('HIJOADE', start);
const limitDE = (idxH!==-1) ? (NS.indexOf('DE', idxH+'HIJOADE'.length) || Infinity) : Infinity;
const anchorEnd = Math.min(aH, aID, aEQ, NS.length, limitDE);
const end = (pv && pv.index < anchorEnd) ? pv.index : anchorEnd;
let seg = NS.slice(start, end);
const cutNum = seg.search(/[0-9]/); if (cutNum !== -1) seg = seg.slice(0, cutNum);
const mun = matchMunicipio(seg);
if (pv){
const prov = tcase(pv.canon);
const mc = mun.found ? tcase(mun.canon) : tcase(seg);
lugarUncertain = false;
lugarNac = (!seg || normalize(mc)===normalize(pv.canon)) ? prov : `${mc}, ${prov}`;
}else{
lugarNac = mun.found ? tcase(mun.canon) : tcase(seg);
if (!(mun.found && !mun.approx)) lugarUncertain = true;
}
}
let padres = "", padresUncertain = true;
{
const hasName = (tok)=>{
if (!tok) return false;
if (!NOMBRES_SET || NOMBRES_SET.size === 0) return false;
return NOMBRES_SET.has(normalize(tok));
};
if (idxIDESP !== -1){
const adeIdxs = (()=> {
const out = [];
const rx = /A[ DQCO0O]?E/g; // ADE, AOE, A0E, AQE, ACE y AE
rx.lastIndex = 0;
let m;
while ((m = rx.exec(NS))) {
const i = m.index;
if (idxIDESP !== -1 && i < idxIDESP) out.push(i);
if (idxIDESP !== -1 && i >= idxIDESP) break;
}
out.sort((a,b)=>a-b);
return out;
})();
let candidates = adeIdxs;
if (idxLUG !== -1){
const afterLugar = adeIdxs.filter(i => i > idxLUG);
if (afterLugar.length) candidates = afterLugar;
}
const extractPair = (segNS)=>{
let seg = (segNS||"").replace(/[0-9]+/g,'').replace(/[\/\|_!¡]+/g,'I');
const deco = (s)=>{
if (!s) return "";
if (hasName(s)) return tcase(s);
const C = s;
for (let k=2; k<=Math.min(12, C.length-2); k++){
const A = C.slice(0,k), B = C.slice(k);
if (hasName(A) && hasName(B)) return `${tcase(A)} ${tcase(B)}`;
}
return "";
};
for (let j=1;j<seg.length-1;j++){
if (seg[j] !== 'I') continue;
const L = seg.slice(0,j), R = seg.slice(j+1);
const Ld = deco(L), Rd = deco(R);
if (Ld && Rd) return `${Ld} y ${Rd}`;
}
const compact = seg.replace(/I+/g,'');
for (let m=2;m<=Math.min(24, compact.length-2);m++){
const L = compact.slice(0,m), R = compact.slice(m);
const Ld = deco(L), Rd = deco(R);
if (Ld && Rd) return `${Ld} y ${Rd}`;
}
const toks = seg.split(/I+/).filter(Boolean);
for (let a=0;a<toks.length;a++){
for (let b=a+1;b<toks.length;b++){
const Ld = deco(toks[a]), Rd = deco(toks[b]);
if (Ld && Rd) return `${Ld} y ${Rd}`;
}
}
return "";
};
if (candidates.length){
const iADE = candidates[candidates.length - 1];
const segNS = NS.slice(iADE + 3, idxIDESP);
const pair = extractPair(segNS);
if (pair){
padres = pair; padresUncertain = false;
} else {
padres = ""; padresUncertain = true;
}
} else if (idxLUG !== -1){
const start = idxLUG + (NS.startsWith('LUGARDENACIMIENTO', idxLUG) ? 'LUGARDENACIMIENTO'.length : 'LAGARDENACIMIENTO'.length);
if (start < idxIDESP){
const segNS = NS.slice(start, idxIDESP);
const pair = extractPair(segNS);
if (pair){
padres = pair; padresUncertain = false;
} else {
padres = ""; padresUncertain = true;
}
}
}
if (padres){
const parts = padres.split(/\s+y\s+/i);
if (parts.length===2){
const badA = PROV_SET.has(normalize(parts[0])) || MUNICIPIOS_SET.has(normalize(parts[0]));
const badB = PROV_SET.has(normalize(parts[1])) || MUNICIPIOS_SET.has(normalize(parts[1]));
if (badA || badB) padresUncertain = true;
}
}
}
}
(function(){
function lastProvinceBefore(limitIdx){
let last = null;
for (const [pNS, canon] of PROV_NOSPACE.entries()){
const i = NS.lastIndexOf(pNS, limitIdx);
if (i !== -1 && i <= limitIdx){
if (!last || i > last.index || (i === last.index && pNS.length > last.pNS.length)){
last = { index: i, canon, pNS };
}
}
}
return last;
}
if (idxLUG !== -1 && (!lugarNac || lugarUncertain)) {
const start = idxLUG + (NS.startsWith('LUGARDENACIMIENTO', idxLUG) ? 'LUGARDENACIMIENTO'.length : (NS.startsWith('LAGARDENACIMIENTO', idxLUG) ? 'LAGARDENACIMIENTO'.length : 0));
if (start > idxLUG) {
const pv = findProvinceAfter(NS, start);
if (pv) {
const rawStart = MAP[start] ?? 0;
const rawEnd   = MAP[pv.index + pv.pNS.length - 1] ?? (MAP[MAP.length-1] || RAW.length-1);
const segRaw   = RAW.slice(rawStart, rawEnd + 1);
const clean = segRaw.replace(/\s{2,}/g,' ').trim();
const municipioGuess = matchMunicipio(clean);
const provName = tcase(pv.canon);
if (municipioGuess.found) {
lugarNac = (normalize(municipioGuess.canon) === normalize(pv.canon))
? provName
: `${tcase(municipioGuess.canon)}, ${provName}`;
} else {
lugarNac = `${tcase(clean.replace(/\s*,\s*/g, ', '))}`.replace(/\s+,/g, ',');
}
lugarUncertain = false;
}
}
}
if (( !domicilio || domicilioUncertain ) && idxLUG !== -1) {
const pvPrev = lastProvinceBefore(idxLUG - 1);
if (pvPrev) {
const rawEnd = MAP[pvPrev.index + pvPrev.pNS.length - 1] ?? (MAP[MAP.length-1] || RAW.length-1);
const rawSearch = RAW.slice(0, rawEnd + 1);
const viaRx = /(DOMICILIO|C\.\s*|AVDA|AVENIDA|CL\s|CALLE|PASEO|PSO)/gi;
let m, lastMatch = null;
while ((m = viaRx.exec(rawSearch))) lastMatch = m;
if (lastMatch) {
const rawStart = Math.max(0, lastMatch.index + (lastMatch[1].toUpperCase()==='DOMICILIO' ? 'DOMICILIO'.length : 0));
let seg = RAW.slice(rawStart, rawEnd + 1)
.replace(/\s*,\s*/g, ', ')
.replace(/\s{2,}/g,' ')
.trim();
const muni = matchMunicipio(seg);
const provName = tcase(pvPrev.canon);
if (muni.found && normalize(muni.canon) !== normalize(pvPrev.canon)) {
if (!new RegExp(provName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$','i').test(seg)) {
seg = `${tcase(muni.canon)}, ${provName}`;
}
} else if (!/,\s*[A-ZÁÉÍÓÚÜÑ ]+$/.test(seg)) {
seg = `${seg.replace(/\s+,/g, ',')}, ${provName}`;
}
domicilio = seg;
domicilioUncertain = false;
}
}
}
})();
let MRZ_L1 = "", MRZ_L2 = "", MRZ_L3 = "";
if (idxIDESP !== -1) {
const firstArrows = NS.indexOf('<<<', idxIDESP);
if (firstArrows !== -1) {
MRZ_L1 = NS.slice(idxIDESP, firstArrows);
const winEnd = Math.min(NS.length, firstArrows + 180);
const winL2 = NS.slice(firstArrows + 3, winEnd);
const mL2 = winL2.match(/([0-9A-Z]{2})([0-9A-Z]{2})([0-9A-Z]{2}).([MF])/);
if (mL2) MRZ_L2 = mL2[0];
const idxESPwin = winL2.indexOf('ESP');
let afterIdxAbs = firstArrows + 3;
if (idxESPwin !== -1) afterIdxAbs = firstArrows + 3 + idxESPwin + 3;
const nextArrows = NS.indexOf('<<<', afterIdxAbs);
let l3Start = (nextArrows !== -1) ? nextArrows + 3 : afterIdxAbs;
while (l3Start < NS.length && !/[A-Z<]/.test(NS[l3Start])) l3Start++;
MRZ_L3 = NS.slice(l3Start, Math.min(NS.length, l3Start + 120));
}
}
function docFromL1L2(l1,l2){
if (!l1) return "";
const m = l1.match(/<{3,}/);
if (m){ const idx=m.index; if (idx>=9) return l1.slice(idx-9, idx).toUpperCase(); }
if (l2){ const clean=l1.replace(/</g,''); if (clean.length>=9) return clean.slice(-9).toUpperCase(); }
return "";
}
let numDoc = docFromL1L2(MRZ_L1, MRZ_L2);
let fechaNac="", sexo="";
if (MRZ_L2){
const m = MRZ_L2.match(/([0-9A-Z]{2})([0-9A-Z]{2})([0-9A-Z]{2}).([MF])/);
if (m){
const yy = parseInt(mapDigit(m[1][0]) + mapDigit(m[1][1]),10);
const mm = mapDigit(m[2][0]) + mapDigit(m[2][1]);
const dd = mapDigit(m[3][0]) + mapDigit(m[3][1]);
const year = yy >= 30 ? 1900 + yy : 2000 + yy;
fechaNac = `${dd}/${mm}/${year}`;
sexo = m[4] === 'F' ? 'FEMENINO' : 'MASCULINO';
}
}
(function(){
if (!MRZ_L1 && !MRZ_L2) return;
if (idxIDESP !== -1 && (!numDoc || numDoc.length < 8)) {
const afterID = NS.slice(idxIDESP + 5, idxIDESP + 60); // mira los 60 caracteres tras IDESP
const mDoc = afterID.match(/([A-Z0-9]{7,9})</); // DNI/NIE seguido de flecha
if (mDoc) numDoc = mDoc[1].toUpperCase();
}
if ((!fechaNac || !sexo) && idxIDESP !== -1) {
const afterID = NS.slice(idxIDESP, idxIDESP + 120);
const mL2 = afterID.match(/([0-9A-Z]{6})([MF])/);
if (mL2) {
const raw6 = mL2[1].split("").map(mapDigit).join("");
const yy = parseInt(raw6.slice(0,2), 10);
const mm = raw6.slice(2,4);
const dd = raw6.slice(4,6);
const year = yy >= 30 ? 1900 + yy : 2000 + yy;
fechaNac = `${dd}/${mm}/${year}`;
sexo = mL2[2] === 'F' ? 'FEMENINO' : 'MASCULINO';
}
}
})();
(function(){
if (idxIDESP === -1) return;
const okFecha = f => /^\d{2}\/\d{2}\/\d{4}$/.test(f) &&
(m=>m>=1&&m<=12)(parseInt(f.slice(3,5),10)) &&
(d=>d>=1&&d<=31)(parseInt(f.slice(0,2),10));
if (fechaNac && okFecha(fechaNac)) return;
const firstArrows = NS.indexOf('<<<', idxIDESP);
if (firstArrows === -1) return;
let sexAt = -1;
for (let p = firstArrows - 1; p >= idxIDESP; p--) {
const ch = NS[p];
if (ch === 'M' || ch === 'F') { sexAt = p; break; }
}
if (sexAt === -1) return;
if (sexAt - 7 >= idxIDESP) {
const raw7 = NS.slice(sexAt - 7, sexAt);        // 6 fecha + 1 check
const raw6 = raw7.slice(0, 6).split('').map(mapDigit).join('');
const yy = parseInt(raw6.slice(0,2), 10);
const mm = parseInt(raw6.slice(2,4), 10);
const dd = parseInt(raw6.slice(4,6), 10);
if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
const year = yy >= 30 ? 1900 + yy : 2000 + yy;
fechaNac = `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${year}`;
}
}
})();
let Nacionalidad = (MRZ_L1.includes('ESP') || MRZ_L2.includes('ESP')) ? "España" : "";
let nombre="", apellidos="";
if (MRZ_L3){
const parts = MRZ_L3.split('<').filter(Boolean);
const ap1 = (parts[0]||"").replace(/[0-9]/g,'');
const ap2 = (parts[1]||"").replace(/[0-9]/g,'');
const nom1= (parts[2]||"").replace(/[0-9]/g,'');
const nom2= (parts[3]||"").replace(/[0-9]/g,'');
apellidos = [ap1,ap2].filter(Boolean).join(' ').trim().toUpperCase();
nombre = tcase([nom1,nom2].filter(Boolean).join(' ').trim());
}
const sanitize = s => (s||"").replace(/^[\s:.,-]+|[\s:.,-]+$/g,'').replace(/\s{2,}/g,' ').trim();
let out = {
Nombre: tcase(sanitize(nombre)),
Apellidos: sanitize(apellidos).toUpperCase(),
"Tipo de documento": "DNI",
"Nº Documento": sanitize(numDoc||""),
Sexo: sanitize(sexo),
Nacionalidad: sanitize(Nacionalidad),
"Nombre de los Padres": tcase(sanitize(padres)).replace(/\sY\s/g,' y '),
"Fecha de nacimiento": sanitize(fechaNac),
"Lugar de nacimiento": tcase(sanitize(lugarNac)),
Domicilio: tcase(sanitize(domicilio)),
_flags:{
Nombre: !nombre,
Apellidos: !apellidos,
Padres: padresUncertain,
Lugar: lugarUncertain,
Domicilio: domicilioUncertain
}
};
return out;
}
function _normKey(s){
return (s||"")
.toString()
.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
.toUpperCase()
.replace(/[^A-Z0-9\s\-\/]/g,'')
.replace(/\s+/g,' ')
.trim();
}
function _buildCanonIndexes(){
const provArr = Array.isArray(window.PROVINCIAS_ES) ? window.PROVINCIAS_ES : [];
const muniObj = (window.MUNICIPIOS_ES && typeof window.MUNICIPIOS_ES === 'object') ? window.MUNICIPIOS_ES : null;
const provSet = new Set();
const provMap = new Map();
for (const p of provArr){
const canon = String(p||"").trim();
if (!canon) continue;
provSet.add(canon);
const k = _normKey(canon);
if (!provMap.has(k)) provMap.set(k, canon);
}
const muniByProv = new Map(); // provCanon -> Map(norm -> canonMun)
const muniGlobal = new Map(); // norm -> {mun, prov}
if (muniObj){
for (const provKey of Object.keys(muniObj)){
const list = Array.isArray(muniObj[provKey]) ? muniObj[provKey] : [];
const provCanon = provMap.get(_normKey(provKey)) || String(provKey||"").trim();
if (!muniByProv.has(provCanon)) muniByProv.set(provCanon, new Map());
const mMap = muniByProv.get(provCanon);
for (const m of list){
const mun = String(m||"").trim();
if (!mun) continue;
const mk = _normKey(mun);
if (!mMap.has(mk)) mMap.set(mk, mun);
if (!muniGlobal.has(mk)) muniGlobal.set(mk, { mun, prov: provCanon });
}
}
}
const paisSet = new Set();
const paisMap = new Map();
try{
const P = window.PAISES;
const addPais = (x)=>{
const c = String(x||"").trim();
if (!c) return;
paisSet.add(c);
const k=_normKey(c);
if(!paisMap.has(k)) paisMap.set(k,c);
};
if (P){
if (Array.isArray(P.featured)) P.featured.forEach(addPais);
if (Array.isArray(P.groups)){
P.groups.forEach(g=>{
if (g && Array.isArray(g.items)) g.items.forEach(addPais);
});
}
}
}catch(_){/* noop */}
return { provSet, provMap, muniByProv, muniGlobal, paisSet, paisMap };
}
const __CANON = _buildCanonIndexes();
function canonProvincia(raw){
const k = _normKey(raw);
return __CANON.provMap.get(k) || "";
}
function canonMunicipio(raw, provCanon){
const mk = _normKey(raw);
if (!mk) return "";
if (provCanon && __CANON.muniByProv.has(provCanon)){
const m = __CANON.muniByProv.get(provCanon).get(mk);
if (m) return m;
}
const g = __CANON.muniGlobal.get(mk);
return g ? g.mun : "";
}
function canonPais(raw){
const k = _normKey(raw);
return __CANON.paisMap.get(k) || "";
}
const ISO3_TO_PAIS = {ESP:"ESPAÑA",PRT:"PORTUGAL",FRA:"FRANCIA",DEU:"ALEMANIA",ITA:"ITALIA",NLD:"PAISES BAJOS",BEL:"BELGICA",LUX:"LUXEMBURGO",CHE:"SUIZA",AUT:"AUSTRIA",GBR:"REINO UNIDO",IRL:"IRLANDA",ISL:"ISLANDIA",NOR:"NORUEGA",SWE:"SUECIA",FIN:"FINLANDIA",DNK:"DINAMARCA",POL:"POLONIA",CZE:"REPUBLICA CHECA",SVK:"REPUBLICA ESLOVACA",HUN:"HUNGRIA",ROU:"RUMANIA",BGR:"BULGARIA",GRC:"GRECIA",CYP:"CHIPRE",HRV:"CROACIA",SVN:"ESLOVENIA",EST:"ESTONIA",LVA:"LETONIA",LTU:"LITUANIA",UKR:"UCRANIA",RUS:"RUSIA",BLR:"BIELORRUSIA",SRB:"SERBIA",MNE:"MONTENEGRO",MKD:"MACEDONIA DEL NORTE",ALB:"ALBANIA",BIH:"BOSNIA HERZEGOVINA",MLT:"MALTA",AND:"ANDORRA",MCO:"MONACO",SMR:"SAN MARINO",VAT:"CIUDAD DEL VATICANO",LIE:"LIECHTENSTEIN",KOS:"KOSOVO",USA:"ESTADOS UNIDOS AMERICA",CAN:"CANADA",MEX:"MEXICO",GTM:"GUATEMALA",HND:"HONDURAS",SLV:"EL SALVADOR",NIC:"NICARAGUA",CRI:"COSTA RICA",PAN:"PANAMA",CUB:"CUBA",DOM:"REPUBLICA DOMINICANA",HTI:"HAITI",JAM:"JAMAICA",COL:"COLOMBIA",VEN:"VENEZUELA",ECU:"ECUADOR",PER:"PERU",BOL:"BOLIVIA",CHL:"CHILE",ARG:"ARGENTINA",URY:"URUGUAY",PRY:"PARAGUAY",BRA:"BRASIL",GUY:"GUYANA",SUR:"SURINAME",BHS:"BAHAMAS",BRB:"BARBADOS",BLZ:"BELICE",ATG:"ANTIGUA Y BARBUDA",DMA:"DOMINICA",GRD:"GRANADA",KNA:"SAN CRISTOBAL Y NIEVES",LCA:"SANTA LUCIA",VCT:"SAN VICENTE Y LAS GRANADINAS",TTO:"TRINIDAD Y TOBAGO",MAR:"MARRUECOS",DZA:"ARGELIA",TUN:"TUNEZ",LBY:"LIBIA",EGY:"EGIPTO",SDN:"SUDAN",SSD:"SUDAN DEL SUR",ETH:"ETIOPIA",SOM:"SOMALIA",KEN:"KENIA",TZA:"TANZANIA",UGA:"UGANDA",RWA:"RUANDA",BDI:"BURUNDI",COD:"REPUBLICA DEMOCRATICA CONGO",COG:"REPUBLICA CONGO",CMR:"CAMERUN",NGA:"NIGERIA",GHA:"GHANA",CIV:"COSTA MARFIL",SEN:"SENEGAL",MLI:"MALI",NER:"NIGER",TCD:"CHAD",GAB:"GABON",AGO:"ANGOLA",ZMB:"ZAMBIA",ZWE:"ZIMBABUE",BWA:"BOTSUANA",NAM:"NAMIBIA",ZAF:"SUDAFRICA",MOZ:"MOZAMBIQUE",MDG:"MADAGASCAR",CPV:"CABO VERDE",GIN:"GUINEA",GNB:"GUINEA BISSAU",SLE:"SIERRA LEONA",LBR:"LIBERIA",GMB:"GAMBIA",MRT:"MAURITANIA",ESH:"SAHARA OCCIDENTAL",TUR:"TURQUIA",ISR:"ISRAEL",PSE:"PALESTINA",LBN:"LIBANO",SYR:"SIRIA",IRQ:"IRAK",IRN:"IRAN",SAU:"ARABIA SAUDI",ARE:"EMIRATOS ARABES UNIDOS",QAT:"CATAR",KWT:"KUWAIT",OMN:"OMAN",YEM:"YEMEN",JOR:"JORDANIA",AFG:"AFGANISTAN",PAK:"PAKISTAN",IND:"INDIA",BGD:"BANGLADESH",LKA:"SRI LANKA",NPL:"NEPAL",BTN:"BUTAN",MMR:"BIRMANIA",THA:"TAILANDIA",VNM:"VIETNAM",KHM:"CAMBOYA",LAO:"LAOS",MYS:"MALASIA",SGP:"SINGAPUR",IDN:"INDONESIA",PHL:"FILIPINAS",CHN:"CHINA",JPN:"JAPON",KOR:"COREA DEL SUR",PRK:"COREA DEL NORTE",MNG:"MONGOLIA",KAZ:"KAZAJISTAN",KGZ:"KIRGUISTAN",TJK:"TAYIKISTAN",TKM:"TURKMENISTAN",UZB:"UZBEKISTAN",GEO:"GEORGIA",ARM:"ARMENIA",AZE:"AZERBAYAN",AUS:"AUSTRALIA",NZL:"NUEVA ZELANDA",PNG:"PAPUA NUEVA GUINEA",FJI:"FIYI",SLB:"ISLAS SALOMON",MHL:"ISLAS MARSHALL",FSM:"MICRONESIA",KIR:"KIRIBATI",NRU:"NAURU",PLW:"PALAOS",WSM:"SAMOA",TON:"TONGA",TUV:"TUVALU",VUT:"VANUATU"};
function iso3ToPaisName(raw){
const s = (raw||"").toString().trim().toUpperCase();
if (!s) return "";
if (/^[A-Z]{3}$/.test(s)) return ISO3_TO_PAIS[s] || "";
return "";
}