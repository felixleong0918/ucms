import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import * as db from '../firebase.mjs';
import { inventoryNext, dateTime } from '../domain.mjs';
import { exportExcel } from '../export.mjs';
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
  Table,
  ErrorBox,
} from '../components/ui.jsx';
export default function Inventory() {
  const { data, save, path, user, reload, notify } = useApp();
  const [edit, setEdit] = useState(null),
    [adjust, setAdjust] = useState(null),
    [history, setHistory] = useState(null),
    [search, setSearch] = useState(''),
    [error, setError] = useState(null);
  const rows = (data.inventory || []).filter((r) => (r.name + r.location).includes(search));
  return (
    <>
      <Header title="需要的器材，隨時有數。">
        <Button
          icon="download"
          onClick={async () => {
            try {
              await exportExcel(
                'UCMS-器材庫存',
                ['器材', '數量', '單位', '存放位置', '備註'],
                rows.map((r) => [r.name, r.quantity, r.unit, r.location, r.note]),
              );
            } catch (e) {
              setError(e);
            }
          }}
        >
          匯出 Excel
        </Button>
        <Button kind="primary" icon="plus" onClick={() => setEdit({})}>
          新增器材
        </Button>
      </Header>
      <Panel>
        <div className="toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋器材或位置" />
          <span className="caption">{rows.length} 項器材</span>
        </div>
        <ErrorBox error={error} />
        {!rows.length ? (
          <Empty title="還沒有器材資料">新增器材後，使用「異動」登記入庫數量。</Empty>
        ) : (
          <Table headers={['器材名稱', '庫存', '位置', '操作']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <small>{r.note}</small>
                </td>
                <td>
                  <b className="quantity">{r.quantity}</b> {r.unit}
                </td>
                <td>{r.location}</td>
                <td>
                  <div className="actions wrap">
                    <Button onClick={() => setAdjust(r)}>異動</Button>
                    <Button kind="text" onClick={() => setHistory(r)}>
                      紀錄
                    </Button>
                    <Button kind="text" onClick={() => setEdit(r)}>
                      編輯
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      {edit && (
        <Modal title={edit.id ? '編輯器材' : '新增器材'} onClose={() => setEdit(null)}>
          <SaveForm
            onCancel={() => setEdit(null)}
            onSubmit={async (f) => {
              await save(
                'inventory',
                {
                  name: f.get('name').trim(),
                  unit: f.get('unit').trim(),
                  location: f.get('location').trim(),
                  note: f.get('note').trim(),
                  quantity: edit.quantity || 0,
                  lastMovementId: edit.lastMovementId || '',
                },
                edit.id ? edit : null,
              );
              setEdit(null);
            }}
          >
            <Field label="器材名稱" name="name" required defaultValue={edit.name || ''} />
            <div className="formgrid">
              <Field
                label="單位"
                name="unit"
                maxLength={20}
                required
                defaultValue={edit.unit || '件'}
              />
              <Field label="存放位置" name="location" required defaultValue={edit.location || ''} />
            </div>
            <TextArea label="備註" name="note" maxLength={2000} defaultValue={edit.note || ''} />
            {!edit.id && (
              <p className="caption">初始數量為 0，儲存後登記入庫，確保數量變化都有紀錄。</p>
            )}
          </SaveForm>
        </Modal>
      )}
      {adjust && (
        <Modal title={'庫存異動 · ' + adjust.name} onClose={() => setAdjust(null)}>
          <p>
            目前庫存：
            <strong>
              {adjust.quantity} {adjust.unit}
            </strong>
          </p>
          <SaveForm
            onCancel={() => setAdjust(null)}
            onSubmit={async (f) => {
              const delta = Number(f.get('delta')),
                next = inventoryNext(adjust.quantity, delta),
                id = db.newId(),
                now = Date.now();
              await db.commit([
                db.write(
                  path('inventory', adjust.id),
                  { ...adjust, quantity: next, lastMovementId: id, updatedAt: now },
                  adjust,
                ),
                db.write(path('inventoryMovements', id), {
                  itemId: adjust.id,
                  before: adjust.quantity,
                  after: next,
                  delta,
                  reason: f.get('reason').trim(),
                  createdAt: now,
                  updatedAt: now,
                  createdBy: user.uid,
                }),
              ]);
              setAdjust(null);
              reload();
              notify('已更新庫存並保存異動紀錄');
            }}
          >
            <Field
              label="異動數量"
              type="number"
              name="delta"
              step="1"
              required
              hint="正數為入庫，負數為領出，例如 5 或 -2。"
            />
            <Field label="異動原因" name="reason" required />
          </SaveForm>
        </Modal>
      )}
      {history && (
        <Modal wide title={'異動紀錄 · ' + history.name} onClose={() => setHistory(null)}>
          {!(data.inventoryMovements || []).some((m) => m.itemId === history.id) ? (
            <Empty title="尚無異動紀錄" />
          ) : (
            <Table headers={['時間', '變化', '原因', '操作人']}>
              {data.inventoryMovements
                .filter((m) => m.itemId === history.id)
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((m) => (
                  <tr key={m.id}>
                    <td>{dateTime(m.createdAt)}</td>
                    <td>
                      {m.before} → {m.after} ({m.delta > 0 ? '+' : ''}
                      {m.delta})
                    </td>
                    <td>{m.reason}</td>
                    <td>{data.members?.find((u) => u.id === m.createdBy)?.name || m.createdBy}</td>
                  </tr>
                ))}
            </Table>
          )}
        </Modal>
      )}
    </>
  );
}
