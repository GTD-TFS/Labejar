

// importar.js — Importar (merge) proyecto en el expediente actual
// Reglas (según requisitos):
// - NO se buscan duplicidades: se añaden TODAS las filiaciones.
// - doc importado se AÑADE después del doc actual.
// - Soporta .json (plano) y .enc (base64 de salt+iv+cipher AES-GCM, PBKDF2 SHA-256, 200000 iter.)

(() => {
  const wire = () => {
    const btn = document.getElementById('loadPlain');
    const input = document.getElementById('plainInput');
    if (!btn || !input) return;

  // Helpers base64/crypto (compat con el formato de encryptJSON del index)
  const __enc = new TextEncoder();
  const __dec = new TextDecoder();

  function b64ToBytes(b64){
    const bin = atob((b64 || "").trim());
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function deriveKeyFromPassphraseDecrypt(pass, salt){
    const baseKey = await crypto.subtle.importKey(
      "raw",
      __enc.encode(pass),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  async function decryptB64ToJSON(b64, pass){
    const bytes = b64ToBytes(b64);
    if (bytes.length < 16 + 12 + 1) throw new Error("Cifrado inválido (tamaño insuficiente)");

    const salt = bytes.slice(0, 16);
    const iv   = bytes.slice(16, 28);
    const data = bytes.slice(28);

    const key = await deriveKeyFromPassphraseDecrypt(pass, salt);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    const plainText = __dec.decode(plainBuf);
    return JSON.parse(plainText);
  }

  function safeString(v){
    return (v == null) ? "" : String(v);
  }

  function appendDoc(current, incoming){
    const cur = safeString(current);
    const inc = safeString(incoming);
    if (!inc.trim()) return cur;

    if (!cur.trim()) return inc;
    return cur.replace(/\s+$/,'') + "\n\n" + inc;
  }

  function applyImported(data){
    if (!data || typeof data !== "object") throw new Error("Formato inesperado");

    if (typeof expediente !== 'object' || !expediente) {
      throw new Error("No existe 'expediente' en memoria.");
    }

    // Asegurar estado actual del doc
    const docEl = document.getElementById('Doc');
    const currentDoc = docEl ? (docEl.value || "") : (expediente.doc || "");

    const incomingDoc = safeString(data.doc || "");
    const incomingF = Array.isArray(data.filiaciones) ? data.filiaciones : [];

    expediente.doc = appendDoc(currentDoc, incomingDoc);

    if (!Array.isArray(expediente.filiaciones)) expediente.filiaciones = [];
    expediente.filiaciones.push(...incomingF);

    if (docEl) docEl.value = expediente.doc;

    if (typeof window.updateCount === 'function') window.updateCount();
    if (typeof window.validateAll === 'function') window.validateAll();

    const added = incomingF.length;
    const docAdded = incomingDoc.trim() ? "sí" : "no";
    alert(`Importación aplicada.\n\nFiliaciones añadidas: ${added}\nDoc añadido: ${docAdded}`);
  }

  async function readFileAsText(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve((ev.target?.result || "").toString());
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function tryParseJSON(text){
    const t = (text || "").trim();
    if (!t) return null;
    // Intento directo: JSON plano
    if (t.startsWith('{') || t.startsWith('[')) {
      return JSON.parse(t);
    }
    return null;
  }

    btn.addEventListener('click', () => {
      input.value = "";
      input.click();
    });

    input.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try{
        const text = (await readFileAsText(file)).trim();
        if (!text){
          alert("Archivo vacío o no válido.");
          return;
        }

        // 1) JSON plano
        let parsed = null;
        try{
          parsed = tryParseJSON(text);
        }catch(_){ /* seguirá con .enc */ }

        if (parsed){
          applyImported(parsed);
          return;
        }

        // 2) Cifrado .enc (base64) — pedir contraseña
        const pass = (prompt('Contraseña para importar (archivo cifrado):') || '').trim();
        if (!pass) return;

        const data = await decryptB64ToJSON(text, pass);
        applyImported(data);

      }catch(err){
        console.error("Error al importar:", err);
        alert("No se ha podido importar. Archivo inválido, dañado o contraseña incorrecta.");
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();