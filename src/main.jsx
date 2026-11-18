import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AppProvider, useApp } from './context.jsx';
import { manage, financial } from './domain.mjs';
import { Button, Empty, ErrorBox, Loading } from './components/ui.jsx';
import Shell from './components/Shell.jsx';
import Auth from './pages/Auth.jsx';
import Public from './pages/Public.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import Announcements from './pages/Announcements.jsx';
import Meetings from './pages/Meetings.jsx';
import Events from './pages/Events.jsx';
import Finance from './pages/Finance.jsx';
import Inventory from './pages/Inventory.jsx';
import Feedback from './pages/Feedback.jsx';
import Timer from './pages/Timer.jsx';
import Admin, { ClubForm } from './pages/Admin.jsx';

// 路由表同時決定側欄順序與角色權限。
// allow(role)：哪些角色看得到；module：需要社團啟用的專屬模組。
// 前端只負責隱藏入口，真正的存取控制在 firestore.rules。
const ROUTES = [
  {
    path: 'dashboard',
    label: '總覽',
    icon: 'home',
    group: '工作空間',
    page: Dashboard,
    allow: Boolean,
  },
  {
    path: 'tasks',
    label: '我的任務',
    icon: 'task',
    group: '工作空間',
    page: Tasks,
    allow: Boolean,
  },
  {
    path: 'events',
    label: '行事曆與活動',
    icon: 'calendar',
    group: '工作空間',
    page: Events,
    allow: manage,
  },
  {
    path: 'announcements',
    label: '社團公告',
    icon: 'megaphone',
    group: '工作空間',
    page: Announcements,
    allow: manage,
  },
  {
    path: 'meetings',
    label: '會議紀錄',
    icon: 'file',
    group: '工作空間',
    page: Meetings,
    allow: manage,
  },
  {
    path: 'finance',
    label: '財務收支',
    icon: 'wallet',
    group: '資源與工具',
    page: Finance,
    allow: financial,
  },
  {
    path: 'inventory',
    label: '器材庫存',
    icon: 'box',
    group: '資源與工具',
    page: Inventory,
    allow: manage,
    module: 'inventory',
  },
  {
    path: 'feedback',
    label: '活動回饋',
    icon: 'chat',
    group: '資源與工具',
    page: Feedback,
    allow: manage,
    module: 'feedback',
  },
  {
    path: 'timer',
    label: '盲注計時',
    icon: 'clock',
    group: '資源與工具',
    page: Timer,
    allow: manage,
    module: 'timer',
  },
  {
    path: 'admin',
    label: '團隊管理',
    icon: 'people',
    group: '社團',
    page: Admin,
    allow: (role) => role === 'core',
  },
];

function parseHash() {
  const parts = location.hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
  return { name: parts[0] || 'dashboard', params: parts.slice(1) };
}

function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const update = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return route;
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('ucms-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
  }, [theme]);
  const toggle = () =>
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('ucms-theme', next);
      } catch {}
      return next;
    });
  return [theme, toggle];
}

function Workspace({ route, theme, onToggleTheme }) {
  const { user, clubs, allClubs, club, clubId, role, isAdmin, loading, error, reload } = useApp();
  const [creating, setCreating] = useState(false);
  const allowed = ROUTES.filter(
    (r) => club && r.allow(role) && (!r.module || club.modules?.[r.module]),
  );
  const target = ROUTES.find((r) => r.path === route.name);
  const active = allowed.find((r) => r.path === route.name);

  let body;
  if (loading) {
    body = <Loading />;
  } else if (error && !club) {
    // 連不上後端時只顯示錯誤，不誤報「尚未加入社團」。
    body = <ErrorBox error={error} retry={reload} />;
  } else if (!allClubs.length) {
    body = (
      <Empty
        title="還沒有任何社團"
        action={
          isAdmin ? (
            <Button kind="primary" icon="plus" onClick={() => setCreating(true)}>
              建立社團
            </Button>
          ) : null
        }
      >
        {isAdmin ? '建立第一個社團，再加入核心幹部。' : '請系統管理者先建立社團。'}
      </Empty>
    );
  } else if (!club || !role) {
    body = (
      <Empty
        title="你還沒有加入任何社團"
        action={
          <a className="text-link" href="#/public">
            查看公開活動 ›
          </a>
        }
      >
        從右上角的帳號資訊複製 UID，交給社團的核心幹部，請對方把你加入成員。
      </Empty>
    );
  } else if (!target) {
    body = (
      <Empty
        title="找不到這個頁面"
        action={
          <a className="text-link" href="#/dashboard">
            回到總覽 ›
          </a>
        }
      />
    );
  } else if (!active) {
    body = (
      <Empty
        title="你沒有檢視這個頁面的權限"
        action={
          <a className="text-link" href="#/dashboard">
            回到總覽 ›
          </a>
        }
      >
        {target.module && !club.modules?.[target.module]
          ? '這個社團沒有啟用此模組。'
          : '這個頁面需要其他角色。如需調整，請聯絡核心幹部。'}
      </Empty>
    );
  } else {
    const Page = active.page;
    // 以社團與使用者為 key，切換時重置頁面內的篩選與表單狀態。
    body = (
      <>
        <ErrorBox error={error} retry={reload} />
        <Page key={`${clubId}/${user.uid}`} />
      </>
    );
  }

  return (
    <Shell routes={allowed} current={route.name} theme={theme} onToggleTheme={onToggleTheme}>
      {body}
      {creating && <ClubForm onClose={() => setCreating(false)} />}
    </Shell>
  );
}

function App() {
  const { user } = useApp();
  const route = useRoute();
  const [theme, toggleTheme] = useTheme();

  if (route.name === 'public') {
    const [clubId, eventId] = route.params;
    return <Public key={`${clubId || ''}/${eventId || ''}`} clubId={clubId} eventId={eventId} />;
  }
  if (!user) return <Auth />;
  return <Workspace route={route} theme={theme} onToggleTheme={toggleTheme} />;
}

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <App />
  </AppProvider>,
);
