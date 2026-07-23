import { useEffect, useMemo, useRef, useState } from "react";
import abcjs from "abcjs";
import { parseAbc, type WarningCode } from "../../music/abcParser";
import { adjustDurations, removeSlurs } from "../../music/transform";
import { buildTab, whistleById, WHISTLES, DEFAULT_WHISTLE } from "../../whistle/whistles";
import { renderTabSvg } from "../../whistle/tabSvg";
import { injectAlignedFingerings } from "../../ui/alignedTab";
import { buildCombinedSvg, downloadPdf, downloadPng, downloadSvg, type PaperSize } from "../../ui/export";
import { takePendingAbc } from "../../app/router";
import { useTranslate, type TranslateFn } from "../../i18n/i18n";

const WARN_KEY: Record<WarningCode, string> = {
  "stray-accidental": "warn.strayAccidental",
  "unknown-symbol": "warn.unknownSymbol",
};

type Msg = { kind: "warn" | "info"; text: string };

const SEMITONES_PER_OCTAVE = 12;
// Espaço extra (px) aberto sob cada linha para a tablatura caber; soma à altura
// do diagrama do instrumento.
const STAFFSEP_EXTRA_PX = 46;
const STAFF_WIDTH_PX = 940;
const STAFF_PADDING_PX = 4;
const MIN_TAB_COLUMNS = 6;
const FALLBACK_TAB_WIDTH_PX = 560;

function transposeOptions(translate: TranslateFn): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [
    { value: 2 * SEMITONES_PER_OCTAVE, label: translate("transpose.up2oct") },
    { value: SEMITONES_PER_OCTAVE, label: translate("transpose.up1oct") },
  ];
  for (let semitone = SEMITONES_PER_OCTAVE - 1; semitone >= 1; semitone -= 1) {
    out.push({ value: semitone, label: translate("transpose.upSemi", { n: semitone }) });
  }
  out.push({ value: 0, label: translate("transpose.none") });
  for (let semitone = 1; semitone <= SEMITONES_PER_OCTAVE - 1; semitone += 1) {
    out.push({ value: -semitone, label: translate("transpose.downSemi", { n: semitone }) });
  }
  out.push(
    { value: -SEMITONES_PER_OCTAVE, label: translate("transpose.down1oct") },
    { value: -2 * SEMITONES_PER_OCTAVE, label: translate("transpose.down2oct") },
  );
  return out;
}

// How many unit-lengths to add to every note/rest. Lengthening (and evening out)
// the notes turns a busy tune into a calmer one; a single "-1" trims instead.
function tempoOptions(translate: TranslateFn): { value: number; label: string }[] {
  return [
    { value: 0, label: translate("tempo.none") },
    { value: 1, label: translate("tempo.plus", { n: 1 }) },
    { value: 2, label: translate("tempo.plus", { n: 2 }) },
    { value: 4, label: translate("tempo.plus", { n: 4 }) },
    { value: 5, label: translate("tempo.plus", { n: 5 }) },
    { value: -1, label: translate("tempo.minus", { n: 1 }) },
  ];
}

