# 浮水印相機（PWA）

不用 build、不用帳號、不上傳照片。拍照或選照片 → 浮水印直接壓進圖裡 → 儲存。
所有處理都在瀏覽器裡（canvas），照片不會離開這台裝置。可加到手機主畫面、離線也能用。

## 檔案

```
index.html          主程式（HTML + CSS + JS 全在裡面）
manifest.json       PWA 資訊（名稱、圖示、standalone）
sw.js               service worker（離線快取）
icons/              192 / 512 / maskable / apple-touch / favicon
_dev/               我驗證用的工具，app 不需要（見下面）
```

## 怎麼開

### 正式版（GitHub Pages）

**https://raywu089457-cmd.github.io/watermark-camera/**

- 公開、HTTPS、不需登入；手機直接開就能拍，也可「加入主畫面」
- repo：https://github.com/raywu089457-cmd/watermark-camera
- 部署方式：Pages 走 `master` 分支根目錄（legacy build），推上去等 ~1 分鐘自動生效
- `_dev/` 在 `.gitignore` 內，不會被發佈

### 本機 / 內網

相機 API 只在 **HTTPS** 或 **localhost** 下才有（service worker 也一樣）：

- **在這台電腦**：`http://127.0.0.1:8099/`
- **手機（同一個 tailnet）**：`https://desktop-2nb1tlr.taila57b2b.ts.net:8450/`（Tailscale，固定 8450，不動 443）
  - 開：`tailscale serve --bg --https=8450 8099`
  - 關：`tailscale serve --https=8450 off`
- **只是想看畫面**：`index.html?demo=1`（假圖，不動相機）；`&wm=bar|corner|tile` 指定樣式

## 加到主畫面（PWA）

- **Android / 桌面 Chrome**：網址列右邊會出現安裝圖示，或頁面下方會跳「安裝到主畫面」按鈕
- **iPhone / iPad**：底部沒有安裝 API，按 **分享 → 加入主畫面**（頁面會提示）
- 加成 App 後是全螢幕、沒有網址列；**沒網路也能拍**（快取 index.html 與圖示）
- 改版後開啟會跳「有新版本・重新載入」。刻意不自動重載，免得正在編輯的照片消失

## 功能

- 即時相機（優先後鏡頭、要求最高解析度）／上傳照片（依 EXIF 轉正，長邊上限 4096）
- **拍照方向**：自動 / 直式（3:4）/ 橫式（4:3）三段切換
  - 選了直或橫就**置中裁切**到那個比例；預覽框用同一個比例、`object-fit: cover`，
    所以「看到的框 = 拍出來的框」（實測 preview 0.75 vs shot 0.75）
  - 自動＝跟鏡頭原本的比例，不裁切
  - 選擇會記住（`wm.orient.v1`）
  - **「選照片時也裁成這個方向」**開關（`wm.cropupload.v1`）：預設關 → 上傳照片只套浮水印、保留原圖；
    開了才會置中裁成所選比例。自動模式下這個開關會灰掉（沒有比例可裁）
- 三種浮水印樣式
  - **資訊條**：滿版深色漸層條 + 藍色細線，可放上方或下方
  - **角落**：半透明圓角底片 + 白字陰影，九宮格選位置，也可直接在畫面上拖
  - **滿版平鋪**：斜向重複，防盜圖用
- 內容欄位
  - **案名 / 地點 / 事項**（留空的不會出現）
  - **戶別**：開關 + 樓層（2–15）與戶別（A–M）兩個下拉，開啟時併進「地點」那一行
    （例：`5樓 C 戶　東側`）
  - 日期、時間（到秒）、GPS 座標＋精度、流水號
- **每個欄位各自存常用值**：欄位右邊「存」→ 下方出現 chip，點一下就填回去；chip 上的 `×` 可刪。
  三個欄位各自獨立，不會互相綁死（存在 `wm.fields.v1`）
