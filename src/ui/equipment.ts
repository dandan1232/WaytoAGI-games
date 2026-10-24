import { LEVELS, getLevel } from "../core/levels";
import type { LevelId } from "../core/levels";
const asset = (name: string): string =>
  `${import.meta.env.BASE_URL}products/${name}.webp`;
export const EQUIPMENT = [
  {
    id: "khb-air",
    model: "KHB AIR",
    name: "无线折叠清洗机",
    image: asset("khb-air"),
    use: "单车 · 庭院 · 户外物件",
    description: "展开机身，用水流冲走泥污。今天的庭院，等你洗出好心情。",
  },
  {
    id: "wv2",
    model: "WV 2",
    name: "镜面清洁机",
    image: asset("wv2"),
    use: "玻璃 · 窗户 · 镜面",
    description: "沿着玻璃收走水迹，让窗后的晴天重新变得清晰。",
  },
  {
    id: "sc4d",
    model: "SC4D",
    name: "多功能蒸汽清洁机",
    image: asset("sc4d"),
    use: "硬质地面 · 瓷砖 · 厨房",
    description: "用蒸汽照顾灶台、背墙与地面，带走厨房留下的油污。",
  },
  {
    id: "puzzi-8-1",
    model: "PUZZI 8-1",
    name: "布艺喷抽机",
    image: asset("puzzi-8-1"),
    use: "沙发 · 地毯 · 布艺座椅",
    description: "喷洒、抽吸，让沙发、靠垫与地毯找回柔软的颜色。",
  },
] as const;
export type EquipmentId = (typeof EQUIPMENT)[number]["id"];
export const KHB_IMAGE = EQUIPMENT[0].image;
export const KHB_FOLDED_IMAGE = asset("khb-air-folded");
export function equipmentDetail(
  id: EquipmentId,
  current: LevelId = "courtyard",
): string {
  const product = EQUIPMENT.find((product) => product.id === id)!;
  const level = LEVELS.find((level) => level.product === id)!;
  return `<div class="equipment-photo"><img id="equipment-hero" src="${product.image}" alt="卡赫 ${product.model} ${product.name}产品图" width="768" height="640" decoding="async"></div><div class="equipment-info"><span class="dialog-kicker">${current === level.id ? "当前清洁搭档" : level.name}</span><h3>${product.model}</h3><p class="equipment-name">${product.name}</p><p class="equipment-use">${product.use}</p><p class="equipment-description">${product.description}</p>${id === "khb-air" ? '<div class="equipment-angles"><button class="secondary-button" data-angle="open" aria-pressed="true">展开机身</button><button class="secondary-button" data-angle="folded" aria-pressed="false">折叠收纳</button></div>' : ""}<button class="primary-button" data-level="${level.id}">进入${level.name} <span aria-hidden="true">→</span></button></div>`;
}
export function equipmentLibrary(current: LevelId = "courtyard"): string {
  const level = getLevel(current);
  return `<div class="dialog-heading"><div><span class="dialog-kicker">KÄRCHER / 卡赫清洁装备</span><h2 id="modal-title">选个搭档，出发。</h2></div><button class="icon-button" id="close-equipment" aria-label="关闭装备库">×</button></div><div class="equipment-list" aria-label="选择卡赫设备">${EQUIPMENT.map((product) => `<button class="equipment-choice" data-product="${product.id}" aria-pressed="${level.product === product.id}"><img src="${product.image}" alt="" width="100" height="70"><strong>${product.model}</strong></button>`).join("")}</div><div class="equipment-detail" id="equipment-detail">${equipmentDetail(level.product, current)}</div><button class="text-button" id="return-courtyard">返回场景</button>`;
}
