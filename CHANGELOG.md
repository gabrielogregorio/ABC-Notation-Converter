# Changelog

## 2.2.0 - Afinador

Quarta ferramenta do laboratório, em `#/tuner`. Nasceu aqui (as outras duas foram
absorvidas de apps irmãos), a partir da pesquisa acumulada na wiki do Codex sobre
afinadores web - DSP, captura, produto e acessibilidade.

### A tese

Afinador de mercado trata oscilação como erro: a agulha treme, o músico obedece.
Só que um sopro **varre dezenas de cents por ciclo de vibrato**, e o que o ouvido
julga é a **média**, não o instante. Testar o valor instantâneo reprova quem está
certo - e pior, ensina o músico a corrigir o sopro para agradar a tela.

Aqui o veredito olha o **centro**, e o gesto vira medida: um vibrato de ±40 ¢
centrado no alvo aparece como **afinado**, com "centro −3 ¢ · ±39 ¢ a 6,0 Hz" ao
lado. `VibratoTracker` exige **regularidade** para chamar de vibrato - oscilação
sem período é falta de controle, e as duas coisas não podem receber o mesmo elogio.

### DSP

- **YIN** (`core/yin.ts`): difference function → CMNDF → primeiro mínimo abaixo do
  limiar (não o global, que cai em subharmônico) → interpolação parabólica. Sai
  abaixo de um cent num tom puro. Nada de FFT/HPS: whistle e flauta são quase
  senoidais e não têm harmônico forte para um método espectral casar.
- **A janela sai da nota mais grave: 3 períodos** (`analysisWindow`), a régua do
  Praat. Escolher o instrumento é escolher a latência: ~7 ms num whistle em Ré,
  ~62 ms no cromático. A UI **mostra** a janela e a resposta - nenhum afinador de
  mercado publica tempo de resposta, só precisão em cents.
- **Faixa de busca por preset**: é a defesa mais barata contra erro de oitava, e
  alcança de propósito o whistle frio (que toca até 30 ¢ bemol) para poder mostrar
  o erro em vez de perder a nota.
- **Estabilização** (`core/stability.ts`): tudo em cents/MIDI, nunca em Hz (vibrato
  é senoidal na escala log, e a média aritmética em cents já é a geométrica em Hz).
  Mediana mata salto de oitava; média exponencial de ~140 ms imita a integração do
  próprio ouvido; histerese impede a nota de piscar na fronteira; e o veredito tem
  deadband assimétrico + dwell + latch, porque display contínuo e evento de
  confirmação são coisas diferentes.

### Arquitetura

- **Worklet burro / worker esperto**: o AudioWorklet só acumula e posta a janela; o
  YIN roda num Worker. O YIN não cabe nos ~2,7 ms do bloco de áudio, e um frame
  atrasado é melhor que um glitch. Buffers vão e voltam por transferência, de um
  pool pré-alocado - nada é alocado no caminho quente.
- **Sem SharedArrayBuffer**: exigiria COOP/COEP e o GitHub Pages não deixa mandar
  header. O worklet vai como Blob, sem depender de como o bundler resolve URL sob o
  `base` do Pages.
- **O pitch não passa pelo React**: chega a 80 Hz, entra num ref e o canvas lê no
  rAF. Só o texto sobe para o state, a 10 Hz.

### UI e honestidade

- **Fita de história em cents**, em canvas de duas camadas: vibrato vira onda,
  deriva de sopro vira rampa, desafinação vira linha deslocada. O traço desbota com
  a clareza do detector - no ataque ele sabe que está inseguro, e mostrar isso com
  peso cheio pareceria erro do músico.
- **A oitava fica na tela** ("D5", não "D"). O cromático calcula e joga fora, e é
  dessa informação descartada que sai o erro de afinar na oitava errada.
- **Nada de cor sozinha** (WCAG 1.4.1 - o eixo vermelho-verde falha em ~1 em 12
  homens): o veredito é posição + forma (✓ ▲ ▼) + texto. Uma `aria-live="polite"`
  só em evento discreto (mudou de nota, afinou) - falar a cada leitura viraria ruído
  e poluiria o próprio sinal do microfone.
