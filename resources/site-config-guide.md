# Site Configuration Guide

## Switching to a Different Admin Panel

1. **Update `.env`** with new credentials:
   ```
   ADMIN_ACCOUNT=new_username
   ADMIN_PASSWORD=new_password
   ADMIN_CARD_NUM=optional_card
   ```

2. **Update base URL** in `src/config.js`:
   ```js
   baseUrl: 'https://new-site.example.com/admin/index/index',
   ```

3. **Update menu label** if the sidebar text differs:
   ```js
   menuLabel: '视频管理',  // Change to match new site's menu
   ```

## Adapting to Different Table Structures

The scraper expects a LayUI table with these data fields:
- `data-field="id"` — Video ID
- `data-field="3"` — Cover image (img tag inside)
- `data-field="4"` — Title and tags (HTML with `标题：` and `标签：` labels)

If the target site uses different field indices, edit `extractVideosFromPage()` in `src/scraper.js`.

## LayUI Modal for Descriptions

The description is fetched by clicking `a[lay-event="edit"]` buttons and reading `textarea[name="description"]` from the modal. If the edit modal uses different selectors, update `getVideoDescription()` in `src/scraper.js`.
