/* =========================================================
   DELEF FEST GOPASS - Frontend
   ตอนนี้ข้อมูลงานคอนเสิร์ตทั้งหมดมาจาก Backend จริง (Express API)
   ไม่ใช่ localStorage อีกต่อไป -> แอดมินเพิ่ม/แก้/ลบงานแล้ว
   ทุกคนที่เข้าเว็บ (คนละเครื่อง คนละเบราว์เซอร์) จะเห็นข้อมูลเดียวกัน
   ========================================================= */

const API_BASE = "/api";

/* ---------- ตัวช่วยทั่วไป ---------- */
function money(n) { return Number(n || 0).toLocaleString("th-TH") + " บาท"; }
function dateTH(v) {
  if (!v) return "-";
  return new Date(v + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}
function poster(e, cls = "") {
  return e.image
    ? `<img class="${cls}" src="${esc(e.image)}" alt="${esc(e.name)}">`
    : `<div class="poster-fallback ${cls}">${esc(e.name)}</div>`;
}

/* ---------- Toast แจ้งเตือนสวย ๆ แทน alert() ---------- */
function toast(message, type = "success") {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  const icon = type === "error" ? "fa-circle-exclamation" : type === "info" ? "fa-circle-info" : "fa-circle-check";
  el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${esc(message)}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); }, 3200);
}

/* ---------- เรียก API ---------- */
async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { ...(options.headers || {}) },
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const message = (data && data.message) || `เกิดข้อผิดพลาด (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function fetchEvents() { return apiFetch("/events"); }
async function fetchEvent(id) { return apiFetch(`/events/${encodeURIComponent(id)}`); }

/* ---------- การ์ดงาน ---------- */
function card(e) {
  return `<article class="event-card"><div class="poster">${poster(e)}<span class="badge">${esc(e.status)}</span></div><div class="card-body"><h3>${esc(e.name)}</h3><p><i class="fa-regular fa-calendar"></i>${dateTH(e.date)} · ${esc(e.time)} น.</p><p><i class="fa-solid fa-location-dot"></i>${esc(e.venue)}</p><div class="price">เริ่มต้น ${money(e.regular)}</div><a class="btn red full" href="event.html?id=${encodeURIComponent(e.id)}">ดูรายละเอียด <i class="fa-solid fa-arrow-right"></i></a></div></article>`;
}

function skeletonCards(n = 4) {
  return Array.from({ length: n }).map(() => `<div class="event-card skeleton"><div class="poster"></div><div class="card-body"><div class="sk-line w60"></div><div class="sk-line w40"></div><div class="sk-line w80"></div></div></div>`).join("");
}

/* ---------- หน้าแรก ---------- */
async function renderHome() {
  const el = document.getElementById("homeEvents");
  if (!el) return;
  el.innerHTML = skeletonCards(4);
  try {
    const list = (await fetchEvents()).filter(e => e.status === "เปิดขาย");
    el.innerHTML = list.length ? list.map(card).join("") : `<div class="empty"><i class="fa-regular fa-calendar-xmark"></i>ยังไม่มีงานที่เปิดขาย</div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty error"><i class="fa-solid fa-triangle-exclamation"></i>โหลดข้อมูลไม่สำเร็จ: ${esc(err.message)}</div>`;
  }
}

/* ---------- หน้ารายการทั้งหมด (มีค้นหา) ---------- */
async function renderEvents() {
  const el = document.getElementById("eventList"), input = document.getElementById("search");
  if (!el) return;
  el.innerHTML = skeletonCards(6);
  let all = [];
  try {
    all = await fetchEvents();
  } catch (err) {
    el.innerHTML = `<div class="empty error"><i class="fa-solid fa-triangle-exclamation"></i>โหลดข้อมูลไม่สำเร็จ: ${esc(err.message)}</div>`;
    return;
  }
  function draw() {
    const q = (input?.value || "").toLowerCase();
    const list = all.filter(e => (e.name + " " + e.venue).toLowerCase().includes(q));
    el.innerHTML = list.length ? list.map(card).join("") : `<div class="empty"><i class="fa-solid fa-magnifying-glass"></i>ไม่พบคอนเสิร์ต</div>`;
  }
  input?.addEventListener("input", draw);
  draw();
}

