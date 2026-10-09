import { renderSmsTemplate } from "@/lib/sms/template";

/**
 * Email subject and body use the same placeholders as the SMS template:
 * {name} {reference} {items} {amount} {receipt}.
 */
export const renderEmailTemplate = renderSmsTemplate;

/** A subject must be one line; strip anything that could break it. */
export function singleLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}
