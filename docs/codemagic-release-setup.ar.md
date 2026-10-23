# إعداد بناء سوق حمد على Codemagic

المستودع يشغّل مسارين عند دفع التغييرات إلى الفرع `main`: حزمة Android بصيغة AAB ونسخة iOS بصيغة IPA. رقم الإصدار المضبوط حاليًا هو `1.0.33` ورقم البناء `34`، ومعرّف التطبيق الإنتاجي هو `com.souqhamad.app` على المنصتين.

## إعداد Codemagic مرة واحدة

1. أضف مستودع `mahersss024-oss/app` إلى حساب Codemagic، واختر ملف `codemagic.yaml` من الفرع `main`.
2. فعّل Webhook الخاص بـ GitHub لأحداث الدفع. ملف YAML يراقب `main`، لكن الدفع وحده لا يبدأ البناء ما لم يكن المشروع متصلًا وWebhook مفعّلًا.
3. ارفع مفتاح Android من **Team settings → codemagic.yaml settings → Code signing identities → Android keystores**، واجعل اسمه المرجعي `souq-hamad-android-release`. استخدم مفتاح الرفع نفسه الذي وقّع الإصدار السابق من التطبيق؛ تغيير المفتاح قد يمنع تحديث التطبيق المنشور.
4. ارفع شهادة Apple Distribution وملف App Store provisioning profile المطابقين لمعرّف `com.souqhamad.app` من إعدادات شهادات وتواقيع Apple في Codemagic. يجب أن يتضمن ملف التعريف قدرات **Sign in with Apple** و**Associated Domains** المستخدمة في التطبيق.

المخرجات المتوقعة هي `*.aab` من مسار Android و`*.ipa` من مسار iOS. لا يحتوي المستودع على مفاتيح توقيع أو كلمات مرور. إذا لم تُرفع ملفات التوقيع المطابقة إلى Codemagic، فسيفشل مسار الإصدار عند خطوة جلب التوقيع.
