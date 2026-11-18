import React, { useEffect, useState } from 'react';
import * as db from '../firebase.mjs';
import { useApp } from '../context.jsx';
import { ROLE_LABELS, dueState } from '../domain.mjs';
import { Button, Icon, Modal } from './ui.jsx';

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// 帳號資訊：核心幹部加入成員時需要對方的 UID，所以放在這裡方便複製。
function AccountDialog({ onClose }) {
  const { user, membership, isAdmin, role, club, notify } = useApp();
  return (
    <Modal title="帳號資訊" onClose={onClose}>
      <dl className="details-list">
        <dt>姓名</dt>
        <dd>{membership?.name || user.email.split('@')[0]}</dd>
        <dt>電子郵件</dt>
        <dd className="break">{user.email}</dd>
        <dt>角色</dt>
        <dd>
          {isAdmin ? '系統管理者' : role ? ROLE_LABELS[role] : '尚未加入'}
          {club ? ` · ${club.name}` : ''}
        </dd>
        <dt>UID</dt>
        <dd className="break mono">{user.uid}</dd>
      </dl>
      <p className="caption">加入社團時，把 UID 交給該社團的核心幹部。</p>
      <div className="formactions">
        <Button
          icon="copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(user.uid);
              notify('已複製 UID');
            } catch {
              notify('無法使用剪貼簿，請手動選取 UID');
            }
          }}
        >
          複製 UID
        </Button>
        <Button
          icon="logout"
          onClick={() => {
            onClose();
            db.logout();
          }}
        >
          登出
        </Button>
      </div>
    </Modal>
  );
}

// 期限提醒：列出自己已逾期與三天內到期的任務。
function ReminderDialog({ tasks, onClose }) {
  return (
    <Modal title="期限提醒" onClose={onClose}>
      {!tasks.length ? (
        <p className="caption">目前沒有逾期或三天內到期的任務。</p>
      ) : (
        tasks.map((t) => (
          <div className="simple-row" key={t.id}>
            <span>
              <strong>{t.title}</strong>
              <small className="caption block">截止 {t.dueDate}</small>
            </span>
            <span className={'tag ' + dueState(t)}>
              {dueState(t) === 'overdue' ? '已逾期' : '即將到期'}
            </span>
          </div>
        ))
      )}
      <div className="formactions">
        <a className="button primary" href="#/tasks" onClick={onClose}>
          前往我的任務
        </a>
      </div>
    </Modal>
  );
}

export default function Shell({ routes, current, theme, onToggleTheme, children }) {
  const {
    user,
    clubs,
    club,
    clubId,
    setClubId,
    membership,
    isAdmin,
    role,
    data,
    reload,
    refreshing,
  } = useApp();
  const [open, setOpen] = useState(false),
    [account, setAccount] = useState(false),
    [reminders, setReminders] = useState(false);

  useEffect(() => setOpen(false), [current, clubId]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', close);
    return () => removeEventListener('keydown', close);
  }, [open]);

  const due = (data.tasks || [])
    .filter((t) => t.assigneeId === user.uid && ['overdue', 'soon'].includes(dueState(t)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const name = membership?.name || user.email.split('@')[0];
  const groups = [];
  for (const route of routes) {
    const last = groups[groups.length - 1];
    if (last && last.label === route.group) last.items.push(route);
    else groups.push({ label: route.group, items: [route] });
  }

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={'sidebar glass' + (open ? ' open' : '')} id="sidebar">
        <a className="wordmark" href="#/dashboard">
          ucms
        </a>
        {clubs.length > 0 && (
          <label className="club-switch">
            <span className="sr-only">切換社團</span>
            <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <nav aria-label="主選單">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="navlabel">{group.label}</p>
              {group.items.map((route) => (
                <a
                  key={route.path}
                  href={'#/' + route.path}
                  className={route.path === current ? 'active' : ''}
                  aria-current={route.path === current ? 'page' : undefined}
                >
                  <Icon name={route.icon} />
                  <span>{route.label}</span>
                  {route.path === 'tasks' && due.length > 0 && (
                    <span className="count" aria-label={`${due.length} 項任務即將到期或已逾期`}>
                      {due.length}
                    </span>
                  )}
                </a>
              ))}
            </div>
          ))}
          <div>
            <p className="navlabel">公開</p>
            <a href={clubId ? '#/public/' + clubId : '#/public'}>
              <Icon name="arrow" />
              <span>公開活動頁</span>
            </a>
          </div>
        </nav>
        <button type="button" className="userchip" onClick={() => setAccount(true)}>
          <span className="avatar" aria-hidden="true">
            {initial(name)}
          </span>
          <span className="grow">
            <strong>{name}</strong>
            <small>{isAdmin ? '系統管理者' : role ? ROLE_LABELS[role] : '尚未加入此社團'}</small>
          </span>
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="iconbutton menu glass"
            aria-label="開啟選單"
            aria-expanded={open}
            aria-controls="sidebar"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <span className="crumb">{club?.name || 'UCMS'}</span>
          <div className="tools glass" role="toolbar" aria-label="工具列">
            <button
              type="button"
              className={'iconbutton' + (refreshing ? ' spinning' : '')}
              aria-label="重新整理資料"
              title="重新整理資料"
              onClick={reload}
            >
              <Icon name="refresh" />
            </button>
            <button
              type="button"
              className="iconbutton"
              aria-label={due.length ? `期限提醒，${due.length} 項` : '期限提醒'}
              title="期限提醒"
              onClick={() => setReminders(true)}
            >
              <Icon name="bell" />
              {due.length > 0 && <span className="dot" aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="iconbutton"
              aria-label={theme === 'dark' ? '切換為淺色' : '切換為深色'}
              title={theme === 'dark' ? '切換為淺色' : '切換為深色'}
              onClick={onToggleTheme}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <button
              type="button"
              className="iconbutton"
              aria-label="帳號資訊"
              title="帳號資訊"
              onClick={() => setAccount(true)}
            >
              <Icon name="user" />
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      {account && <AccountDialog onClose={() => setAccount(false)} />}
      {reminders && <ReminderDialog tasks={due} onClose={() => setReminders(false)} />}
    </div>
  );
}
