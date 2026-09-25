# Cuelance User Guide / دليل مستخدم كيولانس

Version: implementation update, 22 September 2026.

Release note: this guide describes the new implementation. Deployment and device-level validation are pending; do not treat it as proof that the live site already contains these changes. Payments remain deferred.

# English guide

## 1. Artist profile and EPK

1. Open Artist profile. Enter stage name, genre, city, country and a factual biography. Save the profile.
2. Open EPK studio. Choose Underground, Minimal, Festival, Luxury or Experimental. Save the draft and enable the sections you need.
3. Use Media library to attach files. Return to EPK studio and Publish EPK. Open live EPK to confirm the published version.
4. Changing your profile or draft does not update the live snapshot until you publish again.

Example: Motata, Tech House, Riyadh, with a short factual career summary.

## 2. AI writing

1. Open AI writing and select the task: biography, shortening, tone, promoter/festival/brand bio, translation, grammar, SEO or career summary.
2. Enter 10–6,000 characters of source facts. Select English or Arabic and optionally describe the tone.
3. Generate draft. Review and edit every claim. Use in artist profile copies the text to the form; save the profile separately.
4. Generated text is never published automatically. If the provider is unavailable, keep editing manually. Usage is limited to 3 requests per minute and 20 per day.

Example: “Based in Riyadh; house and disco sets; Arabic and English; five years of experience.”

## 3. Media uploads

1. Open Media library and choose JPG, PNG, WebP, GIF, MP4, WebM, MP3, WAV, OGG, PDF or ZIP. Maximum file size: 25 MB.
2. Add a useful description or image alt text. Upload securely. The file is private by default and validated by the server.
3. Open temporary link previews your private asset. The link expires after 60 seconds; open a new one when needed.
4. Add to EPK asks permission to make the asset public, then attaches it to Gallery, Music, Video or Downloads. Publish the EPK to update visitors’ view.
5. Make private withdraws public access. Previously issued temporary links may remain valid until their short expiry.

Example: press-photo.jpg with alt text “Motata performing on stage in Riyadh.”

## 4. Download a PDF

1. Save and publish the EPK version you want to share.
2. Open the live EPK and choose Download published PDF. The server creates an A4 document from the published snapshot.
3. The PDF includes artist text, enabled public section content, media links, publication version and a QR link to the live EPK. Interactive media is linked rather than embedded.

Draft changes must be published before they appear in the download.

## 5. Marketplace, promoter and booking

1. An artist opens Marketplace and applies to a published opportunity after completing their profile. Duplicate applications are rejected.
2. A promoter creates an organization in Promoter desk, then creates an opportunity with a title and description.
3. The promoter reviews the Application pipeline, marks a submission viewed, shortlists it, then selects or declines it. Selecting an artist fills the opportunity and declines the other active applications.
4. Artists can withdraw eligible applications from My applications. Application transitions are validated server-side.
5. Visitors submit booking enquiries from a published EPK’s Booking form. Requests become real records in the artist workspace.
6. For private conversation support, send the booking enquiry while signed in or use an existing opportunity application.

Example: a 90-minute closing set with the event date and budget in the brief.

## 6. Events, tickets and wallet

1. Create an organization, then open Events & tickets. Enter event title, venue and start time; publish the event.
2. Select the event and add a ticket type with capacity. Set price to 0 for complimentary tickets. Paid checkout remains unavailable pending a payment provider.
3. Issue a complimentary ticket. Your Ticket wallet opens with the issued QR, event and ticket state.
4. Keep ticket QR codes private. Do not share screenshots: whoever presents a valid credential first can use it.

Example: Opening Night → General Admission → SAR 0 → capacity 100.

## 7. Camera and manual entry

1. Sign in as an organization owner, admin, manager or scanner. Open Entry scanner and select the event.
2. Choose Start camera and allow browser camera access. Point the rear camera at a Cuelance ticket QR. The camera pauses after a decoded scan.
3. Green Valid means admission was recorded. Amber Already checked in means do not admit again. Red means invalid, wrong event, revoked or cancelled.
4. Choose Start camera for the next guest. If permission is unavailable, use Show manual credential in the wallet and paste that credential in the scanner.
5. Internet is required. Do not admit based on an unvalidated offline screen. Stop camera when finished.

Validation test: scan the same ticket twice; expect Valid, then Already checked in.

## 8. Messaging

1. Open Messages. Select an application or signed-in booking from the context list, then Open conversation.
2. Write a message, up to 4,000 characters, and Send message. It persists in the conversation.
3. Only the relevant artist, booking requester and authorized promoter members have access. Removing organization access also removes conversation access.
4. Messages refresh every five seconds. Drafts are retained in the current browser session when switching conversations.

Example: “Could you confirm the set time and technical rider?”

