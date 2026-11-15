# Helia — NASA Space Apps Challenge 2026 (Florianópolis)

Cor da conversa: yellow

## Marca

- **Nome:** Helia (grego *hélios*, sol; girassol gira com o sol como a rotação gira com as safras). Em PT é feminino: "a Helia".
- **Marca:** girassol de 8 pétalas douradas com 1 pétala verde (a próxima cultura). Arquivos-fonte em `brand/` (`helia-icon.svg` com fundo, `helia-mark.svg` sem fundo); a mesma marca está em `app/public/favicon.svg`, `BrandMark` (`app/src/ui/Chrome.tsx`), deck e storyboard do vídeo.
- **Cores:** fundo azul-noite `#050A18` mantido; acento dourado `#FFC23D` (tinta `#2B1D00`; tema claro `#A86A00`); aviso laranja `#FF8A3D`; renda passou a ciano `#2EF2C9` (o antigo acento) para não colidir com o dourado.
- Capturas `video/s4-ndvimap.jpg` e `video/s7-warming.jpg` só tiveram a marca sobreposta (estado do app não abre por URL) e ainda mostram detalhes ciano antigos; refazer à mão quando houver tempo. As outras foram recapturadas (`#site=sorriso-br`, Chrome headless com `--lang=en-US`).

## Objetivo

Ganhar nas duas frentes com UM projeto só:
1. **NASA (global):** ser indicado pelo evento local de Floripa como Global Nominee e disputar os prêmios globais.
2. **Moon Track da MoonDAO** (track local, tema: assentamento lunar).

## O evento (fatos confirmados em 13/11/2026)

- **Quando:** sáb 14/11 e dom 15/11/2026, 8:00–20:00 BRT. O local fecha às 20:00, sem pernoite.
- **Onde:** Founder Haus, Av. dos Merlins, 156, Jurerê Internacional, Florianópolis.
- Só 42 vagas presenciais garantidas; chegar 8:00 em ponto.
- **Página:** https://luma.com/nw6vblxe · Evento local do NASA Space Apps, sem verba da NASA, open source.
- **Levar:** notebook, carregador, conta do Space Apps criada e time já unido na plataforma.

### Agenda de sábado
| Hora | O quê |
|---|---|
| 08:00 | Boas-vindas, café, formação de times (times fechados até 9:30) |
| 09:00 | Começa o hacking + workshop GrokBot (SpaceXSI Community) |
| 11:00 | **Moon Track by MoonDAO** ← anotar exatamente o que a track pede e o prêmio |
| 11:30 | On-chain Hackers (Superteam Brasil / Solana) |
| 12:30 | Almoço |
| 15:30 | Praia, feedback e yoga |
| 18:30 | Jantar |
| 19:45 | Encerramento do dia |

### Agenda de domingo (guia local: https://space-apps-floripa-2026.pages.dev/)
| Hora | O quê |
|---|---|
| 08:00 | Boas-vindas e revisão de progresso |
| 11:00 | Feedback com mentores |
| 15:30 | **1ª rodada de apresentação e avaliação** |
| 17:30 | **2ª rodada de apresentação e avaliação + envio do projeto** |
| 19:30 | Última chamada de envio no local |
| 20:00 | Hackathon encerra (prazo online da NASA: 23:59 hora local) |

Sábado também tem feedback com mentores e ex-vencedores às 16:30.

## Frentes em disputa

- **NASA local (Floripa):** as duas rodadas de avaliação de domingo definem quem o evento indica ao global. É a porta de entrada de tudo.
- **NASA global:** prêmios por categoria entre os indicados do mundo todo (categorias de 2026 a confirmar no guia oficial de julgamento).
- **Moon Track (MoonDAO):** track de desafio lunar; regras e prêmio a confirmar sábado 11:00.
- **Sem prêmio confirmado (são oficinas/apoio):** On-chain Hackers da Superteam Brasil (Solana), GrokBot da SpaceXSI Community, AI Collective. Perguntar no local se há bounty.
- O guia local destaca **6 desafios**: #6 SAR, #4 CLPS lunar, #11 mapa de Marte, #5 saúde de astronautas, #7 Field Shift, #3 simulador de base. **Perguntar às 8:00 se o evento aceita qualquer um dos 14 ou só esses 6** (o #10 não está entre eles).
- **Time: até 6 pessoas**, cada uma com conta própria no Space Apps.

## Regras da NASA que mandam no projeto

Detalhe completo em @docs/regras-oficiais.md. Mais importante: **proibido começar o projeto antes de sáb 14/11 às 9:00**, demo de até 30 s ou até 7 slides, tudo em inglês, IA declarada.

