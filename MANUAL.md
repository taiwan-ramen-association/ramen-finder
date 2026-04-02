# 台灣拉麵協會網站 — 操作手冊

## 目錄結構

```
/
├── index.html          首頁
├── about.html          關於協會
├── news.html           最新消息
├── charter.html        協會章程
├── meetings.html       會議紀錄
├── membership.html     加入會員
├── partners.html       合作夥伴
├── finder.html         拉麵搜尋器
├── style.css           共用樣式
│
├── data.json           店家資料（由 Google Sheets 自動同步）
├── news.json           最新消息
├── about.json          關於協會內容
├── charter.json        協會章程內容
├── meetings.json       會議紀錄清單
├── membership.json     會員方案內容
├── partners.json       合作夥伴清單
├── instagram.json      IG 貼文清單
│
├── icon/               Logo、店家圖示
├── image/              IG 貼文圖片
│
├── tools/              本機工具（Python 腳本）
│   ├── geocode.py          補齊店家座標
│   ├── excel_to_json.py    xlsx → data.json
│   ├── json_to_excel.py    data.json → xlsx（方便用 Excel 編輯）
│   ├── fetch_districts.py  更新行政區劃清單
│   ├── districts.json      內政部行政區劃資料（自動維護）
│   └── data.xlsx           Excel 工作檔（不納入版控）
│
└── .github/workflows/
    └── sync-sheets.yml     自動同步排程
```

---

## 常見操作

### 新增／修改公告

編輯根目錄的 JSON 檔（若有 `announce.json`），或直接修改 `index.html` 中的公告區塊。

---

### 新增最新消息

編輯 `news.json`，新增一筆物件至陣列開頭：

```json
{
  "date": "2026-04-01",
  "title": "標題",
  "body": "內容文字",
  "tag": "公告"
}
```

完成後執行：
```bash
git add news.json
git commit -m "新增消息：標題"
git push
```

---

### 新增會議紀錄

編輯 `meetings.json`，新增一筆：

```json
{
  "date": "2026-04-01",
  "title": "第X次理事會議",
  "summary": "會議摘要",
  "file": ""
}
```

---

### 新增合作夥伴

1. 將 Logo 圖片放入 `icon/` 資料夾
2. 編輯 `partners.json`，新增一筆：

```json
{
  "name": "店家名稱",
  "category": "member",
  "logo": "icon/檔名.png",
  "url": null,
  "featured": true
}
```

`category` 可填：`member`（協會會員）、`ramen`（合作拉麵店）、`partner`（合作商家）

---

### 新增 IG 貼文

1. 將圖片放入 `image/` 資料夾
2. 編輯 `instagram.json`，在陣列開頭新增：

```json
{
  "image": "image/檔名.jpeg",
  "url": "https://www.instagram.com/p/XXXXXX/"
}
```

---

### 新增／修改店家資料

**方式一：透過 Google Sheets（推薦）**
直接在 Google Sheets「總表csv」工作表編輯，系統每 6 小時自動同步至網站。

**方式二：本機 Excel**
```bash
# 1. 產生可編輯的 Excel
python tools/json_to_excel.py

# 2. 用 Excel 開啟 tools/data.xlsx 編輯後存檔

# 3. 轉回 JSON
python tools/excel_to_json.py

# 4. Push
git add data.json
git commit -m "更新店家資料"
git push
```

---

### 補齊店家座標

```bash
python tools/geocode.py
```

執行後選擇模式：
- `1`：只補缺少座標的店家
- `2`：重新更正所有店家座標

---

### 更新行政區劃清單

通常不需要手動執行（每月 1 日自動更新）。若需要立即更新：

```bash
python tools/fetch_districts.py
git add tools/districts.json
git commit -m "更新行政區劃清單"
git push
```

---

## 自動化排程（GitHub Actions）

| 排程 | 工作 |
|------|------|
| 每 6 小時 | Google Sheets → data.json 同步、補齊座標 |
| 每月 1 日 02:00 | 更新行政區劃清單 |
| 推送 data.json 時 | data.json → 回寫 Google Sheets |

手動觸發：GitHub → Actions → Sync Google Sheets → Run workflow

---

## 環境架設（換電腦）

### 需求
- Git
- Python 3.9 以上
- 網路連線

### 步驟

```bash
# 1. Clone 專案
git clone https://github.com/taiwan-ramen-association/taiwan-ramen-association.github.io.git
cd taiwan-ramen-association.github.io

# 2. 安裝 Python 套件
pip install openpyxl requests gspread google-auth
```

### 注意事項
- `tools/data.xlsx` 不納入版控，每次需在本機重新產生（執行 `json_to_excel.py`）
- GitHub Actions 的自動同步不需要本機設定，在 GitHub 雲端執行
- Google Service Account 金鑰只需設定在 GitHub Secrets，本機工具不需要

---

## 網站部署

靜態網站，直接 push 至 `main` branch 即自動部署至 GitHub Pages，無需額外設定。
