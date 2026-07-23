# CLAUDE.md - Music Lab

Guia para agentes trabalhando neste repositório. Leia antes de editar.

**Site publicado (GitHub Pages):** <https://gabrielogregorio.github.io/music-lab/>

> O `base` do Vite (`vite.config.ts`, `/music-lab/`) precisa casar com o caminho do
> repositório no Pages. O repositório será renomeado para `music-lab` no GitHub pelo
> dono; o diretório local ainda pode se chamar `music-lab` - tudo bem.

> **Nunca faça `git commit`/`git push` sem autorização explícita do usuário.**

## O que é

**Music Lab** é um laboratório de **tin whistle** que roda 100% no navegador, sem
backend. Reúne quatro ferramentas, cada uma com **URL própria** (hash routing), mais
uma home que roteia pelo conteúdo colado. Nasceu do conversor ABC→digitação
(reencarnação do `abcconverter.php` do mandolintab.net), absorveu dois apps
irmãos (um metrônomo e um treinador de afinação por microfone) e ganhou um
afinador próprio.

### Os módulos (cada um tem URL)

| Rota | Módulo | O que faz |
|---|---|---|
| `#/` | **Launcher** | Input inteligente: cola ABC → conversor; "120 bpm" → metrônomo; ou busca ferramentas por palavra-chave (aliases em todos os idiomas). |
| `#/converter` | **Conversor ABC** | ABC → partitura (abcjs) com a digitação de tin whistle alinhada sob cada nota; transpose, alongar notas, remover ligados; export SVG/PNG/PDF. |
| `#/tuner` | **Afinador** | YIN em AudioWorklet+Worker; fita de história em cents, vibrato medido (centro/extensão/taxa), presets por instrumento, calibração do lá. Julga pelo **centro**, não pelo instante. |
| `#/metronome` | **Metrônomo** | Pêndulo SVG, tap tempo, subdivisões, swing, acento por batida; timing sample-accurate via Web Audio. |
| `#/practice` | **Treino** | Toca no microfone e avança nota a nota ao acertar a afinação (detecção NSDF, tolerância em cents, pauta SVG). |

## Stack

- **React 19 + TypeScript + Vite.** (O app começou vanilla; foi migrado para React
  ao unir os três apps - mantenha React daqui pra frente.)
- **abcjs** (`^6.6.3`): renderiza a pauta em SVG e faz o transpose visual (conversor).
- **jsPDF**: export em PDF (conversor).
- **Web Audio API**: motor do metrônomo (sem dependências extras).
- **Vitest** (`environment: jsdom`): testes do núcleo puro e de comportamento dos
  componentes. Os matchers de DOM e a limpeza vêm do **`@testing-library/react`** +
  **`@testing-library/jest-dom`** + **`@testing-library/user-event`** (versões fixas),
  registrados em `test/setup.ts` (`setupFiles` no `vite.config.ts`).
- Deploy: **GitHub Pages via Actions** (`.github/workflows/deploy.yml`).

`npm run build` roda `tsc --noEmit` primeiro; `noUnusedLocals`/`noUnusedParameters`
estão ligados, então import ou variável sobrando quebra o build.

## Comandos

```bash
npm install
npm run dev     # dev server
npm test        # vitest (roda no CI antes do build)
npm run build   # tsc --noEmit && vite build -> dist/
```

## Trabalhando no repositório

- **Nunca leia** `package-lock.json`, `node_modules/`, `dist/` nem arquivos `.log` - só
  gastam token sem retorno. Prefira abrir um arquivo, seguir o import e grepar imports a ler
  em massa; se a tarefa exigir iterar por **mais de 20 arquivos**, peça confirmação.
- **Comandos moram no `package.json`**, não espalhados como linhas de terminal soltas.
- **Fixe versões (e hashes) de dependência** - o pacote de origem pode ser comprometido.
- **Antes de escrever código (moderno ou legado), confira a versão da lib no `package.json`**
  (um grep): a API pode não existir ainda ou já ter mudado na versão que o projeto usa.

## Arquitetura