- Só concorre ao julgamento global quem responde a um dos **14 desafios oficiais** ("Create Your Own Challenge" não concorre).
- **5 critérios de julgamento:** Impacto, Criatividade, Validade (qualidade técnica/viabilidade), Relevância ao desafio, Apresentação.
- Usar dados abertos da NASA/agências parceiras e citar as fontes; declarar uso de IA.
- Julgamento começa 16/11. Prazo de envio: conferir na plataforma (referência de outros locais: dom 15/11 23:59 hora local).
- **A confirmar na plataforma no sábado cedo:** tamanho máximo do time, formato da demo (slides ou vídeo, duração), campos do formulário de envio. O site oficial não abriu por aqui (erro de certificado).

## Os 14 desafios de 2026

1. Abandoned but not Forgotten (storytelling de equipamento na Lua/Marte)
2. Be An Earth System Trend Detective! (avançado, tendências em dados da Terra)
3. Build a Junior Astronaut Mission Trainer (jogo)
4. **CLPS Lunar Mission Browser** (avançado/intermediário; janelas de sol e comunicação no polo sul lunar)
5. Health Monitoring Software for Astronauts
6. Dancing with the SARs (NISAR)
7. **Field Shift: Adapting Farms with NASA Data** (rotação de culturas resiliente)
8. Flame in Freefall (combustão em microgravidade + IA)
9. Harmonization of MODIS and VIIRS Hot Spots
10. **Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars**
11. Interplanetary Survival Guide: Martian Map
12. Planet X and SPHEREx
13. Space Mission Design Game
14. The Earth Information Jukebox

## Desafio escolhido: #7 Field Shift → produto Helia