- **"Sem sinal" em vez de um número errado com confiança**; aviso quando o navegador
  se recusa a desligar AGC/supressão de ruído; e o app diz na cara que **±1 cent por
  microfone é falso rigor** - o ouvido resolve ~5–6 ¢ e a captação erra ao menos isso.
- Presets (whistle nas 12 afinações, flauta doce, transversal, ocarina, cromático),
  lá calibrável 415–466 Hz, tolerância ajustável, e nome da nota em letras **ou**
  solfejo - o que resolve, no afinador, a limitação que o Treino ainda tem.

### Testes

- 181 testes (eram 131). Os 50 novos cobrem o core: precisão sub-cent, resistência a
  erro de oitava, fundamental ausente, silêncio e ruído; dwell/latch/histerese;
  vibrato (mede taxa/extensão/centro, e **recusa** oscilação irregular, deriva lenta
  e trêmulo rápido); e a matemática de cents e calibração.
- Verificado ponta a ponta no Chromium com WAV sintético como microfone falso
  (`--use-file-for-fake-audio-capture`): D5 puro → "D5 ±0 ¢, afinado"; D5 com
  vibrato de ±40 ¢ centrado → **afinado**, "centro −3 ¢ · ±39 ¢ a 6,0 Hz"; o mesmo
  vibrato 25 ¢ bemol → reprovado **pelo centro**; whistle frio → "−30 ¢".

---

## 2.1.0 - Conversor mais calmo, tema travado no claro

### Conversor: alongar notas e remover ligados

- Novo **Alongar notas**: soma tempos à duração de cada nota/pausa (+1, +2, +4, +5
  ou −1) para transformar um tune agitado em algo mais calmo. A régua: com `L:1/8`
  uma colcheia (meio tempo) em +1 vira uma semínima (um tempo).
- Novo **Remover ligados (ligaduras)**: tira slurs `( )` e ties `-`, preservando
  marcadores de quiáltera (`(3`).
- Ambos vivem em `src/music/transform.ts` (`adjustDurations`, `removeSlurs`), como
  transforms de **texto** do ABC aplicados antes do abcjs *e* do parser - assim a
  partitura e a digitação nunca saem de sincronia. Frações, acordes, cabeçalhos,
  campos em linha, decorações e grace notes tratados. 15 testes novos
  (`test/transform.test.ts`); a suíte foi de 116 → **131**.

### Conversor: aviso de fora de alcance

- O `buildTab` já calculava as notas fora da tessitura, mas o `Converter` descartava
  esse resultado e o usuário só via um ✕ mudo. Agora há uma mensagem (`msg.outOfRange`,
  nos 5 idiomas) nomeando as notas e sugerindo transpor ou trocar a afinação.
- Revisão do transpose no mesmo caso ("si de baixo não se move ao subir 1–2 semitons"):
  **não é bug**. Detalhes em `CLAUDE.md` → "Transpose: o 'bug' que não é bug".

### Tema travado no claro

- O app agora é **sempre claro**. `src/app/theme.ts` deixou de exportar `useTheme` e
  passou a expor `lockLightTheme()`, chamado no `main.tsx` antes do primeiro paint.
- Removido o botão de alternar tema do `TopBar` (sobraram só os idiomas) e a chave
  `music-lab:theme` do `localStorage`. Os tokens `:root[data-theme="dark"]` continuam
  no `global.css`, apenas nunca são ativados.

### Design

- `.nav-tab` agora reseta `border-radius: 0`: sem isso ela herdava o raio de 9px da
  regra global de `button` e o sublinhado verde da aba ativa curvava nas pontas.
  Agora a borda inferior é uma linha reta.

---

## 2.0.0 - Music Lab

Reorganização grande: o **Whistle ABC** (conversor ABC → digitação de tin whistle)
virou **Music Lab**, um laboratório com três ferramentas, e absorveu dois apps
irmãos. Tudo continua rodando 100% no navegador, sem backend.

