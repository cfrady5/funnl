import { BRAND_IDS, getTheme } from '@tiresias/core';
import { SettingsForm } from '@/components/actions';
import { Card, CardBody, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import { readDb } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Brand() {
  const { settings } = await readDb();
  return (
    <>
      <PageHeader title="Brand & Automation Settings" description="Brand identities are defined in code (packages/core/src/brand.ts), so the video templates, covers and this dashboard can never drift apart. Operational settings are below." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {BRAND_IDS.map((id) => {
          const t = getTheme(id);
          return (
            <Card key={id} style={{ background: t.colors.bg, borderColor: t.colors.hairline }}>
              <CardBody className="flex flex-col gap-5 p-6">
                <div>
                  <div style={{ fontFamily: t.fonts.display === 'Anton' ? 'Anton, Impact, sans-serif' : undefined, color: t.colors.ink }} className="text-3xl font-extrabold tracking-[0.2em]">
                    {t.wordmark}
                  </div>
                  <div className="mt-1 font-mono text-xs tracking-widest" style={{ color: t.colors.accent }}>{t.tagline}</div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(t.colors).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <div className="h-10 rounded-md border border-white/10" style={{ background: v }} />
                      <div className="font-mono text-[10px]" style={{ color: t.colors.inkMuted }}>{k}<br />{v}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  {Object.entries(t.optionColors).map(([label, c]) => (
                    <div key={label} className="flex h-12 w-12 items-center justify-center text-xl font-extrabold text-black" style={{ background: c, borderRadius: id === 'tiresias' ? 12 : 4, border: id === 'antitiresias' ? '3px solid #000' : undefined }}>
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px]" style={{ color: t.colors.inkMuted }}>
                  <span>Series · {t.seriesTitle}</span>
                  <span>Display · {t.fonts.display}</span>
                  <span>Prompt · {t.copy.decisionPrompt}</span>
                  <span>Reveal · {t.copy.revealPrefix}</span>
                  <span>Outro · {t.copy.engagementPrimary}</span>
                  <span>Mono · {t.fonts.mono}</span>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Automation, quality & budget</CardTitle>
          <span className="text-xs text-faint">Timezone: {settings.timezone}</span>
        </CardHeader>
        <CardBody>
          <SettingsForm settings={settings} />
        </CardBody>
      </Card>
    </>
  );
}
