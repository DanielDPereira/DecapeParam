/* Testes do núcleo do DecapeParam. Sem dependências: node testes/testar.js
 * O teste principal compara a saída do app, byte a byte, com o arquivo gerado pela planilha original. */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const N = require('../js/nucleo.js');
const D = require('../js/dados-iniciais.js');

const ref = fs.readFileSync(path.join(__dirname, 'referencia', 'Parametros20260925.txt'));
const lista = fs.readFileSync(path.join(__dirname, 'referencia', 'Lista_Mestra_de_Part_Numbers.txt'), 'utf8');

let ok = 0, falhas = 0;
function teste(nome, fn) {
  try { fn(); ok++; console.log('  ok   ' + nome); }
  catch (e) { falhas++; console.log('  FALHA ' + nome + '\n        ' + (e && e.message || e)); }
}

console.log('Geração do arquivo');
teste('saída idêntica (byte a byte) ao Parametros20260925.txt da planilha', function () {
  const txt = N.gerarTxt(D.paineis, D.receitas);
  assert.ok(Buffer.from(txt, 'utf8').equals(ref), 'conteúdo difere do arquivo de referência');
});
teste('696 linhas, 10 colunas, CRLF, sem CRLF final, sem BOM', function () {
  const txt = N.gerarTxt(D.paineis, D.receitas);
  const l = txt.split('\r\n');
  assert.strictEqual(l.length, 696);
  assert.ok(l.every(function (x) { return x.split('\t').length === 10; }));
  assert.ok(!txt.endsWith('\r\n'));
  assert.ok(!txt.includes('\n') || txt.split('\n').length - 1 === 695);
  assert.notStrictEqual(txt.charCodeAt(0), 0xFEFF);
});
teste('sem nenhum painel, tudo zero', function () {
  const txt = N.gerarTxt([], D.receitas);
  assert.ok(txt.split('\r\n').every(function (l) { return l === '0\t0\t0\t0\t0\t0\t0\t0\t0\t0'; }));
});
teste('painel sem receita correspondente gera zeros (IFERROR da planilha)', function () {
  const ps = [{ slot: 1, pn: 'X', mspec: 'M9999', bitola: '0.5' }];
  const l = N.gerarTxt(ps, D.receitas).split('\r\n');
  assert.ok(l.slice(0, 4).every(function (x) { return x === '0\t0\t0\t0\t0\t0\t0\t0\t0\t0'; }));
});
teste('registradores: valor nas posições pares, ímpares e 32..39 sempre 0', function () {
  D.paineis.forEach(function (p) {
    const regs = N.registrosDoPainel(p, N.indexarReceitas(D.receitas));
    for (let i = 0; i < 40; i++) if (i % 2 === 1 || i >= 32) assert.strictEqual(regs[i], 0, 'painel ' + p.slot + ' reg ' + i);
  });
});
teste('alterar um valor da receita muda só os registradores esperados', function () {
  const rec = JSON.parse(JSON.stringify(D.receitas));
  const alvo = rec.find(function (r) { return r.id === 'M3232|0.5'; });
  alvo.pos.P6Z = 12850;                              // 12,9 -> 12,85 mm
  const a = N.gerarTxt(D.paineis, D.receitas).split('\r\n');
  const b = N.gerarTxt(D.paineis, rec).split('\r\n');
  let diffs = 0, usos = 0;
  D.paineis.forEach(function (p) {
    if (N.chaveReceita(p.mspec, p.bitola) === 'M3232|0.5') usos++;
  });
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
    diffs++;
    assert.strictEqual(i % 4, 2, 'P6Z vai na 3ª linha do painel');   // registrador 22 => linha 3, coluna 3
    assert.strictEqual(b[i].split('\t')[2], '12850');
  }
  assert.strictEqual(diffs, usos);
});

