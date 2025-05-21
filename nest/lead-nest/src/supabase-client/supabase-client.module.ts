import { Module, Global } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SupabaseClientToken = 'SUPABASE_CLIENT';

const supabaseProvider = {
  provide: SupabaseClientToken,
  useFactory: (): SupabaseClient => {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_KEY || '';
    return createClient(url, key);
  },
};

@Global()
@Module({
  providers: [supabaseProvider],
  exports: [supabaseProvider],
})
export class SupabaseClientModule {}
