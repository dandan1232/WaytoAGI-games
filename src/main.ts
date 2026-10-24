import './styles.css';
import { Game } from './game/game';

const root = document.querySelector<HTMLDivElement>('#app')!;
let game: Game | undefined;
try {
  game = new Game(root);
} catch (error) {
  console.error('Unable to initialize the cleaning world', error);
  root.innerHTML = '<main class="fallback"><h1>这个小世界还没能展开。</h1><p>请使用支持 WebGL 2 的新版 Chrome、Edge 或 Safari，检查浏览器硬件加速设置后重试。</p><a href="./">重新打开小世界</a></main>';
}
if (import.meta.hot) import.meta.hot.dispose(() => game?.dispose());
