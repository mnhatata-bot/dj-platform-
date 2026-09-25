"use client";
import { createContext, useContext, useEffect, useState } from "react";
const words = {
 "page.organization": ["Active organization", "المنظمة النشطة"],
 "page.reply": ["Provider response", "رد مقدم الخدمة"],
 "page.sendReply": ["Save response for customer", "حفظ الرد للعميل"],
 "page.myInquiries": ["My inquiries", "استفساراتي"],
 "page.inquiryHelp": ["Your sent requests and provider replies. Refresh to see updates.", "طلباتك المرسلة وردود مقدمي الخدمات. حدّث لعرض المستجدات."],
 "page.awaiting": ["Awaiting provider response", "بانتظار رد مقدم الخدمة"],

  "page.title": ["Your public page", "صفحتك العامة"],
  "page.help": ["Build your page, add offerings, then publish. Your active offerings appear in the Cuelance marketplace.", "أنشئ صفحتك وأضف عروضك ثم انشرها. تظهر عروضك النشطة في سوق كيولانس."],
  "page.imageHelp": ["JPG, PNG or WebP, up to 10 MB. Uploaded images become public. Use images you have permission to share.", "JPG أو PNG أو WebP حتى ١٠ ميغابايت. تصبح الصور عامة. استخدم صوراً لديك إذن بمشاركتها."],
  "page.name": ["Display name", "الاسم المعروض"],
  "page.slug": ["Page address", "عنوان الصفحة"],
  "page.headline": ["What you do", "ماذا تقدم"],
  "page.bio": ["About you", "نبذة عنك"],
  "page.city": ["City / service area", "المدينة / منطقة الخدمة"],
  "page.website": ["Website (https://)", "الموقع الإلكتروني (https://)"],
  "page.cover": ["Cover photo", "صورة الغلاف"],
  "page.avatar": ["Profile photo / logo", "صورة الملف / الشعار"],
  "page.draft": ["Save draft", "حفظ المسودة"],
  "page.publish": ["Publish page", "نشر الصفحة"],
  "page.pause": ["Unpublish page", "إلغاء نشر الصفحة"],
  "page.open": ["View public page", "عرض الصفحة العامة"],
  "page.slugHelp": ["3–70 lowercase letters, numbers or hyphens. Example: riyadh-sound. Changing this breaks previous links.", "٣–٧٠ حرفاً إنجليزياً صغيراً أو رقماً أو شرطة. مثال: riyadh-sound. تغيير العنوان يعطل الروابط السابقة."],
  "page.offerings": ["Services & products", "الخدمات والمنتجات"],
  "page.add": ["Save offering", "حفظ العرض"],
  "page.kind": ["Offering type", "نوع العرض"],
  "page.price": ["Starting price (SAR)", "السعر يبدأ من (ريال)"],
  "page.active": ["Publish offering", "نشر العرض"],
  "page.inquiries": ["Inquiries", "الاستفسارات"],
  "page.request": ["Send inquiry", "إرسال استفسار"],
  "page.requestHelp": ["Describe your event, dates, location and requirements (10–3,000 characters). This sends an inquiry; it does not take payment or confirm a booking.", "صف الفعالية والتاريخ والموقع والمتطلبات (١٠–٣٠٠٠ حرف). هذا يرسل استفساراً ولا يأخذ دفعة أو يؤكد حجزاً."],
  "page.sent": ["Inquiry saved. The provider can see it in their workspace.", "تم حفظ الاستفسار. يمكن لمقدم الخدمة رؤيته في مساحة عمله."],
  "page.marketplace": ["Explore the marketplace", "استكشف السوق"],
  "page.all": ["All providers", "جميع مقدمي الخدمات"],
  "page.profile": ["View provider", "عرض مقدم الخدمة"],
  "page.contact": ["Contact provider", "تواصل مع مقدم الخدمة"],
  "page.edit": ["Edit", "تعديل"],
  "page.new": ["New offering", "عرض جديد"],
  "page.contactStatus": ["Contacted", "تم التواصل"],
  "page.closed": ["Closed", "مغلق"],
  "page.status": ["Status", "الحالة"],
  "page.newStatus": ["New", "جديد"],
  "page.providers": ["People, places & possibilities", "أشخاص وأماكن وفرص"],
  "page.tagline": ["Find the people and services behind your next great event.", "اعثر على الأشخاص والخدمات وراء فعاليتك القادمة."],
  "page.dashboard": ["My workspace", "مساحة عملي"],
  "page.from": ["From", "يبدأ من"],
  "page.service": ["Service", "خدمة"],
  "page.product": ["Product", "منتج"],
  "page.rental": ["Rental", "تأجير"],
  "page.experience": ["Experience", "تجربة"],
  "page.artist": ["Artist", "فنان"],
  "page.promoter": ["Promoter", "منظم"],
  "page.venue": ["Venue", "مكان"],
  "page.community": ["Community", "مجتمع"],
  "page.agency": ["Agency", "وكالة"],
  "page.production": ["Production", "إنتاج"],
  "page.vendor": ["Vendor", "مورد"],
  "page.staff": ["Event professional", "متخصص فعاليات"],
  "event.about": ["About this event", "عن الفعالية"],
  "event.tickets": ["Choose your ticket", "اختر تذكرتك"],
  "event.free": ["Reserve complimentary ticket", "احجز تذكرة مجانية"],
  "event.paid": ["Paid checkout awaiting payment provider", "الدفع بانتظار تفعيل مزود الدفع"],
  "event.wallet": ["Open ticket wallet", "فتح محفظة التذاكر"],
  "event.issued": ["Your ticket is ready in your wallet.", "تذكرتك جاهزة في محفظتك."],
  "event.venue": ["Venue", "المكان"],
  "event.date": ["Date & time", "التاريخ والوقت"],
  "event.soldout": ["Sold out", "نفدت التذاكر"],
  "event.cover": ["Event poster / cover", "ملصق / غلاف الفعالية"],
  "event.description": ["Event description", "وصف الفعالية"],
  "event.public": ["Open event page", "فتح صفحة الفعالية"],
  "ticket.pass": ["ENTRY PASS", "تصريح دخول"],
  "ticket.show": ["Show this QR at the door. Keep it private.", "أظهر الرمز عند الدخول واحتفظ به خاصاً."],
  "ticket.inactive": ["This ticket cannot be used for admission.", "لا يمكن استخدام هذه التذكرة للدخول."],
  "ticket.used": ["Already checked in", "تم تسجيل الدخول"],
  "ticket.print": ["Print ticket", "طباعة التذكرة"],
  "ticket.details": ["Ticket details", "تفاصيل التذكرة"],
  "page.empty": ["No matching published listings. Try another search or category.", "لا توجد عروض منشورة مطابقة. جرّب بحثاً أو فئة أخرى."],

  save: ["Save", "حفظ"],
  cancel: ["Cancel", "إلغاء"],
  loading: ["Loading…", "جارٍ التحميل…"],
  working: ["Working…", "جارٍ التنفيذ…"],
  refresh: ["Refresh", "تحديث"],
  empty: ["No records yet.", "لا توجد سجلات بعد."],
  error: [
    "Something went wrong. Please retry.",
    "حدث خطأ. يرجى المحاولة مجدداً.",
  ],
  help: ["Help and example", "مساعدة ومثال"],
  open: ["Open", "فتح"],
  remove: ["Remove", "إزالة"],
  up: ["Move up", "نقل لأعلى"],
  down: ["Move down", "نقل لأسفل"],
  search: ["Search", "بحث"],
  previous: ["Previous", "السابق"],
  next: ["Next", "التالي"],
  title: ["Title", "العنوان"],
  body: ["Content", "المحتوى"],
  url: ["Link", "الرابط"],
  language: ["Language", "اللغة"],
  english: ["English", "الإنجليزية"],
  arabic: ["Arabic", "العربية"],
  saved: ["Saved successfully.", "تم الحفظ بنجاح."],
  signin: ["Please sign in to continue.", "يرجى تسجيل الدخول للمتابعة."],
  "nav.media": ["Media library", "مكتبة الوسائط"],
  "nav.ai": ["AI writing", "الكتابة بالذكاء الاصطناعي"],
  "nav.messages": ["Messages", "الرسائل"],
  "nav.admin": ["Administration & CMS", "الإدارة والمحتوى"],
  "nav.wallet": ["Ticket wallet", "محفظة التذاكر"],
  "media.title": ["Your media library", "مكتبة وسائطك"],
  "media.help": [
    "Upload JPG, PNG, WebP, GIF, MP4, WebM, MP3, WAV, OGG, PDF or ZIP, up to 25 MB. Files start private. Example: a press photo or technical rider.",
    "ارفع صور JPG أو PNG أو WebP أو GIF، أو MP4 أو WebM أو MP3 أو WAV أو OGG أو PDF أو ZIP، بحد أقصى 25 ميغابايت. الملفات خاصة افتراضياً. مثال: صورة صحفية أو المتطلبات التقنية.",
  ],
  "media.file": ["Choose a file", "اختر ملفاً"],
  "media.alt": ["Description / image alt text", "الوصف / النص البديل للصورة"],
  "media.altHelp": [
    "Describe what someone should understand without seeing the image. Example: DJ performing at the Riyadh closing set.",
    "صف ما ينبغي فهمه دون رؤية الصورة. مثال: دي جي يقدم الفقرة الختامية في الرياض.",
  ],
  "media.upload": ["Upload securely", "رفع آمن"],
  "media.private": ["Private", "خاص"],
  "media.public": ["Public", "عام"],
  "media.publish": ["Make public", "إتاحة للعامة"],
  "media.unpublish": ["Make private", "جعل الملف خاصاً"],
  "media.confirm": [
    "Make this file accessible to visitors of your published EPK?",
    "هل تريد إتاحة هذا الملف لزوار ملفك الصحفي المنشور؟",
  ],
  "media.attach": ["Add to EPK", "إضافة للملف الصحفي"],
  "media.attached": [
    "Added to the draft. Publish your EPK to share it.",
    "أضيف إلى المسودة. انشر الملف الصحفي لمشاركته.",
  ],
  "media.preview": ["Open temporary link", "فتح رابط مؤقت"],
  "media.noEpk": [
    "Create your EPK first, then attach media.",
    "أنشئ ملفك الصحفي أولاً ثم أضف الوسائط.",
  ],
  "ai.title": [
    "Write with AI, publish with intention",
    "اكتب بالذكاء الاصطناعي وانشر بعد المراجعة",
  ],
  "ai.help": [
    "Enter verified career facts or an existing biography. Generate a draft, review it, then accept it into your profile form. Nothing publishes automatically. Limit: 20 requests per day and 3 per minute.",
    "أدخل حقائق موثوقة عن مسيرتك أو نبذة موجودة. أنشئ مسودة وراجعها ثم انقلها إلى نموذج ملفك. لا يُنشر أي شيء تلقائياً. الحد: 20 طلباً يومياً و3 في الدقيقة.",
  ],
  "ai.action": ["Writing action", "مهمة الكتابة"],
  "ai.source": ["Facts or source text", "الحقائق أو النص الأصلي"],
  "ai.example": [
    "Example: Riyadh-based house DJ, five years of experience, bilingual Arabic/English. Only include facts you can verify.",
    "مثال: دي جي هاوس مقيم بالرياض، بخبرة خمس سنوات، يتحدث العربية والإنجليزية. أدرج الحقائق التي يمكنك تأكيدها فقط.",
  ],
  "ai.tone": ["Tone", "الأسلوب"],
  "ai.toneExample": [
    "Example: professional, warm, concise",
    "مثال: احترافي، ودود، موجز",
  ],
  "ai.generate": ["Generate draft", "إنشاء مسودة"],
  "ai.draft": ["Review and edit the draft", "راجع المسودة وعدّلها"],
  "ai.accept": ["Use in artist profile", "استخدام في ملف الفنان"],
  "ai.accepted": [
    "Draft copied to your profile form. Review and save there.",
    "نُقلت المسودة إلى نموذج ملفك. راجعها واحفظها هناك.",
  ],
  "action.GENERATE_BIO": ["Write biography", "كتابة نبذة"],
  "action.SHORTEN_BIO": ["Shorten biography", "اختصار النبذة"],
  "action.CHANGE_TONE": ["Change tone", "تغيير الأسلوب"],
  "action.PROMOTER_BIO": ["Promoter biography", "نبذة للمروج"],
  "action.FESTIVAL_BIO": ["Festival biography", "نبذة للمهرجان"],
  "action.BRAND_BIO": ["Brand biography", "نبذة للعلامة التجارية"],
  "action.TRANSLATE": ["Translate", "ترجمة"],
  "action.GRAMMAR_FIX": ["Fix grammar", "تصحيح لغوي"],
  "action.SEO_DESCRIPTION": ["SEO description", "وصف لمحركات البحث"],
  "action.CAREER_SUMMARY": ["Career summary", "ملخص المسيرة"],
  "scanner.title": ["Check in your guests", "تسجيل دخول ضيوفك"],
  "scanner.help": [
    "Select the event, allow camera access, and hold the ticket QR in view. Each scan is validated online. A second scan returns Already checked in. Stop the camera when finished.",
    "اختر الفعالية واسمح باستخدام الكاميرا ثم وجّهها إلى رمز التذكرة. يُتحقق من كل مسح عبر الإنترنت. المسح الثاني يعرض «تم الدخول سابقاً». أوقف الكاميرا عند الانتهاء.",
  ],
  "scanner.event": ["Event", "الفعالية"],
  "scanner.start": ["Start camera", "تشغيل الكاميرا"],
  "scanner.stop": ["Stop camera", "إيقاف الكاميرا"],
  "scanner.manual": ["Credential token", "رمز اعتماد التذكرة"],
  "scanner.manualHelp": [
    "Paste the private credential from Ticket wallet if camera permission is unavailable. This is not the ticket ID.",
    "ألصق رمز الاعتماد الخاص من محفظة التذاكر إذا تعذر استخدام الكاميرا. هذا ليس رقم التذكرة.",
  ],
  "scanner.validate": ["Validate and admit", "التحقق والسماح بالدخول"],
  "scanner.offline": [
    "You are offline. Reconnect before admitting guests.",
    "أنت غير متصل. أعد الاتصال قبل السماح بدخول الضيوف.",
  ],
  "scanner.cameraError": [
    "Camera unavailable. Allow camera access in browser settings, use HTTPS, or enter the credential manually.",
    "الكاميرا غير متاحة. اسمح باستخدامها في إعدادات المتصفح واستخدم HTTPS، أو أدخل الرمز يدوياً.",
  ],
  "scanner.invalid": [
    "This is not a valid ticket credential.",
    "هذا ليس رمز تذكرة صالحاً.",
  ],
  "result.VALID": ["Valid — admitted", "صالح — تم تسجيل الدخول"],
  "result.ALREADY_CHECKED_IN": [
    "Already checked in — do not admit again",
    "تم الدخول سابقاً — لا تسمح بدخول ثانٍ",
  ],
  "result.INVALID": ["Invalid credential", "رمز غير صالح"],
  "result.WRONG_EVENT": ["Wrong event", "فعالية مختلفة"],
  "result.REVOKED": ["Ticket revoked", "تذكرة مسحوبة"],
  "result.CANCELLED": ["Ticket cancelled", "تذكرة ملغاة"],
  "wallet.title": ["Your ticket wallet", "محفظة تذاكرك"],
  "wallet.help": [
    "Tickets issued to your account appear here. Show the QR to authorized staff at the event. Keep it private: the first valid scan admits the holder.",
    "تظهر هنا التذاكر الصادرة لحسابك. اعرض الرمز للموظفين المخولين عند الفعالية. حافظ على خصوصيته؛ أول مسح صالح يسمح بالدخول.",
  ],
  "wallet.token": ["Show manual credential", "إظهار رمز الإدخال اليدوي"],
  "messages.title": ["Conversations", "المحادثات"],
  "messages.help": [
    "Start a conversation from an existing application or signed-in booking enquiry. Only the artist and authorized participants can read it. New messages refresh every five seconds.",
    "ابدأ محادثة من طلب فرصة أو استفسار حجز لمستخدم مسجل. لا يقرؤها إلا الفنان والمشاركون المخولون. تُحدّث الرسائل كل خمس ثوانٍ.",
  ],
  "messages.context": ["Application or booking", "الطلب أو الحجز"],
  "messages.start": ["Open conversation", "فتح المحادثة"],
  "messages.write": ["Your message", "رسالتك"],
  "messages.example": [
    "Example: Could you confirm your availability for a 90-minute set on Friday?",
    "مثال: هل يمكنك تأكيد تفرغك لفقرة مدتها 90 دقيقة يوم الجمعة؟",
  ],
  "messages.send": ["Send message", "إرسال الرسالة"],
  "messages.you": ["You", "أنت"],
  "messages.other": ["Participant", "مشارك"],
  "messages.none": [
    "No eligible conversations. Apply to an opportunity or create a booking enquiry while signed in.",
    "لا توجد محادثات متاحة. تقدم لفرصة أو أرسل استفسار حجز أثناء تسجيل الدخول.",
  ],
  "admin.title": ["Cuelance administration", "إدارة كيولانس"],
  "admin.denied": [
    "Administrator permission is required.",
    "تحتاج إلى صلاحية مسؤول المنصة.",
  ],
  "admin.pages": ["Content pages", "صفحات المحتوى"],
  "admin.records": ["Platform records", "سجلات المنصة"],
  "admin.settings": ["Configuration", "الإعدادات"],
  "admin.help": [
    "Manage bilingual pages, reorder structured blocks, preview, and publish. Revisions and sensitive actions are audited. Public page links are /pages/language/slug.",
    "أدر الصفحات باللغتين ورتب كتل المحتوى وعاينها ثم انشرها. تُسجل النسخ والإجراءات الحساسة. روابط الصفحات العامة هي /pages/language/slug.",
  ],
  "admin.new": ["New page", "صفحة جديدة"],
  "admin.slug": ["Page slug", "مسار الصفحة"],
  "admin.slugHelp": [
    "Lowercase letters, numbers and hyphens. Example: about-cuelance. The English and Arabic page may share a slug.",
    "استخدم حروفاً إنجليزية صغيرة وأرقاماً وشرطات. مثال: about-cuelance. يمكن للصفحتين العربية والإنجليزية مشاركة المسار.",
  ],
  "admin.status": ["Publication status", "حالة النشر"],
  "admin.draft": ["Draft", "مسودة"],
  "admin.published": ["Published", "منشور"],
  "admin.archived": ["Archived", "مؤرشف"],
  "admin.seoTitle": ["SEO title", "عنوان محركات البحث"],
  "admin.seoDescription": ["SEO description", "وصف محركات البحث"],
  "admin.addBlock": ["Add block", "إضافة كتلة"],
  "admin.blockType": ["Block type", "نوع الكتلة"],
  "admin.preview": ["Preview", "معاينة"],
  "admin.publishConfirm": [
    "Publish this page for everyone to see?",
    "هل تريد نشر الصفحة ليراها الجميع؟",
  ],
  "admin.history": ["Revision history", "سجل النسخ"],
  "admin.restore": [
    "Load this revision into editor",
    "تحميل هذه النسخة للمحرر",
  ],
  "admin.entity": ["Resource", "المورد"],
  "admin.export": ["Export this page as CSV", "تصدير هذه الصفحة بصيغة CSV"],
  "admin.confirm": [
    "Confirm this administrative action? It will be recorded in the audit log.",
    "هل تؤكد هذا الإجراء الإداري؟ سيُسجل في سجل التدقيق.",
  ],
  "admin.suspend": ["Suspend", "تعليق الحساب"],
  "admin.restoreUser": ["Restore account", "استعادة الحساب"],
  "admin.verify": ["Verify artist", "توثيق الفنان"],
  "admin.revoke": ["Revoke ticket", "سحب التذكرة"],
  "admin.role": ["Role code", "رمز الدور"],
  "admin.grant": ["Grant role", "منح الدور"],
  "admin.revokeRole": ["Remove role", "إزالة الدور"],
  "admin.json": ["Configuration JSON", "إعدادات JSON"],
  "admin.configHelp": [
    "Branding: name and tagline. Navigation: an array of label and url objects. Email templates are stored configuration; delivery requires an email provider. Do not enter secrets here.",
    "الهوية: name وtagline. التنقل: مصفوفة عناصر label وurl. قوالب البريد إعدادات محفوظة؛ الإرسال يتطلب مزود بريد. لا تدخل مفاتيح سرية هنا.",
  ],
  "pdf.download": ["Download published PDF", "تنزيل PDF المنشور"],
  "pdf.help": [
    "The PDF uses the latest published version. Save and publish new changes before downloading.",
    "يستخدم PDF أحدث نسخة منشورة. احفظ التغييرات الجديدة وانشرها قبل التنزيل.",
  ],
  "guide.newTitle": [
    "New workflows — step by step",
    "الوظائف الجديدة — خطوة بخطوة",
  ],
  "guide.full": ["Open complete user guide", "فتح دليل المستخدم الكامل"],
} satisfies Record<string, readonly [string, string]>;
type Key = keyof typeof words;
type Locale = "en" | "ar";
const Context = createContext({
  locale: "en" as Locale,
  setLocale: (_value: Locale) => {},
  t: (key: Key) => words[key][0] as string,
});
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    setLocale(localStorage.getItem("cuelance.locale") === "ar" ? "ar" : "en");
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    localStorage.setItem("cuelance.locale", locale);
  }, [locale]);
  return (
    <Context.Provider
      value={{
        locale,
        setLocale,
        t: (key) => words[key]?.[locale === "ar" ? 1 : 0] || key,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLocale() {
  return useContext(Context);
}
export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <button
      type="button"
      className="button secondary"
      lang={locale === "en" ? "ar" : "en"}
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
    >
      {locale === "en" ? "العربية" : "English"}
    </button>
  );
}
