function parseDateBackend(dStr, hStr) {
  if (!dStr) return 0; let dateObj;
  if (dStr.includes('/')) { let p = dStr.split('/'); if (p.length === 3) dateObj = new Date(p[2], p[1]-1, p[0]); else dateObj = new Date(); } 
  else if (dStr.includes('-')) { let p = dStr.split('-'); if (p.length === 3) dateObj = new Date(p[0], p[1]-1, p[2]); else dateObj = new Date(); } 
  else { dateObj = new Date(dStr); }
  if (hStr && hStr.includes(':')) { let hp = hStr.split(':'); dateObj.setHours(parseInt(hp[0]), parseInt(hp[1])); }
  return dateObj.getTime();
}

function formatDateToISO(val) {
    if (!val) return "";
    if (val instanceof Date) { return val.getFullYear() + '-' + String(val.getMonth()+1).padStart(2,'0') + '-' + String(val.getDate()).padStart(2,'0'); }
    let str = String(val).trim();
    if (str.includes('/')) { let p = str.split('/'); if (p.length === 3) return p[2] + '-' + p[1].padStart(2,'0') + '-' + p[0].padStart(2,'0'); }
    return str; 
}

function planilhaParaHtmlData(txt) { if (!txt) return ""; if (txt instanceof Date) return Utilities.formatDate(txt, TIMEZONE, "yyyy-MM-dd"); if (txt.includes('/')) { var p = txt.split('/'); if (p.length === 3) return p[2] + "-" + p[1] + "-" + p[0]; } return txt; }
function formatarDataParaPlanilha(dataIso) { if (!dataIso) return ""; const p = dataIso.split('-'); if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`; return dataIso; }
