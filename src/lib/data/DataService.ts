import { IDatabaseAdapter } from './interfaces';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { ApiAdapter } from './adapters/api/ApiAdapter';
import { DATABASE_CONFIG, DatabaseProvider } from '../../config/database';

// ============================================================================
//  DataService — نقطة الوصول الموحدة لجميع عمليات قواعد البيانات والتحكم بها
//  الواجهة تقرأ وتكتب عبر API Routes، والـ API يتعامل مع Supabase Server-side.
// ============================================================================

export class DataService {
  private static instance: DataService;

  /** المحوّل النشط حالياً لتنفيذ جميع العمليات */
  public db: IDatabaseAdapter;
  
  /** نوع مزود البيانات النشط */
  public provider: DatabaseProvider;

  private constructor() {
    const configuredProvider = DATABASE_CONFIG.PROVIDER || 'api';
    // نسخة المشروع القديمة كانت تستخدم "supabase" للوصول المباشر من المتصفح.
    // نحافظ على نفس القيمة لكن نشغل ApiAdapter لضمان أن كل CRUD يمر عبر /api/*.
    this.provider = configuredProvider === 'local' ? 'local' : 'api';
    
    if (this.provider === 'local') {
      this.db = new LocalStorageAdapter();
      if (typeof window !== 'undefined') {
        console.info('[DataService] Connected to Local Database (LocalStorage).');
      }
    } else {
      this.db = new ApiAdapter();
      if (typeof window !== 'undefined') {
        console.info('[DataService] Connected to Supabase through Vercel API Routes.');
      }
    }
  }

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  /** تبديل مزود قاعدة البيانات ديناميكياً */
  public setProvider(newProvider: DatabaseProvider): void {
    this.provider = newProvider === 'local' ? 'local' : 'api';
    this.db = this.provider === 'local' ? new LocalStorageAdapter() : new ApiAdapter();
  }
}

export const dataService = DataService.getInstance();
