<h1 align="center">DecapeParam</h1>

<p align="center">
  <img src="https://skillicons.dev/icons?i=html,css,js,nodejs" alt="HTML5, CSS3, JavaScript e Node.js" />
</p>

<p align="center">
  <img alt="Licença MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-green?style=for-the-badge">
  <img alt="Funciona offline" src="https://img.shields.io/badge/funciona-100%25%20offline-orange?style=for-the-badge">
  <img alt="IndexedDB" src="https://img.shields.io/badge/armazenamento-IndexedDB-blue?style=for-the-badge">
  <img alt="Sem dependências" src="https://img.shields.io/badge/depend%C3%AAncias-nenhuma-lightgrey?style=for-the-badge">
</p>

**Gerador de parâmetros de decape para a máquina SA01 (Semi Auto).**

Depois de cada troca de faca, o operador atualiza as posições de corte e decape e o DecapeParam gera o arquivo de parâmetros no formato que o CLP da máquina espera, **direto no computador da máquina**, sem Excel, sem internet e sem instalar nada.

---

## Por que existe

A faca da máquina de decape se desgasta e precisa ser trocada de tempos em tempos. A cada troca, os parâmetros de posição precisam ser recalibrados e enviados ao CLP.

Antes, isso era feito em uma planilha Excel com macro, em outro computador, e o arquivo gerado era levado até a máquina por pen drive, exigindo liberação do TI a cada vez. O DecapeParam elimina esse caminho: o operador faz tudo no próprio computador da máquina, em uma tela simples.

## O que ele faz

- **Ajuste das receitas** — digita as posições (em mm) de cada receita (Mspec + bitola), com validação na hora.
- **Registro da troca de faca** — data, vida útil da faca removida (peças) e responsável, com histórico.
- **Geração do arquivo de parâmetros** — mesmo formato da planilha original (TXT com 696 linhas), para salvar ou copiar e colar no programa do CLP.
- **Conferência antes de gerar** — mostra o que mudou desde o último arquivo e destaca variações grandes, para evitar erro de digitação.
- **Cadastro de Part Numbers** — qual PN está em qual painel e com qual receita; importa e exporta a Lista Mestra.
- **Backup e restauração** — guarda todos os dados em um arquivo.

## Tecnologias

| | Camada | Tecnologia |
|---|---|---|
| <img src="https://skillicons.dev/icons?i=html" width="32" alt="HTML5"> <img src="https://skillicons.dev/icons?i=css" width="32" alt="CSS3"> | Interface | HTML5 e CSS3 |
| <img src="https://skillicons.dev/icons?i=js" width="32" alt="JavaScript"> | Lógica | JavaScript puro (sem frameworks e sem bibliotecas externas) |
| 🗄️ | Armazenamento | IndexedDB (no navegador) |
| <img src="https://skillicons.dev/icons?i=nodejs" width="32" alt="Node.js"> | Testes | Node.js (`assert`), sem dependências |
| 🔒 | Segurança | Content Security Policy que bloqueia qualquer acesso à rede |

Tudo funciona 100% offline e abrindo o `index.html` diretamente (`file://`), sem servidor.

---

## Como usar

### Primeiro acesso

1. Copie a pasta **DecapeParam** inteira para o computador (por exemplo `C:\DecapeParam`). Mantenha as pastas `css` e `js` ao lado do `index.html`.
2. Dê dois cliques em **`index.html`**. Use o **Chrome** ou o **Edge**.
3. Os dados atuais da máquina (receitas, Part Numbers e histórico de faca) já vêm carregados.

> **Dica:** crie um atalho do `index.html` na área de trabalho e use sempre o mesmo navegador e o mesmo usuário do Windows.

### Depois de trocar a faca

**1. Aba “1 · Ajustar receitas”**

1. Clique em **Registrar troca de faca** e preencha a data, as peças da faca que saiu e quem trocou.
2. Em cada receita, digite as novas posições em milímetros. Aceita vírgula ou ponto, até 3 casas decimais (ex.: `12,85`). Use **Enter** para ir ao próximo campo.
   - Campo **amarelo**: valor diferente do último arquivo gerado.
   - Campo **vermelho**: valor inválido (corrija para poder gerar o arquivo).
3. Errou? **Desfazer alterações** volta a receita aos valores do último arquivo gerado.

**2. Aba “2 · Gerar TXT”**

