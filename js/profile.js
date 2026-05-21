// ── profile.js ─────────────────────────────────────────────────────────────
// 個人頁主邏輯：載入 profile、4 個 tab 內容、隱私設定
// 依賴全域（profile.html 提供）：
//   auth, db, firebase, targetUid, viewerUid, isSelf
//   showState(id), openPv(url)

// ── 共用：跳脫 HTML ────────────────────────────────────────────────────────
function pfEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ── 共用：店家資料快取 ─────────────────────────────────────────────────────
let _pfShopMap = null;       // ID → shop 物件
async function getShopMap() {
  if (_pfShopMap) return _pfShopMap;
  try {
    const res = await fetch('data/data.json');
    const list = await res.json();
    _pfShopMap = {};
    list.forEach(s => { if (s.ID) _pfShopMap[s.ID] = s; });
    return _pfShopMap;
  } catch (e) {
    console.error('載入 data.json 失敗', e);
    return {};
  }
}

// ── 入口 ────────────────────────────────────────────────────────────────────
async function initProfile(viewerUid, targetUid, isSelf) {
  // 1. 讀 userProfiles/{targetUid}
  let profileDoc = null;
  try {
    const snap = await db.collection('userProfiles').doc(targetUid).get();
    if (!snap.exists) { showState('notFoundState'); return; }
    profileDoc = snap.data();
  } catch (e) {
    console.error('讀取 profile 失敗', e);
    showState('notFoundState');
    return;
  }

  // 2. 隱私檢查：profilePublic === false 且非本人 → 私人
  if (!isSelf && profileDoc.profilePublic === false) {
    showState('privateState');
    return;
  }

  // 3. 顯示 profile content
  showState('profileContent');
  renderHeader(profileDoc, isSelf);

  // 4. 非本人 → 隱藏「踩點」「地圖」tab 與 踩點 stat（userVisits 私人，僅本人可讀）
  if (!isSelf) {
    document.querySelector('.tab-btn[data-tab="visits"]')?.style.setProperty('display', 'none');
    document.querySelector('.tab-btn[data-tab="map"]')?.style.setProperty('display', 'none');
    const visitStat = document.getElementById('statVisits')?.closest('.stat');
    if (visitStat) visitStat.style.display = 'none';
  }

  // 5. 統計數字
  loadStats(targetUid, isSelf);

  // 6. 預設啟動評論 tab
  loadReviewsTab(targetUid);
  bindTabSwitching(targetUid);

  // 6. 本人 → 顯示設定按鈕
  if (isSelf) {
    document.getElementById('settingsBtn').style.display = '';
    bindSettingsModal(targetUid, profileDoc);
  }
}

// ── Header（頭像、暱稱）────────────────────────────────────────────────────
function renderHeader(profile, isSelf) {
  const avatar = document.getElementById('profileAvatar');
  avatar.src = profile.avatarUrl || profile.photoURL || 'assets/icons/03.png';
  avatar.onerror = () => { avatar.src = 'assets/icons/03.png'; };
  document.getElementById('profileNickname').textContent =
    profile.nickname || profile.displayName || '匿名用戶';
  document.title = (profile.nickname || profile.displayName || '個人頁') + ' | 台灣拉麵協會';
}

// ── 統計數字（評論、踩點、菜單）────────────────────────────────────────────
async function loadStats(uid, isSelf) {
  // 評論數（公開）
  db.collection('reviews').where('uid', '==', uid).get()
    .then(snap => { document.getElementById('statReviews').textContent = snap.size; })
    .catch(() => { document.getElementById('statReviews').textContent = '?'; });

  // 踩點數（私人，僅本人可讀）
  if (isSelf) {
    db.collection('userVisits').doc(uid).get()
      .then(snap => {
        const visits = snap.exists ? (snap.data().visits || {}) : {};
        const count = Object.values(visits).filter(v => v && v > 0).length;
        document.getElementById('statVisits').textContent = count;
      })
      .catch(() => { document.getElementById('statVisits').textContent = '?'; });
  }

  // 菜單數（公開）
  db.collection('menus').where('uid', '==', uid).get()
    .then(snap => { document.getElementById('statMenus').textContent = snap.size; })
    .catch(() => { document.getElementById('statMenus').textContent = '?'; });
}

