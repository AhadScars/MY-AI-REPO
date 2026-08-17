import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import AuthScreen from './components/AuthScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import MailList from './components/MailList.jsx';
import MailView from './components/MailView.jsx';
import ComposeModal from './components/ComposeModal.jsx';
import TopBar from './components/TopBar.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState('inbox');
  const [mails, setMails] = useState([]);
  const [counts, setCounts] = useState({ inbox: 0, unread: 0, sent: 0, drafts: 0, scheduled: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedMail, setSelectedMail] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState(null);
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const loadMails = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.listMails(folder);
      setMails(data.mails || []);
      setCounts(data.counts || counts);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, [user, folder, showToast]);

  useEffect(() => {
    loadMails();
  }, [loadMails, refreshKey]);

  useEffect(() => {
    if (!selectedId || !user) {
      setSelectedMail(null);
      return;
    }
    api
      .getMail(selectedId)
      .then((d) => {
        setSelectedMail(d.mail);
        // refresh list read state
        setMails((prev) =>
          prev.map((m) => (m.id === selectedId ? { ...m, isRead: true } : m))
        );
        api.counts().then(setCounts).catch(() => {});
      })
      .catch(() => setSelectedMail(null));
  }, [selectedId, user]);

  // Poll for scheduled mail delivery
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      if (folder === 'scheduled' || folder === 'inbox' || folder === 'sent') {
        setRefreshKey((k) => k + 1);
      } else {
        api.counts().then(setCounts).catch(() => {});
      }
    }, 20000);
    return () => clearInterval(t);
  }, [user, folder]);

  function openCompose(initial = null) {
    setComposeInitial(initial);
    setComposeOpen(true);
  }

  function handleComposeClose({ savedDraft } = {}) {
    setComposeOpen(false);
    setComposeInitial(null);
    setRefreshKey((k) => k + 1);
    if (savedDraft) showToast('Draft saved', 'info');
  }

  async function handleDelete(id) {
    try {
      await api.deleteMail(id);
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedMail(null);
      }
      setRefreshKey((k) => k + 1);
      showToast('Deleted', 'info');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function handleReply(mail) {
    openCompose({
      recipientEmail: mail.senderEmail || '',
      subject: mail.subject?.startsWith('Re:') ? mail.subject : `Re: ${mail.subject || ''}`,
      body: `<br/><br/><hr/><p><em>On ${mail.sentAt || mail.createdAt}, ${mail.senderName || mail.senderEmail} wrote:</em></p>${mail.body || ''}`,
    });
  }

  function openDraft(mail) {
    openCompose({
      id: mail.id,
      recipientEmail: mail.recipientEmail || '',
      subject: mail.subject || '',
      body: mail.body || '',
      scheduledAt: mail.scheduledAt || '',
      attachments: mail.attachments || [],
    });
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading Zeta Mail…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuth={(u) => {
          setUser(u);
          showToast(`Welcome, ${u.displayName}!`, 'success');
        }}
      />
    );
  }

  const filtered = search.trim()
    ? mails.filter((m) => {
        const q = search.toLowerCase();
        return (
          (m.subject || '').toLowerCase().includes(q) ||
          (m.body || '').toLowerCase().includes(q) ||
          (m.senderEmail || '').toLowerCase().includes(q) ||
          (m.recipientEmail || '').toLowerCase().includes(q) ||
          (m.senderName || '').toLowerCase().includes(q)
        );
      })
    : mails;

  return (
    <div className="app-shell">
      <TopBar
        user={user}
        search={search}
        onSearch={setSearch}
        onLogout={async () => {
          await api.logout();
          setUser(null);
        }}
      />
      <div className="app-body">
        <Sidebar
          folder={folder}
          counts={counts}
          onFolder={(f) => {
            setFolder(f);
            setSelectedId(null);
            setSelectedMail(null);
          }}
          onCompose={() => openCompose()}
        />
        <main className="main-panel">
          <MailList
            folder={folder}
            mails={filtered}
            selectedId={selectedId}
            onSelect={(id) => {
              if (folder === 'drafts' || folder === 'scheduled') {
                const m = mails.find((x) => x.id === id);
                if (m) openDraft(m);
              } else {
                setSelectedId(id);
              }
            }}
            onDelete={handleDelete}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
          {selectedMail && folder !== 'drafts' && folder !== 'scheduled' && (
            <MailView
              mail={selectedMail}
              folder={folder}
              onClose={() => {
                setSelectedId(null);
                setSelectedMail(null);
              }}
              onReply={() => handleReply(selectedMail)}
              onDelete={() => handleDelete(selectedMail.id)}
            />
          )}
        </main>
      </div>

      {composeOpen && (
        <ComposeModal
          initial={composeInitial}
          user={user}
          onClose={handleComposeClose}
          onSent={() => {
            setComposeOpen(false);
            setComposeInitial(null);
            setRefreshKey((k) => k + 1);
            showToast('Message sent', 'success');
          }}
          onScheduled={() => {
            setComposeOpen(false);
            setComposeInitial(null);
            setFolder('scheduled');
            setRefreshKey((k) => k + 1);
            showToast('Message scheduled', 'success');
          }}
          showToast={showToast}
        />
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
