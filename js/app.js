/* DecapeParam — inicialização, abas e avisos globais. */
(function (DP) {
  'use strict';
  const U = DP.ui, h = U.h, E = DP.estado, B = DP.banco;

  const ABAS = ['receitas', 'gerar', 'paineis', 'dados'];

  function desenharAbas() {
    const nav = document.getElementById('abas');
    U.limpar(nav);
    ABAS.forEach(function (id) {
      const sel = E.aba === id;
      const bt = h('button', {
        type: 'button', role: 'tab', class: 'aba' + (sel ? ' ativa' : ''), 'aria-selected': sel ? 'true' : 'false', id: 'aba-' + id,
        onclick: function () { if (E.aba !== id) { E.aba = id; DP.renderizar({ topo: true }); } }
      }, DP.telas[id].titulo);
      if (id === 'gerar') bt.appendChild(h('span', { class: 'aba-selo oculto', id: 'selo-gerar' }));
      nav.appendChild(bt);
    });
  }

  // Atualiza o que depende do estado sem redesenhar a tela (selo da aba, faixa de avisos, estado do armazenamento).
  DP.atualizarSelos = function () {
    const pend = DP.pendencias();
    const inv = Object.keys(E.camposInvalidos).length;
    const s = document.getElementById('selo-gerar');
    if (s) {
      const n = inv ? '!' : pend.total;
      s.textContent = n ? String(n) : '';
      s.classList.toggle('oculto', !n);
      s.classList.toggle('erro', !!inv);
      s.title = inv ? 'Há campos inválidos' : pend.total ? pend.total + ' alteração(ões) desde o último arquivo gerado' : '';
    }

    const avisos = document.getElementById('avisos');
    U.limpar(avisos);
    if (B.estado.modo !== 'indexeddb') {
      avisos.appendChild(h('div', { class: 'faixa faixa-erro', role: 'alert' },
        h('strong', null, 'Atenção: '), 'o navegador não permitiu guardar dados permanentemente (' + B.estado.motivo + '). ' +
        'As alterações serão perdidas ao fechar esta página. Use “Baixar backup” na aba Backup e dados.'));
    }
    const lb = DP.lembreteBackup();
    if (lb) {
      avisos.appendChild(h('div', { class: 'faixa faixa-aviso' },
        h('span', null, lb.nunca ? 'Há alterações e ainda não existe backup neste computador.' : 'O último backup tem ' + U.plural(lb.dias, 'dia', 'dias') + ' e há alterações novas.'),
        h('button', { class: 'btn mini', type: 'button', onclick: function () { E.aba = 'dados'; DP.renderizar({ topo: true }); } }, 'Ir para Backup')));
    }

    const est = document.getElementById('estado-armazenamento');
    est.textContent = B.estado.modo === 'indexeddb' ? '● Alterações salvas automaticamente neste navegador' : '● Armazenamento temporário';
    est.className = 'estado ' + (B.estado.modo === 'indexeddb' ? 'estado-ok' : 'estado-erro');
  };

  DP.renderizar = function (opc) {
    const topo = opc && opc.topo;
    const y = window.pageYOffset;
    const main = document.getElementById('conteudo');
    U.limpar(main);
    DP.telas[E.aba].render(main);
    desenharAbas();
    DP.atualizarSelos();
    window.scrollTo(0, topo ? 0 : y);
  };

  function erroFatal(e) {
    const main = document.getElementById('conteudo');
    U.limpar(main);
    main.appendChild(h('div', { class: 'faixa faixa-erro', role: 'alert' },
      h('div', null, h('strong', null, 'Não foi possível iniciar o programa.'),
        h('p', null, String((e && e.message) || e)),
        h('p', null, 'Tente recarregar a página (F5). Se persistir, abra pelo Chrome ou Edge e verifique se o navegador permite armazenamento de sites.'))));
  }

  function logo() {
    const img = document.getElementById('logo-img');
    const txt = document.getElementById('logo-texto');
    // Sem o arquivo img/logo-aptiv.webp, mostra o nome em texto.
    function semLogo() { img.classList.add('oculto'); txt.classList.remove('oculto'); }
    img.addEventListener('error', semLogo);
    if (img.complete && img.naturalWidth === 0) semLogo();
  }

  function iniciar() {
    logo();
    B.abrir().then(DP.iniciarDados).then(function () { DP.renderizar({ topo: true }); }).catch(erroFatal);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})(window.DP = window.DP || {});
