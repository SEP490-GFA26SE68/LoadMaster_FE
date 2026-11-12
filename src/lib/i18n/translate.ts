import { INTL_LOCALES, type Locale } from './locale'
import type {
  MessageKey,
  MessageParams,
  MessageTree,
  ParamsArgs,
  ParamValue,
  PluralMessage,
  TFunction,
} from './types'
import { vi } from './vi'

/**
 * `vi` là ngôn ngữ mặc định nên nằm sẵn trong bundle; ngôn ngữ khác tải lười thành chunk riêng (`loadLocale`), nên người dùng tiếng
 * Việt không tải từ điển tiếng Anh. Kiểu của `en.ts` vẫn so với `vi` lúc build (thiếu / thừa key là lỗi TypeScript).
 */
const DICTIONARIES: Partial<Record<Locale, MessageTree>> = { vi }
const LOADERS: Record<Exclude<Locale, 'vi'>, () => Promise<MessageTree>> = {
  en: () => import('./en').then((module) => module.en),
}

export function isLocaleLoaded(locale: Locale): boolean {
  return DICTIONARIES[locale] !== undefined
}

/** Tải từ điển của một ngôn ngữ (một lần); `vi` có sẵn. Gọi trước `createTranslator` của ngôn ngữ đó. */
export async function loadLocale(locale: Locale): Promise<void> {
  if (locale === 'vi' || isLocaleLoaded(locale)) return
  DICTIONARIES[locale] = await LOADERS[locale]()
}

/** Ngôn ngữ chưa tải (`loadLocale`) thì dịch theo `vi` — `I18nProvider` chỉ đổi ngôn ngữ sau khi tải xong. */
export function createTranslator(locale: Locale): TFunction {
  const messages = DICTIONARIES[locale] ?? vi
  const pluralRules = new Intl.PluralRules(INTL_LOCALES[locale])
  const numbers = new Intl.NumberFormat(INTL_LOCALES[locale])

  function t<Key extends MessageKey>(key: Key, ...params: ParamsArgs<Key>): string
  function t(key: string, params?: MessageParams): string {
    const message = lookup(messages, key)
    if (message === undefined) return key

    const text =
      typeof message === 'string' ? message : pickPlural(message, params?.count, pluralRules)
    return interpolate(text, params, numbers)
  }

  return t
}

type MessageNode = MessageTree[string]

function isPluralMessage(node: MessageNode): node is PluralMessage {
  return (
    typeof node === 'object' &&
    typeof node.one === 'string' &&
    typeof node.other === 'string' &&
    Object.keys(node).length === 2
  )
}

function lookup(messages: MessageTree, key: string): string | PluralMessage | undefined {
  let node: MessageNode | undefined = messages
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string' || isPluralMessage(node)) return undefined
    node = node[part]
  }
  return node === undefined || typeof node === 'string' || isPluralMessage(node) ? node : undefined
}

function pickPlural(
  message: PluralMessage,
  count: ParamValue | undefined,
  pluralRules: Intl.PluralRules,
): string {
  return typeof count === 'number' && pluralRules.select(count) === 'one'
    ? message.one
    : message.other
}

function interpolate(
  text: string,
  params: MessageParams | undefined,
  numbers: Intl.NumberFormat,
): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name]
    if (value === undefined) return placeholder
    return typeof value === 'number' ? numbers.format(value) : value
  })
}
