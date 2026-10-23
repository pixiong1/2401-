/**
 * 2401班导师制量化管理系统 - 后端服务（零依赖）
 * 运行：node server.js  （默认端口 3000，可用环境变量 PORT 覆盖）
 *
 * 技术说明：
 *  - 纯 Node 原生模块（http / fs / crypto / path），无需安装任何依赖
 *  - 数据存储：data/db.json（JSON 文件数据库，原子写入）
 *  - 认证：token 会话机制（密码 sha256 哈希存储）
 *  - 首次启动自动写入预置数据（1 班主任 + 5 导师 + 36 学生 + 6 小组）
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(ROOT, "public");

/* ===================== 数据库层 ===================== */

let db = null;

function emptyDB() {
  return {
    users: [],
    sessions: [],
    students: [],
    groups: [],
    scores: [],
    grades: [],
    meta: { createdAt: null }
  };
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function loadDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      // 兼容旧数据文件：积分商城已取消；成绩表可能缺失
      if (!Array.isArray(db.grades)) db.grades = [];
      db.shopItems = [];
      db.redeems = [];
      // 确保 admin 始终是超级管理员（兼容旧数据文件）
      const admin = db.users.find(u => u.id === "u-admin" || u.username === "admin");
      if (admin) admin.isSuper = true;
      return;
    } catch (e) {
      console.error("数据库损坏，重建预置数据：", e.message);
    }
  }
  db = emptyDB();
  seedDB();
  saveDB();
}

function saveDB() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(tmp, DB_FILE);
}

/* ===================== 预置数据 ===================== */

const TEACHER_NAMES = ["王建国", "李慧敏", "张伟", "刘洋", "陈静"];
const STUDENT_NAMES = [
  ["周明轩", "陈雨桐", "王子豪", "刘思颖", "杨子涵", "张嘉怡"],
  ["李俊杰", "赵欣怡", "孙浩然", "吴梦瑶", "郑天宇", "黄若曦"],
  ["何志远", "徐佳琪", "马晨曦", "胡文博", "高晓彤", "林一鸣"],
  ["罗诗涵", "梁浩宇", "宋可欣", "唐子睿", "韩雨霏", "曹文轩"],
  ["许博文", "邓雅婷", "冯俊熙", "曾语嫣", "彭宇航", "苏婉清"],
  ["蒋天赐", "蔡欣妍", "潘志鹏", "田乐乐", "魏子谦", "董诗雅"]
];
const LEADER_ROLES = ["班长", "副班长", "学习委员", "纪律委员", "卫生委员", "体育委员", "文艺委员", "生活委员", "宣传委员", "电教委员"];

function seedDB() {
  const now = new Date().toISOString();
  db.meta = { createdAt: now };

  // 用户：班主任（超级管理员）+ 5 导师
  db.users.push({ id: "u-admin", username: "admin", password: sha256("admin123"), name: "班主任", role: "headTeacher", isSuper: true, createdAt: now });
  for (let i = 0; i < TEACHER_NAMES.length; i++) {
    db.users.push({
      id: "t" + (i + 1),
      username: "t0" + (i + 1),
      password: sha256("123456"),
      name: TEACHER_NAMES[i],
      role: "teacher",
      createdAt: now
    });
  }

  // 小组：6 组，前 5 组对应 5 位导师，第 6 组由班主任带
  for (let i = 1; i <= 6; i++) {
    db.groups.push({
      id: i,
      name: "第" + ["一", "二", "三", "四", "五", "六"][i - 1] + "导师小组",
      teacherId: i <= 5 ? "t" + i : "u-admin"
    });
  }

  // 36 名学生，学号 240101~240136，前 10 名任班委
  let idx = 0;
  for (let g = 0; g < 6; g++) {
    for (let s = 0; s < 6; s++) {
      idx++;
      const stuId = "2401" + String(idx).padStart(2, "0");
      const name = STUDENT_NAMES[g][s];
      const leaderRole = idx <= 10 ? LEADER_ROLES[idx - 1] : "";
      db.users.push({
        id: "s" + stuId,
        username: stuId,
        password: sha256("123456"),
        name: name,
        role: "student",
        createdAt: now
      });
      db.students.push({
        id: "s" + stuId,
        stuId: stuId,
        name: name,
        groupId: g + 1,
        leaderRole: leaderRole,
        totalScore: 0,
        createdAt: now
      });
    }
  }

  // 预置评分流水（每个学生至少 3 条加分 + 部分扣分，保证排行榜和积分可玩）
  const addReasons = ["课堂积极回答问题", "作业完成优秀", "帮助同学", "考试进步明显", "主动承担班级事务", "拾金不昧", "英语晨读认真", "主动擦黑板"];
  const subReasons = ["迟到", "上课讲话", "卫生未打扫干净", "自习课纪律差", "午休讲话", "跑操迟到"];
  let scoreIdx = 0;
  const pushScore = (stu, score, reason, opId) => {
    const op = db.users.find(u => u.id === opId) || db.users[0];
    db.scores.push({
      id: "sc" + (++scoreIdx),
      stuId: stu.stuId,
      score: score,
      reason: reason,
      opId: op.id,
      opName: op.name,
      status: "active",
      rejectMsg: "",
      createTime: new Date(Date.now() - scoreIdx * 2 * 3600 * 1000).toLocaleString("zh-CN", { hour12: false })
    });
  };
  db.students.forEach((stu, si) => {
    pushScore(stu, 2 + (si % 3), addReasons[si % addReasons.length], "t" + ((si % 5) + 1));
    pushScore(stu, 2 + ((si + 1) % 3), addReasons[(si + 3) % addReasons.length], "t" + (((si + 1) % 5) + 1));
    pushScore(stu, 2 + ((si + 2) % 3), addReasons[(si + 5) % addReasons.length], si % 4 === 0 ? "u-admin" : "t" + (((si + 2) % 5) + 1));
    if (si % 3 === 1) {
      pushScore(stu, -(1 + (si % 2)), subReasons[si % subReasons.length], "u-admin");
    }
  });
  recalcScores();
}

