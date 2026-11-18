import React, { useEffect, useState } from 'react';
import { useApp } from '../context.jsx';
import * as db from '../firebase.mjs';
import { money, cents, toInputDate, dateTime, validEvent, localDate } from '../domain.mjs';
import { exportExcel } from '../export.mjs';
import {
  Header,
  Button,
  Panel,
  Empty,
  Search,
  Tabs,
  Modal,
  SaveForm,
  Field,
  TextArea,
  Table,
  ErrorBox,
  Loading,
} from '../components/ui.jsx';
export function Calendar({ events, onSelect, compact = false }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    offset = month.getDay();
  return (
    <Panel
      title={`${month.getFullYear()} 年 ${month.getMonth() + 1} 月`}
      action={
        <div className="actions">
          <button
            className="iconbutton"
            aria-label="上個月"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <button
            className="iconbutton"
            aria-label="下個月"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>
      }
    >
      <div className={'month-grid ' + (compact ? 'compact' : '')}>
        {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
          <div className="weekday" key={d}>
            {d}
          </div>
        ))}
        {Array.from({ length: Math.ceil((days + offset) / 7) * 7 }, (_, i) => {
          const day = i - offset + 1;
          if (day < 1 || day > days) return <div className="day outside" key={i} />;
          const date = localDate(new Date(month.getFullYear(), month.getMonth(), day));
          const items = events.filter((e) => localDate(new Date(e.startAt)) === date);
          return (
            <div key={i} className={'day ' + (date === localDate() ? 'today' : '')}>
              <span>{day}</span>
              {items.map((e) => (
                <button key={e.id} onClick={() => onSelect(e)} title={e.title}>
                  {compact ? '•' : e.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
export function EventForm({ event, onClose }) {
  const { save } = useApp();
  return (
    <Modal wide title={event?.id ? '編輯活動' : '建立活動'} onClose={onClose}>
      <SaveForm
        onCancel={onClose}
        onSubmit={async (f) => {
          await save(
            'events',
            validEvent({
              title: f.get('title').trim(),
              description: f.get('description').trim(),
              location: f.get('location').trim(),
              startAt: new Date(f.get('startAt')).getTime(),
              endAt: new Date(f.get('endAt')).getTime(),
              registrationDeadline: f.get('deadline') ? new Date(f.get('deadline')).getTime() : 0,
              fee: cents(f.get('fee')),
              published: f.get('published') === 'on',
            }),
            event?.id ? event : null,
          );
          onClose();
        }}
      >
        <Field label="活動名稱" name="title" required defaultValue={event?.title || ''} />
        <TextArea
          label="活動介紹"
          name="description"
          maxLength={20000}
          defaultValue={event?.description || ''}
        />
        <Field
          label="活動地點"
          name="location"
          required
          maxLength={500}
          defaultValue={event?.location || ''}
        />
        <div className="formgrid">
          <Field
            label="開始時間"
            type="datetime-local"
            name="startAt"
            required
            defaultValue={toInputDate(event?.startAt)}
          />
          <Field
            label="結束時間"
            type="datetime-local"
            name="endAt"
            required
            defaultValue={toInputDate(event?.endAt)}
          />
          <Field
            label="報名截止"
            type="datetime-local"
            name="deadline"
            defaultValue={toInputDate(event?.registrationDeadline)}
            hint="留空表示開放至活動開始。"
          />
          <Field
            label="費用（NT$）"
            type="number"
            name="fee"
            min="0"
            step="0.01"
            required
            defaultValue={(event?.fee || 0) / 100}
          />
        </div>
        <label className="checklabel">
          <input type="checkbox" name="published" defaultChecked={event?.published || false} />
          公開活動並開放報名
        </label>
      </SaveForm>
    </Modal>
  );
}
export function EventDetail({ event, onClose, onEdit }) {
  const { path, clubId, notify } = useApp();
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState('');
  async function load() {
    setError(null);
    setLoading(true);
    try {
      setRows(await db.list(path('events', event.id) + '/registrations'));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [event.id]);
  async function toggle(r, key) {
    setBusy(r.id);
    try {
      await db.save(
        path('events', event.id) + '/registrations/' + r.id,
        { ...r, [key]: !r[key], updatedAt: Date.now() },
        r,
      );
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  }
  const filtered = rows.filter((r) => (r.name + r.email + r.studentId).includes(search));
  const url = location.href.split('#')[0] + `#/public/${clubId}/${event.id}`;
  return (
    <Modal wide title={event.title} onClose={onClose}>
      <p className="caption">
        {dateTime(event.startAt)} — {dateTime(event.endAt)} · {event.location} · {money(event.fee)}
      </p>
      <p className="prewrap">{event.description}</p>
      <div className="actions wrap">
        <Button onClick={onEdit}>編輯活動</Button>
        <a className="button" href={url} target="_blank" rel="noreferrer">
          公開活動頁 ↗
        </a>
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              notify('已複製活動連結');
            } catch {
              setError(Error('無法使用剪貼簿，請複製下方連結'));
            }
          }}
        >
          複製連結
        </Button>
        <Button
          icon="download"
          onClick={async () => {
            try {
              await exportExcel(
                event.title + '-報名名單',
                ['姓名', '電子郵件', '學號', '電話', '備註', '簽到', '收費'],
                rows.map((r) => [
                  r.name,
                  r.email,
                  r.studentId,
                  r.phone,
                  r.note,
                  r.checkedIn ? '已簽到' : '未簽到',
                  r.paid ? '已收費' : '未收費',
                ]),
              );
            } catch (e) {
              setError(e);
            }
          }}
        >
          匯出 Excel
        </Button>
      </div>
      <p className="caption break">{url}</p>
      <hr />
      <div className="toolbar">
        <h3>報名名單 · {rows.length} 人</h3>
        <Search value={search} onChange={setSearch} placeholder="搜尋姓名、學號、郵件" />
      </div>
      <p className="caption">
        已簽到 {rows.filter((r) => r.checkedIn).length} 人 · 已收費{' '}
        {rows.filter((r) => r.paid).length} 人。收費狀態不會自動建立財務帳目。
      </p>
      <ErrorBox error={error} retry={load} />
      {loading ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty title="沒有符合條件的報名資料" />
      ) : (
        <Table headers={['參加者', '聯絡方式', '簽到', '收費']}>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.name}</strong>
                <small>{r.studentId}</small>
                <small>{r.note}</small>
              </td>
              <td>
                {r.email}
                <small>{r.phone}</small>
              </td>
              <td>
                <Button busy={busy === r.id} onClick={() => toggle(r, 'checkedIn')}>
                  {r.checkedIn ? '已簽到' : '確認簽到'}
                </Button>
              </td>
              <td>
                <Button busy={busy === r.id} onClick={() => toggle(r, 'paid')}>
                  {r.paid ? '已收費' : '確認收費'}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Modal>
  );
}
export default function Events() {
  const { data } = useApp();
  const [view, setView] = useState('list'),
    [search, setSearch] = useState(''),
    [edit, setEdit] = useState(null),
    [selected, setSelected] = useState(null);
  const events = (data.events || [])
    .filter((e) => (e.title + e.location).includes(search))
    .sort((a, b) => a.startAt - b.startAt);
  return (
    <>
      <Header title="下一次相聚，從這裡開始。">
        <Button kind="primary" icon="plus" onClick={() => setEdit({})}>
          建立活動
        </Button>
      </Header>
      <div className="toolbar">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            ['list', '活動列表'],
            ['calendar', '行事曆'],
          ]}
        />
        <Search value={search} onChange={setSearch} placeholder="搜尋活動或地點" />
      </div>
      {view === 'calendar' ? (
        <Calendar events={events} onSelect={setSelected} />
      ) : !events.length ? (
        <Panel>
          <Empty title="還沒有活動">建立活動後，即可分享報名連結。</Empty>
        </Panel>
      ) : (
        <div className="record-grid">
          {events.map((e) => (
            <Panel key={e.id}>
              <div className="event-top">
                <div className="date-tile">
                  <small>{new Date(e.startAt).getMonth() + 1} 月</small>
                  <strong>{new Date(e.startAt).getDate()}</strong>
                </div>
                <span className={'tag ' + (!e.published ? 'muted' : '')}>
                  {e.published ? '公開活動' : '草稿'}
                </span>
              </div>
              <h2 className="event-title">{e.title}</h2>
              <p className="caption">
                {dateTime(e.startAt)} · {e.location}
              </p>
              <p className="excerpt">{e.description}</p>
              <div className="panelhead">
                <strong>{e.fee ? money(e.fee) : '免費參加'}</strong>
                <Button onClick={() => setSelected(e)}>管理活動 ↗</Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {edit && <EventForm event={edit} onClose={() => setEdit(null)} />}
      {selected && (
        <EventDetail
          event={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEdit(selected);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
