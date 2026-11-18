import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import * as db from '../firebase.mjs';
import { ROLE_LABELS, MODULE_LABELS } from '../domain.mjs';
import {
  Header,
  Button,
  Panel,
  Empty,
  Modal,
  SaveForm,
  Field,
  Select,
  TextArea,
  Table,
  ConfirmDelete,
  ErrorBox,
} from '../components/ui.jsx';
export function ClubForm({ onClose }) {
  const { user, reload, notify, setClubId } = useApp();
  return (
    <Modal title="建立社團" onClose={onClose}>
      <SaveForm
        onCancel={onClose}
        onSubmit={async (f) => {
          const id = db.newId(),
            now = Date.now();
          await db.save('clubs/' + id, {
            name: f.get('name').trim(),
            description: f.get('description').trim(),
            modules: Object.fromEntries(
              Object.keys(MODULE_LABELS).map((k) => [k, f.get(k) === 'on']),
            ),
            createdAt: now,
            updatedAt: now,
            createdBy: user.uid,
          });
          setClubId(id);
          onClose();
          reload();
          notify('已建立社團，接著到「團隊管理」加入核心幹部');
        }}
      >
        <Field label="社團名稱" name="name" required />
        <TextArea label="社團介紹" name="description" maxLength={2000} />
        <div className="actions wrap">
          {Object.entries(MODULE_LABELS).map(([k, v]) => (
            <label className="checklabel" key={k}>
              <input type="checkbox" name={k} defaultChecked={k === 'feedback'} />
              {v}
            </label>
          ))}
        </div>
        <p className="caption">專屬模組之後可在「團隊管理」調整。</p>
      </SaveForm>
    </Modal>
  );
}

export default function Admin() {
  const { data, club, user, isAdmin, path, reload, notify } = useApp();
  const [edit, setEdit] = useState(null),
    [createClub, setCreateClub] = useState(false),
    [deleting, setDeleting] = useState(null);
  return (
    <>
      <Header title="讓團隊，各就各位。">
        {isAdmin && <Button onClick={() => setCreateClub(true)}>建立社團</Button>}
        <Button kind="primary" icon="plus" onClick={() => setEdit({})}>
          加入成員
        </Button>
      </Header>
      <Panel title="社團設定">
        <SaveForm
          submitLabel="儲存設定"
          onSubmit={async (f) => {
            await db.save(
              'clubs/' + club.id,
              {
                ...club,
                name: f.get('name').trim(),
                description: f.get('description').trim(),
                modules: Object.fromEntries(
                  Object.keys(MODULE_LABELS).map((k) => [k, f.get(k) === 'on']),
                ),
                updatedAt: Date.now(),
              },
              club,
            );
            reload();
            notify('已更新社團設定');
          }}
        >
          <div className="formgrid">
            <Field label="社團名稱" name="name" required defaultValue={club.name} />
            <TextArea
              label="社團介紹"
              name="description"
              maxLength={2000}
              defaultValue={club.description}
            />
          </div>
          <div className="actions wrap">
            {Object.entries(MODULE_LABELS).map(([k, v]) => (
              <label className="checklabel" key={k}>
                <input type="checkbox" name={k} defaultChecked={club.modules[k]} />
                {v}
              </label>
            ))}
          </div>
        </SaveForm>
      </Panel>
      <Panel title="成員與角色" className="section-gap">
        {!data.members?.length ? (
          <Empty title="尚未加入成員" />
        ) : (
          <Table headers={['姓名', '電子郵件', '角色', '操作']}>
            {data.members.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>
                  <small className="break">UID：{m.id}</small>
                </td>
                <td>{m.email}</td>
                <td>
                  <span className="tag">{ROLE_LABELS[m.role]}</span>
                </td>
                <td>
                  <div className="actions">
                    <Button
                      kind="text"
                      disabled={m.id === user.uid && !isAdmin}
                      onClick={() => setEdit(m)}
                    >
                      編輯
                    </Button>
                    <Button kind="text" disabled={m.id === user.uid} onClick={() => setDeleting(m)}>
                      移除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      <Panel title="角色說明" className="section-gap">
        <div className="role-grid">
          <p>
            <strong>核心幹部</strong>
            <br />
            管理所有社團資料、成員、模組及財務。
          </p>
          <p>
            <strong>幹部</strong>
            <br />
            處理公告、任務、會議、活動及已啟用工具。
          </p>
          <p>
            <strong>財務幹部</strong>
            <br />
            具備幹部權限，另可查閱及編輯收支。
          </p>
          <p>
            <strong>社員</strong>
            <br />
            查看與完成自己的任務，使用公開報名與回饋。
          </p>
        </div>
      </Panel>
      {edit && (
        <Modal title={edit.id ? '編輯成員' : '加入成員'} onClose={() => setEdit(null)}>
          <SaveForm
            onCancel={() => setEdit(null)}
            onSubmit={async (f) => {
              const uid = edit.id || f.get('uid').trim();
              if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error('UID 格式不正確');
              await db.save(
                path('members', uid),
                { name: f.get('name').trim(), email: f.get('email').trim(), role: f.get('role') },
                edit.id ? edit : null,
              );
              setEdit(null);
              reload();
              notify('成員已更新');
            }}
          >
            {!edit.id && (
              <Field
                label="使用者 UID"
                name="uid"
                required
                hint="請對方先註冊帳號，再從工作空間的帳號資訊複製 UID。"
              />
            )}
            <Field label="姓名" name="name" required defaultValue={edit.name || ''} />
            <Field
              label="電子郵件"
              name="email"
              type="email"
              required
              defaultValue={edit.email || ''}
            />
            <Select
              label="角色"
              name="role"
              defaultValue={edit.role || 'officer'}
              options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </SaveForm>
        </Modal>
      )}
      {createClub && <ClubForm onClose={() => setCreateClub(false)} />}
      {deleting && (
        <ConfirmDelete
          label={deleting.name + '的社團資格'}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await db.remove(path('members', deleting.id), deleting);
            reload();
          }}
        />
      )}
    </>
  );
}
