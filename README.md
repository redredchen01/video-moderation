# Video Content Moderation Tool

自動化影片內容合規掃描工具。登入後台 → 爬影片列表 → 關鍵字黑名單比對 → 產出違規報告 + 視覺化 Dashboard。

## Features

- **自動化掃描** — Playwright 驅動，登入後台自動爬取影片標題、標籤、描述、封面圖
- **雙層關鍵字檢測** — VIOLATION（硬違規：未成年、暴力、獸交）+ RISK（風險標記：年齡擦邊、偷拍、亂倫）
- **外部化黑名單** — `data/blacklist.json`，改關鍵字不用動 code
- **多格式報告** — CSV + JSON，帶時間戳歷史保留
- **視覺化 Dashboard** — HTML 總覽報告，含 KPI、類別分佈、關鍵字排行、違規清單
- **封面人工審查** — 互動式 HTML 頁面，點擊標記違規封面，匯出 JSON
- **CLI 參數** — `--headless`、`--max-pages`、`--skip-covers`、`--skip-descriptions`
- **網路容錯** — 封面下載自動重試（指數退避），並發限流
- **OpenHands Plugin** — 附帶 `SKILL.md` + `plugin.json`，可直接作為 AI Agent skill 使用

## Quick Start

```bash
# 1. Clone
git clone https://github.com/redredchen01/video-moderation.git
cd video-moderation

# 2. 安裝（Node.js 18+ 必要）
bash scripts/setup.sh

# 3. 設定帳密
cp .env.example .env
# 編輯 .env：
#   ADMIN_ACCOUNT=你的帳號
#   ADMIN_PASSWORD=你的密碼
#   ADMIN_CARD_NUM=（可選）

# 4. 執行掃描
bash scripts/scan.sh

# 5. 查看報告
open output/dashboard.html
```

## Usage

```bash
# 完整掃描（預設 50 頁）
npm start

# 掃描指定頁數
node src/main.js --max-pages 10

# 無頭模式（CI/伺服器用）
node src/main.js --headless

# 快速掃描（跳過封面下載）
node src/main.js --skip-covers

# 只掃標題和標籤（跳過描述抓取）
node src/main.js --skip-descriptions

# 重新產生 Dashboard（不用重新掃描）
npm run dashboard

# 執行測試
npm test
```

### npm scripts

| 指令 | 說明 |
|------|------|
| `npm start` | 完整掃描 |
| `npm run scan:fast` | 快速掃描（跳過封面+描述） |
| `npm run scan:headless` | 無頭模式掃描 |
| `npm run dashboard` | 重新產生 Dashboard |
| `npm test` | 執行單元測試 |

## Output

掃描完成後，`output/` 目錄會產生：

| 檔案 | 說明 |
|------|------|
| `dashboard.html` | 視覺化總覽（KPI、圖表、排行、清單） |
| `cover-review.html` | 互動式封面審查頁面 |
| `violations.csv` | 最新 CSV 報告 |
| `violations.json` | 最新 JSON 報告 |
| `violations_<timestamp>.csv` | 帶時間戳的歷史 CSV |
| `violations_<timestamp>.json` | 帶時間戳的歷史 JSON |
| `covers/` | 下載的封面圖片 |

## Blacklist

關鍵字黑名單在 `data/blacklist.json`，直接編輯即可，不需改 code：

```bash
# 查看目前黑名單統計
bash scripts/edit-blacklist.sh

# 直接編輯
vim data/blacklist.json
```

結構：

```json
{
  "violations": {
    "underage": ["關鍵字1", "關鍵字2"],
    "violence": ["關鍵字3"],
    "animal": ["關鍵字4"],
    "gore": ["關鍵字5"]
  },
  "risks": {
    "risk_age": ["關鍵字6"],
    "risk_consent": ["關鍵字7"],
    "risk_incest": ["關鍵字8"]
  },
  "violence_patterns": [
    { "regex": "正則表達式", "desc": "描述" }
  ],
  "violence_safe_words": ["不觸發的安全詞"]
}
```

## 切換站台

1. 編輯 `.env` 更新帳密
2. 編輯 `src/config.js` 修改 `baseUrl`
3. 如果選單文字不同，修改 `menuLabel`

詳見 `resources/site-config-guide.md`。

## Project Structure

```
src/
├── main.js            # 主流程：登入 → 爬取 → 檢查 → 報告 → Dashboard
├── config.js          # 設定 + CLI 參數解析
├── login.js           # Playwright 自動登入
├── scraper.js         # 影片列表爬取 + 封面下載
├── checker.js         # 關鍵字比對 + 描述格式檢查
├── blacklist.js       # 從 JSON 載入黑名單
├── reporter.js        # CSV + JSON 報告產出
├── cover-analyzer.js  # 封面審查頁面產生器
├── dashboard.js       # Dashboard HTML 產生器
└── retry.js           # 網路重試（指數退避）
data/
└── blacklist.json     # 關鍵字黑名單（可直接編輯）
scripts/
├── setup.sh           # 一鍵安裝
├── scan.sh            # 執行掃描
├── dashboard.sh       # 重新產生 Dashboard
└── edit-blacklist.sh  # 查看黑名單統計
tests/                 # 單元測試
```

## OpenHands / AI Agent

本工具附帶 OpenHands plugin 結構，AI Agent 可透過 `SKILL.md` 自動操作：

- `.plugin/plugin.json` — Plugin metadata
- `SKILL.md` — Agent 入口文件（含完整操作指南）

## Requirements

- Node.js >= 18
- Playwright Chromium（`setup.sh` 會自動安裝）

## License

ISC