Regra de ouro herdada do conversor: **abcjs desenha e transpõe; o código próprio lê
os pitches e calcula a digitação.** Não confie no modelo interno do abcjs além das
classes DOM (`.abcjs-note`, `.abcjs-staff-wrapper`).

### Layout de pastas

| Caminho | Papel |
|---|---|
| `src/main.tsx`, `src/App.tsx` | Raiz React + shell (header com marca/idioma/tema, nav, footer). |
| `src/i18n/` | Um arquivo de dicionário por idioma (`pt.ts`/`en.ts`/`es.ts`/`zh.ts`/`ja.ts`), tipos em `types.ts`, e `i18n.tsx` (monta `DICTS`, `I18nProvider`, `useT`/`useI18n`, `LANGS`, `translate`). Fallback: en. |
| `src/app/router.ts` | `useHashRoute` (rotas por `#/…`) + canal em memória (`pendingAbc`/`pendingTempo`) do launcher para os módulos. |
| `src/app/useMountEffect.ts` | `useMountEffect(fn)`: `useEffect(fn, [])` nomeado, **último recurso** para ciclo de vida de sistema externo (motor de áudio + rAF, listener global de teclado). Prefira os padrões sem efeito antes dele (ver "useEffect - a regra de ouro"). O router migrou para `useSyncExternalStore`. |
| `src/app/registry.ts` | Catálogo dos apps (ícone, chaves de nome/descrição/keywords) - usado por nav e launcher. |
| `src/app/detect.ts` | Heurísticas puras do launcher: `looksLikeAbc`, `detectTempo`, `scoreMatch` (testado). |
| `src/app/theme.ts` | `lockLightTheme()` - fixa `data-theme="light"` no `<html>`. O app é **travado no tema claro**; não há toggle. |
| `src/shell/` | `TopBar` (só os idiomas), `Nav`, `Launcher` (a home) e `WhistleMark` (a marca SVG). |
| `src/modules/converter/Converter.tsx` | UI React sobre os cores de `music/`, `whistle/`, `ui/`. |
| `src/modules/tuner/` | Afinador. `core/` puro e testado (yin, cents, stability, vibrato, trace, presets); `audio/` (worklet coletor + worker YIN + engine); `hooks/`, `components/`. |
| `src/modules/metronome/` | `Metronome.tsx` (UI + loop rAF) + `core/` (timing/áudio puro, testado). |
| `src/modules/practice/` | Treino: `audio/` (pitch NSDF), `music/`, `hooks/`, `components/` (React), `Practice.tsx` e `status.ts` (fonte única da paleta de feedback verde/laranja/vermelho/ciano + `historyBarColor`/`holeFill`). |
| `src/music/` | ABC → alturas e armadura (do conversor, testado). `transform.ts` faz os transforms de texto do ABC: `adjustDurations` (alongar/encurtar notas) e `removeSlurs` (tirar ligados). |
| `src/whistle/` | Tabela cromática de digitação, mapeamento e render SVG (testado). |
| `src/ui/alignedTab.ts`, `src/ui/export.ts` | Injeção alinhada dos diagramas + export SVG/PNG/PDF. |
| `src/styles/global.css` | Tema tin whistle (verde Feadóg + latão), mobile-first. |

### i18n

- 5 idiomas, **um arquivo por idioma** (`src/i18n/pt.ts`, `en.ts`, `es.ts`, `zh.ts`,
  `ja.ts`); os tipos (`Lang`, `Dict`, `Params`) moram em `src/i18n/types.ts` e o
  `i18n.tsx` só monta o provider. Strings dinâmicas com params são funções `(p) => ...`.
  **Ao adicionar UI, cubra as 5 línguas** (fallback en).
- Componentes chamam `useTranslate()` (ou `useI18n()` quando precisam do `lang` atual, ex.:
  formatar data por locale) e guardam em `const translate = useTranslate()` - nome inteiro,
  nunca `t`. O provider re-renderiza tudo ao trocar de idioma; `translate` é estável por
  idioma (memoizado), então serve como dependência de efeito. Os efeitos colaterais no
  `document` (`title`, `lang`) ficam num `useEffect([lang])`, não dentro do `useMemo` que
  monta o valor do contexto.