// ── Tab 切換 ────────────────────────────────────────────────────────────────
const _tabLoaded = { reviews: false, visits: false, menus: false, map: false };

function bindTabSwitching(uid) {
  _tabLoaded.reviews = true; // 已預載
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      // 切換 active 狀態
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
      // lazy load
      if (!_tabLoaded[tab]) {
        _tabLoaded[tab] = true;
        if (tab === 'visits') loadVisitsTab(uid);
        else if (tab === 'menus') loadMenusTab(uid);
        else if (tab === 'map')  loadMapTab(uid);
      }
    });
  });
}

// ── Tab 1：評論 ────────────────────────────────────────────────────────────
async function loadReviewsTab(uid) {
  const pane = document.getElementById('reviewsTabPane');
  pane.innerHTML = '<div class="item-loading">載入中…</div>';
  try {
    const snap = await db.collection('reviews')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    if (!snap.docs.length) {
      pane.innerHTML = '<div class="item-empty">尚未發表評論</div>';
      return;
    }
    pane.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const ts = d.createdAt?.toDate?.();
      const dateStr = ts ? ts.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
      const stars = '★'.repeat(d.rating || 0) + '☆'.repeat(5 - (d.rating || 0));
      const photosHtml = (d.photos || []).map(p =>
        `<img class="pf-review-photo" data-url="${pfEscape(p.original)}" src="${pfEscape(p.thumb || p.original)}" alt="">`
      ).join('');
      const shopLink = d.shopId
        ? `<a href="finder.html?id=${pfEscape(d.shopId)}">📍 ${pfEscape(d.shopName || '')}</a>`
        : `📍 ${pfEscape(d.shopName || '')}`;
      return `
        <div class="pf-review-card">
          <div class="pf-review-shop">${shopLink}<span class="pf-review-stars">${stars}</span><span class="pf-review-date">${dateStr}</span></div>
          ${d.text ? `<div class="pf-review-text">${pfEscape(d.text)}</div>` : ''}
          ${photosHtml ? `<div class="pf-review-photos">${photosHtml}</div>` : ''}
        </div>`;
    }).join('');
    // 照片點擊
    pane.querySelectorAll('.pf-review-photo').forEach(img => {
      img.addEventListener('click', () => openPv(img.dataset.url));
    });
  } catch (e) {
    console.error('載入評論失敗', e);
    pane.innerHTML = `<div class="item-empty">載入失敗：${pfEscape(e.message)}</div>`;
  }
}

// ── Tab 2：踩點清單 ────────────────────────────────────────────────────────
async function loadVisitsTab(uid) {
  const pane = document.getElementById('visitsTabPane');
  pane.innerHTML = '<div class="item-loading">載入中…</div>';
  try {
    const [visitSnap, shopMap] = await Promise.all([
      db.collection('userVisits').doc(uid).get(),
      getShopMap()
    ]);
    const visits = visitSnap.exists ? (visitSnap.data().visits || {}) : {};
    const visited = Object.entries(visits).filter(([_, v]) => v && v > 0);
    if (!visited.length) {
      pane.innerHTML = '<div class="item-empty">尚未踩點任何店家</div>';
      return;
    }
    // 排序：以 visit score 由高到低
    visited.sort((a, b) => b[1] - a[1]);
    pane.innerHTML = visited.map(([shopId, score]) => {
      const shop = shopMap[shopId];
      if (!shop) return '';
      const name = shop['店名'] || shopId;
      const addr = shop['地址'] || '';
      return `
        <div class="pf-visit-card">
          <div>
            <a href="finder.html?id=${pfEscape(shopId)}">${pfEscape(name)}</a>
            <div class="pf-visit-meta">${pfEscape(addr)}</div>
          </div>
          <div class="pf-visit-meta">踩點 ${score}</div>
        </div>`;
    }).join('') || '<div class="item-empty">踩點記錄對應的店家資料缺失</div>';
  } catch (e) {
    console.error('載入踩點失敗', e);
    pane.innerHTML = `<div class="item-empty">載入失敗：${pfEscape(e.message)}</div>`;
  }
}