Detalhe do que o desafio pede em @docs/desafios-06-e-07.md; vencedores anteriores em @docs/vencedores-anteriores.md.
Decisões e porquês:
- **Qualquer ponto do planeta, não só Rondônia**: o contorno da fazenda é público (CAR), então não é diferencial. O diferencial é o motor e a explicação.
- **Do trabalho da ITU entra o método** (série temporal de índice → ciclos de cultura), não o modelo (treinado na China, não transfere).
- **Radar (NISAR/#6) ficou fora**: o texto do #7 não cita radar.
- **Solo é escolha do produtor**: a API da SoilGrids devolve valores nulos desde 13/11/2026; o app tenta por 6 s e segue.
- **Soja como safrinha é bloqueada em clima tropical** (vazio sanitário/ferrugem no Brasil).
- Motor determinístico e explicável (FAO-56 + graus-dia + 20 safras reais), não caixa-preta.

## Stack e arquitetura

- `app/`: React 18 + Vite 5 + TypeScript, MapLibre GL 5 (globo), Framer Motion, Vitest.
  - `src/engine/`: motor puro (clima/ET₀, simulação de cultura, rotação, estratégias, explicações). Testado.
  - `src/worker/`: motor num Web Worker (instância única no módulo; com StrictMode o useMemo criava dois workers).
  - `src/data/`: NASA POWER e MODIS (ORNL) ao vivo do navegador, terreno SRTM (Terrarium/AWS), SoilGrids.
  - `src/ui/`: mapa com camadas NASA GIBS datadas, painel do talhão, laboratório de rotações.
- `app/public/demo/*.json`: retrato dos dados NASA das 5 regiões de demonstração (funciona sem internet). Regerar com `python3 tools/fetch_demo_sites.py` (~20 min; MODIS é lento).
- Deploy: Netlify (`netlify.toml` na raiz, base `app`, roda testes no build, CSP só com as fontes de dados usadas).

## Roteiro da demo (vídeo de 30 s, roteiro em docs/pitch/SUBMISSION.md)

Globo → clicar Mato Grosso → câmera voa até pivôs reais → NDVI do MODIS mostra 138 dias de solo descoberto → 4 cartões (hoje + 3) → arrastar "chuva −30 %" e os números rolam → volta ao globo.

## Fora de escopo

Preço local, upload de análise de solo, contorno do talhão pelo CAR, assistente de WhatsApp (estão no slide 7 como próximos passos).

## Verificar

```bash
cd app
npx tsc -b --noEmit                      # typecheck
npm test                                  # 17 testes do motor (FAO-56 + 5 regiões reais)
npx vitest run src/engine/engine.test.ts  # um arquivo
REPORT=1 npx vitest run src/engine/report.test.ts   # imprime as recomendações de cada região
npm run build                             # build em app/dist
```

## Convenções

- Commit a cada coisa que funcionar. Sem linha de co-autoria do Claude nos commits.
- Notas pessoais e pendências individuais ficam em `CLAUDE.local.md` (fora do git).
- Texto de uso de IA no envio precisa ser honesto.
- Repositório precisa ficar público para o envio.
- Frentes paralelas em worktrees: `app`, `dados`, `pitch`.
- ~2 h antes do envio: abrir conversa nova só para revisar a demo do zero.

## Estado / Pendências

Estado em 15/11/2026: no ar em **https://helia-fields.netlify.app** (site Netlify `helia-fields`, id eee5b6b2-5d2e-4108-a322-51d25431c242). Código em github.com/Muril0zz/helia-fields (público). Deck em `/pitch/`, PDF em `docs/pitch/helia-deck.pdf`. 6 regiões de demonstração (MT, RO, Iowa, Kansas, Quênia; Punjab só por link) + qualquer ponto ao vivo. **EN | PT** (idioma lembrado no navegador). 15 testes passando. Revisão independente feita e 11 bugs corrigidos.
- 14/11 tarde: **CAR do produtor** no ar (código CAR ou "achar imóvel aqui" → limite do SICAR, NDVI dentro do polígono, PRODES/EUDR; `#car=<código>`; CSP libera geoserver.car.gov.br e terrabrasilis). **Validação ampla**: 38 séries IBGE/Eurostat/StatCan, 36/38 positivas, mediana r 0,35 (`docs/VALIDATION.md`; dados com `python3 tools/fetch_validation.py`, rodar com `VALIDATE=1`). **25 objeções de jurado com respostas** em `docs/OBJECTIONS.md` (resumo PT no PITCH-AO-VIVO). 
- 14/11 ~15:30: **Próxima safra (El Niño)**: cartão no laboratório lê a previsão oficial da NOAA CPC (12/11/2026: El Niño forte até jan–mar 2027, >79 %) e reordena as opções só com as safras análogas (ONI médio ≥ +1,0 nos 6 meses após o plantio: 2009/10, 2015/16, 2023/24). ONI embutido em `src/engine/enso-data.ts`; **atualizar `OUTLOOK` em `enso.ts` e regerar o ONI quando sair a discussão de 10/12/2026**. IBGE confirma: Centro-Norte −8/−9 %, Sul +7/+8 % nessas safras (VALIDATION.md). Deck (slides 4 e 7) e PDF atualizados; exportar o PDF do arquivo (`file://…/app/public/pitch/index.html`), não do servidor de dev (que devolve o app).
- 14/11 noite: **Observatório NASA** (`src/data/observatory.ts`, `ui/Observatory.tsx`, `MapView` com quadros pré-carregados): chuva das últimas 24 h (IMERG 30 min) abre o globo; ao abrir talhão entra o HLS 30 m (cenas via NASA CMR + checagem de nuvem por pixel no talhão) com time-lapse; MODIS, NDVI, SMAP e GLDAS tocáveis; camada regional reenquadra o zoom. **Não usar `raster-opacity-transition`** (a camada some). **Água embaixo do talhão** (`engine/water.ts`, `ui/SoilColumn.tsx`, mensagem `trace` no worker) e **Chuva chegando** (Open-Meteo 16 dias, `ui/RainComing.tsx`). Roteiro dos momentos WOW em `docs/pitch/PITCH-AO-VIVO.md`. Vídeo de 30 s refeito em 15/11 com a marca Helia.
- 14/11 ~20:00: **Modo Apresentar** (`ui/StoryMode.tsx`, 7 cenas, setas/PageDown/Esc), **resposta primeiro** no laboratório (`ui/AnswerHero.tsx`), Observatório compacto ao lado dos painéis e botão "Ver mapa". **Recomendações realistas**: cultura com `infra` (algodão) só entra se o produtor marcar "aceito máquina nova" ou já plantar; a menor mudança é sempre a 1ª opção. **Preço local**: `app/src/data/prices.json` (gerado por `python3 tools/fetch_prices.py`, CONAB UF/município + FAOSTAT 40 países + PTAX), resolvido em `src/data/prices.ts` (município → estado → país → global; lugar pelo CAR/IBGE, demo ou Nominatim) e editável no cartão "Preços e custos locais"; motor recebe USD (`prices` no SimRequest), tela mostra moeda local (`ui/money.tsx`). Preço municipal da CONAB parou em dez/2025 (fica como `price_last*`, não usado); custo de cobertura não tem fonte oficial (estimativa global). Ao publicar, rodar o build com `npm --prefix app run build` a partir da raiz da worktree (um build que falha deixa o `dist` antigo e o deploy sobe a versão velha).
- Material de envio em `docs/pitch/`: `SUBMISSION.md` (textos do formulário), `helia-demo-30s.mp4` (vídeo de 28 s pronto), `helia-deck.pdf` (7 slides), `PITCH-AO-VIVO.md` (roteiro de 3 min em português + perguntas).
- Vídeo: storyboard em `app/public/pitch/video.html` (usa script inline; só funciona no servidor local, a CSP de produção bloqueia) + `tools/build_demo_video.sh`.
- Publicar: `npm --prefix app run build`, copiar `app/dist` para uma pasta fora do git e `netlify deploy --dir=. --site helia-fields --no-build --prod`.
- Números do deck (slides 2 e 6) vêm do app em produção para Sorriso; se o motor mudar, refazer a leitura e reexportar o PDF (`chrome --headless --print-to-pdf`).
- Limitação conhecida: data de plantio otimizada com variantes de antecipação (25–100 dias); Punjab ainda não chega a milho → trigo.

Pendências: ver `CLAUDE.local.md`.
