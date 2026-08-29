import { useState } from 'react';
import { monthlyBoard, weeklyBoard } from '../data/content';
import { pct } from '../lib/format';
import { Tabs } from '../components/ui/Primitives';

export function LeaderboardsPage() {
  const [tab, setTab] = useState('weekly');
  const rows = tab === 'weekly' ? weeklyBoard : monthlyBoard;
  return (
    <div className="page">
      <div className="wide col gap-16">
        <div>
          <div className="kicker">Club</div>
          <h1>Leaderboards</h1>
          <p className="muted">Fictional demo bettors ranked on points, wins, ROI and streak. No cash prizes.</p>
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'weekly', label: 'This week' },
            { id: 'monthly', label: 'This month' },
          ]}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Bettor</th>
                <th>Points</th>
                <th>Wins</th>
                <th>Bets</th>
                <th>ROI</th>
                <th>Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td className="mono">{r.rank}</td>
                  <td>
                    <div className="center gap-10">
                      <span className="crest" style={{ background: '#182436' }}>
                        {r.avatar}
                      </span>
                      <div>
                        <strong>{r.name}</strong>
                        <div className="faint">@{r.handle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{r.points}</td>
                  <td>{r.wins}</td>
                  <td>{r.bets}</td>
                  <td style={{ color: r.roi >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{pct(r.roi)}</td>
                  <td>{r.streak}W</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
