/* DecapeParam — regras de negócio (puras: sem DOM e sem banco de dados).
 *
 * Reproduz a lógica da planilha "Parametros do Stripping SA01 Troca de Facas":
 *   AJuste Mspec (posições em mm)  ->  Planilha5 (x1000, por Mspec+Bitola)
 *   -> Dados (40 registradores por painel)  ->  Parametros!J4:S699  ->  botão "ExportarParametrosTXT".
 *
 * Também roda em Node (testes/testar.js), por isso não usa nada específico de navegador.
 */
(function (raiz) {
  'use strict';

  // ---- Constantes do layout do arquivo (iguais às da planilha/macro) ---------------------------
  const TOTAL_PAINEIS = 174;       // Parametros!J4:S699 = 696 linhas = 174 painéis x 4 linhas
  const REGS_POR_PAINEL = 40;      // Dados!L:AY = 40 colunas (registradores 0..39)
  const COLUNAS_POR_LINHA = 10;    // Parametros!J:S = 10 colunas
  const LINHAS_POR_PAINEL = REGS_POR_PAINEL / COLUNAS_POR_LINHA; // 4

  // Limites de segurança (não existem na planilha; evitam gerar valores que o CLP não representaria).
  // Cada valor ocupa UM registrador (o seguinte é sempre 0), então 0..65535 µm (= 65,535 mm).
  const MAX_UM = 65535;
  // Variação acima disso, em relação à última geração, gera um alerta (não bloqueia).
  const LIMITE_ALERTA_UM = 1000;

  // Os 8 pontos de ensinamento ("Teaching Position") da planilha, na ordem de P1..P8.
  const PONTOS = [
    { id: 'P1', nome: 'HOME POS' },
    { id: 'P2', nome: 'CUT Y FOR' },
    { id: 'P3', nome: 'CUT -Z DOWN' },
    { id: 'P4', nome: 'CUT -Z UP' },
    { id: 'P5', nome: 'STR-Y FOR' },
    { id: 'P6', nome: 'STR-Z DOWN' },
    { id: 'P7', nome: 'STR-Z UP' },
    { id: 'P8', nome: 'STR-Y BACK' }
  ];
  // Ordem dos 16 parâmetros de uma receita: P1Y, P1Z, P2Y, P2Z, ... P8Y, P8Z (= Planilha5!E:T).
  const PARAMS = [];
  PONTOS.forEach(function (p) { PARAMS.push(p.id + 'Y'); PARAMS.push(p.id + 'Z'); });

  // ---- Normalização -----------------------------------------------------------------------------
  function texto(v) { return v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' ').trim(); }

  function normMspec(v) { return texto(v).replace(/\s+/g, ' ').toUpperCase(); }

  // "0,50" / "0.5" / 0.5  ->  "0.5"   ('' se inválido). É a mesma forma textual usada na chave.
  function normBitola(v) {
    const t = texto(v).replace(',', '.');
    if (t === '') return '';
    const n = Number(t);
    return isFinite(n) && n > 0 ? String(n) : '';
  }

  // Equivalente a Dados!I = Mspec & Bitola (usada pelo PROCV/VLOOKUP).
  function chaveReceita(mspec, bitola) { return normMspec(mspec) + '|' + normBitola(bitola); }

  // Lê um valor em mm digitado pelo operador. Aceita vírgula ou ponto, até 3 casas decimais.
  // Devolve µm inteiros (mm x 1000), exatamente o que a planilha escreve no arquivo.
  function lerMm(entrada) {
    const t = texto(entrada).replace(',', '.');
    if (t === '') return { ok: false, erro: 'Informe um valor.' };
    if (!/^\d+(\.\d{1,3})?$/.test(t)) {
      return { ok: false, erro: 'Use um número positivo com até 3 casas decimais (ex.: 41,8).' };
    }
    const um = Math.round(parseFloat(t) * 1000);
    if (um > MAX_UM) return { ok: false, erro: 'Valor acima do máximo de ' + (MAX_UM / 1000).toString().replace('.', ',') + ' mm.' };
    return { ok: true, um: um };
  }

  function lerInteiro(entrada, max) {
    const t = texto(entrada);
    if (!/^\d+$/.test(t)) return { ok: false, erro: 'Use apenas números inteiros.' };
    const n = parseInt(t, 10);
    if (max != null && n > max) return { ok: false, erro: 'Valor máximo: ' + max + '.' };
    return { ok: true, valor: n };
  }

  // ---- Geração do arquivo ----------------------------------------------------------------------
  function ocupado(p) { return !!(p && (texto(p.pn) || texto(p.mspec))); }

  function indexarReceitas(receitas) {
    const m = {};
    (receitas || []).forEach(function (r) { m[chaveReceita(r.mspec, r.bitola)] = r; });
    return m;
  }

  // 40 registradores de um painel. Painel livre, ou sem receita encontrada = tudo 0
  // (na planilha: IFERROR(VLOOKUP(...), 0)).
  function registrosDoPainel(painel, receitasPorChave) {
    const regs = new Array(REGS_POR_PAINEL);
    for (let i = 0; i < REGS_POR_PAINEL; i++) regs[i] = 0;
    if (!painel) return regs;
    const r = receitasPorChave[chaveReceita(painel.mspec, painel.bitola)];
    if (!r) return regs;
    PARAMS.forEach(function (nome, i) {
      regs[2 * i] = Math.round(Number(r.pos[nome]) || 0);   // valor em µm; regs[2*i+1] permanece 0
    });
    return regs;
  }

  // paineis: array de {slot, mspec, bitola, ...} ou objeto indexado por slot.
  function porSlot(paineis) {
    if (Array.isArray(paineis)) {
      const m = {};
      paineis.forEach(function (p) { m[p.slot] = p; });
      return m;
    }
    return paineis || {};
  }

  // Conteúdo do arquivo: 696 linhas, 10 colunas separadas por TAB, linhas separadas por CRLF,
  // sem CRLF no final (igual a Join(linhas, vbCrLf) da macro) e sem BOM (igual ao arquivo de referência).
  function gerarTxt(paineis, receitas) {
    const idx = indexarReceitas(receitas);
    const ps = porSlot(paineis);
    const linhas = [];
    for (let s = 1; s <= TOTAL_PAINEIS; s++) {
      const regs = registrosDoPainel(ps[s], idx);
      for (let k = 0; k < LINHAS_POR_PAINEL; k++) {
        linhas.push(regs.slice(k * COLUNAS_POR_LINHA, (k + 1) * COLUNAS_POR_LINHA).join('\t'));
      }
    }
    return linhas.join('\r\n');
  }

  // Endereço inicial do painel no CLP (coluna "J" de Dados): E00000, E00040, E00080 ...
  function enderecoPainel(slot) {
    const n = String((slot - 1) * REGS_POR_PAINEL);
    return 'E' + ('00000' + n).slice(-5);
  }

  // ---- Análise / verificações antes de gerar -----------------------------------------------------
  function analisar(paineis, receitas) {
    const idx = indexarReceitas(receitas);
    const ps = porSlot(paineis);
    const r = { ocupados: 0, livres: 0, comReceita: 0, semReceita: [], duplicados: [], filamentosDivergentes: [] };
    const vistos = {};
    for (let s = 1; s <= TOTAL_PAINEIS; s++) {
      const p = ps[s];
      if (!ocupado(p)) { r.livres++; continue; }
      r.ocupados++;
      const rec = idx[chaveReceita(p.mspec, p.bitola)];
      if (rec) {
        r.comReceita++;
        if (texto(p.filamentos) && texto(p.filamentos).toLowerCase() !== texto(rec.filamentos).toLowerCase()) {
          r.filamentosDivergentes.push({ slot: s, painel: texto(p.filamentos), receita: rec.filamentos });
        }
      } else {
        r.semReceita.push(s);
      }
      const pn = texto(p.pn).toUpperCase();
      if (pn) (vistos[pn] = vistos[pn] || []).push(s);
    }
    Object.keys(vistos).forEach(function (pn) {
      if (vistos[pn].length > 1) r.duplicados.push({ pn: pn, slots: vistos[pn] });
    });
    return r;
  }

  // ---- Comparação com a última geração (snapshot) ----------------------------------------------
  function snapshot(paineis, receitas) {
    const rec = {};
    (receitas || []).forEach(function (r) {
      const o = {};
      PARAMS.forEach(function (p) { o[p] = Math.round(Number(r.pos[p]) || 0); });
      rec[chaveReceita(r.mspec, r.bitola)] = o;
    });
    const mapa = {};
    const ps = porSlot(paineis);
    for (let s = 1; s <= TOTAL_PAINEIS; s++) {
      if (ocupado(ps[s])) mapa[s] = chaveReceita(ps[s].mspec, ps[s].bitola);
    }
    return { receitas: rec, mapa: mapa };
  }

  // Lista as diferenças de posição entre o snapshot anterior e as receitas atuais.
  function diffReceitas(antes, receitas) {
    const out = { alteracoes: [], novas: [], removidas: [] };
    if (!antes) return out;
    const atuais = {};
    (receitas || []).forEach(function (r) { atuais[chaveReceita(r.mspec, r.bitola)] = r; });
    Object.keys(atuais).forEach(function (id) {
      const r = atuais[id];
      const a = antes[id];
      if (!a) { out.novas.push(id); return; }
      PARAMS.forEach(function (p) {
        const novo = Math.round(Number(r.pos[p]) || 0);
        if (novo !== a[p]) {
          out.alteracoes.push({ id: id, param: p, antes: a[p], depois: novo, delta: novo - a[p],
            alerta: Math.abs(novo - a[p]) > LIMITE_ALERTA_UM });
        }
      });
    });
    Object.keys(antes).forEach(function (id) { if (!atuais[id]) out.removidas.push(id); });
    return out;
  }

  // Painéis cuja receita mudou (ou que foram cadastrados/liberados) desde o snapshot.
  function diffMapa(antes, paineis) {
    if (!antes) return [];
    const agora = snapshot(paineis, []).mapa;
    const out = [];
    for (let s = 1; s <= TOTAL_PAINEIS; s++) {
      const a = antes[s] || '';
      const b = agora[s] || '';
      if (a !== b) out.push({ slot: s, antes: a, depois: b });
    }
    return out;
  }

  // FNV-1a 32 bits (só para identificar versões do arquivo no histórico; não é criptográfico).
  function checksum(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8).toUpperCase();
  }

  // ---- Lista Mestra de Part Numbers (TSV) ---------------------------------------------------------
  const CAB_LISTA = ['Número Painel', 'PN Aptiv', 'Cavidade Esquerda', 'Cavidade Direita',
    'Eletrodo da Maq. Solda', 'Mspec', 'Bitola', 'Filamentos'];

  // Leitor de TSV com suporte a aspas (o cabeçalho "Número \nPainel" do Excel vem entre aspas e ocupa 2 linhas).
  function lerTsv(txt) {
    const linhas = [];
    let campo = '', linha = [], aspas = false;
    txt = String(txt).replace(/^﻿/, '');
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (aspas) {
        if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += c;
      } else if (c === '"' && campo === '') {
        aspas = true;
      } else if (c === '\t') {
        linha.push(campo); campo = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && txt[i + 1] === '\n') i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = '';
      } else {
        campo += c;
      }
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  function semAcento(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function nomeCol(s) { return semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim(); }

  // Lê o "Lista Mestra de Part Numbers.txt" (exportação da aba DADOS) ou o arquivo exportado pelo próprio app.
  // Só as colunas A..H importam; as demais (receitas calculadas, endereços) são ignoradas.
  function lerListaMestra(conteudo) {
    const linhas = lerTsv(conteudo);
    let cab = -1;
    for (let i = 0; i < linhas.length; i++) {
      if (linhas[i].some(function (c) { return nomeCol(c) === 'pn aptiv'; })) { cab = i; break; }
    }
    if (cab < 0) throw new Error('Não encontrei a coluna "PN Aptiv". Este arquivo parece não ser a Lista Mestra de Part Numbers.');

    const nomes = linhas[cab].map(nomeCol);
    function col(lista, padrao) {
      for (let i = 0; i < nomes.length; i++) if (lista.indexOf(nomes[i]) >= 0) return i;
      return padrao;
    }
    const ix = {
      slot: col(['numero painel', 'painel', 'numero'], 0),
      pn: col(['pn aptiv'], 1),
      cavEsq: col(['cavidade esquerda'], 2),
      cavDir: col(['cavidade direita'], 3),
      eletrodo: col(['eletrodo da maq. solda', 'eletrodo'], 4),
      mspec: col(['mspec'], 5),
      bitola: col(['bitola'], 6),
      filamentos: col(['filamentos'], 7)
    };

    const res = { paineis: [], pendentes: [], avisos: [], lidas: 0 };
    const usados = {};
    for (let i = cab + 1; i < linhas.length; i++) {
      const l = linhas[i];
      const g = function (k) { return texto(l[ix[k]]); };
      const num = g('slot');
      const o = {
        pn: g('pn'), cavEsq: g('cavEsq'), cavDir: g('cavDir'), eletrodo: g('eletrodo'),
        mspec: normMspec(g('mspec')), bitola: '', filamentos: g('filamentos')
      };
      const bruto = g('bitola');
      o.bitola = normBitola(bruto);
      const temDados = !!(o.pn || o.cavEsq || o.cavDir || o.eletrodo || o.mspec || bruto || o.filamentos);
      if (!num && !temDados) continue;          // linha em branco
      res.lidas++;
      const rotulo = 'Linha ' + (i + 1) + (o.pn ? ' (PN ' + o.pn + ')' : '');
      if (bruto && !o.bitola) res.avisos.push(rotulo + ': bitola "' + bruto + '" inválida — ficará sem receita.');

      if (!num) {                                // cadastrado, mas sem número de painel
        if (temDados) res.pendentes.push(o);
        continue;
      }
      if (!/^\d+$/.test(num)) { res.avisos.push(rotulo + ': número de painel "' + num + '" inválido — linha ignorada.'); continue; }
      const slot = parseInt(num, 10);
      if (slot < 1 || slot > TOTAL_PAINEIS) { res.avisos.push(rotulo + ': painel ' + slot + ' fora do intervalo 1–' + TOTAL_PAINEIS + ' — linha ignorada.'); continue; }
      if (usados[slot]) { if (temDados) res.avisos.push(rotulo + ': painel ' + slot + ' repetido — mantida a primeira ocorrência.'); continue; }
      usados[slot] = true;
      if (!temDados) continue;                   // painel livre
      if (!o.pn) res.avisos.push(rotulo + ': painel ' + slot + ' sem "PN Aptiv".');
      o.slot = slot;
      res.paineis.push(o);
    }
    res.paineis.sort(function (a, b) { return a.slot - b.slot; });
    return res;
  }

  function celulaTsv(v) {
    const t = texto(v);
    return /["]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }

  // Exporta no mesmo formato de colunas A..H da Lista Mestra (um painel por linha, 1..174).
  function exportarListaMestra(paineis, pendentes) {
    const ps = porSlot(paineis);
    const linhas = [CAB_LISTA.join('\t')];
    for (let s = 1; s <= TOTAL_PAINEIS; s++) {
      const p = ps[s];
      linhas.push(p && ocupado(p)
        ? [s, p.pn, p.cavEsq, p.cavDir, p.eletrodo, p.mspec, p.bitola, p.filamentos].map(celulaTsv).join('\t')
        : String(s));
    }
    (pendentes || []).forEach(function (p) {
      linhas.push(['', p.pn, p.cavEsq, p.cavDir, p.eletrodo, p.mspec, p.bitola, p.filamentos].map(celulaTsv).join('\t'));
    });
    return linhas.join('\r\n') + '\r\n';
  }

  // ---- Datas -------------------------------------------------------------------------------------
  function dois(n) { return (n < 10 ? '0' : '') + n; }
  function dataCompacta(d) { d = d || new Date(); return d.getFullYear() + dois(d.getMonth() + 1) + dois(d.getDate()); }
  function dataISO(d) { d = d || new Date(); return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); }
  function horaCompacta(d) { d = d || new Date(); return dois(d.getHours()) + dois(d.getMinutes()); }

  const api = {
    TOTAL_PAINEIS: TOTAL_PAINEIS, REGS_POR_PAINEL: REGS_POR_PAINEL, COLUNAS_POR_LINHA: COLUNAS_POR_LINHA,
    MAX_UM: MAX_UM, LIMITE_ALERTA_UM: LIMITE_ALERTA_UM, PONTOS: PONTOS, PARAMS: PARAMS,
    texto: texto, normMspec: normMspec, normBitola: normBitola, chaveReceita: chaveReceita,
    lerMm: lerMm, lerInteiro: lerInteiro, ocupado: ocupado, indexarReceitas: indexarReceitas,
    registrosDoPainel: registrosDoPainel, gerarTxt: gerarTxt, enderecoPainel: enderecoPainel,
    analisar: analisar, snapshot: snapshot, diffReceitas: diffReceitas, diffMapa: diffMapa, checksum: checksum,
    lerTsv: lerTsv, lerListaMestra: lerListaMestra, exportarListaMestra: exportarListaMestra,
    dataCompacta: dataCompacta, dataISO: dataISO, horaCompacta: horaCompacta
  };

  raiz.DP = raiz.DP || {};
  raiz.DP.nucleo = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
