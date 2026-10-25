# Hướng dẫn upload extension lên Firefox (AMO) và Chrome Web Store

## Chuẩn bị chung (mỗi lần phát hành)

1. Tăng `version` trong [`manifest.json`](../manifest.json) (ví dụ `0.1.0` → `0.1.1`).
   Cả hai store đều từ chối file có version đã upload trước đó.
2. Build:

   ```bash
   ./scripts/build.sh
   ```

   Kết quả trong `dist/`:
   - `mark-as-watched-firefox-<version>.zip`: file upload lên Firefox
   - `mark-as-watched-chrome-<version>.zip`: file upload lên Chrome
3. Lint bản Firefox (phải 0 errors):

   ```bash
   npx web-ext lint --source-dir dist/firefox
   ```

4. Commit, tag rồi push:

   ```bash
   git tag v0.1.1 && git push --tags
   ```

### Tài nguyên cho trang store (làm một lần)

| Thứ | Firefox | Chrome |
| --- | --- | --- |
| Icon 128×128 | có sẵn trong `icons/icon-128.png` | có sẵn trong `icons/icon-128.png` |
| Screenshot | khuyến nghị, kích thước tùy ý | **bắt buộc** ít nhất 1 ảnh, 1280×800 hoặc 640×400 |
| Small promo tile | không cần | **bắt buộc**, 440×280 |
| Mô tả ngắn / dài | bắt buộc | bắt buộc |

Nên chụp 2 ảnh màn hình: menu ⋮ có mục "Mark as watched", và nút dưới video.

Mô tả gợi ý:

> Adds "Mark as watched" to YouTube's ⋮ video menu and a button under the player. One click records
> the video in your YouTube watch history as fully watched. No data is collected; the extension only
> talks to youtube.com using your existing YouTube session.

---

## Firefox: addons.mozilla.org (AMO)

Firefox bản thường chỉ cài được add-on **đã được Mozilla ký**. Có 2 kênh:

| Kênh | Ai thấy | Review | Dùng khi |
| --- | --- | --- | --- |
| **Listed** ("On this site") | Ai cũng tìm thấy trên AMO | Ký tự động, sau đó có thể review thủ công | Muốn chia sẻ công khai |
| **Unlisted** ("On your own") | Chỉ ai có file `.xpi` | Ký tự động, thường vài phút | Chỉ dùng cá nhân |

### Cách 1: upload trên web

1. Đăng nhập <https://addons.mozilla.org/developers/> bằng tài khoản Firefox (Mozilla account).
2. Chọn **Submit a New Add-on**, đọc rồi đồng ý Developer Agreement.
3. Chọn kênh **On this site** (listed) hoặc **On your own** (unlisted).
4. Upload `dist/mark-as-watched-firefox-<version>.zip`. AMO sẽ tự chạy validator, file phải không có lỗi.
5. Câu hỏi về source code: chọn **No**. Code không bị minify hay bundle, nên reviewer đọc trực tiếp được.
6. Listed: điền tên, mô tả, category (ví dụ *Photos, Music & Videos*), license (ví dụ MIT), rồi upload screenshot.
7. Phần **Notes to reviewer** nên giải thích sẵn để review nhanh hơn:

   > The content script runs in the page's MAIN world on www.youtube.com only. When the user clicks
   > "Mark as watched", it reads the video's player response (from the open player or the
   > server-rendered /watch page) and sends YouTube's own playback/watchtime stats pings to
   > www.youtube.com so the video shows as fully watched in the user's history. No data is sent
   > anywhere else, nothing is collected or stored, and no remote code is loaded.

8. Bấm **Submit Version**.
   - Unlisted: đợi email báo ký xong, rồi tải file `.xpi` đã ký ở trang add-on. Kéo file `.xpi` vào Firefox để cài.
   - Listed: add-on lên AMO sau khi qua kiểm tra tự động. Reviewer có thể xem lại sau đó.

Từ lần thứ hai trở đi: vào trang add-on, chọn **Upload New Version**, upload file zip có version mới.

### Cách 2: dùng dòng lệnh (`web-ext sign`)

