import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const locale = (cookieStore.get('locale')?.value ?? 'en') as 'en' | 'sw';
  const validLocales = ['en', 'sw'];
  const resolvedLocale = validLocales.includes(locale) ? locale : 'en';

  return {
    locale: resolvedLocale,
    messages: (await import(`./messages/${resolvedLocale}.json`)).default,
    timeZone: 'Africa/Dar_es_Salaam',
    now: new Date(),
  };
});
