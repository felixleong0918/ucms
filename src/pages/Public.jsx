import React, { useState, useEffect } from 'react';
import * as db from '../firebase.mjs';
import { useApp } from '../context.jsx';
import { money, dateTime } from '../domain.mjs';
import {
  Button,
  Panel,
  Empty,
  Loading,
  ErrorBox,
  Modal,
  SaveForm,
  Field,
  TextArea,
} from '../components/ui.jsx';
import { AuthForm } from './Auth.jsx';
export default function Public({ clubId, eventId }) {
  const { user, notify } = useApp();
  const [clubs, setClubs] = useState([]),
    [events, setEvents] = useState([]),
    [event, setEvent] = useState(null),
    [club, setClub] = useState(null),
    [registration, setRegistration] = useState(null),
    [feedback, setFeedback] = useState(null),
    [response, setResponse] = useState(null),
    [auth, setAuth] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    (async () => {
      if (eventId && clubId) {
        const c = await db.get('clubs/' + clubId);
        const e = await db.get(`clubs/${clubId}/events/${eventId}`);
        if (!e || !e.published) throw Error('活動尚未公開或不存在');
        const f = c?.modules.feedback
          ? await db.get(`clubs/${clubId}/events/${eventId}/forms/feedback`)
          : null;
        const [r, a] = user
          ? await Promise.all([
              db.get(`clubs/${clubId}/events/${eventId}/registrations/${user.uid}`),
              c?.modules.feedback
                ? db.get(`clubs/${clubId}/events/${eventId}/responses/${user.uid}`)
                : null,
            ])
          : [null, null];
        if (live) {
          setClub(c);
          setEvent(e);
          setFeedback(f);
          setRegistration(r);
          setResponse(a);
        }
      } else {
        const cs = await db.list('clubs');
        const lists = await Promise.all(
          cs
            .filter((c) => !clubId || c.id === clubId)
            .map(async (c) =>
              (await db.query(`clubs/${c.id}/events`, 'published', true)).map((e) => ({
                ...e,
                clubId: c.id,
                clubName: c.name,
              })),
            ),
        );
        if (live) {
          setClubs(cs);
          setEvents(
            lists
              .flat()
              .filter((e) => e.endAt >= Date.now())
              .sort((a, b) => a.startAt - b.startAt),
          );
        }
      }
    })()
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [clubId, eventId, user?.uid, version]);
  const base = `clubs/${clubId}/events/${eventId}`;
  const stamp = () => {
    const now = Date.now();
    return { createdAt: now, updatedAt: now, createdBy: user.uid };
  };
  const closed =
    event &&
    (Date.now() >= event.startAt ||
      (event.registrationDeadline && Date.now() > event.registrationDeadline));
  const detail = Boolean(clubId && eventId);

  return (
    <div className="public-page">
      <nav className="public-nav glass" aria-label="公開頁導覽">
        <a className="wordmark" href="#/public">
          ucms
        </a>
        <div className="public-links">
          <a href="#/public">探索活動</a>
          <a href="#/dashboard">社團工作空間</a>
          {user ? (
            <button type="button" className="text-link" onClick={() => db.logout()}>
              登出
            </button>
          ) : (
            <button type="button" className="text-link" onClick={() => setAuth(true)}>
              登入
            </button>
          )}
        </div>
      </nav>

      <main className="public-main">
        <ErrorBox error={error} retry={() => setVersion((n) => n + 1)} />
        {loading ? (
          <Loading />
        ) : detail ? (
          !event ? (
            <Empty
              title="找不到這場活動"
              action={
                <a className="text-link" href="#/public">
                  回到活動列表 ›
                </a>
              }
            />
          ) : (
            <>
              <section className="public-hero">
                <h1>{event.title}</h1>
                <p className="public-meta">
                  {club?.name} · {dateTime(event.startAt)} · {event.location}
                </p>
                <span className="public-price">{event.fee ? money(event.fee) : '免費參加'}</span>
              </section>

              <div className="public-detail">
                <article>
                  <h2>活動介紹</h2>
                  <p className="prewrap lead">{event.description || '主辦社團尚未填寫介紹。'}</p>
                  <dl className="details-list">
                    <dt>時間</dt>
                    <dd>
                      {dateTime(event.startAt)} — {dateTime(event.endAt)}
                    </dd>
                    <dt>地點</dt>
                    <dd>{event.location}</dd>
                    <dt>報名截止</dt>
                    <dd>{dateTime(event.registrationDeadline || event.startAt)}</dd>
                    <dt>費用</dt>
                    <dd>{event.fee ? money(event.fee) + '（現場繳交）' : '免費'}</dd>
                  </dl>
                </article>

                <Panel title={registration ? '報名完成' : '報名'} className="tile">
                  {registration ? (
                    <>
                      <p>{registration.name}，你的報名已保存。</p>
                      <div className="actions wrap">
                        <span className={'tag ' + (registration.checkedIn ? 'done' : '')}>
                          {registration.checkedIn ? '已簽到' : '尚未簽到'}
                        </span>
                        <span className={'tag ' + (registration.paid ? 'done' : '')}>
                          {registration.paid ? '已收費' : '尚未登記收費'}
                        </span>
                      </div>
                    </>
                  ) : closed ? (
                    <Empty title="報名已截止" />
                  ) : !user ? (
                    <>
                      <p>登入或建立帳號後即可填寫報名資料。</p>
                      <Button kind="primary" onClick={() => setAuth(true)}>
                        登入並報名
                      </Button>
                    </>
                  ) : (
                    <SaveForm
                      submitLabel="確認報名"
                      onSubmit={async (f) => {
                        const name = f.get('name').trim();
                        if (!name) throw Error('請填寫姓名');
                        await db.save(base + '/registrations/' + user.uid, {
                          name,
                          email: user.email,
                          studentId: f.get('studentId').trim(),
                          phone: f.get('phone').trim(),
                          note: f.get('note').trim(),
                          checkedIn: false,
                          paid: false,
                          ...stamp(),
                        });
                        setVersion((n) => n + 1);
                        notify('報名成功');
                      }}
                    >
                      <Field label="姓名" name="name" required autoComplete="name" />
                      <Field label="電子郵件" value={user.email} readOnly />
                      <Field label="學號（選填）" name="studentId" maxLength={40} />
                      <Field
                        label="電話（選填）"
                        name="phone"
                        type="tel"
                        maxLength={40}
                        autoComplete="tel"
                      />
                      <TextArea label="備註（選填）" name="note" maxLength={2000} />
                      <p className="caption">
                        聯絡資料僅供活動幹部處理報名。系統不會進行線上扣款。
                      </p>
                    </SaveForm>
                  )}
                </Panel>
              </div>

              {feedback && (
                <section className="feedback-public">
                  <Panel title={feedback.title} className="tile">
                    {response ? (
                      <Empty title="謝謝你的回饋">你已提交評分 {response.rating} / 5。</Empty>
                    ) : !feedback.open ? (
                      <Empty title="回饋已關閉" />
                    ) : !registration ? (
                      <p>已報名的參加者登入後即可填寫回饋。</p>
                    ) : (
                      <SaveForm
                        submitLabel="提交回饋"
                        onSubmit={async (f) => {
                          await db.save(base + '/responses/' + user.uid, {
                            rating: Number(f.get('rating')),
                            comment: f.get('comment').trim(),
                            answers: Object.fromEntries(
                              feedback.questions.map((_, i) => [String(i), f.get('q' + i).trim()]),
                            ),
                            ...stamp(),
                          });
                          setVersion((n) => n + 1);
                          notify('感謝你的回饋');
                        }}
                      >
                        <Field label="整體評分" required>
                          <select name="rating" required defaultValue="">
                            <option value="" disabled>
                              請選擇
                            </option>
                            {[5, 4, 3, 2, 1].map((n) => (
                              <option key={n} value={n}>
                                {n} 分
                              </option>
                            ))}
                          </select>
                        </Field>
                        {feedback.questions.map((q, i) => (
                          <TextArea key={i} label={q} name={'q' + i} maxLength={2000} required />
                        ))}
                        <TextArea label="其他建議（選填）" name="comment" maxLength={5000} />
                        <p className="caption">每位已報名者可提交一次，送出後無法修改。</p>
                      </SaveForm>
                    )}
                  </Panel>
                </section>
              )}
            </>
          )
        ) : (
          <>
            <section className="public-hero">
              <h1>
                好時光。
                <br />
                一起，創造。
              </h1>
              <label className="club-picker">
                <span>社團</span>
                <select
                  value={clubId || ''}
                  onChange={(e) => {
                    location.hash = e.target.value ? '#/public/' + e.target.value : '#/public';
                  }}
                >
                  <option value="">所有社團</option>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>
            <section className="public-events" aria-label="公開活動">
              {!events.length ? (
                <Empty title="目前沒有公開活動">社團發布活動後，會顯示在這裡。</Empty>
              ) : (
                events.map((e) => (
                  <a
                    key={e.clubId + e.id}
                    className="public-event"
                    href={`#/public/${e.clubId}/${e.id}`}
                  >
                    <div className="event-date-display" aria-hidden="true">
                      <span>{new Date(e.startAt).getMonth() + 1} 月</span>
                      <strong>{new Date(e.startAt).getDate()}</strong>
                    </div>
                    <div className="grow">
                      <p className="caption">{e.clubName}</p>
                      <h2>{e.title}</h2>
                      <p className="caption">
                        {dateTime(e.startAt)} · {e.location} · {e.fee ? money(e.fee) : '免費參加'}
                      </p>
                    </div>
                    <span className="text-link">進一步了解 ›</span>
                  </a>
                ))
              )}
            </section>
          </>
        )}
      </main>

      <footer className="public-footer">UCMS · 大學社團整合管理平台</footer>
      {auth && (
        <Modal title="UCMS 帳號" onClose={() => setAuth(false)}>
          <AuthForm onDone={() => setAuth(false)} />
        </Modal>
      )}
    </div>
  );
}
