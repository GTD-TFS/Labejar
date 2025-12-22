// servicios.js — pantalla Servicios (persistente hasta borrado especial)
(() => {
  const LS_KEY = 'LABEJAR_SERVICIOS_V1';

  function $(id){ return document.getElementById(id); }
  const safe = (v) => (v == null ? '' : String(v));

  function load(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch{
      return [];
    }
  }

  function save(arr){
    localStorage.setItem(LS_KEY, JSON.stringify(arr || []));
  }

  function normalizeRow(r){
    return {
      txt: safe(r?.txt).slice(0, 400),
      time: safe(r?.time)
    };
  }

  function render(){
    const host = $('svcGrid');
    if (!host) return;

    const data = load();
    host.innerHTML = '';

    if (!data.length){
      const p = document.createElement('div');
      p.className = 'badge';
      p.textContent = 'Sin servicios. Pulsa “＋ Añadir”.';
      host.appendChild(p);
      return;
    }

    data.forEach((row, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'svcRow';

      const inpTxt = document.createElement('textarea');
      inpTxt.placeholder = 'Servicio realizado (texto libre)';
      inpTxt.value = safe(row.txt);
      inpTxt.className = 'svcTxt';
      inpTxt.rows = 1;
      inpTxt.wrap = 'soft';

      const autoGrow = () => {
        inpTxt.style.height = 'auto';
        inpTxt.style.height = (inpTxt.scrollHeight) + 'px';
      };

      const inpTime = document.createElement('input');
      inpTime.type = 'time';
      inpTime.value = safe(row.time);

      const btnDel = document.createElement('button');
      btnDel.className = 'btn secondary svcDel';
      btnDel.type = 'button';
      btnDel.title = 'Eliminar fila';
      btnDel.textContent = '✕';

      const persist = () => {
        const arr = load();
        if (!arr[idx]) return;
        arr[idx] = normalizeRow({ txt: inpTxt.value, time: inpTime.value });
        save(arr);
      };

      inpTxt.addEventListener('input', ()=>{ persist(); autoGrow(); });
      inpTime.addEventListener('input', persist);

      btnDel.addEventListener('click', ()=>{
        const arr = load();
        arr.splice(idx, 1);
        save(arr);
        render();
      });

      wrap.appendChild(inpTime);
      wrap.appendChild(btnDel);
      wrap.appendChild(inpTxt);
      host.appendChild(wrap);
      autoGrow();
    });
  }

  function wire(){
    const btnAdd = $('svcAdd');
    const btnClear = $('svcClear');

    if (btnAdd){
      btnAdd.addEventListener('click', ()=>{
        const arr = load();
        arr.push({ txt:'', time:'' });
        save(arr);
        render();

        setTimeout(()=>{
          const host = $('svcGrid');
          const last = host?.querySelector('.svcRow:last-child .svcTxt');
          last?.focus();
        }, 0);
      });
    }

    if (btnClear){
      btnClear.addEventListener('click', ()=>{
        const ok = confirm('Borrado especial: esto eliminará TODOS los servicios guardados en este dispositivo. ¿Continuar?');
        if (!ok) return;
        const ok2 = confirm('Confirmación final: ¿borrar servicios ahora?');
        if (!ok2) return;
        localStorage.removeItem(LS_KEY);
        alert('Servicios borrados.');
        render();
      });
    }

    render();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
