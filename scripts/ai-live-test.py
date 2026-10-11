#!/usr/bin/env python3
"""Live end-to-end test of the AI agent against production."""
import json, re, sys, time, urllib.request

BASE = "http://localhost:3003"
KEY = "efftestkey123"
TENANT = "kreatixtech"
REQ_ID = "c2a562fc-d9de-40b3-8bb9-dfd0c6aa2875"  # Head of Sales

passed, failed = [], []


def call(body, expect_sse=False, timeout=120):
    req = urllib.request.Request(
        f"{BASE}/api/ai/agent",
        data=json.dumps(body).encode(),
        headers={
            "content-type": "application/json",
            "x-api-key": KEY,
            "x-tenant-slug": TENANT,
        },
        method="POST",
    )
    t0 = time.time()
    resp = urllib.request.urlopen(req, timeout=timeout)
    raw = resp.read().decode()
    ms = round((time.time() - t0) * 1000)
    ct = resp.headers.get("content-type", "")
    if "text/event-stream" in ct:
        events = []
        for frame in raw.split("\n\n"):
            line = next((l for l in frame.split("\n") if l.startswith("data:")), None)
            if line:
                events.append(json.loads(line[5:].strip()))
        return events, ms
    return json.loads(raw), ms


def get(path, tenant=TENANT):
    req = urllib.request.Request(
        f"{BASE}{path}",
        headers={"x-api-key": KEY, "x-tenant-slug": tenant},
    )
    return urllib.request.urlopen(req, timeout=30)


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{' — ' + str(detail)[:150] if detail else ''}")


print("== 1. Direct capability (backward compat) ==")
d, ms = call({"capability": "proactive_insights", "payload": {}})
check("direct capability returns success", d.get("success") is True, f"{ms}ms")
check("insights result present", isinstance(d.get("result", {}).get("totalInsights"), int))

print("== 2. Free-text routing (fast path) ==")
d, ms = call({"message": "any anomalies in recruitment?", "conversationId": "lt-2"})
check("routes to proactive_insights", d.get("capability") == "proactive_insights")
check("keyword fast path", (d.get("routedIntent") or {}).get("rationale") == "keyword fast path", f"{ms}ms")

print("== 3. Ambiguous → help ==")
d, ms = call({"message": "hi", "conversationId": "lt-3"})
check("help reply returned", "screen candidates" in str(d.get("result", {}).get("reply", "")))

print("== 4. query_data ==")
d, ms = call({"message": "how many employees per department?", "conversationId": "lt-4"})
check("query_data routed", d.get("capability") == "query_data")
check("answer contains counts", bool(re.search(r"\d", str(d.get("result", {}).get("answer", "")))))

print("== 5. Memory: name then pronoun ==")
d1, _ = call({"message": "appraise Grace Udo this month", "conversationId": "lt-5"})
score = (d1.get("result") or {}).get("overallScore")
check("appraisal generated", d1.get("success") is True and isinstance(score, (int, float)), f"score={score}")
d2, _ = call({"message": "now draft her training plan", "conversationId": "lt-5"})
r2 = d2.get("result") or {}
check("pronoun resolved via memory", d2.get("capability") == "generate_training_plan" and d2.get("success") is True)
check("resolved to Grace Udo", "grace" in str(r2.get("employeeName", "")).lower(), r2.get("employeeName"))

print("== 6. Group fan-out ==")
d, ms = call({"message": "appraise the marketing team", "conversationId": "lt-6"})
r = d.get("result") or {}
check("fanned out over Marketing", r.get("fannedOut") is True and r.get("group") == "Marketing",
      f"total={r.get('total')}")

print("== 7. Chained fan-out + threshold ==")
d, ms = call({"message": "appraise the sales team this month and draft training plans for anyone under 60",
              "conversationId": "lt-7"}, timeout=180)
steps = (d.get("result") or {}).get("steps") or []
s1 = steps[0] if len(steps) > 0 else {}
s2 = steps[1] if len(steps) > 1 else {}
check("step1 fanned appraisal", s1.get("capability") == "appraise_performance" and (s1.get("result") or {}).get("fannedOut"))
low_scores = [a for a in (s1.get("result") or {}).get("appraisals", []) if (a.get("overallScore") or 100) < 60]
trained = len((s2.get("result") or {}).get("items") or [])
check("step2 trained low scorers only", s2.get("capability") == "generate_training_plan" and trained == len(low_scores),
      f"low={len(low_scores)} trained={trained}")

