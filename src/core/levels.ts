import type { TaskId } from "./cleaning";

export const LEVELS = [
  {
    id: "courtyard",
    name: "庭院日常",
    shortName: "庭院",
    title: "把好心情，冲洗出来。",
    description: "洗净单车、长椅和地砖，给小院一个晴天。",
    product: "khb-air",
    model: "KHB AIR",
    tool: "清洗机",
    action: "冲洗",
    mode: "water",
    color: "#ffd524",
    background: "#d3eafb",
    tasks: ["bicycle", "bench", "paving"],
  },
  {
    id: "glass",
    name: "晴天窗边",
    shortName: "窗边",
    title: "擦亮一扇窗，收集一片晴。",
    description: "沿着玻璃收走水迹，让窗后的风景重新清晰。",
    product: "wv2",
    model: "WV 2",
    tool: "镜面清洁机",
    action: "擦拭",
    mode: "squeegee",
    color: "#75d8c6",
    background: "#d9f2ec",
    tasks: ["window-left", "window-center", "window-right"],
  },
  {
    id: "kitchen",
    name: "元气厨房",
    shortName: "厨房",
    title: "给烟火气，洗个热水澡。",
    description: "用蒸汽带走灶台和瓷砖上的油污，重新开张。",
    product: "sc4d",
    model: "SC4D",
    tool: "蒸汽清洁机",
    action: "蒸汽清洁",
    mode: "steam",
    color: "#ffac84",
    background: "#fae4d8",
    tasks: ["stove", "backsplash", "kitchen-floor"],
  },
  {
    id: "fabric",
    name: "柔软客厅",
    shortName: "客厅",
    title: "把柔软，也照顾好。",
    description: "喷洒、抽吸，让沙发、靠垫和地毯恢复颜色。",
    product: "puzzi-8-1",
    model: "PUZZI 8-1",
    tool: "布艺喷抽机",
    action: "喷抽",
    mode: "extraction",
    color: "#c3b0f3",
    background: "#e9e3fa",
    tasks: ["sofa", "cushion", "rug"],
  },
] as const satisfies readonly {
  id: string;
  name: string;
  shortName: string;
  title: string;
  description: string;
  product: string;
  model: string;
  tool: string;
  action: string;
  mode: string;
  color: string;
  background: string;
  tasks: readonly TaskId[];
}[];

export type Level = (typeof LEVELS)[number];
export type LevelId = Level["id"];
export type ToolMode = Level["mode"];
export const getLevel = (id: LevelId): Level =>
  LEVELS.find((level) => level.id === id)!;
export const isLevelId = (id: unknown): id is LevelId =>
  LEVELS.some((level) => level.id === id);