1. Confira a **Verificação** e a tabela **“O que mudou desde o último arquivo”**. Variações maiores que 1 mm aparecem com “! confira”.
2. Escolha uma das saídas:
   - **Salvar arquivo .txt** — abre “Salvar como” (Chrome/Edge) para escolher a pasta; em outros navegadores, o arquivo vai para a pasta Downloads. O nome sugerido é `ParametrosAAAAMMDD.txt`.
   - **Copiar conteúdo** — copia o texto, pronto para colar no programa do CLP.

### Outras telas

**Part Numbers**
- **Cadastrar novo PN**: escolha o painel, informe o PN e selecione a receita.
- **Editar** (ou duplo clique na linha) e **Liberar** (esvazia o painel).
- A coluna **Situação** avisa se o painel está sem receita; nesse caso ele sai com zeros no arquivo.

**Backup e dados**
- **Baixar backup (.json)** e **Restaurar de um backup**.
- **Importar / Exportar Lista Mestra** (.txt) no formato da planilha.
- **Restaurar dados iniciais**: volta ao estado de entrega do programa.

### Cuidados com os dados

Os dados ficam guardados **no navegador deste computador**, não na pasta do programa. Por isso:

- Use sempre o **mesmo navegador e o mesmo usuário do Windows**.
- Não apague os “dados de sites” do navegador.
- Faça um **backup** de tempos em tempos e guarde em local seguro. O programa lembra quando houver alterações sem backup recente.

---

## Regras do arquivo gerado

O arquivo segue exatamente a lógica da planilha original:

- 174 painéis, cada um com 40 registradores, em 4 linhas de 10 colunas: **696 linhas**.
- A receita do painel é identificada por **Mspec + bitola**. Painel livre ou sem receita sai com zeros.
- Cada receita tem 16 valores (P1Y, P1Z … P8Y, P8Z), gravados em **micrômetros** (mm × 1000). O registrador seguinte a cada valor é sempre 0.
- Colunas separadas por **TAB**, linhas por **CRLF**, sem BOM.

Exemplo de um painel (receita M3232 · 0,50 mm²):

```
0	0	0	0	37000	0	0	0	37000	0
15200	0	37000	0	6000	0	41800	0	9000	0
41800	0	12900	0	41800	0	12750	0	36000	0
12750	0	0	0	0	0	0	0	0	0
```

As velocidades exibidas nas receitas são apenas referência, como na planilha, e não são enviadas ao arquivo.

## Qualidade

A saída do programa é conferida, byte a byte, com o arquivo gerado pela planilha original.

```bash
node testes/testar.js
```

## Segurança e TI

- Não exige instalação, permissões de administrador, executáveis ou macros.
- Não usa internet, CDNs nem bibliotecas de terceiros. O código é totalmente legível.
- Uma Content Security Policy no `index.html` impede qualquer requisição de rede.
- Só grava arquivos quando o operador manda salvar ou baixar.

## Solução de problemas

| Problema | O que fazer |
|---|---|
| Tela em branco | Confira se as pastas `css` e `js` estão ao lado do `index.html`; abra no Chrome/Edge e pressione F5. |
| Faixa vermelha “armazenamento temporário” | O navegador bloqueou o armazenamento (ex.: janela anônima). Abra em janela normal ou baixe um backup antes de fechar. |
| Os dados sumiram | Provavelmente outro navegador/usuário do Windows ou limpeza de dados. Restaure o último backup. |
| Não achei o arquivo salvo | Se não apareceu “Salvar como”, ele está na pasta **Downloads**. |
| “Copiar conteúdo” não funcionou | Em “Ver conteúdo”, selecione tudo (Ctrl+A) e copie (Ctrl+C). |
| Painel “Sem receita” | Edite o painel e escolha a receita correta. |

## Personalização

- **Logo:** coloque o arquivo em `img/logo-aptiv.webp` (sem ele, é exibido o nome em texto).
- **Cores:** variáveis no início de `css/estilo.css` (`--acento` e `--marca`).

## Estrutura do projeto

```
DecapeParam/
├── index.html              página única
├── css/estilo.css          visual
├── img/                    logo
├── js/
│   ├── nucleo.js           regras de negócio e geração do arquivo
│   ├── dados-iniciais.js   dados de entrega (1º acesso)
│   ├── banco.js            persistência (IndexedDB)
│   ├── estado.js           estado e operações
│   ├── ui.js               componentes de interface
│   ├── tela-receitas.js · tela-gerar.js · tela-paineis.js · tela-dados.js
│   └── app.js              abas e inicialização
└── testes/                 testes automáticos e arquivos de referência
```

## Licença

Distribuído sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE).

A licença cobre o código deste projeto. Nomes, logotipos e marcas de terceiros citados ou exibidos pelo programa pertencem aos seus respectivos titulares.