- Preferências em `localStorage`: `music-lab:lang` e `music-lab:tuner` (instrumento,
  afinação do whistle, lá de referência, tolerância e sistema de nomes das notas).
  (Não há mais `music-lab:theme` - o tema é sempre claro.) O metrônomo e o treino
  mantêm seus próprios namespaces de storage.

### Design (tin whistle Feadóg)

- Paleta: **verde** (`--accent`) + **latão** (`--brass`), tokens em `global.css`. A
  marca (`WhistleMark`) é um whistle: tubo verde + furos de latão.
- **Tema travado no claro.** `lockLightTheme()` (chamado no `main.tsx`) fixa
  `data-theme="light"`. Os tokens de `:root[data-theme="dark"]` continuam no
  `global.css` mas nunca são ativados - não reintroduza um toggle sem pedirem.
- **Mobile-first.** No celular a nav vira uma tab bar fixa embaixo. A pauta, a
  tablatura e o pentagrama ficam sempre num "papel" branco (fundo `#fff`) para as
  notas pretas e os diagramas continuarem legíveis.
- `.nav-tab` reseta `border-radius: 0` de propósito: sem isso ela herda o raio de 9px
  da regra global de `button` e o sublinhado verde da aba ativa curva nas pontas.
- **Espaçamento vem de cima, nunca de baixo.** Nada de `margin-bottom`/`padding-bottom` para
  separar de quem vem depois; use `margin-top`/`padding-top` (ou `gap` no container). O de
  cima não cuida do de baixo; o de baixo cuida do próprio espaço. Precisa de respiro no fim?
  Um `div` vazio com `margin-top`.
- **`padding` para crescer a área clicável** de botões e afins, `gap` para espaçar irmãos -
  em vez de empurrar com margem solta.
- **Sempre os tokens de `global.css`** (`--accent`, `--brass` etc.), não cor crua/hex
  espalhada pelo componente.

### Alinhamento do conversor (a parte delicada)

`alignedTab.ts` posiciona cada diagrama exatamente sob sua nota usando a geometria do
abcjs. Regras aprendidas na marra (não mude sem testar):

- Render **sem** `responsive: 'resize'` (senão `getCTM` devolve pixels-CSS e os
  diagramas comprimem à esquerda). Sempre `add_classes: true`.
- `%%staffsep` é prependado ao ABC para abrir espaço sob cada linha.
- Dimensione a SVG final pelo `getBBox` do conteúdo, não pelo viewBox.
- A ordem das notas do abcjs bate com a do parser porque ambos pulam grace notes e
  tratam acorde como um elemento.

### Transforms do conversor (alongar notas / remover ligados)

`src/music/transform.ts` reescreve o **texto** do ABC e o resultado alimenta tanto o
abcjs quanto o `parseAbc` - é o que mantém partitura e digitação em sincronia. Nunca
transforme só um dos dois lados.

- `adjustDurations(abc, delta)` soma `delta` **unidades** (a unidade é o `L:` do tune)
  à duração de cada nota e pausa. Com `L:1/8`, `E` (colcheia, meio tempo) em +1 vira
  `E2` (semínima, um tempo) - essa é a régua da feature. Frações viram fração
  (`A/2` +1 → `A3/2`); o acorde estica como bloco (`[CEG]` → `[CEG]2`), não nota a
  nota; delta negativo tem piso de meia unidade para nunca zerar uma nota.
- `removeSlurs(abc)` tira slurs `( )` e ties `-`, mas **preserva quiálteras** (`(3`).
- Ambos copiam verbatim: cabeçalhos, campos em linha (`[K:G]`, `w:`), comentários,
  acordes cifrados (`"Am"`), decorações (`!trill!`) e grace notes (`{}`).

### Transpose: o "bug" que não é bug

Recorrente: "transponho +1/+2 semitom e a nota não sai do lugar". Não é defeito -
`visualTranspose` (abcjs) e a digitação (`midi + transpose`) usam o mesmo valor e
estão em sincronia. São dois efeitos esperados:

