# إعداد بناء سوق حمد على Codemagic

المستودع يشغّل مسارين عند دفع التغييرات إلى الفرع `main`: حزمة Android بصيغة AAB ونسخة iOS بصيغة IPA. رقم الإصدار المضبوط حاليًا هو `1.0.33` ورقم البناء `34`، ومعرّف التطبيق الإنتاجي هو `com.souqhamad.app` على المنصتين.

## إعداد Codemagic مرة واحدة

1. أضف مستودع `mahersss024-oss/app` إلى حساب Codemagic، واختر ملف `codemagic.yaml` من الفرع `main`.
2. فعّل Webhook الخاص بـ GitHub لأحداث الدفع. ملف YAML يراقب `main`، لكن الدفع وحده لا يبدأ البناء ما لم يكن المشروع متصلًا وWebhook مفعّلًا.
3. من **Environment variables** أنشئ مجموعة باسم `android_signing`، وأضف إليها المتغيرات التالية مع تفعيل **Secret** لكل قيمة:
   - `CM_KEYSTORE`: محتوى ملف keystore الأصلي بترميز Base64.
   - `CM_KEYSTORE_PASSWORD`: كلمة مرور ملف keystore.
   - `CM_KEY_ALIAS`: اسم المفتاح داخل الملف.
   - `CM_KEY_PASSWORD`: كلمة مرور المفتاح.

   يستخدم مسار Android هذه المجموعة مباشرة، ويفك ترميز `CM_KEYSTORE` إلى ملف مؤقت أثناء البناء. لا تضف مرجع `android_signing` ضمن Code signing identities لهذا المسار. استخدم keystore الرفع نفسه الذي وقّع الإصدار السابق؛ تغيير المفتاح قد يمنع تحديث التطبيق المنشور.
4. ارفع شهادة Apple Distribution وملف App Store provisioning profile المطابقين لمعرّف `com.souqhamad.app` من إعدادات شهادات وتواقيع Apple في Codemagic. يجب أن يتضمن ملف التعريف قدرات **Sign in with Apple** و**Associated Domains** المستخدمة في التطبيق.

المخرجات المتوقعة هي `*.aab` من مسار Android و`*.ipa` من مسار iOS. لا يحتوي المستودع على مفاتيح توقيع أو كلمات مرور. إذا لم تُضف المجموعة أو كانت بياناتها غير صحيحة، فسيفشل مسار Android قبل توقيع الحزمة. توقيع iOS إعداد مستقل يحتاج شهادة توزيع وملف App Store provisioning profile.
