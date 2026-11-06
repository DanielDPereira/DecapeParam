/* Tela "Gerar TXT" — equivale ao botão da macro ExportarParametrosTXT, com verificações antes de gerar. */
(function (DP) {
  'use strict';
  const N = DP.nucleo, U = DP.ui, h = U.h, E = DP.estado;
  DP.telas = DP.telas || {};

  function item(tipo, titulo, detalhe) {
    const icone = { ok: '✔', aviso: '!', erro: '✖' }[tipo];
    return h('li', { class: 'verif verif-' + tipo },
      h('span', { class: 'verif-icone', 'aria-hidden': 'true' }, icone),
      h('div', null, h('strong', null, titulo), detalhe ? h('div', { class: 'verif-det' }, detalhe) : null));
  }

  function nomeCurto(id) {
    const r = E.receitas.filter(function (x) { return N.chaveReceita(x.mspec, x.bitola) === id; })[0];
    return r ? r.mspec + ' ' + U.fmtBitola(r.bitola) + ' mm²' : id.replace('|', ' ');
  }

  function verificacoes(analise, pend) {
    const itens = [];
    const invalidos = Object.keys(E.camposInvalidos).length;
    if (invalidos) {
      itens.push(item('erro', U.plural(invalidos, 'campo com valor inválido', 'campos com valor inválido') + ' na aba Receitas',
        'Corrija antes de gerar. Enquanto isso o TXT não pode ser salvo.'));
    }
    itens.push(item('ok', U.plural(E.receitas.length, 'receita válida', 'receitas válidas'), 'Posições dentro do limite de 0 a ' + (N.MAX_UM / 1000).toString().replace('.', ',') + ' mm.'));
    itens.push(item('ok', analise.ocupados + ' painéis ocupados · ' + analise.livres + ' livres',
      analise.livres + ' ' + (analise.livres === 1 ? 'painel livre sai' : 'painéis livres saem') + ' com zeros no arquivo.'));
    if (analise.semReceita.length) {
      itens.push(item('aviso', U.plural(analise.semReceita.length, 'painel ocupado sem receita', 'painéis ocupados sem receita'),
        'Sairão com zeros: painel ' + analise.semReceita.join(', ') + '. Corrija na aba Part Numbers.'));
    }
    if (analise.duplicados.length) {
      itens.push(item('aviso', 'PN repetido em mais de um painel',
        analise.duplicados.map(function (d) { return d.pn + ' (painéis ' + d.slots.join(', ') + ')'; }).join(' · ')));
    }
    if (analise.filamentosDivergentes.length) {
      itens.push(item('aviso', U.plural(analise.filamentosDivergentes.length, 'painel com filamentos diferente da receita', 'painéis com filamentos diferente da receita'),
        'Painel ' + analise.filamentosDivergentes.map(function (d) { return d.slot; }).join(', ') + '. O TXT usa Mspec + bitola; confira se o cadastro está certo.'));
    }
    if (pend.grandes) {
      itens.push(item('aviso', U.plural(pend.grandes, 'alteração maior que 1 mm', 'alterações maiores que 1 mm') + ' em relação ao último arquivo',
        'Confira na tabela abaixo (marcadas com “!”). Pode ser erro de digitação.'));
    }
    return h('ul', { class: 'verifs' }, itens);
  }

  function quadroMudancas(pend, ult) {
    const quando = ult ? U.fmtDataHora(ult.quando) + ' — ' + ult.arquivo : '';
    const cab = h('h2', null, 'O que mudou desde o último arquivo');
    if (!ult) return h('section', { class: 'bloco' }, cab, h('p', { class: 'vazio' }, 'Ainda não há arquivo anterior para comparar.'));
    if (!pend.total) {
      return h('section', { class: 'bloco' }, cab, h('p', { class: 'suave' }, quando),
        h('p', { class: 'vazio' }, 'Nenhuma alteração: o arquivo gerado agora seria igual ao anterior.'));
    }
    const partes = [cab, h('p', { class: 'suave' }, 'Comparando com: ' + quando)];
    if (pend.alteracoes.length) {
      partes.push(h('table', { class: 'tabela compacta' },
        h('thead', null, h('tr', null, h('th', null, 'Receita'), h('th', null, 'Posição'), h('th', { class: 'dir' }, 'Antes (mm)'), h('th', { class: 'dir' }, 'Depois (mm)'), h('th', { class: 'dir' }, 'Diferença (mm)'), h('th', null, ''))),
        h('tbody', null, pend.alteracoes.map(function (a) {
          const d = (a.delta > 0 ? '+' : '') + U.fmtMm(a.delta);
          return h('tr', { class: a.alerta ? 'alerta' : '' },
            h('td', null, nomeCurto(a.id)), h('td', { class: 'mono' }, a.param), h('td', { class: 'dir mono' }, U.fmtMm(a.antes)),
            h('td', { class: 'dir mono forte' }, U.fmtMm(a.depois)), h('td', { class: 'dir mono' }, d),
            h('td', null, a.alerta ? h('span', { class: 'selo selo-div', title: 'Variação maior que 1 mm' }, '! confira') : ''));
        }))));
    }
    if (pend.novas.length) partes.push(h('p', null, 'Receitas novas: ' + pend.novas.map(nomeCurto).join(', ') + '.'));
    if (pend.removidas.length) partes.push(h('p', null, 'Receitas removidas: ' + pend.removidas.map(nomeCurto).join(', ') + '.'));
    if (pend.mapa.length) {
      partes.push(h('p', { class: 'forte' }, 'Painéis com PN/receita diferente do último arquivo: ' +
        pend.mapa.map(function (m) { return m.slot; }).join(', ') + '.'));
    }
    return h('section', { class: 'bloco' }, partes);
  }

  function nomePadrao() { return 'Parametros' + N.dataCompacta() + '.txt'; }

  DP.telas.gerar = {
    titulo: '2 · Gerar TXT',
    render: function (raiz) {
      const pend = DP.pendencias();
      const ult = DP.ultimaGeracao();
      const analise = N.analisar(E.paineis, E.receitas);
      const invalidos = Object.keys(E.camposInvalidos).length;

      const iNome = h('input', { type: 'text', class: 'nome-arquivo', value: nomePadrao(), autocomplete: 'off', 'aria-label': 'Nome do arquivo' });
      const btSalvar = h('button', { class: 'btn primario grande', type: 'button', disabled: invalidos > 0 }, 'Salvar arquivo .txt');
      const btCopiar = h('button', { class: 'btn grande', type: 'button', disabled: invalidos > 0 }, 'Copiar conteúdo');
      const msg = h('p', { class: 'resultado', role: 'status' });

      function nomeValido() {
        let n = N.texto(iNome.value).replace(/[\\/:*?"<>|]/g, '_');
        if (!n) n = nomePadrao();
        if (!/\.txt$/i.test(n)) n += '.txt';
        return n;
      }

      // Confirma, se houver alterações grandes, antes de gerar.
      function confirmarGrandes() {
        if (!pend.grandes) return Promise.resolve(true);
        return U.confirmar('Conferir alterações grandes',
          [U.plural(pend.grandes, 'posição mudou', 'posições mudaram') + ' mais de 1 mm em relação ao último arquivo.',
            'Confirme se os valores estão corretos antes de enviar para a máquina.'], 'Estão corretos, gerar', false);
      }

      function sucesso(via, nome, txt) {
        return DP.registrarGeracao({ arquivo: nome, via: via, checksum: N.checksum(txt) }).then(function () { DP.renderizar(); });
      }

      btSalvar.addEventListener('click', function () {
        if (Object.keys(E.camposInvalidos).length) return;
        confirmarGrandes().then(function (ok) {
          if (!ok) return;
          const txt = N.gerarTxt(E.paineis, E.receitas);
          const nome = nomeValido();
          // A janela "Salvar como" precisa ser aberta logo após o clique.
          return U.salvarArquivo(nome, txt, { descricao: 'Arquivo TXT' }).then(function (r) {
            if (!r.ok) return;
            return sucesso('arquivo', r.nome || nome, txt).then(function () {
              U.toast(r.via === 'janela' ? 'Arquivo salvo: ' + (r.nome || nome) : 'Arquivo ' + nome + ' baixado. Procure na pasta de Downloads do navegador.', 'ok');
            });
          });
        });
      });

      btCopiar.addEventListener('click', function () {
        if (Object.keys(E.camposInvalidos).length) return;
        confirmarGrandes().then(function (ok) {
          if (!ok) return;
          const txt = N.gerarTxt(E.paineis, E.receitas);
          return U.copiarTexto(txt).then(function (copiou) {
            if (!copiou) { U.toast('Não consegui copiar automaticamente. Use “Ver conteúdo”, selecione tudo (Ctrl+A) e copie (Ctrl+C).', 'erro'); return; }
            return sucesso('copia', nomeValido(), txt).then(function () { U.toast('Conteúdo copiado (' + N.TOTAL_PAINEIS * 4 + ' linhas). Cole no programa do CLP.', 'ok'); });
          });
        });
      });

      const txtAtual = N.gerarTxt(E.paineis, E.receitas);
      const previa = h('textarea', { class: 'previa', readOnly: true, rows: 14, spellcheck: 'false', wrap: 'off', 'aria-label': 'Conteúdo do arquivo' });
      previa.value = txtAtual.replace(/\r\n/g, '\n');

      raiz.appendChild(h('div', { class: 'titulo-linha' },
        h('h2', null, 'Gerar arquivo de parâmetros'),
        h('p', { class: 'dica' }, 'Gera o mesmo arquivo da planilha: ' + N.TOTAL_PAINEIS * 4 + ' linhas × ' + N.COLUNAS_POR_LINHA + ' colunas separadas por TAB.')));

      raiz.appendChild(h('div', { class: 'duas-colunas' },
        h('div', null,
          h('section', { class: 'bloco' }, h('h2', null, 'Verificação'), verificacoes(analise, pend)),
          quadroMudancas(pend, ult)),
        h('div', null,
          h('section', { class: 'bloco acao' },
            h('h2', null, 'Saída'),
            h('label', { class: 'campo' }, h('span', { class: 'campo-rotulo' }, 'Nome do arquivo'), iNome),
            h('div', { class: 'botoes-linha' }, btSalvar, btCopiar),
            msg,
            h('p', { class: 'dica' }, 'Salvar: abre “Salvar como” (Chrome/Edge) ou baixa para a pasta Downloads. Copiar: coloca o conteúdo na área de transferência, pronto para colar no programa do CLP.'),
            h('details', { class: 'historico' }, h('summary', null, 'Ver conteúdo (' + N.TOTAL_PAINEIS * 4 + ' linhas)'), previa)),
          h('section', { class: 'bloco' },
            h('h2', null, 'Últimos arquivos gerados'),
            E.geracoes.length ? h('table', { class: 'tabela compacta' },
              h('thead', null, h('tr', null, h('th', null, 'Quando'), h('th', null, 'Arquivo'), h('th', null, 'Como'), h('th', null, 'Código'))),
              h('tbody', null, E.geracoes.slice(0, 10).map(function (g) {
                return h('tr', null, h('td', null, U.fmtDataHora(g.quando)), h('td', null, g.arquivo),
                  h('td', null, g.via === 'copia' ? 'copiado' : g.via === 'planilha' ? 'planilha' : 'arquivo'), h('td', { class: 'mono' }, g.checksum));
              }))) : h('p', { class: 'vazio' }, 'Nenhum arquivo gerado ainda.')))));
    }
  };
})(window.DP = window.DP || {});