/* ===================== 工具函数 ===================== */

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function recalcScores() {
  const sum = {};
  db.scores.filter(r => r.status === "active").forEach(r => {
    sum[r.stuId] = (sum[r.stuId] || 0) + Number(r.score);
  });
  db.students.forEach(s => { s.totalScore = sum[s.stuId] || 0; });
}

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role, isSuper: !!u.isSuper };
}

/* 班主任级权限（超级管理员 isSuper 始终拥有班主任权限） */
function isHead(u) {
  return !!u && (u.role === "headTeacher" || u.isSuper === true);
}

function getGroup(id) { return db.groups.find(g => g.id === Number(id)); }
function getStudent(stuId) { return db.students.find(s => s.stuId === String(stuId)); }

function isLeader(stu) { return !!(stu && stu.leaderRole); }

/* ===================== 钉钉通知 ===================== */

const CONFIG_FILE = path.join(DATA_DIR, "config.json");

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")); } catch (e) { return {}; }
}
function saveConfig(cfg) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

/** 统计某学生当前生效总分（不依赖 recalcScores 调用时机） */
function studentTotal(stuId) {
  return db.scores.filter(r => r.stuId === stuId && r.status === "active").reduce((a, r) => a + Number(r.score), 0);
}

/**
 * 学生积分变动后，向该生对应的导师发送钉钉群机器人消息。
 * 需要在「系统设置」中配置钉钉群机器人 Webhook（含 access_token）；未配置时自动跳过。
 */
function notifyTeacher(stu, score, reason) {
  if (!stu) return;
  const g = getGroup(stu.groupId);
  const teacher = g ? db.users.find(u => u.id === g.teacherId) : null;
  if (!teacher) return;
  const hook = (loadConfig().dingWebhook || "").trim();
  if (!hook || !/^https?:\/\//i.test(hook)) return;
  const total = studentTotal(stu.stuId);
  const msg = "【2401量化提醒】" + stu.name + "（" + stu.stuId + "）积分 " + (Number(score) > 0 ? "+" : "") + Number(score) + " 分\n事由：" + reason + "\n当前总分：" + total + " 分";
  const body = JSON.stringify({ msgtype: "text", text: { content: msg } });
  try {
    const req = http.request(hook, { method: "POST", headers: { "Content-Type": "application/json" } }, res => { res.resume(); });
    req.on("error", () => { /* 通知失败不影响主流程 */ });
    req.setTimeout(5000, () => req.destroy());
    req.write(body);
    req.end();
  } catch (e) { /* ignore */ }
}

/* ===================== HTTP 工具 ===================== */

function send(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
  return Promise.resolve();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > 5 * 1024 * 1024) { reject(new Error("请求体过大")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) { reject(new Error("JSON 解析失败")); }
    });
    req.on("error", reject);
  });
}

/* ===================== 认证 ===================== */