/* ---------- หน้ารายละเอียดงาน ---------- */
function currentEventId() { return new URLSearchParams(location.search).get("id"); }

function ticketTypesOf(e) {
  return Array.isArray(e.ticketTypes) && e.ticketTypes.length ? e.ticketTypes : [
    { id: "regular", name: "บัตรธรรมดา", description: "สิทธิ์เข้างานตามมาตรฐาน", price: Number(e.regular || 0) },
    { id: "vip", name: "บัตร VIP", description: "สิทธิ์พิเศษสำหรับผู้ถือบัตร VIP", price: Number(e.vip || 0) }
  ];
}

async function renderDetail() {
  const el = document.getElementById("detail");
  if (!el) return;
  el.innerHTML = `<div class="loading-block"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</div>`;
  try {
    const e = await fetchEvent(currentEventId());
    if (!e) throw new Error("ไม่พบงาน");
    window.currentEvent = e;
    const types = ticketTypesOf(e);
    const minPrice = Math.min(...types.map(t => Number(t.price || 0)));
    el.innerHTML = `<div class="detail"><div class="detail-poster">${poster(e)}</div><div><span class="kicker">${esc(e.status)}</span><h1>${esc(e.name)}</h1><div class="info-line"><i class="fa-regular fa-calendar"></i>${dateTH(e.date)}</div><div class="info-line"><i class="fa-regular fa-clock"></i>${esc(e.time)} น.</div><div class="info-line"><i class="fa-solid fa-location-dot"></i>${esc(e.venue)}</div><h2 class="mt">รายละเอียดงาน</h2><p>เลือกประเภทบัตร จำนวน และกรอกข้อมูลผู้ซื้อเพื่อรับรายการยืนยันจาก DELEF FEST GOPASS</p><div class="ticket-types">${types.map(t=>`<div><b>${esc(t.name)}</b><span>${esc(t.description)}</span><strong>${Number(t.price)===0?"ฟรี":money(t.price)}</strong></div>`).join("")}</div>${e.status === "เปิดขาย" ? `<a class="btn red full" href="queue.html?id=${encodeURIComponent(e.id)}">กดบัตร <i class="fa-solid fa-ticket"></i></a>` : `<button class="btn disabled full" disabled>${esc(e.status)}</button>`}<small class="limit-note">จำกัดสูงสุด ${Number(e.limitPerOrder || 10)} ใบ / คำสั่งซื้อ</small></div></div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty error"><i class="fa-solid fa-triangle-exclamation"></i>${esc(err.message)}</div>`;
  }
}