## 9. Arabic and RTL

1. Use the العربية / English button to switch the interface direction and available translations. The browser remembers your choice.
2. AI output language is selected separately from the interface language. CMS pages also have their own language.
3. Use separate English and Arabic CMS pages with the same slug. Publish each language when ready. Artist biography translations are edited separately.

Example: /pages/en/about and /pages/ar/about.

## 10. Admin CMS and platform controls

1. Open Administration & CMS using a platform admin account. Other accounts receive Permission required.
2. Content pages: choose New page, set title, slug, language, SEO fields and draft status. Add Hero, Text, Image, CTA, FAQ or Feature grid blocks.
3. Use Move up / Move down to reorder blocks. Preview, then save a draft or choose Published and confirm. The public link opens the saved page.
4. Revision history loads an older saved revision into the editor as a draft. Review and save it to restore content.
5. Platform records: select users, artists, organizations, events, communities, tickets, orders, opportunities, pages, flags, roles, AI usage or audit logs. Search, paginate and export the visible page as CSV.
6. Authorized controls include user suspension/restoration, artist verification, ticket revocation and feature flags. Role changes require a super admin; self-escalation is prohibited. Confirm sensitive actions before saving.
7. Configuration stores branding, navigation, locales, template settings and email/notification templates. Never place API keys or passwords here. Email template storage does not itself configure email delivery.

Example: create “About Cuelance”, slug about-cuelance, add a hero and FAQ, preview, then publish.

## 11. Community and troubleshooting

1. Organizations create application-based communities. A membership request is stored as Pending; requesting access is not the same as approval.
2. Invalid login credentials: verify the exact email and password. This message does not prove an account exists or that the password is correct.
3. No verification email: use Resend once and check spam. Delivery still depends on the authentication email provider; do not repeatedly create accounts.
4. Camera blocked: use HTTPS and allow camera in browser settings, or use manual entry. Upload rejected: check format, extension and 25 MB limit.
5. Unavailable AI: save your facts and continue editing manually. Missing PDF: publish an EPK first. Permission denied: use the correct organization or request the required role.

Payments, offline admission, and automatic email delivery must not be treated as verified simply because their configuration appears in the admin area.

# الدليل العربي

## ١. ملف الفنان والملف الصحفي

1. افتح ملف الفنان وأدخل الاسم الفني والنوع الموسيقي والمدينة والدولة ونبذة موثوقة. احفظ الملف.
2. افتح استوديو الملف الصحفي واختر أحد القوالب الخمسة. احفظ المسودة وفعّل الأقسام المطلوبة.
3. استخدم مكتبة الوسائط لإرفاق الملفات. عد للاستوديو وانشر الملف الصحفي ثم افتح النسخة المنشورة للتحقق.
4. تعديل الملف أو المسودة لا يغير النسخة العامة حتى تنشر مجدداً.

مثال: موتاتا، تيك هاوس، الرياض، مع ملخص قصير وموثوق للمسيرة.

## ٢. الكتابة بالذكاء الاصطناعي

1. افتح الكتابة بالذكاء الاصطناعي واختر المهمة: نبذة أو اختصار أو أسلوب أو ترجمة أو تصحيح أو وصف لمحركات البحث أو ملخص مسيرة.
2. أدخل من 10 إلى 6000 حرف من الحقائق واختر العربية أو الإنجليزية والأسلوب إن رغبت.
3. أنشئ المسودة ثم راجع كل معلومة وعدّلها. استخدام في ملف الفنان ينقل النص للنموذج؛ احفظ الملف بشكل منفصل.
4. لا يُنشر النص تلقائياً. عند تعذر المزود تابع التحرير يدوياً. الحد 3 طلبات في الدقيقة و20 يومياً.

مثال: «مقيم بالرياض؛ يقدم الهاوس والديسكو؛ يتحدث العربية والإنجليزية؛ خبرة خمس سنوات».

## ٣. رفع الوسائط

1. افتح مكتبة الوسائط واختر ملفاً من الصيغ المدعومة، بحد أقصى 25 ميغابايت.
2. أضف وصفاً مفيداً أو نصاً بديلاً للصورة ثم ارفع بأمان. الملف خاص افتراضياً ويتحقق الخادم من محتواه.
3. فتح رابط مؤقت يعاين ملفك الخاص. ينتهي الرابط بعد 60 ثانية؛ افتح رابطاً جديداً عند الحاجة.
4. إضافة للملف الصحفي تطلب الإذن بإتاحة الملف للعامة، ثم تضيفه للمعرض أو الموسيقى أو الفيديو أو التنزيلات. انشر الملف الصحفي لتحديث العرض العام.
5. جعل الملف خاصاً يسحب الوصول العام. قد تعمل الروابط المؤقتة السابقة حتى انتهاء مدتها القصيرة.