function getToken(req) {
  const h = req.headers["authorization"] || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  // 从 Cookie 读取（支持"自动登录"：浏览器自动携带持久 cookie）
  const cookie = req.headers["cookie"] || "";
  const m = cookie.match(/(?:^|;)\s*qms_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function authUser(req) {
  const token = getToken(req);
  if (!token) return null;
  const sess = db.sessions.find(s => s.token === token);
  if (!sess) return null;
  return db.users.find(u => u.id === sess.userId) || null;
}

function requireAuth(req, res) {
  const user = authUser(req);
  if (!user) { send(res, 401, { ok: false, msg: "未登录或登录已过期" }); return null; }
  return user;
}

/* ===================== API 路由 ===================== */

function handleAPI(req, res, url, method) {
  const p = url.pathname;
  const parts = p.split("/").filter(Boolean); // ["api", ...]

  // ---- 公开接口：登录（注册已关闭，账号由班主任统一创建） ----
  if (method === "POST" && p === "/api/login") {
    return readBody(req).then(b => {
      const { username, password } = b;
      const user = db.users.find(u => u.username === username);
      if (!user || user.password !== sha256(password || "")) return send(res, 400, { ok: false, msg: "账号或密码错误" });
      const token = uid("tk");
      db.sessions.push({ token, userId: user.id });
      saveDB();
      // 持久 cookie：实现自动登录（90 天有效，HttpOnly 安全）
      res.setHeader("Set-Cookie", `qms_token=${token}; Path=/; Max-Age=7776000; HttpOnly; SameSite=Lax`);
      return send(res, 200, { ok: true, msg: "登录成功", token, user: publicUser(user) });
    });
  }

  if (method === "POST" && p === "/api/logout") {
    const token = getToken(req);
    db.sessions = db.sessions.filter(s => s.token !== token);
    saveDB();
    res.setHeader("Set-Cookie", "qms_token=; Path=/; Max-Age=0");
    return send(res, 200, { ok: true });
  }

  // ---- 以下接口需要登录 ----
  const user = requireAuth(req, res);
  if (!user) return Promise.resolve();

  /* ---------- 修改密码（学生/老师/班主任均可，改自己的密码） ---------- */
  if (method === "POST" && p === "/api/change-password") {
    return readBody(req).then(b => {
      const { oldPassword, newPassword } = b;
      if (!oldPassword || !newPassword) return send(res, 400, { ok: false, msg: "请填写当前密码和新密码" });
      if (String(newPassword).length < 6) return send(res, 400, { ok: false, msg: "新密码至少 6 位" });
      const u = db.users.find(x => x.id === user.id);
      if (!u || u.password !== sha256(String(oldPassword))) return send(res, 400, { ok: false, msg: "当前密码不正确" });
      u.password = sha256(String(newPassword));
      saveDB();
      return send(res, 200, { ok: true, msg: "密码修改成功，下次登录请使用新密码" });
    });
  }

  /* ---------- 账号管理（仅班主任/超级管理员） ---------- */
  if (method === "GET" && p === "/api/users") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可管理账号" });
    const list = db.users.map(u => {
      const stu = db.students.find(s => s.stuId === u.username);
      let groupName = "";
      if (u.role === "student" && stu) {
        const g = getGroup(stu.groupId);
        groupName = g ? g.name : "";
      } else if (u.role === "teacher") {
        const g = db.groups.find(g => g.teacherId === u.id);
        groupName = g ? g.name : "";
      }
      return { id: u.id, username: u.username, name: u.name, role: u.role, isSuper: !!u.isSuper, groupName };
    }).sort((a, b) => a.username.localeCompare(b.username));
    return send(res, 200, { ok: true, data: list });
  }

  if (method === "POST" && p === "/api/users") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可创建账号" });
    return readBody(req).then(b => {
      const username = String(b.username || "").trim();
      const name = String(b.name || "").trim();
      if (b.role !== "teacher" && b.role !== "student") return send(res, 400, { ok: false, msg: "只能创建老师或学生账号，班主任账号由系统内置" });
      const role = b.role;
      const password = String(b.password || "123456");
      if (!username || !name) return send(res, 400, { ok: false, msg: "账号和姓名不能为空" });
      if (String(username).length < 3) return send(res, 400, { ok: false, msg: "账号至少 3 个字符" });
      if (String(password).length < 6) return send(res, 400, { ok: false, msg: "密码至少 6 位" });
      if (db.users.some(u => u.username === username)) return send(res, 400, { ok: false, msg: "该账号已存在" });
      const newUser = { id: uid("u"), username, password: sha256(password), name, role, createdAt: new Date().toISOString() };
      db.users.push(newUser);
      // 学生账号自动补建学生档案
      if (role === "student" && !db.students.some(s => s.stuId === username)) {
        db.students.push({ id: newUser.id, stuId: username, name, groupId: 1, leaderRole: "", totalScore: 0, createdAt: new Date().toISOString() });
      }
      saveDB();
      return send(res, 200, { ok: true, msg: "创建成功，账号：" + username + "，初始密码：" + password });
    });
  }

  // 班主任重置某账号密码
  const userPwMatch = p.match(/^\/api\/users\/([^\/]+)\/password$/);
  if (userPwMatch && method === "PUT") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可重置密码" });
    return readBody(req).then(b => {
      const u = db.users.find(x => x.id === userPwMatch[1] || x.username === userPwMatch[1]);
      if (!u) return send(res, 404, { ok: false, msg: "账号不存在" });
      const np = String(b.password || "123456");
      if (np.length < 6) return send(res, 400, { ok: false, msg: "密码至少 6 位" });
      u.password = sha256(np);
      saveDB();
      return send(res, 200, { ok: true, msg: "已重置 " + u.name + " 的密码为：" + np });
    });
  }

  if (method === "GET" && p === "/api/me") {
    const u = db.users.find(x => x.id === user.id);
    const extra = {};
    if (u.role === "student") {
      const stu = getStudent(u.username);
      extra.student = stu ? { stuId: stu.stuId, groupId: stu.groupId, leaderRole: stu.leaderRole, totalScore: stu.totalScore } : null;
    }
    if (u.role === "teacher" || u.role === "headTeacher") {
      extra.group = db.groups.find(g => g.teacherId === u.id) || null;
    }
    return send(res, 200, { ok: true, user: publicUser(u), ...extra });
  }

  /* ---------- 概览 ---------- */
  if (method === "GET" && p === "/api/dashboard") {
    const todayStr = new Date().toLocaleDateString("zh-CN");
    const todayPrefix = todayStr + " ";
    const todayCount = db.scores.filter(r => r.createTime.startsWith(todayPrefix)).length;
    const pending = db.scores.filter(r => r.status === "pending").length;
    // 小组带排名信息
    const groupWithRank = (g) => {
      const members = db.students.filter(s => s.groupId === g.id);
      const total = members.reduce((a, s) => a + s.totalScore, 0);
      const ranks = db.groups.map(x => ({
        id: x.id,
        total: db.students.filter(s => s.groupId === x.id).reduce((a, s) => a + s.totalScore, 0)
      })).sort((a, b) => b.total - a.total);
      const gr = ranks.findIndex(x => x.id === g.id);
      return { id: g.id, name: g.name, memberCount: members.length, totalScore: total, groupRank: gr >= 0 ? gr + 1 : 0 };
    };
    // 评分记录视图（附学生名与组名）
    const scoreView = (r) => {
      const stu = getStudent(r.stuId);
      return {
        id: r.id, stuId: r.stuId, stuName: stu ? stu.name : r.stuId,
        groupName: stu ? ((getGroup(stu.groupId) || {}).name || "") : "",
        score: r.score, reason: r.reason, opName: r.opName, status: r.status, createTime: r.createTime
      };
    };
    const data = {
      studentCount: db.students.length,
      teacherCount: db.users.filter(u => (u.role === "teacher" || u.role === "headTeacher") && !u.isSuper).length,
      groupCount: db.groups.length,
      scoreCount: db.scores.length,
      pendingCount: pending,
      todayCount: todayCount,
      avgScore: db.students.length ? Math.round(db.students.reduce((a, s) => a + s.totalScore, 0) / db.students.length * 10) / 10 : 0,
      topStudents: [...db.students].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5).map(s => ({
        name: s.name, totalScore: s.totalScore, leaderRole: s.leaderRole
      })),
      recentScores: db.scores.slice(-8).reverse().map(scoreView)
    };
    // 角色过滤：学生 - 我的积分/排名/小组/个人记录/同组记录/其他记录
    if (user.role === "student") {
      const stu = getStudent(user.username);
      if (stu) {
        const myGroupRaw = getGroup(stu.groupId);
        const myGroup = myGroupRaw ? groupWithRank(myGroupRaw) : null;
        const groupIds = new Set(db.students.filter(s => s.groupId === stu.groupId).map(s => s.stuId));
        const all = [...db.scores].slice(-300).reverse();
        data.myScore = stu.totalScore;
        data.myRank = db.students.filter(s => s.totalScore > stu.totalScore).length + 1;
        data.myGroup = myGroup;
        data.myScores = all.filter(r => r.stuId === stu.stuId).map(scoreView);
        data.groupScores = all.filter(r => groupIds.has(r.stuId)).map(scoreView);
        data.otherScores = all.filter(r => !groupIds.has(r.stuId)).map(scoreView);
      } else {
        data.myScore = 0; data.myRank = 0; data.myGroup = null;
        data.myScores = []; data.groupScores = []; data.otherScores = [];
      }
    }
    // 角色过滤：老师/班主任 - 我的小组排名/本组记录/其他记录
    if (user.role === "teacher" || user.role === "headTeacher") {
      const myGroupRaw = db.groups.find(g => g.teacherId === user.id);
      const myGroup = myGroupRaw ? groupWithRank(myGroupRaw) : null;
      const groupIds = myGroupRaw ? new Set(db.students.filter(s => s.groupId === myGroupRaw.id).map(s => s.stuId)) : new Set();
      const all = [...db.scores].slice(-300).reverse();
      data.myGroup = myGroup;
      data.groupScores = groupIds.size ? all.filter(r => groupIds.has(r.stuId)).map(scoreView) : [];
      data.otherScores = groupIds.size ? all.filter(r => !groupIds.has(r.stuId)).map(scoreView) : all.map(scoreView);
    }
    return send(res, 200, { ok: true, data });
  }

  /* ---------- 学生管理 ---------- */
  if (method === "GET" && p === "/api/students") {
    let list = [...db.students];
    // 导师/班主任可查看全部学生并为其记录量化
    if (user.role === "student") {
      const stu = getStudent(user.username);
      // 班委可查看全班（用于给同学评分），普通学生只看自己
      if (!(stu && stu.leaderRole)) list = list.filter(s => s.stuId === user.username);
    }
    const result = list.map(s => {
      const g = getGroup(s.groupId);
      const u = db.users.find(x => x.username === s.stuId);
      return { ...s, groupName: g ? g.name : "未分配", hasAccount: !!u };
    }).sort((a, b) => a.stuId.localeCompare(b.stuId));
    return send(res, 200, { ok: true, data: result });
  }

  if (method === "POST" && p === "/api/students/import") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可导入学生" });
    return readBody(req).then(b => {
      const items = Array.isArray(b.items) ? b.items : [];
      if (!items.length) return send(res, 400, { ok: false, msg: "没有可导入的数据" });
      let okCount = 0, skipCount = 0;
      const now = new Date().toISOString();
      items.forEach(it => {
        const stuId = String(it.stuId || "").trim();
        const name = String(it.name || "").trim();
        if (!stuId || !name) { skipCount++; return; }
        const groupId = Number(it.groupId) >= 1 && Number(it.groupId) <= 6 ? Number(it.groupId) : 1;
        const leaderRole = String(it.leaderRole || "").trim();
        let stu = db.students.find(s => s.stuId === stuId);
        if (stu) { skipCount++; return; }
        stu = { id: "s" + stuId, stuId, name, groupId, leaderRole, totalScore: 0, createdAt: now };
        db.students.push(stu);
        if (!db.users.some(u => u.username === stuId)) {
          db.users.push({ id: stu.id, username: stuId, password: sha256("123456"), name, role: "student", createdAt: now });
        }
        okCount++;
      });
      saveDB();
      return send(res, 200, { ok: true, msg: "导入成功 " + okCount + " 人，跳过 " + skipCount + " 人", okCount, skipCount });
    });
  }

  if (method === "POST" && p === "/api/students") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可添加学生" });
    return readBody(req).then(b => {
      const stuId = String(b.stuId || "").trim();
      const name = String(b.name || "").trim();
      if (!stuId || !name) return send(res, 400, { ok: false, msg: "学号和姓名不能为空" });
      if (db.students.some(s => s.stuId === stuId)) return send(res, 400, { ok: false, msg: "该学号已存在" });
      const groupId = Number(b.groupId) || 1;
      const stu = { id: "s" + stuId, stuId, name, groupId, leaderRole: String(b.leaderRole || "").trim(), totalScore: 0, createdAt: new Date().toISOString() };
      db.students.push(stu);
      if (!db.users.some(u => u.username === stuId)) {
        db.users.push({ id: stu.id, username: stuId, password: sha256("123456"), name, role: "student", createdAt: new Date().toISOString() });
      }
      saveDB();
      return send(res, 200, { ok: true, msg: "添加成功，学生账号：" + stuId + "，初始密码：123456" });
    });
  }

  // PUT /api/students/:id
  const stuMatch = p.match(/^\/api\/students\/([^\/]+)$/);
  if (stuMatch && method === "PUT") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可修改学生" });
    return readBody(req).then(b => {
      const stu = db.students.find(s => s.id === stuMatch[1] || s.stuId === stuMatch[1]);
      if (!stu) return send(res, 404, { ok: false, msg: "学生不存在" });
      if (b.name) stu.name = String(b.name).trim();
      if (b.groupId) stu.groupId = Number(b.groupId);
      if (b.leaderRole !== undefined) stu.leaderRole = String(b.leaderRole).trim();
      const u = db.users.find(x => x.username === stu.stuId);
      if (u && b.name) u.name = stu.name;
      saveDB();
      return send(res, 200, { ok: true, msg: "已保存" });
    });
  }

  if (stuMatch && method === "DELETE") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可删除学生" });
    const stu = db.students.find(s => s.id === stuMatch[1] || s.stuId === stuMatch[1]);
    if (!stu) return send(res, 404, { ok: false, msg: "学生不存在" });
    db.students = db.students.filter(s => s.id !== stu.id);
    db.users = db.users.filter(u => u.username !== stu.stuId);
    db.sessions = db.sessions.filter(s => s.userId !== stu.id);
    saveDB();
    return send(res, 200, { ok: true, msg: "已删除" });
  }

  /* ---------- 小组管理 ---------- */
  if (method === "GET" && p === "/api/groups") {
    const data = db.groups.map(g => {
      const members = db.students.filter(s => s.groupId === g.id);
      const teacher = db.users.find(u => u.id === g.teacherId);
      return {
        ...g,
        teacherName: teacher ? teacher.name : "未分配",
        memberCount: members.length,
        totalScore: members.reduce((a, s) => a + s.totalScore, 0),
        avgScore: members.length ? Math.round(members.reduce((a, s) => a + s.totalScore, 0) / members.length * 10) / 10 : 0
      };
    });
    return send(res, 200, { ok: true, data });
  }

  const groupMatch = p.match(/^\/api\/groups\/(\d+)$/);
  if (groupMatch && method === "PUT") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可修改小组" });
    return readBody(req).then(b => {
      const g = getGroup(groupMatch[1]);
      if (!g) return send(res, 404, { ok: false, msg: "小组不存在" });
      if (b.name) g.name = String(b.name).trim();
      if (b.teacherId) {
        if (!db.users.some(u => u.id === b.teacherId && (u.role === "teacher" || u.role === "headTeacher"))) {
          return send(res, 400, { ok: false, msg: "导师不存在" });
        }
        g.teacherId = b.teacherId;
      }
      saveDB();
      return send(res, 200, { ok: true, msg: "已保存" });
    });
  }

  /* ---------- 导师管理 ---------- */
  if (method === "GET" && p === "/api/teachers") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可见" });
    // 超级管理员不参与"老师/导师"身份，从列表中隐藏
    const data = db.users.filter(u => (u.role === "teacher" || u.role === "headTeacher") && !u.isSuper).map(u => {
      const g = db.groups.find(x => x.teacherId === u.id);
      return { ...publicUser(u), groupId: g ? g.id : null, groupName: g ? g.name : "未分配小组" };
    });
    return send(res, 200, { ok: true, data });
  }

  /* ---------- 评分 ---------- */
  if (method === "POST" && p === "/api/scores") {
    return readBody(req).then(b => {
      const stu = getStudent(b.stuId);
      if (!stu) return send(res, 400, { ok: false, msg: "学生不存在" });
      const score = Number(b.score);
      if (isNaN(score) || score === 0 || !Number.isInteger(score)) return send(res, 400, { ok: false, msg: "分数必须是整数（正数加分，负数扣分）" });
      if (Math.abs(score) > 50) return send(res, 400, { ok: false, msg: "单次分数不能超过 50" });
      const reason = String(b.reason || "").trim();
      if (!reason) return send(res, 400, { ok: false, msg: "请填写评分事由" });
      const direct = user.role === "headTeacher" || user.role === "teacher";
      const rec = {
        id: uid("sc"),
        stuId: stu.stuId,
        score: score,
        reason: reason,
        opId: user.id,
        opName: user.name,
        status: direct ? "active" : "pending",
        rejectMsg: "",
        createTime: new Date().toLocaleString("zh-CN", { hour12: false })
      };
      db.scores.push(rec);
      recalcScores();
      saveDB();
      if (direct) notifyTeacher(stu, score, reason);
      return send(res, 200, {
        ok: true,
        msg: direct ? "评分已生效" : "已提交，等待班主任审核",
        record: { ...rec, stuName: stu.name }
      });
    });
  }

  /* ---------- 批量录入（方式一：选择式 —— 多名同学 同一分数 同一事由） ---------- */
  if (method === "POST" && p === "/api/scores/batch") {
    return readBody(req).then(b => {
      const stuIds = Array.isArray(b.stuIds) ? b.stuIds.filter(x => String(x).trim()) : [];
      if (!stuIds.length) return send(res, 400, { ok: false, msg: "请至少选择一名学生" });
      const score = Number(b.score);
      if (isNaN(score) || score === 0 || !Number.isInteger(score)) return send(res, 400, { ok: false, msg: "分数必须是整数（正数加分，负数扣分）" });
      if (Math.abs(score) > 50) return send(res, 400, { ok: false, msg: "单次分数不能超过 50" });
      const reason = String(b.reason || "").trim();
      if (!reason) return send(res, 400, { ok: false, msg: "请填写评分事由" });
      const direct = user.role === "headTeacher" || user.role === "teacher";
      const recs = [];
      for (const sid of stuIds) {
        const stu = getStudent(sid);
        if (!stu) continue;
        const rec = {
          id: uid("sc"), stuId: stu.stuId, score, reason,
          opId: user.id, opName: user.name,
          status: direct ? "active" : "pending",
          rejectMsg: "",
          createTime: new Date().toLocaleString("zh-CN", { hour12: false })
        };
        db.scores.push(rec);
        recs.push(rec);
      }
      recalcScores();
      saveDB();
      if (direct) recs.forEach(r => { const s = getStudent(r.stuId); notifyTeacher(s, r.score, r.reason); });
      return send(res, 200, {
        ok: true,
        msg: "已为 " + recs.length + " 名学生记录评分" + (direct ? "" : "，等待班主任审核"),
        count: recs.length
      });
    });
  }

  /* ---------- 批量录入（方式二：表格式 —— 多名同学 不同分数 不同事由，班主任下载模板填写后上传） ---------- */
  if (method === "POST" && p === "/api/scores/batch-upload") {
    return readBody(req).then(b => {
      const items = Array.isArray(b.items) ? b.items : [];
      if (!items.length) return send(res, 400, { ok: false, msg: "没有可导入的数据" });
      const direct = user.role === "headTeacher" || user.role === "teacher";
      let ok = 0, skip = 0;
      const recs = [];
      for (const it of items) {
        const stu = getStudent(String(it.stuId || "").trim());
        if (!stu) { skip++; continue; }
        const score = Number(it.score);
        const reason = String(it.reason || "").trim();
        if (isNaN(score) || score === 0 || !Number.isInteger(score) || Math.abs(score) > 50 || !reason) { skip++; continue; }
        const rec = {
          id: uid("sc"), stuId: stu.stuId, score, reason,
          opId: user.id, opName: user.name,
          status: direct ? "active" : "pending",
          rejectMsg: "",
          createTime: new Date().toLocaleString("zh-CN", { hour12: false })
        };
        db.scores.push(rec);
        recs.push(rec);
        ok++;
      }
      recalcScores();
      saveDB();
      if (direct) recs.forEach(r => { const s = getStudent(r.stuId); notifyTeacher(s, r.score, r.reason); });
      return send(res, 200, {
        ok: true,
        msg: "成功导入 " + ok + " 条，跳过 " + skip + " 条" + (direct ? "" : "（等待班主任审核）"),
        okCount: ok, skipCount: skip
      });
    });
  }

  if (method === "GET" && p === "/api/scores") {
    const status = url.searchParams.get("status") || "all";
    // 全员公示：所有账号可见全部积分记录
    let list = [...db.scores];
    if (status !== "all") list = list.filter(r => r.status === status);
    const data = list.slice(-200).reverse().map(r => {
      const stu = getStudent(r.stuId);
      return { ...r, stuName: stu ? stu.name : r.stuId };
    });
    return send(res, 200, { ok: true, data });
  }

  const scoreAuditMatch = p.match(/^\/api\/scores\/([\w-]+)\/audit$/);
  if (scoreAuditMatch && method === "POST") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可审核" });
    return readBody(req).then(b => {
      const rec = db.scores.find(r => r.id === scoreAuditMatch[1]);
      if (!rec) return send(res, 404, { ok: false, msg: "记录不存在" });
      if (rec.status !== "pending") return send(res, 400, { ok: false, msg: "该记录已处理" });
      rec.status = b.pass ? "active" : "reject";
      rec.rejectMsg = b.pass ? "" : String(b.rejectMsg || "未通过");
      recalcScores();
      saveDB();
      if (b.pass) { const s = getStudent(rec.stuId); notifyTeacher(s, rec.score, rec.reason); }
      return send(res, 200, { ok: true, msg: b.pass ? "已通过" : "已驳回" });
    });
  }

  /* ---------- 排行榜 ---------- */
  if (method === "GET" && p === "/api/rank") {
    const personal = [...db.students].sort((a, b) => b.totalScore - a.totalScore).map((s, i) => {
      const g = getGroup(s.groupId);
      return { rank: i + 1, stuId: s.stuId, name: s.name, groupId: s.groupId, groupName: g ? g.name : "-", leaderRole: s.leaderRole, totalScore: s.totalScore };
    });
    const group = db.groups.map(g => {
      const members = db.students.filter(s => s.groupId === g.id);
      const total = members.reduce((a, s) => a + s.totalScore, 0);
      return {
        id: g.id, name: g.name, teacherName: (db.users.find(u => u.id === g.teacherId) || {}).name || "-",
        memberCount: members.length, totalScore: total,
        avgScore: members.length ? Math.round(total / members.length * 10) / 10 : 0
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
    return send(res, 200, { ok: true, data: { personal, group } });
  }

  /* ---------- 成绩管理（班主任录入 → 学生端同步 → 排名量化） ---------- */

  // 班主任/导师查看全部成绩（按批次分组）
  if (method === "GET" && p === "/api/grades") {
    if (!isHead(user) && user.role !== "teacher") return send(res, 403, { ok: false, msg: "无权限查看成绩" });
    const batches = {};
    db.grades.forEach(g => { (batches[g.batchId] = batches[g.batchId] || []).push(g); });
    const list = Object.keys(batches).map(bid => {
      const recs = batches[bid];
      return {
        batchId: bid,
        exam: recs[0].exam,
        createTime: recs[0].createTime,
        status: recs[0].status,
        confirmedBy: recs[0].confirmedBy,
        confirmTime: recs[0].confirmTime,
        count: recs.length,
        records: recs
      };
    }).sort((a, b) => b.createTime.localeCompare(a.createTime));
    return send(res, 200, { ok: true, data: list });
  }

  // 学生查看自己的成绩（只能看自己）
  if (method === "GET" && p === "/api/grades/mine") {
    if (user.role !== "student") return send(res, 403, { ok: false, msg: "仅学生可查看自己的成绩" });
    const stu = getStudent(user.username);
    if (!stu) return send(res, 200, { ok: true, data: [] });
    const list = db.grades.filter(g => g.stuId === stu.stuId).map(g => ({ ...g })).reverse();
    return send(res, 200, { ok: true, data: list });
  }

  // 班主任上传成绩批次（status=pending，确认后生成量化分）
  if (method === "POST" && p === "/api/grades/upload") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可上传成绩" });
    return readBody(req).then(b => {
      const exam = String(b.exam || "").trim();
      if (!exam) return send(res, 400, { ok: false, msg: "请填写考试名称（如：10月月考）" });
      const items = Array.isArray(b.items) ? b.items : [];
      if (!items.length) return send(res, 400, { ok: false, msg: "没有可导入的成绩数据" });
      const batchId = uid("gb");
      const now = new Date().toLocaleString("zh-CN", { hour12: false });
      // 自动计算班级排名（同批次按总成绩降序，同分并列）
      const valid = items.filter(it => !!getStudent(String(it.stuId || "").trim()) && !isNaN(Number(it.total)));
      valid.sort((a, b) => Number(b.total) - Number(a.total));
      let lastTotal = null, lastRank = 0;
      const rankMap = {};
      valid.forEach((it, i) => {
        if (Number(it.total) !== lastTotal) { lastRank = i + 1; lastTotal = Number(it.total); }
        rankMap[String(it.stuId).trim()] = lastRank;
      });
      let ok = 0, skip = 0;
      for (const it of items) {
        const stu = getStudent(String(it.stuId || "").trim());
        if (!stu || isNaN(Number(it.total))) { skip++; continue; }
        const total = Number(it.total);
        // 取该生最近一次成绩作为进退步基准
        const prev = db.grades.filter(g => g.stuId === stu.stuId)
          .sort((a, b) => (b.createTime || "").localeCompare(a.createTime || ""))[0];
        const gradeRank = it.gradeRank !== undefined && it.gradeRank !== "" ? Number(it.gradeRank) : null;
        const classRank = it.classRank !== undefined && it.classRank !== "" ? Number(it.classRank) : (rankMap[stu.stuId] || null);
        const subjects = (it.subjects && typeof it.subjects === "object") ? it.subjects : {};
        db.grades.push({
          id: uid("gr"), batchId, exam,
          stuId: stu.stuId, name: stu.name,
          total: total,
          rawScore: it.rawScore !== undefined && it.rawScore !== "" ? Number(it.rawScore) : null,
          subjects: subjects,
          classRank: classRank,
          gradeRank: gradeRank,
          prevGradeRank: prev ? prev.gradeRank : null,
          createTime: now, status: "pending", confirmedBy: null, confirmTime: null
        });
        ok++;
      }
      saveDB();
      return send(res, 200, { ok: true, msg: "已导入 " + ok + " 条成绩，待班主任确认后生成量化分", okCount: ok, skipCount: skip, batchId });
    });
  }

  // 班主任确认批次量化：进步x名加x分，退步x名减x分（事由：成绩排名进/退步×名）
  if (method === "POST" && p === "/api/grades/confirm") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可确认" });
    return readBody(req).then(b => {
      const bid = String(b.batchId || "");
      const recs = db.grades.filter(g => g.batchId === bid);
      if (!recs.length) return send(res, 404, { ok: false, msg: "批次不存在" });
      if (recs[0].status === "confirmed") return send(res, 400, { ok: false, msg: "该批次已确认过" });
      let added = 0, unchanged = 0, noBase = 0;
      const newScores = [];
      recs.forEach(g => {
        if (g.prevGradeRank == null || g.gradeRank == null) { noBase++; return; } // 首次录入或无年级排名，仅记录成绩
        const diff = Number(g.prevGradeRank) - Number(g.gradeRank); // >0 进步
        if (diff === 0) { unchanged++; return; }
        const score = diff;
        const reason = diff > 0 ? "成绩排名进步" + diff + "名" : "成绩排名退步" + (-diff) + "名";
        const rec = {
          id: uid("sc"), stuId: g.stuId, score, reason,
          opId: user.id, opName: user.name, status: "active", rejectMsg: "",
          createTime: new Date().toLocaleString("zh-CN", { hour12: false })
        };
        db.scores.push(rec);
        newScores.push(rec);
        added++;
      });
      const confirmTime = new Date().toLocaleString("zh-CN", { hour12: false });
      recs.forEach(g => { g.status = "confirmed"; g.confirmedBy = user.name; g.confirmTime = confirmTime; });
      recalcScores();
      saveDB();
      newScores.forEach(r => { const s = getStudent(r.stuId); notifyTeacher(s, r.score, r.reason); });
      return send(res, 200, {
        ok: true,
        msg: "已确认，生成量化分 " + added + " 条（名次不变 " + unchanged + " 人，无排名基准 " + noBase + " 人）",
        added, unchanged, noBase
      });
    });
  }

  // 班主任删除批次（仅未确认批次可删）
  const gradeBatchMatch = p.match(/^\/api\/grades\/([\w-]+)$/);
  if (gradeBatchMatch && method === "DELETE") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可删除" });
    const recs = db.grades.filter(g => g.batchId === gradeBatchMatch[1]);
    if (!recs.length) return send(res, 404, { ok: false, msg: "批次不存在" });
    if (recs[0].status === "confirmed") return send(res, 400, { ok: false, msg: "已确认的批次不可删除" });
    db.grades = db.grades.filter(g => g.batchId !== gradeBatchMatch[1]);
    saveDB();
    return send(res, 200, { ok: true, msg: "批次已删除" });
  }

  /* ---------- 系统设置（钉钉提醒等） ---------- */
  if (method === "GET" && p === "/api/config") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可查看" });
    const cfg = loadConfig();
    return send(res, 200, { ok: true, data: { dingWebhook: cfg.dingWebhook || "" } });
  }

  if (method === "POST" && p === "/api/config") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可修改" });
    return readBody(req).then(b => {
      const cfg = loadConfig();
      cfg.dingWebhook = String(b.dingWebhook || "").trim();
      saveConfig(cfg);
      return send(res, 200, { ok: true, msg: "设置已保存" });
    });
  }

  /* ---------- 数据备份 ---------- */
  if (method === "GET" && p === "/api/export") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可导出" });
    return send(res, 200, { ok: true, data: JSON.parse(JSON.stringify(db)) });
  }

  if (method === "POST" && p === "/api/import") {
    if (!isHead(user)) return send(res, 403, { ok: false, msg: "仅班主任可导入" });
    return readBody(req).then(b => {
      const d = b.data;
      if (!d || !Array.isArray(d.users) || !Array.isArray(d.students)) return send(res, 400, { ok: false, msg: "备份文件格式不正确" });
      // 保留当前会话
      const sessions = db.sessions;
      db = { ...emptyDB(), ...d, sessions };
      recalcScores();
      saveDB();
      return send(res, 200, { ok: true, msg: "数据恢复成功" });
    });
  }

  return send(res, 404, { ok: false, msg: "接口不存在" });
}

