/**
 * 主应用 - 路由、事件委托、动作处理
 */

const App = {
  actions: {},

  reg(name, fn) { this.actions[name] = fn; },

  async init() {
    // 全局事件委托
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const action = el.getAttribute("data-action");
      const fn = this.actions[action];
      if (fn) {
        // 只阻止链接与普通按钮的默认行为；放行 submit 按钮，避免拦截表单提交
        if (el.tagName === "A" || (el.tagName === "BUTTON" && el.type !== "submit")) e.preventDefault();
        fn(el, e);
      }
    });
    document.addEventListener("submit", (e) => {
      const form = e.target.closest("#authForm");
      if (form) { e.preventDefault(); handleAuthSubmit(form); }
    });

    // 登录态恢复：localStorage token 优先，其次靠持久 cookie 自动登录
    try {
      const r = await API.get("/api/me");
      if (r.user) {
        if (API.token) localStorage.setItem("qms_token", API.token);
        S.user = r.user;
        if (r.student) S.student = r.student;
        if (r.group) S.myGroup = r.group;
        loadPendingCount();
        App.route();
        return;
      }
    } catch (e) {
      API.token = "";
      localStorage.removeItem("qms_token");
    }
    S.page = "login";
    render();
  },

  async route() {
    if (!S.user) { S.page = "login"; render(); return; }
    const hash = location.hash.replace(/^#\/?/, "");
    const page = PAGES[hash] ? hash : "dashboard";
    if (!PAGES[page].roles.includes(S.user.role)) {
      toast("你没有该页面权限", "error");
      location.hash = "#/dashboard";
      return;
    }
    S.page = page;
    render();
  },

  async render() {
    const app = document.getElementById("app");
    const modalRoot = document.getElementById("modal-root");
    modalRoot.innerHTML = "";

    if (S.page === "login" || !S.user) {
      S.page = "login";
      app.innerHTML = renderAuth(S.authMode === "register" ? "register" : "login");
      document.getElementById("pageTitle")?.remove();
      return;
    }

    const pageDef = PAGES[S.page];
    const pt = document.getElementById("pageTitle");
    if (pt) pt.textContent = pageDef.title;
    try {
      const html = await pageDef.render();
      app.innerHTML = html;
      document.querySelector("#sidebar")?.classList.remove("open");
    } catch (err) {
      app.innerHTML = `<div class="content"><div class="card"><div class="empty"><div class="empty-icon">⚠️</div>${U.escapeHtml(err.message)}<div style="margin-top:12px"><button class="btn btn-ghost" data-action="reload">重新加载</button></div></div></div></div>`;
    }
  }
};

/* ===================== 登录 / 注册 ===================== */

async function handleAuthSubmit(form) {
  const fd = new FormData(form);
  const username = String(fd.get("username") || "").trim();
  const password = String(fd.get("password") || "");
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "登录中...";
  try {
    const r = await API.post("/api/login", { username, password });
    API.token = r.token;
    localStorage.setItem("qms_token", r.token);
    S.user = r.user;
    toast("登录成功，欢迎 " + r.user.name, "success");
    location.hash = "#/dashboard";
    App.route();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "登 录";
  }
}

/* ===================== 通用 UI ===================== */

function toast(msg, type = "info", duration = 2600) {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast " + (type === "success" ? "success" : type === "error" ? "error" : type === "warning" ? "warning" : "");
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, duration - 300);
  setTimeout(() => el.remove(), duration);
}