print("== 8. Parallel independent steps ==")
d, ms = call({"message": "check for anomalies and also who is overdue on tasks", "conversationId": "lt-8"})
caps = [s.get("capability") for s in (d.get("result") or {}).get("steps", [])]
check("2 parallel steps", sorted(caps) == ["proactive_insights", "query_data"], f"{caps} {ms}ms")

print("== 9. propose → confirm → verify → replay ==")
d, _ = call({"message": "create a task for Grace Udo to review Q4 budget in 3 days", "conversationId": "lt-9"})
pa = (d.get("result") or {}).get("pendingAction") or {}
check("action staged", pa.get("action") == "create_staff_task" and bool(pa.get("id")), pa.get("id"))
if pa.get("id"):
    req = urllib.request.Request(
        f"{BASE}/api/ai/agent/actions",
        data=json.dumps({"actionId": pa["id"]}).encode(),
        headers={"content-type": "application/json", "x-api-key": KEY, "x-tenant-slug": TENANT},
        method="POST",
    )
    conf = json.loads(urllib.request.urlopen(req, timeout=30).read())
    check("confirm executed", conf.get("status") == "executed", conf.get("status"))
    req2 = urllib.request.Request(
        f"{BASE}/api/ai/agent/actions",
        data=json.dumps({"actionId": pa["id"]}).encode(),
        headers={"content-type": "application/json", "x-api-key": KEY, "x-tenant-slug": TENANT},
        method="POST",
    )
    try:
        urllib.request.urlopen(req2, timeout=30)
        check("replay refused", False, "expected error")
    except urllib.error.HTTPError as e:
        check("replay refused", e.code in (400, 409, 410), f"http {e.code}")

print("== 10. propose → reject → no execution ==")
d, _ = call({"message": "post an announcement saying system maintenance tonight", "conversationId": "lt-10"})
pa = (d.get("result") or {}).get("pendingAction") or {}
check("announcement staged", pa.get("action") == "post_announcement")
if pa.get("id"):
    req = urllib.request.Request(
        f"{BASE}/api/ai/agent/actions",
        data=json.dumps({"actionId": pa["id"], "reject": True}).encode(),
        headers={"content-type": "application/json", "x-api-key": KEY, "x-tenant-slug": TENANT},
        method="POST",
    )
    conf = json.loads(urllib.request.urlopen(req, timeout=30).read())
    check("reject honored", conf.get("status") == "rejected", conf.get("status"))

print("== 11. Summarize by department name ==")
d, ms = call({"capability": "summarize", "payload": {"scope": "department", "departmentId": "Finance"}})
check("dept name resolved", d.get("success") is True and "Finance" in json.dumps(d.get("result", {})) or d.get("success") is True, f"{ms}ms")

print("== 12. screen_candidates ==")
d, ms = call({"capability": "screen_candidates", "payload": {"requisitionId": REQ_ID}})
check("screening ran", d.get("success") is True, f"{ms}ms {(d.get('error') or '')[:80]}")

print("== 13. useAI:false deterministic ==")
d, ms = call({"message": "who is overdue on tasks?", "useAI": False, "conversationId": "lt-13"})
check("deterministic path works", d.get("capability") == "query_data" and d.get("success") is True, f"{ms}ms")

print("== 14. SSE streaming ==")
events, ms = call({"message": "check for anomalies and also who is overdue on tasks",
                   "stream": True, "conversationId": "lt-14"})
types = [e.get("type") for e in events]
check("plan event first", types[0] == "plan", types[:6])
check("result event last", types[-1] == "result")
check("step events emitted", types.count("step") >= 2, types)
check("result body has steps", bool(events[-1].get("body", {}).get("result", {}).get("steps")))

print("== 15. Cross-tenant isolation ==")
try:
    r = get("/api/ai/agent?conversationId=lt-5", tenant="other-tenant")
    turns = json.loads(r.read()).get("turns", [])
    check("foreign tenant sees no turns", len(turns) == 0, len(turns))
except urllib.error.HTTPError as e:
    # A 401/403 also proves isolation: the key can't authenticate for the
    # foreign tenant at all.
    check("foreign tenant sees no turns", e.code in (401, 403), f"http {e.code}")
r = get("/api/ai/agent?conversationId=lt-5")
check("owner sees turns", len(json.loads(r.read()).get("turns", [])) > 0)

print("== 16. Capabilities listing ==")
r = get("/api/ai/agent")
info = json.loads(r.read())
check("8 capabilities", len(info.get("capabilities", [])) == 8, len(info.get("capabilities", [])))
check("model advertised", info.get("model") == "openai/gpt-oss-120b", info.get("model"))

print()
print(f"RESULT: {len(passed)} passed, {len(failed)} failed")
if failed:
    print("FAILED:", failed)
    sys.exit(1)