// ── Tab 3：菜單照片 ────────────────────────────────────────────────────────
async function loadMenusTab(uid) {
  const pane = document.getElementById('menusTabPane');
  pane.innerHTML = '<div class="item-loading">載入中…</div>';
  try {
    const snap = await db.collection('menus')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    if (!snap.docs.length) {
      pane.innerHTML = '<div class="item-empty">尚未上傳菜單照片</div>';
      return;
    }
    pane.innerHTML = '<div class="pf-menu-grid">' + snap.docs.map(doc => {
      const d = doc.data();
      const url = d.photo?.original || d.photo?.thumb || '';
      const thumb = d.photo?.thumb || d.photo?.original || '';
      return `
        <div class="pf-menu-card">
          <img class="pf-menu-photo" data-url="${pfEscape(url)}" src="${pfEscape(thumb)}" alt="">
          <div class="pf-menu-shop">📍 ${pfEscape(d.shopName || '')}</div>
        </div>`;
    }).join('') + '</div>';
    pane.querySelectorAll('.pf-menu-photo').forEach(img => {
      img.addEventListener('click', () => openPv(img.dataset.url));
    });
  } catch (e) {
    console.error('載入菜單失敗', e);
    pane.innerHTML = `<div class="item-empty">載入失敗：${pfEscape(e.message)}</div>`;
  }
}

// ── Tab 4：踩點地圖 ────────────────────────────────────────────────────────
async function loadMapTab(uid) {
  const pane = document.getElementById('mapTabPane');
  pane.innerHTML = '<div class="item-loading">載入中…</div>';
  try {
    const [visitSnap, shopMap] = await Promise.all([
      db.collection('userVisits').doc(uid).get(),
      getShopMap()
    ]);
    const visits = visitSnap.exists ? (visitSnap.data().visits || {}) : {};
    const visited = Object.keys(visits).filter(id => visits[id] && visits[id] > 0);

    if (!visited.length) {
      pane.innerHTML = '<div class="item-empty">尚未踩點任何店家</div>';
      return;
    }

    // 重建容器（移除 loading）
    pane.innerHTML = '';
    pane.style.height = '460px';

    const map = L.map(pane).setView([23.97, 120.97], 7);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 18
    }).addTo(map);

    const bounds = [];
    visited.forEach(shopId => {
      const shop = shopMap[shopId];
      if (!shop || !shop.lat || !shop.lng) return;
      const lat = parseFloat(shop.lat), lng = parseFloat(shop.lng);
      if (isNaN(lat) || isNaN(lng)) return;
      const m = L.circleMarker([lat, lng], {
        radius: 7, color: '#fff', weight: 2,
        fillColor: '#C8272D', fillOpacity: 0.9
      }).bindPopup(`<b>${pfEscape(shop['店名'] || '')}</b><br><a href="finder.html?id=${pfEscape(shopId)}">查看詳情</a>`);
      m.addTo(map);
      bounds.push([lat, lng]);
    });

    if (bounds.length === 1) map.setView(bounds[0], 13);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });

    // 切換到此 tab 時需要 invalidateSize（Leaflet 容器隱藏時無法正確計算尺寸）
    setTimeout(() => map.invalidateSize(), 100);
  } catch (e) {
    console.error('載入地圖失敗', e);
    pane.innerHTML = `<div class="item-empty">載入失敗：${pfEscape(e.message)}</div>`;
  }
}

// ── 設定 Modal（本人專用）──────────────────────────────────────────────────
function bindSettingsModal(uid, profile) {
  const modal = document.getElementById('settingsModal');
  const toggle = document.getElementById('publicToggle');
  // 預設行為：missing 或 true 都視為公開
  toggle.checked = profile.profilePublic !== false;

  document.getElementById('settingsBtn').addEventListener('click', () => {
    modal.classList.add('open');
  });
  document.getElementById('settingsCloseBtn').addEventListener('click', () => {
    modal.classList.remove('open');
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open');
  });

  toggle.addEventListener('change', async () => {
    const newVal = toggle.checked;
    toggle.disabled = true;
    try {
      await db.collection('userProfiles').doc(uid).set(
        { profilePublic: newVal },
        { merge: true }
      );
    } catch (e) {
      alert('儲存失敗：' + e.message);
      toggle.checked = !newVal; // revert
    }
    toggle.disabled = false;
  });
}