/* ---------- หน้าเลือกบัตร ---------- */
async function renderSeat() {
  const el = document.getElementById("seatPage");
  if (!el) return;
  el.innerHTML = `<div class="loading-block"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</div>`;
  let e;
  try { e = await fetchEvent(currentEventId()); } catch (err) { el.innerHTML = `<div class="empty error">${esc(err.message)}</div>`; return; }
  if (!e) { el.innerHTML = `<div class="empty">ไม่พบงาน</div>`; return; }

  const types = ticketTypesOf(e);
  const storedType = sessionStorage.getItem("ticketType") || ""; const savedType = types.some(t => t.id === storedType) ? storedType : (types[0]?.id || "");
  const limit = Math.max(1, Number(e.limitPerOrder || 10));
  const savedQty = Math.max(1, Math.min(limit, Number(sessionStorage.getItem("ticketQty") || 1)));
  const eventImage = e.image ? `<img src="${esc(e.image)}" alt="${esc(e.name)}">` : `<div class="ticket-event-image-fallback"><i class="fa-solid fa-music"></i></div>`;

  el.innerHTML = `
    <div class="ticket-platform">
      <div class="ticket-stepper"><div class="ticket-step active"><span>01</span><div><b>เลือกบัตร</b><small>ประเภทและจำนวน</small></div></div><div class="ticket-step-line"></div><div class="ticket-step"><span>02</span><div><b>ข้อมูลผู้ซื้อ</b><small>ตรวจสอบรายการ</small></div></div><div class="ticket-step-line"></div><div class="ticket-step"><span>03</span><div><b>เสร็จสิ้น</b><small>รับรายการของคุณ</small></div></div></div>
      <section class="ticket-event-summary"><div class="ticket-event-thumb">${eventImage}</div><div class="ticket-event-copy"><span class="ticket-eyebrow">DELEF FEST GOPASS</span><h1>${esc(e.name)}</h1><div class="ticket-event-meta"><span><i class="fa-regular fa-calendar"></i>${dateTH(e.date)}</span><span><i class="fa-regular fa-clock"></i>${esc(e.time)} น.</span><span><i class="fa-solid fa-location-dot"></i>${esc(e.venue)}</span></div></div><div class="ticket-hold"><i class="fa-solid fa-shield-halved"></i><span>สิทธิ์ของคุณถูกสำรองไว้</span><b id="timer">10:00</b></div></section>
      <div class="ticket-select-layout">
        <section class="ticket-main-panel"><div class="panel-heading"><div><span class="ticket-eyebrow">TICKET TYPE</span><h2>เลือกประเภทบัตร</h2><p>เลือกได้ 1 ประเภทต่อคำสั่งซื้อ และสูงสุด ${limit} ใบ</p></div><span class="secure-badge"><i class="fa-solid fa-lock"></i> Secure Checkout</span></div>
          <div class="ticket-choice-grid">${types.map((t,i)=>`
            <button type="button" class="ticket-choice ${i===0?"regular":""} ${savedType===t.id?"selected":""}" onclick="pickTicket('${esc(t.id)}', ${Number(t.price)||0})">
              <span class="choice-check"><i class="fa-solid fa-check"></i></span><div class="choice-top"><div class="choice-icon"><i class="fa-solid fa-ticket"></i></div><span class="choice-tag">${Number(t.price)===0?"FREE":"TICKET"}</span></div>
              <div class="choice-copy"><h3>${esc(t.name)}</h3><p>${esc(t.description || "สิทธิ์เข้างานตามประเภทที่เลือก")}</p></div>
              <div class="choice-footer"><div><small>ราคา / ใบ</small><strong>${Number(t.price)===0?"ฟรี":money(t.price)}</strong></div><span class="choice-radio"></span></div>
            </button>`).join("")}</div>
          <div class="ticket-policy"><i class="fa-solid fa-circle-info"></i><span>ตรวจสอบประเภทบัตรและจำนวนให้ถูกต้องก่อนยืนยัน ระบบจะบันทึกเลขคิวให้คำสั่งซื้อโดยอัตโนมัติ</span></div>
        </section>
        <aside class="ticket-side-panel"><div class="side-heading"><span class="ticket-eyebrow">YOUR ORDER</span><h2>สรุปรายการ</h2></div><div class="order-line"><span>ประเภทบัตร</span><b id="summaryType">ยังไม่ได้เลือก</b></div><div class="order-line"><span>ราคาต่อใบ</span><b id="summaryPrice">-</b></div><div class="order-qty"><div><span>จำนวนบัตร</span><small>สูงสุด ${limit} ใบ</small></div><div class="qty-control"><button type="button" onclick="changeQty(-1)"><i class="fa-solid fa-minus"></i></button><strong id="qtyValue">${savedQty}</strong><button type="button" onclick="changeQty(1)"><i class="fa-solid fa-plus"></i></button></div></div><div class="order-total"><span>ยอดรวม</span><strong id="total">0 บาท</strong></div><button class="btn red full checkout-btn" type="button" onclick="checkout(event)"><span>ดำเนินการต่อ</span><i class="fa-solid fa-arrow-right"></i></button><p class="checkout-note"><i class="fa-solid fa-lock"></i> ข้อมูลถูกบันทึกบนเซิร์ฟเวอร์เพื่อให้แอดมินตรวจสอบได้</p></aside>
      </div>
    </div>`;

  window.currentEvent = e; window.ticketTypes = types; window.ticketLimit = limit;
  window.selectedType = savedType; window.selectedPrice = Number(types.find(t=>t.id===savedType)?.price || 0); window.ticketQty = savedQty;
  updateTicketSelection();

  let sec = 600;
  const timerId = setInterval(() => { sec--; const t=document.getElementById("timer"); if(t)t.textContent=`${String(Math.max(0,Math.floor(sec/60))).padStart(2,"0")}:${String(Math.max(0,sec%60)).padStart(2,"0")}`; if(sec<=0)clearInterval(timerId); },1000);
}

