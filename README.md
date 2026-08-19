# DELEF FEST GOPASS

ระบบเว็บขายบัตรคอนเสิร์ต (DELEF FEST GOPASS) — ตอนนี้มี **Backend จริง** แล้ว
(Node.js + Express + ฐานข้อมูลไฟล์ JSON + อัปโหลดรูป Poster ขึ้นเซิร์ฟเวอร์จริง)

ไม่ใช่ localStorage demo อีกต่อไป: แอดมินเพิ่ม/แก้/ลบงานแล้ว **ทุกคนที่เข้าเว็บเห็นข้อมูลเดียวกันทันที**
ไม่ว่าจะเปิดจากเครื่องไหน เบราว์เซอร์ไหนก็ตาม

## สิ่งที่ทำเพิ่ม/แก้ในรอบนี้

1. **Backend จริง** — Express API (`/api/events`, `/api/upload`, `/api/orders`, `/api/admin/*`) เขียนอ่านข้อมูลลงไฟล์ `data/events.json` / `data/orders.json` แทน localStorage
2. **อัปโหลด Poster ขึ้นเซิร์ฟเวอร์จริง** ผ่าน Multer เก็บไฟล์ไว้ที่โฟลเดอร์ `uploads/` (ไม่ใช่แค่ base64 ในเบราว์เซอร์)
3. **ระบบล็อกอินแอดมินแยกต่างหาก** (`admin/login.html`) มี username/password จริง เข้ารหัสด้วย bcrypt และมี session token ป้องกันหน้าแอดมิน — ใครก็เข้าไปแก้ข้อมูลเล่น ๆ ไม่ได้แล้ว
4. **แก้หน้า `admin/dashboard.html` ที่เดิมว่างเปล่า** ให้เป็นแดชบอร์ดจริง แสดงจำนวนงาน ยอดขายรวม จำนวนบัตรที่ถูกกด และคำสั่งซื้อล่าสุด (ดึงจากข้อมูลจริง)
5. **ตกแต่ง UI เพิ่ม**: Toast แจ้งเตือนแทน `alert()`, Skeleton loading ตอนโหลดข้อมูล, สถานะงาน (เปิดขาย/เร็ว ๆ นี้/ปิดการขาย) เป็น badge สี, การ์ดสถิติในแดชบอร์ด, sidebar แอดมินโชว์ชื่อผู้ใช้ + ปุ่มออกจากระบบ
6. หน้า Event → Queue → Seat ยังเชื่อมกันเหมือนเดิม แต่ตอนนี้การ "กดบัตร" จะยิงไป `/api/orders` เก็บเป็นคำสั่งซื้อจริง (ใช้ทำสถิติในแดชบอร์ดได้)

## วิธีรัน

