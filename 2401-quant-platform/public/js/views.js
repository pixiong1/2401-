/**
 * 视图层 - 所有页面的 HTML 渲染与动作处理
 * 事件委托：按钮带 data-action 属性，由 App 全局委托分发到 App.actions[action]
 */

const S = {
  user: null,        // 当前用户
  page: "dashboard", // 当前页面
  cache: {},         // 数据缓存
};

/* ===================== 登录页（注册已关闭，账号由班主任统一创建） ===================== */

function renderAuth(mode) {
  return `
  <div class="auth-page">
    <div class="auth-box">
      <div class="auth-logo"><img src="img/logo.png" alt="2401尖刀班"></div>
      <h1 class="auth-title">2401班导师制量化管理系统</h1>
      <p class="auth-sub">欢迎回来，请登录你的账号</p>

      <form id="authForm" data-mode="login">
        <div class="form-item">
          <label>账号</label>
          <input class="input" name="username" placeholder="班主任/导师/学生账号" autocomplete="username" required>
        </div>
        <div class="form-item">
          <label>密码</label>
          <input class="input" type="password" name="password" placeholder="输入密码" autocomplete="current-password" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block" style="padding:10px">登 录</button>
      </form>

      <p class="auth-tip" style="color:var(--text-2);font-size:12px">账号由班主任统一开通，登录后可在「修改密码」中更改</p>
      <div class="auth-credit">皮熊px 制作</div>
    </div>
  </div>`;
}

/* ===================== 主布局 ===================== */