function pickTicket(type, price) {
  window.selectedType = type; window.selectedPrice = Number(price || 0); sessionStorage.setItem("ticketType", type);
  updateTicketSelection();
}
function changeQty(delta) {
  const limit = Number(window.ticketLimit || 10);
  window.ticketQty = Math.max(1, Math.min(limit, Number(window.ticketQty || 1) + delta));
  sessionStorage.setItem("ticketQty", window.ticketQty);
  updateTicketSelection();
}
function updateTicketSelection() {
  document.querySelectorAll(".ticket-choice").forEach(card=>card.classList.remove("selected"));
  const idx = (window.ticketTypes || []).findIndex(t=>t.id===window.selectedType);
  const cards = document.querySelectorAll(".ticket-choice"); if(idx>=0 && cards[idx]) cards[idx].classList.add("selected");
  const q=Number(window.ticketQty||1), t=(window.ticketTypes||[]).find(x=>x.id===window.selectedType);
  const typeEl=document.getElementById("summaryType"), priceEl=document.getElementById("summaryPrice"), totalEl=document.getElementById("total"), qtyEl=document.getElementById("qtyValue");
  if(qtyEl)qtyEl.textContent=q;
  if(typeEl)typeEl.textContent=t?.name||"ยังไม่ได้เลือก";
  if(priceEl)priceEl.textContent=t?(Number(t.price)===0?"ฟรี":money(t.price)):"-";
  if(totalEl)totalEl.textContent=money((Number(t?.price)||0)*q);
}

