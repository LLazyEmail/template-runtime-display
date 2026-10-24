/** Stylesheet for the inspector page. Inlined, so the report is one file with no requests. */
export const STYLES = `
:root{--bg:#f4f5f8;--panel:#fff;--ink:#15181e;--muted:#5b6472;--line:#e1e4ea;--accent:#3556d8;
--ok:#16764a;--okbg:#e2f4ea;--bad:#b9232b;--badbg:#fde8e9;--warn:#8a5a00;--warnbg:#fff1cf;
--skip:#667085;--skipbg:#eceef2;--add:#e2f4ea;--del:#fde8e9;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#0e1014;--panel:#161920;--ink:#e9ebf0;--muted:#97a0af;--line:#272c37;--accent:#8fa3ff;
--ok:#62d696;--okbg:#10301f;--bad:#ff8087;--badbg:#3b1518;--warn:#f2bc55;--warnbg:#3a2b0b;
--skip:#97a0af;--skipbg:#222733;--add:#10301f;--del:#3b1518}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.page{max-width:980px;margin:0 auto;padding:28px 16px 48px;display:grid;gap:16px}
h1{margin:0;font-size:26px;letter-spacing:-.01em}
h2{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.eyebrow{margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.head{display:grid;grid-template-columns:1fr auto;gap:4px 16px;align-items:center}
.facts{grid-column:1/-1;margin:0;color:var(--muted)}
.verdict{font-weight:700;font-size:13px;padding:6px 14px;border-radius:999px;letter-spacing:.06em}
.v-ok{color:var(--ok);background:var(--okbg)}
.v-bad{color:var(--bad);background:var(--badbg)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px}
.banner{background:var(--badbg);color:var(--bad);border:1px solid var(--bad);border-radius:12px;padding:14px 18px}
.banner.inline{margin:10px 0;border-radius:8px;padding:10px 14px}
.banner pre{margin:6px 0 0;white-space:pre-wrap;font:13px/1.45 var(--mono)}
.banner ul{margin:6px 0 0;padding-left:20px}
.banner a{color:inherit;font-weight:600}
.rows{display:grid;gap:4px}
.row{display:grid;grid-template-columns:minmax(80px,150px) 1fr minmax(190px,260px);gap:12px;align-items:center;
padding:6px 8px;border-radius:8px;color:inherit;text-decoration:none}
.row:hover{background:var(--bg)}
.name{font-family:var(--mono);font-size:13px;font-weight:600;overflow-wrap:anywhere}
.track{height:10px;background:var(--bg);border-radius:999px;overflow:hidden}
.bar{display:block;height:100%;width:var(--w,2%);border-radius:999px;background:var(--ok)}
.bar.b-empty{background:var(--warn)}
.bar.b-error{background:var(--bad)}
.bar.skipped{width:100%;background:repeating-linear-gradient(90deg,var(--line) 0 6px,transparent 6px 12px)}
.stat,.meta{color:var(--muted);font-size:13px;white-space:nowrap}
.stat{text-align:right}
.chip{display:inline-block;font:600 11px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em;
padding:4px 8px;border-radius:999px;margin-right:4px}
.s-ok{color:var(--ok);background:var(--okbg)}
.s-empty{color:var(--warn);background:var(--warnbg)}
.s-error{color:var(--bad);background:var(--badbg)}
.s-skipped{color:var(--skip);background:var(--skipbg)}
.c-added{color:var(--ok);background:var(--okbg)}
.c-removed{color:var(--bad);background:var(--badbg)}
.c-changed{color:var(--warn);background:var(--warnbg)}
.viewport{position:relative}
.viewport input{position:absolute;opacity:0;pointer-events:none}
.viewport label{display:inline-block;margin:0 6px 10px 0;padding:6px 12px;border:1px solid var(--line);border-radius:999px;
font-size:13px;cursor:pointer;color:var(--muted)}
.viewport input:checked+label{color:var(--accent);border-color:var(--accent);font-weight:600}
.viewport input:focus-visible+label{outline:2px solid var(--accent);outline-offset:2px}
.viewport label.first{margin-left:14px}
.stage{background:var(--bg);border-radius:8px;padding:12px;overflow:auto}
.stage iframe{display:block;margin:0 auto;width:100%;height:560px;border:1px solid var(--line);border-radius:6px;background:#fff;color-scheme:light}
.stage .doc-dark{display:none}
#sc-dark:checked~.stage .doc-light{display:none}
#sc-dark:checked~.stage .doc-dark{display:block}
#vp-tablet:checked~.stage iframe{width:768px;max-width:100%}
#vp-mobile:checked~.stage iframe{width:375px;max-width:100%}
.part{border-top:1px solid var(--line);padding:2px 0}
.part:first-of-type{border-top:0}
.part summary{cursor:pointer;padding:10px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.frag{display:block;width:100%;height:220px;resize:vertical;border:1px solid var(--line);border-radius:6px;background:#fff;color-scheme:light;margin:8px 0}
.src{user-select:all;cursor:copy}
.src,.diff{margin:8px 0 12px;padding:12px;background:var(--bg);border-radius:8px;overflow:auto;max-height:360px;font:12.5px/1.5 var(--mono)}
.src code,.diff code{font:inherit}
.diff span{display:block;white-space:pre}
.d-add{background:var(--add)}
.d-del{background:var(--del)}
.changes{list-style:none;margin:0 0 4px;padding:0;display:grid;gap:6px}
.pn{display:flex;justify-content:space-between;gap:12px;padding:4px 0 10px;font-size:13px}
.pn a{color:var(--accent);text-decoration:none}
.pn a:first-child:last-child{margin-left:auto}
.part:target{outline:2px solid var(--accent);outline-offset:4px;border-radius:6px}
.plain summary{cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.sizeline{margin:0 0 10px}
.meter{position:relative;height:14px;background:var(--bg);border-radius:999px;overflow:hidden}
.fill{display:block;height:100%;width:var(--w,0%);border-radius:999px;background:var(--ok)}
.fill.r-near{background:var(--warn)}
.fill.r-over{background:var(--bad)}
.mark{position:absolute;top:0;bottom:0;left:var(--at,80%);width:2px;background:var(--ink);opacity:.45}
.warns{margin:8px 0;padding:10px 14px 10px 30px;background:var(--warnbg);color:var(--warn);border-radius:8px}
.sizes{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px}
.note{margin:8px 0 12px;color:var(--muted)}
.foot{margin:8px 0 0;text-align:center;color:var(--muted);font-size:12px}
@media (max-width:620px){.row{grid-template-columns:1fr;gap:4px}.stat{text-align:left}}
`;
