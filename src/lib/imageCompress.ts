// ============================================================
//  أداة ضغط الصور قبل الرفع — تقليل الحجم إلى أقل من 1 ميجا
// ============================================================

/**
 * يضغط صورة (File) ويعيد Base64 صغير الحجم.
 * - الحد الأقصى للطول/العرض: 1200px
 * - الجودة تبدأ من 0.8 وتنخفض تدريجياً حتى يصل الحجم < 1MB
 * - الصيغة النهائية: JPEG (أو PNG للصور الشفافة)
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 1,
  maxDimension: number = 1200
): Promise<{ base64: string; sizeKB: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('الملف ليس صورة'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('فشل تحميل الصورة'));
      img.onload = () => {
        // حساب الأبعاد الجديدة مع الحفاظ على النسبة
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('فشل إنشاء canvas'));
          return;
        }

        // خلفية بيضاء للصور ذات الشفافية (لتحويلها لـ JPEG)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        let quality = 0.8;
        let result = canvas.toDataURL('image/jpeg', quality);

        // تقليل الجودة تدريجياً حتى يصل الحجم للحد المطلوب
        while (result.length * 0.75 > maxSizeBytes && quality > 0.2) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }

        // إذا ما زال كبيراً، نصغّر الأبعاد أكثر
        while (result.length * 0.75 > maxSizeBytes && width > 200) {
          width = Math.round(width * 0.8);
          height = Math.round(height * 0.8);
          canvas.width = width;
          canvas.height = height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          result = canvas.toDataURL('image/jpeg', quality);
        }

        const sizeKB = Math.round((result.length * 0.75) / 1024);
        resolve({ base64: result, sizeKB, width, height });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** تنسيق حجم الملف لعرضه */
export function formatFileSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
