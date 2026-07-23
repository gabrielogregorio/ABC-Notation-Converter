/**
 * Editor de música por JSON. Cola/edita o JSON, valida em tempo real e salva
 * na biblioteca. Mostra o formato esperado como template.
 */
import { useState } from 'react';
import { validateSongJSON, type SongJSON } from '../music/song';
import { useTranslate } from '../../../i18n/i18n';

const TEMPLATE = `{
  "id": "minha-musica",
  "title": "Minha Música",
  "instrument": "tin-whistle",
  "whistleKey": "D",
  "tempo": 90,
  "timeSignature": [4, 4],
  "toleranceCents": 30,
  "notes": [
    { "note": "D5", "beats": 1, "lyric": "lá" },
    { "note": "F#5", "beats": 1 },
    { "note": "A5", "beats": 2 },
    { "note": "rest", "beats": 1 }
  ]
}`;

interface SongEditorProps {
  initial?: SongJSON;
  onSave: (song: SongJSON) => void;
  onCancel: () => void;
}

export function SongEditor({ initial, onSave, onCancel }: SongEditorProps) {
  const translate = useTranslate();
  const [text, setText] = useState(() => (initial ? JSON.stringify(initial, null, 2) : TEMPLATE));
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const { song, error: err } = validateSongJSON(text);
    if (err || !song) {
      setError(err ?? translate('editor.invalid'));
      return;
    }
    onSave(song);
  };

  return (
    <div className="editor">
      <div className="editor-head">
        <h3>{initial ? translate('editor.title') : translate('editor.newTitle')}</h3>
        <p className="dim">{translate('editor.hint')}</p>
      </div>
      <textarea
        className="editor-textarea"
        value={text}
        spellCheck={false}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
      />
      {error && <div className="editor-error">{error}</div>}
      <div className="editor-actions">
        <button type="button" className="btn" onClick={onCancel}>
          {translate('editor.cancel')}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          {translate('editor.saveLib')}
        </button>
      </div>
    </div>
  );
}
