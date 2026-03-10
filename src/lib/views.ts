type CertificateView = {
  id: string;
  qqNumber: string;
  ownerName: string;
  filePath: string;
  originalFileName?: string | null;
  createdAt: Date;
};

type TrackingView = {
  id: string;
  qqNumber: string;
  ownerName: string;
  trackingNumber: string;
  createdAt: Date;
};

const DISPLAY_TIME_ZONE = "Asia/Shanghai";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: DISPLAY_TIME_ZONE,
});

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDate = (date: Date) => dateTimeFormatter.format(date);

const renderFlash = (message?: string, type: "success" | "error" = "success") => {
  if (!message) {
    return "";
  }

  return `<div class="notice ${type}">${escapeHtml(message)}</div>`;
};

const renderAdminBatchUploadScript = () => `
  <script>
    (() => {
      const form = document.querySelector("[data-batch-upload-form]");

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const input = form.querySelector('input[name="files"]');
      const submitButton = form.querySelector("[data-upload-submit]");
      const progress = form.querySelector("[data-upload-progress]");
      const summary = form.querySelector("[data-upload-summary]");
      const list = form.querySelector("[data-upload-list]");

      if (
        !(input instanceof HTMLInputElement) ||
        !(submitButton instanceof HTMLButtonElement) ||
        !(progress instanceof HTMLProgressElement) ||
        !(summary instanceof HTMLDivElement) ||
        !(list instanceof HTMLUListElement)
      ) {
        return;
      }

      const setSummary = (message, isError) => {
        summary.hidden = false;
        summary.className = "notice upload-summary " + (isError ? "error" : "success");
        summary.textContent = message;
      };

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const files = Array.from(input.files || []).filter((file) => file.size > 0);

        if (files.length === 0) {
          setSummary("请至少选择一个文件。", true);
          return;
        }

        submitButton.disabled = true;
        input.disabled = true;
        progress.hidden = false;
        progress.max = files.length;
        progress.value = 0;
        list.hidden = false;
        list.innerHTML = "";

        let successCount = 0;
        let failedCount = 0;

        setSummary("开始逐个上传文件，请不要关闭当前页面。", false);

        for (const file of files) {
          const item = document.createElement("li");
          item.className = "upload-item running";
          item.textContent = file.name + "：上传中...";
          list.appendChild(item);

          const formData = new FormData();
          formData.append("file", file);

          try {
            const response = await fetch("/admin/certificates/import", {
              method: "POST",
              body: formData,
              credentials: "same-origin",
            });

            if (response.status === 401) {
              window.location.href =
                "/admin?error=" + encodeURIComponent("登录状态已失效，请重新登录后再试。");
              return;
            }

            const result = await response.json().catch(() => null);

            if (!response.ok || !result || result.ok !== true) {
              throw new Error(
                result && typeof result.error === "string"
                  ? result.error
                  : "导入失败，请稍后重试。"
              );
            }

            successCount += 1;
            item.className = "upload-item success";
            item.textContent = file.name + "：导入成功";
          } catch (error) {
            failedCount += 1;
            item.className = "upload-item error";
            item.textContent =
              file.name +
              "：" +
              (error instanceof Error ? error.message : "导入失败，请稍后重试。");
          }

          progress.value = successCount + failedCount;
        }

        submitButton.disabled = false;
        input.disabled = false;
        form.reset();

        if (failedCount === 0) {
          window.location.href =
            "/admin?message=" +
            encodeURIComponent("批量导入完成，共成功导入 " + successCount + " 个文件。");
          return;
        }

        setSummary(
          "批量导入完成：成功 " +
            successCount +
            " 个，失败 " +
            failedCount +
            " 个。成功的文件已经入库，刷新页面即可看到最新列表；失败文件请按列表逐项处理后重试。",
          true
        );
      });
    })();
  </script>
`;