export function Converter() {
  const translate = useTranslate();
  // Uma música entregue pelo launcher é lida na inicialização do estado (lazy),
  // não num efeito de montagem: o canal de hand-off é consumido uma única vez.
  const [abc, setAbc] = useState(() => takePendingAbc() ?? "");
  const [whistle, setWhistle] = useState(DEFAULT_WHISTLE);
  const [transpose, setTranspose] = useState(0);
  const [tempo, setTempo] = useState(0);
  const [removeLegato, setRemoveLegato] = useState(false);
  const [paper, setPaper] = useState<PaperSize>("a4");
  const [showTab, setShowTab] = useState(true);
  // alignMismatch e exportError vêm de operações imperativas (render do abcjs,
  // download) - não são deriváveis na renderização, então continuam em estado.
  const [alignMismatch, setAlignMismatch] = useState(false);
  const [exportError, setExportError] = useState<Msg | null>(null);

  const notationRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const tabSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Tudo que sai puro do texto e das opções é estado DERIVADO: calculado na
  // renderização (useMemo), não empurrado por um efeito com setState. Os
  // transforms de "acalmar a música" rodam aqui, antes de qualquer leitura, pra
  // partitura e dedilhado ficarem em sincronia.
  const derived = useMemo(() => {
    let processed = abc;
    if (removeLegato) processed = removeSlurs(processed);
    processed = adjustDurations(processed, tempo);

    const instrument = whistleById(whistle);
    const parsed = parseAbc(processed);
    const shifted = parsed.notes.map((note) => ({ ...note, midi: note.midi + transpose }));
    const { columns } = buildTab(shifted, instrument);

    const messages: Msg[] = [];
    for (const warning of parsed.warnings) {
      messages.push({
        kind: "warn",
        text: translate("msg.notUnderstood", { token: warning.token, reason: translate(WARN_KEY[warning.code]) }),
      });
    }
    if (columns.some((column) => column.playable && column.fingering.awkward)) {
      messages.push({ kind: "info", text: translate("msg.awkward") });
    }
    // Notas fora das duas oitavas do whistle ganham ✕ e nenhum dedilhado; avisa
    // o usuário pra um diagrama silencioso e imutável não confundir.
    const outOfRange = columns.filter((column) => !column.playable);
    if (outOfRange.length > 0) {
      const names = Array.from(
        new Set(outOfRange.map((column) => `${column.name} (${column.solfege})`)),
      ).join(", ");
      messages.push({ kind: "info", text: translate("msg.outOfRange", { whistle: instrument.label, notes: names }) });
    }

    return {
      processed,
      instrument,
      columns,
      title: parsed.title || translate("output.default"),
      baseMessages: messages,
      showExports: !!processed.trim(),
    };
  }, [abc, whistle, transpose, tempo, removeLegato, translate]);

  const { processed, instrument, columns, title, baseMessages, showExports } = derived;

  // Só o pipeline imperativo mora num efeito: o abcjs escreve o SVG no div e nós
  // injetamos os diagramas. O único resultado não-derivável - o alinhamento não
  // casou? - volta como estado.
  useEffect(() => {
    const notationElement = notationRef.current;
    const tabElement = tabRef.current;
    if (!notationElement || !tabElement) return;

    notationElement.innerHTML = "";
    tabElement.innerHTML = "";
    tabElement.hidden = true;
    tabSizeRef.current = null;
    setExportError(null);
    let mismatch = false;

    if (processed.trim()) {
      const staffsep = instrument.layout.height + STAFFSEP_EXTRA_PX;
      const source = showTab ? `%%staffsep ${staffsep}\n${processed}` : processed;
      try {
        abcjs.renderAbc(notationElement, source, {
          visualTranspose: transpose,
          add_classes: true,
          staffwidth: STAFF_WIDTH_PX,
          paddingtop: STAFF_PADDING_PX,
          paddingbottom: STAFF_PADDING_PX,
        });
        const svg = notationElement.querySelector("svg");
        if (svg && showTab && columns.length > 0) {
          const result = injectAlignedFingerings(svg, columns, instrument.layout);
          mismatch = result.placed < result.total;
        }
      } catch {
        notationElement.innerHTML = `<p class="render-error">${escapeHtml(translate("msg.renderError"))}</p>`;
        if (showTab && columns.length > 0) {
          const columnsPerRow = Math.max(
            MIN_TAB_COLUMNS,
            Math.floor(FALLBACK_TAB_WIDTH_PX / instrument.layout.width),
          );
          const rendered = renderTabSvg(columns, { columnsPerRow, layout: instrument.layout });
          tabElement.innerHTML = rendered.svg;
          tabElement.hidden = false;
          tabSizeRef.current = { width: rendered.width, height: rendered.height };
        }
      }
    }
    setAlignMismatch(mismatch);
  }, [processed, instrument, columns, showTab, transpose, translate]);

  const messages: Msg[] = [
    ...baseMessages,
    ...(alignMismatch ? [{ kind: "info" as const, text: translate("msg.alignMismatch") }] : []),
    ...(exportError ? [exportError] : []),
  ];

  const handleExport = async (format: "svg" | "png" | "pdf") => {
    const notationSvg = notationRef.current?.querySelector("svg") ?? null;
    const tabElement = tabRef.current;
    const tabSvg = tabElement && !tabElement.hidden ? tabElement.querySelector("svg")?.outerHTML ?? null : null;
    const { svg, size } = buildCombinedSvg({
      notationSvg,
      tabSvg,
      tabSize: tabSvg ? tabSizeRef.current : null,
    });
    const base = (title || "whistle").trim().replace(/[^\w\-]+/g, "-").toLowerCase();
    try {
      if (format === "svg") downloadSvg(svg, `${base}.svg`);
      else if (format === "png") await downloadPng(svg, size, `${base}.png`);
      else await downloadPdf(svg, size, `${base}.pdf`, paper);
    } catch (err) {
      setExportError({
        kind: "warn",
        text: translate("msg.exportFail", {
          fmt: format.toUpperCase(),
          err: err instanceof Error ? err.message : String(err),
        }),
      });
    }
  };

  return (
    <div className="converter">
      <section className="panel input-panel">
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
          noValidate
        >
          <label className="field field-abc">
            <span className="field-label">{translate("label.abc")}</span>
            <textarea
              value={abc}
              onChange={(event) => setAbc(event.target.value)}
              spellCheck={false}
              rows={14}
              placeholder={translate("placeholder.abc")}
            />
            <small className="hint">{translate("hint.abc")}</small>
          </label>

          <div className="row">
            <label className="field">
              <span className="field-label">{translate("label.whistle")}</span>
              <select value={whistle} onChange={(event) => setWhistle(event.target.value)}>
                {WHISTLES.map((whistleOption) => (
                  <option key={whistleOption.id} value={whistleOption.id}>
                    {whistleOption.label}
                    {whistleOption.id === DEFAULT_WHISTLE ? translate("whistle.mostCommon") : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">{translate("label.transpose")}</span>
              <select value={transpose} onChange={(event) => setTranspose(Number(event.target.value))}>
                {transposeOptions(translate).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span className="field-label">{translate("label.tempo")}</span>
              <select value={tempo} onChange={(event) => setTempo(Number(event.target.value))}>
                {tempoOptions(translate).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">{translate("label.paper")}</span>
              <select value={paper} onChange={(event) => setPaper(event.target.value as PaperSize)}>
                <option value="a4">A4</option>
                <option value="letter">{translate("paper.letter")}</option>
              </select>
            </label>
          </div>

          <div className="field toggles">
            <label className="check">
              <input type="checkbox" checked={showTab} onChange={(event) => setShowTab(event.target.checked)} />
              <span>{translate("toggle.tab")}</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={removeLegato}
                onChange={(event) => setRemoveLegato(event.target.checked)}
              />
              <span>{translate("toggle.removeLegato")}</span>
            </label>
          </div>
        </form>
      </section>

      <section className="panel output-panel" aria-live="polite">
        {messages.length > 0 && (
          <div className="messages">
            {messages.map((message) => (
              <p key={`${message.kind}:${message.text}`} className={`msg msg-${message.kind}`}>
                <span className="msg-tag">{translate(message.kind === "warn" ? "msg.tag.warn" : "msg.tag.info")}</span>
                {message.text}
              </p>
            ))}
          </div>
        )}

        <div className="output-head">
          <h2>{title}</h2>
          {showExports && (
            <div className="exports">
              <button type="button" onClick={() => handleExport("svg")}>
                SVG
              </button>
              <button type="button" onClick={() => handleExport("png")}>
                PNG
              </button>
              <button type="button" onClick={() => handleExport("pdf")}>
                PDF
              </button>
            </div>
          )}
        </div>

        <div ref={notationRef} className="notation" />
        <div ref={tabRef} className="tab" />

        <section className="legend" aria-label="legend">
          <h3>{translate("legend.title")}</h3>
          <ul>
            <li>
              <strong>●</strong> <span>{translate("legend.closed")}</span>
            </li>
            <li>
              <strong>○</strong> <span>{translate("legend.open")}</span>
            </li>
            <li>
              <strong>◑</strong> <span>{translate("legend.half")}</span>
            </li>
            <li>{translate("legend.octave")}</li>
            <li>
              <span className="star">*</span> <span>{translate("legend.star")}</span>
            </li>
            <li>
              <span className="xmark">✕</span> <span>{translate("legend.xmark")}</span>
            </li>
          </ul>
        </section>
      </section>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
