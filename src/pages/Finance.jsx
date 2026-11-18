import React, { useState } from 'react';
import { useApp } from '../context.jsx';
import * as db from '../firebase.mjs';
import { money, cents, balance, localDate } from '../domain.mjs';
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
  Select,
  TextArea,
  Table,
  ConfirmDelete,
  ErrorBox,
} from '../components/ui.jsx';
export default function Finance() {
  const { data, save, path, reload, role } = useApp();
  const [edit, setEdit] = useState(null),
    [deleting, setDeleting] = useState(null),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [error, setError] = useState(null);
  const all = data.transactions || [],
    rows = all
      .filter(
        (r) =>
          (r.title + r.category + r.note).includes(search) &&
          (filter === 'all' || r.type === filter),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Header title="每一筆，都記得清楚。">
        <Button
          icon="download"
          onClick={async () => {
            try {
              await exportExcel(
                'UCMS-財務收支',
                ['日期', '項目', '類型', '金額（NT$）', '分類', '備註'],
                rows.map((r) => [
                  r.date,
                  r.title,
                  r.type === 'income' ? '收入' : '支出',
                  r.amount / 100,
                  r.category,
                  r.note,
                ]),
              );
            } catch (e) {
              setError(e);
            }
          }}
        >
          匯出 Excel
        </Button>
        <Button kind="primary" icon="plus" onClick={() => setEdit({})}>
          登記收支
        </Button>
      </Header>
      <div className="stats three">
        <div>
          <span>目前結餘</span>
          <strong>{money(balance(all))}</strong>
        </div>
        <div>
          <span>累計收入</span>
          <strong>
            {money(all.filter((r) => r.type === 'income').reduce((n, r) => n + r.amount, 0))}
          </strong>
        </div>
        <div>
          <span>累計支出</span>
          <strong>
            {money(all.filter((r) => r.type === 'expense').reduce((n, r) => n + r.amount, 0))}
          </strong>
        </div>
      </div>
      <Panel>
        <div className="toolbar">
          <Tabs
            value={filter}
            onChange={setFilter}
            items={[
              ['all', '全部紀錄'],
              ['income', '收入'],
              ['expense', '支出'],
            ]}
          />
          <Search value={search} onChange={setSearch} placeholder="搜尋項目或分類" />
        </div>
        <ErrorBox error={error} />
        {!rows.length ? (
          <Empty title="沒有符合條件的收支紀錄" />
        ) : (
          <Table headers={['日期', '項目', '分類', '金額', '操作']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>
                  <strong>{r.title}</strong>
                  <small>{r.note}</small>
                </td>
                <td>{r.category}</td>
                <td className={r.type === 'income' ? 'positive' : ''}>
                  {r.type === 'income' ? '+' : '−'}
                  {money(r.amount)}
                </td>
                <td>
                  <div className="actions">
                    <Button kind="text" onClick={() => setEdit(r)}>
                      編輯
                    </Button>
                    {role === 'core' && (
                      <Button kind="text" onClick={() => setDeleting(r)}>
                        刪除
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      {edit && (
        <Modal title={edit.id ? '編輯收支' : '登記收支'} onClose={() => setEdit(null)}>
          <SaveForm
            onCancel={() => setEdit(null)}
            onSubmit={async (f) => {
              const amount = cents(f.get('amount'));
              if (!amount) throw Error('金額需大於零');
              await save(
                'transactions',
                {
                  title: f.get('title').trim(),
                  type: f.get('type'),
                  amount,
                  date: f.get('date'),
                  category: f.get('category').trim(),
                  eventId: f.get('eventId'),
                  note: f.get('note').trim(),
                },
                edit.id ? edit : null,
              );
              setEdit(null);
            }}
          >
            <Field label="項目名稱" name="title" required defaultValue={edit.title || ''} />
            <div className="formgrid">
              <Select
                label="類型"
                name="type"
                defaultValue={edit.type || 'income'}
                options={[
                  { value: 'income', label: '收入' },
                  { value: 'expense', label: '支出' },
                ]}
              />
              <Field
                label="金額（NT$）"
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                required
                defaultValue={edit.amount ? edit.amount / 100 : ''}
              />
              <Field
                label="日期"
                type="date"
                name="date"
                required
                defaultValue={edit.date || localDate()}
              />
              <Field
                label="分類"
                name="category"
                maxLength={100}
                required
                defaultValue={edit.category || '其他'}
              />
            </div>
            <Select
              label="關聯活動"
              name="eventId"
              defaultValue={edit.eventId || ''}
              options={[
                { value: '', label: '無' },
                ...(data.events || []).map((e) => ({ value: e.id, label: e.title })),
              ]}
            />
            <TextArea label="備註" name="note" maxLength={5000} defaultValue={edit.note || ''} />
            <p className="caption">僅登記帳目，不執行線上付款或自動對帳。</p>
          </SaveForm>
        </Modal>
      )}
      {deleting && (
        <ConfirmDelete
          label={deleting.title}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await db.remove(path('transactions', deleting.id), deleting);
            reload();
          }}
        />
      )}
    </>
  );
}