function openModal(html, wide) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-mask" data-action="close-modal">
    <div class="modal ${wide ? "wide" : ""}" data-action="stop">
      ${html}
    </div>
  </div>`;
}

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
}

function modalFrame(title, body, footer) {
  return `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="modal-close" data-action="close-modal">×</button>
    </div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ""}`;
}

/* ===================== 动作注册 ===================== */

App.reg("reload", () => App.render());

App.reg("toggle-menu", () => {
  document.querySelector("#sidebar")?.classList.toggle("open");
});

App.reg("logout", async () => {
  try { await API.post("/api/logout"); } catch (e) { /* ignore */ }
  API.token = "";
  localStorage.removeItem("qms_token");
  document.cookie = "qms_token=; Path=/; Max-Age=0; SameSite=Lax";
  S.user = null;
  S.page = "login";
  location.hash = "#/login";
  App.render();
});

App.reg("toggle-auth", (el) => {
  S.authMode = el.dataset.mode;
  App.render();
});

/* ---------- 修改密码（所有角色，改自己的密码） ---------- */
App.reg("change-password", () => {
  openModal(modalFrame("🔒 修改密码", `
    <form id="pwdForm">
      <div id="pwdErr" style="display:none;color:#e5484d;background:#fdecec;border:1px solid #f5c6c6;padding:8px 10px;border-radius:6px;margin-bottom:12px;font-size:13px"></div>
      <div class="form-item"><label>当前密码</label><input class="input" type="password" name="oldPassword" placeholder="输入当前密码" required></div>
      <div class="form-item"><label>新密码（至少 6 位）</label><input class="input" type="password" name="newPassword" placeholder="输入新密码" required></div>
      <div class="form-item"><label>确认新密码</label><input class="input" type="password" name="confirm" placeholder="再次输入新密码" required></div>
      <button type="submit" class="btn btn-primary btn-block" style="padding:10px">确认修改</button>
    </form>`, null));
  document.getElementById("pwdForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const errEl = document.getElementById("pwdErr");
    errEl.style.display = "none";
    const oldPassword = f.oldPassword.value, newPassword = f.newPassword.value, confirm = f.confirm.value;
    const showErr = (m) => { errEl.textContent = m; errEl.style.display = "block"; };
    if (newPassword !== confirm) return showErr("两次输入的新密码不一致");
    if (newPassword.length < 6) return showErr("新密码至少 6 位");
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "提交中...";
    try {
      const r = await API.post("/api/change-password", { oldPassword, newPassword });
      toast(r.msg, "success", 4000);
      closeModal();
    } catch (err) { showErr(err.message); toast(err.message, "error", 4000); }
    finally { btn.disabled = false; btn.textContent = "确认修改"; }
  });
});

/* ---------- 账号管理：创建账号 / 重置密码（班主任） ---------- */
App.reg("create-user", async () => {
  const role = document.getElementById("nuRole").value;
  const username = document.getElementById("nuUsername").value.trim();
  const name = document.getElementById("nuName").value.trim();
  const password = document.getElementById("nuPassword").value.trim() || "123456";
  if (!username || !name) return toast("账号和姓名不能为空", "error");
  try {
    const r = await API.post("/api/users", { username, name, role, password });
    toast(r.msg, "success");
    App.render();
  } catch (err) { toast(err.message, "error"); }
});

App.reg("reset-password", async (el) => {
  const id = el.dataset.id, name = el.dataset.name;
  const np = window.prompt("为「" + name + "」设置新密码（至少 6 位）：");
  if (np === null) return;
  if (!np || np.length < 6) return toast("密码至少 6 位", "error");
  try {
    const r = await API.put("/api/users/" + id + "/password", { password: np });
    toast(r.msg, "success");
  } catch (err) { toast(err.message, "error"); }
});

App.reg("close-modal", (el, e) => {
  // 点击遮罩或关闭按钮
  if (el.classList.contains("modal-mask") || el.classList.contains("modal-close")) {
    closeModal();
  }
});
App.reg("stop", (el, e) => { e.stopPropagation(); });

App.reg("nav", (el) => {
  const page = el.dataset.page;
  location.hash = "#/" + page;
  S.page = page;
  App.render();
});

/* ---------- 学生管理 ---------- */

/* 下载学生名单导入模板（.csv，Excel/WPS 可直接打开编辑） */
App.reg("download-student-template", () => {
  const csv = "\uFEFF学号,姓名,小组号(1-6),班委职务(可留空)\n240101,张三,1,班长\n240102,李四,1,\n240103,王五,2,学习委员\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "学生名单导入模板.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast("模板已下载，用 Excel/WPS 打开填写后保存为 .csv 再上传", "success");
});

/* 上传名单文件导入（全局函数，供文件 input onchange 调用） */
async function handleStudentFile(input) {
  const file = input.files && input.files[0];
  const resultEl = document.getElementById("importResult");
  if (!file) return;
  if (!/\.(csv|txt)$/i.test(file.name)) {
    toast("请使用 .csv 表格文件（用下载的模板填写后保存为 .csv）", "warning");
    input.value = "";
    return;
  }
  // 读取文件时自动识别编码：优先 UTF-8（模板下载是 UTF-8）；若解码失败则按 GBK/GB18030 解析（Excel/WPS 在中文环境另存的 .csv 常为 GBK）
  let text;
  try {
    const buf = await file.arrayBuffer();
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch (e) { text = new TextDecoder("gb18030").decode(buf); }
  } catch (e) {
    toast("无法解析文件编码，请将文件另存为 UTF-8 编码的 .csv 后重试", "error");
    input.value = "";
    return;
  }
  const rows = text.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n").map(l => l.trim()).filter(l => l);
  const items = [];
  let err = 0;
  rows.forEach((line, i) => {
    const parts = line.split(",");
    if (i === 0 && /学号|姓名/.test(parts[0])) return; // 跳过表头
    if (parts.length < 2) { err++; return; }
    items.push({
      stuId: parts[0].trim(),
      name: parts[1].trim(),
      groupId: Number(parts[2]) || 1,
      leaderRole: (parts[3] || "").trim()
    });
  });
  if (!items.length) { toast("文件中没有可导入的数据", "warning"); input.value = ""; return; }
  try {
    const r = await API.post("/api/students/import", { items });
    if (resultEl) resultEl.innerHTML = `<span class="badge badge-green">${U.escapeHtml(r.msg)}</span>${err ? ` <span class="badge badge-orange">${err} 行格式有误被跳过</span>` : ""}`;
    toast(r.msg, "success");
    input.value = "";
    setTimeout(() => App.render(), 800);
  } catch (e) { toast(e.message, "error"); input.value = ""; }
}

App.reg("add-student", async () => {
  const stuId = document.getElementById("newStuId").value.trim();
  const name = document.getElementById("newStuName").value.trim();
  const groupId = document.getElementById("newStuGroup").value;
  const leaderRole = document.getElementById("newStuLeader").value;
  if (!stuId || !name) { toast("学号和姓名不能为空", "warning"); return; }
  try {
    const r = await API.post("/api/students", { stuId, name, groupId, leaderRole });
    toast(r.msg, "success");
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

App.reg("edit-student", async (el) => {
  const groups = (await API.get("/api/groups")).data;
  const gOpts = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join("");
  const lOpts = ["", "班长", "副班长", "学习委员", "纪律委员", "卫生委员", "体育委员", "文艺委员", "生活委员", "宣传委员", "电教委员"]
    .map(l => `<option value="${l}">${l || "（无）"}</option>`).join("");
  openModal(modalFrame("编辑学生", `
    <input type="hidden" id="editStuId" value="${U.escapeHtml(el.dataset.id)}">
    <div class="form-item"><label>学号（账号）</label><input class="input" id="editStuNo" value="${U.escapeHtml(el.dataset.stuid)}" disabled></div>
    <div class="form-item"><label>姓名</label><input class="input" id="editStuName" value=""></div>
    <div class="form-item"><label>所属小组</label><select class="select" id="editStuGroup">${gOpts}</select></div>
    <div class="form-item"><label>班委职务</label><select class="select" id="editStuLeader">${lOpts}</select></div>`, `
    <button class="btn btn-ghost" data-action="close-modal">取消</button>
    <button class="btn btn-primary" data-action="save-student">保存</button>`));
  // 填充当前值
  const list = (await API.get("/api/students")).data;
  const stu = list.find(s => s.id === el.dataset.id);
  if (stu) {
    document.getElementById("editStuName").value = stu.name;
    document.getElementById("editStuGroup").value = stu.groupId;
    document.getElementById("editStuLeader").value = stu.leaderRole;
  }
});

App.reg("save-student", async () => {
  const id = document.getElementById("editStuId").value;
  const name = document.getElementById("editStuName").value.trim();
  const groupId = document.getElementById("editStuGroup").value;
  const leaderRole = document.getElementById("editStuLeader").value;
  try {
    const r = await API.put("/api/students/" + id, { name, groupId, leaderRole });
    toast(r.msg, "success");
    closeModal();
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

App.reg("delete-student", async (el) => {
  const name = el.dataset.name;
  const ok = confirm("确定删除学生 " + name + " 吗？将同时删除其账号，该操作不可恢复。");
  if (!ok) return;
  try {
    const r = await API.del("/api/students/" + el.dataset.id);
    toast(r.msg, "success");
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

App.reg("export-csv", () => {
  API.get("/api/students").then(r => {
    const head = "学号,姓名,小组,班委,积分\n";
    const rows = r.data.map(s => [s.stuId, s.name, s.groupName, s.leaderRole, s.totalScore].join(",")).join("\n");
    downloadFile("学生名单.csv", "\ufeff" + head + rows, "text/csv;charset=utf-8");
  }).catch(e => toast(e.message, "error"));
});

/* ---------- 小组 ---------- */

App.reg("edit-group", async (el) => {
  const teachers = (await API.get("/api/teachers")).data;
  const tOpts = teachers.map(t => `<option value="${t.id}">${t.name}（${t.isSuper ? "超级管理员" : t.role === "headTeacher" ? "班主任" : "导师"}）</option>`).join("");
  openModal(modalFrame("配置导师", `
    <input type="hidden" id="editGroupId" value="${el.dataset.id}">
    <div class="form-item"><label>小组名称</label><input class="input" id="editGroupName" value="${U.escapeHtml(el.dataset.name)}"></div>
    <div class="form-item"><label>负责导师</label><select class="select" id="editGroupTeacher">${tOpts}</select></div>`, `
    <button class="btn btn-ghost" data-action="close-modal">取消</button>
    <button class="btn btn-primary" data-action="save-group">保存</button>`));
  if (el.dataset.teacher) document.getElementById("editGroupTeacher").value = el.dataset.teacher;
});

App.reg("save-group", async () => {
  const id = document.getElementById("editGroupId").value;
  const name = document.getElementById("editGroupName").value.trim();
  const teacherId = document.getElementById("editGroupTeacher").value;
  try {
    const r = await API.put("/api/groups/" + id, { name, teacherId });
    toast(r.msg, "success");
    closeModal();
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

/* ---------- 评分 ---------- */

App.reg("score-submit", async () => {
  const stuId = document.getElementById("scoreStu").value;
  const score = Number(document.getElementById("scoreVal").value);
  const reason = document.getElementById("scoreReason").value.trim();
  if (!reason) { toast("请填写评分事由", "warning"); return; }
  if (!score || isNaN(score)) { toast("请填写有效分数（正数加分，负数扣分）", "warning"); return; }
  try {
    const r = await API.post("/api/scores", { stuId, score, reason });
    toast(r.msg, r.record.status === "active" ? "success" : "warning");
    document.getElementById("scoreVal").value = "";
    document.getElementById("scoreReason").value = "";
    loadPendingCount();
  } catch (e) { toast(e.message, "error"); }
});

App.reg("score-quick", (el) => {
  document.getElementById("scoreVal").value = el.dataset.score;
  document.getElementById("scoreReason").focus();
});

App.reg("audit-pass", async (el) => {
  try {
    const r = await API.post("/api/scores/" + el.dataset.id + "/audit", { pass: true });
    toast(r.msg, "success");
    loadPendingCount();
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

App.reg("audit-reject", async (el) => {
  const msg = prompt("请输入驳回原因（可留空）：", "");
  if (msg === null) return;
  try {
    const r = await API.post("/api/scores/" + el.dataset.id + "/audit", { pass: false, rejectMsg: msg });
    toast(r.msg, "warning");
    loadPendingCount();
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

/* ---------- 商城 ---------- */

App.reg("add-shop-item", () => {
  openModal(modalFrame("上架商品", `
    <div class="form-item"><label>商品名称</label><input class="input" id="itName" placeholder="如：免作业卡"></div>
    <div class="form-item"><label>所需积分</label><input class="input" id="itPrice" type="number" min="1" placeholder="如：50"></div>
    <div class="form-item"><label>库存数量</label><input class="input" id="itStock" type="number" min="0" value="99"></div>
    <div class="form-item"><label>图标（emoji）</label><input class="input" id="itIcon" value="🎁" maxlength="4"></div>
    <div class="form-item"><label>说明</label><input class="input" id="itDesc" placeholder="兑换后可以做什么"></div>`, `
    <button class="btn btn-ghost" data-action="close-modal">取消</button>
    <button class="btn btn-primary" data-action="save-shop-item">上架</button>`));
});

App.reg("edit-shop-item", async (el) => {
  const items = (await API.get("/api/shop/items")).data;
  const it = items.find(x => x.id === el.dataset.id);
  if (!it) return;
  openModal(modalFrame("编辑商品", `
    <input type="hidden" id="itId" value="${it.id}">
    <div class="form-item"><label>商品名称</label><input class="input" id="itName" value="${U.escapeHtml(it.name)}"></div>
    <div class="form-item"><label>所需积分</label><input class="input" id="itPrice" type="number" min="1" value="${it.price}"></div>
    <div class="form-item"><label>库存数量</label><input class="input" id="itStock" type="number" min="0" value="${it.stock}"></div>
    <div class="form-item"><label>图标（emoji）</label><input class="input" id="itIcon" value="${U.escapeHtml(it.icon)}" maxlength="4"></div>
    <div class="form-item"><label>说明</label><input class="input" id="itDesc" value="${U.escapeHtml(it.desc)}"></div>`, `
    <button class="btn btn-ghost" data-action="close-modal">取消</button>
    <button class="btn btn-primary" data-action="save-shop-item">保存</button>`));
});

App.reg("save-shop-item", async () => {
  const id = document.getElementById("itId")?.value;
  const body = {
    name: document.getElementById("itName").value.trim(),
    price: Number(document.getElementById("itPrice").value),
    stock: Number(document.getElementById("itStock").value),
    icon: document.getElementById("itIcon").value,
    desc: document.getElementById("itDesc").value.trim()
  };
  try {
    const r = id ? await API.put("/api/shop/items/" + id, body) : await API.post("/api/shop/items", body);
    toast(r.msg, "success");
    closeModal();
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

App.reg("delete-shop-item", async (el) => {
  if (!confirm("确定删除该商品吗？")) return;
  try {
    const r = await API.del("/api/shop/items/" + el.dataset.id);
    toast(r.msg, "success");
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

App.reg("redeem-item", async (el) => {
  if (!confirm("确定用积分兑换该商品吗？兑换后等待班主任发放。")) return;
  try {
    const r = await API.post("/api/shop/redeem", { itemId: el.dataset.id });
    toast(r.msg, "success");
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

App.reg("confirm-redeem", async (el) => {
  const pass = el.dataset.pass === "1";
  if (!confirm(pass ? "确认已发放给该学生？" : "确定取消该兑换订单？")) return;
  try {
    const r = await API.post("/api/shop/redeems/" + el.dataset.id + "/confirm", { pass });
    toast(r.msg, "success");
    App.render();
  } catch (e) { toast(e.message, "error"); }
});

/* ---------- 打印 ---------- */

async function printRankData(scope) {
  const r = await API.get("/api/rank");
  const area = document.getElementById("printArea");
  const date = new Date().toLocaleDateString("zh-CN");
  let rows = "", title = "";
  if (scope === "personal") {
    title = "2401班 个人积分排行榜";
    rows = r.data.personal.map(s => `<tr><td>${s.rank}</td><td>${s.name}${s.leaderRole ? "（" + s.leaderRole + "）" : ""}</td><td>${s.groupName}</td><td>${s.totalScore}</td></tr>`).join("");
    area.innerHTML = `<h1 class="print-title">${title}</h1><p class="print-sub">打印时间：${date}</p>
      <table class="print-table"><thead><tr><th>排名</th><th>姓名</th><th>小组</th><th>积分</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else {
    title = "2401班 小组积分排行榜";
    rows = r.data.group.map((g, i) => `<tr><td>${i + 1}</td><td>${g.name}</td><td>${g.teacherName}</td><td>${g.memberCount}</td><td>${g.totalScore}</td><td>${g.avgScore}</td></tr>`).join("");
    area.innerHTML = `<h1 class="print-title">${title}</h1><p class="print-sub">打印时间：${date}</p>
      <table class="print-table"><thead><tr><th>排名</th><th>小组</th><th>导师</th><th>人数</th><th>总分</th><th>人均</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  setTimeout(() => window.print(), 200);
}

App.reg("print-rank", () => printRankData("personal"));
App.reg("print-group", () => printRankData("group"));

/* ---------- 备份 ---------- */

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type: type || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

App.reg("export-data", async () => {
  try {
    const r = await API.get("/api/export");
    const date = new Date().toISOString().slice(0, 10);
    downloadFile("2401量化系统备份-" + date + ".json", JSON.stringify(r.data, null, 2), "application/json");
    toast("备份已导出", "success");
  } catch (e) { toast(e.message, "error"); }
});

App.reg("import-data", async () => {
  const file = document.getElementById("importFile").files[0];
  if (!file) { toast("请先选择备份文件", "warning"); return; }
  if (!confirm("恢复备份将覆盖当前全部数据，确定继续吗？")) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const r = await API.post("/api/import", { data });
    toast(r.msg, "success");
    App.render();
  } catch (e) {
    toast("备份文件解析失败：" + e.message, "error");
  }
});

/* ===================== 待审核数 ===================== */

async function loadPendingCount() {
  if (!S.user || S.user.role !== "headTeacher") return;
  try {
    const r = await API.get("/api/scores?status=pending");
    S.cache.pendingCount = r.data.length;
    // 更新侧边栏角标
    document.querySelectorAll('[data-page="audit"] .nav-badge').forEach(b => {
      b.textContent = r.data.length;
      b.style.display = r.data.length ? "" : "none";
    });
  } catch (e) { /* ignore */ }
}

/* ===================== 启动 ===================== */

const render = () => App.render();
window.addEventListener("hashchange", () => App.route());
document.addEventListener("DOMContentLoaded", () => App.init());
if (document.readyState !== "loading") App.init();
