/**
 * Notifications settings: toggle, delivery method, Bark config, sound.
 */
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SettingEditor } from './setting-editor';
import { useCategorySettings } from './use-category-settings';
import { useNotificationPermission, sendReplyNotification } from '@/hooks/use-notifications';
import { showSnackbar } from '@/stores/snackbar-store';

export function NotificationSettings() {
  const { t } = useTranslation();
  const runtimeSettings = useCategorySettings('notifications');
  const { permission, requestPermission } = useNotificationPermission();

  // Extract current values for conditional UI
  const settingsMap = Object.fromEntries(
    runtimeSettings.settings.map((s) => [s.key, s.value]),
  );
  const currentType = (settingsMap['notifications.type'] as string) ?? 'browser';
  const currentEnabled = settingsMap['notifications.enabled'] !== false;

  const handleTestNotification = async () => {
    try {
      await sendReplyNotification();
      showSnackbar(t('Test notification sent'), 'success');
    } catch {
      showSnackbar(t('Failed to send test notification'), 'error');
    }
  };

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t('Notifications')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('Receive notifications when AI replies are complete. Notifications are sent for all threads, regardless of which one you are currently viewing.')}
        </p>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('Notification Settings')}
          </h2>
        </div>

        {runtimeSettings.isLoading && (
          <div className="rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
            {t('Loading...')}
          </div>
        )}

        {runtimeSettings.settings
          .filter((s) => s.key === 'notifications.enabled' || s.key === 'notifications.type' || s.key === 'notifications.soundEnabled')
          .map((setting) => (
            <SettingEditor
              key={setting.key}
              setting={setting}
              draft={runtimeSettings.drafts[setting.key] ?? ''}
              disabled={runtimeSettings.isSaving}
              onDraftChange={runtimeSettings.handleDraftChange}
              onSave={runtimeSettings.handleSave}
              onReset={runtimeSettings.handleReset}
            />
          ))}
      </section>

      {/* Browser notification permission */}
      {currentEnabled && (currentType === 'browser' || currentType === 'both') && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t('Browser Notification Permission')}
            </h2>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
              <div className="flex items-center gap-3">
                {permission === 'granted' ? (
                  <Bell className="h-4 w-4 text-green-500" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">
                  {permission === 'granted'
                    ? t('Permission granted')
                    : permission === 'denied'
                      ? t('Permission denied')
                      : t('Permission not requested yet')}
                </span>
              </div>
              {permission !== 'granted' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={permission === 'denied'}
                  onClick={() => void requestPermission()}
                >
                  {t('Request permission')}
                </Button>
              )}
            </div>
          </section>
        </>
      )}

      {/* Bark configuration */}
      {currentEnabled && (currentType === 'bark' || currentType === 'both') && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t('Bark Configuration')}
            </h2>
            {runtimeSettings.settings
              .filter((s) => s.key.startsWith('notifications.bark'))
              .map((setting) => (
                <SettingEditor
                  key={setting.key}
                  setting={setting}
                  draft={runtimeSettings.drafts[setting.key] ?? ''}
                  disabled={runtimeSettings.isSaving}
                  placeholder={setting.key === 'notifications.barkUrl' ? 'https://api.day.app' : setting.key === 'notifications.barkKey' ? '请输入 Bark 设备密钥' : undefined}
                  onDraftChange={runtimeSettings.handleDraftChange}
                  onSave={runtimeSettings.handleSave}
                  onReset={runtimeSettings.handleReset}
                />
              ))}
          </section>
        </>
      )}

      <Separator />

      {/* Test notification button */}
      <section>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
          <div className="flex items-center gap-3">
            {runtimeSettings.drafts['notifications.soundEnabled'] !== 'false' ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            <span className="text-sm">{t('Send a test notification')}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={runtimeSettings.isSaving}
            onClick={() => void handleTestNotification()}
          >
            {t('Test')}
          </Button>
        </div>
      </section>
    </>
  );
}