- **Na pauta**: um semitom costuma cair na mesma linha, trocando só o acidental
  (C e C♯ dividem a posição). Verificado no modelo do abcjs para `B,`: posição
  −1 (vt 0) → 0 (vt +1) → 0 (vt +2).
- **Na digitação**: notas fora da tessitura (ex.: `B,` num whistle de Ré) seguem
  fora ao subir 1–2 semitons, então o ✕ não muda. O `msg.outOfRange` avisa isso.

### Afinador (as regras que não se negocia)

O que está codificado aqui:

- **YIN, não FFT/HPS.** Whistle e flauta são quase senoidais: não há harmônico
  forte pro método espectral casar. Domínio do tempo ganha. Rodar HPS "como voto"
  **piora** - não é neutro.
- **A janela sai da nota mais grave: 3 períodos** (`analysisWindow`). É a régua do
  Praat. Não existe knob que compre responsividade abaixo disso - só lixo. Por
  isso a UI **mostra** a janela, não deixa arrastar.
- **Worklet burro / worker esperto.** O YIN não cabe nos ~2,7 ms do bloco de
  áudio. Sem SharedArrayBuffer: exigiria COOP/COEP e o **GitHub Pages não manda
  header**. Buffers viajam por `postMessage` com transferência e voltam pro pool.
- **Tudo em cents, nunca em Hz.** Vibrato é senoidal na escala log; a média
  aritmética em cents já é a geométrica em Hz.
- **Display contínuo ≠ evento de confirmação.** O traço pode tremer; o veredito
  não. Deadband assimétrico (entra na tolerância, sai no dobro) + dwell + latch.
- **O veredito é o centro.** Vibrato centrado no alvo é **acerto**. Testar o valor
  instantâneo ensina o músico a soprar torto pra agradar a tela - e o
  `VibratoTracker` exige **regularidade** justamente pra não elogiar instabilidade
  como se fosse vibrato.
- **±1 cent por microfone é mentira.** O ouvido resolve ~5–6¢ e a captação erra ao
  menos isso. `tuner.honesty` diz isso na cara do usuário.
- **A oitava fica na tela** ("D5", não "D"): o cromático calcula e joga fora, e é
  dessa informação descartada que sai o erro de afinar na oitava errada.
- **Nada de cor sozinha** (WCAG 1.4.1): o eixo vermelho-verde falha em ~1 em 12
  homens. Aqui o veredito é **posição** (dentro/fora da banda) + **forma**
  (✓ ▲ ▼) + texto. `aria-live="polite"` só em evento discreto - nunca a cada
  leitura.
- **Sopro aquece e sobe.** Whistle frio toca até 30¢ bemol; a faixa de busca
  alcança isso de propósito, pra poder mostrar o erro em vez de perder a nota.

### Metrônomo (timing)

Scheduler de lookahead (Chris Wilson, "A Tale of Two Clocks"): um timer grosso em Web
Worker (25 ms) agenda os clicks no relógio de amostras (`osc.start(time)`); o visual
usa uma fila drenada por `ctx.currentTime − outputLatency` dentro do rAF, pra o flash
bater com o som ouvido. O `core/` é puro e testado; a UI React só o embrulha.

## Convenções

- Português brasileiro na UI e nos comentários de domínio; nomes de arquivo/API em
  inglês, `kebab-case`/`camelCase`. Sem comentário-lixo nem verbosidade de IA - antes de
  comentar, veja se um nome melhor, uma função extraída, uma `key` ou um early return já
  deixam a intenção óbvia.
- Mudou lógica do núcleo? Atualize/estenda os testes em `test/` e nos módulos. As duas
  Drowsy Maggie de `test/fixtures.ts` são as fixtures de integração canônicas.
- Antes de dar por pronto: `npm test` e `npm run build` limpos. E **não commite sem o
  usuário pedir.**

### Nomes, números e legibilidade (código novo)

- **Sem abreviação** em loops, callbacks, mocks e testes: `notes.map((note) => …)`, não
  `n`/`i`/`x`/`y`/`k`. Variável não usada num callback recebe prefixo `_`
  (`fingerings.forEach((_fingering, holeIndex) => …)`).