1. Tạo API key ở <https://addons.mozilla.org/developers/addon/api/key/>. Bạn sẽ có *JWT issuer* và *JWT secret*.
2. Copy `.env.example` thành `.env`, rồi điền `AMO_JWT_ISSUER` và `AMO_JWT_SECRET`.
3. Tăng `version` trong `manifest.json`, rồi chạy:

   ```bash
   ./scripts/publish.sh firefox
   ```

   Script sẽ build, lint, rồi gọi `web-ext sign --channel listed` trên thư mục `dist/firefox/`
   (chỉ gồm `manifest.json`, `src/`, `icons/`, nên `.env` không bao giờ bị upload).
   Nếu chỉ muốn ký để dùng cá nhân, đổi `--channel listed` thành `unlisted` trong
   `scripts/publish.sh`. File `.xpi` đã ký sẽ nằm trong `web-ext-artifacts/`.

   Lần upload **đầu tiên** của một add-on listed nên làm trên web (Cách 1) để điền mô tả.
   Script dùng cho các version sau.

> Không commit `.env`. Cả `.env` và `web-ext-artifacts/` đều đã nằm trong `.gitignore`.

### Lưu ý cho Firefox

- `browser_specific_settings.gecko.id` (`mark-as-watched@quangvu`) là ID cố định của add-on trên AMO. **Không được đổi** sau lần upload đầu, nếu không AMO sẽ coi đây là một add-on khác.
- `data_collection_permissions: { required: ["none"] }` đã khai báo sẵn là không thu thập dữ liệu. AMO bắt buộc khai báo này với add-on mới.
- `strict_min_version: 128.0`: cần Firefox 128 trở lên vì add-on dùng `world: "MAIN"`.

---

## Chrome: Chrome Web Store

### Đăng ký tài khoản developer (một lần)

1. Vào <https://chrome.google.com/webstore/devconsole> bằng tài khoản Google.
2. Đồng ý điều khoản và trả phí đăng ký **5 USD** (trả một lần).
3. Bật **xác minh 2 bước** cho tài khoản Google. Không bật thì không publish được.
4. Ở mục *Account*, điền email liên hệ và xác minh email đó.

### Upload

1. Trong Developer Dashboard, chọn **New item** (hoặc **Add new item**), rồi upload `dist/mark-as-watched-chrome-<version>.zip`.
   Dùng file zip này, **không** dùng zip của Firefox: manifest bản Chrome đã bỏ `browser_specific_settings` và có thêm `minimum_chrome_version`.
2. Tab **Store listing**:
   - Description: mô tả dài (xem gợi ý ở trên)
   - Category: *Entertainment*, hoặc *Tools*
   - Language
   - Icon 128×128, ít nhất 1 screenshot 1280×800, small promo tile 440×280
3. Tab **Privacy** (thiếu phần này thì không submit được):
   - **Single purpose**: "Lets the user mark a YouTube video as watched in their own YouTube watch history."
   - **Permission justification**: extension không xin quyền `permissions` nào. Quyền truy cập host đến từ `content_scripts.matches` (`https://www.youtube.com/*`). Ghi giải thích:
     "Content script is needed on youtube.com to add the menu item / button and to send the watch-history request with the user's own YouTube session."
   - **Are you using remote code?**: **No**. Mọi JavaScript đều nằm trong gói, không tải hay `eval` code từ bên ngoài.
   - **Data usage**: không tick loại dữ liệu nào, rồi tick cả 3 ô cam kết (không bán dữ liệu, không dùng cho mục đích khác, không dùng để xét tín dụng).
   - **Privacy policy URL**: không bắt buộc vì extension không thu thập dữ liệu. Nếu được hỏi, có thể trỏ tới README trên GitHub.
4. Tab **Distribution**:
   - **Public**: ai cũng tìm thấy
   - **Unlisted**: chỉ ai có link
   - **Private**: chỉ những tài khoản bạn thêm vào
   - Chọn quốc gia: *All regions*
5. Bấm **Submit for review**. Review thường mất từ vài ngày đến vài tuần. Kết quả được gửi qua email.

Từ lần thứ hai: mở item, vào tab **Package**, chọn **Upload new package**, upload zip version mới rồi **Submit for review**.

### Publish bằng dòng lệnh (Chrome Web Store API)

Lần đầu vẫn phải upload trên web như trên: tạo item, điền Store listing và Privacy. Sau đó các version mới có thể đẩy bằng lệnh `./scripts/publish.sh chrome`.
Script cần 4 giá trị trong `.env`, lấy **một lần** như sau.

