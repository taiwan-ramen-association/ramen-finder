# 台灣拉麵協會 官方網站

> 台灣拉麵協會（Taiwan Ramen Association）的官方網站與拉麵店家搜尋器。

**網站：** https://taiwan-ramen-association.github.io

---

## 功能

- **拉麵搜尋器** — 互動地圖，依縣市、類型、營業狀態篩選全台 780+ 店家；支援定位、收藏、踩點記錄
- **制霸地圖** — 全台 368 鄉鎮踩點比例視覺化，查看個人制霸程度
- **會員系統** — Google 登入、個人收藏、踩點記錄、排行榜
- **最新消息** — 協會公告與活動資訊
- **合作夥伴** — 協會會員與合作店家一覽
- **關於協會** — 協會介紹、章程、會議紀錄
- **加入會員** — 會員方案說明

---

## 技術架構

純靜態網站，部署於 GitHub Pages。

```
assets/          CSS、圖示、圖片
data/            各頁面 JSON 資料（由 Google Sheets 自動同步）
tools/           本機維護用 Python 工具
.github/         自動同步 CI（Google Sheets ↔ data/data.json）
```

- 店家資料以 Google Sheets 為主要編輯介面，透過 GitHub Actions 每 12 小時自動同步
- 地圖使用 [Leaflet.js](https://leafletjs.com/) + OpenStreetMap / CARTO
- 會員系統使用 Firebase Authentication + Firestore
- 支援 PWA（可安裝為 App，支援離線快取）

---

## 檔案結構

### 頁面
| 檔案 | 說明 |
|---|---|
| `index.html` | 首頁 |
| `finder.html` | 拉麵搜尋器（正式版） |
| `finder-beta.html` | 拉麵搜尋器（測試版） |
| `admin.html` | 後台管理系統 |
| `domination.html` | 制霸地圖 |
| `database.html` | 店家資料庫 |
| `about.html` | 關於協會 |
| `charter.html` | 協會章程 |
| `membership.html` | 入會說明 |
| `meetings.html` | 理監事會議紀錄 |
| `partners.html` | 合作夥伴 |
| `news.html` | 最新消息 |
| `members-zone.html` | 會務專區 |
| `cards.html` | 聊天卡牌 |
| `other.html` | 其他 |

### 資料
| 檔案 | 說明 |
|---|---|
| `data/data.json` | 店家主資料（由 Google Sheets 自動同步） |
| `data/districts.json` | 行政區定義 |
| `data/id_counters.json` | 店家 ID 計數器 |
| `data/instagram.json` | Instagram 貼文快取 |
| `data/about.json` 等 | 各頁面靜態內容 |

### Firebase / PWA
| 檔案 | 說明 |
|---|---|
| `firebase.json` | Firebase CLI 設定 |
| `firestore.indexes.json` | Firestore 複合索引定義 |
| `firebase-messaging-sw.js` | FCM 推播通知 Service Worker |
| `sw.js` | PWA 離線快取 Service Worker |
| `manifest.json` | PWA 設定（App 安裝、圖示） |
| `functions/index.js` | Cloud Functions（FCM 推播） |

### 工具
| 檔案 | 說明 |
|---|---|
| `tools/setup_data.py` | JSON ↔ Excel 資料編輯工具 |
| `tools/git_sync.py` | 一鍵 pull/push 兩個 repo 的工具 |
| `.github/workflows/sync-sheets.yml` | Google Sheets ↔ data.json 自動同步 CI |

---

## 店家資料更新

店家資料維護於 Google Sheets，系統每 12 小時自動同步，一般不需手動操作。

---

## 環境架設

```bash
git clone https://github.com/taiwan-ramen-association/taiwan-ramen-association.github.io.git
cd taiwan-ramen-association.github.io
pip install openpyxl requests gspread google-auth
```

---

## License

© Taiwan Ramen Association. All rights reserved.
