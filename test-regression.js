/**
 * 2401量化平台 - 全量回归测试脚本
 * 运行：node test-regression.js
 * 覆盖：认证/权限/学生管理/评分审核/排行榜/商城/备份
 */
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const results = [];
function log(name, ok, detail) {
  if (ok) { pass++; results.push("[PASS] " + name); }
  else { fail++; results.push("[FAIL] " + name + "  << " + (detail || "")); }
}

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const opts = { method, headers };
  if (body != null) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

(async () => {
  /* 基线：记录注册前的学生/导师数量 */
  const preAdmin = await req("POST", "/api/login", { username: "admin", password: "admin123" });
  const preToken = preAdmin.data.token;
  const baseStudents = (await req("GET", "/api/students", null, preToken)).data.data.length;
  const baseTeachers = (await req("GET", "/api/teachers", null, preToken)).data.data.length;
  const baseGroup1 = (await req("GET", "/api/groups", null, preToken)).data.data.find(g => g.id === 1).memberCount;
  console.log("[INFO] 基线：学生" + baseStudents + " 导师" + baseTeachers + " 组1" + baseGroup1);

  /* ================= 1. 认证与账号 ================= */
  // 公开注册已关闭：直接调用 /api/register 应失败
  r = await req("POST", "/api/register", { username: "hackx", password: "123456", name: "x", role: "student" });
  log("公开注册已关闭", r.status !== 200, r.status + " " + (r.data.msg || ""));

  // 账号由班主任统一创建（替代自助注册）
  r = await req("POST", "/api/users", { username: "teststu1", password: "123456", name: "测试学生1", role: "student" }, preToken);
  log("班主任创建学生账号", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/users", { username: "testtea1", password: "123456", name: "测试导师1", role: "teacher" }, preToken);
  log("班主任创建导师账号", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/users", { username: "xxadmin", name: "x", role: "headTeacher" }, preToken);
  log("禁止创建班主任账号", r.status === 400, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/users", { username: "ab", name: "x", role: "student" }, preToken);
  log("短账号被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/users", { username: "teststu1", name: "x", role: "student" }, preToken);
  log("重复账号被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/users", { username: "teststu2", password: "123", name: "x", role: "student" }, preToken);
  log("短密码被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  // 修改密码：学生用默认密码登录后修改自己密码
  r = await req("POST", "/api/login", { username: "teststu1", password: "123456" });
  const stuToken2 = r.data.token;
  log("新建学生默认密码登录", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));
  r = await req("POST", "/api/change-password", { oldPassword: "123456", newPassword: "stu1new" }, stuToken2);
  log("学生修改自己密码", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));
  r = await req("POST", "/api/login", { username: "teststu1", password: "123456" });
  log("修改后旧密码失效", r.status !== 200, r.status);
  r = await req("POST", "/api/login", { username: "teststu1", password: "stu1new" });
  log("修改后新密码可登录", r.status === 200, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/login", { username: "admin", password: "admin123" });
  const adminToken = r.data.token;
  log("班主任登录", r.status === 200 && r.data.ok && r.data.user.role === "headTeacher", r.status + " role=" + (r.data.user || {}).role);

  r = await req("POST", "/api/login", { username: "admin", password: "wrong" });
  log("错误密码被拒", r.status === 400, r.status);

  r = await req("POST", "/api/login", { username: "t01", password: "123456" });
  const teaToken = r.data.token;
  log("导师登录", r.status === 200 && r.data.ok && r.data.user.role === "teacher", r.status);

  r = await req("POST", "/api/login", { username: "240101", password: "123456" });
  const leaderToken = r.data.token;
  log("班委(班长)登录", r.status === 200 && r.data.ok, r.status);

  r = await req("POST", "/api/login", { username: "240111", password: "123456" });
  const stuToken = r.data.token;
  log("普通学生登录", r.status === 200 && r.data.ok, r.status);

  r = await req("GET", "/api/me");
  log("未登录访问受保护接口401", r.status === 401, r.status);

  /* ================= 2. 权限拦截 ================= */
  r = await req("GET", "/api/teachers", null, teaToken);
  log("导师访问导师列表403", r.status === 403, r.status);

  r = await req("POST", "/api/students/import", { items: [{ stuId: "240199", name: "x" }] }, teaToken);
  log("导师导入学生403", r.status === 403, r.status);

  r = await req("POST", "/api/shop/redeem", { itemId: "it1" }, teaToken);
  log("导师兑换商品403", r.status === 403, r.status);

  r = await req("GET", "/api/export", null, teaToken);
  log("导师导出数据403", r.status === 403, r.status);

  r = await req("POST", "/api/students/import", { items: [{ stuId: "240199", name: "x" }] }, leaderToken);
  log("班委导入学生403", r.status === 403, r.status);

  r = await req("POST", "/api/scores/someid/audit", { pass: true }, stuToken);
  log("学生审核评分403", r.status === 403, r.status);

  /* ================= 3. 学生管理 ================= */
  r = await req("GET", "/api/students", null, adminToken);
  log("班主任看全部学生", r.data.data.length === baseStudents + 1, "实际" + r.data.data.length + " 基线" + baseStudents);

  r = await req("GET", "/api/students", null, teaToken);
  log("导师可看全部学生", r.data.data.length === baseStudents + 1, "实际" + r.data.data.length + " 基线" + baseStudents);

  r = await req("GET", "/api/students", null, stuToken);
  log("普通学生只看自己", r.data.data.length === 1, "实际" + r.data.data.length);

  r = await req("GET", "/api/students", null, leaderToken);
  log("班委看全班", r.data.data.length === baseStudents + 1, "实际" + r.data.data.length + " 基线" + baseStudents);

  r = await req("POST", "/api/students", { stuId: "240137", name: "测试添加", groupId: 2, leaderRole: "" }, adminToken);
  log("班主任添加学生", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/students", { stuId: "240137", name: "重复", groupId: 1, leaderRole: "" }, adminToken);
  log("重复学号被拒", r.status === 400, r.status);

  r = await req("PUT", "/api/students/240137", { name: "测试改名", groupId: 3, leaderRole: "班长" }, adminToken);
  log("编辑学生(改名/换组/任班委)", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  r = await req("GET", "/api/students", null, adminToken);
  const edited = r.data.data.find(s => s.stuId === "240137");
  log("编辑生效(班长/第3组)", edited && edited.leaderRole === "班长" && edited.groupId === 3, JSON.stringify(edited));

  r = await req("DELETE", "/api/students/240137", null, adminToken);
  log("删除学生", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  r = await req("GET", "/api/groups", null, adminToken);
  log("小组列表6组", r.data.data.length === 6, "实际" + r.data.data.length);

  r = await req("PUT", "/api/groups/6", { name: "第六导师小组(班主任组)", teacherId: "u-admin" }, adminToken);
  log("修改小组", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  r = await req("GET", "/api/teachers", null, adminToken);
  log("班主任看导师列表", r.data.data.length === baseTeachers + 1, "实际" + r.data.data.length + " 基线" + baseTeachers);

  /* ================= 4. 评分与审核 ================= */
  r = await req("POST", "/api/scores", { stuId: "240101", score: 3, reason: "回归测试-导师加分" }, teaToken);
  log("导师评分直接生效", r.data.ok && r.data.record.status === "active", r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/scores", { stuId: "240102", score: 2, reason: "回归测试-班委申报" }, leaderToken);
  const pendingId = r.data.record ? r.data.record.id : null;
  log("班委评分待审核", r.data.ok && r.data.record.status === "pending", r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/scores", { stuId: "240101", score: 1.5, reason: "小数测试" }, teaToken);
  log("小数分数被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/scores", { stuId: "240101", score: 0, reason: "零分测试" }, teaToken);
  log("0分被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/scores", { stuId: "240101", score: 51, reason: "超限测试" }, teaToken);
  log("超50分被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/scores", { stuId: "240101", score: 1, reason: "  " }, teaToken);
  log("空事由被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/scores", { stuId: "240199", score: 2, reason: "不存在学生" }, teaToken);
  log("不存在学生被拒", r.status === 400, r.status);

  r = await req("POST", "/api/scores/" + pendingId + "/audit", { pass: true }, adminToken);
  log("班主任审核通过", r.data.ok && r.data.msg === "已通过", r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/scores/" + pendingId + "/audit", { pass: true }, adminToken);
  log("重复审核被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  r = await req("GET", "/api/scores?status=pending", null, adminToken);
  log("审核中心查询待审核", r.status === 200 && Array.isArray(r.data.data), r.status);

  r = await req("GET", "/api/scores", null, stuToken);
  log("普通学生只看自己的流水", r.data.data.every(x => x.stuId === "240111"), "条数" + r.data.data.length);

  /* ================= 5. 排行榜 ================= */
  r = await req("GET", "/api/rank", null, adminToken);
  log("排行榜个人+小组", r.data.data.personal.length === baseStudents + 1 && r.data.data.group.length === 6,
    "个人" + r.data.data.personal.length + " 小组" + r.data.data.group.length);

  r = await req("GET", "/api/dashboard", null, adminToken);
  log("概览数据", r.status === 200 && r.data.data.studentCount === baseStudents + 1 && r.data.data.groupCount === 6, r.status + " 学生" + r.data.data.studentCount);

  r = await req("GET", "/api/dashboard", null, stuToken);
  log("学生概览含我的积分排名", r.data.data.myScore !== undefined && r.data.data.myRank > 0, "score=" + r.data.data.myScore + " rank=" + r.data.data.myRank);

  /* ================= 6. 积分商城 ================= */
  r = await req("POST", "/api/shop/items", { name: "回归测试商品", price: 5, stock: 2, icon: "🎁", desc: "测试用" }, adminToken);
  log("班主任上架商品", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  r = await req("GET", "/api/shop/items", null, adminToken);
  const testItem = r.data.data.find(x => x.name === "回归测试商品");
  log("新商品在列表中", !!testItem, JSON.stringify(testItem));

  const meBefore = (await req("GET", "/api/me", null, leaderToken)).data.student;
  r = await req("POST", "/api/shop/redeem", { itemId: testItem.id }, leaderToken);
  log("学生兑换成功", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  const meAfter = (await req("GET", "/api/me", null, leaderToken)).data.student;
  log("兑换后积分正确扣减", meBefore.totalScore - meAfter.totalScore === 5, "前" + meBefore.totalScore + " 后" + meAfter.totalScore);

  r = await req("GET", "/api/shop/items", null, adminToken);
  log("兑换后库存减1", r.data.data.find(x => x.id === testItem.id).stock === 1, "库存" + r.data.data.find(x => x.id === testItem.id).stock);

  r = await req("POST", "/api/shop/redeem", { itemId: testItem.id }, leaderToken);
  log("第二次兑换成功(库存2→0)", r.status === 200, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/shop/redeem", { itemId: testItem.id }, leaderToken);
  log("第三次兑换积分不足被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  r = await req("GET", "/api/shop/redeems", null, adminToken);
  const rd = r.data.data.find(x => x.itemId === testItem.id && x.status === "pending");
  const meBeforeCancel = (await req("GET", "/api/me", null, leaderToken)).data.student.totalScore;
  r = await req("POST", "/api/shop/redeems/" + rd.id + "/confirm", { pass: false }, adminToken);
  log("班主任取消兑换", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  const meAfterCancel = (await req("GET", "/api/me", null, leaderToken)).data.student.totalScore;
  log("取消后积分返还", meAfterCancel - meBeforeCancel === 5, "前" + meBeforeCancel + " 后" + meAfterCancel);

  r = await req("GET", "/api/shop/items", null, adminToken);
  log("取消后库存恢复", r.data.data.find(x => x.id === testItem.id).stock === 1, "库存" + r.data.data.find(x => x.id === testItem.id).stock);

  r = await req("PUT", "/api/shop/items/" + testItem.id, { name: "回归测试商品改", price: 8 }, adminToken);
  log("班主任编辑商品", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/shop/items", { name: "", price: 5 }, adminToken);
  log("空名称上架被拒", r.status === 400, r.status);

  r = await req("DELETE", "/api/shop/items/" + testItem.id, null, adminToken);
  log("班主任删除商品", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  /* ================= 7. 数据备份 ================= */
  r = await req("GET", "/api/export", null, adminToken);
  const backupData = r.data.data;
  log("导出备份(含全部学生)", r.status === 200 && backupData && backupData.students.length === baseStudents + 1,
    r.status + " 学生" + (backupData ? backupData.students.length : "?"));

  r = await req("POST", "/api/import", { data: backupData }, adminToken);
  log("恢复备份", r.status === 200 && r.data.ok, r.status + " " + (r.data.msg || ""));

  r = await req("POST", "/api/import", { data: { users: [] } }, adminToken);
  log("非法备份格式被拒", r.status === 400, r.status + " " + (r.data.msg || ""));

  /* ================= 10. 静态资源 ================= */
  for (const p of ["/", "/css/style.css", "/js/api.js", "/js/views.js", "/js/app.js"]) {
    const res = await fetch(BASE + p);
    log("静态资源 " + p, res.status === 200, res.status);
  }

  /* ================= 汇总 ================= */
  console.log("\n========== 回归测试结果 ==========");
  console.log("通过: " + pass + " | 失败: " + fail + " | 总计: " + (pass + fail));
  results.forEach(x => console.log(x));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("测试脚本崩溃: " + e.message + "\n" + e.stack); process.exit(2); });
