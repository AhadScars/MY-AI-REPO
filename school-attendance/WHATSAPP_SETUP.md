# How to send WhatsApp on check-in / check-out

Right now the app **always** writes messages to `SMS.txt`.  
To also **send a real WhatsApp** to the student/parent phone, use **Meta WhatsApp Cloud API** (official).

---

## How it works in this app

1. Student checks in or out  
2. App writes a line to `SMS.txt`  
3. If WhatsApp is enabled and keys are set, app calls Meta’s API  
4. Message goes to the student’s **phone** field (default `9140980834` → `919140980834`)

Example message:

```text
Student Ali Khan arrived at school at 08:30
Student Ali Khan leave school at 14:15
```

---

## Setup (step by step)

### 1. Create a Meta app

1. Go to [https://developers.facebook.com/](https://developers.facebook.com/)  
2. Create an app → type **Business**  
3. Add product **WhatsApp**  
4. Open **WhatsApp → API Setup**

### 2. Copy credentials

From API Setup, copy:

| Field | Env variable |
|--------|----------------|
| Temporary (or permanent) access token | `WHATSAPP_ACCESS_TOKEN` |
| Phone number ID | `WHATSAPP_PHONE_NUMBER_ID` |

### 3. Configure this project

In the `school-attendance` folder:

```bat
copy .env.example .env
```

Edit `.env`:

```env
WHATSAPP_ENABLED=1
WHATSAPP_ACCESS_TOKEN=EAAB...your_token...
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_DEFAULT_COUNTRY=91
WHATSAPP_USE_TEMPLATE=0
```

### 4. Restart the app

```bat
run.bat
```

### 5. Test

1. Mark Attendance → check in a student  
2. Open `SMS.txt` — you should see:

```text
To: 9140980834 | Student ... arrived at school at HH:MM
  WhatsApp SENT: {...}
```

or `WhatsApp FAIL: ...` with the API error.

---

## Important Meta rules

### Free text vs template

| Mode | When it works |
|------|----------------|
| **Free text** (`WHATSAPP_USE_TEMPLATE=0`) | Mostly for **testing** (sandbox / user messaged you first within 24h) |
| **Template** (`WHATSAPP_USE_TEMPLATE=1`) | **Production** — parent phones get arrival/leave alerts anytime |

For a real school, create a template in **WhatsApp Manager**, e.g.:

- Name: `attendance_alert`  
- Body: `{{1}}`  
- Then set:

```env
WHATSAPP_USE_TEMPLATE=1
WHATSAPP_TEMPLATE_NAME=attendance_alert
WHATSAPP_TEMPLATE_LANG=en
```

### Test number

In Meta’s test mode you can only message **registered test recipient numbers** until you go live with a real business number.

### Phone format

- Student phone in DB: `9140980834` (10 digits)  
- App sends as: `919140980834` (adds country `91`)  
- Change country with `WHATSAPP_DEFAULT_COUNTRY`

---

## Alternatives (if you don’t want Meta directly)

| Provider | Notes |
|----------|--------|
| **Twilio WhatsApp** | Easy paid API; similar code change |
| **Interakt / Wati / AiSensy** | India-friendly WhatsApp Business platforms |
| **Official WhatsApp only** | No unofficial bots (pywhatkit/selenium) — unreliable & against ToS |

---

## Security

- Never commit `.env` or tokens to git  
- Use a **permanent** system user token for production  
- Rotate tokens if leaked  

---

## Disable WhatsApp

```env
WHATSAPP_ENABLED=0
```

`SMS.txt` logging still works without WhatsApp.
