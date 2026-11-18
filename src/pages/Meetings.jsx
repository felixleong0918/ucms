import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import * as db from '../firebase.mjs';
import { localDate } from '../domain.mjs';
import {
  Header,
  Button,
  Panel,
  Empty,
  Search,
  Modal,
  SaveForm,
  Field,
  TextArea,
  ConfirmDelete,
} from '../components/ui.jsx';
import { TaskForm } from './Tasks.jsx';
export default function Meetings() {
  const { data, save, path, reload } = useApp();
  const [search, setSearch] = useState(''),
    [edit, setEdit] = useState(null),
    [selected, setSelected] = useState(null),
    [task, setTask] = useState(null),
    [deleting, setDeleting] = useState(null);
  const rows = (data.meetings || [])
    .filter((r) => (r.title + r.content + r.decisions).includes(search))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Header title="讓討論，成為行動。">
        <Button kind="primary" icon="plus" onClick={() => setEdit({})}>
          新增會議
        </Button>
      </Header>
      <div className="toolbar">
        <Search value={search} onChange={setSearch} placeholder="搜尋會議與決議" />
      </div>
      {!rows.length ? (
        <Panel>
          <Empty title="還沒有會議紀錄">從第一次會議開始，讓資訊留下來。</Empty>
        </Panel>
      ) : (
        <div className="record-grid">
          {rows.map((r) => (
            <Panel key={r.id} title={r.title} action={<span className="caption">{r.date}</span>}>
              <p className="excerpt">{r.decisions || r.content || '尚未填寫內容'}</p>
              <p className="caption">
                出席：{r.attendees || '未填寫'} · 已連結{' '}
                {data.tasks?.filter((t) => t.meetingId === r.id).length || 0} 個任務
              </p>
              <div className="actions">
                <Button onClick={() => setSelected(r)}>閱讀紀錄</Button>
                <Button kind="text" onClick={() => setTask(r)}>
                  決議轉任務 ↗
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {selected && (
        <Modal wide title={selected.title} onClose={() => setSelected(null)}>
          <p className="caption">
            {selected.date} · {selected.attendees}
          </p>
          <h3>討論內容</h3>
          <div className="prewrap">{selected.content || '未填寫'}</div>
          <h3>會議決議</h3>
          <div className="prewrap">{selected.decisions || '未填寫'}</div>
          <div className="formactions">
            <Button
              kind="text"
              onClick={() => {
                setDeleting(selected);
                setSelected(null);
              }}
            >
              刪除
            </Button>
            <Button
              onClick={() => {
                setEdit(selected);
                setSelected(null);
              }}
            >
              編輯
            </Button>
            <Button
              kind="primary"
              onClick={() => {
                setTask(selected);
                setSelected(null);
              }}
            >
              轉為任務
            </Button>
          </div>
        </Modal>
      )}
      {edit && (
        <Modal wide title={edit.id ? '編輯會議' : '新增會議'} onClose={() => setEdit(null)}>
          <SaveForm
            onCancel={() => setEdit(null)}
            onSubmit={async (f) => {
              await save(
                'meetings',
                {
                  title: f.get('title').trim(),
                  date: f.get('date'),
                  attendees: f.get('attendees').trim(),
                  content: f.get('content').trim(),
                  decisions: f.get('decisions').trim(),
                },
                edit.id ? edit : null,
              );
              setEdit(null);
            }}
          >
            <div className="formgrid">
              <Field label="會議名稱" name="title" required defaultValue={edit.title || ''} />
              <Field
                label="日期"
                name="date"
                type="date"
                required
                defaultValue={edit.date || localDate()}
              />
            </div>
            <Field
              label="出席人員"
              name="attendees"
              maxLength={2000}
              defaultValue={edit.attendees || ''}
            />
            <TextArea
              label="討論內容"
              name="content"
              rows={8}
              maxLength={40000}
              defaultValue={edit.content || ''}
            />
            <TextArea
              label="決議事項"
              name="decisions"
              maxLength={20000}
              defaultValue={edit.decisions || ''}
            />
          </SaveForm>
        </Modal>
      )}
      {task && <TaskForm meeting={task} onClose={() => setTask(null)} />}
      {deleting && (
        <ConfirmDelete
          label={deleting.title}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await db.remove(path('meetings', deleting.id), deleting);
            reload();
          }}
        />
      )}
    </>
  );
}
