/* Tela "Part Numbers" — equivale à aba "Dados" (lista mestra): qual PN está em qual painel e com qual receita. */
(function (DP) {
  'use strict';
  const N = DP.nucleo, U = DP.ui, h = U.h, E = DP.estado;
  DP.telas = DP.telas || {};

  function situacao(p) {
    const r = DP.receitaDoPainel(p);
    if (!r) return { cod: 'sem', texto: 'Sem receita', dica: 'Mspec/bitola não correspondem a nenhuma receita: este painel sairá com zeros no TXT.' };
    if (N.texto(p.filamentos) && N.texto(p.filamentos).toLowerCase() !== N.texto(r.filamentos).toLowerCase()) {
      return { cod: 'div', texto: 'Filamentos diverge', dica: 'Filamentos do cadastro (' + p.filamentos + ') diferem da receita (' + r.filamentos + '). O TXT usa a receita pelo Mspec + bitola.' };
    }
    return { cod: 'ok', texto: 'OK', dica: 'Receita ' + U.nomeReceita(r) };
  }

  function selo(s) { return h('span', { class: 'selo selo-' + s.cod, title: s.dica }, s.texto); }

  function bate(p, slot, termo) {
    if (!termo) return true;
    const alvo = [slot, p && p.pn, p && p.cavEsq, p && p.cavDir, p && p.eletrodo, p && p.mspec, p && p.bitola, p && U.fmtBitola(p.bitola || 0), p && p.filamentos, N.enderecoPainel(slot)]
      .join(' ').toLowerCase();
    return termo.toLowerCase().split(/\s+/).every(function (t) { return alvo.indexOf(t) >= 0; });
  }

  function linhaPainel(slot) {
    const p = E.paineis[slot];
    const end = h('td', { class: 'mono suave' }, N.enderecoPainel(slot));
    if (!N.ocupado(p)) {
      return h('tr', { class: 'livre' }, h('td', { class: 'dir' }, slot), end,
        h('td', { colspan: 8, class: 'suave' }, '— livre —'),
        h('td', { class: 'dir' }, h('button', { class: 'btn mini', type: 'button', onclick: function () { editarPainel({ slot: slot }); } }, 'Cadastrar')));
    }
    const s = situacao(p);
    return h('tr', { class: 'ocupado s-' + s.cod, ondblclick: function () { editarPainel({ slot: slot }); } },
      h('td', { class: 'dir forte' }, slot), end,
      h('td', { class: 'forte' }, p.pn), h('td', null, p.cavEsq), h('td', null, p.cavDir), h('td', null, p.eletrodo),
      h('td', null, p.mspec), h('td', { class: 'dir' }, p.bitola ? U.fmtBitola(p.bitola) : ''), h('td', null, p.filamentos),
      h('td', null, selo(s)),
      h('td', { class: 'dir acoes' },
        h('button', { class: 'btn mini', type: 'button', onclick: function () { editarPainel({ slot: slot }); } }, 'Editar'),
        h('button', { class: 'btn mini', type: 'button', onclick: function () { liberar(slot); } }, 'Liberar')));
  }

  function liberar(slot) {
    const p = E.paineis[slot];
    U.confirmar('Liberar painel ' + slot,
      ['Remover o PN ' + (p.pn || '(sem PN)') + ' do painel ' + slot + '?',
        'No TXT, os registradores deste painel passam a ser 0.'], 'Liberar painel', true)
      .then(function (ok) { if (ok) DP.liberarPainel(slot).then(function () { DP.renderizar(); U.toast('Painel ' + slot + ' liberado.'); }); });
  }

  // ---------------------------------------------------------------- edição
  // alvo: {slot} (painel existente ou livre) ou {pendente: obj} (alocar um cadastrado sem painel)
  function editarPainel(alvo) {
    const pend = alvo.pendente || null;
    const atual = alvo.slot ? E.paineis[alvo.slot] : null;
    const base = pend || atual || {};
    const slotAnterior = atual ? alvo.slot : null;

    const livres = [];
    for (let s = 1; s <= N.TOTAL_PAINEIS; s++) if (!N.ocupado(E.paineis[s]) || s === slotAnterior) livres.push(s);
    const slotInicial = alvo.slot || livres[0];

    const selSlot = h('select', { 'data-foco': !atual }, livres.map(function (s) {
      return h('option', { value: String(s), selected: s === slotInicial }, 'Painel ' + s + '  (' + N.enderecoPainel(s) + ')');
    }));
    const iPn = h('input', { type: 'text', maxlength: 60, autocomplete: 'off', value: base.pn || '', 'data-foco': !!atual });
    const iEsq = h('input', { type: 'text', maxlength: 30, autocomplete: 'off', value: base.cavEsq || '' });
    const iDir = h('input', { type: 'text', maxlength: 30, autocomplete: 'off', value: base.cavDir || '' });
    const chaveBase = base.mspec ? N.chaveReceita(base.mspec, base.bitola) : '';
    const temReceita = E.receitas.some(function (r) { return r.id === chaveBase; });
    const selRec = h('select', null,
      h('option', { value: '' }, '— selecione a receita —'),
      E.receitas.map(function (r) { return h('option', { value: r.id, selected: r.id === chaveBase }, U.nomeReceita(r)); }));
    const iEle = h('input', { type: 'text', maxlength: 20, autocomplete: 'off', list: 'lista-eletrodos', value: base.eletrodo || '' });
    const lista = h('datalist', { id: 'lista-eletrodos' }, DP.eletrodosConhecidos().map(function (e) { return h('option', { value: e }); }));

    const fSlot = U.campo('Painel', selSlot, atual ? null : 'Apenas painéis livres são listados.');
    const fPn = U.campo('PN Aptiv', iPn);
    const fEsq = U.campo('Cavidade esquerda', iEsq);
    const fDir = U.campo('Cavidade direita', iDir);
    const fRec = U.campo('Receita (Mspec · bitola · filamentos)', selRec,
      base.mspec && !temReceita ? 'Cadastro atual: ' + base.mspec + ' ' + (base.bitola || '?') + ' mm² ' + (base.filamentos || '') + ' — não existe receita correspondente.' : null);
    const fEle = U.campo('Eletrodo da máquina de solda', iEle);
    const aviso = h('p', { class: 'aviso-inline' });

    // Ao escolher a receita, sugere o eletrodo dela (se o campo estiver vazio ou ainda for o sugerido antes).
    let eletrodoSugerido = base.eletrodo || '';
    selRec.addEventListener('change', function () {
      const r = E.receitas.filter(function (x) { return x.id === selRec.value; })[0];
      if (r && (!N.texto(iEle.value) || iEle.value === eletrodoSugerido)) { iEle.value = r.eletrodo || ''; eletrodoSugerido = iEle.value; }
    });
    function checarDuplicado() {
      const pn = N.texto(iPn.value).toUpperCase();
      const outro = pn && DP.listaPaineis().filter(function (p) { return p.slot !== slotAnterior && N.texto(p.pn).toUpperCase() === pn; })[0];
      aviso.textContent = outro ? 'Atenção: este PN já está cadastrado no painel ' + outro.slot + '.' : '';
    }
    iPn.addEventListener('input', checarDuplicado);

    const titulo = pend ? 'Alocar PN em um painel' : atual ? 'Editar painel ' + alvo.slot : 'Cadastrar PN no painel ' + slotInicial;
    return U.dialogo({
      titulo: titulo, largo: true,
      corpo: [h('div', { class: 'grade-form' }, fSlot, fPn, fEsq, fDir, fRec, fEle), aviso, lista],
      botoes: [{ rotulo: 'Cancelar' }, {
        rotulo: 'Salvar', tipo: 'primario',
        acao: function () {
          [fSlot, fPn, fRec].forEach(function (f) { f.mostrarErro(''); });
          let ok = true;
          if (!N.texto(iPn.value)) { fPn.mostrarErro('Informe o PN Aptiv.'); ok = false; }
          const rec = E.receitas.filter(function (r) { return r.id === selRec.value; })[0];
          if (!rec) { fRec.mostrarErro('Escolha a receita.'); ok = false; }
          if (!ok) return false;
          const slot = parseInt(selSlot.value, 10);
          const p = {
            slot: slot, pn: N.texto(iPn.value), cavEsq: N.texto(iEsq.value), cavDir: N.texto(iDir.value),
            eletrodo: N.texto(iEle.value), mspec: rec.mspec, bitola: rec.bitola, filamentos: rec.filamentos
          };
          return DP.salvarPainel(p, slotAnterior, pend ? pend.id : null);
        }
      }]
    }).then(function (r) {
      if (r === 'Salvar') { DP.renderizar(); U.toast('Painel salvo.', 'ok'); }
    });
  }

  // ---------------------------------------------------------------- tela
  function tabelaPendentes() {
    if (!E.pendentes.length) return null;
    return h('section', { class: 'pendentes' },
      h('h2', null, 'Cadastrados sem número de painel (' + E.pendentes.length + ')'),
      h('p', { class: 'dica' }, 'Estavam na lista mestra fora da tabela de painéis. Não saem no TXT até serem alocados em um painel.'),
      h('table', { class: 'tabela' },
        h('thead', null, h('tr', null, ['PN Aptiv', 'Cav. esq.', 'Cav. dir.', 'Eletrodo', 'Mspec', 'Bitola', 'Filamentos', 'Situação', ''].map(function (t) { return h('th', null, t); }))),
        h('tbody', null, E.pendentes.map(function (p) {
          return h('tr', null, h('td', { class: 'forte' }, p.pn), h('td', null, p.cavEsq), h('td', null, p.cavDir), h('td', null, p.eletrodo),
            h('td', null, p.mspec || '—'), h('td', null, p.bitola ? U.fmtBitola(p.bitola) : ''), h('td', null, p.filamentos),
            h('td', null, selo(situacao(p))),
            h('td', { class: 'dir acoes' },
              h('button', { class: 'btn mini primario', type: 'button', onclick: function () { editarPainel({ pendente: p }); } }, 'Alocar'),
              h('button', { class: 'btn mini', type: 'button', onclick: function () {
                U.confirmar('Excluir cadastro', 'Excluir o PN ' + p.pn + ' da lista de cadastrados sem painel?', 'Excluir', true)
                  .then(function (ok) { if (ok) DP.excluirPendente(p.id).then(function () { DP.renderizar(); }); });
              } }, 'Excluir')));
        }))));
  }

  DP.telas.paineis = {
    titulo: 'Part Numbers',
    render: function (raiz) {
      const f = E.filtroPaineis;
      const corpo = h('tbody');
      const contador = h('span', { class: 'contador' });

      function montar() {
        U.limpar(corpo);
        let n = 0;
        for (let s = 1; s <= N.TOTAL_PAINEIS; s++) {
          const p = E.paineis[s];
          const oc = N.ocupado(p);
          if (f.situacao === 'ocupados' && !oc) continue;
          if (f.situacao === 'livres' && oc) continue;
          if (f.situacao === 'alertas' && (!oc || situacao(p).cod === 'ok')) continue;
          if (!bate(p, s, f.texto)) continue;
          corpo.appendChild(linhaPainel(s)); n++;
        }
        if (!n) corpo.appendChild(h('tr', null, h('td', { colspan: 11, class: 'vazio' }, 'Nenhum painel encontrado com este filtro.')));
        const ocup = Object.keys(E.paineis).length;
        contador.textContent = ocup + ' ocupados · ' + (N.TOTAL_PAINEIS - ocup) + ' livres · exibindo ' + n;
      }

      const busca = h('input', {
        type: 'search', class: 'busca', placeholder: 'Buscar PN, cavidade, Mspec, painel…', value: f.texto, autocomplete: 'off',
        'aria-label': 'Buscar painéis'
      });
      busca.addEventListener('input', function () { f.texto = busca.value.trim(); montar(); });
      const filtro = h('select', { 'aria-label': 'Filtrar por situação' },
        [['todos', 'Todos os painéis'], ['ocupados', 'Somente ocupados'], ['livres', 'Somente livres'], ['alertas', 'Com alerta (sem receita / divergente)']]
          .map(function (o) { return h('option', { value: o[0], selected: f.situacao === o[0] }, o[1]); }));
      filtro.addEventListener('change', function () { f.situacao = filtro.value; montar(); });

      raiz.appendChild(h('div', { class: 'titulo-linha' },
        h('h2', null, 'Part Numbers por painel'),
        h('p', { class: 'dica' }, 'Cada painel (1 a ' + N.TOTAL_PAINEIS + ') ocupa 40 registradores a partir do endereço indicado. Duplo clique na linha para editar.')));
      raiz.appendChild(h('div', { class: 'barra-filtros' }, busca, filtro, contador,
        h('span', { class: 'espaco' }),
        h('button', { class: 'btn primario', type: 'button', onclick: function () { editarPainel({}); } }, '+ Cadastrar novo PN')));
      raiz.appendChild(h('div', { class: 'tabela-rolagem' },
        h('table', { class: 'tabela tabela-paineis' },
          h('thead', null, h('tr', null, [['Painel', 'dir'], ['End. CLP', ''], ['PN Aptiv', ''], ['Cav. esq.', ''], ['Cav. dir.', ''], ['Eletrodo', ''], ['Mspec', ''],
            ['Bitola', 'dir'], ['Filamentos', ''], ['Situação', ''], ['', '']].map(function (c) { return h('th', { class: c[1] }, c[0]); }))),
          corpo)));
      montar();
      const pend = tabelaPendentes();
      if (pend) raiz.appendChild(pend);
    }
  };
})(window.DP = window.DP || {});
