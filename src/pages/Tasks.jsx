import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import * as db from '../firebase.mjs';
import { manage, STATUS_LABELS, validTask, dueState } from '../domain.mjs';
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
  Select,
  TextArea,
  ConfirmDelete,
  ErrorBox,
} from '../components/ui.jsx';
export function TaskForm({ task, meeting, onClose }) {
  const { data, save, user } = useApp();
  const members = data.members || [];
  return (
    <Modal title={task ? '編輯任務' : '新增任務'} onClose={onClose}>
      <SaveForm
        onCancel={onClose}
        onSubmit={async (f) => {
          await save(
            'tasks',
            validTask({
              title: f.get('title').trim(),
              description: f.get('description').trim(),
              assigneeId: f.get('assigneeId'),
              dueDate: f.get('dueDate'),
              status: f.get('status'),
              meetingId: task?.meetingId || meeting?.id || '',
            }),
            task,
          );
          onClose();
        }}
      >
        <Field label="任務名稱" name="title" required defaultValue={task?.title || ''} />
        <TextArea
          label="工作內容"
          name="description"
          defaultValue={task?.description || meeting?.decisions || ''}
        />
        <div className="formgrid">
          <Select
            label="負責人"
            name="assigneeId"
            required
            defaultValue={task?.assigneeId || user.uid}
            options={[
              { value: '', label: '請選擇' },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          <Field
            label="截止日期"
            type="date"
            name="dueDate"
            required
            defaultValue={task?.dueDate || ''}
          />
        </div>
        <Select
          label="狀態"
          name="status"
          defaultValue={task?.status || 'todo'}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        {meeting && <p className="caption">此任務將連結至會議：{meeting.title}</p>}
      </SaveForm>
    </Modal>
  );
}
export function TaskRows({ tasks }) {
  const { data, user, save, notify, role } = useApp();
  const [busy, setBusy] = useState('');
  return (
    <div>
      {tasks.map((task) => (
        <div className="task-row" key={task.id}>
          <input
            className="task-check"
            type="checkbox"
            checked={task.status === 'done'}
            disabled={busy === task.id || (!manage(role) && task.assigneeId !== user.uid)}
            aria-label={`完成 ${task.title}`}
            onChange={async (e) => {
              setBusy(task.id);
              try {
                await save('tasks', { ...task, status: e.target.checked ? 'done' : 'todo' }, task);
              } catch (err) {
                notify(err.message);
              } finally {
                setBusy('');
              }
            }}
          />
          <div className="grow">
            <strong className={task.status === 'done' ? 'completed' : ''}>{task.title}</strong>
            <p>
              {data.members?.find((m) => m.id === task.assigneeId)?.name || '我的任務'} ·{' '}
              {task.dueDate}
              {task.meetingId ? ' · 來自會議' : ''}
            </p>
          </div>
          <span className={'tag ' + dueState(task)}>
            {task.status === 'done'
              ? '已完成'
              : dueState(task) === 'overdue'
                ? '已逾期'
                : dueState(task) === 'soon'
                  ? '即將到期'
                  : STATUS_LABELS[task.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
export default function Tasks() {
  const { data, user, role, path, reload, notify } = useApp();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('mine'),
    [edit, setEdit] = useState(null),
    [deleting, setDeleting] = useState(null),
    [error, setError] = useState(null);
  const tasks = (data.tasks || [])
    .filter(
      (t) =>
        (t.title + ' ' + t.description).includes(search) &&
        (filter === 'all' ||
          (filter === 'mine' && t.assigneeId === user.uid) ||
          (filter === 'overdue' && dueState(t) === 'overdue') ||
          (filter === 'done' && t.status === 'done')),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <>
      <Header title="每一件事，都有著落。">
        {manage(role) && (
          <Button kind="primary" icon="plus" onClick={() => setEdit({})}>
            新增任務
          </Button>
        )}
      </Header>
      <Panel>
        <div className="toolbar">
          <Tabs
            value={filter}
            onChange={setFilter}
            items={[
              ['mine', '我的任務'],
              ['all', '全部'],
              ['overdue', '已逾期'],
              ['done', '已完成'],
            ]}
          />
          <Search value={search} onChange={setSearch} placeholder="搜尋工作內容" />
        </div>
        <ErrorBox error={error} />
        {!tasks.length ? (
          <Empty title="目前沒有符合條件的任務">新增任務，或調整篩選條件。</Empty>
        ) : (
          tasks.map((t) => (
            <div className="task-group" key={t.id}>
              <TaskRows tasks={[t]} />
              {(t.description || manage(role)) && (
                <div className="task-details">
                  <p className="prewrap">{t.description}</p>
                  {manage(role) && (
                    <div className="actions">
                      <Button kind="text" onClick={() => setEdit(t)}>
                        編輯
                      </Button>
                      <Button kind="text" onClick={() => setDeleting(t)}>
                        刪除
                      </Button>
                      <select
                        aria-label={`${t.title}的狀態`}
                        value={t.status}
                        onChange={async (e) => {
                          try {
                            await db.save(
                              path('tasks', t.id),
                              { ...t, status: e.target.value, updatedAt: Date.now() },
                              t,
                            );
                            reload();
                            notify('已更新狀態');
                          } catch (err) {
                            setError(err);
                          }
                        }}
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </Panel>
      {edit && <TaskForm task={edit.id ? edit : null} onClose={() => setEdit(null)} />}
      {deleting && (
        <ConfirmDelete
          label={deleting.title}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await db.remove(path('tasks', deleting.id), deleting);
            reload();
          }}
        />
      )}
    </>
  );
}
