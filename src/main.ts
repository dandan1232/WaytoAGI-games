import { CleaningSession } from './core/cleaning';

const session = new CleaningSession([]);
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main style="font-family:system-ui,sans-serif;max-width:720px;margin:12vh auto;padding:32px;background:#f8f6ed;border-radius:24px;color:#252b27">
    <p style="letter-spacing:.16em;font-size:12px">CLEAN A LITTLE / 工程里程碑 M2</p>
    <h1>清洁一平方米</h1>
    <p>清洁与存档模块已准备好。下一里程碑接入可玩的 3D 微缩庭院。</p>
    <p>初始清洁进度：${session.progress * 100}%</p>
    <p>开发与验收记录见仓库 docs/。</p>
  </main>`;
