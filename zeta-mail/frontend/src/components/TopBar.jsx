export default function TopBar({ user, search, onSearch, onLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo-mark sm">Z</div>
        <span className="brand-name">Zeta Mail</span>
      </div>
      <div className="topbar-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search mail"
        />
      </div>
      <div className="topbar-right">
        <div className="user-chip" title={user.email}>
          <div className="avatar">{(user.displayName || user.username || '?')[0].toUpperCase()}</div>
          <div className="user-meta">
            <span className="user-name">{user.displayName}</span>
            <span className="user-email">{user.email}</span>
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
