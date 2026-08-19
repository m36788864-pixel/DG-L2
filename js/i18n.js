
(() => {
  const STORAGE_KEY = "delef-language";
  let lang = localStorage.getItem(STORAGE_KEY) || "th";
  let applying = false;

  const dict = {
    "หน้าแรก": "Home",
    "คอนเสิร์ต": "Concerts",
    "ปฏิทิน": "Calendar",
    "บัญชี": "Account",
    "เข้าสู่ระบบ": "Login",
    "ออกจากระบบ": "Logout",
    "กดบัตรคอนเสิร์ต": "Get Concert Tickets",
    "ง่าย • เร็ว • พร้อมลุย": "Easy • Fast • Ready",
    "เลือกงานที่ต้องการ ดูรายละเอียด และเข้าสู่ระบบกดบัตรได้ในไม่กี่ขั้นตอน": "Choose an event, view the details, and sign in to get your tickets in just a few steps.",
    "ดูคอนเสิร์ต": "Browse Concerts",
    "งานที่กำลังเปิดขาย": "Events Now On Sale",
    "ดูทั้งหมด": "View All",
    "ข่าวสาร / อัปเดต": "News / Updates",
    "ช่องทางการติดต่อ": "Contact Us",
    "ติดตามข่าวสารและสอบถามข้อมูลเพิ่มเติม": "Follow our news and contact us for more information.",
    "คอนเสิร์ตทั้งหมด": "All Concerts",
    "งานที่เพิ่มจาก Admin จะแสดงตรงนี้อัตโนมัติ": "Events added by Admin will appear here automatically.",
    "ค้นหาชื่องาน...": "Search event name...",
    "รายละเอียดงาน": "Event Details",
    "เลือกบัตร": "Choose Tickets",
    "จำนวน": "Quantity",
    "ราคา": "Price",
    "ฟรี": "Free",
    "ยกเลิก": "Cancel",
    "เสร็จสิ้น": "Done",
    "สถานะ": "Status",
    "ชื่อ": "Name",
    "คำอธิบาย": "Description",
    "เพิ่มบัตร": "Add Ticket",
    "ประเภทบัตร": "Ticket Type",
    "จำกัดต่อคำสั่งซื้อ": "Limit per Order",
    "บันทึก": "Save",
    "แก้ไข": "Edit",
    "ลบ": "Delete",
    "แดชบอร์ด": "Dashboard",
    "คำสั่งซื้อ": "Orders",
    "ลูกค้า": "Customers",
    "จัดการงาน": "Manage Events",
    "เพิ่มงาน": "Add Event",
    "ผู้ดูแลระบบ": "Administrator",
    "รหัสผ่าน": "Password",
    "ชื่อผู้ใช้": "Username",
    "สมัครสมาชิก": "Register",
    "ยืนยัน": "Confirm",
    "ถัดไป": "Next",
    "ย้อนกลับ": "Back",
    "ชำระเงิน": "Payment",
    "ใบเสร็จ": "Receipt",
    "คิว": "Queue",
    "เลขคิว": "Queue Number",
    "รอข้อมูล": "Waiting for data",
    "โหลดข้อมูลไม่สำเร็จ": "Failed to load data",
    "ยังไม่มีงานที่เปิดขาย": "No events are currently on sale",
    "บัตรธรรมดา": "Regular Ticket",
    "บัตร VIP": "VIP Ticket",
    "สิทธิ์เข้างานตามมาตรฐาน": "Standard event admission",
    "สิทธิ์พิเศษสำหรับผู้ถือบัตร VIP": "Special benefits for VIP ticket holders",
    "YouTube": "YouTube",
    "Instagram": "Instagram",
    "TikTok": "TikTok",
    "Discord": "Discord",
    "DELEF FEST COMMUNITY": "DELEF FEST COMMUNITY",
    "SECURE TICKETING": "SECURE TICKETING",
    "DELEF FEST GOPASS": "DELEF FEST GOPASS",
    "NOW ON SALE": "NOW ON SALE",
    "LATEST": "LATEST",
    "CONTACT": "CONTACT",
    "Admin": "Admin"
  };

  const reverse = Object.fromEntries(Object.entries(dict).map(([th,en]) => [en,th]));

  // Exact text translations plus common strings embedded in longer text.
  function translateString(value) {
    if (!value) return value;
    let out = value;
    const source = lang === "en" ? dict : reverse;
    for (const [from, to] of Object.entries(source)) {
      if (out === from) return to;
    }
    for (const [from, to] of Object.entries(source)) {
      if (out.includes(from)) out = out.split(from).join(to);
    }
    return out;
  }

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const p = node.parentElement;
      if (!p || ["SCRIPT","STYLE","NOSCRIPT"].includes(p.tagName)) return;
      const original = node.nodeValue;
      const trimmed = original.trim();
      if (!trimmed) return;
      const translated = translateString(trimmed);
      if (translated !== trimmed) {
        const start = original.indexOf(trimmed);
        node.nodeValue = original.slice(0, start) + translated + original.slice(start + trimmed.length);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.id === "languageSwitcher") return;

    for (const attr of ["placeholder", "title", "aria-label"]) {
      if (node.hasAttribute(attr)) {
        const value = node.getAttribute(attr);
        const translated = translateString(value);
        if (translated !== value) node.setAttribute(attr, translated);
      }
    }
    for (const child of node.childNodes) translateNode(child);
  }

  function addSwitcher() {
    const nav = document.querySelector(".nav");
    if (!nav || document.getElementById("languageSwitcher")) return;

    const btn = document.createElement("button");
    btn.id = "languageSwitcher";
    btn.type = "button";
    btn.className = "language-switcher";
    btn.innerHTML = `<i class="fa-solid fa-language"></i><span></span>`;
    btn.title = "Switch language";
    btn.addEventListener("click", () => {
      lang = lang === "th" ? "en" : "th";
      localStorage.setItem(STORAGE_KEY, lang);
      window.applyLanguage();
    });

    const login = nav.querySelector(".login-btn");
    if (login) nav.insertBefore(btn, login);
    else nav.appendChild(btn);
  }

  function updateSwitcher() {
    const btn = document.getElementById("languageSwitcher");
    if (!btn) return;
    const span = btn.querySelector("span");
    if (span) span.textContent = lang === "th" ? "EN" : "ไทย";
    btn.setAttribute("aria-label", lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย");
  }

  window.applyLanguage = () => {
    if (applying) return;
    applying = true;
    try {
      document.documentElement.lang = lang === "en" ? "en" : "th";
      translateNode(document.body);
      updateSwitcher();
    } finally {
      applying = false;
    }
  };

  window.getLanguage = () => lang;
  window.setLanguage = (next) => {
    if (next !== "th" && next !== "en") return;
    lang = next;
    localStorage.setItem(STORAGE_KEY, lang);
    window.applyLanguage();
  };

  const observer = new MutationObserver((mutations) => {
    if (applying) return;
    // Wait a tick so dynamic cards/forms finish rendering.
    clearTimeout(window.__delefI18nTimer);
    window.__delefI18nTimer = setTimeout(() => {
      addSwitcher();
      window.applyLanguage();
    }, 30);
  });

  document.addEventListener("DOMContentLoaded", () => {
    addSwitcher();
    window.applyLanguage();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
