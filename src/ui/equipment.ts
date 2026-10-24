const asset = (name: string): string => `${import.meta.env.BASE_URL}products/${name}.webp`;

export const EQUIPMENT = [
  { id: 'khb-air', model: 'KHB AIR', name: '无线折叠清洗机', image: asset('khb-air'),
    use: '单车 · 庭院 · 户外物件',
    description: '从沾泥的车架到庭院的一角，用水流洗出日常本来的颜色。展开机身，开始今天的小小焕新。',
    mission: '本关搭档 · 清洗单车、长椅与地砖', available: true },
  { id: 'wv2', model: 'WV 2', name: '镜面清洁机', image: asset('wv2'),
    use: '玻璃 · 窗户 · 镜面',
    description: '为玻璃与镜面而来。沿着表面收走水迹，让窗后的风景重新清晰。',
    mission: '设备展示 · 适合玻璃与镜面清洁任务', available: false },
  { id: 'sc4d', model: 'SC4D', name: '多功能蒸汽清洁机', image: asset('sc4d'),
    use: '硬质地面 · 瓷砖 · 厨房',
    description: '用蒸汽照顾家中的硬质表面，从地面到厨房，发现另一种清洁的节奏。',
    mission: '设备展示 · 适合蒸汽清洁任务', available: false },
  { id: 'puzzi-8-1', model: 'PUZZI 8-1', name: '布艺喷抽机', image: asset('puzzi-8-1'),
    use: '沙发 · 地毯 · 布艺座椅',
    description: '深入织物的清洁搭档。喷洒、抽吸，让沙发与地毯也拥有焕新的时刻。',
    mission: '设备展示 · 适合布艺喷抽任务', available: false },
] as const;

export type EquipmentId = typeof EQUIPMENT[number]['id'];
export const KHB_IMAGE = EQUIPMENT[0].image;
export const KHB_FOLDED_IMAGE = asset('khb-air-folded');

export function equipmentDetail(id: EquipmentId): string {
  const product = EQUIPMENT.find((item) => item.id === id)!;
  return `<div class="equipment-photo"><img id="equipment-hero" src="${product.image}" alt="卡赫 ${product.model} ${product.name}厂商产品图" width="768" height="640" decoding="async"><span class="equipment-photo-note">厂商产品图</span></div>
    <div class="equipment-info"><span class="equipment-status ${product.available ? 'is-current' : ''}">${product.available ? '本关使用' : '认识设备'}</span><h3>${product.model}</h3><p class="equipment-name">${product.name}</p><p class="equipment-use">${product.use}</p><p class="equipment-description">${product.description}</p><p class="equipment-mission" role="status">${product.mission}</p>
    ${product.available ? `<div class="equipment-angles" aria-label="KHB AIR 产品角度"><button class="angle-button active" data-angle="open" aria-pressed="true">展开机身</button><button class="angle-button" data-angle="folded" aria-pressed="false">折叠收纳</button></div>` : '<p class="equipment-preview-note">当前庭院由 KHB AIR 完成清洗。</p>'}</div>`;
}

export function equipmentLibrary(): string {
  return `<div class="equipment-heading"><div><span class="eyebrow">KÄRCHER / 卡赫清洁装备</span><h2 id="modal-title">每一处，都有合适的搭档。</h2></div><button class="equipment-close" id="close-equipment" aria-label="关闭装备库">×</button></div>
    <div class="equipment-list" aria-label="选择查看的卡赫设备">${EQUIPMENT.map((product) => `<button class="equipment-choice ${product.available ? 'active' : ''}" data-product="${product.id}" aria-pressed="${product.available}"><span class="equipment-thumb"><img src="${product.image}" alt="" width="96" height="72" decoding="async"></span><strong>${product.model}</strong><small>${product.name}</small></button>`).join('')}</div>
    <div class="equipment-detail" id="equipment-detail">${equipmentDetail('khb-air')}</div>
    <div class="equipment-bottom"><p>让每一小处，恢复本来的样子。</p><button class="primary-button" id="return-courtyard">返回庭院 <span aria-hidden="true">→</span></button></div>`;
}