**1. `CWS_EXTENSION_ID`**
Mở item trong Developer Dashboard. ID là chuỗi 32 chữ cái trong URL và ở đầu trang item, ví dụ `abcdefghijklmnopabcdefghijklmnop`.

**2. Bật Chrome Web Store API**
1. Mở <https://console.cloud.google.com/>, tạo project mới, ví dụ đặt tên `cws-publish`.
2. Vào **APIs & Services → Library**, tìm **Chrome Web Store API** rồi bấm **Enable**.

**3. Màn hình đồng ý OAuth (OAuth consent screen)**
1. Vào **APIs & Services → OAuth consent screen**. Ở giao diện mới, mục này tên là **Google Auth Platform → Branding / Audience**.
2. User type chọn **External**. Điền App name (ví dụ `cws-publish`), support email và developer email là email của bạn.
3. Ở mục **Audience**, bấm **Publish app** để chuyển sang *In production*. Không cần qua bước verify của Google.
   Nếu để chế độ *Testing* thì refresh token **hết hạn sau 7 ngày**.

**4. Tạo OAuth Client → `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`**
1. Vào **APIs & Services → Credentials**, chọn **Create credentials → OAuth client ID**.
2. Application type chọn **Web application**.
3. Ở **Authorized redirect URIs**, thêm `https://developers.google.com/oauthplayground`.
4. Bấm **Create**, rồi copy **Client ID** và **Client secret** vào `.env`.

**5. Lấy `CWS_REFRESH_TOKEN` bằng OAuth Playground**
1. Mở <https://developers.google.com/oauthplayground>.
2. Bấm biểu tượng ⚙️ ở góc phải, tick **Use your own OAuth credentials**, rồi dán Client ID và Client secret.
3. Ở ô *Input your own scopes* bên trái, nhập `https://www.googleapis.com/auth/chromewebstore`, rồi bấm **Authorize APIs**.
4. Đăng nhập **đúng tài khoản Google sở hữu item** trên Chrome Web Store. Nếu Google cảnh báo *"Google hasn't verified this app"*, bấm **Advanced → Go to … (unsafe)**. App này là của chính bạn.
5. Bấm **Exchange authorization code for tokens**, rồi copy **Refresh token** vào `.env`.

`.env` lúc này sẽ có dạng:

```bash
AMO_JWT_ISSUER=user:12345:67
AMO_JWT_SECRET=...
CWS_EXTENSION_ID=abcdefghijklmnopabcdefghijklmnop
CWS_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
CWS_CLIENT_SECRET=GOCSPX-...
CWS_REFRESH_TOKEN=1//0g...
```

**6. Publish**

```bash
./scripts/publish.sh chrome     # chỉ Chrome
./scripts/publish.sh all        # cả Firefox và Chrome
```

Script sẽ build, upload `dist/mark-as-watched-chrome-<version>.zip`, rồi submit để review.
Sau khi qua review, Chrome tự publish. Nếu lệnh báo lỗi `invalid_grant` thì refresh token đã hết hạn
hoặc bị thu hồi: làm lại bước 5. Nếu báo lỗi kiểu "item not in draft" hoặc version trùng thì tăng `version` trong `manifest.json`.

### Lưu ý cho Chrome

- Extension cần Chrome 111 trở lên vì dùng `world: "MAIN"`.
- Một khi đã publish thì không xoá được, chỉ *Unpublish*. Muốn thử trước thì chọn **Unlisted** hoặc **Private**.

---

## Rủi ro bị từ chối khi review

Extension gửi các tín hiệu watchtime "giả" (khai là đã xem từ 0 đến hết video) tới YouTube. Reviewer
có thể hiểu nhầm đây là công cụ **tăng lượt xem ảo**, vi phạm chính sách *spam / manipulation* của
Chrome Web Store và điều khoản của YouTube. Để giảm rủi ro:

- Ghi rõ trong mô tả và trong ghi chú cho reviewer: extension chỉ tác động tới **lịch sử xem của
  chính người dùng**, chỉ chạy khi người dùng bấm, mỗi lần một video, không tự động, không chạy hàng loạt.
- Không quảng cáo theo kiểu "tăng view".
- Nếu chỉ dùng cá nhân thì kênh **unlisted** trên AMO (ký tự động) hoặc **Load unpacked** trên Chrome
  là đơn giản nhất, không phải chờ review.