- **Nada de nome abreviado ou de uma letra que não seja termo técnico.** Escreva o nome
  inteiro: `const translate = useTranslate()` (nunca `const t = useT()`); `notationElement`,
  `tabElement` (nunca `notationEl`/`tabEl`/`el`/`EL`). **Termo técnico consagrado pode ficar
  abreviado, mas comentado na primeira ocorrência**: `rms` (root mean square), `tau` (τ, o lag
  do YIN), `cmndf`. **Unidade/sigla de domínio** (`hz`, `bpm`, `midi`, `svg`, `abc`) é
  permitida sem comentário.
- **`+= 1` / `-= 1`, nunca `++` / `--`.** O operador de incremento é proibido em código novo
  (mesmo em cabeçalho de `for`): `for (let index = 0; index < n; index += 1)`, `cursor += 1`,
  `depth -= 1`. Explícito no delta, sem pré/pós-incremento escondido.
- **Nada de `for` solto no topo do módulo.** Laço que monta uma tabela/constante mora numa
  função nomeada e exportável (testável), não no escopo do arquivo:
  `export function buildFingeringTable(): Fingering[] { … }` e depois
  `const TABLE = buildFingeringTable()` - não um `for (…) { TABLE[i] = … }` solto.
- **Condição positiva em booleano `is...`**: não negue para rodar o ramo principal
  (`!isInRange ? diagrama : undefined`); crie um nome positivo do domínio (`isOutOfRange`,
  `shouldShowFingering`, `canTranspose`).
- **Nada de número mágico inline - nem como argumento** (`clampBpm(value, 40, 240)`,
  `cents > 5`, `periods * 3`): extraia constante com unidade/intenção
  (`const CENTS_TOLERANCE = 5`, `const ANALYSIS_PERIODS = 3`; sufixos
  `*_BPM`/`*_HZ`/`*_MS`/`*_CENTS`), ou embrulhe num helper testável quando o número é regra
  de negócio: `isInTune(cents)`, `centsToRatio(cents)`. Universais (`0`, `1`, `-1`, `2` como
  divisor por metade) seguem inline.
- **Nada de array mágico** (`Array.from(new Array(6))`, `[1,2,3,4,6].map(…)`): nomeie o que
  representa (`const WHISTLE_HOLES = …`, `const SUBDIVISIONS = [1, 2, 3, 4]`).
- **Bloco com 2+ instruções sempre multilinha com `{}`.** Assim que surge um segundo `;` no
  mesmo escopo (handler JSX, `if`/`else`, `.map`/`.filter`, arrow), quebre em linhas; uma
  instrução só pode ficar inline.
- **String com conteúdo dinâmico: dinâmico entre aspas** -
  `` `Nota "${name}" fora da tessitura` ``, não `` `Nota ${name} fora…` ``. Facilita ver
  espaço extra ou caractere inválido no debug.
- **Jamais gere o caractere `—` (em dash)** em código, string ou comentário - use `-`.

### TypeScript e organização

- **Evite `any`**: prefira `unknown` + narrow, generics ou union. (`noUnusedLocals`/
  `noUnusedParameters` já quebram o build com sobra.)
- **Nada de cast permissivo para calar o `tsc`** (`as ComponentType<any>`, `as unknown as X`,
  interface local redeclarada por cima): vira lixo persistente e esconde bug real (prop
  faltando, prop inexistente). Se o `tsc` reclama, o erro é a mensagem que você queria -
  resolva-o.
- **Sem function overloads** (mesma função declarada 2+ vezes): prefira união `A | B` com
  discriminação por `typeof`/shape, ou duas funções com nomes distintos.
- **Evite IIFE** salvo recomendação da lib; prefira função externa e testável
  (`getFingeringLabel(...)`) a um `(() => …)()` embutido.
- **Evite barrel / arquivo só de re-export** (`index.ts` que só faz `export … from`): quem
  consome importa direto do arquivo dono.
- **Tamanho de arquivo (referência):** ~200-400 linhas confortável; ~500 já pede divisão;
  >1000 quase sempre é responsabilidade demais. Coesão importa mais que a contagem. (O repo
  já separa por módulo em `src/modules/…`; mantenha.)