ต้องมี [Node.js](https://nodejs.org) เวอร์ชัน 18 ขึ้นไป

```bash
npm install
npm start
```

แล้วเปิดเบราว์เซอร์ไปที่:

- หน้าเว็บหลัก: http://localhost:3000/index.html
- หน้าแอดมิน: http://localhost:3000/admin/login.html

> จะรันด้วย VS Code Live Server แบบเดิมไม่ได้แล้ว เพราะตอนนี้เว็บต้องพึ่ง Backend (Express) ในการดึง/บันทึกข้อมูล ต้องรันผ่าน `npm start` เท่านั้น

## บัญชีแอดมินเริ่มต้น

ครั้งแรกที่รันเซิร์ฟเวอร์ ระบบจะสร้างไฟล์ `data/admin.json` และพิมพ์ชื่อผู้ใช้/รหัสผ่านเริ่มต้นออกมาในเทอร์มินัล
(ค่าเริ่มต้นคือ `admin` / `DELEF#GOPASS2026!`)

**แนะนำให้เปลี่ยนก่อนใช้งานจริง** โดยรันด้วย ENV แล้วลบ `data/admin.json` ทิ้งก่อนรันใหม่ครั้งแรก:

```bash
ADMIN_USER=youradmin ADMIN_PASS=yourStrongPassword ADMIN_RESET=true npm start
```

## โครงสร้างข้อมูล

- `data/events.json` — ข้อมูลคอนเสิร์ตทั้งหมด (แหล่งความจริงเดียว ที่ทั้งหน้าเว็บและแอดมินอ่าน/เขียน)
- `data/orders.json` — ประวัติการกดบัตร (ใช้ทำสถิติในแดชบอร์ด)
- `data/admin.json` — บัญชีแอดมิน (username + password hash)
- `uploads/` — ไฟล์ Poster ที่แอดมินอัปโหลด

ไฟล์เหล่านี้คือ "ฐานข้อมูล" ของระบบ **สำรอง/แบ็กอัปโฟลเดอร์นี้เป็นประจำ** ถ้าจะใช้งานจริง
(ถ้าอยากอัปเกรดไป SQLite/PostgreSQL ในอนาคต โค้ดถูกแยกชั้นไว้ที่ `lib/jsonDb.js` แล้ว เปลี่ยน layer นี้ที่เดียวได้)

## ยังเป็น Demo ในส่วนไหนบ้าง

- ระบบล็อกอินฝั่งลูกค้า (`login.html`) ยังเป็น Discord demo login ไม่ใช่ OAuth จริง
- การกดบัตรยังไม่เชื่อมระบบชำระเงินจริง (Payment Gateway) — บันทึกแค่คำสั่งซื้อไว้ก่อน
- คิวยังเป็นตัวเลขสุ่ม ไม่ใช่ระบบคิวจริงแบบ Redis/Queue Service สำหรับคนพร้อมกันจำนวนมาก

ส่วน **"แอดมินเพิ่มงานได้จริง"** ตอนนี้เป็นของจริงแล้ว — มีฐานข้อมูล มีการยืนยันตัวตน มีการอัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์จริง
พร้อมต่อยอดเป็นระบบขายบัตรจริงได้ในระดับหนึ่ง


## รีเซ็ตรหัสแอดมินแบบใหม่

เวอร์ชัน Premium รองรับการรีเซ็ตบัญชีแอดมินจาก ENV โดยตรง:

**PowerShell**
```powershell
$env:ADMIN_USER="admin"
$env:ADMIN_PASS="รหัสใหม่ที่เดายาก"
$env:ADMIN_RESET="true"
npm start
Remove-Item Env:ADMIN_RESET
```

**CMD**
```cmd
set ADMIN_USER=admin
set ADMIN_PASS=รหัสใหม่ที่เดายาก
set ADMIN_RESET=true
npm start
set ADMIN_RESET=
```

เมื่อรีเซ็ตสำเร็จ ให้เอา `ADMIN_RESET` ออกทันที และอย่าเผยแพร่รหัสผ่านใน Git/ไฟล์สาธารณะ


## Flow ที่แก้ล่าสุด
เลือกบัตร -> ดำเนินการต่อ -> buyer.html (อีเมล/Discord/Roblox) -> receipt.html (ใบเสร็จ)


## Premium V4 — ระบบบัตรและแอดมินที่ปรับปรุง

รอบนี้เพิ่ม/แก้ระบบหลักตามงานจริง:

- หน้าเลือกบัตรรองรับ **ประเภทบัตรแบบกำหนดเองไม่จำกัดจำนวน**: ชื่อ, คำอธิบาย, ราคา และราคา `0` = ฟรี
- แอดมินกำหนด **ลิมิตจำนวนบัตรต่อคำสั่งซื้อ** ได้ 1–100 ใบ
- ระบบคิวออก **หมายเลขคิวจาก Backend จริง** ไม่ใช้ `Math.random()` และผูกกับคำสั่งซื้อ
- แก้ปัญหาตัวเลขจำนวนบัตรและเลขคิวไม่คงที่/ไม่ขึ้น โดยให้ข้อมูลสำคัญมาจาก Server
- เก็บข้อมูลผู้ซื้อในคำสั่งซื้อจริง: Email, Discord, Roblox
- Discord บังคับเป็น ASCII อังกฤษ/ตัวเลข/`. _ -` และ Roblox บังคับเป็น ASCII อังกฤษ/ตัวเลข/`_` เพื่อไม่ให้ภาษาไทยหลุดเข้าไปในข้อมูล
- แอดมินมีหน้า **คำสั่งซื้อ** สำหรับดูว่าใครกดบัตรอะไร จำนวนเท่าไร เลขคิวอะไร และยอดเท่าไร
- แอดมินมีหน้า **ลูกค้า** สำหรับรวมข้อมูลผู้ซื้อจากคำสั่งซื้อ
- Dashboard แสดงยอดงาน, บัตรที่กด, ยอดรวม และคำสั่งซื้อล่าสุด
- UI หน้า Admin / เลือกบัตร / กรอกข้อมูลผู้ซื้อถูกยกระดับให้เป็นแนว Premium มากขึ้น พร้อม responsive layout

## Render deployment — V6

This package now includes a root-level `Dockerfile`, so it can be deployed by a Render Web Service configured with **Docker**. Do not put the project inside another nested folder when connecting the repository; `Dockerfile` must be in the repository root.

For a native Node Render service instead, use:
- Build Command: `npm ci`
- Start Command: `npm start`

The V6 hero uses a single background image with a multi-stop gradient overlay, so the dark text panel fades smoothly into the concert artwork without a hard vertical seam. The contact section is explicitly forced to a white surface.
