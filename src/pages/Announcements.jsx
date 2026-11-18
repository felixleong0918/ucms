import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import * as db from '../firebase.mjs';
import { dateTime } from '../domain.mjs';
import {
  Header,
  Button,
  Panel,
  Empty,
  Modal,
  SaveForm,
  Field,
  TextArea,
  ConfirmDelete,
  ErrorBox,
} from '../components/ui.jsx';
export default function Announcements() {
  const { data, save, path, reload, user, notify } = useApp();
  const [edit, setEdit] = useState(null),
    [deleting, setDeleting] = useState(null),
    [reads, setReads] = useState(null),
    [error, setError] = useState(null);
  async function read(r) {
    try {
      const p = path('announcements', r.id) + '/reads/' + user.uid;
      const old = await db.get(p);
      await db.save(p, { readAt: Date.now() }, old);
      notify('已確認閱讀');
    } catch (e) {
      setError(e);
    }
  }
  async function readList(r) {
    try {
      const list = await db.list(path('announcements', r.id) + '/reads');
      setReads({ title: r.title, list });
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <Header title="重要的事，讓大家知道。">
        <Button kind="primary" icon="plus" onClick={() => setEdit({})}>
          發布公告
        </Button>
      </Header>
      <ErrorBox error={error} />
      {!(data.announcements || []).length ? (
        <Panel>
          <Empty title="還沒有公告">發布第一則公告，讓團隊同步。</Empty>
        </Panel>
      ) : (
        <div className="stack">
          {[...data.announcements]
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
            .map((r) => (
              <Panel
                key={r.id}
                title={r.title}
                action={r.pinned ? <span className="tag">置頂</span> : null}
              >
                <p className="prewrap">{r.body}</p>
                <p className="caption">{dateTime(r.createdAt)}</p>
                <div className="actions wrap">
                  <Button onClick={() => read(r)}>我已閱讀</Button>
                  <Button kind="text" onClick={() => readList(r)}>
                    閱讀狀態
                  </Button>
                  <Button kind="text" onClick={() => setEdit(r)}>
                    編輯
                  </Button>
                  <Button kind="text" onClick={() => setDeleting(r)}>
                    刪除
                  </Button>
                </div>
              </Panel>
            ))}
        </div>
      )}
      {reads && (
        <Modal title="閱讀狀態" onClose={() => setReads(null)}>
          <p>{reads.title}</p>
          {data.members?.map((m) => (
            <div className="simple-row" key={m.id}>
              <span>{m.name}</span>
              <span className="caption">
                {reads.list.some((r) => r.id === m.id) ? '已閱讀' : '尚未閱讀'}
              </span>
            </div>
          ))}
        </Modal>
      )}
      {edit && (
        <Modal title={edit.id ? '編輯公告' : '發布公告'} onClose={() => setEdit(null)}>
          <SaveForm
            onCancel={() => setEdit(null)}
            onSubmit={async (f) => {
              await save(
                'announcements',
                {
                  title: f.get('title').trim(),
                  body: f.get('body').trim(),
                  pinned: f.get('pinned') === 'on',
                },
                edit.id ? edit : null,
              );
              setEdit(null);
            }}
          >
            <Field label="標題" name="title" required defaultValue={edit.title || ''} />
            <TextArea
              label="公告內容"
              name="body"
              required
              maxLength={20000}
              rows={8}
              defaultValue={edit.body || ''}
            />
            <label className="checklabel">
              <input type="checkbox" name="pinned" defaultChecked={edit.pinned} />
              置頂公告
            </label>
          </SaveForm>
        </Modal>
      )}
      {deleting && (
        <ConfirmDelete
          label={deleting.title}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await db.remove(path('announcements', deleting.id), deleting);
            reload();
          }}
        />
      )}
    </>
  );
}