- **整套模板**：調好的樣式連同三個欄位的內容一起存（命名、可刪），一個鍵套回去；也會自動記住上次設定
- **流水號**：`NO. 0001` 每拍一張 +1（一張照片只配一次號），可隨時歸零
- 微調：字級、不透明度
- 預覽區縮小（手機 300px 寬 / 34vh，電腦 380px），控制項不用滑很久
- 已關掉瀏覽器手勢：雙擊縮放、兩指縮放、長按選單/選字、下拉重整、左右滑返回、邊緣回彈
- **批次**：一次選多張 → 逐張套同一組浮水印 → 縮圖牆檢查 → 點縮圖單張存，或「全部下載」
  - 流水號會在批次裡逐張遞增（`NO. 0001` → `0002` → …）
  - 時間用**檔案的修改時間**（手機相簿匯出的通常是存檔時間），不是批次處理的當下
  - 逐張處理（不是全部塞進記憶體），長邊仍上限 4096
  - iPhone 一次只能分享一張，所以逐張點；電腦 / Android 可用「全部下載」
- 儲存：`navigator.share`（手機直接進相簿）→ 不支援時退回下載
- 抓不到定位時，狀態只顯示在畫面上，**不會**把錯誤訊息燒進照片

## 資料存在哪

全部在瀏覽器的 `localStorage`（這台裝置、這個網址）：

| key | 內容 |
|---|---|
| `wm.cfg.v1` | 上次的設定（含戶別、樣式、開關） |
| `wm.presets.v1` | 整套模板 |
| `wm.fields.v1` | 三個欄位各自的常用值 |
| `wm.serial.v1` | 流水號目前值 |
| `wm.orient.v1` | 拍照方向（auto / portrait / landscape） |
| `wm.cropupload.v1` | 上傳照片是否也裁成所選方向 |

沒有帳號、沒有後端、不會上傳。換裝置或清瀏覽器資料就沒了。

## 開發輔助（`_dev/`）

app 本身不需要這些：

- `make-icons.py` — 用 PIL 產生全部圖示（改圖示就重跑）
- `shot.html` / `shot2.html` / `shot3.html` — 固定 390px 寬截圖用
- `narrow.html` — 320/360/390/414/480 五個寬度檢查橫向溢出
- `test-fields.html` — 驅動三欄存檔、戶別下拉、匯出 JPEG
- `test-presets.html` — 假設定／假模板，驗模板套用、舊設定遷移、流水號
- `test-pwa.html` — 純 DOM 版的 PWA 檢查（時間會被 virtual-time 影響，僅供參考）
- `orient-probe.mjs` — **驗直/橫/自動**：用 `canvas.captureStream()` 當假鏡頭，
  走真正的 shutter → capture 流程，比對「預覽比例 vs 拍出來的比例」（`node _dev/orient-probe.mjs`）
- `upload-probe.mjs` — **驗上傳裁切開關**：用真的 `File` + `DataTransfer` 丟進 input，
  走真正的 `fromFile()`，比對自動／直式不裁／直式裁／橫式裁四種尺寸（`node _dev/upload-probe.mjs`）
- `batch-probe.mjs` — **驗批次**：造三張不同尺寸的 `File` 丟進 `<input multiple>`，
  檢查張數、序號遞增、狀態文字、返回後狀態（`node _dev/batch-probe.mjs`）
- `ui-shot.mjs` — 用 CDP 截圖（拍照頁直式／橫式、批次縮圖牆）
- `pwa-probe.mjs` — **正式驗證**：用 CDP 實際等 service worker、列出快取內容，
  再斷網重新載入證明離線可用（`node _dev/pwa-probe.mjs`）

## 已知限制

- iOS Safari 的「下拉重整」只能靠 `overscroll-behavior` 處理，部分版本不理；加到主畫面就不會發生
- 左右滑返回是系統層手勢，只能弱化（用 history 釘住），無法 100% 禁止
- 上傳的照片若瀏覽器不支援 `createImageBitmap` 的 EXIF orientation，方向可能不對（現代 Chrome/Safari 都支援）
- 沒有 QR code、沒有地址反查、沒有人臉／物件辨識
- 模板與常用值只存在這台裝置的瀏覽器裡，沒有雲端同步、不能用連結分享
- 改版後 service worker 需要一次重新載入才會生效（導覽刻意走「先網路」）