مثال: press-photo.jpg بوصف «موتاتا يقدم عرضاً على المسرح بالرياض».

## ٤. تنزيل PDF

1. احفظ وانشر نسخة الملف الصحفي التي تريد مشاركتها.
2. افتح الملف المنشور واختر تنزيل PDF المنشور. ينشئ الخادم مستند A4 من النسخة المنشورة.
3. يتضمن PDF نص الفنان ومحتوى الأقسام العامة المفعلة وروابط الوسائط ورقم النسخة ورمز QR للملف العام. تُربط الوسائط التفاعلية بدلاً من تضمينها.

يجب نشر تغييرات المسودة قبل ظهورها في التنزيل.

## ٥. الفرص والمروج والحجز

1. يفتح الفنان سوق الفرص ويتقدم لفرصة منشورة بعد إكمال ملفه. لا تُقبل الطلبات المكررة.
2. ينشئ المروج مؤسسة في مكتب المروج ثم ينشئ فرصة بعنوان ووصف.
3. يرسل الزوار استفسار حجز من نموذج الحجز في الملف الصحفي المنشور. تظهر الطلبات كسجلات فعلية للفنان.
4. للمحادثة الخاصة، أرسل استفسار الحجز أثناء تسجيل الدخول أو استخدم طلب فرصة موجوداً.

مثال: فقرة ختامية مدتها 90 دقيقة مع تاريخ الفعالية والميزانية في الملخص.

## ٦. الفعاليات والتذاكر والمحفظة

1. أنشئ مؤسسة ثم افتح الفعاليات والتذاكر. أدخل العنوان والمكان وموعد البداية وانشر الفعالية.
2. اختر الفعالية وأضف نوع تذكرة بسعة محددة. اجعل السعر صفراً للتذاكر المجانية. الدفع غير متاح حتى ربط مزود دفع.
3. أصدر تذكرة مجانية. تفتح المحفظة وتعرض الرمز والفعالية وحالة التذكرة.
4. حافظ على خصوصية الرمز ولا تشارك صورته؛ أول من يقدم الاعتماد الصالح يمكنه استخدامه.

مثال: ليلة الافتتاح ← دخول عام ← 0 ريال ← سعة 100.

## ٧. الكاميرا والإدخال اليدوي

1. سجل الدخول كمالك أو مسؤول أو مدير أو ماسح في المؤسسة. افتح ماسح الدخول واختر الفعالية.
2. اختر تشغيل الكاميرا واسمح باستخدامها. وجّه الكاميرا الخلفية إلى رمز التذكرة. تتوقف الكاميرا بعد قراءة الرمز.
3. الأخضر يعني تسجيل الدخول. الكهرماني يعني أن الدخول سُجل سابقاً فلا تسمح بالدخول مجدداً. الأحمر يعني رمزاً غير صالح أو فعالية مختلفة أو تذكرة مسحوبة أو ملغاة.
4. شغّل الكاميرا للضيف التالي. إذا تعذرت الصلاحية، أظهر رمز الإدخال اليدوي في المحفظة وألصقه في الماسح.
5. الاتصال بالإنترنت مطلوب. لا تسمح بالدخول بناءً على شاشة غير متحققة دون اتصال. أوقف الكاميرا عند الانتهاء.

اختبار التحقق: امسح التذكرة مرتين؛ المتوقع صالح ثم تم الدخول سابقاً.

## ٨. الرسائل

1. افتح الرسائل واختر طلب فرصة أو حجزاً لمستخدم مسجل ثم افتح المحادثة.
2. اكتب رسالة حتى 4000 حرف ثم أرسلها. تُحفظ في المحادثة.
3. الوصول للفنان المعني وطالب الحجز وأعضاء المروج المخولين فقط. إزالة صلاحية المؤسسة تزيل وصول المحادثة أيضاً.
4. تُحدّث الرسائل كل خمس ثوانٍ. تبقى المسودات في جلسة المتصفح عند تبديل المحادثات.

مثال: «هل يمكنك تأكيد وقت الفقرة والمتطلبات التقنية؟»

## ٩. العربية والاتجاه من اليمين

1. استخدم زر العربية / English لتبديل اتجاه الواجهة والترجمة. يتذكر المتصفح اختيارك.
2. لغة مخرجات الذكاء الاصطناعي مستقلة عن لغة الواجهة. لصفحات المحتوى لغتها الخاصة أيضاً.
3. أنشئ صفحتين عربية وإنجليزية بالمسار نفسه وانشر كل لغة عند جاهزيتها. تُحرر ترجمات نبذة الفنان بشكل منفصل.

مثال: /pages/en/about و/pages/ar/about.

## ١٠. إدارة المحتوى والمنصة

