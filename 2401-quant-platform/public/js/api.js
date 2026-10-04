/**
 * API 封装 - 与后端 REST 接口通信
 */
const API = {
  token: localStorage.getItem("qms_token") || "",

  async request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = "Bearer " + this.token;
    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* 非 JSON */ }
    if (res.status === 401) {
      localStorage.removeItem("qms_token");
      API.token = "";
      if (location.hash !== "#/login") location.hash = "#/login";
      throw new Error(data.msg || "登录已过期，请重新登录");
    }
    if (!res.ok && !data.ok) {
      throw new Error(data.msg || "请求失败（" + res.status + "）");
    }
    return data;
  },
  get(path) { return this.request("GET", path); },
  post(path, body) { return this.request("POST", path, body || {}); },
  put(path, body) { return this.request("PUT", path, body || {}); },
  del(path) { return this.request("DELETE", path); }
};

/** 通用工具 */
const U = {
  escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },
  scoreClass(v) { return Number(v) >= 0 ? "score-plus" : "score-minus"; },
  scoreText(v) { const n = Number(v); return (n > 0 ? "+" : "") + n; },
  roleName(r, u) {
    if (u && u.isSuper) return "超级管理员";
    return { headTeacher: "班主任", teacher: "导师", student: "学生" }[r] || r;
  },
  roleClass(r) {
    return { headTeacher: "badge-red", teacher: "badge-blue", student: "badge-green" }[r] || "badge-gray";
  },
  leaderBadge(role) {
    return role ? `<span class="badge badge-orange">${U.escapeHtml(role)}</span>` : `<span class="badge badge-gray">普通学生</span>`;
  },
  statusBadge(s) {
    if (s === "active") return '<span class="badge badge-green">已生效</span>';
    if (s === "pending") return '<span class="badge badge-orange">待审核</span>';
    if (s === "reject") return '<span class="badge badge-red">已驳回</span>';
    if (s === "done") return '<span class="badge badge-green">已发放</span>';
    if (s === "cancel") return '<span class="badge badge-gray">已取消</span>';
    return s;
  },
  /** 中文数字组名 */
  groupName(id) {
    const cn = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    return "第" + (cn[Number(id) - 1] || id) + "组";
  },
  avatarColor(name) {
    const colors = ["#1677ff", "#00b42a", "#ff7d00", "#722ed1", "#f53f3f", "#13c2c2"];
    let h = 0;
    const s = String(name);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return colors[h % colors.length];
  },
  initials(name) {
    return String(name || "?").slice(0, 1);
  },
  now() {
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
};