console.log('Entrada de valores');
teste('lerMm aceita vírgula/ponto e converte para µm', function () {
  assert.strictEqual(N.lerMm('41,8').um, 41800);
  assert.strictEqual(N.lerMm('12.75').um, 12750);
  assert.strictEqual(N.lerMm(' 0 ').um, 0);
  assert.strictEqual(N.lerMm('36').um, 36000);
  assert.strictEqual(N.lerMm('0,001').um, 1);
  assert.strictEqual(N.lerMm('42,2').um, 42200);
  assert.strictEqual(N.lerMm('14,8').um, 14800);
});
teste('lerMm rejeita valores inválidos', function () {
  ['', 'abc', '-1', '1,2345', '1,2,3', '4 1', '65,536', '1e3', '--'].forEach(function (v) {
    assert.strictEqual(N.lerMm(v).ok, false, 'deveria rejeitar "' + v + '"');
  });
  assert.strictEqual(N.lerMm('65,535').ok, true);
});
teste('chave da receita normaliza Mspec e bitola', function () {
  assert.strictEqual(N.chaveReceita(' m3232 ', '0,50'), 'M3232|0.5');
  assert.strictEqual(N.chaveReceita('M3130', 0.35), 'M3130|0.35');
});
teste('ids do seed coincidem com a chave calculada', function () {
  D.receitas.forEach(function (r) { assert.strictEqual(r.id, N.chaveReceita(r.mspec, r.bitola)); });
});
teste('endereço inicial do painel (coluna J de Dados)', function () {
  assert.strictEqual(N.enderecoPainel(1), 'E00000');
  assert.strictEqual(N.enderecoPainel(2), 'E00040');
  assert.strictEqual(N.enderecoPainel(173), 'E06880');
});

console.log('Lista Mestra');
teste('lê a Lista Mestra original: 112 painéis ocupados + 2 sem painel, idênticos ao seed', function () {
  const r = N.lerListaMestra(lista);
  assert.strictEqual(r.paineis.length, 112);
  assert.strictEqual(r.pendentes.length, 2);
  assert.deepStrictEqual(r.paineis, D.paineis);
  assert.deepStrictEqual(r.pendentes, D.pendentes);
});
teste('o arquivo gerado a partir da lista lida é idêntico à referência', function () {
  const r = N.lerListaMestra(lista);
  assert.ok(Buffer.from(N.gerarTxt(r.paineis, D.receitas), 'utf8').equals(ref));
});
teste('exportar e reimportar preserva tudo', function () {
  const t = N.exportarListaMestra(D.paineis, D.pendentes);
  const r = N.lerListaMestra('﻿' + t);
  assert.deepStrictEqual(r.paineis, D.paineis);
  assert.deepStrictEqual(r.pendentes, D.pendentes);
});
teste('arquivo que não é a lista mestra é recusado', function () {
  assert.throws(function () { N.lerListaMestra('a\tb\tc\n1\t2\t3'); }, /PN Aptiv/);
});
teste('avisos: painel repetido, fora do intervalo e bitola inválida', function () {
  const t = ['Número Painel\tPN Aptiv\tCavidade Esquerda\tCavidade Direita\tEletrodo da Maq. Solda\tMspec\tBitola\tFilamentos',
    '1\tA\tL1\tL2\tKM3134\tM3232\t0,5\t16 Cobre', '1\tB\t\t\t\tM3232\t0,5\t16 Cobre',
    '175\tC\t\t\t\tM3232\t0,5\t16 Cobre', '2\tD\t\t\t\tM3232\txx\t16 Cobre'].join('\r\n');
  const r = N.lerListaMestra(t);
  assert.strictEqual(r.paineis.length, 2);
  assert.strictEqual(r.paineis[0].bitola, '0.5');
  assert.strictEqual(r.avisos.length, 3);
});

console.log('Comparação com a última geração');
teste('snapshot idêntico = nenhuma diferença', function () {
  const s = N.snapshot(D.paineis, D.receitas);
  const d = N.diffReceitas(s.receitas, D.receitas);
  assert.strictEqual(d.alteracoes.length, 0);
  assert.strictEqual(N.diffMapa(s.mapa, D.paineis).length, 0);
});
teste('detecta alteração e marca alerta quando passa de 1 mm', function () {
  const s = N.snapshot(D.paineis, D.receitas);
  const rec = JSON.parse(JSON.stringify(D.receitas));
  rec[0].pos.P2Y = 37100;      // +0,1 mm
  rec[0].pos.P5Y = 4180;       // typo clássico: 41,8 -> 4,18
  const d = N.diffReceitas(s.receitas, rec);
  assert.strictEqual(d.alteracoes.length, 2);
  assert.strictEqual(d.alteracoes.filter(function (x) { return x.alerta; }).length, 1);
});

console.log('\n' + ok + ' ok, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