1. افتح الإدارة والمحتوى بحساب مسؤول منصة. تظهر رسالة طلب الصلاحية للحسابات الأخرى.
2. صفحات المحتوى: أنشئ صفحة وحدد العنوان والمسار واللغة وحقول محركات البحث وحالة المسودة. أضف كتل الغلاف أو النص أو الصورة أو الدعوة للإجراء أو الأسئلة أو الميزات.
3. رتب الكتل لأعلى أو لأسفل وعاين الصفحة. احفظ مسودة أو اختر منشوراً وأكد. يفتح الرابط العام الصفحة المحفوظة.
4. سجل النسخ يحمل نسخة سابقة إلى المحرر كمسودة. راجعها واحفظها لاستعادة المحتوى.
5. سجلات المنصة: اختر المستخدمين أو الفنانين أو المؤسسات أو الفعاليات أو المجتمعات أو التذاكر أو الطلبات أو الفرص أو الصفحات أو الميزات أو الأدوار أو استخدام الذكاء الاصطناعي أو التدقيق. ابحث وتصفح وصدّر الصفحة الحالية بصيغة CSV.
6. تشمل الضوابط تعليق الحساب واستعادته وتوثيق الفنان وسحب التذكرة وتبديل الميزات. تغيير الأدوار يحتاج مسؤولاً أعلى؛ رفع صلاحياتك ذاتياً ممنوع. أكد الإجراءات الحساسة قبل تنفيذها.
7. تحفظ الإعدادات الهوية والتنقل واللغات وإعدادات القوالب وقوالب البريد والإشعارات. لا تضع مفاتيح أو كلمات مرور هنا. تخزين قوالب البريد لا يضبط خدمة الإرسال تلقائياً.

مثال: أنشئ «عن كيولانس» بمسار about-cuelance، وأضف غلافاً وأسئلة شائعة وعاين ثم انشر.

## ١١. المجتمع وحل المشكلات

1. تنشئ المؤسسات مجتمعات بطلب انضمام. يُحفظ الطلب قيد الانتظار؛ الطلب ليس موافقة.
2. بيانات دخول غير صالحة: تحقق من البريد وكلمة المرور حرفياً. الرسالة لا تثبت وجود الحساب أو صحة كلمة المرور.
3. لم يصل بريد التحقق: أعد الإرسال مرة وتحقق من الرسائل غير المرغوبة. يعتمد التسليم على مزود بريد المصادقة؛ لا تنشئ حسابات متكررة.
4. الكاميرا محظورة: استخدم HTTPS واسمح بالكاميرا أو أدخل الرمز يدوياً. رُفض الرفع: تحقق من الصيغة والامتداد وحد 25 ميغابايت.
5. الذكاء الاصطناعي غير متاح: احتفظ بالحقائق وتابع يدوياً. PDF مفقود: انشر ملفاً صحفياً أولاً. رُفض الإذن: استخدم المؤسسة الصحيحة أو اطلب الدور المطلوب.

لا تعتبر الدفع أو الدخول دون اتصال أو إرسال البريد تلقائياً وظائف متحققة لمجرد ظهور إعداداتها في الإدارة.

## Public pages, marketplace and event artwork (25 September 2026)

Select Artist, Promoter, Venue, Community, Agency, Production, Vendor or Event professional. Open **Your public page**. Enter a unique lowercase page address, display name, headline, location and biography. Upload a cover image and optional avatar/logo (JPG, PNG, WebP; 10 MB maximum). These uploads are explicitly public. Save, then publish. A cover and at least 20 characters of biography are required. Your page lives at `/p/<slug>` and appears in `/marketplace`.

Add **Services & products**, including rentals and experiences. Enter a description, starting price in SAR and an image; enable Publish offering and save. Published pages and active offerings use the same database records in the public directory. Unpublishing removes both from public discovery. Changing a slug invalidates the old link. Session drafts are recovered when returning to the page editor; Save persists them across devices.

Visitors can send an inquiry after signing in. The provider sees it under Your public page and can save a response and mark it contacted or closed. Customers use **My inquiries** to read responses. Requests are limited to 20/hour/account. Inquiries do not create a paid order or confirm a booking.

In **Events & tickets**, upload an event cover and enter a description. The cover appears on the public `/events/<slug>` page and the attendee's ticket. Public event pages support complimentary reservations with the existing inventory-protected ticket service. Paid checkout remains unavailable until a provider is configured.

The **Ticket wallet** shows artwork, event-local date/time, venue, status and the actual issued credential. Only active/issued tickets display an admission QR. Used, cancelled, revoked and refunded passes do not. Print produces a paper pass; staff must still validate it online, including duplicate-entry checks.

Provider identity categories describe services; they do not grant platform roles, administration privileges or organization membership. Customer workspaces do not need a public business page. Account ownership and row-level permissions apply to every save.
