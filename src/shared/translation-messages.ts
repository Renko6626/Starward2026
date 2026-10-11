import type { SiteLanguage } from './i18n';

export type TranslationMessages = Record<string, { zh: string; en: string }>;

function compileTemplate(source: string) {
  const variables: string[] = [];
  let pattern = '^';
  let previous = 0;
  for (const match of source.matchAll(/\{\{(\w+)\}\}/g)) {
    pattern += source.slice(previous, match.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\s\\S]*?)';
    variables.push(match[1]!);
    previous = match.index + match[0].length;
  }
  pattern += source.slice(previous).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
  return { expression: new RegExp(pattern), variables };
}

/** Compatibility adapter for known system text produced by existing Chinese-default helpers. */
export function createMessageTranslator(messages: TranslationMessages, resolveValue?: (
  key: string, name: string, value: string, values: Record<string, string>, language: SiteLanguage,
) => string) {
  const exact = new Map<string, { zh: string; en: string }>();
  const templates: { key: string; expression: RegExp; variables: string[]; zh: string; en: string }[] = [];
  for (const [key, pair] of Object.entries(messages)) {
    for (const source of new Set([pair.zh, pair.en])) {
      if (source.includes('{{')) templates.push({ key, ...compileTemplate(source), ...pair });
      else if (!exact.has(source)) exact.set(source, pair);
    }
  }
  return (text: string, language: SiteLanguage): string => {
    const exactPair = exact.get(text);
    const target = language === 'en' ? 'en' : 'zh';
    if (exactPair) return exactPair[target];
    for (const template of templates) {
      const match = template.expression.exec(text);
      if (!match) continue;
      const values = Object.fromEntries(template.variables.map((name, index) => [name, match[index + 1] ?? '']));
      return template[target].replace(/\{\{(\w+)\}\}/g, (_, name: string) => resolveValue?.(template.key, name, values[name] ?? '', values, language) ?? values[name] ?? '');
    }
    return text;
  };
}