const layout = (title: string, content: string) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f8fafc;
        --panel: #ffffff;
        --text: #0f172a;
        --muted: #64748b;
        --line: #e2e8f0;
        --primary: #334155;
        --primary-soft: #e2e8f0;
        --danger: #b91c1c;
        --danger-soft: #fee2e2;
        --success: #166534;
        --success-soft: #dcfce7;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: linear-gradient(180deg, #ffffff 0%, var(--bg) 100%);
        color: var(--text);
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      .shell {
        min-height: 100vh;
        padding: 32px 20px 56px;
      }

      .center {
        min-height: calc(100vh - 88px);
        display: grid;
        place-items: center;
      }

      .card {
        width: min(100%, 440px);
        background: var(--panel);
        border: 1px solid rgba(226, 232, 240, 0.9);
        border-radius: 24px;
        padding: 32px;
      }

      .wide-card {
        width: min(100%, 1120px);
        background: var(--panel);
        border: 1px solid rgba(226, 232, 240, 0.9);
        border-radius: 28px;
        padding: 28px;
      }

      h1, h2, h3, p {
        margin: 0;
      }

      h1 {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      h2 {
        font-size: 20px;
        font-weight: 700;
      }

      p.subtle {
        margin-top: 10px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .stack {
        display: grid;
        gap: 14px;
        margin-top: 26px;
      }

      label {
        display: grid;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
      }

      input,
      button,
      .button-link {
        font: inherit;
      }

      input[type="text"],
      input[type="password"],
      input[type="file"] {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #fff;
        padding: 12px 14px;
        color: var(--text);
      }

      input:focus {
        outline: 2px solid #cbd5e1;
        outline-offset: 1px;
      }

      button,
      .button-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: none;
        border-radius: 14px;
        background: var(--primary);
        color: #fff;
        padding: 12px 16px;
        cursor: pointer;
        transition: opacity 0.2s ease;
      }

      button.secondary,
      .button-link.secondary {
        background: var(--primary-soft);
        color: var(--text);
      }

      button.danger {
        background: #111827;
      }

      button:hover,
      .button-link:hover {
        opacity: 0.9;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 8px;
      }

      .notice {
        border-radius: 14px;
        padding: 12px 14px;
        font-size: 14px;
        line-height: 1.6;
      }

      .notice.success {
        background: var(--success-soft);
        color: var(--success);
      }

      .notice.error {
        background: var(--danger-soft);
        color: var(--danger);
      }

      .topbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }

      .meta {
        display: grid;
        gap: 6px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 6px 12px;
        background: #f1f5f9;
        color: #334155;
        font-size: 12px;
        width: fit-content;
      }

      .grid {
        display: grid;
        gap: 20px;
      }

      .grid.two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .panel {
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 22px;
        background: #fff;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }

      th,
      td {
        padding: 14px 10px;
        text-align: left;
        border-bottom: 1px solid var(--line);
        font-size: 14px;
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-weight: 600;
      }

      .muted {
        color: var(--muted);
      }

      .empty {
        padding: 28px 0 12px;
        color: var(--muted);
        text-align: center;
      }

      .table-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .inline {
        display: inline;
      }

      .hint {
        margin-top: 10px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }

      .upload-summary {
        margin-top: 14px;
      }

      .upload-progress {
        width: 100%;
        height: 10px;
      }

      .upload-list {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 8px;
        max-height: 220px;
        overflow: auto;
      }

      .upload-item {
        font-size: 13px;
        line-height: 1.6;
      }

      .upload-item.running {
        color: var(--muted);
      }

      .upload-item.success {
        color: var(--success);
      }

      .upload-item.error {
        color: var(--danger);
      }

      button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      @media (max-width: 880px) {
        .grid.two {
          grid-template-columns: 1fr;
        }

        .wide-card,
        .card {
          padding: 22px;
          border-radius: 22px;
        }

        .topbar {
          align-items: flex-start;
        }

        table,
        thead,
        tbody,
        th,
        td,
        tr {
          display: block;
        }

        thead {
          display: none;
        }

        tr {
          border-bottom: 1px solid var(--line);
          padding: 12px 0;
        }

        td {
          border: none;
          padding: 8px 0;
        }

        td::before {
          content: attr(data-label);
          display: block;
          color: var(--muted);
          font-size: 12px;
          margin-bottom: 4px;
        }
      }
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`;

export const renderHomePage = ({
  step = "qq",
  qqNumber = "",
  message,
  error,
}: {
  step?: "qq" | "verify";
  qqNumber?: string;
  message?: string;
  error?: string;
}) =>
  layout(
    "证书查询登录",
    `
      <main class="shell center">
        <section class="card">
          <div class="pill">证书发放系统</div>
          <h1 style="margin-top: 16px;">证书查询</h1>
          <p class="subtle">输入 QQ 号获取邮箱验证码，验证通过后即可查看证书文件并查询快递单号。</p>
          <div class="stack">
            ${renderFlash(message, "success")}
            ${renderFlash(error, "error")}
            ${
              step === "verify"
                ? `
                  <form method="post" action="/auth/verify" class="stack">
                    <label>
                      QQ 号
                      <input type="text" name="qqNumber" value="${escapeHtml(qqNumber)}" readonly />
                    </label>
                    <label>
                      验证码
                      <input type="text" name="code" inputmode="numeric" maxlength="6" placeholder="请输入 6 位验证码" />
                    </label>
                    <div class="actions">
                      <button type="submit">立即验证</button>
                      <a class="button-link secondary" href="/">返回上一步</a>
                    </div>
                    <p class="hint">验证码会发送到 ${escapeHtml(
                      qqNumber || "您的 QQ 邮箱"
                    )}@qq.com，10 分钟内有效。</p>
                  </form>
                `
                : `
                  <form method="post" action="/auth/send-code" class="stack">
                    <label>
                      QQ 号
                      <input type="text" name="qqNumber" inputmode="numeric" maxlength="12" placeholder="请输入您的 QQ 号" />
                    </label>
                    <div class="actions">
                      <button type="submit">发送验证码</button>
                      <a class="button-link secondary" href="/admin">管理员入口</a>
                    </div>
                    <p class="hint">系统会将验证码发送到对应的 QQ 邮箱，例如 <span class="muted">123456789@qq.com</span>。</p>
                  </form>
                `
            }
          </div>
        </section>
      </main>
    `
  );

export const renderDashboardPage = ({
  qqNumber,
  certificates,
  trackings,
  message,
  error,
}: {
  qqNumber: string;
  certificates: CertificateView[];
  trackings: TrackingView[];
  message?: string;
  error?: string;
}) =>
  layout(
    "我的证书",
    `
      <main class="shell">
        <section class="wide-card">
          <div class="topbar">
            <div class="meta">
              <div class="pill">已登录</div>
              <h1>我的证书</h1>
              <p class="subtle">当前 QQ 号：${escapeHtml(
                qqNumber
              )}。您可以在线查看证书文件并查询快递单号。</p>
            </div>
            <form method="post" action="/logout">
              <button type="submit" class="secondary">退出登录</button>
            </form>
          </div>
          ${renderFlash(message, "success")}
          ${renderFlash(error, "error")}
          <div class="stack">
            <section class="panel">
              <h2>证书文件</h2>
              <p class="subtle">您可以在线查看或下载自己的证书文件。</p>
              ${
                certificates.length === 0
                  ? `<div class="empty">当前没有可领取的证书，请稍后再试或联系管理员。</div>`
                  : `
                    <table>
                      <thead>
                        <tr>
                          <th>证书归属人</th>
                          <th>文件名称</th>
                          <th>创建时间</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${certificates
                          .map(
                            (certificate) => `
                              <tr>
                                <td data-label="证书归属人">${escapeHtml(
                                  certificate.ownerName
                                )}</td>
                                <td data-label="文件名称">${escapeHtml(
                                  certificate.originalFileName ||
                                    certificate.filePath
                                )}</td>
                                <td data-label="创建时间">${escapeHtml(
                                  formatDate(certificate.createdAt)
                                )}</td>
                                <td data-label="操作">
                                  <div class="table-actions">
                                    <a class="button-link secondary" target="_blank" href="/certificates/${escapeHtml(
                                      certificate.id
                                    )}/download?mode=view">查看</a>
                                    <a class="button-link" href="/certificates/${escapeHtml(
                                      certificate.id
                                    )}/download">下载</a>
                                  </div>
                                </td>
                              </tr>
                            `
                          )
                          .join("")}
                      </tbody>
                    </table>
                  `
              }
            </section>
            <section class="panel">
              <h2>快递单号</h2>
              <p class="subtle">管理员上传的证书快递单号会显示在这里。</p>
              ${
                trackings.length === 0
                  ? `<div class="empty">当前没有可查询的快递单号记录。</div>`
                  : `
                    <table>
                      <thead>
                        <tr>
                          <th>昵称</th>
                          <th>快递单号</th>
                          <th>创建时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${trackings
                          .map(
                            (tracking) => `
                              <tr>
                                <td data-label="昵称">${escapeHtml(
                                  tracking.ownerName
                                )}</td>
                                <td data-label="快递单号">${escapeHtml(
                                  tracking.trackingNumber
                                )}</td>
                                <td data-label="创建时间">${escapeHtml(
                                  formatDate(tracking.createdAt)
                                )}</td>
                              </tr>
                            `
                          )
                          .join("")}
                      </tbody>
                    </table>
                  `
              }
            </section>
          </div>
        </section>
      </main>
    `
  );

export const renderAdminLoginPage = ({
  message,
  error,
}: {
  message?: string;
  error?: string;
}) =>
  layout(
    "管理员登录",
    `
      <main class="shell center">
        <section class="card">
          <div class="pill">隐藏入口</div>
          <h1 style="margin-top: 16px;">管理员登录</h1>
          <p class="subtle">输入管理员密码后可管理证书、导入快递单号并执行批量导入。</p>
          <div class="stack">
            ${renderFlash(message, "success")}
            ${renderFlash(error, "error")}
            <form method="post" action="/admin/login" class="stack">
              <label>
                管理员密码
                <input type="password" name="password" placeholder="请输入管理员密码" />
              </label>
              <div class="actions">
                <button type="submit">登录后台</button>
                <a class="button-link secondary" href="/">返回首页</a>
              </div>
            </form>
          </div>
        </section>
      </main>
    `
  );

export const renderAdminDashboardPage = ({
  certificates,
  trackings,
  message,
  error,
}: {
  certificates: CertificateView[];
  trackings: TrackingView[];
  message?: string;
  error?: string;
}) => {
  const reminderRecipientCount = new Set(
    certificates.map((certificate) => certificate.qqNumber)
  ).size;

  return layout(
    "证书管理后台",
    `
      <main class="shell">
        <section class="wide-card">
          <div class="topbar">
            <div class="meta">
              <div class="pill">管理员后台</div>
              <h1>证书管理</h1>
              <p class="subtle">支持证书上传、批量导入、文件删除和下载校验。快递单号请在下方 CSV 模块导入。批量文件命名格式为 <span class="muted">QQ号_姓名.pdf</span>。</p>
            </div>
            <form method="post" action="/admin/logout">
              <button type="submit" class="secondary">退出后台</button>
            </form>
          </div>
          ${renderFlash(message, "success")}
          ${renderFlash(error, "error")}
          <section class="panel" style="margin-top: 22px;">
            <h2>领取提醒邮件</h2>
            <p class="subtle">当前共有 ${escapeHtml(
              String(certificates.length)
            )} 份证书记录、${escapeHtml(
              String(reminderRecipientCount)
            )} 个 QQ 邮箱待通知。系统会按 QQ 号去重，每个邮箱只发送 1 封提醒邮件。</p>
            ${
              certificates.length === 0
                ? `<p class="hint">暂无可提醒用户，请先录入证书后再发送邮件。</p>`
                : `
                  <form
                    method="post"
                    action="/admin/reminders/send-all"
                    class="actions"
                    onsubmit="return window.confirm('将向全部有证书记录的 QQ 邮箱发送领取提醒邮件，是否继续？');"
                  >
                    <button type="submit">向全部用户发送领取提醒</button>
                  </form>
                  <p class="hint">发送过程会逐个投递邮件，耗时取决于收件人数和 SMTP 服务响应速度。若部分发送失败，页面会展示失败数量和部分失败原因。</p>
                `
            }
          </section>
          <div class="grid two" style="margin-top: 22px;">
            <section class="panel">
              <h2>手动新增证书</h2>
              <p class="subtle">填写归属 QQ、持有人昵称，并上传对应文件。</p>
              <form method="post" action="/admin/certificates" enctype="multipart/form-data" class="stack">
                <label>
                  QQ 号
                  <input type="text" name="qqNumber" inputmode="numeric" maxlength="12" placeholder="例如 123456789" />
                </label>
                <label>
                  持有人昵称
                  <input type="text" name="ownerName" placeholder="例如 张三" />
                </label>
                <label>
                  证书文件
                  <input type="file" name="certificateFile" />
                </label>
                <button type="submit">保存证书</button>
              </form>
            </section>
            <section class="panel">
              <h2>批量导入</h2>
              <p class="subtle">请先将文件命名为 <span class="muted">QQ号_姓名.pdf</span>。浏览器会逐个上传文件，避免把全部文件压成一个超大请求。</p>
              <form
                method="post"
                action="/admin/certificates/batch"
                enctype="multipart/form-data"
                class="stack"
                data-batch-upload-form
              >
                <label>
                  证书文件
                  <input type="file" name="files" multiple />
                </label>
                <button type="submit" data-upload-submit>开始批量导入</button>
                <progress class="upload-progress" value="0" max="0" hidden data-upload-progress></progress>
                <div class="upload-summary" hidden data-upload-summary></div>
                <ul class="upload-list" hidden data-upload-list></ul>
              </form>
              <noscript>
                <p class="hint">当前浏览器禁用 JavaScript 时，批量导入会退化为单次大请求，请分批上传并相应调整反向代理大小限制。</p>
              </noscript>
              <p class="hint">示例：<span class="muted">123456789_张三.pdf</span>、<span class="muted">987654321_李四.jpg</span></p>
            </section>
          </div>
          <section class="panel" style="margin-top: 20px;">
            <h2>证书列表</h2>
            ${
              certificates.length === 0
                ? `<div class="empty">当前还没有证书记录。</div>`
                : `
                  <table>
                    <thead>
                      <tr>
                        <th>QQ 号</th>
                        <th>持有人</th>
                        <th>文件</th>
                        <th>创建时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${certificates
                        .map(
                          (certificate) => `
                            <tr>
                              <td data-label="QQ 号">${escapeHtml(
                                certificate.qqNumber
                              )}</td>
                              <td data-label="持有人">${escapeHtml(
                                certificate.ownerName
                              )}</td>
                              <td data-label="文件">${escapeHtml(
                                certificate.originalFileName || certificate.filePath
                              )}</td>
                              <td data-label="创建时间">${escapeHtml(
                                formatDate(certificate.createdAt)
                              )}</td>
                              <td data-label="操作">
                                <div class="table-actions">
                                  <a class="button-link secondary" target="_blank" href="/certificates/${escapeHtml(
                                    certificate.id
                                  )}/download?mode=view">查看</a>
                                  <form method="post" action="/admin/certificates/${escapeHtml(
                                    certificate.id
                                  )}/delete" class="inline">
                                    <button type="submit" class="danger">删除</button>
                                  </form>
                                </div>
                              </td>
                            </tr>
                          `
                        )
                        .join("")}
                    </tbody>
                  </table>
                `
            }
          </section>
          <section class="panel" style="margin-top: 20px;">
            <h2>快递单号导入</h2>
            <p class="subtle">上传 CSV 批量导入。格式：QQ号,昵称,快递单号。首行可为表头。</p>
            <form method="post" action="/admin/trackings/import" enctype="multipart/form-data" class="stack">
              <label>
                CSV 文件
                <input type="file" name="trackingFile" accept=".csv,text/csv" />
              </label>
              <button type="submit">上传快递单号</button>
            </form>
            <p class="hint">示例：<span class="muted">123456789,张三,SF123456789CN</span></p>
          </section>
          <section class="panel" style="margin-top: 20px;">
            <h2>快递单号列表</h2>
            ${
              trackings.length === 0
                ? `<div class="empty">当前还没有快递单号记录。</div>`
                : `
                  <table>
                    <thead>
                      <tr>
                        <th>QQ 号</th>
                        <th>昵称</th>
                        <th>快递单号</th>
                        <th>创建时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${trackings
                        .map(
                          (tracking) => `
                            <tr>
                              <td data-label="QQ 号">${escapeHtml(
                                tracking.qqNumber
                              )}</td>
                              <td data-label="昵称">${escapeHtml(
                                tracking.ownerName
                              )}</td>
                              <td data-label="快递单号">${escapeHtml(
                                tracking.trackingNumber
                              )}</td>
                              <td data-label="创建时间">${escapeHtml(
                                formatDate(tracking.createdAt)
                              )}</td>
                            </tr>
                          `
                        )
                        .join("")}
                    </tbody>
                  </table>
                `
            }
          </section>
        </section>
      </main>
      ${renderAdminBatchUploadScript()}
    `
  );
};