function sidebarHTML() {
  const u = S.user;
  const items = [
    { group: "工作台" },
    { page: "dashboard", label: "班级概览", icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z", roles: ["headTeacher", "teacher", "student"] },
    { group: "量化管理" },
    { page: "scores", label: "评分录入", icon: "M11 3H5v18h14v-8h-2v6H7V5h4V3zm3 0v4h4v2h-4v4h-2V9H8V7h4V3h2z", roles: ["headTeacher", "teacher", "student"] },
    { page: "scorelog", label: "评分流水", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z", roles: ["headTeacher", "teacher", "student"] },
    { page: "audit", label: "审核中心", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z", roles: ["headTeacher"], badge: "pending" },
    { group: "激励中心" },
    { page: "rank", label: "积分排行榜", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", roles: ["headTeacher", "teacher", "student"] },
    { page: "shop", label: "积分商城", icon: "M20 7h-4V5a4 4 0 00-8 0v2H4a1 1 0 00-1 1v13a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM10 5a2 2 0 014 0v2h-4V5zm-5 4h14v10H5V9z", roles: ["headTeacher", "teacher", "student"] },
    { group: "班级管理" },
    { page: "students", label: "学生管理", icon: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z", roles: ["headTeacher", "teacher"] },
    { page: "groups", label: "导师小组", icon: "M3 21h18v-2H3v2zM5 19h4v-6H5v6zm5 0h4V9h-4v10zm5 0h4V5h-4v14z", roles: ["headTeacher", "teacher", "student"] },
    { group: "系统" },
    { page: "users", label: "账号管理", icon: "M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z", roles: ["headTeacher"] },
    { page: "print", label: "打印中心", icon: "M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z", roles: ["headTeacher", "teacher"] },
    { page: "backup", label: "数据备份", icon: "M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z", roles: ["headTeacher"] },
  ];

  const can = (roles) => roles.includes(u.role);
  let html = "";
  items.forEach(it => {
    if (it.group) { html += `<div class="nav-group">${it.group}</div>`; return; }
    if (!can(it.roles)) return;
    let badge = "";
    if (it.badge === "pending" && S.cache.pendingCount) {
      badge = `<span class="nav-badge">${S.cache.pendingCount}</span>`;
    }
    html += `<div class="nav-item ${S.page === it.page ? "active" : ""}" data-action="nav" data-page="${it.page}">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="${it.icon}"/></svg>
      ${it.label}${badge}
    </div>`;
  });

  const av = S.user;
  const avatarClass = av.role === "headTeacher" ? "avatar red" : av.role === "teacher" ? "avatar purple" : "avatar green";
  return `
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon"><img src="img/logo.png" alt="logo"></div>
      <div class="logo-text">2401量化平台<small>导师制 · 积分激励</small></div>
    </div>
    <nav class="sidebar-nav">${html}</nav>
    <div class="sidebar-credit">皮熊px 制作</div>
    <div class="sidebar-user">
      <div class="${avatarClass}" style="background:${U.avatarColor(av.name)}">${U.initials(av.name)}</div>
      <div style="min-width:0">
        <div class="u-name">${U.escapeHtml(av.name)}</div>
        <div class="u-role">${U.roleName(av.role, av)}</div>
      </div>
      <button class="btn btn-sm btn-ghost" style="margin-left:auto;padding:4px 8px" data-action="change-password" title="修改密码">改密</button>
      <button class="btn btn-sm btn-ghost" style="padding:4px 8px" data-action="logout" title="退出登录">退出</button>
    </div>
  </aside>`;
}

function renderLayout(content) {
  return `
  <div class="layout">
    ${sidebarHTML()}
    <main class="main">
      <div class="topbar">
        <button class="menu-btn" data-action="toggle-menu">☰</button>
        <div class="topbar-title" id="pageTitle"></div>
        <div class="topbar-right">
          <span class="topbar-user">${U.escapeHtml(S.user.name)} · ${U.roleName(S.user.role, S.user)}</span>
        </div>
      </div>
      <div class="content" id="pageContent">${content}</div>
    </main>
  </div>`;
}

/* ===================== 概览（按角色差异化主页） ===================== */

function _scoreRow(r) {
  return `<tr>
    <td>${U.escapeHtml(r.stuName)}</td>
    <td><span class="badge badge-gray">${U.escapeHtml(r.groupName || "-")}</span></td>
    <td class="num ${U.scoreClass(r.score)}">${U.scoreText(r.score)}</td>
    <td>${U.escapeHtml(r.reason)}</td>
    <td>${U.escapeHtml(r.opName)}</td>
    <td>${U.statusBadge(r.status)}</td>
    <td>${U.escapeHtml(r.createTime)}</td>
  </tr>`;
}
function _scoreTable(title, items, empty) {
  const rows = items.length ? items.slice(0, 20).map(_scoreRow).join("") : `<tr><td colspan="7" class="empty">${empty || "暂无记录"}</td></tr>`;
  return `<div class="card"><div class="card-title">${title}</div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>学生</th><th>小组</th><th>分数</th><th>事由</th><th>操作人</th><th>状态</th><th>时间</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
}

async function renderDashboard() {
  const r = await API.get("/api/dashboard");
  const d = r.data;
  const u = S.user;

  // ---------- 超级管理员：上帝视角管理概览 ----------
  if (u.isSuper) {
    const topHtml = d.topStudents.map((s, i) => `<tr>
      <td><span class="badge ${i === 0 ? "badge-red" : i === 1 ? "badge-orange" : "badge-blue"}">#${i + 1}</span></td>
      <td>${U.escapeHtml(s.name)}${s.leaderRole ? ` <span class="badge badge-orange">${U.escapeHtml(s.leaderRole)}</span>` : ""}</td>
      <td class="num score-plus">${s.totalScore}</td></tr>`).join("");
    const recents = d.recentScores.map(r => `<li>
      <div class="tl-icon" style="background:${r.score >= 0 ? "var(--success-light)" : "var(--danger-light)"}">${r.score >= 0 ? "＋" : "－"}</div>
      <div class="tl-body"><div class="tl-line1"><span class="tl-reason">${U.escapeHtml(r.stuName)} · ${U.escapeHtml(r.reason)}</span><span class="${U.scoreClass(r.score)}">${U.scoreText(r.score)}</span></div>
      <div class="tl-meta">${U.escapeHtml(r.opName)} · ${U.escapeHtml(r.createTime)} ${U.statusBadge(r.status)}</div></div></li>`).join("");
    return renderLayout(`
      <div class="hello-banner">
        <div><h2>你好，${U.escapeHtml(u.name)}</h2><p>系统管理 · 上帝视角 · 共 ${d.studentCount} 名学生、${d.teacherCount} 位老师、${d.groupCount} 个小组</p></div>
        <button class="btn" data-action="nav" data-page="students">管理学生</button>
      </div>
      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-icon blue">👥</div><div class="stat-info"><div class="stat-label">学生总数</div><div class="stat-value">${d.studentCount}</div></div></div>
        <div class="stat-card"><div class="stat-icon green">👨‍🏫</div><div class="stat-info"><div class="stat-label">老师人数</div><div class="stat-value">${d.teacherCount}</div></div></div>
        <div class="stat-card"><div class="stat-icon orange">📝</div><div class="stat-info"><div class="stat-label">评分记录</div><div class="stat-value">${d.scoreCount}</div></div></div>
        <div class="stat-card"><div class="stat-icon red">⏳</div><div class="stat-info"><div class="stat-label">待审核</div><div class="stat-value">${d.pendingCount}</div></div></div>
      </div>
      <div class="grid grid-2">
        <div class="card"><div class="card-title">🏆 积分榜前五 <button class="btn btn-sm btn-ghost" data-action="nav" data-page="rank">查看完整排行</button></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>排名</th><th>姓名</th><th>总分</th></tr></thead><tbody>${topHtml || '<tr><td colspan="3" class="empty">暂无数据</td></tr>'}</tbody></table></div></div>
        <div class="card"><div class="card-title">📋 最新评分记录 <button class="btn btn-sm btn-ghost" data-action="nav" data-page="scorelog">查看全部</button></div>
          <ul class="timeline">${recents || '<li class="empty">暂无评分记录</li>'}</ul></div>
      </div>`);
  }

  // ---------- 学生：个人专属主页 ----------
  if (u.role === "student") {
    const g = d.myGroup;
    return renderLayout(`
      <div class="hello-banner">
        <div><h2>你好，${U.escapeHtml(u.name)}</h2><p>你的积分 <b style="font-size:20px">${d.myScore}</b> 分 · 班级排名 <b style="font-size:20px">第 ${d.myRank} 名</b></p></div>
        <button class="btn" data-action="nav" data-page="shop">去积分商城</button>
      </div>
      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-icon blue">⭐</div><div class="stat-info"><div class="stat-label">我的积分</div><div class="stat-value">${d.myScore}</div></div></div>
        <div class="stat-card"><div class="stat-icon green">🏅</div><div class="stat-info"><div class="stat-label">我的排名</div><div class="stat-value">第 ${d.myRank} 名</div></div></div>
        <div class="stat-card"><div class="stat-icon orange">👥</div><div class="stat-info"><div class="stat-label">我的小组</div><div class="stat-value">${g ? U.escapeHtml(g.name) : "未分组"}</div></div></div>
        <div class="stat-card"><div class="stat-icon red">📊</div><div class="stat-info"><div class="stat-label">小组排名</div><div class="stat-value">${g ? "第 " + g.groupRank + " 名" : "-"}</div></div></div>
      </div>
      <div class="card" style="margin-bottom:16px"><div class="card-title">我的小组概况 <button class="btn btn-sm btn-ghost" data-action="nav" data-page="rank">查看完整排行</button></div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;padding:4px 0">
          <div>小组成员：<b>${g ? g.memberCount : 0}</b> 人</div>
          <div>小组总分：<b>${g ? g.totalScore : 0}</b> 分</div>
          <div>小组排名：<b>${g ? "第 " + g.groupRank + " 名" : "-"}</b></div>
        </div></div>
      ${_scoreTable("📒 我的积分记录", d.myScores, "还没有你的积分记录")}
      ${_scoreTable("👥 小组成员记录", d.groupScores, "暂无记录")}
      ${_scoreTable("🌐 其他成员记录", d.otherScores, "暂无记录")}
    `);
  }

  // ---------- 老师 / 班主任：小组专属主页 ----------
  const g = d.myGroup;
  const heroBtn = u.role === "headTeacher"
    ? `<button class="btn" data-action="nav" data-page="students">管理学生</button>`
    : `<button class="btn" data-action="nav" data-page="scores">录入评分</button>`;
  return renderLayout(`
    <div class="hello-banner">
      <div><h2>你好，${U.escapeHtml(u.name)}</h2><p>${u.role === "headTeacher" ? "班主任 · " : "导师 · "}负责 ${g ? U.escapeHtml(g.name) : "尚未分配小组"}，共 ${g ? g.memberCount : 0} 名学生</p></div>
      ${heroBtn}
    </div>
    <div class="grid grid-4" style="margin-bottom:16px">
      <div class="stat-card"><div class="stat-icon blue">👥</div><div class="stat-info"><div class="stat-label">我的小组</div><div class="stat-value">${g ? U.escapeHtml(g.name) : "-"}</div></div></div>
      <div class="stat-card"><div class="stat-icon green">🧑‍🤝‍🧑</div><div class="stat-info"><div class="stat-label">小组人数</div><div class="stat-value">${g ? g.memberCount : 0}</div></div></div>
      <div class="stat-card"><div class="stat-icon orange">🏆</div><div class="stat-info"><div class="stat-label">小组总分</div><div class="stat-value">${g ? g.totalScore : 0}</div></div></div>
      <div class="stat-card"><div class="stat-icon red">📊</div><div class="stat-info"><div class="stat-label">小组排名</div><div class="stat-value">${g ? "第 " + g.groupRank + " 名" : "-"}</div></div></div>
    </div>
    ${_scoreTable("👥 本组成员记录", d.groupScores, "暂无记录")}
    ${_scoreTable("🌐 其他成员记录", d.otherScores, "暂无记录")}
  `);
}

/* ===================== 学生管理 ===================== */

async function renderStudents() {
  const r = await API.get("/api/students");
  const groups = (await API.get("/api/groups")).data;
  const list = r.data;
  const isHead = S.user.role === "headTeacher";

  const groupOpts = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join("");
  const leaderOpts = ["班长", "副班长", "学习委员", "纪律委员", "卫生委员", "体育委员", "文艺委员", "生活委员", "宣传委员", "电教委员"]
    .map(l => `<option value="${l}">${l}</option>`).join("");

  const importBox = isHead ? `
  <div class="card">
    <div class="card-title">📥 批量导入学生名单</div>
    <p style="color:var(--text-2);margin-bottom:12px;line-height:1.7">① 下载名单模板 → ② 用 Excel / WPS 打开填写 → ③ 上传文件自动生成学生账号（初始密码 123456）</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-primary" data-action="download-student-template">下载名单模板（.csv）</button>
      <label class="btn btn-ghost" style="cursor:pointer;margin:0">
        选择名单文件上传
        <input type="file" id="studentFile" accept=".csv,.txt" style="display:none" onchange="handleStudentFile(this)">
      </label>
    </div>
    <div id="importResult" style="margin-top:10px"></div>
  </div>
  <div class="card">
    <div class="card-title">➕ 单个添加学生</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
      <div class="form-item" style="margin:0"><label>学号</label><input class="input" id="newStuId" placeholder="如 240137"></div>
      <div class="form-item" style="margin:0"><label>姓名</label><input class="input" id="newStuName" placeholder="姓名"></div>
      <div class="form-item" style="margin:0"><label>小组</label><select class="select" id="newStuGroup">${groupOpts}</select></div>
      <div class="form-item" style="margin:0"><label>班委职务</label><select class="select" id="newStuLeader"><option value="">（无）</option>${leaderOpts}</select></div>
      <div class="form-item" style="margin:0;display:flex;align-items:flex-end"><button class="btn btn-primary" data-action="add-student">添加学生</button></div>
    </div>
  </div>` : "";

  const rows = list.map(s => `
    <tr>
      <td class="num">${U.escapeHtml(s.stuId)}</td>
      <td><b>${U.escapeHtml(s.name)}</b></td>
      <td>${s.groupName}</td>
      <td>${U.leaderBadge(s.leaderRole)}</td>
      <td class="num score-plus">${s.totalScore}</td>
      ${isHead ? `<td>
        <button class="btn btn-sm btn-ghost" data-action="edit-student" data-id="${s.id}" data-stuid="${U.escapeHtml(s.stuId)}">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="delete-student" data-id="${s.id}" data-name="${U.escapeHtml(s.name)}">删除</button>
      </td>` : ""}
    </tr>`).join("");

  return renderLayout(`
    <div class="section-header">
      <div class="section-title">学生管理${isHead ? "" : "（我的小组）"}</div>
      <span class="badge badge-blue">共 ${list.length} 人</span>
    </div>
    ${importBox}
    <div class="card">
      <div class="card-title">👥 学生列表${isHead ? ' <button class="btn btn-sm btn-ghost" data-action="export-csv">导出 CSV</button>' : ""}</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>学号</th><th>姓名</th><th>小组</th><th>班委</th><th>积分</th>${isHead ? "<th>操作</th>" : ""}</tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="empty">暂无学生，请先导入名单</td></tr>'}</tbody>
      </table></div>
    </div>`);
}

/* ===================== 导师小组 ===================== */

async function renderGroups() {
  const groups = (await API.get("/api/groups")).data;
  const isHead = S.user.role === "headTeacher";

  const rows = groups.map(g => `
    <tr>
      <td class="num">${g.id}</td>
      <td><b>${U.escapeHtml(g.name)}</b></td>
      <td>${U.escapeHtml(g.teacherName)}</td>
      <td class="num">${g.memberCount}</td>
      <td class="num score-plus">${g.totalScore}</td>
      <td class="num">${g.avgScore}</td>
      ${isHead ? `<td><button class="btn btn-sm btn-ghost" data-action="edit-group" data-id="${g.id}" data-name="${U.escapeHtml(g.name)}" data-teacher="${U.escapeHtml(g.teacherId || "")}">配置导师</button></td>` : ""}
    </tr>`).join("");

  return renderLayout(`
    <div class="section-header"><div class="section-title">导师小组</div><span class="badge badge-blue">共 ${groups.length} 组</span></div>
    <div class="card">
      <div class="card-title">🏘️ 小组总览与排行</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>小组</th><th>名称</th><th>导师</th><th>人数</th><th>总分</th><th>人均分</th>${isHead ? "<th>操作</th>" : ""}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`);
}

/* ===================== 评分录入 ===================== */

async function renderScores() {
  const students = (await API.get("/api/students")).data;
  const opts = students.map(s => `<option value="${s.stuId}">${s.stuId} ${s.name}${s.leaderRole ? "（" + s.leaderRole + "）" : ""}</option>`).join("");
  const isStudent = S.user.role === "student";

  return renderLayout(`
    <div class="section-header"><div class="section-title">评分录入</div></div>
    <div class="card">
      <div class="card-title">✏️ 加减分登记</div>
      <div class="grid grid-2">
        <div class="form-item"><label>选择学生</label><select class="select" id="scoreStu">${opts}</select></div>
        <div class="form-item"><label>分数（正数加分 / 负数扣分）</label><input class="input" id="scoreVal" type="number" placeholder="如 2 或 -1" step="1"></div>
        <div class="form-item" style="grid-column:1/-1"><label>评分事由</label><input class="input" id="scoreReason" placeholder="如：课堂积极回答问题、迟到、作业优秀等"></div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:4px">
        <button class="btn btn-primary" data-action="score-submit">提交评分</button>
        <button class="btn btn-ghost" data-action="score-quick" data-score="2">＋2 表扬</button>
        <button class="btn btn-ghost" data-action="score-quick" data-score="-1">－1 提醒</button>
        <button class="btn btn-ghost" data-action="score-quick" data-score="-2">－2 违纪</button>
        <span style="font-size:12px;color:var(--text-3)">${isStudent ? "学生/班委提交的评分需班主任审核后生效" : "导师/班主任提交直接生效；班委提交需班主任审核"}</span>
      </div>
    </div>`);
}

/* ===================== 评分流水 ===================== */

async function renderScoreLog() {
  const r = await API.get("/api/scores");
  const list = r.data;
  const rows = list.map(s => `
    <tr>
      <td class="num">${U.escapeHtml(s.stuId)}</td>
      <td>${U.escapeHtml(s.stuName)}</td>
      <td class="${U.scoreClass(s.score)}">${U.scoreText(s.score)}</td>
      <td>${U.escapeHtml(s.reason)}</td>
      <td>${U.escapeHtml(s.opName)}</td>
      <td>${U.statusBadge(s.status)}</td>
      <td style="white-space:nowrap">${U.escapeHtml(s.createTime)}</td>
    </tr>`).join("");

  return renderLayout(`
    <div class="section-header">
      <div class="section-title">评分流水</div>
      <span class="badge badge-blue">共 ${list.length} 条</span>
    </div>
    <div class="card">
      <div class="table-wrap"><table class="table">
        <thead><tr><th>学号</th><th>姓名</th><th>分数</th><th>事由</th><th>操作人</th><th>状态</th><th>时间</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="empty">暂无评分记录</td></tr>'}</tbody>
      </table></div>
    </div>`);
}

/* ===================== 审核中心 ===================== */

async function renderAudit() {
  const r = await API.get("/api/scores?status=pending");
  const list = r.data;
  const rows = list.map(s => `
    <tr>
      <td class="num">${U.escapeHtml(s.stuId)}</td>
      <td>${U.escapeHtml(s.stuName)}</td>
      <td class="${U.scoreClass(s.score)}">${U.scoreText(s.score)}</td>
      <td>${U.escapeHtml(s.reason)}</td>
      <td>${U.escapeHtml(s.opName)}</td>
      <td style="white-space:nowrap">${U.escapeHtml(s.createTime)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-success" data-action="audit-pass" data-id="${s.id}">通过</button>
        <button class="btn btn-sm btn-danger" data-action="audit-reject" data-id="${s.id}">驳回</button>
      </td>
    </tr>`).join("");

  return renderLayout(`
    <div class="section-header">
      <div class="section-title">审核中心</div>
      <span class="badge badge-orange">待审核 ${list.length} 条</span>
    </div>
    <div class="card">
      <div class="card-title">⏳ 班委/学生提交的评分，等待班主任审批</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>学号</th><th>姓名</th><th>分数</th><th>事由</th><th>提交人</th><th>时间</th><th>操作</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="empty">暂无待审核记录</td></tr>'}</tbody>
      </table></div>
    </div>`);
}

/* ===================== 排行榜 ===================== */

async function renderRank() {
  const r = await API.get("/api/rank");
  const { personal, group } = r.data;

  const podium = personal.slice(0, 3).map((s, i) => `
    <div class="podium-item p${i + 1}">
      <div class="p-avatar" style="background:${U.avatarColor(s.name)}">${U.initials(s.name)}</div>
      <div class="p-name">${U.escapeHtml(s.name)}</div>
      <div class="p-score">${s.totalScore} 分</div>
      <div class="p-pedestal">${i + 1}</div>
    </div>`).join("");

  const rows = personal.map(s => `
    <tr>
      <td class="num">${s.rank <= 3 ? '<span class="badge ' + (s.rank === 1 ? "badge-red" : s.rank === 2 ? "badge-orange" : "badge-blue") + '">#' + s.rank + "</span>" : s.rank}</td>
      <td><b>${U.escapeHtml(s.name)}</b>${s.leaderRole ? ` <span class="badge badge-orange">${U.escapeHtml(s.leaderRole)}</span>` : ""}</td>
      <td>${s.groupName}</td>
      <td class="num score-plus">${s.totalScore}</td>
    </tr>`).join("");

  const gRows = group.map((g, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td><b>${U.escapeHtml(g.name)}</b></td>
      <td>${U.escapeHtml(g.teacherName)}</td>
      <td class="num">${g.memberCount}</td>
      <td class="num score-plus">${g.totalScore}</td>
      <td class="num">${g.avgScore}</td>
    </tr>`).join("");

  return renderLayout(`
    <div class="section-header">
      <div class="section-title">积分排行榜</div>
      <button class="btn btn-primary" data-action="print-rank">🖨️ 打印排行榜</button>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">🥇 个人前三名</div>
      <div class="rank-podium">${podium}</div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">🏆 个人排行榜</div>
        <div class="table-wrap" style="max-height:520px;overflow-y:auto"><table class="table">
          <thead><tr><th>排名</th><th>姓名</th><th>小组</th><th>积分</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="empty">暂无数据</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="card">
        <div class="card-title">🏘️ 小组排行榜</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>排名</th><th>小组</th><th>导师</th><th>人数</th><th>总分</th><th>人均</th></tr></thead>
          <tbody>${gRows}</tbody>
        </table></div>
      </div>
    </div>

    <div class="print-area" id="printArea"></div>`);
}

/* ===================== 积分商城 ===================== */

async function renderShop() {
  const items = (await API.get("/api/shop/items")).data;
  const isHead = S.user.role === "headTeacher";
  let redeems = [];
  if (isHead || S.user.role === "student") {
    try { redeems = (await API.get("/api/shop/redeems")).data; } catch (e) { /* ignore */ }
  }

  const cards = items.map(it => `
    <div class="shop-card">
      <div class="item-icon">${U.escapeHtml(it.icon)}</div>
      <div class="item-name">${U.escapeHtml(it.name)}</div>
      <div class="item-desc">${U.escapeHtml(it.desc || "")}</div>
      <div class="item-price">${it.price} 积分</div>
      <div class="item-stock">库存 ${it.stock}</div>
      ${isHead
        ? `<div style="display:flex;gap:6px;justify-content:center">
            <button class="btn btn-sm btn-ghost" data-action="edit-shop-item" data-id="${it.id}">编辑</button>
            <button class="btn btn-sm btn-danger" data-action="delete-shop-item" data-id="${it.id}">删除</button>
          </div>`
        : S.user.role === "student"
          ? `<button class="btn btn-primary btn-block btn-sm" data-action="redeem-item" data-id="${it.id}" ${it.stock <= 0 ? "disabled" : ""}>${it.stock <= 0 ? "已兑完" : "兑换"}</button>`
          : ""}
    </div>`).join("");

  const rRows = redeems.map(rd => `
    <tr>
      <td>${U.escapeHtml(rd.stuName)}</td>
      <td>${U.escapeHtml(rd.icon)} ${U.escapeHtml(rd.itemName)}</td>
      <td class="num">${rd.price}</td>
      <td>${U.statusBadge(rd.status)}</td>
      <td style="white-space:nowrap">${U.escapeHtml(rd.time)}</td>
      ${isHead ? `<td style="white-space:nowrap">
        ${rd.status === "pending" ? `<button class="btn btn-sm btn-success" data-action="confirm-redeem" data-id="${rd.id}" data-pass="1">发放</button>
        <button class="btn btn-sm btn-danger" data-action="confirm-redeem" data-id="${rd.id}" data-pass="0">取消</button>` : ""}
      </td>` : ""}
    </tr>`).join("");

  return renderLayout(`
    <div class="section-header">
      <div class="section-title">积分商城</div>
      ${isHead ? '<button class="btn btn-primary" data-action="add-shop-item">＋ 上架商品</button>' : ""}
    </div>
    ${isHead ? `
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">🛒 兑换订单</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>学生</th><th>商品</th><th>积分</th><th>状态</th><th>时间</th>${isHead ? "<th>操作</th>" : ""}</tr></thead>
        <tbody>${rRows || '<tr><td colspan="6" class="empty">暂无兑换记录</td></tr>'}</tbody>
      </table></div>
    </div>` : ""}
    <div class="card">
      <div class="card-title">🎁 积分兑换奖品</div>
      <div class="shop-grid">${cards || '<div class="empty">暂无商品</div>'}</div>
    </div>`);
}

/* ===================== 打印中心 ===================== */

async function renderPrint() {
  const r = await API.get("/api/rank");
  const { personal, group } = r.data;
  return renderLayout(`
    <div class="section-header"><div class="section-title">打印中心</div></div>
    <div class="card">
      <div class="card-title">🖨️ 选择打印内容</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" data-action="print-rank">打印个人积分排行榜</button>
        <button class="btn btn-primary" data-action="print-group">打印小组积分排行榜</button>
      </div>
      <p style="font-size:12px;color:var(--text-3);margin-top:12px">点击后在打印对话框中选择打印机即可（支持保存为 PDF）。</p>
    </div>
    <div class="print-area" id="printArea"></div>`);
}

/* ===================== 数据备份 ===================== */

async function renderBackup() {
  return renderLayout(`
    <div class="section-header"><div class="section-title">数据备份</div></div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">📤 导出数据</div>
        <p style="color:var(--text-2);margin-bottom:14px;line-height:1.7">将全部数据（学生、老师、评分、商城）导出为 JSON 备份文件，建议每周备份一次。</p>
        <button class="btn btn-primary" data-action="export-data">导出 JSON 备份</button>
      </div>
      <div class="card">
        <div class="card-title">📥 恢复数据</div>
        <p style="color:var(--text-2);margin-bottom:14px;line-height:1.7">选择之前导出的 JSON 备份文件，一键恢复到系统。恢复会覆盖当前数据，请谨慎操作。</p>
        <input type="file" id="importFile" accept=".json,application/json" style="margin-bottom:12px">
        <button class="btn btn-danger" data-action="import-data">恢复备份</button>
      </div>
    </div>`);
}

/* ===================== 账号管理（班主任） ===================== */

async function renderUsers() {
  const list = (await API.get("/api/users")).data || [];
  const groups = (await API.get("/api/groups")).data || [];
  const roleBadge = (r, isSuper) => {
    if (isSuper) return '<span class="badge badge-red">超级管理员</span>';
    if (r === "teacher") return '<span class="badge badge-blue">导师</span>';
    if (r === "student") return '<span class="badge badge-green">学生</span>';
    return '<span class="badge badge-gray">' + U.escapeHtml(r) + '</span>';
  };
  const rows = list.map(u => `
    <tr>
      <td class="num">${U.escapeHtml(u.username)}</td>
      <td><b>${U.escapeHtml(u.name)}</b></td>
      <td>${roleBadge(u.role, u.isSuper)}</td>
      <td>${u.groupName ? U.escapeHtml(u.groupName) : "—"}</td>
      <td>${u.isSuper ? '<span class="badge badge-red">内置</span>' : `<button class="btn btn-sm btn-ghost" data-action="reset-password" data-id="${u.id}" data-name="${U.escapeHtml(u.name)}">重置密码</button>`}</td>
    </tr>`).join("");

  return renderLayout(`
    <div class="section-header">
      <div class="section-title">账号管理</div>
      <span class="badge badge-blue">共 ${list.length} 个账号</span>
    </div>

    <div class="card">
      <div class="card-title">➕ 创建账号（班主任）</div>
      <p style="color:var(--text-2);margin-bottom:12px;line-height:1.7">学生账号也可用「学生管理 → 导入名单」批量生成；此处用于单独创建老师或学生账号，初始密码默认 123456，账号登录后可自行修改密码。</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
        <div class="form-item" style="margin:0"><label>角色</label>
          <select class="select" id="nuRole">
            <option value="student">学生</option>
            <option value="teacher">导师</option>
          </select>
        </div>
        <div class="form-item" style="margin:0"><label>账号</label><input class="input" id="nuUsername" placeholder="如 teacher06 / 240137"></div>
        <div class="form-item" style="margin:0"><label>姓名</label><input class="input" id="nuName" placeholder="真实姓名"></div>
        <div class="form-item" style="margin:0"><label>初始密码（留空默认123456）</label><input class="input" id="nuPassword" placeholder="123456"></div>
        <div class="form-item" style="margin:0;display:flex;align-items:flex-end"><button class="btn btn-primary" data-action="create-user">创建账号</button></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">👥 全部账号</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>账号</th><th>姓名</th><th>角色</th><th>所属</th><th>操作</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="empty">暂无账号</td></tr>'}</tbody>
      </table></div>
    </div>`);
}

/* ===================== 页面注册表 ===================== */

const PAGES = {
  dashboard: { title: "班级概览", render: renderDashboard, roles: ["headTeacher", "teacher", "student"] },
  students: { title: "学生管理", render: renderStudents, roles: ["headTeacher", "teacher"] },
  groups: { title: "导师小组", render: renderGroups, roles: ["headTeacher", "teacher", "student"] },
  scores: { title: "评分录入", render: renderScores, roles: ["headTeacher", "teacher", "student"] },
  scorelog: { title: "评分流水", render: renderScoreLog, roles: ["headTeacher", "teacher", "student"] },
  audit: { title: "审核中心", render: renderAudit, roles: ["headTeacher"] },
  rank: { title: "积分排行榜", render: renderRank, roles: ["headTeacher", "teacher", "student"] },
  shop: { title: "积分商城", render: renderShop, roles: ["headTeacher", "teacher", "student"] },
  print: { title: "打印中心", render: renderPrint, roles: ["headTeacher", "teacher"] },
  backup: { title: "数据备份", render: renderBackup, roles: ["headTeacher"] },
  users: { title: "账号管理", render: renderUsers, roles: ["headTeacher"] }
};
