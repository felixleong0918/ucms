import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as db from './firebase.mjs';
import { manage, financial } from './domain.mjs';

const Context = createContext();
export const useApp = () => useContext(Context);

const CLUB_KEY = 'ucms-club';
const NO_DATA = {};
function storedClub() {
  try {
    return localStorage.getItem(CLUB_KEY) || '';
  } catch {
    return '';
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(db.currentUser),
    [clubs, setClubs] = useState([]),
    [memberships, setMemberships] = useState({}),
    [isAdmin, setAdmin] = useState(false),
    [clubId, setClubIdState] = useState(storedClub),
    [data, setData] = useState({}),
    [accessFor, setAccessFor] = useState(null), // 角色資訊屬於哪位使用者
    [dataFor, setDataFor] = useState(null), // 資料屬於哪位使用者的哪個社團
    [error, setError] = useState(null),
    [toast, setToast] = useState(''),
    [revision, setRevision] = useState(0),
    [accessKey, setAccessKey] = useState(0),
    [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);

  useEffect(() => db.onSession(setUser), []);
  const reload = useCallback(() => {
    setRefreshing(true);
    setRevision((n) => n + 1);
  }, []);
  const setClubId = useCallback((id) => {
    setClubIdState(id);
    try {
      localStorage.setItem(CLUB_KEY, id);
    } catch {}
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 第一步：社團清單（公開可讀）、系統管理者身分，以及自己在各社團的角色。
  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await db.list('clubs');
      rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
      let admin = false,
        mine = {};
      if (user) {
        const [adminDoc, ...docs] = await Promise.all([
          db.get('admins/' + user.uid),
          ...rows.map((c) => db.get(`clubs/${c.id}/members/${user.uid}`)),
        ]);
        admin = !!adminDoc;
        rows.forEach((c, i) => {
          if (docs[i]) mine[c.id] = docs[i];
        });
      }
      if (!live) return;
      const open = rows.filter((c) => admin || mine[c.id]);
      setClubs(rows);
      setAdmin(admin);
      setMemberships(mine);
      setClubIdState((id) => (open.some((c) => c.id === id) ? id : open[0]?.id || ''));
      setError(null);
      setAccessFor(user?.uid || '');
      setAccessKey((n) => n + 1);
    })().catch((e) => {
      if (!live) return;
      setError(e);
      setAccessFor(user?.uid || '');
      setRefreshing(false);
    });
    return () => {
      live = false;
    };
  }, [revision, user?.uid]);

  // 角色資訊必須屬於目前登入的人，否則一律視為載入中，避免閃現前一位使用者的畫面。
  const uid = user?.uid || '';
  const accessReady = accessFor === uid;
  const myClubs = accessReady ? clubs.filter((c) => isAdmin || memberships[c.id]) : [];
  const club = myClubs.find((c) => c.id === clubId);
  const membership = (accessReady && memberships[clubId]) || null;
  const role = club ? (isAdmin ? 'core' : membership?.role) : undefined;
  const scope = `${uid}/${clubId}`;
  const needsData = Boolean(user && club && role);
  const loading = !accessReady || (needsData && dataFor !== scope);

  // 第二步：依角色載入目前社團的資料。儲存後的重新整理會保留畫面上的舊資料，
  // 直到新資料回來，避免頁面閃爍或表單狀態遺失。
  useEffect(() => {
    if (!accessKey || !needsData) {
      setRefreshing(false);
      return;
    }
    const seq = ++sequence.current;
    const target = scope;
    (async () => {
      const p = `clubs/${clubId}/`;
      const names = manage(role)
        ? [
            'members',
            'announcements',
            'tasks',
            'meetings',
            'events',
            ...(financial(role) ? ['transactions'] : []),
            ...(club.modules.inventory ? ['inventory', 'inventoryMovements'] : []),
            ...(club.modules.timer ? ['blindStructures'] : []),
          ]
        : [];
      const pairs = await Promise.all(names.map(async (name) => [name, await db.list(p + name)]));
      if (!manage(role)) pairs.push(['tasks', await db.query(p + 'tasks', 'assigneeId', user.uid)]);
      if (seq !== sequence.current) return;
      setData(Object.fromEntries(pairs));
      setDataFor(target);
      setRefreshing(false);
    })().catch((e) => {
      if (seq !== sequence.current) return;
      setError(e);
      setData({});
      setDataFor(target);
      setRefreshing(false);
    });
    return () => {
      sequence.current++;
    };
  }, [accessKey, clubId]);

  const path = useCallback(
    (collection, id) => `clubs/${clubId}/${collection}${id ? '/' + id : ''}`,
    [clubId],
  );
  const save = async (collection, values, existing) => {
    const now = Date.now();
    const payload = {
      ...values,
      createdAt: existing?.createdAt || now,
      createdBy: existing?.createdBy || user.uid,
      updatedAt: now,
    };
    const id = existing?.id || db.newId();
    await db.save(path(collection, id), payload, existing);
    reload();
    setToast('已儲存');
    return id;
  };

  return (
    <Context.Provider
      value={{
        user,
        clubs: myClubs,
        allClubs: clubs,
        club,
        clubId,
        setClubId,
        data: dataFor === scope ? data : NO_DATA,
        membership,
        isAdmin,
        role,
        loading,
        refreshing,
        error,
        reload,
        path,
        save,
        notify: setToast,
      }}
    >
      {children}
      {toast && (
        <div className="toast glass" role="status">
          {toast}
        </div>
      )}
    </Context.Provider>
  );
}