async function checkout(ev) {
  if (!window.selectedType) { toast("กรุณาเลือกประเภทบัตร", "error"); return; }
  const btn=ev?.target?.closest?.("button"), q=Number(window.ticketQty||1);
  try {
    if(btn){btn.disabled=true;btn.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> กำลังสร้างคำสั่งซื้อ...`;}
    const order=await apiFetch("/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId:window.currentEvent.id,ticketType:window.selectedType,qty:q,price:window.selectedPrice,queueToken:sessionStorage.getItem("delef_queue_token")||""})});
    sessionStorage.setItem("ticketQty",q); sessionStorage.setItem("ticketPrice",window.selectedPrice);
    sessionStorage.setItem("ticketType",window.selectedType);
    sessionStorage.removeItem("delef_queue_token");
    sessionStorage.removeItem("delef_queue_code");
    sessionStorage.setItem("delef_checkout",JSON.stringify({eventId:window.currentEvent.id,ticketType:window.selectedType,qty:q,price:window.selectedPrice,orderId:order.id,queueCode:order.queueCode}));
    location.href=`buyer.html?id=${encodeURIComponent(window.currentEvent.id)}&order=${encodeURIComponent(order.id)}`;
  } catch(err){toast(err.message,"error");if(btn){btn.disabled=false;btn.innerHTML=`<span>ดำเนินการต่อ</span><i class="fa-solid fa-arrow-right"></i>`;}}
}

/* =========================================================
   ADMIN
   ========================================================= */
const ADMIN_TOKEN_KEY = "delef_admin_token";
const ADMIN_USER_KEY = "delef_admin_user";
function adminToken(){return localStorage.getItem(ADMIN_TOKEN_KEY);}
function adminUsername(){return localStorage.getItem(ADMIN_USER_KEY)||"";}
function isAdminLoggedIn(){return !!adminToken();}
function adminLogoutLocal(){localStorage.removeItem(ADMIN_TOKEN_KEY);localStorage.removeItem(ADMIN_USER_KEY);}
async function adminApiFetch(path,options={}){
  try{return await apiFetch(path,{...options,headers:{...(options.headers||{}),Authorization:`Bearer ${adminToken()}`}});}
  catch(err){if(err.status===401){adminLogoutLocal();toast("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่","error");setTimeout(()=>location.href="login.html",700);}throw err;}
}
function adminGuard(){if(!isAdminLoggedIn()){location.href="login.html";return false;}const n=document.getElementById("adminUsername");if(n)n.textContent=adminUsername();return true;}
async function adminLogout(){try{await adminApiFetch("/admin/logout",{method:"POST"});}catch{}adminLogoutLocal();location.href="login.html";}

function initAdminLogin(){
  if(isAdminLoggedIn()){location.href="events.html";return;}
  const form=document.getElementById("adminLoginForm");if(!form)return;
  form.addEventListener("submit",async ev=>{ev.preventDefault();const b=form.querySelector("button[type=submit]"),label=b.innerHTML;b.disabled=true;b.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...`;
    try{const d=await apiFetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})});localStorage.setItem(ADMIN_TOKEN_KEY,d.token);localStorage.setItem(ADMIN_USER_KEY,d.username);location.href="dashboard.html";}catch(e){toast(e.message,"error");b.disabled=false;b.innerHTML=label;}
  });
}

