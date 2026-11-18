import React from 'react';
import { useApp } from '../context.jsx';
import { dueState, financial, manage, money, balance, dateTime } from '../domain.mjs';
import { Header, Panel, Empty } from '../components/ui.jsx';
import { TaskRows } from './Tasks.jsx';
import { Calendar } from './Events.jsx';
import { pickGreeting } from '../greetings.mjs';

// 在模組載入時挑一次：同一次開啟期間標題固定，重新開啟才換句子。
const greeting = pickGreeting();

const two = (n) => String(n).padStart(2, '0');

export default function Dashboard() {
  const { data, user, role } = useApp();
  const staff = manage(role);
  const tasks = (data.tasks || [])
    .filter((t) => t.assigneeId === user.uid && t.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = tasks.filter((t) => dueState(t) === 'overdue');
  const soon = tasks.filter((t) => dueState(t) === 'soon');
  const events = (data.events || [])
    .filter((e) => e.endAt >= Date.now())
    .sort((a, b) => a.startAt - b.startAt);
  const announcements = [...(data.announcements || [])].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt,
  );

  return (
    <>
      <Header title={greeting}>
        <a href="#/tasks" className="button primary">
          查看我的任務
        </a>
      </Header>

      <div className="stats">
        <div>
          <span>我的待辦</span>
          <strong>{two(tasks.length)}</strong>
        </div>
        <div>
          <span>逾期任務</span>
          <strong className={overdue.length ? 'warning-text' : ''}>{two(overdue.length)}</strong>
          <small>{overdue.length ? '有工作需要優先處理' : '目前沒有逾期工作'}</small>
        </div>
        <div>
          <span>三天內到期</span>
          <strong>{two(soon.length)}</strong>
        </div>
        {staff && (
          <div>
            <span>即將到來的活動</span>
            <strong>{two(events.length)}</strong>
          </div>
        )}
        {financial(role) && (
          <div>
            <span>社團結餘</span>
            <strong className="small-stat">{money(balance(data.transactions || []))}</strong>
            <small>依現有收支紀錄計算</small>
          </div>
        )}
      </div>

      <div className={staff ? 'dashboard-grid' : ''}>
        <Panel
          title="我的任務"
          action={
            <a className="text-link" href="#/tasks">
              查看全部 ›
            </a>
          }
        >
          {tasks.length ? (
            <TaskRows tasks={tasks.slice(0, 5)} />
          ) : (
            <Empty title="目前沒有待完成任務" />
          )}
        </Panel>
        {staff && (
          <Calendar
            compact
            events={events}
            onSelect={() => {
              location.hash = '#/events';
            }}
          />
        )}
      </div>

      {staff && (
        <div className="dashboard-grid section-gap">
          <Panel
            title="社團公告"
            action={
              <a className="text-link" href="#/announcements">
                查看全部 ›
              </a>
            }
          >
            {!announcements.length ? (
              <Empty title="目前沒有公告" />
            ) : (
              announcements.slice(0, 2).map((a) => (
                <article className="notice" key={a.id}>
                  <h3>{a.title}</h3>
                  <p className="excerpt">{a.body}</p>
                  <span className="caption">
                    {a.pinned ? '置頂 · ' : ''}
                    {dateTime(a.createdAt)}
                  </span>
                </article>
              ))
            )}
          </Panel>
          <Panel title="下一場活動">
            {events[0] ? (
              <>
                <p className="caption">{dateTime(events[0].startAt)}</p>
                <h3 className="next-event-title">{events[0].title}</h3>
                <p className="caption">{events[0].location}</p>
                <a className="text-link" href="#/events">
                  前往活動管理 ›
                </a>
              </>
            ) : (
              <Empty
                title="還沒有排定活動"
                action={
                  <a className="text-link" href="#/events">
                    建立活動 ›
                  </a>
                }
              />
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