- **Regex é superfície de risco:** previna ReDoS (nada de quantificador aninhado, `(a+)+`,
  `(.*)*`), ancore (`^`/`$`), limite repetição (`{0,N}`), seja específico (`[^\s]`, não `.*`).
  Nunca compile regex de input do usuário sem `escape`; aplique sobre entrada limitada;
  compile padrão fixo uma vez no escopo de módulo.

## React e componentes

- **Componente que cresce** (mais de ~1-2 props, ganha estado/efeitos, ou repete o shape) →
  extraia um type `<NomeDoComponente>Props` (ex.: `TunerDialProps`, `StaffProps`) e use na
  assinatura, no lugar de props inline.
- **Todo `<button>` que não submete formulário precisa de `type="button"` explícito** - o
  default do HTML é `submit`; dentro de um `<form>`, um botão sem `type` dispara o submit
  mesmo que o `onClick` só faça um toggle local.
- **Return antecipado no lugar de `open && (...)`**: `if (!open) { return null; }` e siga com
  o JSX real.
- **Ternário aninhado para classe/valor → função pura com early return**, uma por eixo visual
  (cor, borda, texto), nome descrevendo o retorno, sem `else`.
- **`key` é identidade estável de item** (`song.id`), nunca índice - salvo lista 100%
  estática. **Não** use `key` que muda com o estado (`key={view}`, `key={isLoading ? 'a' : 'b'}`)
  só para forçar remount e reanimar: joga fora nó/estado/foco/scroll que o React reusaria. A
  `key` casa itens entre renders, não retriggera animação CSS.
- **Animação de entrada mora no próprio elemento**, com a `key` estável dele (ou sem `key`,
  num ramo condicional). Toca quando o elemento **monta de verdade** (item novo, subárvore
  condicional montando), não a cada flip de estado.
- **Imagens/SVG são superfície de risco.** O app gera e exporta SVG (abcjs, PNG/PDF): cuidado
  com injeção de SVG/XML, conteúdo malicioso e imagens gigantes ao renderizar ou exportar.

### useEffect - a regra de ouro

> **Não chame `useEffect` direto num componente. E prefira não usar `useMountEffect`.**
> Cada efeito esconde controle de fluxo. Use as outras ferramentas primeiro: estado
> derivado (cálculo na render), o próprio event handler, `key` para resetar,
> inicialização lazy do `useState` e `useSyncExternalStore` para assinar store externo.

| Cenário | Evite (❌) | Use (✅) |
| :--- | :--- | :--- |
| **Estado derivado** | `useEffect` + `setState` | cálculo inline durante a renderização |
| **Ajuste ao mudar prop** | `useEffect` comparando valor | comparar com ref na render e `setState` condicional ("storing previous value") |
| **Ação do usuário** | `useEffect` reagindo a flag | lógica direta no `onClick`/`onSubmit`/setter |
| **Persistir preferência** | `useEffect(() => save(x), [x])` | `save(next)` dentro do handler que muda `x` |
| **Ler canal de hand-off na montagem** | `useMountEffect` lendo o canal | `useState(() => takePending() ?? default)` (init lazy) |
| **Assinar store externo (hash, media query)** | `useMountEffect` + listener | `useSyncExternalStore(subscribe, getSnapshot)` |
| **Reset de componente** | efeito limpando 5 estados | `key` no pai para remontar limpo |

- **Estado derivado:** valor que sai das props/estado, calcule na render
  (`const cents = frequencyToCents(frequency, target)`), não num efeito que faz `setState`
  (renderiza duas vezes com dado defasado).
- **Evento vs. efeito:** transformar evento em mudança de estado só para um efeito detectar
  depois cria fluxo indireto difícil de depurar; ponha a lógica no handler (o metrônomo
  persiste no próprio setter; o afinador reconfigura o estabilizador no `setSettings`).
- **`useSyncExternalStore` no lugar de assinar por efeito:** o `useHashRoute` deriva a rota
  do `location.hash` assim - o `hashchange` propaga sozinho, sem `useMountEffect`.
- **`key` para resetar:** trocar a identidade (`<Practice key={songId} songId={songId} />`)
  descarta o estado interno inteiro, em vez de um efeito limpando campo a campo.
