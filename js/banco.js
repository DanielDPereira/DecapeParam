/* DecapeParam — persistência em IndexedDB.
 *
 * IMPORTANTE: o IndexedDB NÃO grava dentro da pasta do programa. Os dados ficam no perfil do navegador
 * (do usuário do Windows), associados ao endereço da página. Por isso o app oferece backup/restauração.
 * Se o IndexedDB não estiver disponível, funciona em memória (e avisa na tela).
 */
(function (DP) {
  'use strict';

  const NOME_BD = 'decapeparam';
  const VERSAO_BD = 1;
  const DEFS = {
    receitas: { keyPath: 'id' },                              // id = "M3232|0.5"
    paineis: { keyPath: 'slot' },                             // 1..174 (só os ocupados)
    pendentes: { keyPath: 'id', autoIncrement: true },        // cadastrados sem número de painel
    trocas: { keyPath: 'id', autoIncrement: true },           // histórico de trocas de faca
    geracoes: { keyPath: 'id', autoIncrement: true },         // histórico de arquivos gerados (+ snapshot)
    config: { keyPath: 'k' }                                  // pares {k, v}
  };
  const NOMES = Object.keys(DEFS);

  let db = null;
  let mem = null;                                             // fallback em memória
  const estado = { modo: 'indexeddb', motivo: '', persistente: null };

  function clonar(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  function iniciarMemoria() {
    mem = { dados: {}, seq: {} };
    NOMES.forEach(function (n) { mem.dados[n] = []; mem.seq[n] = 0; });
  }

  function abrir() {
    return new Promise(function (resolve) {
      function cair(motivo) { estado.modo = 'memoria'; estado.motivo = motivo; iniciarMemoria(); resolve(estado); }
      if (!window.indexedDB) return cair('IndexedDB indisponível neste navegador.');
      let rq;
      try { rq = window.indexedDB.open(NOME_BD, VERSAO_BD); } catch (e) { return cair(String(e)); }
      rq.onupgradeneeded = function () {
        const d = rq.result;
        NOMES.forEach(function (n) { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, DEFS[n]); });
      };
      rq.onsuccess = function () {
        db = rq.result;
        db.onversionchange = function () { db.close(); };
        verificarPersistencia().then(function () { resolve(estado); });
      };
      rq.onerror = function () { cair((rq.error && rq.error.message) || 'Falha ao abrir o banco de dados.'); };
      rq.onblocked = function () { cair('Banco bloqueado por outra janela aberta.'); };
    });
  }

  function verificarPersistencia() {
    try {
      if (navigator.storage && navigator.storage.persisted) {
        return navigator.storage.persisted().then(function (p) { estado.persistente = !!p; }, function () {});
      }
    } catch (e) { /* ignora */ }
    return Promise.resolve();
  }

  // Pede ao navegador para não apagar os dados sob pressão de espaço (alguns navegadores perguntam ao usuário).
  function pedirPersistencia() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        return navigator.storage.persist().then(function (p) { estado.persistente = !!p; return !!p; }, function () { return false; });
      }
    } catch (e) { /* ignora */ }
    return Promise.resolve(false);
  }

  function pedido(r) {
    return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; });
  }
  function transacao(nomes, modo) {
    const t = db.transaction(nomes, modo);
    const fim = new Promise(function (res, rej) {
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error || new Error('Transação cancelada.')); };
    });
    return { t: t, fim: fim };
  }

  function listar(nome) {
    if (mem) return Promise.resolve(clonar(mem.dados[nome]));
    return pedido(db.transaction(nome, 'readonly').objectStore(nome).getAll());
  }
  function obter(nome, chave) {
    if (mem) {
      const kp = DEFS[nome].keyPath;
      const a = mem.dados[nome].filter(function (o) { return o[kp] === chave; })[0];
      return Promise.resolve(clonar(a));
    }
    return pedido(db.transaction(nome, 'readonly').objectStore(nome).get(chave));
  }
  function gravar(nome, obj) {
    if (mem) {
      const kp = DEFS[nome].keyPath;
      const o = clonar(obj);
      if (o[kp] == null && DEFS[nome].autoIncrement) o[kp] = ++mem.seq[nome];
      else if (typeof o[kp] === 'number' && o[kp] > mem.seq[nome]) mem.seq[nome] = o[kp];
      const arr = mem.dados[nome];
      const i = arr.findIndex(function (x) { return x[kp] === o[kp]; });
      if (i >= 0) arr[i] = o; else arr.push(o);
      return Promise.resolve(o[kp]);
    }
    const x = transacao(nome, 'readwrite');
    const r = x.t.objectStore(nome).put(obj);
    return x.fim.then(function () { return r.result; });
  }
  function apagar(nome, chave) {
    if (mem) {
      const kp = DEFS[nome].keyPath;
      mem.dados[nome] = mem.dados[nome].filter(function (o) { return o[kp] !== chave; });
      return Promise.resolve();
    }
    const x = transacao(nome, 'readwrite');
    x.t.objectStore(nome).delete(chave);
    return x.fim;
  }

  // Troca o conteúdo de vários stores de uma vez (tudo ou nada). mapa = { nomeDoStore: [objetos] }.
  function substituir(mapa) {
    const nomes = Object.keys(mapa);
    if (mem) {
      nomes.forEach(function (n) {
        const kp = DEFS[n].keyPath;
        mem.dados[n] = clonar(mapa[n]) || [];
        mem.seq[n] = mem.dados[n].reduce(function (m, o) { const v = o[kp]; return typeof v === 'number' && v > m ? v : m; }, 0);
        if (DEFS[n].autoIncrement) mem.dados[n].forEach(function (o) { if (o[kp] == null) o[kp] = ++mem.seq[n]; });
      });
      return Promise.resolve();
    }
    const x = transacao(nomes, 'readwrite');
    nomes.forEach(function (n) {
      const s = x.t.objectStore(n);
      s.clear();
      (mapa[n] || []).forEach(function (o) { s.put(o); });
    });
    return x.fim;
  }

  function exportarTudo() {
    return Promise.all(NOMES.map(listar)).then(function (v) {
      const o = {};
      NOMES.forEach(function (n, i) { o[n] = v[i]; });
      return o;
    });
  }

  DP.banco = {
    NOMES: NOMES, estado: estado, abrir: abrir, pedirPersistencia: pedirPersistencia,
    listar: listar, obter: obter, gravar: gravar, apagar: apagar, substituir: substituir, exportarTudo: exportarTudo
  };
})(window.DP = window.DP || {});
