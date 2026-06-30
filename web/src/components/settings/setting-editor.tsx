/** Reusable editor for a single runtime setting with Save/Reset actions. */
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  settingLabel,
  sourceLabel,
  sourceVariant,
  formatSettingValue,
  type RuntimeSetting,
} from './setting-helpers';
import { cn } from '@/lib/utils';

interface Props {
  setting: RuntimeSetting;
  draft: string;
  disabled: boolean;
  /** Optional placeholder for text inputs. Defaults to setting.defaultValue. */
  placeholder?: string;
  onDraftChange: (key: string, value: string) => void;
  onSave: (setting: RuntimeSetting) => void;
  onReset: (key: string) => void;
}

export function SettingEditor({
  setting,
  draft,
  disabled,
  placeholder,
  onDraftChange,
  onSave,
  onReset,
}: Props) {
  const { t } = useTranslation();
  const isDbOverride = setting.source === 'db';

  const hasEnum = setting.constraints.enum && setting.constraints.enum.length > 0;

  /** Renders the appropriate input control based on setting type and constraints. */
  function renderControl() {
    // ── Enum → select dropdown ──────────────────────────────────────────
    if (hasEnum) {
      return (
        <select
          value={draft}
          onChange={(e) => onDraftChange(setting.key, e.target.value)}
          disabled={disabled}
          className={cn(
            'h-8 rounded-md border border-input bg-background px-3 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          )}
        >
          {(setting.constraints.enum as string[]).map((opt) => (
            <option key={opt} value={opt}>
              {t(`setting.option.${setting.key}.${opt}`, opt)}
            </option>
          ))}
        </select>
      );
    }

    // ── Boolean → select (true / false) ─────────────────────────────────
    if (setting.type === 'boolean') {
      return (
        <select
          value={draft}
          onChange={(e) => onDraftChange(setting.key, e.target.value)}
          disabled={disabled}
          className={cn(
            'h-8 rounded-md border border-input bg-background px-3 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          )}
        >
          <option value="true">{t('setting.option.true')}</option>
          <option value="false">{t('setting.option.false')}</option>
        </select>
      );
    }

    // ── Number → numeric input ──────────────────────────────────────────
    if (setting.type === 'number') {
      return (
        <Input
          type="number"
          value={draft}
          min={setting.constraints.min}
          max={setting.constraints.max}
          step={setting.constraints.integer ? 1 : undefined}
          disabled={disabled}
          placeholder={placeholder ?? String(setting.defaultValue ?? '')}
          onChange={(e) => onDraftChange(setting.key, e.target.value)}
          className="h-8 w-40"
        />
      );
    }

    // ── String / JSON → text input ──────────────────────────────────────
    return (
      <Input
        value={draft}
        disabled={disabled}
        placeholder={placeholder ?? String(setting.defaultValue ?? '')}
        onChange={(e) => onDraftChange(setting.key, e.target.value)}
        className="h-8 w-64"
      />
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">
              {t(settingLabel(setting.key))}
            </h3>
            <Badge variant={sourceVariant(setting.source)}>
              {t(sourceLabel(setting.source))}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(setting.description)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('Default')}: {formatSettingValue(setting.defaultValue)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {renderControl()}

        <Button
          size="sm"
          className="h-8"
          disabled={disabled}
          onClick={() => onSave(setting)}
        >
          {t('Save')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={disabled || !isDbOverride}
          onClick={() => onReset(setting.key)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('Reset')}
        </Button>
      </div>
    </div>
  );
}
