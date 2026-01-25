/* crypto_json.js
 * Cifra JSON para que sea 100% compatible con COMPA·POL (js/cifrado.js).
 * Formato de salida (JSON válido):
 *   {
 *     "alg":"AES-GCM",
 *     "kdf":"PBKDF2-SHA256",
 *     "it":200000,
 *     "__compapol_enc_v1":"<base64(salt16+iv12+ct)>"
 *   }
 * NOTA: No usamos prefijos tipo ENC1:, porque DENU/COMPA persisten/descargan JSON.
 */
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);

  // Contraseña fija (no se solicita al usuario)
  const DEFAULT_COMPAPOL_PASS = "adejegtd";

  // Estado: el cifrado se genera en un click (async) y se copia en otro click (sync) para iOS/Safari
  let LAST_ENCRYPTED_JSON = "";

  // Último nombre sugerido (si exportarJSON lo proporciona)
  let LAST_FILENAME = "registro.json";

  // Integración opcional con Firebase (DenuPol). No rompe si no existe.
  // Espera que la página anfitriona exponga: window.DENU_FB = { db, auth, serverTimestamp, addDoc, collection }
  function getDenuFb(){
    const fb = window.DENU_FB;
    if (!fb) return null;
    const ok = fb.db && fb.auth && fb.serverTimestamp && fb.addDoc && fb.collection;
    return ok ? fb : null;
  }

  async function persistEncryptedToDenupol(encJsonText, filename){
    const fb = getDenuFb();
    if (!fb) throw new Error("Firebase no disponible (falta window.DENU_FB)");

    const user = fb.auth.currentUser;
    if (!user || !user.uid) throw new Error("No autenticado en Firebase");

    const name = (String(filename || "registro").trim() || "registro")
      .replace(/\.json$/i, "") + ".json";

    await fb.addDoc(fb.collection(fb.db, "registros"), {
      ownerUid: user.uid,
      filename: name,
      encJson: String(encJsonText || ""),
      createdAt: fb.serverTimestamp()
    });

    showToast("Guardado en DenuPol");
  }

  function showToast(text){
    const prev = document.getElementById('denuToast');
    if (prev) prev.remove();

    const t = document.createElement('div');
    t.id = 'denuToast';
    t.textContent = text;
    t.style.cssText = `
      position:fixed;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      background:rgba(15,25,40,.92);
      color:#fff;
      padding:10px 16px;
      border-radius:14px;
      font-weight:800;
      letter-spacing:.2px;
      z-index:999999;
      box-shadow:0 12px 30px rgba(0,0,0,.55);
      border:1px solid rgba(255,255,255,.14);
      opacity:0;
      transition:opacity .15s ease, transform .15s ease;
    `;

    document.body.appendChild(t);
    requestAnimationFrame(()=>{
      t.style.opacity = '1';
      t.style.transform = 'translateX(-50%) translateY(-4px)';
    });

    setTimeout(()=>{
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(6px)';
      setTimeout(()=> t.remove(), 200);
    }, 1000);
  }

  function b64enc(bytes){
    let bin = "";
    const chunk = 0x8000;
    for (let i=0;i<bytes.length;i+=chunk){
      bin += String.fromCharCode.apply(null, bytes.subarray(i,i+chunk));
    }
    return btoa(bin);
  }
  function b64dec(b64){
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(password, salt, iterations){
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      { name:"PBKDF2", hash:"SHA-256", salt, iterations },
      baseKey,
      { name:"AES-GCM", length:256 },
      false,
      ["encrypt","decrypt"]
    );
  }

  // Devuelve STRING JSON (wrapper COMPAPOL) — MISMO ALGORITMO QUE js/cifrado.js
  async function encryptText(plainObj, password){
    password = DEFAULT_COMPAPOL_PASS;
    const jsonStr = JSON.stringify(plainObj); // IMPORTANTE: objeto → JSON (sin pretty)

    const salt = new Uint8Array(16); crypto.getRandomValues(salt);
    const iv   = new Uint8Array(12); crypto.getRandomValues(iv);

    // COMPAPOL usa 200000 iteraciones y wrapper __compapol_enc_v1
    const iterations = 200000;
    const key = await deriveKey(password, salt, iterations);

    const ctBuf = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, new TextEncoder().encode(jsonStr));
    const ct = new Uint8Array(ctBuf);

    // COMPAPOL: base64( salt[16] + iv[12] + ct[n] )
    const full = new Uint8Array(salt.length + iv.length + ct.length);
    full.set(salt, 0);
    full.set(iv, salt.length);
    full.set(ct, salt.length + iv.length);

    // MISMO wrapper/meta que js/cifrado.js
    const wrapped = {
      alg: "AES-GCM",
      kdf: "PBKDF2-SHA256",
      it: iterations,
      __compapol_enc_v1: b64enc(full)
    };