- **Quando um efeito é inevitável:** só para sincronizar com um sistema externo que não cabe
  em nenhum dos padrões acima - loop de `requestAnimationFrame`, `ResizeObserver`, `setInterval`,
  render imperativo do abcjs no DOM, ciclo de vida de `AudioContext`/motor, teardown na
  desmontagem. Aí sim um `useEffect`/`useMountEffect` nomeado e com cleanup. Não force esses
  para fora com gambiarra; force para fora tudo o que **não** é sistema externo.
- **Cheiros:** setar estado logo após ler outro (é derivado); `if` checando flag que você
  acabou de setar (é event handler); efeito sem cleanup lidando com dado externo (risco de
  leak).

## Testes (Vitest)

- **Colocados junto do arquivo testado** (mesma pasta), como o padrão do repo. As
  fixtures antigas em `test/` seguem valendo (`test/fixtures.ts`, testes puros herdados).
- **Comportamento, não implementação:** alcance elementos por papel/label (`getByRole`,
  `getByLabelText`; `getByTestId` é último recurso) e simule interação real; o teste só quebra
  quando o comportamento observável quebra, não num refactor interno. Componentes usam
  `@testing-library/react` (`render`/`screen`) e `@testing-library/user-event`; quando um
  componente monta um sistema externo (abcjs, AudioContext), faça `vi.mock` dele e teste o
  estado derivado/o fluxo, não o desenho.
- **Asserte o valor, não a existência:** `expect(windowPeriods).toBe(ANALYSIS_PERIODS)`, não
  `toBeGreaterThan(0)`; `toHaveTextContent('D5')`, não só `toBeInTheDocument()`.
- **Pense no mutante:** se inverter um `if`, trocar `>` por `>=` ou retornar o default não
  quebra nenhum teste, o teste é decoração. Teste a **fronteira** (5¢ → dentro, 6¢ → fora
  pega o `<=`/`<`).
- **Sem número mágico em teste:** importe a constante real do arquivo testado (exporte-a se
  preciso) em vez de chumbar o literal.
- **Cubra o caminho de erro**, não só o happy path.
- **Um cenário por teste, nome descritivo** em uma frase. Sem `if`/`for` no corpo - use
  `it.each`/`test.each`.
- **Data absoluta + janela relativa congela o relógio** (`vi.useFakeTimers()` +
  `vi.setSystemTime(new Date('2026-…'))`), ou - melhor - **passe `now` como parâmetro** quando
  a função aceitar (`pruneTrace(samples, now)`); senão a fixture "envelhece" e o teste falha
  sozinho no futuro. Nunca dependa de `Date.now()`/`Math.random()` reais para o valor esperado.
- **Sem bloco de comentário no topo de arquivo de teste** resumindo a suíte - envelhece e
  ninguém atualiza; o nome do teste fala por si.

## Deploy

Push na `main` dispara o workflow (testa → builda → publica `dist/` no Pages). No
GitHub, habilite **Settings → Pages → Source: GitHub Actions**. O `base: "/music-lab/"`
do Vite precisa casar com `/<repo>/` no Pages.

## Histórico e docs

- **`CHANGELOG.md`** - registro completo da versão 2.0 (rename, migração vanilla→React,
  absorção do metrônomo e do treino, launcher, i18n, design). Comece por aí para
  entender de onde cada módulo veio.
- **`README.md`** - visão geral, screenshots (`docs/img/`) e como rodar.
- **Origens dos módulos**: o Conversor é a base deste repo (ex-*Whistle ABC*); o
  Metrônomo veio do app *MusicStudio*; o Treino veio do *Perfect Partituras*. Os cores
  puros de cada um foram preservados; só a camada de UI foi reescrita/adaptada em React.
- **Limitação conhecida**: os rótulos de nota no **Treino** ainda usam solfejo (Dó,
  Ré…) em todos os idiomas - traduzir para letras/kanji exigiria mexer no core de
  detecção. O **Afinador** não tem esse problema: `core/cents.ts` gera o nome nos
  dois sistemas e a escolha é do usuário (`tuner.naming.*`).
