import { useCallback, useRef, useState } from 'react';
import {
  applyStyle,
  formatAsBullets,
  isMostlyStyle,
  toPlain,
  toggleUnderline,
  BULLET_STYLES,
  type BulletId,
  type TextStyle,
} from './lib/unicode';
import './App.css';

const SAMPLE = `Excited to share something new! 🚀

Key takeaways from this week:
• Built faster workflows
• Learned from every mistake
• Stayed consistent

What's one win you're celebrating today?`;

export default function App() {
  const [text, setText] = useState(SAMPLE);
  const [copied, setCopied] = useState(false);
  const [bulletId, setBulletId] = useState<BulletId>('dot');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const getSelection = useCallback(() => {
    const el = taRef.current;
    if (!el) return null;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return null;
    return { start, end, selected: text.slice(start, end) };
  }, [text]);

  const replaceSelection = useCallback(
    (next: string) => {
      const el = taRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const before = text.slice(0, start);
      const after = text.slice(end);
      const updated = before + next + after;
      setText(updated);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start, start + next.length);
      });
    },
    [text]
  );

  const applyToSelection = useCallback(
    (style: TextStyle, underline = false) => {
      const sel = getSelection();
      if (!sel) {
        // No selection: style whole text or show hint via nothing
        return;
      }
      let next: string;
      if (style === 'normal') {
        next = toPlain(sel.selected);
      } else if (isMostlyStyle(sel.selected, style) && !underline) {
        // Toggle off → plain
        next = toPlain(sel.selected);
      } else {
        next = applyStyle(sel.selected, style, underline);
      }
      replaceSelection(next);
    },
    [getSelection, replaceSelection]
  );

  const handleUnderline = useCallback(() => {
    const sel = getSelection();
    if (!sel) return;
    replaceSelection(toggleUnderline(sel.selected));
  }, [getSelection, replaceSelection]);

  const handleBoldItalic = useCallback(() => {
    applyToSelection('boldItalic');
  }, [applyToSelection]);

  const handleBullets = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    // Expand to full lines if selection, else current line / all non-empty
    let lineStart = start;
    let lineEnd = end;
    if (start === end) {
      // Current line
      lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const nextNl = text.indexOf('\n', end);
      lineEnd = nextNl === -1 ? text.length : nextNl;
    } else {
      lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const nextNl = text.indexOf('\n', end - (end > 0 && text[end - 1] === '\n' ? 1 : 0));
      lineEnd = nextNl === -1 ? text.length : nextNl;
      // If user selected multi-line, use exact selection bounds expanded
      lineStart = text.lastIndexOf('\n', start - 1) + 1;
      if (end > 0 && text[end - 1] === '\n') {
        lineEnd = end - 1;
      } else {
        const n = text.indexOf('\n', end);
        lineEnd = n === -1 ? text.length : n;
      }
    }

    const block = text.slice(lineStart, lineEnd);
    const formatted = formatAsBullets(block, bulletId);
    const updated = text.slice(0, lineStart) + formatted + text.slice(lineEnd);
    setText(updated);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + formatted.length);
    });
  }, [text, bulletId]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = taRef.current;
      if (el) {
        el.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [text]);

  const handleClear = () => setText('');
  const handlePlain = () => setText(toPlain(text));

  const charCount = [...text].length;
  const linkedInLimit = 3000;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo" aria-hidden>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
            </svg>
          </div>
          <div>
            <h1>LinkedIn Text Formatter</h1>
            <p className="tagline">
              Bold, italic, underline &amp; bullets — paste-ready for LinkedIn
            </p>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="panel editor-panel">
          <div className="toolbar" role="toolbar" aria-label="Text formatting">
            <div className="tool-group">
              <button
                type="button"
                className="tool-btn"
                title="Bold (select text first)"
                onClick={() => applyToSelection('bold')}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className="tool-btn italic-btn"
                title="Italic (select text first)"
                onClick={() => applyToSelection('italic')}
              >
                <em>I</em>
              </button>
              <button
                type="button"
                className="tool-btn"
                title="Bold italic (select text first)"
                onClick={handleBoldItalic}
              >
                <strong>
                  <em>BI</em>
                </strong>
              </button>
              <button
                type="button"
                className="tool-btn"
                title="Underline (select text first)"
                onClick={handleUnderline}
              >
                <span className="underline-label">U</span>
              </button>
              <button
                type="button"
                className="tool-btn"
                title="Remove style from selection"
                onClick={() => applyToSelection('normal')}
              >
                T̲
              </button>
            </div>

            <div className="tool-divider" />

            <div className="tool-group bullet-group">
              <select
                className="bullet-select"
                value={bulletId}
                onChange={(e) => setBulletId(e.target.value as BulletId)}
                aria-label="Bullet style"
              >
                {BULLET_STYLES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="tool-btn primary-outline"
                title="Turn selected lines into bullets"
                onClick={handleBullets}
              >
                • List
              </button>
            </div>

            <div className="tool-divider" />

            <div className="tool-group">
              <button type="button" className="tool-btn ghost" onClick={handlePlain}>
                Strip styles
              </button>
              <button type="button" className="tool-btn ghost" onClick={handleClear}>
                Clear
              </button>
            </div>
          </div>

          <p className="hint">
            Select text, then click <strong>B</strong> / <em>I</em> / <strong>
              <em>BI</em>
            </strong>{' '}
            / <span className="underline-label">U</span>. LinkedIn doesn’t support real fonts —
            this uses special Unicode characters that look bold/italic when pasted.
          </p>

          <textarea
            ref={taRef}
            className="editor"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write or paste your LinkedIn post here…"
            spellCheck
            rows={14}
          />

          <div className="editor-footer">
            <span
              className={`char-count ${charCount > linkedInLimit ? 'over' : ''}`}
            >
              {charCount.toLocaleString()} / {linkedInLimit.toLocaleString()} characters
            </span>
            <button type="button" className="copy-btn" onClick={handleCopy}>
              {copied ? (
                <>
                  <CheckIcon /> Copied!
                </>
              ) : (
                <>
                  <CopyIcon /> Copy for LinkedIn
                </>
              )}
            </button>
          </div>
        </section>

        <section className="panel preview-panel">
          <div className="preview-header">
            <h2>LinkedIn preview</h2>
            <span className="preview-badge">How it may look</span>
          </div>
          <div className="preview-card">
            <div className="preview-author">
              <div className="avatar">You</div>
              <div>
                <div className="author-name">Your Name</div>
                <div className="author-meta">Just now · 🌐</div>
              </div>
            </div>
            <div className="preview-body">{text || <span className="empty">Your post appears here…</span>}</div>
            <div className="preview-actions">
              <span>Like</span>
              <span>Comment</span>
              <span>Repost</span>
              <span>Send</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Tip: After copying, paste directly into a LinkedIn post or comment. Some styles may
          look different on mobile.
        </p>
      </footer>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