return wrapped.__compapol_enc_v1;
  }

  // Acepta wrapper COMPAPOL (o base64(full)) y devuelve texto plano
  async function decryptText(encText, password){
    password = DEFAULT_COMPAPOL_PASS;
    const raw = String(encText||"").trim();
    if (!raw) throw new Error("Texto vacío");

    let obj = null;
    try{ obj = JSON.parse(raw); }catch(_){ obj = null; }

    let b64 = "";
    let iterations = 200000;

    if (obj && typeof obj === "object" && typeof obj.__compapol_enc_v1 === "string" && obj.__compapol_enc_v1.trim()){
      b64 = String(obj.__compapol_enc_v1||"").trim();
      iterations = Number(obj.it) || 200000;
    } else {
      // Compat: base64 directo
      b64 = raw;
      iterations = 200000;
    }

    const full = b64dec(b64);
    if (full.length < 16 + 12 + 1) throw new Error("Datos insuficientes");

    const salt = full.slice(0, 16);
    const iv   = full.slice(16, 28);
    const ct   = full.slice(28);

    const key = await deriveKey(password, salt, iterations);
    const ptBuf = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(ptBuf);
  }

  async function clipWrite(text){
    // Igual que en Fil.html: clipboard si se puede; si no, prompt manual (Safari/permisos)
    if (navigator.clipboard && navigator.clipboard.writeText){
      try{
        await navigator.clipboard.writeText(text);
        return true;
      }catch(_e){ /* cae a prompt */ }
    }
    prompt('Copia el JSON cifrado:', text);
    return false;
  }

  async function getJsonTextFromExportar(){
    if (typeof window.exportarJSON !== "function") throw new Error("exportarJSON() no existe.");

    // Caso 1: si exportarJSON soporta retorno, lo usamos.
    try{
      const r = await window.exportarJSON({ noSave:true, returnText:true });
      if (r && typeof r.jsonText === 'string' && r.jsonText.trim()){
        const fileName = (r.fileName || r.filename || r.name || "registro.json");
        return { jsonText: r.jsonText, fileName };
      }
    }catch(_e){ /* ignorar y usar captura */ }

    // Caso 2 (fallback): capturamos el JSON que exportarJSON pasa a saveBlobJson(text, filename)
    const prevSave = window.saveBlobJson;
    if (typeof prevSave !== 'function') throw new Error('saveBlobJson() no existe (no puedo capturar el JSON).');

    let captured = '';
    let capturedName = 'registro.json';

    window.saveBlobJson = async function(text, filename){
      captured = String(text || '');
      capturedName = String(filename || 'registro.json') || 'registro.json';
      // NO descargar: resolvemos como si se hubiese guardado.
      return;
    };

    try{
      await window.exportarJSON();
    } finally {
      window.saveBlobJson = prevSave;
    }

    if (!captured.trim()) throw new Error('No se pudo obtener el JSON (exportarJSON no llamó a saveBlobJson).');
    return { jsonText: captured, fileName: capturedName };
  }

  async function onGenerateEncryptedJson(){
    const pack = await getJsonTextFromExportar();
    const jsonText = pack.jsonText;
    LAST_FILENAME = pack.fileName || LAST_FILENAME;

    let plainObj;
    try{ plainObj = JSON.parse(jsonText); }
    catch(_e){ alert("El JSON generado no es válido."); return; }

    // COMPAPOL abre 'snapshots' con {doc, filiaciones:[...]}.
    // Si el JSON de Registro es una filiación suelta, lo envolvemos para que COMPA·POL lo abra.
    const isSnapshot = !!(plainObj && typeof plainObj === 'object' && (('filiaciones' in plainObj) || ('html' in plainObj) || ('doc' in plainObj)));
    const payload = isSnapshot ? plainObj : { doc: "", filiaciones: [ plainObj ] };

    // cifrar wrapper COMPAPOL (objeto real)
    LAST_ENCRYPTED_JSON = await encryptText(payload);

    showToast("JSON generado");
  }

  function onCopyEncryptedJsonSync(){
    if (!LAST_ENCRYPTED_JSON){
      alert("Primero genera el JSON cifrado.");
      return;
    }

    // Copia SIN async/await (requisito iOS/Safari: debe ocurrir en el gesto de click)
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(LAST_ENCRYPTED_JSON).then(()=>{
        showToast("JSON copiado");
      }).catch(()=>{
        prompt('Copia el JSON cifrado:', LAST_ENCRYPTED_JSON);
      });
      return;
    }

    prompt('Copia el JSON cifrado:', LAST_ENCRYPTED_JSON);
  }

  async function onSaveEncryptedJsonToDenupol(){
    if (!LAST_ENCRYPTED_JSON){
      await onGenerateEncryptedJson();
    }
    await persistEncryptedToDenupol(LAST_ENCRYPTED_JSON, LAST_FILENAME);
  }

  function wire(){
    const gen = $("btnGenEncJson");
    const cop = $("btnCopyEncJson");
    const sav = $("btnSaveEncJson");

    if (gen) gen.addEventListener("click", ()=>{ onGenerateEncryptedJson().catch(e=>alert("ERROR cifrando: " + (e?.message||e))); });
    if (cop) cop.addEventListener("click", onCopyEncryptedJsonSync);
    if (sav) sav.addEventListener("click", ()=>{ onSaveEncryptedJsonToDenupol().catch(e=>alert("ERROR guardando en DenuPol: " + (e?.message||e))); });
  }

  // Exponer utilidades
  window.DENU_CRYPT = { encryptText, decryptText, persistEncryptedToDenupol, DEFAULT_COMPAPOL_PASS };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  // Estilo visual del botón GENERAR
  const __style = document.createElement('style');
  __style.textContent = `
  #btnGenEncJson,
  #btnCopyEncJson,
  #btnSaveEncJson{
    display:block;
    width:min(520px, calc(100% - 36px));
    margin:10px auto 10px;
    padding:12px 18px;
    border-radius:14px;
    font-weight:900;
    letter-spacing:.3px;
    color:#fff;
    border:1px solid rgba(120,160,255,.55);
    background:linear-gradient(135deg, rgba(90,130,255,.35), rgba(40,70,220,.28));
    box-shadow:0 10px 26px rgba(40,80,255,.45);
    cursor:pointer;
    text-transform:uppercase;
  }

  #btnGenEncJson:active,
  #btnCopyEncJson:active{
    transform:translateY(1px);
    box-shadow:0 6px 18px rgba(40,80,255,.35);
  }
`;
  document.head.appendChild(__style);
})();
