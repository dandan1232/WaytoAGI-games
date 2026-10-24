import './styles.css';
import { Game } from './game/game';

const root = document.querySelector<HTMLDivElement>('#app')!;
let game: Game | undefined;
try {
  game = new Game(root);
} catch (error) {
  console.error('Unable to initialize the courtyard', error);
  root.innerHTML = '<main class="fallback"><h1>这座庭院还没能展开。</h1><p>请使用支持 WebGL 2 的新版 Chrome、Edge 或 Safari，检查浏览器硬件加速设置后重试。</p><a href="./">重新打开庭院</a></main>';
}
if (import.meta.hot) import.meta.hot.dispose(() => game?.dispose());
