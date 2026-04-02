Hədəf

Məqsədimiz CV update axınını text extraction tool-dan çıxarıb high-fidelity document editing pipeline-a çevirməkdir. Əsas prinsip belə olmalıdır:

Analysis üçün plain text çıxarmaq olar
Preview üçün orijinal sənəd göstərilməlidir
Edit üçün sənəd formatına uyğun ayrıca editor axını olmalıdır
Export orijinal sənəd modelindən gəlməlidir, yenidən sıfırdan qurulmamalıdır
Tövsiyə Edilən Həll

Ən praktik və stabil həll:

DOCX üçün ONLYOFFICE Docs inteqrasiyası
PDF üçün preview-only + convert to editable DOCX
AI suggestion-lar üçün plain text replace yox, document patch workflow
Bu yanaşma ilə:

DOCX-də font, icon, line, image, color, table, spacing daha yaxşı qorunur
PDF-də istifadəçiyə yanlış gözlənti vermirsən
mövcud AI müqayisə sistemi də qalır
Implementasiya Planı

Mövcud axını iki hissəyə böl
Analysis pipeline
fayldan plain text çıxar
job ilə müqayisə et
suggestion yarat
Document pipeline
orijinal faylı saxla
preview ver
edit session yarat
save et
export et
Yeni sənəd domain-i əlavə et
Backend-də ayrıca modul yarat:
apps/api/services/document_session_service.py
apps/api/services/document_conversion_service.py
apps/api/services/document_patch_service.py
Bu modulların rolu:

document_session_service
edit session yaradır
source file, editable file, preview metadata saxlayır
document_conversion_service
PDF -> DOCX conversion idarə edir
DOCX preview/export helper-ləri saxlayır
document_patch_service
AI suggestion-ları sənədə tətbiq etmək üçün patch hazırlayır
Məlumat modelini genişləndir
Yeni entity-lər və response field-lər lazım olacaq:
document_id
source_type = pdf | docx
editable_type = docx | none
preview_url
editable_url
original_file_url
requires_conversion
conversion_status
Pydantic schema-lara əlavə et:

schemas.py
Upload axınını dəyiş
Hazır upload saxlanılsın, amma metadata artsın:
orijinal fayl ayrıca saxlanılsın
docx isə birbaşa editable sayılsın
pdf isə əvvəlcə preview-only kimi qeyd olunsun
Yeni storage strukturu tövsiyəsi:

uploads/cv/original/
uploads/cv/editable/
uploads/cv/derived/
uploads/cv/previews/
Yeni backend endpoint-lər əlavə et
cv_analysis_router.py içində və ya ayrıca document_router.py aç:
POST /api/document/session
cv_url qəbul edir
session yaradır
source type qaytarır
POST /api/document/convert-to-docx
pdf üçün editable DOCX yaradır
GET /api/document/session/{id}
status, preview_url, editable_url qaytarır
POST /api/document/apply-suggestions
suggestion-ları structured şəkildə tətbiq edir
POST /api/document/save
editor-dən gələn dəyişiklikləri saxlayır
POST /api/document/export
final DOCX/PDF export verir
DOCX editing üçün ONLYOFFICE inteqrasiyası qur
İdeal flow:
backend ONLYOFFICE config yaradır
frontend editor iframe və ya official component ilə açır
save callback backend-ə qayıdır
backend updated DOCX-i saxlayır
Burada ayrıca config lazımdır:

ONLYOFFICE_DOCUMENT_SERVER_URL
ONLYOFFICE_JWT_SECRET
.env.example-a da əlavə olunmalıdır.

PDF üçün düzgün UX qur
PDF-i birbaşa contentEditable etmə. Bunun əvəzinə:
solda AI suggestion-lar
sağda PDF preview
üst hissədə Convert to editable DOCX action
conversion bitəndən sonra Edit in document editor
Yəni PDF axını belə olsun:

upload PDF

analysis işləsin

preview göstərilsin

user istəsə convert et

DOCX editor aç

save/export et

Mövcud draft sistemini mərhələli şəkildə dəyiş
Hazırda problemli hissələr:

cv_extractor.py
cv_document_service.py
CVWorkspaceDialog.tsx
use-cv-match.ts
Dəyişiklik strategiyası:

draftText analysis üçün qalsın
draftHtml əsas editor modeli olmaqdan çıxsın
onun yerinə documentSession modeli gəlsin
Frontend state modelini yenilə
useCVMatch içində yeni state əlavə et:
documentSession
documentMode
conversionStatus
editableAvailable
previewUrl
editorConfig
Yəni draftHtml mərkəzli state-dən document-session mərkəzli state-ə keç.

UI axınını yenidən qur
CVWorkspaceDialog.tsx üçün yeni davranış:
DOCX
Preview original
Edit live
Apply suggestion
Save
Download
PDF
Preview original
Suggestions only
Convert to editable DOCX
conversion bitəndən sonra Edit live
Suggestion tətbiq etmə məntiqini dəyiş
Hazırkı applySuggestionToDraft/applySuggestionToHtml zəifdir. Bunun əvəzinə:
suggestion-lar section-based olsun
məsələn skills, summary, experience anchor-ları ilə işləsin
editor açıqdırsa suggestion “insert at section” əmri kimi getsin
mümkün deyilsə user-a review mode göstərilsin
Yəni text replace yox, belə model:

operation: insert | replace | append
target_section
target_hint
payload_text
Conversion layer seçimi
PDF -> DOCX üçün seçimlər:
ilkin mərhələ: LibreOffice/unoconv ilə yoxla
daha yaxşı nəticə üçün kommersiya converter düşün
əgər fidelity kritikdirsə Apryse/PDFTron kimi alət lazım ola bilər
Vacib qeyd:

open-source conversion ilə PDF-də 100% fidelity gözləmə
bu səbəbdən PDF üçün “preview + convert for editing” modeli daha dürüstdür
Təhlükəsizlik və storage
edit session user-a bağlı olsun
callback URL-lər imzalı olsun
uploaded və derived file-lar üçün access control olsun
temp conversion faylları TTL ilə silinsin
Test planı
Ayrı test dataset hazırla:
sadə DOCX
icon-lu DOCX
table-lı DOCX
iki sütunlu DOCX
şəkilli DOCX
text-based PDF
scanned PDF
complex layout PDF
Yoxlanacaq kriteriyalar:

preview fidelity
edit sonrası layout qorunması
export correctness
suggestion insertion accuracy
conversion failure handling
İcra Sırası

document session backend skeleti
schema və endpoint-lər
frontend state refactor
PDF/DOCX flow ayrımı
ONLYOFFICE DOCX editor inteqrasiyası
PDF -> DOCX conversion flow
suggestion patch workflow
export/save sabitləşdirmə
test dataset və regression testlər
Ən Vacib Qərar

Bu işdə ən kritik qərar budur:

contentEditable HTML editor saxlanılsın, yoxsa
embedded real document editor-a keçilsin
Mənim güclü tövsiyəm:

contentEditable yanaşmasını tərk et
DOCX = real editor, PDF = preview + convert modelinə keç