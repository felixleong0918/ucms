import React, { useState, useEffect } from 'react';
import { useApp } from '../context.jsx';
import * as db from '../firebase.mjs';
import { dateTime } from '../domain.mjs';
import { exportExcel } from '../export.mjs';
import {
  Header,
  Button,
  Panel,
  Empty,
  Modal,
  SaveForm,
  Field,
  TextArea,
  ErrorBox,
  Loading,
  Table,
} from '../components/ui.jsx';
export default function Feedback() {
  const { data, path, user, notify } = useApp();
  const [eventId, setEventId] = useState(''),
    [form, setForm] = useState(null),
    [responses, setResponses] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(null),
    [edit, setEdit] = useState(false);
  const events = data.events || [];
  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0].id);
  }, [events, eventId]);
  async function load() {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [f, r] = await Promise.all([
        db.get(path('events', eventId) + '/forms/feedback'),
        db.list(path('events', eventId) + '/responses'),
      ]);
      setForm(f);
      setResponses(r);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [eventId]);
  const average = responses.length
    ? (responses.reduce((n, r) => n + r.rating, 0) / responses.length).toFixed(1)
    : '—';
  return (
    <>
      <Header title="聽見回饋，讓下次更好。">
        {eventId && (
          <>
            <Button
              icon="download"
              onClick={async () => {
                try {
                  await exportExcel(
                    'UCMS-活動回饋',
                    ['提交時間', '評分', '回饋', ...(form?.questions || [])],
                    responses.map((r) => [
                      new Date(r.createdAt).toLocaleString('zh-TW'),
                      r.rating,
                      r.comment,
                      ...(form?.questions || []).map((_, i) => r.answers[String(i)] || ''),
                    ]),
                  );
                } catch (e) {
                  setError(e);
                }
              }}
            >
              匯出 Excel
            </Button>
            <Button kind="primary" onClick={() => setEdit(true)}>
              {form ? '編輯表單' : '建立表單'}
            </Button>
          </>
        )}
      </Header>
      {!events.length ? (
        <Panel>
          <Empty title="請先建立活動">回饋表單會連結至指定活動。</Empty>
        </Panel>
      ) : (
        <>
          <div className="toolbar">
            <label>
              選擇活動{' '}
              <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
            {form && <span className="tag">{form.open ? '開放回覆' : '已關閉'}</span>}
          </div>
          <ErrorBox error={error} retry={load} />
          {loading ? (
            <Loading />
          ) : !form ? (
            <Panel>
              <Empty title="尚未建立回饋表單">表單包含整體評分、文字意見及自訂問題。</Empty>
            </Panel>
          ) : (
            <>
              <div className="stats three">
                <div>
                  <span>回覆人數</span>
                  <strong>{responses.length}</strong>
                </div>
                <div>
                  <span>平均評分</span>
                  <strong>
                    {average}
                    <small> / 5</small>
                  </strong>
                </div>
                <div>
                  <span>表單狀態</span>
                  <strong className="small-stat">{form.open ? '開放中' : '已關閉'}</strong>
                </div>
              </div>
              <div className="dashboard-grid">
                <Panel title="評分分布">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <div className="rating-row" key={n}>
                      <span>{n} 分</span>
                      <meter
                        min="0"
                        max={Math.max(responses.length, 1)}
                        value={responses.filter((r) => r.rating === n).length}
                      />
                      <span>{responses.filter((r) => r.rating === n).length}</span>
                    </div>
                  ))}
                </Panel>
                <Panel title={form.title}>
                  <p>基本題：整體評分、其他建議</p>
                  {form.questions.map((q, i) => (
                    <p className="caption" key={i}>
                      {i + 1}. {q}
                    </p>
                  ))}
                  <p className="caption">參加者從公開活動頁登入後填寫；每位已報名者可提交一次。</p>
                </Panel>
              </div>
              <Panel title="原始回覆" className="section-gap">
                {!responses.length ? (
                  <Empty title="還沒有回覆" />
                ) : (
                  responses
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((r) => (
                      <article className="response" key={r.id}>
                        <div className="panelhead">
                          <span className="tag">{r.rating} / 5</span>
                          <span className="caption">{dateTime(r.createdAt)}</span>
                        </div>
                        <p className="prewrap">{r.comment || '未填寫文字建議'}</p>
                        {form.questions.map((q, i) => (
                          <div key={i}>
                            <strong className="caption">{q}</strong>
                            <p className="prewrap">{r.answers[String(i)] || '未回答'}</p>
                          </div>
                        ))}
                      </article>
                    ))
                )}
              </Panel>
            </>
          )}
        </>
      )}
      {edit && (
        <Modal title={form ? '編輯回饋表單' : '建立回饋表單'} onClose={() => setEdit(false)}>
          <SaveForm
            onCancel={() => setEdit(false)}
            onSubmit={async (f) => {
              const questions = responses.length
                ? form.questions
                : f
                    .get('questions')
                    .split('\n')
                    .map((q) => q.trim())
                    .filter(Boolean);
              if (questions.length > 8 || questions.some((q) => q.length > 200))
                throw Error('最多 8 個自訂問題，每題不超過 200 字');
              const now = Date.now();
              await db.save(
                path('events', eventId) + '/forms/feedback',
                {
                  title: f.get('title').trim(),
                  questions,
                  open: f.get('open') === 'on',
                  createdAt: form?.createdAt || now,
                  createdBy: form?.createdBy || user.uid,
                  updatedAt: now,
                },
                form,
              );
              setEdit(false);
              await load();
              notify('已儲存回饋表單');
            }}
          >
            <Field
              label="表單標題"
              name="title"
              required
              defaultValue={form?.title || '活動回饋'}
            />
            <TextArea
              label="自訂問題（每行一題，最多 8 題）"
              name="questions"
              disabled={responses.length > 0}
              defaultValue={form?.questions.join('\n') || ''}
            />
            {responses.length > 0 && (
              <p className="caption">已有回覆，因此保留問題原文，避免改變既有回答的意義。</p>
            )}
            <label className="checklabel">
              <input type="checkbox" name="open" defaultChecked={form?.open ?? true} />
              開放填寫
            </label>
          </SaveForm>
        </Modal>
      )}
    </>
  );
}
