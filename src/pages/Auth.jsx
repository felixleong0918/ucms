import React, { useState } from 'react';
import * as db from '../firebase.mjs';
import { SaveForm, Field } from '../components/ui.jsx';

export function AuthForm({ onDone }) {
  const [signup, setSignup] = useState(false);
  return (
    <>
      <h2>{signup ? '建立帳號' : '登入'}</h2>
      <SaveForm
        key={signup ? 'signup' : 'login'}
        submitLabel={signup ? '建立帳號' : '登入'}
        onSubmit={async (f) => {
          const email = f.get('email').trim(),
            password = f.get('password');
          if (signup) {
            const user = await db.register(email, password);
            await db.save('users/' + user.uid, { name: f.get('name').trim(), email: user.email });
          } else {
            const user = await db.login(email, password);
            const profile = await db.get('users/' + user.uid);
            if (!profile)
              await db.save('users/' + user.uid, {
                name: user.email.split('@')[0],
                email: user.email,
              });
          }
          onDone?.();
        }}
      >
        {signup && <Field label="姓名" name="name" autoComplete="name" required />}
        <Field label="電子郵件" name="email" type="email" autoComplete="email" required />
        <Field
          label="密碼"
          name="password"
          type="password"
          minLength={6}
          maxLength={128}
          autoComplete={signup ? 'new-password' : 'current-password'}
          hint={signup ? '至少 6 個字元。' : undefined}
          required
        />
      </SaveForm>
      <p className="auth-switch">
        {signup ? '已有帳號？' : '第一次使用？'}
        <button type="button" className="text-link" onClick={() => setSignup(!signup)}>
          {signup ? '登入' : '建立帳號'}
        </button>
      </p>
      {db.config.mode === 'emulator' && (
        <p className="caption">本機模擬器模式。示範帳號列在 README 的「示範資料」。</p>
      )}
    </>
  );
}

export default function Auth() {
  return (
    <div className="auth-layout">
      <header className="auth-bar">
        <span className="wordmark">ucms</span>
        <a className="text-link" href="#/public">
          探索社團活動 ›
        </a>
      </header>
      <div className="auth-body">
        <div className="auth-story">
          <h1>
            社團大小事。
            <br />
            一處，搞定。
          </h1>
        </div>
        <section className="auth-panel">
          <AuthForm />
        </section>
      </div>
      <footer className="auth-foot">大學社團整合管理平台</footer>
    </div>
  );
}
