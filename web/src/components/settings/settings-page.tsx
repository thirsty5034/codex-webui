/**
 * Settings page with General tab (theme, language, logout).
 */
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Sun, Moon, Globe, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useThemeStore } from '@/stores/theme-store';
import { useTimelineStore } from '@/stores/timeline-store';
import { clearApiToken } from '@/auth-token';
import { resetSocket } from '@/socket';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dark = useThemeStore((s) => s.dark);
  const toggleDark = useThemeStore((s) => s.toggleDark);
  const threadId = useTimelineStore((s) => s.threadId);

  const navigateBack = () => {
    if (threadId) {
      void navigate({ to: '/t/$threadId', params: { threadId } });
    } else {
      void navigate({ to: '/' });
    }
  };

  const handleLogout = () => {
    clearApiToken();
    resetSocket();
    void navigate({ to: '/login', search: { redirect: '/' } });
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={navigateBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">{t('Settings')}</h1>
        </div>

        <Separator />

        {/* Appearance */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('Appearance')}
          </h2>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
            <div className="flex items-center gap-3">
              {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span className="text-sm">{t('Theme')}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={toggleDark}
            >
              {dark ? t('Light mode') : t('Dark mode')}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4" />
              <span className="text-sm">{t('Language')}</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant={i18n.language.startsWith('zh') ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => void i18n.changeLanguage('zh-CN')}
              >
                简体中文
              </Button>
              <Button
                variant={!i18n.language.startsWith('zh') ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => void i18n.changeLanguage('en')}
              >
                English
              </Button>
            </div>
          </div>
        </section>

        <Separator />

        {/* Account */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('Account')}
          </h2>

          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-card/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <LogOut className="h-4 w-4 text-destructive" />
              <span className="text-sm">{t('Sign out of this session')}</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={handleLogout}
            >
              {t('Logout')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
