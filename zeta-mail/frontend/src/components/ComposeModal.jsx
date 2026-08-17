import { useCallback, useEffect, useRef, useState } from 'react';
import { api, saveDraftBeacon } from '../api.js';

function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ComposeModal({
  initial,
  user,
  onClose,
  onSent,
  onScheduled,
  showToast,
}) {
  const [id, setId] = useState(initial?.id || null);
  const [to, setTo] = useState(initial?.recipientEmail || '');
  const [subject, setSubject] = useState(initial?.subject || '');
  const [bodyHtml, setBodyHtml] = useState(initial?.body || '');
  const [attachments, setAttachments] = useState(initial?.attachments || []);
  const [scheduleOpen, setScheduleOpen] = useState(!!initial?.scheduledAt);
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (initial?.scheduledAt) {
      const d = new Date(initial.scheduledAt);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return '';
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkText, setLinkText] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const editorRef = useRef(null);
  const fileRef = useRef(null);
  const stateRef = useRef({});
  const savedOnClose = useRef(false);

  // Keep latest state for unload handlers
  useEffect(() => {
    stateRef.current = { id, to, subject, bodyHtml, dirty };
  }, [id, to, subject, bodyHtml, dirty]);

  useEffect(() => {
    if (editorRef.current && initial?.body) {
      editorRef.current.innerHTML = initial.body;
    }
  }, []);

  const ensureDraft = useCallback(async () => {
    const html = editorRef.current?.innerHTML || bodyHtml;
    const payload = {
      id: stateRef.current.id || id,
      recipientEmail: stateRef.current.to || to,
      subject: stateRef.current.subject || subject,
      body: html,
    };
    const data = await api.saveDraft(payload);
    setId(data.mail.id);
    stateRef.current.id = data.mail.id;
    return data.mail;
  }, [id, to, subject, bodyHtml]);

  // Auto-save every 8s when dirty
  useEffect(() => {
    if (!dirty) return;
    const t = setInterval(async () => {
      try {
        const html = editorRef.current?.innerHTML || '';
        const data = await api.saveDraft({
          id: stateRef.current.id,
          recipientEmail: stateRef.current.to,
          subject: stateRef.current.subject,
          body: html,
        });
        setId(data.mail.id);
        stateRef.current.id = data.mail.id;
        setDirty(false);
        setStatus('Draft saved');
        setTimeout(() => setStatus(''), 2000);
      } catch {
        /* ignore autosave errors */
      }
    }, 8000);
    return () => clearInterval(t);
  }, [dirty]);

  // Save draft on close / refresh / tab hide
  useEffect(() => {
    const persistDraft = () => {
      const s = stateRef.current;
      const html = editorRef.current?.innerHTML || s.bodyHtml || '';
      const hasContent =
        (s.to && s.to.trim()) ||
        (s.subject && s.subject.trim()) ||
        (html && stripEmpty(html));
      if (!hasContent && !s.id) return;
      saveDraftBeacon({
        id: s.id || undefined,
        recipientEmail: s.to || '',
        subject: s.subject || '',
        body: html,
      });
    };

    const onBeforeUnload = (e) => {
      const s = stateRef.current;
      const html = editorRef.current?.innerHTML || '';
      const hasContent =
        s.dirty ||
        s.id ||
        (s.to && s.to.trim()) ||
        (s.subject && s.subject.trim()) ||
        stripEmpty(html);
      if (hasContent) {
        persistDraft();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistDraft();
    };

    const onPageHide = () => persistDraft();

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  function stripEmpty(html) {
    const t = (html || '').replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').trim();
    return t.length > 0;
  }

  function markDirty() {
    setDirty(true);
    setBodyHtml(editorRef.current?.innerHTML || '');
  }

  async function handleClose() {
    if (savedOnClose.current) {
      onClose();
      return;
    }
    const html = editorRef.current?.innerHTML || '';
    const hasContent =
      dirty ||
      id ||
      to.trim() ||
      subject.trim() ||
      stripEmpty(html);
    if (hasContent) {
      try {
        await api.saveDraft({
          id: id || undefined,
          recipientEmail: to,
          subject,
          body: html,
        });
        savedOnClose.current = true;
        onClose({ savedDraft: true });
        return;
      } catch (e) {
        showToast?.(e.message, 'error');
      }
    }
    onClose();
  }

  async function handleSend(e) {
    e?.preventDefault?.();
    const html = editorRef.current?.innerHTML || '';
    if (!to.trim()) {
      showToast?.('Please enter a recipient', 'error');
      return;
    }
    setBusy(true);
    try {
      let mailId = id;
      if (!mailId) {
        const draft = await ensureDraft();
        mailId = draft.id;
      } else {
        await api.saveDraft({ id: mailId, recipientEmail: to, subject, body: html });
      }

      const payload = {
        id: mailId,
        recipientEmail: to.includes('@') ? to : `${to}@zeta.com`,
        subject,
        body: html,
      };

      if (scheduleOpen && scheduledAt) {
        payload.scheduledAt = new Date(scheduledAt).toISOString();
        await api.sendMail(payload);
        savedOnClose.current = true;
        setDirty(false);
        onScheduled?.();
      } else {
        await api.sendMail(payload);
        savedOnClose.current = true;
        setDirty(false);
        onSent?.();
      }
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleAttach(files) {
    if (!files?.length) return;
    setBusy(true);
    try {
      let mailId = id;
      if (!mailId) {
        const draft = await ensureDraft();
        mailId = draft.id;
        setId(mailId);
      }
      for (const file of files) {
        const data = await api.uploadAttachment(mailId, file);
        setAttachments(data.mail.attachments || []);
      }
      setStatus('File attached');
      setDirty(true);
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAtt(attId) {
    try {
      await api.removeAttachment(attId);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  }

  function insertLink() {
    const url = linkUrl.trim();
    if (!url) return;
    const text = linkText.trim() || url;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = text;
        range.insertNode(a);
        range.setStartAfter(a);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editor.innerHTML += ` <a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a> `;
      }
    } else {
      editor.innerHTML += ` <a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a> `;
    }
    markDirty();
    setLinkOpen(false);
    setLinkUrl('https://');
    setLinkText('');
  }

  function exec(cmd) {
    document.execCommand(cmd, false, null);
    editorRef.current?.focus();
    markDirty();
  }

  async function onToChange(val) {
    setTo(val);
    setDirty(true);
    const q = val.replace(/@zeta\.com$/i, '');
    if (q.length >= 1) {
      try {
        const d = await api.searchUsers(q);
        setSuggestions(d.users || []);
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  }

  const minSchedule = (() => {
    const d = new Date(Date.now() + 60000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div className="compose-overlay" role="dialog" aria-label="Compose mail">
      <div className="compose-window">
        <header className="compose-header">
          <span>New Message</span>
          <div className="compose-header-actions">
            {status && <span className="compose-status">{status}</span>}
            <button type="button" className="btn-icon light" onClick={handleClose} title="Close (saves draft)">
              ✕
            </button>
          </div>
        </header>

        <div className="compose-fields">
          <div className="compose-row">
            <label>From</label>
            <span className="from-static">{user.email}</span>
          </div>
          <div className="compose-row relative">
            <label>To</label>
            <input
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              placeholder="recipient@zeta.com"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="suggest-list">
                {suggestions.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTo(u.email);
                        setSuggestions([]);
                        setDirty(true);
                      }}
                    >
                      <strong>{u.displayName}</strong>
                      <span className="muted"> {u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="compose-row">
            <label>Subject</label>
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setDirty(true);
              }}
              placeholder="Subject"
            />
          </div>
        </div>

        <div className="compose-toolbar">
          <button type="button" onClick={() => exec('bold')} title="Bold">
            <b>B</b>
          </button>
          <button type="button" onClick={() => exec('italic')} title="Italic">
            <i>I</i>
          </button>
          <button type="button" onClick={() => exec('underline')} title="Underline">
            <u>U</u>
          </button>
          <span className="tb-sep" />
          <button type="button" onClick={() => setLinkOpen((v) => !v)} title="Insert link">
            🔗 Link
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Attach file"
          >
            📎 Attach
          </button>
          <button
            type="button"
            className={scheduleOpen ? 'active' : ''}
            onClick={() => setScheduleOpen((v) => !v)}
            title="Schedule send"
          >
            ⏰ Schedule
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => handleAttach(e.target.files)}
          />
        </div>

        {linkOpen && (
          <div className="compose-panel link-panel">
            <input
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Link text"
            />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <button type="button" className="btn-secondary" onClick={insertLink}>
              Insert
            </button>
            <button type="button" className="btn-ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </button>
          </div>
        )}

        {scheduleOpen && (
          <div className="compose-panel schedule-panel">
            <label>
              Send at
              <input
                type="datetime-local"
                value={scheduledAt}
                min={minSchedule}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </label>
            <span className="muted small">Leave empty &amp; uncheck schedule to send now</span>
          </div>
        )}

        <div
          ref={editorRef}
          className="compose-editor"
          contentEditable
          role="textbox"
          aria-multiline="true"
          data-placeholder="Write your message…"
          onInput={markDirty}
          suppressContentEditableWarning
        />

        {attachments.length > 0 && (
          <ul className="compose-attachments">
            {attachments.map((a) => (
              <li key={a.id}>
                <span>
                  📎 {a.originalName}{' '}
                  <span className="muted">({formatBytes(a.size)})</span>
                </span>
                <button type="button" className="btn-icon" onClick={() => removeAtt(a.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="compose-footer">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={handleSend}
          >
            {busy
              ? 'Working…'
              : scheduleOpen && scheduledAt
                ? 'Schedule send'
                : 'Send'}
          </button>
          <button type="button" className="btn-ghost" onClick={handleClose} disabled={busy}>
            Save draft & close
          </button>
        </footer>
      </div>
    </div>
  );
}
