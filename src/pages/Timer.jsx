import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context.jsx';
import { parseLevels, timerStart, advanceTimer } from '../domain.mjs';
import {
  Header,
  Button,
  Panel,
  Modal,
  SaveForm,
  Field,
  TextArea,
  Table,
  ErrorBox,
  Confirm,
} from '../components/ui.jsx';
const DEFAULT = '25,50,0,15\n50,100,0,15\n75,150,0,15\n休息,5\n100,200,200,15\n150,300,300,15';
export default function Timer() {
  const { clubId, data, save, notify } = useApp();
  const key = 'ucms-timer-' + clubId;
  const [snapshot] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  });
  const [text, setText] = useState(snapshot?.text || DEFAULT);
  const [levels, setLevels] = useState(() => {
    try {
      return parseLevels(snapshot?.text || DEFAULT);
    } catch {
      return parseLevels(DEFAULT);
    }
  });
  const [state, setState] = useState(() => {
    try {
      const ls = parseLevels(snapshot?.text || DEFAULT);
      return snapshot?.state && snapshot.state.index >= 0 && snapshot.state.index < ls.length
        ? advanceTimer(ls, snapshot.state, Date.now())
        : timerStart(ls);
    } catch {
      return timerStart(parseLevels(DEFAULT));
    }
  });
  const [editing, setEditing] = useState(false),
    [saveDialog, setSaveDialog] = useState(false),
    [confirming, setConfirming] = useState(null),
    [error, setError] = useState(null);
  const display = useRef();
  useEffect(() => {
    if (!state.running) return;
    const t = setInterval(() => setState((s) => advanceTimer(levels, s, Date.now())), 250);
    return () => clearInterval(t);
  }, [state.running, levels]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ text, state }));
    } catch {}
  }, [key, text, state]);
  function apply(value) {
    const ls = parseLevels(value);
    setText(value);
    setLevels(ls);
    setState(timerStart(ls));
  }
  const level = levels[state.index];
  function toggle() {
    setState((s) =>
      s.running
        ? { ...advanceTimer(levels, s, Date.now()), running: false }
        : s.finished
          ? s
          : { ...s, running: true, deadline: Date.now() + s.remaining * 1000 },
    );
  }
  const next = () =>
    setState((s) =>
      s.index + 1 < levels.length
        ? {
            ...s,
            index: s.index + 1,
            remaining: levels[s.index + 1].seconds,
            deadline: s.running ? Date.now() + levels[s.index + 1].seconds * 1000 : 0,
          }
        : { ...s, finished: true, running: false, remaining: 0 },
    );
  return (
    <>
      <Header title="專注賽事的每一刻。">
        <Button onClick={() => setEditing(true)}>設定級別</Button>
        <Button onClick={() => setSaveDialog(true)}>儲存結構</Button>
      </Header>
      <ErrorBox error={error} />
      <div ref={display} className={'timer-stage ' + (level.rest ? 'rest' : '')}>
        <div className="timer-top">
          <span className="tag">
            {state.finished ? '已結束' : level.rest ? '休息時間' : level.label}
          </span>
          <button
            type="button"
            className="button"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await display.current.requestFullscreen();
              } catch {
                setError(Error('此瀏覽器無法開啟全螢幕'));
              }
            }}
          >
            全螢幕
          </button>
        </div>
        <div className="timer-value" role="timer" aria-label="剩餘時間">
          {String(Math.floor(state.remaining / 60)).padStart(2, '0')}
          <span>:</span>
          {String(state.remaining % 60).padStart(2, '0')}
        </div>
        <div className="blind-values">
          <div>
            <span>小盲注</span>
            <strong>{level.small.toLocaleString()}</strong>
          </div>
          <div>
            <span>大盲注</span>
            <strong>{level.big.toLocaleString()}</strong>
          </div>
          <div>
            <span>前注</span>
            <strong>{level.ante.toLocaleString()}</strong>
          </div>
        </div>
        <div className="timer-controls">
          <Button kind="primary" onClick={toggle} disabled={state.finished}>
            {state.running ? '暫停' : state.finished ? '已結束' : '開始 / 繼續'}
          </Button>
          <Button onClick={next} disabled={state.finished}>
            下一級
          </Button>
          <Button
            onClick={() =>
              setConfirming({
                title: '重設計時',
                message: '重設目前計時，從第一級開始？',
                run: () => setState(timerStart(levels)),
              })
            }
          >
            重設
          </Button>
        </div>
        <p className="caption">
          {state.finished
            ? '本場計時已完成'
            : state.running
              ? '計時中 · 背景分頁返回後會依實際時間校正'
              : state.index === 0 && state.remaining === levels[0].seconds
                ? '尚未開始'
                : '已暫停'}
          {levels[state.index + 1]
            ? ` · 下一級：${levels[state.index + 1].rest ? '休息' : levels[state.index + 1].small + ' / ' + levels[state.index + 1].big}`
            : ''}
        </p>
      </div>
      <Panel
        title="盲注結構"
        className="section-gap"
        action={
          <select
            aria-label="載入已存結構"
            value=""
            disabled={state.running}
            onChange={(e) => {
              const s = data.blindStructures?.find((r) => r.id === e.target.value);
              if (s)
                setConfirming({
                  title: '載入盲注結構',
                  message: `載入「${s.title}」將重設計時，確定繼續？`,
                  run: () => apply(s.text),
                });
            }}
          >
            <option value="">載入已存結構</option>
            {(data.blindStructures || []).map((r) => (
              <option value={r.id} key={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        }
      >
        <Table headers={['級別', '小盲 / 大盲', '前注', '時間']}>
          {levels.map((l, i) => (
            <tr key={i} className={i === state.index ? 'current-level' : ''}>
              <td>{l.label}</td>
              <td>{l.rest ? '—' : `${l.small} / ${l.big}`}</td>
              <td>{l.ante}</td>
              <td>{l.seconds / 60} 分鐘</td>
            </tr>
          ))}
        </Table>
        <p className="caption">計時狀態保存在這台瀏覽器，不跨裝置同步。</p>
      </Panel>
      {editing && (
        <Modal title="設定盲注級別" onClose={() => setEditing(false)}>
          <SaveForm
            onCancel={() => setEditing(false)}
            submitLabel="套用並重設"
            onSubmit={async (f) => {
              apply(f.get('levels'));
              setEditing(false);
            }}
          >
            <TextArea
              label="每行：小盲,大盲,前注,分鐘；休息行：休息,分鐘"
              name="levels"
              defaultValue={text}
              rows={10}
              required
            />
            <p className="caption">套用後會重設計時至第一級。</p>
          </SaveForm>
        </Modal>
      )}
      {confirming && (
        <Confirm
          title={confirming.title}
          confirmLabel="確定重設"
          onClose={() => setConfirming(null)}
          onConfirm={async () => {
            try {
              confirming.run();
            } catch (err) {
              setError(err);
            }
          }}
        >
          {confirming.message}
        </Confirm>
      )}
      {saveDialog && (
        <Modal title="儲存盲注結構" onClose={() => setSaveDialog(false)}>
          <SaveForm
            onCancel={() => setSaveDialog(false)}
            onSubmit={async (f) => {
              await save('blindStructures', { title: f.get('title').trim(), text });
              setSaveDialog(false);
              notify('已儲存結構');
            }}
          >
            <Field label="結構名稱" name="title" required />
          </SaveForm>
        </Modal>
      )}
    </>
  );
}
