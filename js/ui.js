/* DecapeParam — utilitários de interface: criação de DOM, diálogos, avisos, formatação, salvar/copiar. */
(function (DP) {
  'use strict';

  // h('div', {class:'x', onclick: fn}, filhos...)  — usa textContent (nunca innerHTML): seguro com qualquer texto.
  function h(tag, attrs) {
    const el = document.createElement(tag);
    let valor;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'value') valor = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (typeof el[k] === 'boolean') el[k] = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (let i = 2; i < arguments.length; i++) anexar(el, arguments[i]);
    if (valor !== undefined) el.value = valor;
    return el;
  }
  function anexar(el, f) {
    if (f == null || f === false) return;
    if (Array.isArray(f)) { f.forEach(function (x) { anexar(el, x); }); return; }
    el.appendChild(f.nodeType ? f : document.createTextNode(String(f)));
  }
  function limpar(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  // ---- Formatação (pt-BR) -----------------------------------------------------------------------
  function fmtMm(um) {                         // 41800 -> "41,8"
    return (um / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
  }
  function fmtBitola(b) { return Number(b).toFixed(2).replace('.', ','); }   // "0.5" -> "0,50"
  function fmtData(iso) {                       // "2026-09-11" -> "11/09/2026"
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '');
  }
  function fmtDataHora(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso || '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function fmtInt(n) { return Number(n).toLocaleString('pt-BR'); }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
  function nomeReceita(r) { return r.mspec + ' · ' + fmtBitola(r.bitola) + ' mm² · ' + r.filamentos; }

  // ---- Avisos (toast) ---------------------------------------------------------------------------
  function toast(msg, tipo) {
    const area = document.getElementById('toasts');
    if (!area) return;
    const t = h('div', { class: 'toast ' + (tipo || 'info'), role: tipo === 'erro' ? 'alert' : 'status' }, msg);
    area.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, tipo === 'erro' ? 8000 : 4500);
  }

  // ---- Diálogos ---------------------------------------------------------------------------------
  // dialogo({titulo, corpo, botoes:[{rotulo, tipo, acao}] , largo})
  //   acao() pode devolver false (ou Promise<false>) para manter o diálogo aberto.
  //   Resolve com o rótulo do botão acionado (ou null se fechado com Esc/Cancelar).
  function dialogo(opc) {
    return new Promise(function (resolve) {
      const d = h('dialog', { class: 'dialogo' + (opc.largo ? ' largo' : '') });
      let resultado = null;
      const barra = h('div', { class: 'dialogo-botoes' });
      (opc.botoes || [{ rotulo: 'Fechar' }]).forEach(function (b) {
        const bt = h('button', { type: 'button', class: 'btn ' + (b.tipo || '') }, b.rotulo);
        bt.addEventListener('click', function () {
          Promise.resolve(b.acao ? b.acao() : true).then(function (r) {
            if (r === false) return;
            resultado = b.rotulo;
            fechar();
          });
        });
        barra.appendChild(bt);
      });
      function fechar() { if (d.open || d.hasAttribute('open')) { try { d.close(); } catch (e) { d.removeAttribute('open'); finalizar(); } } else finalizar(); }
      function finalizar() { if (d.parentNode) d.parentNode.removeChild(d); resolve(resultado); }
      d.addEventListener('close', finalizar);
      d.addEventListener('cancel', function () { resultado = null; });
      d.appendChild(h('form', { method: 'dialog', onsubmit: function (e) { e.preventDefault(); } },
        h('h2', null, opc.titulo), h('div', { class: 'dialogo-corpo' }, opc.corpo), barra));
      document.body.appendChild(d);
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      const foco = d.querySelector('[data-foco]') || d.querySelector('input,select,textarea') || barra.querySelector('button');
      if (foco) foco.focus();
    });
  }

  function confirmar(titulo, mensagem, rotuloOk, perigo) {
    return dialogo({
      titulo: titulo,
      corpo: [].concat(mensagem).map(function (m) { return h('p', null, m); }),
      botoes: [{ rotulo: 'Cancelar' }, { rotulo: rotuloOk || 'Confirmar', tipo: perigo ? 'perigo' : 'primario' }]
    }).then(function (r) { return r === (rotuloOk || 'Confirmar'); });
  }

  // Campo de formulário com rótulo e mensagem de erro.
  function campo(rotulo, controle, ajuda) {
    const erro = h('div', { class: 'campo-erro', role: 'alert' });
    const lab = h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, rotulo), controle,
      ajuda ? h('span', { class: 'campo-ajuda' }, ajuda) : null, erro);
    lab.mostrarErro = function (m) { erro.textContent = m || ''; controle.classList.toggle('invalido', !!m); };
    return lab;
  }

  // ---- Saída de arquivos ------------------------------------------------------------------------
  // Salva texto em arquivo. Em navegadores Chromium usa a janela "Salvar como" (como a macro do Excel);
  // nos demais, baixa direto para a pasta de downloads.
  function salvarArquivo(nome, conteudo, opc) {
    opc = opc || {};
    const partes = opc.bom ? ['﻿', conteudo] : [conteudo];
    const mime = opc.mime || 'text/plain';
    const blob = new Blob(partes, { type: mime + ';charset=utf-8' });
    const ext = '.' + nome.split('.').pop();

    function baixar() {
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: nome });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
      return { ok: true, via: 'download', nome: nome };
    }

    if (window.showSaveFilePicker) {
      const tipos = {}; tipos[mime] = [ext];
      return window.showSaveFilePicker({ suggestedName: nome, types: [{ description: opc.descricao || 'Arquivo', accept: tipos }] })
        .then(function (hd) {
          return hd.createWritable().then(function (w) {
            return w.write(blob).then(function () { return w.close(); });
          }).then(function () { return { ok: true, via: 'janela', nome: hd.name }; });
        })
        .catch(function (e) {
          if (e && e.name === 'AbortError') return { ok: false, cancelado: true };
          return baixar();                              // permissão negada / API indisponível: cai para o download comum
        });
    }
    return Promise.resolve(baixar());
  }

  function copiarTexto(txt) {
    function plano() {
      const ta = h('textarea', { class: 'fora-da-tela', 'aria-hidden': 'true' });
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.parentNode.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return plano(); });
    }
    return Promise.resolve(plano());
  }

  // Lê arquivo texto escolhido pelo usuário. Tenta UTF-8; se houver bytes inválidos, usa Windows-1252 (Excel "ANSI").
  function lerArquivoTexto(file) {
    return new Promise(function (res, rej) {
      const fr = new FileReader();
      fr.onerror = function () { rej(fr.error || new Error('Falha ao ler o arquivo.')); };
      fr.onload = function () {
        const buf = fr.result;
        try { res(new TextDecoder('utf-8', { fatal: true }).decode(buf)); }
        catch (e) {
          try { res(new TextDecoder('windows-1252').decode(buf)); }
          catch (e2) { res(new TextDecoder('utf-8').decode(buf)); }
        }
      };
      fr.readAsArrayBuffer(file);
    });
  }

  DP.ui = {
    h: h, limpar: limpar, fmtMm: fmtMm, fmtBitola: fmtBitola, fmtData: fmtData, fmtDataHora: fmtDataHora,
    fmtInt: fmtInt, plural: plural, nomeReceita: nomeReceita, toast: toast, dialogo: dialogo, confirmar: confirmar,
    campo: campo, salvarArquivo: salvarArquivo, copiarTexto: copiarTexto, lerArquivoTexto: lerArquivoTexto
  };
})(window.DP = window.DP || {});