### Renomeação

- Projeto renomeado de **Whistle ABC / ABC Notation Converter** para **Music Lab**.
- `package.json` → `name: "music-lab"`, `version: 2.0.0`.
- Vite `base: "/music-lab/"` → `"/music-lab/"` (o deploy aponta para o
  novo caminho; o repositório é renomeado no GitHub pelo dono).
- Título, favicon, `README.md` e `CLAUDE.md` atualizados.

### Migração de stack: vanilla TS → React 19

- O app era Vite + TypeScript **vanilla**. Foi migrado para **React 19 + TypeScript**
  para unificar os três apps sob o mesmo paradigma (o Treino já era React).
- `index.html` agora monta `#root` via `src/main.tsx`; a UI virou componentes React.
- `tsconfig` ganhou `jsx: react-jsx`; `vite.config` ganhou `@vitejs/plugin-react` e
  `environment: jsdom` no Vitest.
- Dependências adicionadas: `react`, `react-dom`, `@vitejs/plugin-react`,
  `@types/react`, `@types/react-dom`, `jsdom`.

### Novos módulos (cada um com URL própria)

Roteamento por **hash** (`#/…`), que funciona no GitHub Pages estático sem reescrita
de servidor:

- `#/` - **Launcher**: a home é um input inteligente. Cola ABC → abre o Conversor
  com o tune; escreve um tempo ("120 bpm") → abre o Metrônomo; senão filtra as
  ferramentas por palavra-chave. Heurísticas puras e testadas em `src/app/detect.ts`
  (`looksLikeAbc`, `detectTempo`, `scoreMatch`).
- `#/converter` - **Conversor ABC**: a UI original reescrita em React, reusando os
  cores testados (`src/music`, `src/whistle`, `src/ui/alignedTab`, `src/ui/export`).
- `#/metronome` - **Metrônomo**, absorvido do app *MusicStudio*. O `core/` puro
  (scheduler, clicks, tapTempo, pendulum, prefs, metronome, timerWorker) foi copiado
  intacto e a UI reescrita em React com loop rAF para o pêndulo/luzes.
- `#/practice` - **Treino** de afinação por microfone, absorvido do app
  *Perfect Partituras*. Cores (pitch NSDF, notes, song, fingerings), hooks e
  componentes copiados; a UI adaptada ao shell e traduzida.

### Internacionalização

- Sistema i18n reescrito como contexto React (`I18nProvider`, `useT`, `useI18n`),
  mantendo os 5 idiomas (pt/en/es/zh/ja) com fallback en.
- As traduções já existentes do conversor foram preservadas verbatim; **todas** as
  strings novas (shell, launcher, metrônomo, treino) foram traduzidas nos 5 idiomas.
- Storage: `whistle-abc:*` → `music-lab:lang` / `music-lab:theme`.

### Design

- Novo tema **tin whistle Feadóg**: verde (`--accent`) + latão (`--brass`), com
  tokens para claro e escuro em `src/styles/global.css`.
- Marca SVG (`WhistleMark`): um whistle com tubo verde e furos de latão.
- **Mobile-first**: no celular a navegação vira uma *tab bar* fixa embaixo. A pauta,
  a tablatura e o pentagrama ficam sempre num "papel" branco nos dois temas.

### Testes

- 116 testes passando (Vitest), incluindo a nova suíte `test/detect.test.ts` para a
  lógica do launcher. As fixtures Drowsy Maggie continuam sendo a referência de
  integração do conversor.

### Correções de bala perdida

- O diretório local do projeto tinha um caractere de nova linha no fim do nome
  (`music-lab\n`), que quebrava `cd`. Renomeado para o nome limpo.

---

## 1.x - Whistle ABC

Conversor de notação ABC em partitura com a digitação de tin whistle alinhada sob
cada nota, em Ré/Dó e outras afinações, com export SVG/PNG/PDF. Vanilla TS + Vite,
abcjs, jsPDF. 5 idiomas e tema claro/escuro.
