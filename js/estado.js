/* DecapeParam — estado em memória da aplicação + operações que gravam no banco. */
(function (DP) {
  'use strict';
  const N = DP.nucleo, B = DP.banco;

  const DIAS_LEMBRETE_BACKUP = 14;

  const E = DP.estado = {
    receitas: [],            // ordenadas por "ordem"
    paineis: {},             // slot -> painel (só ocupados)
    pendentes: [],           // cadastrados sem número de painel
    trocas: [],              // histórico de facas (mais recente primeiro)
    geracoes: [],            // histórico de arquivos gerados (mais recente primeiro)
    config: {},              // k -> v
    camposInvalidos: {},     // "ID:PARAM" -> {texto, erro}   (digitado mas não aceito)
    aba: 'receitas',
    filtroPaineis: { texto: '', situacao: 'todos' }
  };
  DP.DIAS_LEMBRETE_BACKUP = DIAS_LEMBRETE_BACKUP;

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  DP.carregar = function () {
    return Promise.all(B.NOMES.map(function (n) { return B.listar(n); })).then(function (v) {
      const d = {};
      B.NOMES.forEach(function (n, i) { d[n] = v[i]; });
      E.receitas = d.receitas.sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
      E.paineis = {};
      d.paineis.forEach(function (p) { E.paineis[p.slot] = p; });
      E.pendentes = d.pendentes.sort(function (a, b) { return a.id - b.id; });
      E.trocas = d.trocas.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id; });
      E.geracoes = d.geracoes.sort(function (a, b) { return b.id - a.id; });
      E.config = {};
      d.config.forEach(function (c) { E.config[c.k] = c.v; });
    });
  };

  // Primeira abertura: popula o banco com os dados extraídos da planilha original.
  DP.semear = function () {
    const D = DP.DADOS_INICIAIS;
    const receitas = clonar(D.receitas);
    const snap = N.snapshot(D.paineis, receitas);
    return B.substituir({
      receitas: receitas,
      paineis: clonar(D.paineis),
      pendentes: clonar(D.pendentes),
      trocas: clonar(D.trocas),
      geracoes: [{
        quando: D.baselineQuando, arquivo: D.baselineArquivo, origem: 'inicial', via: 'planilha',
        linhas: N.TOTAL_PAINEIS * 4, ocupados: D.paineis.length,
        checksum: N.checksum(N.gerarTxt(D.paineis, receitas)), receitas: snap.receitas, mapa: snap.mapa
      }],
      config: [{ k: 'semeado', v: true }, { k: 'origem', v: D.origem }]
    });
  };

  DP.iniciarDados = function () {
    return B.obter('config', 'semeado').then(function (s) { return s ? null : DP.semear(); }).then(DP.carregar);
  };

  DP.restaurarFabrica = function () {
    E.camposInvalidos = {};
    return DP.semear().then(DP.carregar);
  };

  // ---- Config -------------------------------------------------------------------------------------
  DP.gravarConfig = function (k, v) { E.config[k] = v; return B.gravar('config', { k: k, v: v }); };
  // "Há alterações que ainda não foram copiadas para um backup" (para o lembrete).
  DP.marcarSujo = function () { return E.config.sujo ? Promise.resolve() : DP.gravarConfig('sujo', true); };
  DP.lembreteBackup = function () {
    if (!E.config.sujo) return null;
    const ub = E.config.ultimoBackup;
    if (!ub) return { nunca: true };
    const dias = (Date.now() - new Date(ub).getTime()) / 86400000;
    return dias >= DIAS_LEMBRETE_BACKUP ? { dias: Math.floor(dias) } : null;
  };

  // ---- Receitas -----------------------------------------------------------------------------------
  DP.ultimaGeracao = function () { return E.geracoes[0] || null; };

  DP.gravarReceita = function (r) { return B.gravar('receitas', r).then(DP.marcarSujo); };
  DP.criarReceita = function (r) {
    E.receitas.push(r);
    return DP.gravarReceita(r);
  };
  DP.excluirReceita = function (r) {
    E.receitas = E.receitas.filter(function (x) { return x.id !== r.id; });
    return B.apagar('receitas', r.id).then(DP.marcarSujo);
  };
  DP.usosDaReceita = function (r) {
    const k = N.chaveReceita(r.mspec, r.bitola);
    return Object.keys(E.paineis).filter(function (s) { return N.chaveReceita(E.paineis[s].mspec, E.paineis[s].bitola) === k; }).length
      + E.pendentes.filter(function (p) { return N.chaveReceita(p.mspec, p.bitola) === k; }).length;
  };
  DP.receitaDoPainel = function (p) { return N.indexarReceitas(E.receitas)[N.chaveReceita(p.mspec, p.bitola)] || null; };

  // ---- Painéis ------------------------------------------------------------------------------------
  DP.salvarPainel = function (p, slotAnterior, pendenteId) {
    let seq = Promise.resolve();
    if (slotAnterior && slotAnterior !== p.slot) {
      seq = seq.then(function () { delete E.paineis[slotAnterior]; return B.apagar('paineis', slotAnterior); });
    }
    seq = seq.then(function () { E.paineis[p.slot] = p; return B.gravar('paineis', p); });
    if (pendenteId != null) {
      seq = seq.then(function () {
        E.pendentes = E.pendentes.filter(function (x) { return x.id !== pendenteId; });
        return B.apagar('pendentes', pendenteId);
      });
    }
    return seq.then(DP.marcarSujo);
  };
  DP.liberarPainel = function (slot) {
    delete E.paineis[slot];
    return B.apagar('paineis', slot).then(DP.marcarSujo);
  };
  DP.excluirPendente = function (id) {
    E.pendentes = E.pendentes.filter(function (x) { return x.id !== id; });
    return B.apagar('pendentes', id).then(DP.marcarSujo);
  };
  DP.substituirLista = function (paineis, pendentes) {
    return B.substituir({ paineis: paineis, pendentes: pendentes }).then(DP.carregar).then(DP.marcarSujo);
  };

  // ---- Trocas de faca -----------------------------------------------------------------------------
  DP.registrarTroca = function (t) {
    return B.gravar('trocas', t).then(function (id) {
      t.id = id;
      E.trocas.push(t);
      E.trocas.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id; });
    }).then(DP.marcarSujo);
  };
  DP.excluirTroca = function (id) {
    E.trocas = E.trocas.filter(function (x) { return x.id !== id; });
    return B.apagar('trocas', id).then(DP.marcarSujo);
  };

  // ---- Gerações (histórico de arquivos) ---------------------------------------------------------
  const MAX_GERACOES = 30;
  DP.registrarGeracao = function (info) {
    const snap = N.snapshot(E.paineis, E.receitas);
    const g = {
      quando: new Date().toISOString(), arquivo: info.arquivo, via: info.via, origem: 'gerado',
      linhas: N.TOTAL_PAINEIS * 4, ocupados: Object.keys(E.paineis).length, checksum: info.checksum,
      receitas: snap.receitas, mapa: snap.mapa
    };
    return B.gravar('geracoes', g).then(function (id) {
      g.id = id;
      E.geracoes.unshift(g);
      const sobra = E.geracoes.splice(MAX_GERACOES);
      return Promise.all(sobra.map(function (x) { return B.apagar('geracoes', x.id); }));
    }).then(DP.marcarSujo);
  };

  // ---- Pendências em relação ao último arquivo gerado -------------------------------------------
  DP.pendencias = function () {
    const u = DP.ultimaGeracao();
    const vazio = { alteracoes: [], novas: [], removidas: [], mapa: [], grandes: 0, total: 0 };
    if (!u) return vazio;
    const d = N.diffReceitas(u.receitas, E.receitas);
    const m = N.diffMapa(u.mapa, E.paineis);
    return {
      alteracoes: d.alteracoes, novas: d.novas, removidas: d.removidas, mapa: m,
      grandes: d.alteracoes.filter(function (x) { return x.alerta; }).length,
      total: d.alteracoes.length + d.novas.length + d.removidas.length + m.length
    };
  };

  DP.listaPaineis = function () {
    return Object.keys(E.paineis).map(function (s) { return E.paineis[s]; });
  };
  DP.eletrodosConhecidos = function () {
    const set = {};
    E.receitas.forEach(function (r) { if (r.eletrodo) set[r.eletrodo] = 1; });
    DP.listaPaineis().forEach(function (p) { if (p.eletrodo) set[p.eletrodo] = 1; });
    return Object.keys(set).sort();
  };
})(window.DP = window.DP || {});