function initAdmin(){
  if(!adminGuard())return;
  const rows=document.getElementById("rows"),form=document.getElementById("form"),file=document.getElementById("imageFile"),preview=document.getElementById("preview"),modal=document.getElementById("modal"),typeList=document.getElementById("ticketTypeList");
  if(!rows||!form)return;
  let editing=null,currentImage="",pendingFile=null,cachedList=[];
  const typeRow=(t={name:"",description:"",price:0})=>`<div class="ticket-type-row"><input class="type-name" placeholder="ชื่อประเภทบัตร" value="${esc(t.name)}" required><input class="type-desc" placeholder="คำอธิบายสั้น ๆ" value="${esc(t.description||"")}"><div class="type-price-wrap"><input class="type-price" type="number" min="0" step="1" placeholder="ราคา" value="${Number(t.price)||0}" required><span>บาท</span></div><button type="button" class="icon-btn danger remove-type"><i class="fa-solid fa-trash"></i></button></div>`;
  function renderTypes(types){typeList.innerHTML=(types?.length?types:[{name:"บัตรธรรมดา",description:"สิทธิ์เข้างานตามมาตรฐาน",price:0}]).map(typeRow).join("");}
  function readTypes(){return [...typeList.querySelectorAll(".ticket-type-row")].map((r,i)=>({id:`type-${i+1}`,name:r.querySelector(".type-name").value.trim(),description:r.querySelector(".type-desc").value.trim(),price:Number(r.querySelector(".type-price").value)}));}
  typeList.addEventListener("click",e=>{const btn=e.target.closest(".remove-type");if(btn){if(typeList.children.length<=1)return toast("ต้องมีประเภทบัตรอย่างน้อย 1 ประเภท","error");btn.parentElement.remove();}});
  document.getElementById("addTicketType")?.addEventListener("click",()=>typeList.insertAdjacentHTML("beforeend",typeRow()));
  async function draw(){rows.innerHTML=`<tr><td colspan="6" class="table-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</td></tr>`;try{cachedList=await adminApiFetch("/events");rows.innerHTML=cachedList.length?cachedList.map(e=>`<tr><td>${e.image?`<img class="thumb" src="${esc(e.image)}">`:"-"}</td><td><b>${esc(e.name)}</b><small>${dateTH(e.date)} · ${esc(e.time)} · ${esc(e.venue)}</small></td><td>${(e.ticketTypes||[]).length} ประเภท<br>สูงสุด ${e.limitPerOrder||10} ใบ</td><td>${(e.ticketTypes||[]).map(t=>`${esc(t.name)} · ${Number(t.price)===0?"ฟรี":money(t.price)}`).join("<br>")}</td><td><span class="status status-${e.status==="เปิดขาย"?"open":e.status==="เร็ว ๆ นี้"?"soon":"closed"}">${esc(e.status)}</span></td><td><button class="icon-btn" onclick="editAdmin('${e.id}')"><i class="fa-solid fa-pen"></i></button><button class="icon-btn danger" onclick="deleteAdmin('${e.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join(""):`<tr><td colspan="6" class="table-loading">ยังไม่มีงานในระบบ</td></tr>`;}catch(e){rows.innerHTML=`<tr><td colspan="6" class="table-loading error">${esc(e.message)}</td></tr>`;}}
  window.openForm=()=>{editing=null;currentImage="";pendingFile=null;form.reset();renderTypes([{name:"บัตรธรรมดา",description:"สิทธิ์เข้างานตามมาตรฐาน",price:1500}]);form.limitPerOrder.value=10;document.getElementById("formTitle").textContent="เพิ่มคอนเสิร์ต";preview.classList.add("hide");modal.classList.remove("hide");};
  window.closeForm=()=>modal.classList.add("hide");
  window.deleteAdmin=async id=>{if(!confirm("ลบงานนี้หรือไม่? การลบไม่สามารถย้อนกลับได้"))return;try{await adminApiFetch(`/events/${encodeURIComponent(id)}`,{method:"DELETE"});toast("ลบงานเรียบร้อย");draw();}catch(e){toast(e.message,"error");}};
  window.editAdmin=id=>{const e=cachedList.find(x=>x.id===id);if(!e)return;editing=id;currentImage=e.image||"";pendingFile=null;form.name.value=e.name;form.date.value=e.date;form.time.value=e.time;form.venue.value=e.venue;form.limitPerOrder.value=e.limitPerOrder||10;form.status.value=e.status;renderTypes(e.ticketTypes||[]);if(currentImage){preview.src=currentImage;preview.classList.remove("hide");}else preview.classList.add("hide");document.getElementById("formTitle").textContent="แก้ไขคอนเสิร์ต";modal.classList.remove("hide");};
  file?.addEventListener("change",()=>{const f=file.files[0];if(!f)return;pendingFile=f;const r=new FileReader();r.onload=()=>{preview.src=r.result;preview.classList.remove("hide");};r.readAsDataURL(f);});
  form.addEventListener("submit",async ev=>{ev.preventDefault();const b=form.querySelector("button[type=submit]"),label=b.innerHTML;b.disabled=true;try{let imageUrl=currentImage;if(pendingFile){b.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปโหลด...`;const fd=new FormData();fd.append("poster",pendingFile);imageUrl=(await adminApiFetch("/upload",{method:"POST",body:fd})).url;}const types=readTypes();if(!types.length||types.some(t=>!t.name||!Number.isFinite(t.price)||t.price<0))throw new Error("กรุณากรอกประเภทบัตรและราคาให้ครบ");const payload={name:form.name.value.trim(),date:form.date.value,time:form.time.value,venue:form.venue.value.trim(),regular:types[0].price,vip:types[1]?.price||0,status:form.status.value,image:imageUrl||"",limitPerOrder:Number(form.limitPerOrder.value)||10,ticketTypes:types};b.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...`;if(editing)await adminApiFetch(`/events/${encodeURIComponent(editing)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});else await adminApiFetch("/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});toast(editing?"บันทึกการแก้ไขแล้ว":"เพิ่มคอนเสิร์ตแล้ว");closeForm();draw();}catch(e){toast(e.message,"error");}finally{b.disabled=false;b.innerHTML=label;}});
  draw();
}

async function initDashboard(){
  if(!adminGuard())return;
  const statCards=document.getElementById("statCards"),table=document.getElementById("perEventTable"),recent=document.getElementById("recentOrders");
  try{const s=await adminApiFetch("/admin/stats");statCards.innerHTML=`<div class="stat-card"><i class="fa-solid fa-calendar-days"></i><div><small>งานทั้งหมด</small><b>${s.totalEvents}</b></div></div><div class="stat-card"><i class="fa-solid fa-bolt"></i><div><small>กำลังเปิดขาย</small><b>${s.onSale}</b></div></div><div class="stat-card"><i class="fa-solid fa-ticket"></i><div><small>บัตรที่กด</small><b>${s.totalTickets.toLocaleString("th-TH")}</b></div></div><div class="stat-card highlight"><i class="fa-solid fa-sack-dollar"></i><div><small>ยอดรวม</small><b>${money(s.totalRevenue)}</b></div></div>`;table.innerHTML=s.perEvent.map(e=>`<tr><td>${e.image?`<img class="thumb" src="${esc(e.image)}">`:"-"}</td><td><b>${esc(e.name)}</b></td><td>${e.orders} คำสั่งซื้อ<br>${e.ticketsSold} ใบ</td><td>${money(e.revenue)}</td></tr>`).join("")||`<tr><td colspan="4">ยังไม่มีข้อมูล</td></tr>`;recent.innerHTML=s.recentOrders.map(o=>`<li><span><b>${esc(o.queueCode||"-")}</b> ${esc(o.eventName)}</span><span>${esc(o.ticketName||o.ticketType)} × ${o.qty}</span></li>`).join("")||`<li>ยังไม่มีคำสั่งซื้อ</li>`;}catch(e){statCards.innerHTML=`<div class="empty error">${esc(e.message)}</div>`;}
}

async function initOrders(){
  if(!adminGuard())return;const tbody=document.getElementById("orderRows");try{const list=await adminApiFetch("/admin/orders");tbody.innerHTML=list.map(o=>{const b=o.buyer||{};return `<tr><td><strong>${esc(o.queueCode||"-")}</strong><small>${new Date(o.createdAt).toLocaleString("th-TH")}</small></td><td><b>${esc(b.discord||"-")}</b><small>${esc(b.roblox||"-")} · ${esc(b.email||"-")}</small></td><td>${esc(o.eventName)}</td><td>${esc(o.ticketName||o.ticketType)}<small>${o.qty} ใบ</small></td><td>${Number(o.total)===0?"ฟรี":money(o.total)}</td></tr>`}).join("")||`<tr><td colspan="5">ยังไม่มีรายการ</td></tr>`;}catch(e){tbody.innerHTML=`<tr><td colspan="5" class="table-loading error">${esc(e.message)}</td></tr>`;}
}
async function initCustomers(){
  if(!adminGuard())return;const tbody=document.getElementById("customerRows");try{const list=await adminApiFetch("/admin/customers");tbody.innerHTML=list.map(c=>`<tr><td><b>${esc(c.discord)}</b></td><td>${esc(c.roblox)}</td><td>${esc(c.email)}</td><td>${c.orders}</td><td>${c.tickets}</td><td>${money(c.total)}</td></tr>`).join("")||`<tr><td colspan="6">ยังไม่มีข้อมูลลูกค้า</td></tr>`;}catch(e){tbody.innerHTML=`<tr><td colspan="6" class="table-loading error">${esc(e.message)}</td></tr>`;}
}
