// comparecencia.js — pantalla Comparecencia (Doc + Comparecencia GPT + Pegar)
(() => {
  function $(id){ return document.getElementById(id); }

  async function readFromClipboard(){
    try{
      const txt = await navigator.clipboard.readText();
      return txt || "";
    }catch{
      const m = prompt("Pega manualmente el texto:");
      return m || "";
    }
  }

  function wire(){
    const btnCmp = $('gptComparecencia');
    const btnPaste = $('integrarDoc');
    const docEl = $('Doc');

    if (btnCmp){
      btnCmp.addEventListener('click', ()=>{
        window.open(
          'https://chatgpt.com/g/g-69492f8f5cbc8191bf094b7d16bdcb4b-intervencion',
          '_blank',
          'noopener'
        );
      });
    }

    if (btnPaste){
      btnPaste.addEventListener('click', async ()=>{
        const txt = await readFromClipboard();
        if (!txt.trim()) { alert('Portapapeles vacío.'); return; }
        if (docEl) docEl.value = txt;
        if (typeof expediente === 'object' && expediente) expediente.doc = txt;
      });
    }

    if (docEl){
      // reflejar doc existente si el textarea está vacío
      try{
        if (typeof expediente === 'object' && expediente && expediente.doc && !docEl.value){
          docEl.value = expediente.doc;
        }
      }catch(_){}

      docEl.addEventListener('input', (e)=>{
        if (typeof expediente === 'object' && expediente) expediente.doc = e.target.value;
      });
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();