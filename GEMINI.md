# Home Budget - Project Rules & Guidelines

## 1. Adminer & Database Connection Protocol
Whenever directing or asking the user to connect through **Adminer** (e.g., at `http://10.0.0.16:8088`):
* **Always display the full login credentials table directly in the message.**
* **Always include a direct, clickable link to Adminer: [כניסה ל-Adminer (פורט 8088)](http://10.0.0.16:8088)**
* For this project (`Home Budget`):
  * **קישור כניסה ישיר (URL):** [http://10.0.0.16:8088](http://10.0.0.16:8088)
  * **System (מערכת):** `PostgreSQL`
  * **Server (שרת):** `home_budget_db`
  * **Username (משתמש):** `postgres`
  * **Password (סיסמה):** `HomeBudgetSecurePass2026!` (או הסיסמה שהוגדרה ב-Docker Compose)
  * **Database (מסד נתונים):** `home_budget`

### טבלת התחברות ל-Adminer עם קישור ישיר:
🔗 **קישור ישיר לממשק:** [http://10.0.0.16:8088](http://10.0.0.16:8088)

| שדה במסך הכניסה | מה לבחור / להקליד |
| :--- | :--- |
| **קישור ישיר** | [פתיחת Adminer (פורט 8088)](http://10.0.0.16:8088) |
| **System** (מערכת) | `PostgreSQL` |
| **Server** (שרת) | `home_budget_db` |
| **Username** (משתמש) | `postgres` |
| **Password** (סיסמה) | `HomeBudgetSecurePass2026!` |
| **Database** (מסד נתונים) | `home_budget` |
