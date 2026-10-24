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
   npx web-ext lint --source-dir . --ignore-files scripts dist
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
2. Chạy:

   ```bash
   export AMO_JWT_ISSUER="user:12345:67"
   export AMO_JWT_SECRET="..."
   npx web-ext sign --source-dir . --ignore-files scripts dist docs \
     --channel=unlisted \
     --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET"
   ```

   File `.xpi` đã ký sẽ nằm trong `web-ext-artifacts/`. Đổi thành `--channel=listed` nếu muốn đưa lên AMO công khai. Lần đầu dùng listed, nên tạo trang add-on trên web trước để điền mô tả.

> Không commit API key. Thư mục `web-ext-artifacts/` đã nằm trong `.gitignore`.

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
