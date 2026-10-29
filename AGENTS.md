# AGENTS.md — 浮水印相機（本專案給常駐 agent 的說明）

## 這是什麼

單頁 PWA：拍照或從相簿選圖 → 浮水印壓進圖裡 → 儲存。全部在瀏覽器裡處理，不上傳照片。

```
index.html          主程式（HTML+CSS+JS 全部在這一檔，約 1700 行）
manifest.json       PWA 資訊（注意 id / start_url 都是相對路徑，因為要跑在 /repo/ 子路徑）
sw.js               service worker（導覽走先網路，資源走快取優先）
icons/              192 / 512 / maskable / apple-touch / favicon
_dev/               驗證工具（不發佈，已在 .gitignore）
README.md           功能清單、已知限制、開發輔助說明
```

## 本機開發

```bash
# 目錄：C:\Users\ray\Desktop\watermark-camera
python -m http.server 8099 --bind 127.0.0.1   # 電腦測試（localhost 算安全來源，相機可用）
```

手機測試（同一個 tailnet）：

```bash
tailscale serve --bg --https=8450 8099
# → https://desktop-2nb1tlr.taila57b2b.ts.net:8450/
```

**規矩**：`tailscale serve` 一律寫明 `--https=<port>`。
**絕對不要碰 443** —— 那是 CloudCLI 的入口（→ 127.0.0.1:3001）。我在 2026-10-28 不小心蓋掉一次，很難查。

## 改完怎麼驗（不要只看「有沒有 200」）

`_dev/` 裡的 `.mjs` 都是**用 CDP 驅動真的 Chrome**（不是 `--virtual-time-budget`，那個會把
`setTimeout` 瞬間跳完，Service Worker 安裝根本來不及，會誤判失敗）。

```bash
node _dev/pwa-probe.mjs            # SW 註冊、預快取清單、斷網後還開得起來
node _dev/framing-probe.mjs        # 假鏡頭（canvas.captureStream）；檢查成品中心像素證明取景置中
node _dev/orient-probe.mjs         # 直/橫/自動：比對「預覽框比例 vs 拍出來的比例」
node _dev/upload-probe.mjs         # 上傳裁切開關四種組合
node _dev/batch-probe.mjs          # 批次：張數、序號遞增、返回狀態
node _dev/library-probe.mjs        # 照片庫流程：單選/多選/點縮圖/重拍/⬇
node _dev/ui-shot.mjs              # 截圖（直式/橫式/放大取景）
```

都可以吃一個參數指定網址，例如驗正式站：

```bash
node _dev/library-probe.mjs https://raywu089457-cmd.github.io/watermark-camera/index.html
```

快速語法檢查（改完 JS 先跑，別只看畫面「有載入」）：

```bash
python - <<'PY'
import re,io
h=io.open('index.html',encoding='utf-8').read()
open('_dev/_check.js','w',encoding='utf-8').write(re.search(r'<script>(.*?)</script>', h, re.S).group(1))
PY
node --check _dev/_check.js
```

> 踩過的坑：`const c` 重複宣告讓整支 JS 掛掉，畫面看起來「有載入」但所有欄位是空的。

## 部署

GitHub Pages，`master` 分支根目錄（legacy build）：

```bash
git add -A && git commit -m "改了什麼" && git push
# 約 1 分鐘後自動生效，用下面確認：
gh api repos/raywu089457-cmd/watermark-camera/pages/builds/latest --jq .status
```

正式站：https://raywu089457-cmd.github.io/watermark-camera/
repo：https://github.com/raywu089457-cmd/watermark-camera （public，免費方案的 Pages 只能公開）

**Pages 子路徑的注意事項**：所有資源都用相對路徑（`./sw.js`、`./manifest.json`、`./icons/…`），
`manifest.json` 的 `id` 用 `"./"` 不是 `"/"`。改路徑時別改成絕對路徑。

## 使用者偏好（照這個做）

- 回覆用**白話繁體中文**，不要術語堆疊
- 不要用互動式選單問問題（他在手機上操作，選單點不到），要問就用純文字列選項
- 驗證要真的跑、拿數據講話；不要說「應該可以」
- 改壞要承認，並說明怎麼修的

## 已知限制（別當成 bug 重做）

- 網頁**無法**列出使用者手機的相簿（瀏覽器沙箱）；只能透過系統選圖視窗
- `navigator.share()` 在某些環境 promise 永遠不回 → 已有 8 秒超時退回下載
- iOS Safari 的下拉重整只能弱化、左右滑返回無法 100% 禁止
- 縮放/拖曳取景只作用在相機拍照，上傳與批次不受影響
