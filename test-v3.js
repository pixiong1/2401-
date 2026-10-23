/**
 * 新功能回归测试：批量录入(选择式/表格式) + 成绩管理 + 钉钉配置 + 商城移除
 * 前置：node server.js 已在 3100 端口启动
 */
"use strict";
const http = require("http");
const BASE = "http://127.0.0.1:3100";

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const r = http.request(BASE + path, { method, headers }, res => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        let j = null;
        try { j = JSON.parse(raw); } catch (e) { /* ignore */ }
        resolve({ status: res.statusCode, json: j, raw: raw.slice(0, 200) });
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log((ok ? "PASS" : "FAIL") + " | " + name + " | " + detail);
  };

  // 1. 班主任登录
  let r = await req("POST", "/api/login", { username: "admin", password: "admin123" });
  const admin = r.json && r.json.token;
  check("班主任登录", !!admin, r.raw);

  // 2. 导师登录（t01）
  r = await req("POST", "/api/login", { username: "t01", password: "123456" });
  const teacher = r.json && r.json.token;
  check("导师登录", !!teacher, r.raw);

  // 3. 学生登录（240101）
  r = await req("POST", "/api/login", { username: "240101", password: "123456" });
  const stu = r.json && r.json.token;
  check("学生登录", !!stu, r.raw);

  // 4. 商城接口已移除（应 404）
  r = await req("GET", "/api/shop/items", null, admin);
  check("商城接口移除", r.status === 404, "status=" + r.status + " " + r.raw);

  // 5. 批量录入-选择式（班主任，应直接生效）
  // 先记录 240101 基线积分（seed 预置流水导致初始非0）
  r = await req("GET", "/api/students", null, admin);
  const base101 = (r.json && r.json.data || []).find(s => s.stuId === "240101").totalScore;
  r = await req("POST", "/api/scores/batch", { stuIds: ["240101", "240102", "240103"], score: 2, reason: "回归测试：同一事由批量加分" }, admin);
  check("批量-选择式", r.json && r.json.ok && r.json.count === 3, r.raw);

  // 6. 批量录入-表格式（班主任）
  r = await req("POST", "/api/scores/batch-upload", { items: [
    { stuId: "240104", score: 3, reason: "回归测试：不同事由A" },
    { stuId: "240105", score: -1, reason: "回归测试：不同事由B" },
    { stuId: "999999", score: 5, reason: "不存在的人" },
    { stuId: "240106", score: "abc", reason: "分数非法" }
  ] }, admin);
  check("批量-表格式", r.json && r.json.ok && r.json.okCount === 2 && r.json.skipCount === 2, r.raw);

  // 7. 学生提交批量应待审（用学生token调batch，应 pending）
  r = await req("POST", "/api/scores/batch", { stuIds: ["240101"], score: 1, reason: "学生提交应待审" }, stu);
  check("学生批量→待审", r.json && r.json.ok && /等待班主任审核/.test(r.json.msg), r.raw);

  // 8. 成绩上传批次A（无基准）
  r = await req("POST", "/api/grades/upload", { exam: "10月月考", items: [
    { stuId: "240101", name: "周明轩", total: 650, gradeRank: 10, subjects: { 语文: 120, 数学: 110 } },
    { stuId: "240102", name: "陈雨桐", total: 640, gradeRank: 20, subjects: { 语文: 115, 数学: 105 } }
  ] }, admin);
  const batchA = r.json && r.json.batchId;
  check("成绩上传A", r.json && r.json.ok && r.json.okCount === 2 && !!batchA, r.raw);

  // 9. 学生查看成绩（上传后同步，学生只看自己）
  r = await req("GET", "/api/grades/mine", null, stu);
  check("学生查看自己的成绩", r.json && r.json.ok && r.json.data.length === 1 && r.json.data[0].stuId === "240101", "data=" + JSON.stringify(r.json && r.json.data));

  // 10. 确认批次A（无上次排名 → 不生成量化分）
  r = await req("POST", "/api/grades/confirm", { batchId: batchA }, admin);
  check("确认批次A(无基准)", r.json && r.json.ok && r.json.noBase === 2, r.raw);

  // 11. 成绩上传批次B（有基准）
  r = await req("POST", "/api/grades/upload", { exam: "11月月考", items: [
    { stuId: "240101", name: "周明轩", total: 660, gradeRank: 5, subjects: { 语文: 125, 数学: 112 } },
    { stuId: "240102", name: "陈雨桐", total: 630, gradeRank: 30, subjects: { 语文: 110, 数学: 100 } }
  ] }, admin);
  const batchB = r.json && r.json.batchId;
  check("成绩上传B", r.json && r.json.ok && !!batchB, r.raw);

  // 12. 确认批次B（240101 进步5名 +5；240102 退步10名 -10）
  r = await req("POST", "/api/grades/confirm", { batchId: batchB }, admin);
  check("确认批次B生成量化分", r.json && r.json.ok && r.json.added === 2, r.raw);

  // 13. 量化分写入流水（事由含 进步/退步）
  r = await req("GET", "/api/scores", null, admin);
  const q = (r.json && r.json.data || []).filter(x => /成绩排名/.test(x.reason));
  check("量化分流水", q.length >= 2 && q.some(x => x.reason === "成绩排名进步5名") && q.some(x => x.reason === "成绩排名退步10名"), "量化=" + JSON.stringify(q.map(x => ({ s: x.score, r: x.reason }))));

  // 14. 总积分重算正确（240101: base + 2(批量) + 5(量化进步) = base+7；学生提交的待审分不计入）
  r = await req("GET", "/api/students", null, admin);
  const s101 = (r.json && r.json.data || []).find(s => s.stuId === "240101");
  check("240101总积分=基线+7", s101 && s101.totalScore === base101 + 7, "base=" + base101 + " total=" + (s101 && s101.totalScore));

  // 15. 配置保存（假webhook，通知应静默失败不影响接口）
  r = await req("POST", "/api/config", { dingWebhook: "http://127.0.0.1:1/fake" }, admin);
  check("配置保存", r.json && r.json.ok, r.raw);
  r = await req("GET", "/api/config", null, admin);
  check("配置读取", r.json && r.json.ok && /127.0.0.1/.test(r.json.data.dingWebhook), r.raw);
  // 清空配置，避免后续真实通知干扰
  await req("POST", "/api/config", { dingWebhook: "" }, admin);

  // 16. 删除批次（确认后不可删）
  r = await req("DELETE", "/api/grades/" + batchA, null, admin);
  check("已确认批次不可删", r.json && !r.json.ok && /不可删除/.test(r.json.msg), r.raw);

  // 17. 上传批次C 后删除
  r = await req("POST", "/api/grades/upload", { exam: "临时批次", items: [{ stuId: "240103", name: "王子豪", total: 600, gradeRank: 40 }] }, admin);
  const batchC = r.json && r.json.batchId;
  r = await req("DELETE", "/api/grades/" + batchC, null, admin);
  check("未确认批次可删", r.json && r.json.ok, r.raw);

  // 18. 权限：导师看成绩OK、学生看全部成绩应403
  r = await req("GET", "/api/grades", null, teacher);
  check("导师查看成绩", r.json && r.json.ok, r.raw);
  r = await req("GET", "/api/grades", null, stu);
  check("学生看全部成绩被拒", r.status === 403, "status=" + r.status);

  // 19. 成绩模板/评分模板为前端生成，无后端接口依赖（跳过）

  // 汇总
  const failed = results.filter(x => !x.ok);
  console.log("\n===== 结果: " + (results.length - failed.length) + "/" + results.length + " 通过 =====");
  if (failed.length) console.log("失败项: " + failed.map(f => f.name).join(", "));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("测试异常:", e); process.exit(2); });
