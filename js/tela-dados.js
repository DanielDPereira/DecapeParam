/* Tela "Backup e dados" — backup/restauração, importar/exportar a Lista Mestra, estado do armazenamento. */
(function (DP) {
  'use strict';
  const N = DP.nucleo, B = DP.banco, U = DP.ui, h = U.h, E = DP.estado;
  DP.telas = DP.telas || {};

  const FORMATO = 'DecapeParam-backup';

  // ---------------------------------------------------------------- backup
  function agoraArquivo() { const d = new Date(); return N.dataCompacta(d) + '_' + N.horaCompacta(d); }

  function baixarBackup() {
    return B.exportarTudo().then(function (dados) {
      const pacote = { formato: FORMATO, versao: 1, exportadoEm: new Date().toISOString(), dados: dados };
      return U.salvarArquivo('DecapeParam_backup_' + agoraArquivo() + '.json', JSON.stringify(pacote, null, 1),
        { mime: 'application/json', descricao: 'Backup do DecapeParam' });
    }).then(function (r) {
      if (r.ok) {
        return DP.gravarConfig('ultimoBackup', new Date().toISOString()).then(function () { return DP.gravarConfig('sujo', false); })
          .then(function () { U.toast(r.via === 'janela' ? 'Backup salvo.' : 'Backup baixado para a pasta de Downloads.', 'ok'); DP.renderizar(); });
      }
    });
  }

  function validarBackup(o) {
    if (!o || o.formato !== FORMATO || !o.dados) throw new Error('Este arquivo não é um backup do DecapeParam.');
    const d = o.dados;
    ['receitas', 'paineis', 'pendentes', 'trocas', 'geracoes', 'config'].forEach(function (k) {
      if (!Array.isArray(d[k])) throw new Error('Backup incompleto: falta “' + k + '”.');
    });
    d.receitas.forEach(function (r) {
      if (!r.id || !r.mspec || !r.pos || !r.vel) throw new Error('Backup com receita inválida.');
      N.PARAMS.forEach(function (p) {
        if (!Number.isInteger(r.pos[p]) || r.pos[p] < 0 || r.pos[p] > N.MAX_UM) throw new Error('Receita ' + r.id + ': valor inválido em ' + p + '.');
      });
      if (r.id !== N.chaveReceita(r.mspec, r.bitola)) throw new Error('Receita ' + r.id + ': identificador não confere com Mspec/bitola.');
    });
    d.paineis.forEach(function (p) {
      if (!Number.isInteger(p.slot) || p.slot < 1 || p.slot > N.TOTAL_PAINEIS) throw new Error('Backup com painel fora do intervalo.');
    });
    return d;
  }

  function restaurarBackup(arquivo) {
    return U.lerArquivoTexto(arquivo).then(function (txt) {
      let d;
      try { d = validarBackup(JSON.parse(txt)); } catch (e) { U.toast(e.message || 'Arquivo de backup inválido.', 'erro'); return; }
      return U.confirmar('Restaurar backup',
        ['Isto substitui TODOS os dados atuais (receitas, PNs, histórico) pelos do backup:',
          U.plural(d.receitas.length, 'receita', 'receitas') + ', ' + U.plural(d.paineis.length, 'painel ocupado', 'painéis ocupados') + ', ' +
          U.plural(d.trocas.length, 'troca de faca', 'trocas de faca') + '.'], 'Restaurar', true)
        .then(function (ok) {
          if (!ok) return;
          E.camposInvalidos = {};
          return B.substituir(d).then(DP.carregar).then(function () { U.toast('Backup restaurado.', 'ok'); DP.renderizar(); });
        });
    });
  }

  // ---------------------------------------------------------------- lista mestra
  function importarLista(arquivo) {
    return U.lerArquivoTexto(arquivo).then(function (txt) {
      let r;
      try { r = N.lerListaMestra(txt); } catch (e) { U.toast(e.message, 'erro'); return; }
      const idx = N.indexarReceitas(E.receitas);
      const semRec = r.paineis.filter(function (p) { return !idx[N.chaveReceita(p.mspec, p.bitola)]; });
      const resumo = [
        h('p', null, h('strong', null, r.paineis.length + ' painéis ocupados'), ' (de ' + N.TOTAL_PAINEIS + ') e ' + U.plural(r.pendentes.length, 'cadastro sem painel', 'cadastros sem painel') + '.'),
        h('p', null, 'Atualmente: ' + Object.keys(E.paineis).length + ' painéis ocupados.')
      ];
      if (semRec.length) resumo.push(h('p', { class: 'aviso-inline' }, 'Atenção: ' + U.plural(semRec.length, 'painel não tem', 'painéis não têm') + ' receita correspondente (' +
        semRec.slice(0, 12).map(function (p) { return p.slot; }).join(', ') + (semRec.length > 12 ? '…' : '') + '). Sairão com zeros até a receita existir.'));
      if (r.avisos.length) {
        resumo.push(h('p', { class: 'aviso-inline' }, U.plural(r.avisos.length, 'aviso', 'avisos') + ':'));
        resumo.push(h('ul', { class: 'lista-avisos' }, r.avisos.slice(0, 15).map(function (a) { return h('li', null, a); })));
        if (r.avisos.length > 15) resumo.push(h('p', { class: 'suave' }, '… e mais ' + (r.avisos.length - 15) + '.'));
      }
      const cBackup = h('input', { type: 'checkbox', checked: true });
      resumo.push(h('label', { class: 'check' }, cBackup, ' Baixar um backup dos dados atuais antes de substituir (recomendado)'));
      resumo.push(h('p', { class: 'dica' }, 'As receitas (posições) não mudam; só a lista de PNs por painel é substituída.'));
      return U.dialogo({
        titulo: 'Importar lista mestra', largo: true, corpo: resumo,
        botoes: [{ rotulo: 'Cancelar' }, {
          rotulo: 'Substituir lista de PNs', tipo: 'perigo',
          acao: function () {
            const antes = cBackup.checked ? baixarBackup() : Promise.resolve();
            return antes.then(function () { return DP.substituirLista(r.paineis, r.pendentes); });
          }
        }]
      }).then(function (res) {
        if (res === 'Substituir lista de PNs') { U.toast('Lista de PNs importada.', 'ok'); DP.renderizar(); }
      });
    });
  }

  function exportarLista() {
    const txt = N.exportarListaMestra(DP.listaPaineis(), E.pendentes);
    return U.salvarArquivo('Lista_Mestra_de_Part_Numbers_' + N.dataCompacta() + '.txt', txt, { bom: true, descricao: 'Lista Mestra (TXT)' })
      .then(function (r) { if (r.ok) U.toast('Lista mestra exportada.', 'ok'); });
  }

  function escolherArquivo(aceita, aoEscolher) {
    const inp = h('input', { type: 'file', accept: aceita, class: 'oculto' });
    inp.addEventListener('change', function () { if (inp.files && inp.files[0]) aoEscolher(inp.files[0]); if (inp.parentNode) inp.parentNode.removeChild(inp); });
    document.body.appendChild(inp);
    inp.click();
  }

  // ---------------------------------------------------------------- tela
  DP.telas.dados = {
    titulo: 'Backup e dados',
    render: function (raiz) {
      const est = B.estado;
      const ub = E.config.ultimoBackup;
      const lembrete = DP.lembreteBackup();

      raiz.appendChild(h('div', { class: 'titulo-linha' }, h('h2', null, 'Backup e dados')));

      raiz.appendChild(h('section', { class: 'bloco' },
        h('h2', null, 'Backup completo'),
        h('p', null, 'Os dados ficam guardados ', h('strong', null, 'no navegador deste computador'), ' (IndexedDB), não na pasta do programa. ' +
          'Se o histórico/dados do navegador forem apagados, ou se outro navegador/usuário do Windows for usado, os dados não aparecem. ' +
          'Por isso, guarde um backup em local seguro.'),
        h('p', { class: lembrete ? 'aviso-inline' : 'suave' },
          ub ? 'Último backup: ' + U.fmtDataHora(ub) + (lembrete ? ' — já faz ' + U.plural(lembrete.dias, 'dia', 'dias') + '.' : '.')
            : 'Nenhum backup feito neste computador ainda.'),
        h('div', { class: 'botoes-linha' },
          h('button', { class: 'btn primario', type: 'button', onclick: baixarBackup }, 'Baixar backup (.json)'),
          h('button', { class: 'btn', type: 'button', onclick: function () { escolherArquivo('.json,application/json', restaurarBackup); } }, 'Restaurar de um backup…'))));

      raiz.appendChild(h('section', { class: 'bloco' },
        h('h2', null, 'Lista Mestra de Part Numbers'),
        h('p', null, 'Importa ou exporta a lista de PNs no formato da planilha (colunas: Número Painel, PN Aptiv, Cavidades, Eletrodo, Mspec, Bitola, Filamentos). ' +
          'Serve para levar a lista para o Excel, ou para atualizar vários PNs de uma vez.'),
        h('div', { class: 'botoes-linha' },
          h('button', { class: 'btn', type: 'button', onclick: function () { escolherArquivo('.txt,.tsv,.csv,text/plain', importarLista); } }, 'Importar lista mestra (.txt)…'),
          h('button', { class: 'btn', type: 'button', onclick: exportarLista }, 'Exportar lista mestra (.txt)'))));

      raiz.appendChild(h('section', { class: 'bloco' },
        h('h2', null, 'Armazenamento'),
        h('dl', { class: 'info' },
          h('dt', null, 'Modo'), h('dd', null, est.modo === 'indexeddb' ? 'IndexedDB (permanente neste navegador)' : 'Memória (temporário!) — ' + est.motivo),
          h('dt', null, 'Proteção contra limpeza'), h('dd', null, est.persistente === true ? 'Ativada' : est.persistente === false ? 'Não ativada' : 'Desconhecida'),
          h('dt', null, 'Endereço da página'), h('dd', { class: 'mono quebra' }, location.href.split('#')[0]),
          h('dt', null, 'Registros'), h('dd', null, E.receitas.length + ' receitas · ' + Object.keys(E.paineis).length + ' painéis ocupados · ' +
            E.pendentes.length + ' sem painel · ' + E.trocas.length + ' trocas de faca · ' + E.geracoes.length + ' gerações'),
          h('dt', null, 'Dados iniciais'), h('dd', null, DP.DADOS_INICIAIS.origem)),
        h('div', { class: 'botoes-linha' },
          h('button', { class: 'btn', type: 'button', disabled: est.modo !== 'indexeddb', onclick: function () {
            B.pedirPersistencia().then(function (p) {
              U.toast(p ? 'Proteção ativada.' : 'O navegador não concedeu a proteção (pode ser normal neste tipo de página). Use o backup.', p ? 'ok' : 'info');
              DP.renderizar();
            });
          } }, 'Pedir proteção contra limpeza'),
          h('button', { class: 'btn perigo', type: 'button', onclick: function () {
            U.confirmar('Restaurar dados iniciais',
              ['Isto apaga TODAS as alterações feitas aqui e volta aos dados da planilha original:', DP.DADOS_INICIAIS.origem + '.',
                'Faça um backup antes, se houver algo a preservar.'], 'Apagar e restaurar', true)
              .then(function (ok) { if (ok) DP.restaurarFabrica().then(function () { U.toast('Dados iniciais restaurados.', 'ok'); DP.renderizar(); }); });
          } }, 'Restaurar dados iniciais…'))));
    }
  };
})(window.DP = window.DP || {});
