# سجل التحقق من تطبيق سوق حمد — 23 أكتوبر 2026

إعداد إصدار Codemagic الأحدث هو `1.0.33` برقم بناء `34`. حزمة APK المحلية الموثقة أدناه تبقى نسخة معاينة أقدم (`1.0.3`, build `4`) بمعرّف تطوير؛ لا تمثل ملف الإصدار الإنتاجي الذي ستنتجه Codemagic.

تطبيق React Native أصلي لـAndroid وiOS يتصل بواجهات API عبر HTTPS مباشرة؛ لا يفتح صفحات الموقع داخل التطبيق. يعرض سجل المتصفح (local-only artifact; excluded from Git) نجاح 8 من 8 سيناريوهات محلية ببيانات مموّهة واعتراض جميع طلبات API.

## التحقق على الهاتف

بُني APK بعد الإصلاح وثُبّت عبر USB على هاتف NIC_LX2 بنظام Android 15. نجح `adb install -r`، وبدأت `MainActivity` وأظهر Hermes `Running "main"` دون خطأ JavaScript أو انهيار للتطبيق بعد التشغيل. عولج في النسخة الأولى اختلاف Hermes عن المتصفح: لا تتوفر فيها `Intl.RelativeTimeFormat`، وكانت تسبب تعطل بطاقة الإعلان. صار عرض «منذ/بعد» بصياغة عربية لا تعتمد على تلك الواجهة، ويغطيها اختبار انحدار.

بعد فتح الرئيسية اتصل التطبيق بواجهة السوق وجلب الإعلانات الفعلية. تُظهر لقطة الهاتف (local-only artifact; excluded from Git) شرائح التصنيفات، وبطاقات أفقية بصورتها إلى اليمين، وشعار الموقع، وأيقونة حمد العائمة، وشريط التنقل السفلي. لا تتضمن بيانات اللقطة اختبارات أو إعلانات اصطناعية.

## الفحوص

| الفحص | النتيجة |
| --- | --- |
| `pnpm.cmd check` — TypeScript وESLint | نجح |
| توافق اعتماديات Expo (`expo install --check`) | نجح |
| اختبارات الإعداد والموقع والتاريخ النسبي والرفع | 12 ناجحة |
| اختبارات البث وسياق حمد | 5 ناجحة |
| تصدير Expo إلى Android وiOS والويب | نجح؛ حزمة Hermes لـiOS أُنتجت |
| سيناريوهات الويب المحلية | 8/8 ناجحة؛ دون اتصالات إنتاج أو استثناءات متصفح |
| بناء APK وتوقيعه ومحاذاته | Gradle ناجح؛ `apksigner` و`zipalign` ناجحان |
| تثبيت وبدء التشغيل على Android 15 | نجح؛ التطبيق يعمل على الهاتف |

نجحت حزمة iOS JavaScript في التصدير، لكن لم يُنشأ IPA ولم يجرِ توقيعه أو تثبيته؛ يتطلب ذلك macOS/Xcode أو إعداد بناء EAS وتوقيع المالك.

## حزمة Android

الملف: souq-hamad-android-preview.apk (local-only artifact; excluded from Git). يحفظ محليًا تحت `.data` المتجاهل من Git.

| الخاصية | القيمة |
| --- | --- |
| الإصدار | `1.0.3`، versionCode `4` |
| الحزمة | `com.souqhamad.app.dev` |
| الحجم | 34,173,804 بايت (نحو 34.2 MB) |
| SHA-256 | `db34b1f4ddb10be1ba6c94cfe5d66f5b3e92850811012e3098bcaa99df08e231` |
| المعالج | `arm64-v8a` |
| Android SDK | min 24، target 36، compile 37 |
| التوقيع والمحاذاة | `CN=Android Debug`؛ APK Signature v2 و`zipalign -c -P 16 4` ناجحان |
| Google OAuth للتجربة | Android package `com.souqhamad.app.dev`، SHA-1 `5e8f16062ea3cd2c4a0d547876baa6f38cabf625` |

هذا APK محلي للتجربة وموقّع بمفتاح debug؛ ليس مفتاح الإصدار الذي يملكه المتجر. طلب الموقع يستخدم إذن foreground الظاهر عند ضغط المستخدم، ولا يحتوي APK على إذن موقع في الخلفية.

يعيد سيرفر الإنتاج حاليًا HTTP 200 من `/api/auth/google/native-config` مع `clientId` عام، لكن ذلك لا يثبت تسجيل package/SHA-1 في Google Cloud. يحتاج APK التجريبي Android OAuth للمعرف `com.souqhamad.app.dev` وبصمة debug أعلاه. نسخة المتجر تحتاج تسجيلًا مستقلًا ببصمة شهادة التوقيع التي يملكها الناشر. لم يكتمل تسجيل Google ولم يُختر أي حساب.

أثناء فحص الواجهة على الهاتف بقي مربع الاتفاقية محددًا من تفاعل اختبار سابق، فأرسل الضغط التالي طلب `POST /api/auth/commission-agreement` وفتح شاشة Google. أُغلقت الشاشة فورًا دون اختيار حساب، ولم يُستكمل تسجيل الدخول. أُوقف التطبيق لإزالة رمز الاتفاقية المؤقت من ذاكرة العملية. بعد ذلك اختُبر زر Google مع المربع غير محدد؛ ظهرت رسالة الموافقة ولم يُرسل طلب جديد. لقطة التوجيه داخل الشاشة (local-only artifact; excluded from Git).

## اتصال السيرفر والحدود

يجلب التطبيق الإعلانات من `/api/marketplace/listings` مباشرة، كما تؤكد البطاقات الظاهرة على الجهاز. فُحص `/api/mobile/bootstrap` العام ووجد أنه يعيد 404 حاليًا؛ لذلك يستخدم التطبيق قائمة التصنيفات والمدن والسياسات العامة المضمّنة، مع استمرار تحميل بيانات السوق والحسابات من API. لا يحتوي fallback على إعلانات أو سجلات حساب.

ميزة متابعة الإعلانات المشابهة تحتاج نشر `GET/POST /api/marketplace/listings/{id}/similar-follow` من مصدر السيرفر. لم تُرسل رسائل أو تُنشأ إعلانات أو تُغيّر مفضلة. أُرسل طلب قبول الاتفاقية المذكور أعلاه؛ ولم يحدث تسجيل دخول أو إنشاء حساب. مفاتيح OAuth وإرسال الإشعارات ورفع الصور على جهاز حقيقي تحتاج إعدادات المالك واختبارًا منفصلًا.

## إعادة التحقق

من جذر مجلد التطبيق:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd exec expo install --check
pnpm.cmd check
node --test tests/*.test.cjs
node --experimental-strip-types --test tests/native-transport.test.mjs
pnpm.cmd export
node tests/browser-smoke.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-preview.ps1
```

تفاصيل العقود والتهيئة في [تعليمات التطبيق](../README.md) و[وثيقة البنية](native-mobile-architecture.ar.md) و[جرد API](native-mobile-api-inventory.md).