/* ===================== 静态文件服务 ===================== */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA 回退到 index.html（hash 路由不需要，但保留兜底）
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, d2) => {
        if (e2) { res.writeHead(404); res.end("Not Found"); return; }
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}

/* ===================== 启动 ===================== */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  if (url.pathname.startsWith("/api/")) {
    try {
      const ret = handleAPI(req, res, url, req.method);
      if (ret && typeof ret.then === "function") {
        ret.catch(err => {
          console.error("API 错误：", req.method, url.pathname, err.message);
          if (!res.headersSent) send(res, 500, { ok: false, msg: "服务器错误：" + err.message });
        });
      } else if (ret === undefined) {
        console.error("handleAPI 返回 undefined：", req.method, url.pathname);
        if (!res.headersSent) send(res, 500, { ok: false, msg: "服务器错误：接口未处理" });
      }
    } catch (err) {
      console.error("handleAPI 同步异常：", req.method, url.pathname, err.message);
      if (!res.headersSent) send(res, 500, { ok: false, msg: "服务器错误：" + err.message });
    }
    return;
  }
  serveStatic(req, res, url);
});

loadDB();
server.listen(PORT, () => {
  console.log("==============================================");
  console.log("  2401班导师制量化管理系统 已启动");
  console.log("  本机访问： http://localhost:" + PORT);
  console.log("  局域网访问： http://" + getLANIP() + ":" + PORT);
  console.log("  班主任账号： admin  /  admin123");
  console.log("  学生账号： 学号（如 240101） /  123456");
  console.log("==============================================");
});

function getLANIP() {
  try {
    const os = require("os");
    const ifs = os.networkInterfaces();
    for (const name of Object.keys(ifs)) {
      for (const iface of ifs[name]) {
        if (iface.family === "IPv4" && !iface.internal) return iface.address;
      }
    }
  } catch (e) { /* ignore */ }
  return "127.0.0.1";
}
