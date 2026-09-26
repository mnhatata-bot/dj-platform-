"use client";
import { LanguageSwitch, useLocale } from "@/modules/localization/ui/provider";
const workflows = [
 {en:"Public provider pages and marketplace",ar:"صفحات مقدمي الخدمات والسوق",
 enSteps:["Choose Artist, Promoter, Venue, Community, Agency, Production, Vendor or Event professional in the workspace switcher. Open Your public page. Switching a workspace does not grant permissions.","Enter a display name, page address, headline, city and biography. Upload a cover and optional logo. JPG, PNG and WebP up to 10 MB are supported. Uploaded images become public.","Save, then Publish page. A cover and at least 20 characters of biography are required. Your page is available at /p/your-address and listed in /marketplace.","Add services, products, rentals or experiences with images and SAR starting prices. Check Publish offering and save. Active offerings appear on your page and in the marketplace while the page is published.","Review inquiries under Your public page. Save a response for the customer and update the status. Customers see their requests and replies under My inquiries. An inquiry does not confirm a booking or collect payment.","Unpublish the page to remove it and its offerings from public discovery. Draft form changes are retained for this browser session; use Save to persist them to your account."],
 arSteps:["اختر نوع مساحة العمل ثم افتح صفحتك العامة. تغيير المساحة لا يمنح صلاحيات إضافية.","أدخل الاسم والعنوان والنشاط والمدينة والنبذة. ارفع غلافاً وشعاراً اختيارياً بصيغة JPG أو PNG أو WebP حتى ١٠ ميغابايت. تصبح الصور عامة.","احفظ ثم انشر. يلزم غلاف ونبذة من ٢٠ حرفاً على الأقل. تظهر الصفحة في /p/your-address والسوق في /marketplace.","أضف الخدمات أو المنتجات أو التأجير أو التجارب بالصور والسعر بالريال. فعّل نشر العرض واحفظه ليظهر في الصفحة والسوق.","راجع الاستفسارات واحفظ الرد للعميل. يرى العميل ردك في استفساراتي. لا يؤكد الاستفسار حجزاً ولا يجمع دفعة.","إلغاء النشر يخفي الصفحة والعروض من الزوار. تحتفظ جلسة المتصفح بتعديلات النموذج؛ اضغط حفظ لتثبيتها في حسابك."],
 example:["Example: Riyadh Sound → sound-system rental → customer inquiry → provider response.","مثال: صوت الرياض ← تأجير نظام صوت ← استفسار العميل ← رد مقدم الخدمة."]},
 {en:"Event posters and ticket passes",ar:"صور الفعاليات وتصاريح الدخول",
 enSteps:["In Events & tickets, add a title, venue, local date, event description and cover photo, then publish.","Open the event card to see the public /events/address page. Share this page with attendees.","Activate ticket types. Customers sign in and reserve a complimentary ticket from the event page. Paid checkout stays unavailable until a payment provider is connected.","Open Ticket wallet. Each pass shows the event cover, venue, date in the event timezone, status and secure QR. Use Print ticket for a paper copy.","Keep the QR private. Checked-in, cancelled, refunded and revoked tickets do not display an admission QR. Staff still validate every admission online."],
 arSteps:["أضف العنوان والمكان والتاريخ والوصف والغلاف في الفعاليات والتذاكر ثم انشر.","افتح بطاقة الفعالية لعرض صفحتها العامة ومشاركتها مع الحضور.","فعّل أنواع التذاكر. يسجل العميل الدخول ويحجز تذكرة مجانية من صفحة الفعالية. الدفع غير متاح حتى ربط مزود الدفع.","افتح محفظة التذاكر لعرض الغلاف والمكان والتوقيت والحالة والرمز. استخدم طباعة التذكرة لنسخة ورقية.","حافظ على خصوصية الرمز. لا تعرض التذاكر المستخدمة أو الملغاة أو المستردة أو المسحوبة رمز دخول. يتحقق الموظف من الدخول عبر الإنترنت."],
 example:["Example: Upload an event poster once; it appears on the event page and the attendee's ticket.","مثال: ارفع ملصق الفعالية مرة واحدة ليظهر في صفحتها وتذكرة الحضور."]},
 {en:"Plans, usage and access",ar:"الخطط والاستخدام والصلاحيات",
 enSteps:["Open Plan & access from any workspace. The selected organization is used when one is active; otherwise the page shows your account plan.","Review the server-enforced limits for templates, publication versions, AI, storage, organizations, team members, marketplace, communities, ticketing, analytics and custom domains.","Usage counters show consumption such as AI requests today. An expired plan automatically falls back to Cuelance Free without deleting profiles, media, EPKs or operational records.","Paid plan buttons remain disabled until Cuelance connects an approved payment provider. Platform administrators can assign a trial or plan through the protected subscription service, and every change is audited."],
 arSteps:["افتح الخطط والصلاحيات من أي مساحة عمل. عند اختيار مؤسسة تظهر خطتها، وإلا تظهر خطة حسابك.","راجع الحدود التي يفرضها الخادم للقوالب ونسخ النشر والذكاء الاصطناعي والتخزين والمؤسسات وأعضاء الفريق والسوق والمجتمعات والتذاكر والتحليلات والنطاق المخصص.","تعرض مؤشرات الاستخدام الاستهلاك مثل طلبات الذكاء الاصطناعي اليوم. تعود الخطة المنتهية تلقائياً إلى المجانية من دون حذف الملفات أو الوسائط أو السجلات.","تبقى أزرار الدفع معطلة حتى ربط مزود دفع معتمد. يمكن لمسؤول المنصة تعيين تجربة أو خطة عبر خدمة محمية، ويسجل كل تغيير في سجل التدقيق."],
 example:["Example: Artist Pro shows five EPK templates, 100 daily AI requests and advanced analytics.","مثال: تعرض خطة الفنان الاحترافية خمسة قوالب و100 طلب ذكاء اصطناعي يومياً وتحليلات متقدمة."]},

  {
    en: "1. Artist profile and EPK",
    ar: "١. ملف الفنان والملف الصحفي",
    enSteps: [
      "Open Artist profile. Enter stage name, genre, city, country and a factual biography. Save the profile.",
      "Open EPK studio. Choose Underground, Minimal, Festival, Luxury or Experimental, then create or save the EPK.",
      "Open each content section and complete the guided hero, biography, music, video, gallery, highlights, press, events, social, downloads, rider and booking fields.",
      "Enter structured details as Label | Value and active links as Label | https://..., one item per line. Set each section to public or private.",
      "Complete the technical and hospitality rider: setup, mixer, decks, monitors, microphones, stage, power, connections, soundcheck, set duration, changeover, hospitality, travel, accommodation, guest list and contacts.",
      "Use Media library to attach photography, audio, video, PDF and ZIP files. Publish, then inspect both the live EPK and generated PDF.",
      "Changing your profile or draft does not update the live snapshot until you publish again.",
    ],
    arSteps: [
      "افتح ملف الفنان وأدخل الاسم الفني والنوع الموسيقي والمدينة والدولة ونبذة موثوقة. احفظ الملف.",
      "افتح استوديو الملف الصحفي واختر أحد القوالب الخمسة. احفظ المسودة وفعّل الأقسام المطلوبة.",
      "استخدم مكتبة الوسائط لإرفاق الملفات. عد للاستوديو وانشر الملف الصحفي ثم افتح النسخة المنشورة للتحقق.",
      "تعديل الملف أو المسودة لا يغير النسخة العامة حتى تنشر مجدداً.",
    ],
    example: [
      "Example: Motata, Tech House, Riyadh, with a short factual career summary.",
      "مثال: موتاتا، تيك هاوس، الرياض، مع ملخص قصير وموثوق للمسيرة.",
    ],
  },
  {
    en: "2. AI writing",
    ar: "٢. الكتابة بالذكاء الاصطناعي",
    enSteps: [
      "Open AI writing and select the task: biography, shortening, tone, promoter/festival/brand bio, translation, grammar, SEO or career summary.",
      "Enter 10–6,000 characters of source facts. Select English or Arabic and optionally describe the tone.",
      "Generate draft. Review and edit every claim. Use in artist profile copies the text to the form; save the profile separately.",
      "Generated text is never published automatically. If the provider is unavailable, keep editing manually. Usage is limited to 3 requests per minute and the daily allowance shown in Plan & access.",
    ],
    arSteps: [
      "افتح الكتابة بالذكاء الاصطناعي واختر المهمة: نبذة أو اختصار أو أسلوب أو ترجمة أو تصحيح أو وصف لمحركات البحث أو ملخص مسيرة.",
      "أدخل من 10 إلى 6000 حرف من الحقائق واختر العربية أو الإنجليزية والأسلوب إن رغبت.",
      "أنشئ المسودة ثم راجع كل معلومة وعدّلها. استخدام في ملف الفنان ينقل النص للنموذج؛ احفظ الملف بشكل منفصل.",
      "لا يُنشر النص تلقائياً. عند تعذر المزود تابع التحرير يدوياً. الحد 3 طلبات في الدقيقة والحد اليومي الظاهر في الخطط والصلاحيات.",
    ],
    example: [
      "Example: “Based in Riyadh; house and disco sets; Arabic and English; five years of experience.”",
      "مثال: «مقيم بالرياض؛ يقدم الهاوس والديسكو؛ يتحدث العربية والإنجليزية؛ خبرة خمس سنوات».",
    ],
  },
  {
    en: "3. Media uploads",
    ar: "٣. رفع الوسائط",
    enSteps: [
      "Open Media library and choose JPG, PNG, WebP, GIF, MP4, WebM, MP3, WAV, OGG, PDF or ZIP. Maximum file size: 25 MB.",
      "Add a useful description or image alt text. Upload securely. The file is private by default and validated by the server.",
      "Open temporary link previews your private asset. The link expires after 60 seconds; open a new one when needed.",
      "Add to EPK asks permission to make the asset public, then attaches it to Gallery, Music, Video or Downloads. Publish the EPK to update visitors’ view.",
      "Make private withdraws public access. Previously issued temporary links may remain valid until their short expiry.",
    ],
    arSteps: [
      "افتح مكتبة الوسائط واختر ملفاً من الصيغ المدعومة، بحد أقصى 25 ميغابايت.",
      "أضف وصفاً مفيداً أو نصاً بديلاً للصورة ثم ارفع بأمان. الملف خاص افتراضياً ويتحقق الخادم من محتواه.",
      "فتح رابط مؤقت يعاين ملفك الخاص. ينتهي الرابط بعد 60 ثانية؛ افتح رابطاً جديداً عند الحاجة.",
      "إضافة للملف الصحفي تطلب الإذن بإتاحة الملف للعامة، ثم تضيفه للمعرض أو الموسيقى أو الفيديو أو التنزيلات. انشر الملف الصحفي لتحديث العرض العام.",
      "جعل الملف خاصاً يسحب الوصول العام. قد تعمل الروابط المؤقتة السابقة حتى انتهاء مدتها القصيرة.",
    ],
    example: [
      "Example: press-photo.jpg with alt text “Motata performing on stage in Riyadh.”",
      "مثال: press-photo.jpg بوصف «موتاتا يقدم عرضاً على المسرح بالرياض».",
    ],
  },
  {
    en: "4. Download a PDF",
    ar: "٤. تنزيل PDF",
    enSteps: [
      "Save and publish the EPK version you want to share.",
      "Open the live EPK and choose Download published PDF. The server creates an A4 document from the published snapshot.",
      "The PDF includes artist text, enabled public section content, media links, publication version and a QR link to the live EPK. Interactive media is linked rather than embedded.",
    ],
    arSteps: [
      "احفظ وانشر نسخة الملف الصحفي التي تريد مشاركتها.",
      "افتح الملف المنشور واختر تنزيل PDF المنشور. ينشئ الخادم مستند A4 من النسخة المنشورة.",
      "يتضمن PDF نص الفنان ومحتوى الأقسام العامة المفعلة وروابط الوسائط ورقم النسخة ورمز QR للملف العام. تُربط الوسائط التفاعلية بدلاً من تضمينها.",
    ],
    example: [
      "Draft changes must be published before they appear in the download.",
      "يجب نشر تغييرات المسودة قبل ظهورها في التنزيل.",
    ],
  },
  {
    en: "5. Marketplace, promoter and booking",
    ar: "٥. الفرص والمروج والحجز",
    enSteps: [
      "An artist opens Marketplace and applies to a published opportunity after completing their profile. Duplicate applications are rejected.",
      "A promoter creates an organization in Promoter desk, then creates an opportunity with a title and description.",
      "The promoter reviews the Application pipeline: mark a submission viewed, shortlist it, then select or decline it. Selecting one artist fills the opportunity and closes the remaining active applications.",
      "Artists can withdraw their own submitted, viewed or shortlisted application from My applications. Every transition is validated by the server.",
      "Visitors submit booking enquiries from a published EPK’s Booking form. Requests become real records in the artist workspace.",
      "The artist opens Booking requests and moves each enquiry through New, Contacted, Negotiating, Confirmed and Completed. Declined and cancelled enquiries remain visible in Closed.",
      "For private conversation support, send the booking enquiry while signed in or use an existing opportunity application.",
    ],
    arSteps: [
      "يفتح الفنان سوق الفرص ويتقدم لفرصة منشورة بعد إكمال ملفه. لا تُقبل الطلبات المكررة.",
      "ينشئ المروج مؤسسة في مكتب المروج ثم ينشئ فرصة بعنوان ووصف.",
      "يراجع المروج مسار الطلبات: يعرض الطلب ثم يضيفه للقائمة المختصرة وبعدها يختار الفنان أو يرفض الطلب. اختيار فنان يملأ الفرصة ويغلق الطلبات النشطة الأخرى.",
      "يمكن للفنان سحب طلبه المرسل أو المعروض أو المدرج في القائمة المختصرة. يتحقق الخادم من كل انتقال.",
      "يرسل الزوار استفسار حجز من نموذج الحجز في الملف الصحفي المنشور. تظهر الطلبات كسجلات فعلية للفنان.",
      "يفتح الفنان طلبات الحجز وينقل كل طلب عبر جديد، تم التواصل، تفاوض، مؤكد، ومكتمل. تبقى الطلبات المرفوضة والملغاة ظاهرة في المغلق.",
      "للمحادثة الخاصة، أرسل استفسار الحجز أثناء تسجيل الدخول أو استخدم طلب فرصة موجوداً.",
    ],
    example: [
      "Example: a 90-minute closing set with the event date and budget in the brief.",
      "مثال: فقرة ختامية مدتها 90 دقيقة مع تاريخ الفعالية والميزانية في الملخص.",
    ],
  },
  {
    en: "6. Events, tickets and wallet",
    ar: "٦. الفعاليات والتذاكر والمحفظة",
    enSteps: [
      "Create an organization, then open Events & tickets. Enter event title, venue and start time; publish the event.",
      "Select the event and add a ticket type with capacity. Set price to 0 for complimentary tickets. Paid checkout remains unavailable pending a payment provider.",
      "Issue a complimentary ticket. Your Ticket wallet opens with the issued QR, event and ticket state.",
      "Keep ticket QR codes private. Do not share screenshots: whoever presents a valid credential first can use it.",
    ],
    arSteps: [
      "أنشئ مؤسسة ثم افتح الفعاليات والتذاكر. أدخل العنوان والمكان وموعد البداية وانشر الفعالية.",
      "اختر الفعالية وأضف نوع تذكرة بسعة محددة. اجعل السعر صفراً للتذاكر المجانية. الدفع غير متاح حتى ربط مزود دفع.",
      "أصدر تذكرة مجانية. تفتح المحفظة وتعرض الرمز والفعالية وحالة التذكرة.",
      "حافظ على خصوصية الرمز ولا تشارك صورته؛ أول من يقدم الاعتماد الصالح يمكنه استخدامه.",
    ],
    example: [
      "Example: Opening Night → General Admission → SAR 0 → capacity 100.",
      "مثال: ليلة الافتتاح ← دخول عام ← 0 ريال ← سعة 100.",
    ],
  },
  {
    en: "7. Camera and manual entry",
    ar: "٧. الكاميرا والإدخال اليدوي",
    enSteps: [
      "Sign in as an organization owner, admin, manager or scanner. Open Entry scanner and select the event.",
      "Choose Start camera and allow browser camera access. Point the rear camera at a Cuelance ticket QR. The camera pauses after a decoded scan.",
      "Green Valid means admission was recorded. Amber Already checked in means do not admit again. Red means invalid, wrong event, revoked or cancelled.",
      "Choose Start camera for the next guest. If permission is unavailable, use Show manual credential in the wallet and paste that credential in the scanner.",
      "Internet is required. Do not admit based on an unvalidated offline screen. Stop camera when finished.",
    ],
    arSteps: [
      "سجل الدخول كمالك أو مسؤول أو مدير أو ماسح في المؤسسة. افتح ماسح الدخول واختر الفعالية.",
      "اختر تشغيل الكاميرا واسمح باستخدامها. وجّه الكاميرا الخلفية إلى رمز التذكرة. تتوقف الكاميرا بعد قراءة الرمز.",
      "الأخضر يعني تسجيل الدخول. الكهرماني يعني أن الدخول سُجل سابقاً فلا تسمح بالدخول مجدداً. الأحمر يعني رمزاً غير صالح أو فعالية مختلفة أو تذكرة مسحوبة أو ملغاة.",
      "شغّل الكاميرا للضيف التالي. إذا تعذرت الصلاحية، أظهر رمز الإدخال اليدوي في المحفظة وألصقه في الماسح.",
      "الاتصال بالإنترنت مطلوب. لا تسمح بالدخول بناءً على شاشة غير متحققة دون اتصال. أوقف الكاميرا عند الانتهاء.",
    ],
    example: [
      "Validation test: scan the same ticket twice; expect Valid, then Already checked in.",
      "اختبار التحقق: امسح التذكرة مرتين؛ المتوقع صالح ثم تم الدخول سابقاً.",
    ],
  },
  {
    en: "8. Messaging",
    ar: "٨. الرسائل",
    enSteps: [
      "Open Messages. Select an application or signed-in booking from the context list, then Open conversation.",
      "Write a message, up to 4,000 characters, and Send message. It persists in the conversation.",
      "Only the relevant artist, booking requester and authorized promoter members have access. Removing organization access also removes conversation access.",
      "Messages refresh every five seconds. Drafts are retained in the current browser session when switching conversations.",
    ],
    arSteps: [
      "افتح الرسائل واختر طلب فرصة أو حجزاً لمستخدم مسجل ثم افتح المحادثة.",
      "اكتب رسالة حتى 4000 حرف ثم أرسلها. تُحفظ في المحادثة.",
      "الوصول للفنان المعني وطالب الحجز وأعضاء المروج المخولين فقط. إزالة صلاحية المؤسسة تزيل وصول المحادثة أيضاً.",
      "تُحدّث الرسائل كل خمس ثوانٍ. تبقى المسودات في جلسة المتصفح عند تبديل المحادثات.",
    ],
    example: [
      "Example: “Could you confirm the set time and technical rider?”",
      "مثال: «هل يمكنك تأكيد وقت الفقرة والمتطلبات التقنية؟»",
    ],
  },
  {
    en: "9. Arabic and RTL",
    ar: "٩. العربية والاتجاه من اليمين",
    enSteps: [
      "Use the العربية / English button to switch the interface direction and available translations. The browser remembers your choice.",
      "AI output language is selected separately from the interface language. CMS pages also have their own language.",
      "Use separate English and Arabic CMS pages with the same slug. Publish each language when ready. Artist biography translations are edited separately.",
    ],
    arSteps: [
      "استخدم زر العربية / English لتبديل اتجاه الواجهة والترجمة. يتذكر المتصفح اختيارك.",
      "لغة مخرجات الذكاء الاصطناعي مستقلة عن لغة الواجهة. لصفحات المحتوى لغتها الخاصة أيضاً.",
      "أنشئ صفحتين عربية وإنجليزية بالمسار نفسه وانشر كل لغة عند جاهزيتها. تُحرر ترجمات نبذة الفنان بشكل منفصل.",
    ],
    example: [
      "Example: /pages/en/about and /pages/ar/about.",
      "مثال: /pages/en/about و/pages/ar/about.",
    ],
  },
  {
    en: "10. Admin CMS and platform controls",
    ar: "١٠. إدارة المحتوى والمنصة",
    enSteps: [
      "Open Administration & CMS using a platform admin account. Other accounts receive Permission required.",
      "Content pages: choose New page, set title, slug, language, SEO fields and draft status. Add Hero, Text, Image, CTA, FAQ or Feature grid blocks.",
      "Use Move up / Move down to reorder blocks. Preview, then save a draft or choose Published and confirm. The public link opens the saved page.",
      "Revision history loads an older saved revision into the editor as a draft. Review and save it to restore content.",
      "Platform records: select users, artists, organizations, events, communities, tickets, orders, opportunities, pages, flags, roles, AI usage or audit logs. Search, paginate and export the visible page as CSV.",
      "Authorized controls include user suspension/restoration, artist verification, ticket revocation and feature flags. Role changes require a super admin; self-escalation is prohibited. Confirm sensitive actions before saving.",
      "Configuration stores branding, navigation, locales, template settings and email/notification templates. Never place API keys or passwords here. Email template storage does not itself configure email delivery.",
    ],
    arSteps: [
      "افتح الإدارة والمحتوى بحساب مسؤول منصة. تظهر رسالة طلب الصلاحية للحسابات الأخرى.",
      "صفحات المحتوى: أنشئ صفحة وحدد العنوان والمسار واللغة وحقول محركات البحث وحالة المسودة. أضف كتل الغلاف أو النص أو الصورة أو الدعوة للإجراء أو الأسئلة أو الميزات.",
      "رتب الكتل لأعلى أو لأسفل وعاين الصفحة. احفظ مسودة أو اختر منشوراً وأكد. يفتح الرابط العام الصفحة المحفوظة.",
      "سجل النسخ يحمل نسخة سابقة إلى المحرر كمسودة. راجعها واحفظها لاستعادة المحتوى.",
      "سجلات المنصة: اختر المستخدمين أو الفنانين أو المؤسسات أو الفعاليات أو المجتمعات أو التذاكر أو الطلبات أو الفرص أو الصفحات أو الميزات أو الأدوار أو استخدام الذكاء الاصطناعي أو التدقيق. ابحث وتصفح وصدّر الصفحة الحالية بصيغة CSV.",
      "تشمل الضوابط تعليق الحساب واستعادته وتوثيق الفنان وسحب التذكرة وتبديل الميزات. تغيير الأدوار يحتاج مسؤولاً أعلى؛ رفع صلاحياتك ذاتياً ممنوع. أكد الإجراءات الحساسة قبل تنفيذها.",
      "تحفظ الإعدادات الهوية والتنقل واللغات وإعدادات القوالب وقوالب البريد والإشعارات. لا تضع مفاتيح أو كلمات مرور هنا. تخزين قوالب البريد لا يضبط خدمة الإرسال تلقائياً.",
    ],
    example: [
      "Example: create “About Cuelance”, slug about-cuelance, add a hero and FAQ, preview, then publish.",
      "مثال: أنشئ «عن كيولانس» بمسار about-cuelance، وأضف غلافاً وأسئلة شائعة وعاين ثم انشر.",
    ],
  },
  {
    en: "11. Community and troubleshooting",
    ar: "١١. المجتمع وحل المشكلات",
    enSteps: [
      "Organizations create application-based communities. A membership request is stored as Pending; requesting access is not the same as approval.",
      "Invalid login credentials: verify the exact email and password. This message does not prove an account exists or that the password is correct.",
      "No verification email: use Resend once and check spam. Delivery still depends on the authentication email provider; do not repeatedly create accounts.",
      "Camera blocked: use HTTPS and allow camera in browser settings, or use manual entry. Upload rejected: check format, extension and 25 MB limit.",
      "Unavailable AI: save your facts and continue editing manually. Missing PDF: publish an EPK first. Permission denied: use the correct organization or request the required role.",
    ],
    arSteps: [
      "تنشئ المؤسسات مجتمعات بطلب انضمام. يُحفظ الطلب قيد الانتظار؛ الطلب ليس موافقة.",
      "بيانات دخول غير صالحة: تحقق من البريد وكلمة المرور حرفياً. الرسالة لا تثبت وجود الحساب أو صحة كلمة المرور.",
      "لم يصل بريد التحقق: أعد الإرسال مرة وتحقق من الرسائل غير المرغوبة. يعتمد التسليم على مزود بريد المصادقة؛ لا تنشئ حسابات متكررة.",
      "الكاميرا محظورة: استخدم HTTPS واسمح بالكاميرا أو أدخل الرمز يدوياً. رُفض الرفع: تحقق من الصيغة والامتداد وحد 25 ميغابايت.",
      "الذكاء الاصطناعي غير متاح: احتفظ بالحقائق وتابع يدوياً. PDF مفقود: انشر ملفاً صحفياً أولاً. رُفض الإذن: استخدم المؤسسة الصحيحة أو اطلب الدور المطلوب.",
    ],
    example: [
      "Payments, offline admission, and automatic email delivery must not be treated as verified simply because their configuration appears in the admin area.",
      "لا تعتبر الدفع أو الدخول دون اتصال أو إرسال البريد تلقائياً وظائف متحققة لمجرد ظهور إعداداتها في الإدارة.",
    ],
  },
];
export default function CompleteGuide() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  return (
    <main className="full-guide">
      <header className="actions">
        <a className="button" href="/workspace">
          {ar ? "فتح مساحة العمل" : "Open workspace"}
        </a>
        <LanguageSwitch />
      </header>
      <h1>{ar ? "دليل مستخدم كيولانس" : "Cuelance user guide"}</h1>
      <p>
        {ar
          ? "اتبع الخطوات بالترتيب. الحفظ والنشر عمليتان منفصلتان؛ تحقق دائماً من النتيجة العامة بعد النشر."
          : "Follow the steps in order. Saving and publishing are separate actions; always check the public result after publishing."}
      </p>
      <nav className="guide-grid">
        {workflows.map((w, i) => (
          <a className="guide-link" key={w.en} href={`#workflow-${i}`}>
            {ar ? w.ar : w.en}
          </a>
        ))}
      </nav>
      {workflows.map((w, i) => (
        <section
          className="card"
          id={`workflow-${i}`}
          key={w.en}
          style={{ marginBlock: 24 }}
        >
          <h2>{ar ? w.ar : w.en}</h2>
          <ol className="guide-steps">
            {(ar ? w.arSteps : w.enSteps).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="guide-example">{w.example[ar ? 1 : 0]}</p>
        </section>
      ))}
    </main>
  );
}
