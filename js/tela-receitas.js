/* Tela "Receitas (Mspec)" — equivale à aba "AJuste Mspec" da planilha + registro da troca de faca. */
(function (DP) {
  'use strict';
  const N = DP.nucleo, U = DP.ui, h = U.h, E = DP.estado;
  DP.telas = DP.telas || {};

  // ---------------------------------------------------------------- bloco da faca
  function blocoFaca() {
    const ult = E.trocas[0];
    const resumo = ult
      ? h('p', { class: 'faca-resumo' }, 'Última troca: ', h('strong', null, U.fmtData(ult.data)),
          ' · vida útil da faca removida: ', h('strong', null, U.fmtInt(ult.pecas) + ' peças'),
          ult.por ? ' · trocada por ' + ult.por : '')
      : h('p', { class: 'faca-resumo' }, 'Nenhuma troca de faca registrada ainda.');

    const tabela = h('table', { class: 'tabela compacta' },
      h('thead', null, h('tr', null, h('th', null, 'Data'), h('th', { class: 'dir' }, 'Peças (vida útil)'), h('th', null, 'Trocado por'), h('th', null, ''))),
      h('tbody', null, E.trocas.map(function (t) {
        return h('tr', null, h('td', null, U.fmtData(t.data)), h('td', { class: 'dir' }, U.fmtInt(t.pecas)), h('td', null, t.por || ''),
          h('td', { class: 'dir' }, h('button', { class: 'btn mini', type: 'button', onclick: function () { excluirTroca(t); } }, 'Excluir')));
      })));

    return h('section', { class: 'faca' },
      h('div', { class: 'faca-info' },
        h('h2', null, 'Faca de decape'), resumo,
        h('p', { class: 'passos' }, h('strong', null, 'Depois de trocar a faca: '),
          '1) registre a troca · 2) ajuste as posições nas receitas abaixo · 3) abra “Gerar TXT”.')),
      h('div', { class: 'faca-acoes' },
        h('button', { class: 'btn primario', type: 'button', onclick: registrarTroca }, 'Registrar troca de faca')),
      h('details', { class: 'historico' },
        h('summary', null, 'Histórico de trocas (' + E.trocas.length + ')'),
        E.trocas.length ? tabela : h('p', { class: 'vazio' }, 'Sem registros.')));
  }

  function registrarTroca() {
    const iData = h('input', { type: 'date', value: N.dataISO(), 'data-foco': true });
    const iPecas = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'ex.: 201402', autocomplete: 'off' });
    const iPor = h('input', { type: 'text', maxlength: 60, placeholder: 'Nome de quem trocou', autocomplete: 'off' });
    const fData = U.campo('Data da troca', iData);
    const fPecas = U.campo('Vida útil da faca removida (peças)', iPecas, 'Quantidade de peças processadas pela faca que saiu.');
    const fPor = U.campo('Trocado por', iPor);
    return U.dialogo({
      titulo: 'Registrar troca de faca', corpo: [fData, fPecas, fPor],
      botoes: [{ rotulo: 'Cancelar' }, {
        rotulo: 'Registrar', tipo: 'primario',
        acao: function () {
          let ok = true;
          [fData, fPecas, fPor].forEach(function (f) { f.mostrarErro(''); });
          if (!/^\d{4}-\d{2}-\d{2}$/.test(iData.value)) { fData.mostrarErro('Informe a data.'); ok = false; }
          const p = N.lerInteiro(iPecas.value, 99999999);
          if (!p.ok) { fPecas.mostrarErro(p.erro); ok = false; }
          if (!N.texto(iPor.value)) { fPor.mostrarErro('Informe quem fez a troca.'); ok = false; }
          if (!ok) return false;
          return DP.registrarTroca({ data: iData.value, pecas: p.valor, por: N.texto(iPor.value) });
        }
      }]
    }).then(function (r) {
      if (r === 'Registrar') { U.toast('Troca de faca registrada. Agora ajuste as posições das receitas.', 'ok'); DP.renderizar(); }
    });
  }

  function excluirTroca(t) {
    U.confirmar('Excluir registro de troca', 'Excluir a troca de ' + U.fmtData(t.data) + ' (' + U.fmtInt(t.pecas) + ' peças)?', 'Excluir', true)
      .then(function (ok) { if (ok) DP.excluirTroca(t.id).then(function () { DP.renderizar(); }); });
  }

  // ---------------------------------------------------------------- receitas
  function chaveCampo(r, param) { return r.id + ':' + param; }

  function proximoCampo(inp) {
    const todos = Array.prototype.slice.call(inp.closest('table').querySelectorAll('input'));
    const i = todos.indexOf(inp);
    if (i >= 0 && i < todos.length - 1) todos[i + 1].focus(); else inp.blur();
  }

  function marcarAlterado(inp, r, param) {
    const u = DP.ultimaGeracao();
    const ant = u && u.receitas[r.id];
    const mudou = !!ant && ant[param] !== r.pos[param];
    inp.classList.toggle('alterado', mudou);
    inp.title = mudou ? 'Valor no último arquivo gerado: ' + U.fmtMm(ant[param]) + ' mm' : '';
  }

  function campoPosicao(r, param, card) {
    const k = chaveCampo(r, param);
    const guardado = E.camposInvalidos[k];
    const inp = h('input', {
      type: 'text', inputmode: 'decimal', class: 'num', autocomplete: 'off', spellcheck: 'false',
      value: guardado ? guardado.texto : U.fmtMm(r.pos[param]),
      'aria-label': r.mspec + ' ' + U.fmtBitola(r.bitola) + ' mm², ' + param + ', posição em mm'
    });
    if (guardado) { inp.classList.add('invalido'); inp.title = guardado.erro; } else marcarAlterado(inp, r, param);

    inp.addEventListener('focus', function () { inp.select(); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); proximoCampo(inp); } });
    inp.addEventListener('change', function () {
      const res = N.lerMm(inp.value);
      if (!res.ok) {
        E.camposInvalidos[k] = { texto: inp.value, erro: res.erro };
        inp.classList.add('invalido'); inp.title = res.erro;
        U.toast(r.mspec + ' ' + param + ': ' + res.erro, 'erro');
        DP.atualizarSelos();
        return;
      }
      delete E.camposInvalidos[k];
      inp.classList.remove('invalido');
      r.pos[param] = res.um;
      inp.value = U.fmtMm(res.um);
      marcarAlterado(inp, r, param);
      DP.gravarReceita(r).then(function () { atualizarCabecalho(card, r); DP.atualizarSelos(); },
        function () { U.toast('Não foi possível gravar no navegador. Faça um backup assim que possível.', 'erro'); });
    });
    return inp;
  }

  function campoVelocidade(r, param) {
    const inp = h('input', {
      type: 'text', inputmode: 'numeric', class: 'num vel', autocomplete: 'off', value: String(r.vel[param]),
      'aria-label': r.mspec + ' ' + U.fmtBitola(r.bitola) + ' mm², ' + param + ', velocidade (apenas referência)',
      title: 'Somente referência: a velocidade não é exportada no TXT.'
    });
    inp.addEventListener('focus', function () { inp.select(); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); proximoCampo(inp); } });
    inp.addEventListener('change', function () {
      const v = N.lerInteiro(inp.value, 999999);
      if (!v.ok) { inp.classList.add('invalido'); U.toast('Velocidade: ' + v.erro, 'erro'); return; }
      inp.classList.remove('invalido');
      r.vel[param] = v.valor;
      DP.gravarReceita(r);
    });
    return inp;
  }

  function contarAlteracoes(r) {
    const u = DP.ultimaGeracao();
    const ant = u && u.receitas[r.id];
    if (!ant) return { nova: !!u, n: 0 };
    return { nova: false, n: N.PARAMS.filter(function (p) { return ant[p] !== r.pos[p]; }).length };
  }

  function atualizarCabecalho(card, r) {
    const c = contarAlteracoes(r);
    const sel = card.querySelector('.selo-alt');
    const bt = card.querySelector('.btn-desfazer');
    sel.textContent = c.nova ? 'receita nova' : c.n + (c.n === 1 ? ' alteração' : ' alterações');
    sel.classList.toggle('oculto', !c.nova && c.n === 0);
    bt.classList.toggle('oculto', c.n === 0);
  }

  function desfazer(r) {
    const u = DP.ultimaGeracao();
    const ant = u && u.receitas[r.id];
    if (!ant) return;
    U.confirmar('Desfazer alterações', 'Voltar todas as posições de ' + U.nomeReceita(r) + ' para os valores do último arquivo gerado?', 'Desfazer', true)
      .then(function (ok) {
        if (!ok) return;
        N.PARAMS.forEach(function (p) { r.pos[p] = ant[p]; delete E.camposInvalidos[chaveCampo(r, p)]; });
        DP.gravarReceita(r).then(function () { DP.renderizar(); U.toast('Valores restaurados.', 'ok'); });
      });
  }

  function cartao(r) {
    const usos = DP.usosDaReceita(r);
    const card = h('article', { class: 'cartao', id: 'receita-' + r.id.replace(/[^A-Za-z0-9]/g, '_') });

    const linhas = N.PONTOS.map(function (p) {
      return h('tr', null,
        h('th', { scope: 'row', class: 'pt-id' }, p.id),
        h('td', { class: 'pt-nome' }, p.nome),
        h('td', null, campoPosicao(r, p.id + 'Y', card)), h('td', null, campoVelocidade(r, p.id + 'Y')),
        h('td', null, campoPosicao(r, p.id + 'Z', card)), h('td', null, campoVelocidade(r, p.id + 'Z')));
    });

    card.appendChild(h('header', { class: 'cartao-topo' },
      h('div', null,
        h('h3', null, r.mspec, h('span', { class: 'bitola' }, U.fmtBitola(r.bitola) + ' mm²')),
        h('p', { class: 'cartao-sub' }, r.filamentos + ' · eletrodo ' + (r.eletrodo || '—') + ' · ' + U.plural(usos, 'painel', 'painéis'))),
      h('span', { class: 'selo selo-alt oculto' })));

    card.appendChild(h('table', { class: 'tabela-pos' },
      h('thead', null, h('tr', null,
        h('th', null, 'Ponto'), h('th', null, 'Função'),
        h('th', { class: 'dir' }, 'Y posição (mm)'), h('th', { class: 'dir vel-cab' }, 'Y veloc.'),
        h('th', { class: 'dir' }, 'Z posição (mm)'), h('th', { class: 'dir vel-cab' }, 'Z veloc.'))),
      h('tbody', null, linhas)));

    card.appendChild(h('footer', { class: 'cartao-pe' },
      h('button', { class: 'btn mini btn-desfazer oculto', type: 'button', onclick: function () { desfazer(r); } }, 'Desfazer alterações'),
      h('span', { class: 'espaco' }),
      h('button', { class: 'btn mini', type: 'button', onclick: function () { novaReceita(r); } }, 'Duplicar'),
      h('button', { class: 'btn mini', type: 'button', onclick: function () { excluirReceita(r, usos); } }, 'Excluir')));

    atualizarCabecalho(card, r);
    return card;
  }

  function excluirReceita(r, usos) {
    if (usos > 0) {
      return U.dialogo({
        titulo: 'Não é possível excluir',
        corpo: h('p', null, 'A receita ' + U.nomeReceita(r) + ' está em uso por ' + U.plural(usos, 'painel', 'painéis') +
          '. Troque a receita desses painéis (aba Part Numbers) antes de excluí-la.')
      });
    }
    return U.confirmar('Excluir receita', 'Excluir a receita ' + U.nomeReceita(r) + '? Nenhum painel a utiliza.', 'Excluir', true)
      .then(function (ok) { if (ok) DP.excluirReceita(r).then(function () { DP.renderizar(); U.toast('Receita excluída.'); }); });
  }

  function novaReceita(base) {
    const origem = base || E.receitas[0];
    const iMspec = h('input', { type: 'text', maxlength: 20, autocomplete: 'off', placeholder: 'ex.: M3232', 'data-foco': true });
    const iBitola = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'ex.: 0,50' });
    const iFil = h('input', { type: 'text', maxlength: 30, autocomplete: 'off', placeholder: 'ex.: 16 Cobre', value: origem ? origem.filamentos : '' });
    const iEle = h('input', { type: 'text', maxlength: 20, autocomplete: 'off', list: 'lista-eletrodos', value: origem ? origem.eletrodo : '' });
    const lista = h('datalist', { id: 'lista-eletrodos' }, DP.eletrodosConhecidos().map(function (e) { return h('option', { value: e }); }));
    const sel = h('select', null, E.receitas.map(function (r) { return h('option', { value: r.id, selected: origem && r.id === origem.id }, U.nomeReceita(r)); }));
    const f = {
      mspec: U.campo('Mspec', iMspec), bitola: U.campo('Bitola (mm²)', iBitola),
      fil: U.campo('Filamentos', iFil, 'Como aparece na lista de PNs, ex.: “16 Cobre”, “7 Estanhado”.'),
      ele: U.campo('Eletrodo da máquina de solda', iEle),
      copia: U.campo('Copiar as posições de', sel, 'Ponto de partida; depois ajuste cada valor.')
    };
    return U.dialogo({
      titulo: base ? 'Duplicar receita' : 'Nova receita', corpo: [f.mspec, f.bitola, f.fil, f.ele, f.copia, lista],
      botoes: [{ rotulo: 'Cancelar' }, {
        rotulo: 'Criar receita', tipo: 'primario',
        acao: function () {
          Object.keys(f).forEach(function (k) { f[k].mostrarErro(''); });
          let ok = true;
          const mspec = N.normMspec(iMspec.value), bit = N.normBitola(iBitola.value);
          if (!/^[A-Z0-9][A-Z0-9\-_.]*$/.test(mspec)) { f.mspec.mostrarErro('Informe o Mspec (letras e números).'); ok = false; }
          if (!bit) { f.bitola.mostrarErro('Informe a bitola, ex.: 0,50.'); ok = false; }
          if (!N.texto(iFil.value)) { f.fil.mostrarErro('Informe os filamentos.'); ok = false; }
          if (ok && E.receitas.some(function (r) { return r.id === N.chaveReceita(mspec, bit); })) {
            f.mspec.mostrarErro('Já existe uma receita com este Mspec e esta bitola.'); ok = false;
          }
          if (!ok) return false;
          const fonte = E.receitas.filter(function (r) { return r.id === sel.value; })[0];
          const nova = {
            id: N.chaveReceita(mspec, bit), mspec: mspec, bitola: bit, filamentos: N.texto(iFil.value), eletrodo: N.texto(iEle.value),
            ordem: E.receitas.reduce(function (m, r) { return Math.max(m, r.ordem || 0); }, 0) + 1,
            pos: JSON.parse(JSON.stringify(fonte.pos)), vel: JSON.parse(JSON.stringify(fonte.vel))
          };
          return DP.criarReceita(nova);
        }
      }]
    }).then(function (r) {
      if (r === 'Criar receita') { DP.renderizar(); U.toast('Receita criada. Ajuste as posições e cadastre os PNs que a usam.', 'ok'); }
    });
  }

  function navegacao() {
    return h('nav', { class: 'chips', 'aria-label': 'Ir para a receita' },
      h('span', { class: 'chips-rotulo' }, 'Ir para:'),
      E.receitas.map(function (r) {
        return h('button', {
          class: 'chip', type: 'button',
          onclick: function () {
            const el = document.getElementById('receita-' + r.id.replace(/[^A-Za-z0-9]/g, '_'));
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); const i = el.querySelector('input'); if (i) i.focus({ preventScroll: true }); }
          }
        }, r.mspec + ' · ' + U.fmtBitola(r.bitola));
      }));
  }

  DP.telas.receitas = {
    titulo: '1 · Ajustar receitas',
    render: function (raiz) {
      raiz.appendChild(blocoFaca());
      raiz.appendChild(h('div', { class: 'titulo-linha' },
        h('h2', null, 'Posições de decape por receita'),
        h('p', { class: 'dica' }, 'Digite em milímetros (aceita vírgula ou ponto). As alterações são salvas na hora. “Veloc.” é só referência e não vai para o TXT.'),
        h('button', { class: 'btn', type: 'button', onclick: function () { novaReceita(null); } }, '+ Nova receita')));
      raiz.appendChild(navegacao());
      raiz.appendChild(h('div', { class: 'grade-receitas' }, E.receitas.map(cartao)));
      raiz.appendChild(h('div', { class: 'proximo' }, h('p', null, 'Terminou de ajustar as posições?'),
        h('button', { class: 'btn primario grande', type: 'button', onclick: function () { E.aba = 'gerar'; DP.renderizar({ topo: true }); } }, 'Ir para 2 · Gerar TXT →')));
    }
  };
})(window.DP = window.DP || {});
